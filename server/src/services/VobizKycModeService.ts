import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { VobizSubAccountService } from './VobizSubAccountService';
import { NotificationService } from './NotificationService';
import { ADMIN_EMAIL } from '../config/constants';

/**
 * Every customer must pass their OWN KYC with Vobiz (owner decision 2026-11-19).
 *
 * Sub-accounts created before this release were created without kyc_mode, so on Vobiz they are
 * 'personal_use' and inherit Claritiy's master KYC (Vobiz docs: Create a Subaccount). This job:
 *  1. once, records that real state locally (kycMode 'personal_use', not verified, calls blocked
 *     until Vobiz confirms the user's own KYC);
 *  2. switches each of them to 'customer_use' on Vobiz (documented Update endpoint) and reads back
 *     Vobiz's KYC status. Users whose own KYC is already verified at Vobiz keep calling; the others
 *     are asked to complete KYC. Retried every 30 minutes until every account is switched.
 */
const BACKFILL_MARKER = 'maintenance.vobiz_kyc_mode_backfill_v1';
const BATCH = 25;
const PAUSE_MS = 300;

export async function backfillLegacyKycMode(now: Date = new Date()): Promise<number> {
  const done = await prisma.auditLog.findFirst({ where: { action: BACKFILL_MARKER }, select: { id: true } });
  if (done) return 0;
  const res = await prisma.vobizSubAccount.updateMany({
    where: { createdAt: { lt: now }, NOT: { authId: { startsWith: 'SA_MOCK_' } }, kycMode: { not: 'personal_use' } },
    data: { kycMode: 'personal_use' },
  });
  const anyUser = await prisma.vobizSubAccount.findFirst({ select: { userId: true } });
  if (anyUser) {
    await prisma.auditLog.create({
      data: { workspaceOwnerId: anyUser.userId, actorUserId: anyUser.userId, action: BACKFILL_MARKER, metadata: { marked: res.count } },
    });
  }
  return res.count;
}

export async function promoteLegacySubAccounts(
  service: VobizSubAccountService = new VobizSubAccountService(),
  opts: { userIds?: string[] } = {},
): Promise<{ switched: number; failed: number }> {
  const pending = await prisma.vobizSubAccount.findMany({
    where: {
      kycMode: 'personal_use',
      NOT: { authId: { startsWith: 'SA_MOCK_' } },
      // Platform admin accounts are not KYC-gated for calls, and the owner's email is already used
      // by the master account (Vobiz answers 409), so they are never switched.
      user: { is: { accountType: { not: 'admin' }, email: { not: ADMIN_EMAIL } } },
      ...(opts.userIds ? { userId: { in: opts.userIds } } : {}),
    },
    // Least recently tried first, so accounts Vobiz keeps refusing never block the rest.
    orderBy: { updatedAt: 'asc' },
    select: { id: true, userId: true, authId: true, user: { select: { email: true } } },
    take: BATCH,
  });
  let switched = 0;
  let failed = 0;
  for (const sub of pending) {
    const ok = await service.promoteToCustomerUse(sub, sub.user?.email || '').catch((err) => {
      logger.error('VobizKycMode: switch to customer_use failed', { userId: sub.userId, error: String(err) });
      return false;
    });
    if (!ok) {
      failed++;
      await prisma.vobizSubAccount.update({ where: { id: sub.id }, data: { updatedAt: new Date() } }).catch(() => {});
      continue;
    }
    switched++;
    await service.refreshKyc(sub.userId, 'kyc_mode_switch').catch(() => null);
    const after = await prisma.vobizSubAccount.findUnique({ where: { id: sub.id }, select: { kycCallsBlocked: true } });
    if (after?.kycCallsBlocked) {
      await NotificationService.createInAppNotification({
        userId: sub.userId,
        type: 'KYC_REQUIRED',
        title: 'Complete your KYC to keep calling',
        severity: 'warning',
        isImportant: true,
        message: 'Our carrier now verifies every customer directly. Please complete KYC (PAN with Aadhaar, or PAN with GST) under Settings > Compliance. Calls resume as soon as you are verified.',
        metadata: { actionUrl: '/dashboard/compliance' },
      }).catch(() => {});
    }
    await new Promise((r) => setTimeout(r, PAUSE_MS));
  }
  if (pending.length) logger.info('VobizKycMode: legacy sub-accounts switched to customer_use', { switched, failed, remainingInBatch: pending.length - switched });
  return { switched, failed };
}

let timer: NodeJS.Timeout | null = null;

export function startKycModeMigration(intervalMs = 30 * 60 * 1000): void {
  const run = () => promoteLegacySubAccounts().catch((err) => logger.warn('VobizKycMode: run skipped', { error: String(err) }));
  backfillLegacyKycMode()
    .then((n) => { if (n > 0) logger.info('VobizKycMode: legacy sub-accounts marked personal_use (inherited KYC)', { count: n }); })
    .catch((err) => logger.warn('VobizKycMode: backfill skipped', { error: String(err) }))
    .finally(() => { setTimeout(run, 30 * 1000).unref?.(); });
  if (!timer) {
    timer = setInterval(run, intervalMs);
    timer.unref?.();
  }
}
