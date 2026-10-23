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
/**
 * Computes the expected Plivo V2 signature using HMAC-SHA256.
 * Plivo V2 format: <URL><Nonce>
 */
export function computePlivoV2Signature(
  url: string,
  nonce: string,
  authToken: string
): string {
  return crypto
    .createHmac('sha256', authToken)
    .update(`${url}${nonce}`)
    .digest('base64');
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
 * Accounts for reverse proxies, scheme rewriting, port 443, query string inclusion, and PUBLIC_URL configuration.
 */
function getCandidateTargetUrls(req: Request): string[] {
  const urls: string[] = [];
  const reqUrl = req.originalUrl || `${req.baseUrl || ''}${req.path}`;

  if (reqUrl.startsWith('http://') || reqUrl.startsWith('https://')) {
    urls.push(reqUrl);
  }

  let pathWithQuery = reqUrl;
  let pathWithoutQuery = req.path || reqUrl.split('?')[0];

  try {
    if (reqUrl.startsWith('http://') || reqUrl.startsWith('https://')) {
      const parsed = new URL(reqUrl);
      pathWithQuery = `${parsed.pathname}${parsed.search}`;
      pathWithoutQuery = parsed.pathname;
    }
  } catch {}

  const baseDomains: string[] = [];
  if (env.PUBLIC_URL && env.PUBLIC_URL.trim()) {
    baseDomains.push(env.PUBLIC_URL.trim().replace(/\/+$/, ''));
  }

  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || 'localhost';
  const reconstructedBase = `${proto}://${host}`;
  if (!baseDomains.includes(reconstructedBase)) {
    baseDomains.push(reconstructedBase);
  }

  for (const base of baseDomains) {
    for (const p of [pathWithQuery, pathWithoutQuery]) {
      const u = `${base}${p}`;
      if (!urls.includes(u)) urls.push(u);

      if (base.startsWith('https://') && !base.includes(':443')) {
        const u443 = base.replace('https://', 'https://') + ':443' + p;
        if (!urls.includes(u443)) urls.push(u443);
      }
    }
  }

  return urls;
}

/**
 * Express middleware enforcing cryptographic Plivo signature verification.
 * Supports Plivo V3, Plivo V2, and signed HMAC callback tokens.
 * Fail-closed in production if credentials, headers, and tokens are missing.
 */
export async function verifyPlivoWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
  const sigV3 = (req.header('X-Plivo-Signature-V3') || req.header('x-plivo-signature-v3') || '').trim();
  const sigMaV3 = (req.header('X-Plivo-Signature-Ma-V3') || req.header('x-plivo-signature-ma-v3') || '').trim();
  const nonceV3 = (req.header('X-Plivo-Signature-V3-Nonce') || req.header('x-plivo-signature-v3-nonce') || '').trim();

  const sigV2 = (req.header('X-Plivo-Signature-V2') || req.header('x-plivo-signature-v2') || '').trim();
  const sigMaV2 = (req.header('X-Plivo-Signature-Ma-V2') || req.header('x-plivo-signature-ma-v2') || '').trim();
  const nonceV2 = (req.header('X-Plivo-Signature-V2-Nonce') || req.header('x-plivo-signature-v2-nonce') || '').trim();

  const querySig = ((req.query.sig || (req.body && req.body.sig) || '') as string).trim();
  const callId = ((req.query.callId || (req.body && req.body.callId) || '') as string).trim();

  // In development/test mode without credentials configured, allow simulated pass-through with log
  const hasParentCreds = Boolean((process.env.PLIVO_AUTH_TOKEN || env.PLIVO_AUTH_TOKEN || '').trim());
  if (!hasParentCreds && env.NODE_ENV !== 'production' && !sigV3 && !sigMaV3 && !sigV2 && !sigMaV2 && !querySig) {
    logger.warn('Plivo Webhook: Bypassing signature verification (dev mode: no credentials configured)');
    return next();
  }

  // 1. Authenticate via cryptographic URL HMAC token if present
  if (querySig && callId) {
    const { getWebhookSigningSecret } = await import('../utils/security');
    const secret = getWebhookSigningSecret();
    const expectedSig = crypto.createHmac('sha256', secret).update(callId).digest('hex');
    if (timingSafeCompare(expectedSig, querySig)) {
      logger.info('Plivo Webhook: Request authenticated via cryptographic call token', { callId });
      return next();
    }
  }

  const hasV3 = Boolean((sigV3 || sigMaV3) && nonceV3);
  const hasV2 = Boolean((sigV2 || sigMaV2) && nonceV2);

  // 2. Header presence validation
  if (!hasV3 && !hasV2) {
    logger.warn('Plivo Webhook: Missing required signature or nonce headers', {
      hasSigV3: Boolean(sigV3),
      hasSigMaV3: Boolean(sigMaV3),
      hasNonceV3: Boolean(nonceV3),
      hasSigV2: Boolean(sigV2),
      hasNonceV2: Boolean(nonceV2),
      hasQuerySig: Boolean(querySig),
      ip: req.ip,
      path: req.path,
    });
    res.status(403).json({ success: false, error: 'Forbidden: Missing Plivo signature headers' });
    return;
  }

  // 3. Replay protection check
  const activeNonce = nonceV3 || nonceV2;
  cleanupExpiredNonces();
  if (activeNonce && nonceReplayCache.has(activeNonce)) {
    logger.warn('Plivo Webhook: Replay attack detected (nonce reused)', { nonce: activeNonce, ip: req.ip });
    res.status(403).json({ success: false, error: 'Forbidden: Replayed webhook nonce' });
    return;
  }

  // 4. Candidate tokens & URLs
  const candidateTokens = await resolveAuthTokens(req);
  if (candidateTokens.length === 0) {
    logger.error('Plivo Webhook: No auth tokens configured for verification');
    res.status(403).json({ success: false, error: 'Forbidden: Telephony credentials not configured' });
    return;
  }

  const candidateUrls = getCandidateTargetUrls(req);
  const method = req.method;
  const params = method.toUpperCase() === 'POST' ? req.body : {};

  let verified = false;

  // Verify V3 signatures
  if (hasV3) {
    const receivedV3Sigs = [
      ...sigV3.split(',').map((s) => s.trim()).filter(Boolean),
      ...sigMaV3.split(',').map((s) => s.trim()).filter(Boolean),
    ];
    for (const token of candidateTokens) {
      for (const targetUrl of candidateUrls) {
        const computed = computePlivoV3Signature(targetUrl, nonceV3, token, method, params);
        for (const received of receivedV3Sigs) {
          if (timingSafeCompare(computed, received)) {
            verified = true;
            break;
          }
        }
        if (verified) break;
      }
      if (verified) break;
    }
  }

  // Verify V2 signatures if not yet verified
  if (!verified && hasV2) {
    const receivedV2Sigs = [
      ...sigV2.split(',').map((s) => s.trim()).filter(Boolean),
      ...sigMaV2.split(',').map((s) => s.trim()).filter(Boolean),
    ];
    for (const token of candidateTokens) {
      for (const targetUrl of candidateUrls) {
        const computed = computePlivoV2Signature(targetUrl, nonceV2, token);
        for (const received of receivedV2Sigs) {
          if (timingSafeCompare(computed, received)) {
            verified = true;
            break;
          }
        }
        if (verified) break;
      }
      if (verified) break;
    }
  }

  if (!verified) {
    logger.warn('Plivo Webhook: Signature verification failed', {
      ip: req.ip,
      method,
      path: req.path,
      hasV3,
      hasV2,
    });
    res.status(403).json({ success: false, error: 'Forbidden: Invalid Plivo webhook signature' });
    return;
  }

  // Record nonce in replay cache
  if (activeNonce) {
    nonceReplayCache.set(activeNonce, Date.now() + NONCE_TTL_MS);
  }

  next();
}
