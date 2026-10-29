/**
 * AnalysisWorker.ts — Background Queue Worker for Post-Call Analysis
 *
 * Uses PostgreSQL row-level locks (`FOR UPDATE SKIP LOCKED`) to claim analysis jobs
 * safely across multiple server instances without double-processing.
 *
 * Implements exponential backoff retry schedule:
 * - Attempt 1: +30s
 * - Attempt 2: +2min
 * - Attempt 3: +10min
 * - Attempt 4: +1h
 * - Attempt 5: Terminal failure + alert
 *
 * Stale-lock auto-recovery: Claims jobs with `locked_at < NOW() - INTERVAL '15 minutes'`.
 */

import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { AnalysisService } from '../services/AnalysisService';
import { randomUUID } from 'crypto';

export class AnalysisWorker {
  private static isRunning = false;
  private static intervalTimer: NodeJS.Timeout | null = null;
  private static workerId = `worker-${process.pid}-${randomUUID().slice(0, 8)}`;

  /**
   * Starts the background queue evaluation loop.
   */
  static startBackgroundWorker(intervalMs: number = 5000): void {
    if (this.intervalTimer) return;
    logger.info('AnalysisWorker: Starting post-call analysis queue worker (5s interval)', {
      workerId: this.workerId,
    });

    this.intervalTimer = setInterval(() => {
      this.processNextBatch().catch((err) => {
        logger.error('AnalysisWorker: Uncaught error in processing cycle', { error: err.message });
      });
    }, intervalMs);
  }

  /**
   * Stops the background worker timer.
   */
  static stopBackgroundWorker(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
      logger.info('AnalysisWorker: Stopped post-call analysis queue worker');
    }
  }

  /**
   * Claims and processes up to `concurrency` pending or stale-locked jobs.
   */
  static async processNextBatch(concurrency: number = 5): Promise<number> {
    if (this.isRunning) return 0;
    this.isRunning = true;

    let processedCount = 0;

    try {
      // 1. Atomically claim jobs using FOR UPDATE SKIP LOCKED with 15-minute stale lock recovery (E2)
      const claimedJobs: Array<{ id: string; call_id: string; workspace_id: string; agent_id: string | null; attempts: number; max_attempts: number }> =
        await prisma.$queryRawUnsafe(`
          WITH claimable AS (
            SELECT id
            FROM "analysis_jobs"
            WHERE (
                    (status IN ('pending', 'failed') AND (locked_at IS NULL OR locked_at < NOW() - INTERVAL '15 minutes'))
                 OR (status = 'processing' AND locked_at < NOW() - INTERVAL '15 minutes')
                  )
              AND attempts < max_attempts
              AND next_run_at <= CURRENT_TIMESTAMP
            ORDER BY next_run_at ASC
            LIMIT ${concurrency}
            FOR UPDATE SKIP LOCKED
          )
          UPDATE "analysis_jobs" j
          SET status = 'processing',
              locked_at = CURRENT_TIMESTAMP,
              locked_by = '${this.workerId}',
              attempts = j.attempts + 1,
              updated_at = CURRENT_TIMESTAMP
          FROM claimable
          WHERE j.id = claimable.id
          RETURNING j.id, j.call_id, j.workspace_id, j.agent_id, j.attempts, j.max_attempts;
        `);

      if (!claimedJobs || claimedJobs.length === 0) {
        return 0;
      }

      logger.info(`AnalysisWorker: Claimed ${claimedJobs.length} analysis job(s)`, {
        jobIds: claimedJobs.map(j => j.id),
      });

      // 2. Process each claimed job concurrently
      await Promise.all(
        claimedJobs.map(async (job) => {
          try {
            await AnalysisService.processCall(job.call_id, job.id);

            // Mark job completed
            await prisma.$executeRawUnsafe(
              `UPDATE "analysis_jobs"
               SET status = 'completed',
                   locked_at = NULL,
                   locked_by = NULL,
                   last_error = NULL,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = $1`,
              job.id
            );

            processedCount++;
          } catch (err: any) {
            const nextAttempts = job.attempts;
            const maxAttempts = job.max_attempts || 5;
            const isTerminal = nextAttempts >= maxAttempts;

            // Calculate backoff delay
            let backoffSeconds = 30;
            if (nextAttempts === 2) backoffSeconds = 120; // 2 min
            else if (nextAttempts === 3) backoffSeconds = 600; // 10 min
            else if (nextAttempts >= 4) backoffSeconds = 3600; // 1 hour

            const nextStatus = isTerminal ? 'failed' : 'pending';

            await prisma.$executeRawUnsafe(
              `UPDATE "analysis_jobs"
               SET status = $1,
                   next_run_at = CURRENT_TIMESTAMP + ($2 || ' seconds')::INTERVAL,
                   last_error = $3,
                   last_error_code = $4,
                   locked_at = NULL,
                   locked_by = NULL,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = $5`,
              nextStatus,
              String(backoffSeconds),
              err.message ? err.message.slice(0, 500) : 'Unknown analysis error',
              err.code || 'ANALYSIS_ERROR',
              job.id
            );

            if (isTerminal) {
              logger.error('AnalysisWorker: Job reached maximum retry attempts, marked terminal failed', {
                jobId: job.id,
                callId: job.call_id,
                attempts: nextAttempts,
                error: err.message,
              });

              // C11: Write terminal failed result row so the call is visible in Reports and counts in failedAnalysis
              await prisma.callResult.upsert({
                where: { callId: job.call_id },
                create: {
                  id: randomUUID(),
                  callId: job.call_id,
                  workspaceId: job.workspace_id,
                  agentId: job.agent_id,
                  status: 'failed',
                  resultLabel: 'Analysis Failed',
                  confidence: 0,
                  score: null,
                  summary: err.message || 'Analysis permanently failed after retries',
                  fields: {},
                  evidence: {},
                  model: 'system',
                },
                update: {
                  status: 'failed',
                  resultLabel: 'Analysis Failed',
                  summary: err.message || 'Analysis permanently failed after retries',
                },
              }).catch((e) => logger.warn('AnalysisWorker: Failed to record terminal failed callResult', { error: String(e) }));
            } else {
              logger.warn('AnalysisWorker: Job processing failed, scheduled retry', {
                jobId: job.id,
                callId: job.call_id,
                attempt: nextAttempts,
                retryInSeconds: backoffSeconds,
                error: err.message,
              });
            }
          }
        })
      );
    } catch (err: any) {
      logger.error('AnalysisWorker: Error during batch claim query', { error: err.message });
    } finally {
      this.isRunning = false;
    }

    return processedCount;
  }
}
