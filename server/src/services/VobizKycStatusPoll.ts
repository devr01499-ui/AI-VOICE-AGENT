import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { VobizSubAccountService } from './VobizSubAccountService';
import { ADMIN_EMAIL } from '../config/constants';

/**
 * Picks up Vobiz KYC results for customers still under review (owner report 2026-11-25: approvals
 * took too long). Vobiz reviews each customer's own KYC (customer_use). Before this job the result
 * reached Claritiy only if Vobiz's webhook arrived, or when the customer happened to open Calling
 * Config; otherwise the account stayed "pending", calls stayed blocked and the number stayed off.
 *
 * Every run checks the least recently checked pending sub-accounts. refreshKyc reads Vobiz's
 * documented KYC status endpoint, stores the verdict (only the user's OWN customer_use KYC counts),
 * updates KYC-gated numbers and activates them. A real change to verified/failed is announced once,
 * exactly like the webhook path (the email itself is de-duplicated by kyc_email_logs).
 * Simulated (SA_MOCK_) sub-accounts and the platform admin are never polled.
 */
const BATCH = 50;
const PAUSE_MS = 200;

export async function refreshPendingVobizKyc(
  service: VobizSubAccountService = new VobizSubAccountService(),
  opts: { limit?: number; pauseMs?: number; userIds?: string[] } = {},
): Promise<{ checked: number; changed: number }> {
  const pending = await prisma.vobizSubAccount.findMany({
    where: {
      kycStatus: 'pending',
      NOT: { authId: { startsWith: 'SA_MOCK_' } },
      user: { is: { accountType: { not: 'admin' }, email: { not: ADMIN_EMAIL } } },
      ...(opts.userIds ? { userId: { in: opts.userIds } } : {}),
    },
    // Least recently checked first, so one account the carrier keeps refusing never blocks the rest.
    orderBy: { updatedAt: 'asc' },
    take: opts.limit ?? BATCH,
    select: { id: true, userId: true, kycStatus: true },
  });

  let changed = 0;
  for (const sub of pending) {
    try {
      // refreshKyc stores, audits and notifies a change; on a carrier error it changes nothing.
      const result = await service.refreshKyc(sub.userId, 'kyc_poll');
      if (result?.changed) {
        changed++;
        logger.info('VobizKycStatusPoll: KYC result picked up from Vobiz', { userId: sub.userId, kycStatus: result.kycStatus });
      }
    } catch (err) {
      logger.warn('VobizKycStatusPoll: check failed; retried on a later run', { userId: sub.userId, error: String(err) });
    }
    // Moves this account to the back of the queue even when the carrier did not answer.
    await prisma.vobizSubAccount.update({ where: { id: sub.id }, data: { updatedAt: new Date() } }).catch(() => {});
    const pause = opts.pauseMs ?? PAUSE_MS;
    if (pause > 0) await new Promise((r) => setTimeout(r, pause));
  }
  if (changed) logger.info('VobizKycStatusPoll: run finished', { checked: pending.length, changed });
  return { checked: pending.length, changed };
}

let timer: NodeJS.Timeout | null = null;

/** Every 5 minutes (first run 1 minute after boot). No-op without Vobiz credentials (simulated mode). */
export function startVobizKycStatusPoll(intervalMs = 5 * 60 * 1000): void {
  if (timer) return;
  const run = () => refreshPendingVobizKyc().catch((err) => logger.warn('VobizKycStatusPoll: run skipped', { error: String(err) }));
  setTimeout(run, 60 * 1000).unref?.();
  timer = setInterval(run, intervalMs);
  timer.unref?.();
}
