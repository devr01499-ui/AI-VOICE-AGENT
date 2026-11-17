import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { chunkDocument, StructuredChunk } from '../utils/documentChunker';
import { getEmbeddingsBatch, EmbeddingUnavailableError } from '../utils/embedding';
import { getKbPlanLimits } from '../config/plans';
import { v4 as uuidv4 } from 'uuid';

/**
 * Indexing queue. Documents are indexed in the background, but never all at once: at most
 * GLOBAL_CONCURRENCY documents run on this server, and at most one per workspace, so one
 * customer uploading many files cannot starve everyone else or flood the embedding API.
 * Waiting documents show as "queued". The queue holds only ids (the text is read from the
 * database when a job starts), and documents left "queued"/"processing" by a restart are
 * picked up again by resumePendingIngestions().
 */
export const GLOBAL_CONCURRENCY = 2;
const EMBEDDING_CONCURRENCY_PER_JOB = 4;
const INSERT_BATCH_SIZE = 50;

/** User-facing reasons only; internal errors are logged, not shown. */
export class IngestionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IngestionError';
  }
}

type Job = { kbId: string; userId: string };

const waiting: Job[] = [];
const runningWorkspaces = new Set<string>();
const runningDocs = new Set<string>();
let idleWaiters: Array<() => void> = [];

function pump(): void {
  while (runningDocs.size < GLOBAL_CONCURRENCY) {
    const idx = waiting.findIndex((j) => !runningWorkspaces.has(j.userId));
    if (idx < 0) break;
    const [job] = waiting.splice(idx, 1);
    runningWorkspaces.add(job.userId);
    runningDocs.add(job.kbId);
    KnowledgeBaseService.ingestDocument(job.kbId, job.userId)
      .catch((err) => logger.error('KnowledgeBaseService: job crashed', { kbId: job.kbId, error: err?.message }))
      .finally(() => {
        runningWorkspaces.delete(job.userId);
        runningDocs.delete(job.kbId);
        pump();
      });
  }
  if (runningDocs.size === 0 && waiting.length === 0) {
    const waiters = idleWaiters;
    idleWaiters = [];
    waiters.forEach((w) => w());
  }
}

export class KnowledgeBaseService {
  /** Adds a document to the indexing queue (idempotent while it is waiting or running). */
  static async enqueueIngestion(kbId: string, userId: string): Promise<void> {
    if (runningDocs.has(kbId) || waiting.some((j) => j.kbId === kbId)) return;
    await prisma.knowledgeBase.updateMany({
      where: { id: kbId, userId },
      data: { status: 'queued', progress: 0, errorMessage: null },
    });
    waiting.push({ kbId, userId });
    pump();
  }

  /** Queue state, for health checks and tests. */
  static queueStats() {
    return { running: runningDocs.size, waiting: waiting.length, globalConcurrency: GLOBAL_CONCURRENCY };
  }

  /** Resolves when nothing is waiting or running (tests). */
  static whenIdle(): Promise<void> {
    if (runningDocs.size === 0 && waiting.length === 0) return Promise.resolve();
    return new Promise((resolve) => idleWaiters.push(resolve));
  }

  /** Re-queues documents a restart left behind. Safe to call more than once. */
  static async resumePendingIngestions(): Promise<number> {
    const pending = await prisma.knowledgeBase.findMany({
      where: { status: { in: ['queued', 'processing'] } },
      select: { id: true, userId: true },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });
    for (const doc of pending) await this.enqueueIngestion(doc.id, doc.userId);
    if (pending.length > 0) logger.info('KnowledgeBaseService: resumed pending indexing jobs', { count: pending.length });
    return pending.length;
  }

  /**
   * Indexes one document: chunk → embed → replace its chunks in one transaction → ready.
   * On any failure its chunks are removed and the document is marked failed with a clear reason.
   */
  static async ingestDocument(kbId: string, userId: string): Promise<void> {
    const kb = await prisma.knowledgeBase.findFirst({
      where: { id: kbId, userId },
      select: { id: true, name: true, contentText: true },
    });
    if (!kb) return; // deleted while waiting

    logger.info('KnowledgeBaseService: indexing started', { kbId, sizeChars: kb.contentText.length });
    let lastPct = -1;
    const setProgress = async (pct: number) => {
      if (pct - lastPct < 10 && pct < 100) return; // throttle DB writes
      lastPct = pct;
      await prisma.knowledgeBase.updateMany({ where: { id: kbId, userId }, data: { progress: pct } }).catch(() => {});
    };

    try {
      await prisma.knowledgeBase.updateMany({
        where: { id: kbId, userId },
        data: { status: 'processing', progress: 5, errorMessage: null },
      });

      const chunks: StructuredChunk[] = chunkDocument(kb.contentText, {
        docName: kb.name,
        targetTokens: 400,
        minTokens: 150,
        maxTokens: 600,
        overlapTokens: 40,
      });
      if (chunks.length === 0) {
        throw new IngestionError('This document has no text that can be indexed.');
      }

      // Plan limit on total chunks per workspace (checked before paying for embeddings).
      const owner = await prisma.user.findUnique({ where: { id: userId }, select: { accountType: true } });
      const limits = getKbPlanLimits(owner?.accountType);
      const existing: Array<{ n: bigint | number }> = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::bigint AS n FROM "kb_chunks" c JOIN "knowledge_bases" kb ON c."kb_id" = kb."id"
         WHERE kb."user_id" = $1 AND c."kb_id" <> $2`,
        userId,
        kbId
      );
      const used = Number(existing[0]?.n || 0);
      if (used + chunks.length > limits.maxChunksPerWorkspace) {
        throw new IngestionError(
          `This document needs ${chunks.length} sections but your plan allows ${limits.maxChunksPerWorkspace} in total (${used} used). Remove documents or upgrade your plan.`
        );
      }
      await setProgress(15);

      const embeddings = await getEmbeddingsBatch(
        chunks.map((c) => ({ text: c.content, title: `${kb.name} - ${c.metadata.section}` })),
        'RETRIEVAL_DOCUMENT',
        EMBEDDING_CONCURRENCY_PER_JOB,
        (completed, total) => { void setProgress(15 + Math.round((completed / total) * 75)); }
      );

      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`DELETE FROM "kb_chunks" WHERE "kb_id" = $1`, kbId);
        for (let start = 0; start < chunks.length; start += INSERT_BATCH_SIZE) {
          const slice = chunks.slice(start, start + INSERT_BATCH_SIZE);
          const values: string[] = [];
          const params: unknown[] = [];
          slice.forEach((chunk, i) => {
            const p = i * 5;
            values.push(`($${p + 1}, $${p + 2}, $${p + 3}, cast($${p + 4} as vector), $${p + 5}, NOW())`);
            params.push(uuidv4(), kbId, chunk.content, `[${embeddings[start + i].join(',')}]`, JSON.stringify(chunk.metadata));
          });
          await tx.$executeRawUnsafe(
            `INSERT INTO "kb_chunks" ("id", "kb_id", "content", "embedding", "metadata", "created_at") VALUES ${values.join(', ')}`,
            ...params
          );
        }
      }, { timeout: 60_000 });

      await prisma.knowledgeBase.updateMany({
        where: { id: kbId, userId },
        data: { status: 'ready', progress: 100, errorMessage: null },
      });
      logger.info('KnowledgeBaseService: indexing complete', { kbId, totalChunks: chunks.length });
    } catch (err: any) {
      logger.error('KnowledgeBaseService: indexing failed, removing partial chunks', { kbId, error: err?.message });
      try {
        await prisma.$executeRawUnsafe(`DELETE FROM "kb_chunks" WHERE "kb_id" = $1`, kbId);
      } catch (cleanErr: any) {
        logger.error('KnowledgeBaseService: cleanup after failure failed', { kbId, error: cleanErr?.message });
      }
      const reason = err instanceof IngestionError || err instanceof EmbeddingUnavailableError
        ? err.message
        : 'Indexing failed. Please try "Re-index" again in a few minutes.';
      await prisma.knowledgeBase.updateMany({
        where: { id: kbId, userId },
        data: { status: 'failed', progress: 0, errorMessage: reason },
      }).catch(() => {});
    }
  }

  /** Re-indexes an existing document through the queue. */
  static async reindexDocument(kbId: string, userId: string): Promise<void> {
    const kb = await prisma.knowledgeBase.findFirst({ where: { id: kbId, userId }, select: { id: true } });
    if (!kb) {
      throw new IngestionError('Document not found in your workspace');
    }
    await this.enqueueIngestion(kb.id, userId);
  }
}
