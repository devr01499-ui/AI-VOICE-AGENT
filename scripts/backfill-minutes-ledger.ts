/**
 * Claritiy Voice — Minutes Ledger Opening Balance Backfill Script
 * Backfills one `opening_balance` entry per existing user from their current balance.
 *
 * Usage:
 *   npx tsx scripts/backfill-minutes-ledger.ts
 */

import 'dotenv/config';
import { prisma } from '../server/src/lib/prisma';
import { MinutesService } from '../server/src/services/MinutesService';

async function backfillAllUsers() {
  console.log('[BACKFILL] Starting Minutes Ledger opening balance backfill...');

  const users = await prisma.user.findMany({
    select: { id: true, email: true, callingBalanceMinutes: true, minutesRemainingSeconds: true },
  });

  console.log(`[BACKFILL] Found ${users.length} users in the database.`);

  let createdCount = 0;
  let skippedCount = 0;

  for (const user of users) {
    const existing = await prisma.minutesLedger.findUnique({
      where: { idempotencyKey: `opening_balance_${user.id}` },
    });

    if (existing) {
      skippedCount++;
      continue;
    }

    await MinutesService.backfillOpeningBalance(user.id);
    createdCount++;
  }

  console.log(`[BACKFILL] Completed: ${createdCount} backfilled, ${skippedCount} already existed.`);

  // Run reconciliation check on all users
  let mismatches = 0;
  for (const user of users) {
    const rec = await MinutesService.reconcileUser(user.id);
    if (!rec.isReconciled) {
      console.warn(`[RECONCILIATION_MISMATCH] User ${user.email} (${user.id}): Ledger=${rec.ledgerSumSeconds}s, Cached=${rec.cachedSeconds}s (Diff=${rec.diff}s)`);
      mismatches++;
    }
  }

  console.log(`[BACKFILL_AUDIT] Reconciliation complete. Total mismatches: ${mismatches}`);
}

backfillAllUsers()
  .catch((err) => {
    console.error('[BACKFILL_ERROR] Failed to run backfill:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
