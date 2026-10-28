import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import crypto from 'crypto';
import { ProviderError } from '../types/errors';
import { CallService } from '../services/CallService';
import { CallRepository } from '../repositories/CallRepository';
import { CallFinalizer } from '../services/CallFinalizer';
import type { CallStatus } from '../types';

export class WebhookController {
  private static validateTelephonySignature(req: Request): boolean {
    const twilioSignature = req.headers['x-twilio-signature'];
    const vobizSignature = req.headers['x-vobiz-signature'];
    const authToken = process.env.TELEPHONY_AUTH_TOKEN;

    if (!authToken) {
      if (process.env.NODE_ENV === 'production') {
        logger.error('WebhookController: TELEPHONY_AUTH_TOKEN is not configured in production. Rejecting webhook (fail closed).');
        return false;
      }
      logger.warn('WebhookController: TELEPHONY_AUTH_TOKEN is not configured in the environment. Permitting bypass in non-production.');
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
        await CallRepository.updateStatus(logEntry.id, 'ringing');
        logger.info('WebhookController: transition status to ringing', { callId: logEntry.id });
      } else if (normalizedStatus === 'answered' || normalizedStatus === 'in-progress' || normalizedStatus === 'in_progress') {
        await CallRepository.updateStatus(logEntry.id, 'in_progress', {
          startTime: logEntry.startTime || new Date(),
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
        const recordingUrl = req.body.RecordingUrl || req.body.recording_url || null;

        if (durationParam) {
          duration = parseInt(String(durationParam), 10);
        } else if (logEntry.startTime) {
          duration = Math.round((endTime.getTime() - new Date(logEntry.startTime).getTime()) / 1000);
        } else {
          duration = 0;
        }

        const terminalStatus: CallStatus = normalizedStatus === 'completed' ? 'completed' : 'failed';
        await CallRepository.updateStatus(logEntry.id, terminalStatus, {
          endTime,
          durationSeconds: duration,
        });

        if (recordingUrl) {
          await CallRepository.update(logEntry.id, { recordingUrl }).catch(() => {});
        }
        logger.info('WebhookController: transition status to terminal', { callId: logEntry.id, status: terminalStatus, durationSeconds: duration });

        if (normalizedStatus === 'completed') {
          CallService.generatePostCallIntelligence(logEntry.id).catch(err => {
            logger.error('Failed to generate call intelligence', { error: err.message, callId: logEntry.id });
          });
        }

        // Idempotently enqueue analysis job in analysis_jobs
        CallFinalizer.onCallFinalized(logEntry.id).catch(err => {
          logger.error('WebhookController: Failed to enqueue CallFinalizer analysis job', { error: err.message, callId: logEntry.id });
        });


        // Idempotent balance deduction via CallService -> MinutesService.
        // Replaces legacy direct User.callingBalanceMinutes decrement that caused
        // double-deduction when running in parallel with CallOrchestrator.
        if (duration > 0) {
          CallService.deductCallMinutes(logEntry.id, duration).catch((deductErr: any) => {
            logger.error('WebhookController: Failed during post-call deduction', {
              callId: logEntry.id,
              error: String(deductErr),
            });
          });
        }
      }

      res.status(200).json({ success: true, message: 'Processed successfully' });
    } catch (err) {
      logger.error('WebhookController: Exception during webhook callback processing', { error: String(err) });
      next(err);
    }
  }
}
