import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { chunkDocument, StructuredChunk } from '../utils/documentChunker';
import { getEmbeddingsBatch } from '../utils/embedding';
import { v4 as uuidv4 } from 'uuid';

export class KnowledgeBaseService {
  /**
   * Asynchronously processes document chunking and batch embeddings in the background.
   * Updates progress and status in the DB, and executes atomic rollback on failure.
   */
  static async ingestDocumentAsync(
    kbId: string,
    contentText: string,
    docName: string,
    userId: string
  ): Promise<void> {
    logger.info('KnowledgeBaseService: Starting async ingestion', { kbId, docName, sizeChars: contentText.length });

    try {
      // 1. Mark status as processing
      await prisma.knowledgeBase.update({
        where: { id: kbId },
        data: {
          status: 'processing',
          progress: 5,
          errorMessage: null,
        },
      });

      // 2. Perform structure-aware chunking
      const chunks: StructuredChunk[] = chunkDocument(contentText, {
        docName,
        targetTokens: 400,
        minTokens: 150,
        maxTokens: 600,
        overlapTokens: 40,
      });

      if (chunks.length === 0) {
        throw new Error('Document contained no indexable text after structure-aware parsing');
      }

      await prisma.knowledgeBase.update({
        where: { id: kbId },
        data: { progress: 15 },
      });

      // 3. Batch generate embeddings with concurrency throttle and progress tracking
      const batchItems = chunks.map(c => ({
        text: c.content,
        title: `${docName} - ${c.metadata.section}`,
      }));

      const embeddings = await getEmbeddingsBatch(
        batchItems,
        'RETRIEVAL_DOCUMENT',
        5, // concurrency limit
        async (completed, total) => {
          const pct = 15 + Math.round((completed / total) * 75); // 15% -> 90%
          await prisma.knowledgeBase.update({
            where: { id: kbId },
            data: { progress: pct },
          }).catch(() => {});
        }
      );

      // 4. Atomically insert chunks into database in a transaction
      await prisma.$transaction(async (tx) => {
        // Clean any existing chunks for this kbId (ensures atomic overwrite / clean state)
        await tx.$executeRawUnsafe(`DELETE FROM "kb_chunks" WHERE "kb_id" = $1`, kbId);

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const embedding = embeddings[i];
          const chunkId = uuidv4();

          await tx.$executeRawUnsafe(
            `INSERT INTO "kb_chunks" ("id", "kb_id", "content", "embedding", "metadata", "created_at")
             VALUES ($1, $2, $3, cast($4 as vector), $5, NOW())`,
            chunkId,
            kbId,
            chunk.content,
            `[${embedding.join(',')}]`,
            JSON.stringify(chunk.metadata)
          );
        }
      });

      // 5. Finalize status as ready
      await prisma.knowledgeBase.update({
        where: { id: kbId },
        data: {
          status: 'ready',
          progress: 100,
          errorMessage: null,
        },
      });

      logger.info('KnowledgeBaseService: Ingestion complete', {
        kbId,
        docName,
        totalChunks: chunks.length,
      });
    } catch (err: any) {
      logger.error('KnowledgeBaseService: Ingestion failed, executing atomic cleanup', {
        kbId,
        error: err.message,
      });

      // Atomic cleanup: remove partial chunks so no corrupt KB remains
      try {
        await prisma.$executeRawUnsafe(`DELETE FROM "kb_chunks" WHERE "kb_id" = $1`, kbId);
      } catch (cleanErr) {
        logger.error('KnowledgeBaseService: Error during rollback cleanup', { cleanErr });
      }

      await prisma.knowledgeBase.update({
        where: { id: kbId },
        data: {
          status: 'failed',
          progress: 0,
          errorMessage: err.message || 'Unknown ingestion error',
        },
      }).catch(() => {});
    }
  }

  /**
   * Re-indexes an existing document using structure-aware chunking and batch embeddings.
   */
  static async reindexDocument(kbId: string, userId: string): Promise<void> {
    const kb = await prisma.knowledgeBase.findFirst({
      where: { id: kbId, userId },
    });
    if (!kb) {
      throw new Error('Document not found in your workspace');
    }
    // Launch async ingestion
    this.ingestDocumentAsync(kb.id, kb.contentText, kb.name, userId);
  }
}
