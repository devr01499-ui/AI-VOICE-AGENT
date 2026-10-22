require('dotenv').config();
const { prisma } = require('../dist/lib/prisma');
const { KnowledgeBaseService } = require('../dist/services/KnowledgeBaseService');

async function main() {
  const kbId = 'e70cb0ef-e8b7-4fcf-a57d-ec53e7002bba';
  const userId = '1d43d2f2-23bb-4acc-be15-545709909372';

  console.log(`Re-indexing KB ${kbId} using RAG v2 structure-aware chunker...`);

  await KnowledgeBaseService.reindexDocument(kbId, userId);

  // Poll until status is ready or failed
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const kb = await prisma.knowledgeBase.findUnique({
      where: { id: kbId },
      select: { status: true, progress: true, errorMessage: true, _count: { select: { kbChunks: true } } }
    });
    console.log(`Status: ${kb.status}, Progress: ${kb.progress}%, Chunks in DB: ${kb._count.kbChunks}`);
    if (kb.status === 'ready' || kb.status === 'failed') {
      break;
    }
  }

  // Print newly generated chunks
  const chunks = await prisma.knowledgeBaseChunk.findMany({
    where: { kbId },
    select: { id: true, content: true, metadata: true },
    orderBy: { createdAt: 'asc' }
  });
  console.log(`\nRe-indexing completed! Total Chunks: ${chunks.length}`);
  chunks.forEach((c, idx) => {
    console.log(`\n--- Chunk ${idx + 1} (${c.content.length} chars) ---`);
    console.log(`Metadata: ${c.metadata}`);
    console.log(c.content.slice(0, 200) + '...');
  });

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Re-index error:', e);
  process.exit(1);
});
