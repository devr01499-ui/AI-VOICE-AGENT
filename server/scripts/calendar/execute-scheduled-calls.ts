import { prisma } from '../../src/lib/prisma';
import { CallService } from '../../src/services/CallService';
import { checkAvailability } from '../../src/lib/calendar/availability';
import { getNextRetryTime } from '../../src/lib/calendar/retryPolicy';

async function executeCalls() {
  console.log('--- Executing Scheduled Calls ---');

  const pendingCalls = await prisma.scheduledCall.findMany({
    where: {
      status: 'scheduled',
      scheduledAtUtc: {
        lte: new Date(), // due now or in the past
      },
    },
  });

  console.log(`Found ${pendingCalls.length} pending calls.`);

  for (const call of pendingCalls) {
    try {
      // Re-validate against current rules
      const availability = await checkAvailability(call.agentId, call.scheduledAtUtc, call.timezone, call.maxAttempts);
      if (!availability.isAvailable) {
        console.warn(`Call ${call.id} no longer valid to place: ${availability.reason}`);
        // We shouldn't fail it immediately; if it's out of calling window, maybe we push it to tomorrow?
        // For simplicity, let's reschedule it to the next day at 9 AM, or just fail it.
        // Let's fail it and let manual intervention handle it.
        await prisma.scheduledCall.update({
          where: { id: call.id },
          data: { status: 'failed', notes: `Availability check failed at execution time: ${availability.reason}` },
        });
        if (call.batchId) {
            await prisma.batchCampaign.update({
                where: { id: call.batchId },
                data: { failedCount: { increment: 1 } },
            });
        }
        continue;
      }

      console.log(`Initiating call ${call.id} to ${call.phoneNumber}`);
      
      // Update status to in_progress
      await prisma.scheduledCall.update({
        where: { id: call.id },
        data: { 
            status: 'in_progress', 
            attemptCount: call.attemptCount + 1,
            lastAttemptAt: new Date()
        },
      });

      // Place the actual call via the existing engine
      const agent = await prisma.agent.findUnique({ where: { id: call.agentId }});
      if (!agent) throw new Error('Agent not found');

      await CallService.createCall({
        phoneNumber: call.phoneNumber,
        agentId: call.agentId,
        userId: agent.userId,
      });

      // Update to completed
      await prisma.scheduledCall.update({
        where: { id: call.id },
        data: { status: 'completed' },
      });

      if (call.batchId) {
        await prisma.batchCampaign.update({
            where: { id: call.batchId },
            data: { completedCount: { increment: 1 } },
        });
      }

    } catch (err: any) {
      console.error(`Failed to execute call ${call.id}: ${err.message}`);
      
      // Retry policy
      const nextRetry = getNextRetryTime(call.attemptCount + 1);
      
      if (nextRetry && (call.attemptCount + 1) < call.maxAttempts) {
        await prisma.scheduledCall.update({
          where: { id: call.id },
          data: { 
            status: 'scheduled', 
            scheduledAtUtc: nextRetry,
            notes: `Retrying at ${nextRetry.toISOString()} due to failure: ${err.message}` 
          },
        });
      } else {
        await prisma.scheduledCall.update({
          where: { id: call.id },
          data: { status: 'failed', notes: `Failed completely after ${call.attemptCount + 1} attempts. Error: ${err.message}` },
        });

        if (call.batchId) {
            await prisma.batchCampaign.update({
                where: { id: call.batchId },
                data: { failedCount: { increment: 1 } },
            });
        }
      }
    }
  }

  console.log('--- Done Executing ---');
}

executeCalls().catch(console.error);
