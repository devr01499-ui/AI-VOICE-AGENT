import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export class WebhookController {
  private static validateTelephonySignature(req: Request): boolean {
    const twilioSignature = req.headers['x-twilio-signature'];
    const vobizSignature = req.headers['x-vobiz-signature'];
    const authToken = process.env.TELEPHONY_AUTH_TOKEN;

    if (!authToken) {
      logger.warn('WebhookController: TELEPHONY_AUTH_TOKEN is not configured in the environment. Bypassing signature verification.');
      return true;
    }

    const signature = twilioSignature || vobizSignature;
    if (!signature) {
      logger.warn('WebhookController: Missing telephony signature header');
      return false;
    }

    const safeCompare = (a: string, b: string): boolean => {
      const bufA = Buffer.from(a, 'utf8');
      const bufB = Buffer.from(b, 'utf8');
      if (bufA.length !== bufB.length) {
        return false;
      }
      return crypto.timingSafeEqual(bufA, bufB);
    };

    // 1. Vobiz signature / Generic HMAC-SHA256 validation:
    if (vobizSignature) {
      const hmac = crypto.createHmac('sha256', authToken);
      const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      hmac.update(payload);
      const expected = hmac.digest('hex');
      return safeCompare(String(vobizSignature), expected);
    }

    // 2. Twilio signature:
    if (twilioSignature) {
      try {
        const protocol = req.protocol;
        const host = req.get('host') || '';
        const originalUrl = req.originalUrl || req.url || '';
        const fullUrl = `${protocol}://${host}${originalUrl}`;

        let paramStr = '';
        if (req.body && typeof req.body === 'object') {
          const sortedKeys = Object.keys(req.body).sort();
          for (const key of sortedKeys) {
            const value = req.body[key];
            const valStr = Array.isArray(value) ? value.join('') : String(value);
            paramStr += key + valStr;
          }
        }
        const dataToSign = fullUrl + paramStr;
        const expectedTwilio = crypto
          .createHmac('sha1', authToken)
          .update(dataToSign)
          .digest('base64');

        if (safeCompare(String(twilioSignature), expectedTwilio)) {
          return true;
        }
      } catch (err) {
        logger.error('WebhookController: Error validating Twilio signature', { error: String(err) });
      }

      // Fallback: Also try standard HMAC-SHA256 of the raw body
      try {
        const hmac = crypto.createHmac('sha256', authToken);
        const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        hmac.update(payload);
        const expected = hmac.digest('hex');
        if (safeCompare(String(twilioSignature), expected)) {
          return true;
        }
      } catch {
        // ignore
      }
    }

    return false;
  }

  static async handleTelephonyWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!WebhookController.validateTelephonySignature(req)) {
        logger.warn('WebhookController: Telephony signature validation failed or mismatched');
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }
      const sid = req.body.CallSid || req.body.providerCallSid || req.body.sid;
      const status = req.body.CallStatus || req.body.status;
      const durationParam = req.body.CallDuration || req.body.duration;

      if (!sid) {
        logger.warn('WebhookController: missing unique identifier sid in payload');
        res.status(200).json({ success: true, message: 'Missing identifier' });
        return;
      }

      logger.info('WebhookController: received telephony webhook callback', { sid, status, durationParam });

      const logEntry = await prisma.call.findUnique({
        where: { providerCallSid: sid }
      });

      if (!logEntry) {
        logger.info('WebhookController: providerCallSid not found, ignoring request to prevent rogue scans', { sid });
        res.status(200).json({ success: true, message: 'Skipped' });
        return;
      }

      const normalizedStatus = String(status).toLowerCase();

      if (normalizedStatus === 'ringing') {
        await prisma.call.update({
          where: { id: logEntry.id, userId: logEntry.userId },
          data: { status: 'ringing' }
        });
        logger.info('WebhookController: transition status to ringing', { callId: logEntry.id });
      } else if (normalizedStatus === 'answered' || normalizedStatus === 'in-progress' || normalizedStatus === 'in_progress') {
        await prisma.call.update({
          where: { id: logEntry.id, userId: logEntry.userId },
          data: {
            status: 'in_progress',
            startTime: logEntry.startTime || new Date()
          }
        });
        logger.info('WebhookController: transition status to in-progress', { callId: logEntry.id });
      } else if (
        normalizedStatus === 'completed' || 
        normalizedStatus === 'failed' || 
        normalizedStatus === 'no-answer' || 
        normalizedStatus === 'busy' ||
        normalizedStatus === 'no_answer'
      ) {
        let duration = logEntry.durationSeconds;
        const endTime = new Date();

        if (durationParam) {
          duration = parseInt(String(durationParam), 10);
        } else if (logEntry.startTime) {
          duration = Math.round((endTime.getTime() - new Date(logEntry.startTime).getTime()) / 1000);
        } else {
          duration = 0;
        }

        await prisma.call.update({
          where: { id: logEntry.id, userId: logEntry.userId },
          data: {
            status: 'completed',
            endTime,
            durationSeconds: duration
          }
        });
        logger.info('WebhookController: transition status to completed', { callId: logEntry.id, durationSeconds: duration });

        // Balance alignment check block
        const userProfile = await prisma.user.findUnique({
          where: { id: logEntry.userId }
        });

        if (userProfile && (!userProfile.geminiApiKey || userProfile.geminiApiKey.trim() === '')) {
          const callStartTime = logEntry.startTime 
            ? new Date(logEntry.startTime).getTime() 
            : (logEntry.createdAt ? new Date(logEntry.createdAt).getTime() : endTime.getTime());
          const elapsedSeconds = (endTime.getTime() - callStartTime) / 1000;
          const elapsedMinutes = elapsedSeconds > 0 ? (elapsedSeconds / 60) : 0;

          if (elapsedMinutes > 0) {
            const decrementVal = parseFloat(elapsedMinutes.toFixed(4));
            await prisma.user.update({
              where: { id: logEntry.userId },
              data: {
                callingBalanceMinutes: {
                  decrement: decrementVal
                }
              }
            });
            logger.info('WebhookController: Deducted minutes from platform balance with high-precision', {
              userId: logEntry.userId,
              elapsedMinutes: decrementVal
            });
          }
        }
      }

      res.status(200).json({ success: true, message: 'Processed successfully' });
    } catch (err) {
      logger.error('WebhookController: Exception during webhook callback processing', { error: String(err) });
      next(err);
    }
  }
}
