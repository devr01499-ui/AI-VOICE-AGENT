import { prisma } from '../../src/lib/prisma';
import { processBatchChunk } from '../../src/lib/calendar/batchRunner';

async function processBatches() {
  console.log('--- Processing Batch Campaigns ---');

  const activeBatches = await prisma.batchCampaign.findMany({
    where: {
      status: 'running',
    },
  });

  console.log(`Found ${activeBatches.length} active batch campaigns.`);

  for (const batch of activeBatches) {
    try {
      console.log(`Processing chunk for batch ${batch.id}`);
      await processBatchChunk(batch.id);
    } catch (err: any) {
      console.error(`Failed to process chunk for batch ${batch.id}: ${err.message}`);
    }
  }

  console.log('--- Done Processing ---');
}

processBatches().catch(console.error);
