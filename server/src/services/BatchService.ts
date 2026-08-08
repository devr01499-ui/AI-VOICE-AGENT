import { prisma } from '../lib/prisma';
import { CallService } from './CallService';
import { logger } from '../utils/logger';

export class BatchService {
  /**
   * Processes a batch of calls strictly one-at-a-time per user.
   * This ensures we do not exceed real total concurrency needs regardless
   * of Vobiz account limits, as requested by Phase 3 architecture.
   */
  static async processBatchOneAtATime(batchId: string, userId: string) {
    const batch = await prisma.batch.findUnique({
      where: { id: batchId, userId }
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    const recipients = await prisma.batchRecipient.findMany({
      where: { batchId, status: 'pending' },
    });

    logger.info(`BatchService: Starting batch ${batchId} for user ${userId} with ${recipients.length} recipients. Processing one-at-a-time.`);

    for (const recipient of recipients) {
      try {
        // Mark recipient as in_progress
        await prisma.batchRecipient.update({
          where: { id: recipient.id },
          data: { status: 'in_progress', attempts: { increment: 1 }, lastAttemptAt: new Date() }
        });

        // The CallService enforces the user concurrency limit (Starter: 1, Growth: 5, Scale: 15+)
        // By awaiting here sequentially, we inherently guarantee one-at-a-time processing for this loop.
        const callResult = await CallService.createCall({
          phoneNumber: recipient.phoneNumber,
          agentId: batch.agentId,
          userId: batch.userId,
          userData: typeof recipient.userData === 'string' ? JSON.parse(recipient.userData) : recipient.userData
        });

        await prisma.batchRecipient.update({
          where: { id: recipient.id },
          data: { status: 'completed', callId: callResult.callId }
        });

        logger.info(`BatchService: Completed batch item ${recipient.id}`);
      } catch (err) {
        logger.error(`BatchService: Failed batch item ${recipient.id}`, { error: String(err) });
        
        await prisma.batchRecipient.update({
          where: { id: recipient.id },
          data: { status: 'failed' }
        });
      }

      // Wait a short delay before next call in batch to be defensive
      await new Promise(res => setTimeout(res, 2000));
    }

    await prisma.batch.update({
      where: { id: batchId },
      data: { status: 'completed', completedAt: new Date() }
    });

    logger.info(`BatchService: Finished batch ${batchId}`);
  }
}
