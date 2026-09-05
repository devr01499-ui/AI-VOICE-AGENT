import { prisma } from '../lib/prisma';
import { CallService } from './CallService';
import { logger } from '../utils/logger';

export class BatchService {
  /**
   * Processes a batch of calls strictly one-at-a-time per user.
   * Ensures previous call completes before initiating the next.
   */
  static async processBatchOneAtATime(batchId: string, userId: string) {
    const batch = await prisma.batch.findFirst({
      where: { id: batchId, userId }
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    const maxAttempts = 3;

    logger.info(`BatchService: Starting batch ${batchId} for user ${userId}. Processing one-at-a-time.`);

    while (true) {
      // Check mid-batch pause or cancel status
      const currentBatch = await prisma.batch.findUnique({
        where: { id: batchId },
        select: { status: true }
      });

      if (!currentBatch || currentBatch.status === 'cancelled' || currentBatch.status === 'paused') {
        logger.info(`BatchService: Batch ${batchId} stopped due to status change: ${currentBatch?.status}`);
        return;
      }

      // Fetch next pending or eligible retry recipient
      const recipient = await prisma.batchRecipient.findFirst({
        where: {
          batchId,
          OR: [
            { status: 'pending' },
            { status: 'failed', attempts: { lt: maxAttempts } }
          ]
        },
        orderBy: { id: 'asc' }
      });

      if (!recipient) {
        break; // All recipients processed
      }

      try {
        const attemptCount = recipient.attempts + 1;
        await prisma.batchRecipient.update({
          where: { id: recipient.id },
          data: { status: 'in_progress', attempts: attemptCount, lastAttemptAt: new Date() }
        });

        const callResult = await CallService.createCall({
          phoneNumber: recipient.phoneNumber,
          agentId: batch.agentId,
          userId: batch.userId,
          userData: typeof recipient.userData === 'string' ? JSON.parse(recipient.userData) : recipient.userData
        });

        await prisma.batchRecipient.update({
          where: { id: recipient.id },
          data: { callId: callResult.callId }
        });

        logger.info(`BatchService: Placed call for recipient ${recipient.id}, waiting for call completion`, { callId: callResult.callId });

        // Wait for call resolution (terminal status or 5-min timeout)
        const terminalStatuses = ['completed', 'failed', 'busy', 'no_answer', 'cancelled'];
        const pollInterval = 2000;
        const maxWaitMs = 5 * 60 * 1000;
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitMs) {
          const callRecord = await prisma.call.findUnique({
            where: { id: callResult.callId },
            select: { status: true }
          });

          if (callRecord && terminalStatuses.includes(callRecord.status)) {
            const finalRecipientStatus = callRecord.status === 'completed' ? 'completed' : 'failed';
            await prisma.batchRecipient.update({
              where: { id: recipient.id },
              data: { status: finalRecipientStatus }
            });
            logger.info(`BatchService: Call ${callResult.callId} finished with status ${callRecord.status}`);
            break;
          }

          await new Promise(res => setTimeout(res, pollInterval));
        }

      } catch (err) {
        logger.error(`BatchService: Failed placement for recipient ${recipient.id}`, { error: String(err) });
        await prisma.batchRecipient.update({
          where: { id: recipient.id },
          data: { status: 'failed' }
        });
      }

      // Update aggregate counts on the Batch record in real-time
      const completedCount = await prisma.batchRecipient.count({ where: { batchId, status: 'completed' } });
      const failedCount = await prisma.batchRecipient.count({ where: { batchId, status: 'failed' } });

      await prisma.batch.update({
        where: { id: batchId },
        data: {
          completedCount,
          failedCount,
        }
      });

      // Brief grace delay before starting next call
      await new Promise(res => setTimeout(res, 1000));
    }

    const finalCompleted = await prisma.batchRecipient.count({ where: { batchId, status: 'completed' } });
    const finalFailed = await prisma.batchRecipient.count({ where: { batchId, status: 'failed' } });

    await prisma.batch.update({
      where: { id: batchId },
      data: {
        completedCount: finalCompleted,
        failedCount: finalFailed,
        status: 'completed',
        completedAt: new Date()
      }
    });

    logger.info(`BatchService: Finished batch ${batchId}`);
  }
}

