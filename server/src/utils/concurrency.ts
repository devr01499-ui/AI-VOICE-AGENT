import { prisma } from '../lib/prisma';
import { callOrchestrator } from '../core/orchestrator/CallOrchestrator';

/**
 * Universal Concurrency Source of Truth for Claritiy Voice
 * Replaces divergent definitions across BatchService and CallService.
 */

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
 * 2. Database `Call` rows in active states
 * 3. Database `CallSession` rows in active states
 */
export async function countActiveCalls(userId: string): Promise<number> {
  const orchestratorActive = callOrchestrator.getActiveCallCountForUser(userId);

  const dbCalls = await prisma.call.count({
    where: {
      userId,
      status: {
        in: ['queued', 'ringing', 'progressing', 'connected', 'in_progress', 'IN_PROGRESS', 'active', 'ACTIVE']
      }
    }
  });

  const dbSessions = await prisma.callSession.count({
    where: {
      userId,
      status: {
        in: ['queued', 'initiated', 'ringing', 'connected', 'in_progress', 'IN_PROGRESS', 'active', 'ACTIVE']
      }
    }
  });

  return Math.max(orchestratorActive, dbCalls, dbSessions);
}

/**
 * Counts total concurrent calls across all users against the account-wide telephony cap.
 */
export async function countGlobalActiveCalls(): Promise<number> {
  const dbCalls = await prisma.call.count({
    where: {
      status: {
        in: ['queued', 'ringing', 'progressing', 'connected', 'in_progress', 'IN_PROGRESS', 'active', 'ACTIVE']
      }
    }
  });

  const dbSessions = await prisma.callSession.count({
    where: {
      status: {
        in: ['queued', 'initiated', 'ringing', 'connected', 'in_progress', 'IN_PROGRESS', 'active', 'ACTIVE']
      }
    }
  });

  return Math.max(dbCalls, dbSessions);
}
