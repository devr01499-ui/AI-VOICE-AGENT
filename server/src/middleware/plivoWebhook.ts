import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';
import { EncryptionService } from '../utils/EncryptionService';

// Sliding window replay cache: stores { nonce => expiresAt timestamp }
const nonceReplayCache = new Map<string, number>();
const NONCE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Prune expired nonces periodically to prevent memory leaks
function cleanupExpiredNonces(): void {
  const now = Date.now();
  for (const [nonce, expiresAt] of nonceReplayCache.entries()) {
    if (now >= expiresAt) {
      nonceReplayCache.delete(nonce);
    }
  }
}

/**
 * Computes the expected Plivo V3 signature using HMAC-SHA256.
 * Standard Plivo V3 format:
 * - GET: <URL>.<Nonce>
 * - POST: <URL><SortedParamKeysAndValues>.<Nonce>
 */
export function computePlivoV3Signature(
  url: string,
  nonce: string,
  authToken: string,
  method: string,
  params: Record<string, any> = {}
): string {
  let message = url;

  if (method.toUpperCase() === 'POST' && params && typeof params === 'object') {
    const keys = Object.keys(params).sort();
    let paramStr = '';
    for (const key of keys) {
      const val = params[key];
      paramStr += `${key}${val !== undefined && val !== null ? String(val) : ''}`;
    }
    message += paramStr;
  }

  message += `.${nonce}`;

  return crypto
    .createHmac('sha256', authToken)
    .update(message)
    .digest('base64');
}

/**
 * Safely compares two base64 signatures in constant time.
 */
function timingSafeCompare(computed: string, received: string): boolean {
  try {
    const bufA = Buffer.from(computed, 'utf8');
    const bufB = Buffer.from(received, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Resolves the candidate auth tokens for verification:
 * 1. Parent PLIVO_AUTH_TOKEN
 * 2. If caller/recipient maps to a tenant PlivoSubAccount, include decrypted subaccount token.
 */
async function resolveAuthTokens(req: Request): Promise<string[]> {
  const parentToken = (process.env.PLIVO_AUTH_TOKEN || env.PLIVO_AUTH_TOKEN || '').trim();
  const tokens: string[] = [];

  if (parentToken) {
    tokens.push(parentToken);
  }

  // Attempt sub-account lookup from payload identifiers
  const data = { ...(req.query as Record<string, any>), ...(req.body as Record<string, any>) };
  const to = ((data.To || data.to || '') as string).trim();
  const from = ((data.From || data.from || '') as string).trim();
  const callUuid = ((data.CallUUID || data.callUUID || data.call_uuid || data.RequestUUID || data.request_uuid || '') as string).trim();
  const callId = ((data.callId || data.CallId || '') as string).trim();

  try {
    // 1. Try finding number record
    const targetNumbers = [to, from].filter(Boolean);
    if (targetNumbers.length > 0) {
      const phone = await prisma.phoneNumber.findFirst({
        where: {
          phoneNumber: { in: targetNumbers },
          telephonyProvider: 'plivo',
        },
        select: { userId: true },
      });

      if (phone?.userId) {
        const sub = await prisma.plivoSubAccount.findUnique({
          where: { userId: phone.userId },
          select: { authToken: true, enabled: true },
        });
        if (sub && sub.enabled && sub.authToken && sub.authToken !== 'DIRECT_PARENT_ACCOUNT') {
          const decrypted = EncryptionService.decrypt(sub.authToken);
          if (decrypted && !tokens.includes(decrypted)) {
            tokens.push(decrypted);
          }
        }
      }
    }

    // 2. Try finding call session record
    if (callId || callUuid) {
      const call = await prisma.call.findFirst({
        where: {
          OR: [
            ...(callId ? [{ id: callId }] : []),
            ...(callUuid ? [{ telemetryId: callUuid }] : []),
          ],
        },
        select: { userId: true },
      });

      if (call?.userId) {
        const sub = await prisma.plivoSubAccount.findUnique({
          where: { userId: call.userId },
          select: { authToken: true, enabled: true },
        });
        if (sub && sub.enabled && sub.authToken && sub.authToken !== 'DIRECT_PARENT_ACCOUNT') {
          const decrypted = EncryptionService.decrypt(sub.authToken);
          if (decrypted && !tokens.includes(decrypted)) {
            tokens.push(decrypted);
          }
        }
      }
    }
  } catch (err: any) {
    logger.warn('Plivo Webhook: Error resolving subaccount token', { error: err.message });
  }

  return tokens;
}

/**
 * Builds candidate target URLs that Plivo might have signed.
 * Accounts for reverse proxies, scheme rewriting, and PUBLIC_URL configuration.
 */
function getCandidateTargetUrls(req: Request): string[] {
  const urls: string[] = [];
  const reqUrl = req.originalUrl || `${req.baseUrl || ''}${req.path}`;

  if (reqUrl.startsWith('http://') || reqUrl.startsWith('https://')) {
    urls.push(reqUrl);
  }

  let pathOnly = reqUrl;
  try {
    if (reqUrl.startsWith('http://') || reqUrl.startsWith('https://')) {
      const parsed = new URL(reqUrl);
      pathOnly = `${parsed.pathname}${parsed.search}`;
    }
  } catch {}

  // 1. Authoritative PUBLIC_URL
  if (env.PUBLIC_URL && env.PUBLIC_URL.trim()) {
    const cleanPublic = env.PUBLIC_URL.trim().replace(/\/+$/, '');
    const full = `${cleanPublic}${pathOnly}`;
    if (!urls.includes(full)) {
      urls.push(full);
    }
  }

  // 2. Reconstructed from request headers (behind reverse proxies)
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || 'localhost';
  const reconstructed = `${proto}://${host}${pathOnly}`;
  if (!urls.includes(reconstructed)) {
    urls.push(reconstructed);
  }

  return urls;
}

/**
 * Express middleware enforcing cryptographic Plivo V3 signature verification.
 * Fail-closed in production if credentials or headers are missing.
 */
export async function verifyPlivoWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
  const sigV3 = (req.header('X-Plivo-Signature-V3') || req.header('x-plivo-signature-v3') || '').trim();
  const sigMaV3 = (req.header('X-Plivo-Signature-Ma-V3') || req.header('x-plivo-signature-ma-v3') || '').trim();
  const nonce = (req.header('X-Plivo-Signature-V3-Nonce') || req.header('x-plivo-signature-v3-nonce') || '').trim();

  // In development/test mode without credentials configured, allow simulated pass-through with log
  const hasParentCreds = Boolean((process.env.PLIVO_AUTH_TOKEN || env.PLIVO_AUTH_TOKEN || '').trim());
  if (!hasParentCreds && env.NODE_ENV !== 'production' && !sigV3 && !sigMaV3) {
    logger.warn('Plivo Webhook: Bypassing signature verification (dev mode: no credentials configured)');
    return next();
  }

  // 1. Header presence validation
  if ((!sigV3 && !sigMaV3) || !nonce) {
    logger.warn('Plivo Webhook: Missing required signature or nonce headers', {
      hasSigV3: Boolean(sigV3),
      hasSigMaV3: Boolean(sigMaV3),
      hasNonce: Boolean(nonce),
      ip: req.ip,
      path: req.path,
    });
    res.status(403).json({ success: false, error: 'Forbidden: Missing Plivo signature headers' });
    return;
  }

  // 2. Replay protection check
  cleanupExpiredNonces();
  if (nonceReplayCache.has(nonce)) {
    logger.warn('Plivo Webhook: Replay attack detected (nonce reused)', { nonce, ip: req.ip });
    res.status(403).json({ success: false, error: 'Forbidden: Replayed webhook nonce' });
    return;
  }

  // 3. Candidate tokens & URLs
  const candidateTokens = await resolveAuthTokens(req);
  if (candidateTokens.length === 0) {
    logger.error('Plivo Webhook: No auth tokens configured for verification');
    res.status(403).json({ success: false, error: 'Forbidden: Telephony credentials not configured' });
    return;
  }

  const candidateUrls = getCandidateTargetUrls(req);
  const method = req.method;
  const params = method.toUpperCase() === 'POST' ? req.body : {};

  // Plivo may provide comma-separated signatures if multiple keys are active
  const receivedSignatures: string[] = [
    ...sigV3.split(',').map((s) => s.trim()).filter(Boolean),
    ...sigMaV3.split(',').map((s) => s.trim()).filter(Boolean),
  ];

  let verified = false;

  for (const token of candidateTokens) {
    for (const targetUrl of candidateUrls) {
      const computed = computePlivoV3Signature(targetUrl, nonce, token, method, params);
      for (const received of receivedSignatures) {
        if (timingSafeCompare(computed, received)) {
          verified = true;
          break;
        }
      }
      if (verified) break;
    }
    if (verified) break;
  }

  if (!verified) {
    logger.warn('Plivo Webhook: Signature verification failed', {
      ip: req.ip,
      method,
      path: req.path,
      signaturesReceivedCount: receivedSignatures.length,
    });
    res.status(403).json({ success: false, error: 'Forbidden: Invalid Plivo webhook signature' });
    return;
  }

  // Record nonce in replay cache
  nonceReplayCache.set(nonce, Date.now() + NONCE_TTL_MS);

  next();
}
