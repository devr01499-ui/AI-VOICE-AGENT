import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * Middleware enforcing cryptographic HMAC-SHA256 signature verification or Token authentication
 * on all Vobiz webhook callbacks. Unauthenticated requests are rejected with HTTP 401.
 */
export const verifyVobizWebhook = (req: Request, res: Response, next: NextFunction): void => {
  const sig = req.header('X-Vobiz-Signature');
  const token = req.header('X-Vobiz-Token') || req.header('Authorization');
  const secret = env.VOBIZ_WEBHOOK_SECRET || env.VOBIZ_AUTH_TOKEN;

  // 1. Cryptographic HMAC-SHA256 Signature Verification
  if (sig && secret) {
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    try {
      if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) {
        next();
        return;
      }
    } catch (e) {
      logger.warn('Vobiz Webhook: Signature verification error', { error: String(e) });
    }
  }

  // 2. Secret Token Verification
  if (token && secret && (token === secret || token === `Bearer ${secret}`)) {
    next();
    return;
  }

  // 3. Vobiz Header / Auth ID Verification
  if (secret && req.header('X-Vobiz-Auth-ID') === env.VOBIZ_AUTH_ID) {
    next();
    return;
  }

  // Strict Fail Closed: Reject unauthenticated webhook requests
  logger.warn('Vobiz Webhook: Unauthenticated webhook attempt blocked', {
    hasSig: !!sig,
    hasToken: !!token,
    ip: req.ip
  });
  res.status(401).json({ success: false, error: 'Unauthorized: Invalid or missing webhook credentials' });
};
