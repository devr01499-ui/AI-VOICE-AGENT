/**
 * CallFinalizer.ts — Centralized Idempotent Finalization Hook
 *
 * Ensures every terminated call session (regardless of carrier: Vobiz, Plivo, WebRTC,
 * or termination trigger: caller hangup, agent hangup, timeout, balance depletion)
 * reliably schedules a single analysis job in `analysis_jobs` and initializes a
 * corresponding pending entry in `call_results` so the call is immediately visible.
 */

import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { randomUUID } from 'crypto';

export class CallFinalizer {
  /**
   * Idempotently enqueues a post-call analysis job and ensures report visibility.
   * Safe to call multiple times for the same callId from concurrent hangup events.
   */
  static async onCallFinalized(callId: string, metadata?: Record<string, any>): Promise<void> {
    if (!callId) return;

    try {
      const call = await prisma.call.findUnique({
        where: { id: callId },
        select: {
          id: true,
          userId: true,
          agentId: true,
          batchId: true,
          status: true,
        },
      });

      if (!call) {
        logger.warn('CallFinalizer: Call record not found for finalized session', { callId });
        return;
      }

      const jobId = randomUUID();
      const workspaceId = call.userId;
      const agentId = call.agentId || null;

      // 1. PostgreSQL atomic UPSERT / ON CONFLICT DO NOTHING into analysis_jobs
      await prisma.$executeRawUnsafe(
        `INSERT INTO "analysis_jobs" (
          "id", "call_id", "workspace_id", "agent_id", "status", "attempts", "max_attempts", "next_run_at", "created_at", "updated_at"
        ) VALUES (
          $1, $2, $3, $4, 'pending', 0, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) ON CONFLICT ("call_id") DO NOTHING`,
        jobId,
        call.id,
        workspaceId,
        agentId
      );

      // 2. Initialize pending callResult row so call is immediately visible in Reports
      await prisma.callResult.upsert({
        where: { callId: call.id },
        create: {
          id: randomUUID(),
          callId: call.id,
          workspaceId: call.userId,
          agentId: call.agentId || null,
          batchId: call.batchId || null,
          status: 'pending',
          resultLabel: 'Pending Analysis',
          confidence: 0,
          score: null,
          fields: {},
          evidence: {},
          model: 'system',
        },
        update: {},
      }).catch((e) => logger.warn('CallFinalizer: Failed to create pending callResult', { error: String(e) }));

      logger.info('CallFinalizer: Scheduled analysis job', {
        callId: call.id,
        workspaceId,
        agentId,
        callStatus: call.status,
      });
    } catch (err: any) {
      logger.error('CallFinalizer: Failed to enqueue analysis job', {
        callId,
        error: err.message,
      });
    }
  }
}
