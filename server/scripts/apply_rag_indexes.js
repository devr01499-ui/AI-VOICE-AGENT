require('dotenv').config();
const { prisma } = require('../dist/lib/prisma');

async function main() {
  console.log('=== Applying RAG v2 PostgreSQL Extensions & Indexes ===');
  try {
    // 1. Enable pg_trgm if permitted
    try {
      await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
      console.log('✓ Extension pg_trgm enabled');
    } catch (e) {
      console.warn('Note on pg_trgm:', e.message);
    }

    // 2. Add status, progress, error_message to knowledge_bases table if not present
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "knowledge_bases" 
      ADD COLUMN IF NOT EXISTS "status" VARCHAR(32) NOT NULL DEFAULT 'ready',
      ADD COLUMN IF NOT EXISTS "progress" INTEGER NOT NULL DEFAULT 100,
      ADD COLUMN IF NOT EXISTS "error_message" TEXT;
    `);
    console.log('✓ Added status/progress columns to knowledge_bases');

    // 3. Add HNSW halfvec index on kb_chunks.embedding
    console.log('Building HNSW index on kb_chunks ((embedding::halfvec(3072)) halfvec_cosine_ops)...');
    const t0 = Date.now();
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "kb_chunks_embedding_halfvec_hnsw_idx"
      ON "kb_chunks"
      USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);
    `);
    console.log(`✓ HNSW halfvec index created in ${Date.now() - t0}ms`);

    // 4. Add Full-Text Search GIN index on kb_chunks.content
    console.log('Building Full-Text Search GIN index on to_tsvector(content)...');
    const t1 = Date.now();
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "kb_chunks_content_fts_idx"
      ON "kb_chunks"
      USING gin (to_tsvector('english', content));
    `);
    console.log(`✓ GIN FTS index created in ${Date.now() - t1}ms`);

    // 5. Verify EXPLAIN query plan now uses the index
    console.log('\n--- Verifying Query Plan with HNSW halfvec Index ---');
    const explainPlan = await prisma.$queryRawUnsafe(`
      EXPLAIN
      SELECT id, (embedding::halfvec(3072) <=> (SELECT embedding::halfvec(3072) FROM kb_chunks LIMIT 1)) as distance
      FROM kb_chunks
      ORDER BY distance ASC
      LIMIT 5;
    `);
    console.log('EXPLAIN PLAN:', JSON.stringify(explainPlan, null, 2));

    // 6. Verify Full-Text query works
    console.log('\n--- Verifying Full-Text Lexical Query ---');
    const ftsResult = await prisma.$queryRawUnsafe(`
      SELECT id, content, ts_rank_cd(to_tsvector('english', content), websearch_to_tsquery('english', 'sales engine UAE')) as rank
      FROM kb_chunks
      WHERE to_tsvector('english', content) @@ websearch_to_tsquery('english', 'sales engine UAE')
      ORDER BY rank DESC
      LIMIT 2;
    `);
    console.log('FTS Sample Match:', ftsResult.length, 'results found');

    console.log('\n=== RAG v2 Database Foundations Applied Successfully! ===');
  } catch (err) {
    console.error('Error applying RAG indexes:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
