import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export const verifyVobizWebhook = (req: Request, res: Response, next: NextFunction): void => {
  const sig = req.header('X-Vobiz-Signature');
  const secret = env.VOBIZ_WEBHOOK_SECRET;

  if (secret && sig) {
    const rawBody = (req as any).rawBody;
    if (!rawBody) {
      logger.warn('Vobiz Webhook: Raw body missing for signature verification');
      res.status(400).json({ success: false, error: 'Raw body missing' });
      return;
    }

    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) {
      logger.warn('Vobiz Webhook: Invalid signature', { expected, sig });
      res.status(401).json({ success: false, error: 'Unauthorized: Invalid signature' });
      return;
    }
  } else {
    logger.warn('Vobiz Webhook: Missing signature or secret', { hasSecret: !!secret, hasSig: !!sig });
    res.status(401).json({ success: false, error: 'Unauthorized: Missing signature' });
    return;
  }

  next();
};
