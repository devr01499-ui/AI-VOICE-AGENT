/**
 * DataRetentionJob.ts — Scheduled Purge Service for Workspace Data Retention
 * 
 * Background worker that scans workspace users with configured dataRetentionDays
 * and purges call logs, transcript segments, and call events older than the threshold.
 * Every purge action is logged to the AuditLog system.
 */

import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { logAuditEvent } from '../utils/auditLogger';
import { deleteCarrierRecording } from './RecordingService';

/** Recordings are kept at most this many days (RECORDING_RETENTION_DAYS, default 90), even without a workspace setting. */
export function recordingRetentionDays(): number {
  const n = Number.parseInt(process.env.RECORDING_RETENTION_DAYS || '', 10);
  return Number.isFinite(n) && n >= 1 ? n : 90;
}

export class DataRetentionJob {
  private static isRunning = false;
  private static intervalTimer: NodeJS.Timeout | null = null;

  /**
   * Starts the background worker for data retention.
   * Defaults to running once per hour (3,600,000 ms).
   */
  static startBackgroundWorker(intervalMs: number = 3600000): void {
    if (this.intervalTimer) return;
    logger.info('DataRetentionJob: Starting background data retention worker (1-hour interval)');
    this.intervalTimer = setInterval(() => {
      this.purgeAllExpiredData().catch((err) => {
        logger.error('DataRetentionJob: Error running scheduled data retention purge', { error: err.message });
      });
    }, intervalMs);
  }

  /**
   * Scans all workspaces with a non-null dataRetentionDays setting and purges expired call records.
   */
  static async purgeAllExpiredData(): Promise<{ processedWorkspaces: number; totalPurgedCalls: number }> {
    if (this.isRunning) return { processedWorkspaces: 0, totalPurgedCalls: 0 };
    this.isRunning = true;

    let processedWorkspaces = 0;
    let totalPurgedCalls = 0;

    try {
      const usersWithRetention = await prisma.user.findMany({
        where: {
          dataRetentionDays: {
            not: null,
            gt: 0,
          },
        },
        select: {
          id: true,
          email: true,
          dataRetentionDays: true,
        },
      });

      for (const user of usersWithRetention) {
        if (!user.dataRetentionDays) continue;
        processedWorkspaces++;

        const retentionDays = user.dataRetentionDays;
        const cutoffDate = new Date(Date.now() - retentionDays * 86400 * 1000);
        // This workspace's own count (audit #72: its log and audit entry carried the running total).
        let workspacePurged = 0;

        // Find calls created before cutoff date (Call model)
        const expiredCalls = await prisma.call.findMany({
          where: {
            userId: user.id,
            createdAt: { lt: cutoffDate },
          },
          select: { id: true, recordingUrl: true },
        });

        // A call whose recording cannot be deleted at the carrier is kept (and retried next run),
        // so no recording is left behind without a record of it.
        const deletable: typeof expiredCalls = [];
        for (const c of expiredCalls) {
          if (!c.recordingUrl || !/^https:/.test(c.recordingUrl)) { deletable.push(c); continue; }
          if (await deleteCarrierRecording(c.recordingUrl)) deletable.push(c);
          else logger.error('[ADMIN_ALERT][DPDP] carrier recording could not be deleted; call kept for retry', { callId: c.id, userId: user.id });
        }

        if (deletable.length > 0) {
          const callIds = deletable.map((c) => c.id);

          await prisma.transcriptSegment.deleteMany({
            where: { callId: { in: callIds } },
          }).catch(() => {});

          await prisma.callEvent.deleteMany({
            where: { callId: { in: callIds } },
          }).catch(() => {});

          await prisma.execution.deleteMany({
            where: { callId: { in: callIds } },
          }).catch(() => {});

          const deleteResult = await prisma.call.deleteMany({
            where: { id: { in: callIds } },
          });
          totalPurgedCalls += deleteResult.count;
          workspacePurged += deleteResult.count;
        }

        // Find call sessions created before cutoff date (CallSession model)
        const expiredSessions = await prisma.callSession.findMany({
          where: {
            userId: user.id,
            createdAt: { lt: cutoffDate },
          },
          select: { id: true },
        });

        if (expiredSessions.length > 0) {
          const sessionIds = expiredSessions.map((s) => s.id);

          const deleteSessionResult = await prisma.callSession.deleteMany({
            where: { id: { in: sessionIds } },
          });
          totalPurgedCalls += deleteSessionResult.count;
          workspacePurged += deleteSessionResult.count;
        }

        if (expiredCalls.length === 0 && expiredSessions.length === 0) continue;

        logger.info('DataRetentionJob: Purged expired call records for workspace', {
          userId: user.id,
          retentionDays,
          cutoffDate: cutoffDate.toISOString(),
          purged: workspacePurged,
        });

        // Record audit log entry for the purge action
        await logAuditEvent({
          workspaceOwnerId: user.id,
          actorUserId: 'system-retention-job',
          action: 'data.retention.purge',
          metadata: {
            retentionDays,
            purgedCallCount: workspacePurged,
            cutoffDate: cutoffDate.toISOString(),
          },
        });
      }
    } catch (error: any) {
      logger.error('DataRetentionJob: Exception in purgeAllExpiredData', { error: error?.message || String(error) });
    } finally {
      this.isRunning = false;
    }

    await this.purgeExpiredRecordings().catch((err) => logger.error('DataRetentionJob: recording purge failed', { error: err?.message }));
    return { processedWorkspaces, totalPurgedCalls };
  }

  /** Deletes recordings older than the recording retention period (carrier first, then our link). */
  static async purgeExpiredRecordings(now = Date.now()): Promise<{ deleted: number; failed: number }> {
    const cutoff = new Date(now - recordingRetentionDays() * 86400 * 1000);
    const calls = await prisma.call.findMany({
      where: { recordingUrl: { not: null }, createdAt: { lt: cutoff } },
      select: { id: true, userId: true, recordingUrl: true },
      take: 200,
    });
    let deleted = 0; let failed = 0;
    for (const c of calls) {
      const isCarrier = !!c.recordingUrl && /^https:/.test(c.recordingUrl);
      if (isCarrier && !(await deleteCarrierRecording(c.recordingUrl!))) {
        failed++;
        logger.error('[ADMIN_ALERT][DPDP] expired recording could not be deleted at the carrier', { callId: c.id, userId: c.userId });
        continue;
      }
      await prisma.call.updateMany({ where: { id: c.id, userId: c.userId }, data: { recordingUrl: null } });
      deleted++;
    }
    if (deleted || failed) logger.info('DataRetentionJob: recording retention run', { deleted, failed, retentionDays: recordingRetentionDays() });
    return { deleted, failed };
  }
}
