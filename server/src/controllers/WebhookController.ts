import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

export class WebhookController {
  static async handleTelephonyWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
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
          const durationMinutes = duration > 0 ? (duration / 60) : 0;
          if (durationMinutes > 0) {
            await prisma.user.update({
              where: { id: logEntry.userId },
              data: {
                callingBalanceMinutes: {
                  decrement: durationMinutes
                }
              }
            });
            logger.info('WebhookController: Deducted minutes from platform balance', {
              userId: logEntry.userId,
              durationMinutes
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
