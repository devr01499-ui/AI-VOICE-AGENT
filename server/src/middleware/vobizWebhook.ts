import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { getWebhookSigningSecret } from '../utils/security';

// Sliding window replay cache: stores { replayKey => expiresAt timestamp }
const vobizReplayCache = new Map<string, number>();
const REPLAY_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_TIMESTAMP_DRIFT_SEC = 300; // 5 minutes

function cleanupExpiredNonces(): void {
  const now = Date.now();
  for (const [key, expiresAt] of vobizReplayCache.entries()) {
    if (now >= expiresAt) {
      vobizReplayCache.delete(key);
    }
  }
}

/**
 * Constant-time string / buffer comparison to defend against timing side-channels.
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
 * Clears the replay cache for automated test suites.
 */
export function clearVobizReplayCacheForTesting(): void {
  vobizReplayCache.clear();
}

/**
 * Middleware enforcing cryptographic HMAC-SHA256 signature verification or Bearer Token authentication
 * on all Vobiz webhook callbacks. Includes timestamp freshness verification and sliding window replay defense.
 * Unauthenticated or replayed requests are rejected with HTTP 401 / 403.
 */
export const verifyVobizWebhook = (req: Request, res: Response, next: NextFunction): void => {
  const sig = (req.header('X-Vobiz-Signature') || req.header('x-vobiz-signature') || '').trim();
  const token = (req.header('X-Vobiz-Token') || req.header('Authorization') || req.header('authorization') || '').trim();
  const secret = getWebhookSigningSecret();

  // 1. Timestamp Freshness Verification (Clock Drift / Expiry Defense)
  const timestampHeader = req.header('X-Vobiz-Timestamp') || req.header('X-Timestamp') || req.header('x-vobiz-timestamp');
  if (timestampHeader) {
    const parsedTs = parseInt(timestampHeader, 10);
    if (!isNaN(parsedTs)) {
      const epochSec = parsedTs > 1e11 ? Math.floor(parsedTs / 1000) : parsedTs;
      const nowSec = Math.floor(Date.now() / 1000);
      if (Math.abs(nowSec - epochSec) > MAX_TIMESTAMP_DRIFT_SEC) {
        logger.warn('Vobiz Webhook: Timestamp expired or clock drift exceeded', {
          epochSec,
          nowSec,
          driftSec: Math.abs(nowSec - epochSec),
          ip: req.ip,
        });
        res.status(401).json({ success: false, error: 'Unauthorized: Webhook timestamp expired' });
        return;
      }
    }
  }

  // 2. Extract Replay Key / Nonce
  cleanupExpiredNonces();
  const nonce = (
    req.header('X-Vobiz-Nonce') ||
    req.header('x-vobiz-nonce') ||
    req.header('X-Vobiz-Event-Id') ||
    req.header('x-vobiz-event-id') ||
    req.body?.EventId ||
    req.body?.eventId
  ) as string | undefined;

  const replayKey = nonce
    ? `nonce:${nonce}`
    : (sig ? `sig:${sig}` : (token ? `tok:${token}:${timestampHeader || ''}` : null));

  // 3. Replay Attack Check
  if (replayKey && vobizReplayCache.has(replayKey)) {
    logger.warn('Vobiz Webhook: Replay attack detected (duplicate webhook received)', {
      replayKey: replayKey.slice(0, 32),
      ip: req.ip,
      path: req.path,
    });
    res.status(403).json({ success: false, error: 'Forbidden: Webhook replay detected' });
    return;
  }

  let authenticated = false;

  // 4. Cryptographic HMAC-SHA256 Signature Verification
  if (sig && secret) {
    const rawBody = (req as any).rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    if (timingSafeCompare(expected, sig)) {
      authenticated = true;
    } else {
      // Also check candidate tokens (e.g. VOBIZ_AUTH_TOKEN)
      const candidateTokens = [env.VOBIZ_AUTH_TOKEN, process.env.TELEPHONY_AUTH_TOKEN].filter(Boolean) as string[];
      for (const candidate of candidateTokens) {
        const altExpected = crypto
          .createHmac('sha256', candidate)
          .update(rawBody)
          .digest('hex');
        if (timingSafeCompare(altExpected, sig)) {
          authenticated = true;
          break;
        }
      }
    }
  }

  // 5. Secret Token Verification (Bearer or Direct Header)
  if (!authenticated && token && secret) {
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token;
    const cleanSecret = secret.trim();
    if (timingSafeCompare(cleanSecret, cleanToken)) {
      authenticated = true;
    } else if (env.VOBIZ_AUTH_TOKEN && timingSafeCompare(env.VOBIZ_AUTH_TOKEN.trim(), cleanToken)) {
      authenticated = true;
    }
  }

  if (authenticated) {
    if (replayKey) {
      vobizReplayCache.set(replayKey, Date.now() + REPLAY_TTL_MS);
    }
    next();
    return;
  }

  // Strict Fail Closed: Reject unauthenticated webhook requests
  logger.warn('Vobiz Webhook: Unauthenticated webhook attempt blocked', {
    hasSig: Boolean(sig),
    hasToken: Boolean(token),
    ip: req.ip,
    path: req.path,
  });
  res.status(401).json({ success: false, error: 'Unauthorized: Invalid or missing webhook credentials' });
};
