import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { CallService } from './CallService';
import { BatchService } from './BatchService';
import { getNextRetryTime } from '../lib/calendar/retryPolicy';
import { isWithinCallingHours } from '../lib/calendar/timezone';
import { PlatformConfigService } from './PlatformConfigService';

/**
 * Places the follow-up calls an agent booked during a call (rows in scheduled_calls) when they fall
 * due (audit #148: they were stored but nothing ever dialled them; the old standalone script was
 * never run and would have failed every call).
 *
 * Every minute: due rows are CLAIMED one by one with a conditional update (status scheduled ->
 * in_progress), so two server instances never dial the same booking. Before dialling: the
 * customer's opt-out (DNC) list and the 09:00-21:00 calling window in the booking's timezone are
 * checked; outside the window the call moves to the next allowed slot. The call goes through
 * CallService.createCall, so minutes, plan, KYC, concurrency and caller-ID rules all apply.
 * A refusal for lack of a free line is retried in 2 minutes without using an attempt; other
 * failures follow the retry policy (15 min, 1 h, 24 h) up to maxAttempts.
 */
const BATCH = 20;
const CAPACITY_RETRY_MS = 2 * 60 * 1000;
const STEP_MS = 30 * 60 * 1000;

export interface ExecutorReport { claimed: number; placed: number; rescheduled: number; failed: number; canceled: number }

/** Next time at or after `from` inside 09:00-21:00 in `timezone`, in 30-minute steps (max 2 days). */
export function nextAllowedTime(from: Date, timezone: string): Date {
  let t = new Date(Math.ceil(from.getTime() / STEP_MS) * STEP_MS);
  for (let i = 0; i < 96; i++) {
    if (isWithinCallingHours(t, timezone, 9, 21)) return t;
    t = new Date(t.getTime() + STEP_MS);
  }
  return t;
}

async function callerIdFor(userId: string, originCallId: string | null): Promise<string | undefined> {
  if (originCallId) {
    const origin = await prisma.call.findFirst({ where: { id: originCallId, userId }, select: { callDirection: true, fromPhoneNumber: true, recipientPhoneNumber: true } });
    const ours = origin ? ((origin.callDirection || '').toLowerCase() === 'inbound' ? origin.recipientPhoneNumber : origin.fromPhoneNumber) : null;
    if (ours) {
      const owned = await prisma.phoneNumber.findFirst({ where: { userId, phoneNumber: ours, status: 'active' }, select: { phoneNumber: true } });
      if (owned) return owned.phoneNumber;
    }
  }
  const any = await prisma.phoneNumber.findFirst({ where: { userId, status: 'active' }, orderBy: { purchasedAt: 'asc' }, select: { phoneNumber: true } });
  return any?.phoneNumber;
}

async function isOptedOut(userId: string, phone: string): Promise<boolean> {
  const digits = phone.replace(/\D/g, '');
  const variants = Array.from(new Set([phone, `+${digits}`, digits, digits.length === 10 ? `+91${digits}` : '']).values()).filter(Boolean);
  const c = await prisma.contact.findFirst({ where: { userId, phoneNumber: { in: variants }, optedOutAt: { not: null } }, select: { id: true } });
  return Boolean(c);
}

async function bumpCampaign(batchId: string | null, field: 'completedCount' | 'failedCount') {
  if (!batchId) return;
  await prisma.batchCampaign.update({ where: { id: batchId }, data: { [field]: { increment: 1 } } }).catch(() => {});
}

export async function runScheduledCalls(now: Date = new Date(), opts: { ids?: string[] } = {}): Promise<ExecutorReport> {
  const report: ExecutorReport = { claimed: 0, placed: 0, rescheduled: 0, failed: 0, canceled: 0 };
  // Platform emergency switch: leave every due call untouched (still 'scheduled'); the next run
  // after the switch is turned off places them.
  await PlatformConfigService.ensureLoaded();
  if (PlatformConfigService.isOutboundPaused()) return report;
  const due = await prisma.scheduledCall.findMany({
    where: { status: 'scheduled', scheduledAtUtc: { lte: now }, ...(opts.ids ? { id: { in: opts.ids } } : {}) },
    orderBy: { scheduledAtUtc: 'asc' },
    take: BATCH,
  });

  for (const row of due) {
    // Claim: only one worker can move this row from scheduled to in_progress.
    const claim = await prisma.scheduledCall.updateMany({
      where: { id: row.id, status: 'scheduled' },
      data: { status: 'in_progress', lastAttemptAt: now },
    });
    if (claim.count !== 1) continue;
    report.claimed++;

    const agent = await prisma.agent.findUnique({ where: { id: row.agentId }, select: { id: true, userId: true } });
    if (!agent) {
      await prisma.scheduledCall.update({ where: { id: row.id }, data: { status: 'failed', notes: 'Agent no longer exists' } });
      await bumpCampaign(row.batchId, 'failedCount');
      report.failed++;
      continue;
    }

    if (await isOptedOut(agent.userId, row.phoneNumber)) {
      await prisma.scheduledCall.update({ where: { id: row.id }, data: { status: 'canceled', notes: 'Not called: the contact has opted out (DNC)' } });
      report.canceled++;
      continue;
    }

    if (!isWithinCallingHours(now, row.timezone || 'Asia/Kolkata', 9, 21)) {
      const next = nextAllowedTime(now, row.timezone || 'Asia/Kolkata');
      await prisma.scheduledCall.update({ where: { id: row.id }, data: { status: 'scheduled', scheduledAtUtc: next, notes: `Moved to ${next.toISOString()} (outside 09:00-21:00 calling hours)` } });
      report.rescheduled++;
      continue;
    }

    const attempt = row.attemptCount + 1;
    try {
      const result = await CallService.createCall({
        phoneNumber: row.phoneNumber,
        agentId: row.agentId,
        userId: agent.userId,
        fromPhoneNumber: await callerIdFor(agent.userId, row.originCallId),
        userData: { scheduledCallId: row.id, source: row.source },
      });
      await prisma.scheduledCall.update({ where: { id: row.id }, data: { status: 'completed', attemptCount: attempt, notes: `Placed as call ${result.callId}` } });
      await bumpCampaign(row.batchId, 'completedCount');
      report.placed++;
    } catch (err: any) {
      const message = String(err?.message || err);
      if (BatchService.isCapacityRefusal(message)) {
        await prisma.scheduledCall.update({ where: { id: row.id }, data: { status: 'scheduled', scheduledAtUtc: new Date(now.getTime() + CAPACITY_RETRY_MS), notes: 'Waiting for a free line' } });
        report.rescheduled++;
        continue;
      }
      const nextRetry = getNextRetryTime(attempt, now);
      if (nextRetry && attempt < row.maxAttempts) {
        await prisma.scheduledCall.update({ where: { id: row.id }, data: { status: 'scheduled', attemptCount: attempt, scheduledAtUtc: nextRetry, notes: `Retry at ${nextRetry.toISOString()}: ${message.slice(0, 200)}` } });
        report.rescheduled++;
      } else {
        await prisma.scheduledCall.update({ where: { id: row.id }, data: { status: 'failed', attemptCount: attempt, notes: `Failed after ${attempt} attempt(s): ${message.slice(0, 200)}` } });
        await bumpCampaign(row.batchId, 'failedCount');
        report.failed++;
      }
    }
  }
  if (report.claimed) logger.info('ScheduledCalls: run finished', { ...report });
  return report;
}

/**
 * A row left in_progress by a restart mid-dial: if a call to that number was started after the
 * claim, the booking is done (never ring the customer twice); otherwise it goes back to scheduled.
 */
export async function recoverStuckScheduledCalls(now: Date = new Date()): Promise<number> {
  const stuck = await prisma.scheduledCall.findMany({
    where: { status: 'in_progress', lastAttemptAt: { lt: new Date(now.getTime() - 10 * 60 * 1000) } },
    take: 50,
  });
  for (const row of stuck) {
    const agent = await prisma.agent.findUnique({ where: { id: row.agentId }, select: { userId: true } });
    const placed = agent && row.lastAttemptAt
      ? await prisma.call.findFirst({ where: { userId: agent.userId, recipientPhoneNumber: row.phoneNumber, createdAt: { gte: row.lastAttemptAt } }, select: { id: true } })
      : null;
    await prisma.scheduledCall.updateMany({
      where: { id: row.id, status: 'in_progress' },
      data: placed
        ? { status: 'completed', attemptCount: row.attemptCount + 1, notes: `Placed as call ${placed.id} (confirmed after a restart)` }
        : { status: 'scheduled' },
    });
  }
  return stuck.length;
}

let timer: NodeJS.Timeout | null = null;
export function startScheduledCallExecutor(intervalMs = 60 * 1000): void {
  if (timer) return;
  const run = async () => {
    try {
      await recoverStuckScheduledCalls();
      await runScheduledCalls();
    } catch (err) {
      logger.warn('ScheduledCalls: run skipped', { error: String(err) });
    }
  };
  timer = setInterval(run, intervalMs);
  timer.unref?.();
}
