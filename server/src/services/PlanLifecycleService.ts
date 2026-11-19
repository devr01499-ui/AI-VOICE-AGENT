import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { ADMIN_EMAIL } from '../config/constants';
import { NUMBER_RELEASE_GRACE_DAYS } from '../config/plans';
import { getCallableSecondsRemaining } from '../utils/balanceUtils';
import { MinutesService } from './MinutesService';
import { NotificationService } from './NotificationService';
import { UsageSyncService } from './UsageSyncService';

/**
 * Plan end and phone-number release (owner decision 2026-11-19).
 *
 * A plan ends when its minutes run out OR 30 days after purchase (planExpiresAt), whichever comes
 * first. At the 30-day end, unused minutes lapse. The user is warned once; NUMBER_RELEASE_GRACE_DAYS
 * (5) days after the end, every number on the account is released back to the carrier, so the
 * master account stops paying its monthly fee. Buying a plan before then cancels the release.
 * Numbers the carrier could not release yet ('release_pending') are retried every run.
 *
 * Plans bought before validity existed have no planExpiresAt: they end only when minutes run out.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const EXHAUSTED = 'plan.minutes_exhausted_observed';
const WARNED = 'number.release_warning';
const LIVE_NUMBER_STATUSES = ['active', 'activation_pending', 'inactive'];

type LifecycleUser = {
  id: string;
  email: string;
  accountType: string;
  planExpiresAt: Date | null;
  minutesRemainingSeconds: number;
  callingBalanceMinutes: number;
};

async function audit(userId: string, action: string, targetId: string, metadata: Record<string, unknown> = {}) {
  return prisma.auditLog.create({ data: { workspaceOwnerId: userId, actorUserId: userId, action, targetId, metadata: metadata as any } });
}

/** Last time minutes were added (any credit in the ledger), or null. */
async function lastCreditAt(userId: string): Promise<Date | null> {
  const row = await prisma.minutesLedger.findFirst({ where: { userId, deltaSeconds: { gt: 0 } }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
  return row?.createdAt ?? null;
}

/**
 * When did the current plan end? Null while it is still running.
 * Minutes-exhausted time is recorded the first time a run sees the balance at 0 after the last
 * credit (runs are hourly, so it is accurate to the hour).
 */
export async function planEndedAt(user: LifecycleUser, now: Date): Promise<Date | null> {
  if (user.accountType === 'admin' || user.email === ADMIN_EMAIL) return null;
  const ends: Date[] = [];
  if (user.planExpiresAt && user.planExpiresAt.getTime() <= now.getTime()) ends.push(user.planExpiresAt);

  if (getCallableSecondsRemaining(user as any) <= 0) {
    const credit = await lastCreditAt(user.id);
    let seen = await prisma.auditLog.findFirst({
      where: { workspaceOwnerId: user.id, action: EXHAUSTED, ...(credit ? { createdAt: { gt: credit } } : {}) },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    if (!seen) {
      // Use the stored time, so every later run computes the same plan end (and warns only once).
      const created = await audit(user.id, EXHAUSTED, user.id, { observedAt: now.toISOString() });
      seen = { createdAt: created.createdAt };
    }
    ends.push(seen.createdAt);
  }
  if (!ends.length) return null;
  return new Date(Math.min(...ends.map((d) => d.getTime())));
}

/** At the end of the 30-day validity, minutes left on the plan lapse (once per plan window). */
export async function lapseExpiredMinutes(user: LifecycleUser, now: Date): Promise<number> {
  if (!user.planExpiresAt || user.planExpiresAt.getTime() > now.getTime()) return 0;
  if (user.accountType === 'admin' || user.email === ADMIN_EMAIL) return 0;
  const left = Math.floor(Number(user.minutesRemainingSeconds) || 0);
  if (left <= 0) return 0;
  await MinutesService.debit({
    userId: user.id,
    deltaSeconds: left,
    reason: 'plan_expired',
    refType: 'plan_validity',
    refId: user.planExpiresAt.toISOString(),
    note: 'Plan validity (30 days) ended; unused minutes lapsed',
    actorType: 'system',
    idempotencyKey: `plan_expired_${user.id}_${user.planExpiresAt.getTime()}`,
  });
  return left;
}

export interface LifecycleReport {
  checked: number;
  minutesLapsed: number;
  warned: number;
  released: number;
  releasePending: number;
}

export async function runPlanLifecycle(now: Date = new Date(), opts: { userIds?: string[] } = {}): Promise<LifecycleReport> {
  const report: LifecycleReport = { checked: 0, minutesLapsed: 0, warned: 0, released: 0, releasePending: 0 };

  // Accounts that hold a number (only they cost carrier money) or whose plan window has ended.
  const users = await prisma.user.findMany({
    where: {
      ...(opts.userIds ? { id: { in: opts.userIds } } : {}),
      OR: [
        { phoneNumbers: { some: { status: { in: [...LIVE_NUMBER_STATUSES, 'release_pending'] } } } },
        { planExpiresAt: { lte: now } },
      ],
    },
    select: { id: true, email: true, accountType: true, planExpiresAt: true, minutesRemainingSeconds: true, callingBalanceMinutes: true },
    take: 500,
  });

  for (const user of users as LifecycleUser[]) {
    report.checked++;
    try {
      const lapsed = await lapseExpiredMinutes(user, now);
      if (lapsed > 0) {
        report.minutesLapsed += lapsed;
        user.minutesRemainingSeconds = 0;
      }

      // Retry numbers the carrier could not release earlier (cool-off, errors).
      const stuck = await prisma.phoneNumber.findMany({ where: { userId: user.id, status: 'release_pending' }, select: { id: true } });
      for (const n of stuck) {
        const r = await UsageSyncService.releaseNumber(n.id, user.id);
        if (r.released) report.released++; else report.releasePending++;
      }

      const numbers = await prisma.phoneNumber.findMany({
        where: { userId: user.id, status: { in: LIVE_NUMBER_STATUSES } },
        select: { id: true, phoneNumber: true },
      });
      if (!numbers.length) continue;
      const ended = await planEndedAt(user, now);
      if (!ended) continue;

      const releaseAt = new Date(ended.getTime() + NUMBER_RELEASE_GRACE_DAYS * DAY_MS);
      const windowKey = `${user.id}:${ended.toISOString()}`;
      if (now.getTime() < releaseAt.getTime()) {
        const warned = await prisma.auditLog.findFirst({ where: { workspaceOwnerId: user.id, action: WARNED, targetId: windowKey }, select: { id: true } });
        if (!warned) {
          const list = numbers.map((n) => n.phoneNumber).join(', ');
          await NotificationService.createInAppNotification({
            userId: user.id,
            type: 'PLAN_ENDED',
            title: 'Your plan has ended',
            severity: 'warning',
            isImportant: true,
            message: `Your plan has ended. Your number ${list} will be released on ${releaseAt.toISOString().slice(0, 10)} unless you buy a plan before then. A released number cannot be recovered.`,
            metadata: { releaseAt: releaseAt.toISOString(), actionUrl: '/dashboard/billing' },
          }).catch(() => {});
          await audit(user.id, WARNED, windowKey, { releaseAt: releaseAt.toISOString() });
          report.warned++;
        }
        continue;
      }

      for (const n of numbers) {
        const r = await UsageSyncService.releaseNumber(n.id, user.id);
        if (r.released) report.released++; else report.releasePending++;
        await audit(user.id, r.released ? 'number.released_after_plan_end' : 'number.release_pending', n.id, { planEndedAt: ended.toISOString() });
      }
      await NotificationService.createInAppNotification({
        userId: user.id,
        type: 'NUMBER_RELEASED',
        title: 'Your number was released',
        severity: 'info',
        message: `Your plan ended on ${ended.toISOString().slice(0, 10)} and no new plan was bought within ${NUMBER_RELEASE_GRACE_DAYS} days, so your number was released. Buy a plan to get a new number.`,
        metadata: { actionUrl: '/dashboard/billing' },
      }).catch(() => {});
    } catch (err) {
      logger.error('PlanLifecycle: user check failed', { userId: user.id, error: String(err) });
    }
  }
  if (report.minutesLapsed || report.warned || report.released || report.releasePending) {
    logger.info('PlanLifecycle: run finished', { ...report });
  }
  return report;
}

let timer: NodeJS.Timeout | null = null;

export function startPlanLifecycle(intervalMs = 60 * 60 * 1000): void {
  if (timer) return;
  const run = () => runPlanLifecycle().catch((err) => logger.warn('PlanLifecycle: run skipped', { error: String(err) }));
  setTimeout(run, 60 * 1000).unref?.();
  timer = setInterval(run, intervalMs);
  timer.unref?.();
}
