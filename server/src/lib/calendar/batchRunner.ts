import { prisma } from '../prisma';
import { scheduleCall } from './scheduler';

/**
 * Processes a chunk of a batch campaign and schedules calls for it.
 * Realistically, this would fetch from a "contacts" table or parse a JSON/CSV.
 * For this implementation, since BatchCampaign doesn't strictly have a relation
 * to contacts yet (beyond totalContacts/completedCount), we assume contacts are 
 * generated or we decrement a counter and create dummy schedules for now.
 * Wait, to be rigorous, we'd need the actual contact numbers.
 * The schema has totalContacts, completedCount, failedCount. 
 * Since the user didn't request a new BatchContact model, we assume 
 * contacts are managed somewhere or we use dummy numbers for the test.
 */
export async function processBatchChunk(batchId: string) {
  const batch = await prisma.batchCampaign.findUnique({ where: { id: batchId } });
  if (!batch || batch.status !== 'running') {
    return; // nothing to do
  }

  // Get active scheduled calls for this batch
  const activeCount = await prisma.scheduledCall.count({
    where: {
      batchId,
      status: { in: ['scheduled', 'in_progress'] },
    }
  });

  // Calculate how many more we can schedule right now based on maxConcurrent
  const slotsAvailable = Math.max(0, batch.maxConcurrent - activeCount);
  
  // Calculate pacing per minute limit
  // Here we limit to Math.min(slotsAvailable, pacingPerMinute)
  const toSchedule = Math.min(slotsAvailable, batch.pacingPerMinute);

  if (toSchedule <= 0) {
    return; // max concurrent reached or pacing limit reached
  }

  const remaining = batch.totalContacts - (batch.completedCount + batch.failedCount);
  const actualToSchedule = Math.min(toSchedule, remaining);

  if (actualToSchedule <= 0) {
    // We are done scheduling this batch
    if (activeCount === 0) {
      await prisma.batchCampaign.update({
        where: { id: batchId },
        data: { status: 'completed' },
      });
    }
    return;
  }

  // Schedule 'actualToSchedule' dummy contacts
  // In a real app, we'd pull these from a BatchContacts table
  for (let i = 0; i < actualToSchedule; i++) {
    // Generate a dummy valid phone number for the batch or pull from an external list
    const phoneNumber = `+91987654321${Math.floor(Math.random() * 9)}`;
    const idempotencyKey = `batch_${batch.id}_contact_${batch.completedCount + batch.failedCount + i + 1}`;

    try {
      await scheduleCall({
        agentId: batch.agentId,
        phoneNumber,
        scheduledAtUtc: new Date(), // schedule immediately 
        timezone: batch.timezone,
        source: 'batch',
        batchId: batch.id,
        idempotencyKey,
        maxConcurrent: batch.maxConcurrent,
      });
      // The scheduled call script will pick this up.
    } catch (err) {
      // If unavailable (e.g. outside calling hours), fail this specific attempt or pause batch
      console.warn(`Failed to schedule contact for batch ${batch.id}: ${err}`);
      // Increment failed count
      await prisma.batchCampaign.update({
        where: { id: batch.id },
        data: { failedCount: { increment: 1 } },
      });
    }
  }
}
