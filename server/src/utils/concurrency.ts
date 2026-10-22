import { prisma } from '../lib/prisma';
import { callOrchestrator } from '../core/orchestrator/CallOrchestrator';
import { logger } from './logger';

/**
 * Universal Concurrency Source of Truth for Claritiy Voice
 * Replaces divergent definitions across BatchService and CallService.
 */

export const GLOBAL_TELEPHONY_CAP = parseInt(process.env.GLOBAL_MAX_CONCURRENT_CALLS || '50', 10);
export const MAX_ACTIVE_CALL_AGE_MS = 60 * 60 * 1000; // 1 hour max lifetime for active calls before timeout

const ACTIVE_STATUS_SET = new Set([
  'queued',
  'initiated',
  'ringing',
  'progressing',
  'connected',
  'in_progress',
  'in-progress',
  'active'
]);

/**
 * Checks if a call record or status is considered currently active.
 */
export function isCallActive(call: { status?: string | null } | string | null | undefined): boolean {
  if (!call) return false;
  const statusStr = typeof call === 'string' ? call : call.status;
  if (!statusStr) return false;
  return ACTIVE_STATUS_SET.has(statusStr.toLowerCase().trim());
}

/**
 * Counts the active concurrent calls for a given user across:
 * 1. CallOrchestrator in-memory active call sessions
 * 2. Database `Call` rows in active states within the freshness window
 * 3. Database `CallSession` rows in active states within the freshness window
 */
export async function countActiveCalls(userId: string): Promise<number> {
  const orchestratorActive = callOrchestrator.getActiveCallCountForUser(userId);
  const activeCutoff = new Date(Date.now() - MAX_ACTIVE_CALL_AGE_MS);

  const dbCalls = await prisma.call.count({
    where: {
      userId,
      status: {
        in: ['queued', 'ringing', 'progressing', 'connected', 'in_progress', 'IN_PROGRESS', 'active', 'ACTIVE']
      },
      createdAt: { gte: activeCutoff }
    }
  });

  const dbSessions = await prisma.callSession.count({
    where: {
      userId,
      status: {
        in: ['queued', 'initiated', 'ringing', 'connected', 'in_progress', 'IN_PROGRESS', 'active', 'ACTIVE']
      },
      createdAt: { gte: activeCutoff }
    }
  });

  return Math.max(orchestratorActive, dbCalls, dbSessions);
}

/**
 * Counts total concurrent calls across all users against the account-wide telephony cap.
 */
export async function countGlobalActiveCalls(): Promise<number> {
  const activeCutoff = new Date(Date.now() - MAX_ACTIVE_CALL_AGE_MS);

  const dbCalls = await prisma.call.count({
    where: {
      status: {
        in: ['queued', 'ringing', 'progressing', 'connected', 'in_progress', 'IN_PROGRESS', 'active', 'ACTIVE']
      },
      createdAt: { gte: activeCutoff }
    }
  });

  const dbSessions = await prisma.callSession.count({
    where: {
      status: {
        in: ['queued', 'initiated', 'ringing', 'connected', 'in_progress', 'IN_PROGRESS', 'active', 'ACTIVE']
      },
      createdAt: { gte: activeCutoff }
    }
  });

  return Math.max(dbCalls, dbSessions);
}

/**
 * Background stuck call reaper:
 * Transitions orphaned calls stuck in active states for >1 hour to 'timeout'.
 */
export async function reapStuckCalls(): Promise<{ reapedCalls: number; reapedSessions: number }> {
  const staleThreshold = new Date(Date.now() - MAX_ACTIVE_CALL_AGE_MS);

  try {
    const reapedCalls = await prisma.call.updateMany({
      where: {
        status: {
          in: ['queued', 'ringing', 'progressing', 'connected', 'in_progress', 'IN_PROGRESS', 'active', 'ACTIVE']
        },
        createdAt: { lt: staleThreshold }
      },
      data: {
        status: 'timeout',
        endTime: new Date()
      }
    });

    const reapedSessions = await prisma.callSession.updateMany({
      where: {
        status: {
          in: ['queued', 'initiated', 'ringing', 'connected', 'in_progress', 'IN_PROGRESS', 'active', 'ACTIVE']
        },
        createdAt: { lt: staleThreshold }
      },
      data: {
        status: 'closed'
      }
    });

    if (reapedCalls.count > 0 || reapedSessions.count > 0) {
      logger.warn('[Concurrency] Reaped stuck calls/sessions', {
        reapedCalls: reapedCalls.count,
        reapedSessions: reapedSessions.count
      });
    }

    return {
      reapedCalls: reapedCalls.count,
      reapedSessions: reapedSessions.count
    };
  } catch (error) {
    logger.error('[Concurrency] Failed to reap stuck calls', { error: String(error) });
    return { reapedCalls: 0, reapedSessions: 0 };
  }
}

/**
 * Per-tenant reservation mutex:
 * Serializes pre-call concurrency checks and initial call creation to eliminate
 * burst-arrival race conditions bypassing tenant concurrency limits.
 */
const tenantCallLocks = new Map<string, Promise<void>>();

export async function withUserCallLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  while (tenantCallLocks.has(userId)) {
    try {
      await tenantCallLocks.get(userId);
    } catch {}
  }

  let releaseLock!: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  tenantCallLocks.set(userId, lockPromise);

  try {
    return await fn();
  } finally {
    tenantCallLocks.delete(userId);
    releaseLock();
  }
}
