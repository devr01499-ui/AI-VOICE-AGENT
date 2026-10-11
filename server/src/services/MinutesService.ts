import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

export type MinutesLedgerReason =
  | 'plan_purchase'
  | 'admin_grant'
  | 'admin_deduct'
  | 'call_usage'
  | 'refund'
  | 'opening_balance'
  | 'adjustment';

export type ActorType = 'system' | 'customer' | 'staff';

export interface MinutesOperationParams {
  userId: string;
  deltaSeconds: number; // Positive integer representing the quantity of seconds
  reason: MinutesLedgerReason;
  refType?: string;
  refId?: string;
  note?: string;
  actorType: ActorType;
  actorId?: string;
  idempotencyKey: string;
}

export interface DebitOperationParams extends MinutesOperationParams {
  allowNegative?: boolean; // Only owner can force negative balance
}

export class MinutesService {
  /**
   * Credits seconds to a user's calling balance atomically inside a database transaction.
   * Safe against concurrent retries via unique idempotencyKey.
   */
  static async credit(params: MinutesOperationParams, tx?: Prisma.TransactionClient) {
    const { userId, deltaSeconds, reason, refType, refId, note, actorType, actorId, idempotencyKey } = params;

    if (deltaSeconds <= 0) {
      throw new Error('INVALID_DELTA: Credit deltaSeconds must be greater than zero.');
    }

    const run = async (prismaTx: Prisma.TransactionClient) => {
      // 1. Idempotency Check
      const existing = await prismaTx.minutesLedger.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        logger.info('[MINUTES_SERVICE] Idempotent credit hit, skipping re-apply', { idempotencyKey, userId });
        const user = await prismaTx.user.findUnique({
          where: { id: userId },
          select: { minutesRemainingSeconds: true, callingBalanceMinutes: true },
        });
        return { ledgerEntry: existing, balanceSeconds: user?.minutesRemainingSeconds ?? 0 };
      }

      // 2. Fetch User
      const user = await prismaTx.user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        throw new Error(`USER_NOT_FOUND: User ${userId} not found.`);
      }

      const currentSeconds = user.minutesRemainingSeconds > 0
        ? user.minutesRemainingSeconds
        : (user.callingBalanceMinutes * 60);

      const newBalanceSeconds = Math.round(currentSeconds + deltaSeconds);
      const newCallingBalanceMinutes = parseFloat((newBalanceSeconds / 60).toFixed(4));

      // 3. Insert Immutable Ledger Entry
      const ledgerEntry = await prismaTx.minutesLedger.create({
        data: {
          userId,
          deltaSeconds: Math.round(deltaSeconds),
          reason,
          refType: refType || null,
          refId: refId || null,
          note: note || null,
          actorType,
          actorId: actorId || null,
          balanceAfterSeconds: newBalanceSeconds,
          idempotencyKey,
        },
      });

      // 4. Update Cached User Balances
      await prismaTx.user.update({
        where: { id: userId },
        data: {
          minutesRemainingSeconds: newBalanceSeconds,
          callingBalanceMinutes: newCallingBalanceMinutes,
        },
      });

      logger.info('[MINUTES_SERVICE] Balance credited successfully', {
        userId,
        deltaSeconds,
        newBalanceSeconds,
        newCallingBalanceMinutes,
        reason,
        idempotencyKey,
      });

      return { ledgerEntry, balanceSeconds: newBalanceSeconds, balanceMinutes: newCallingBalanceMinutes };
    };

    if (tx) {
      return await run(tx);
    } else {
      return await prisma.$transaction(run);
    }
  }

  /**
   * Debits seconds from a user's calling balance atomically inside a database transaction.
   * Safe against concurrent retries via unique idempotencyKey.
   */
  static async debit(params: DebitOperationParams, tx?: Prisma.TransactionClient) {
    const { userId, deltaSeconds, reason, refType, refId, note, actorType, actorId, idempotencyKey, allowNegative } = params;

    if (deltaSeconds <= 0) {
      throw new Error('INVALID_DELTA: Debit deltaSeconds must be greater than zero.');
    }

    const run = async (prismaTx: Prisma.TransactionClient) => {
      // 1. Idempotency Check
      const existing = await prismaTx.minutesLedger.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        logger.info('[MINUTES_SERVICE] Idempotent debit hit, skipping re-apply', { idempotencyKey, userId });
        const user = await prismaTx.user.findUnique({
          where: { id: userId },
          select: { minutesRemainingSeconds: true, callingBalanceMinutes: true },
        });
        return { ledgerEntry: existing, balanceSeconds: user?.minutesRemainingSeconds ?? 0 };
      }

      // 2. Fetch User
      const user = await prismaTx.user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        throw new Error(`USER_NOT_FOUND: User ${userId} not found.`);
      }

      const currentSeconds = user.minutesRemainingSeconds > 0
        ? user.minutesRemainingSeconds
        : (user.callingBalanceMinutes * 60);

      if (!allowNegative && currentSeconds < deltaSeconds) {
        throw new Error(
          `INSUFFICIENT_BALANCE: Current balance is ${Math.round(currentSeconds)}s, requested debit is ${Math.round(deltaSeconds)}s.`
        );
      }

      const newBalanceSeconds = allowNegative
        ? Math.round(currentSeconds - deltaSeconds)
        : Math.max(0, Math.round(currentSeconds - deltaSeconds));
      const newCallingBalanceMinutes = parseFloat((Math.max(0, newBalanceSeconds) / 60).toFixed(4));
      const deltaMinutes = deltaSeconds / 60;
      const newTotalConsumed = (user.totalMinutesConsumed || 0) + (reason === 'call_usage' ? deltaMinutes : 0);

      // 3. Insert Immutable Ledger Entry
      const ledgerEntry = await prismaTx.minutesLedger.create({
        data: {
          userId,
          deltaSeconds: -Math.round(deltaSeconds), // Negative signed integer
          reason,
          refType: refType || null,
          refId: refId || null,
          note: note || null,
          actorType,
          actorId: actorId || null,
          balanceAfterSeconds: newBalanceSeconds,
          idempotencyKey,
        },
      });

      // 4. Update Cached User Balances
      await prismaTx.user.update({
        where: { id: userId },
        data: {
          minutesRemainingSeconds: newBalanceSeconds,
          callingBalanceMinutes: newCallingBalanceMinutes,
          ...(reason === 'call_usage' ? { totalMinutesConsumed: newTotalConsumed } : {}),
        },
      });

      logger.info('[MINUTES_SERVICE] Balance debited successfully', {
        userId,
        deltaSeconds,
        newBalanceSeconds,
        newCallingBalanceMinutes,
        reason,
        idempotencyKey,
      });

      return { ledgerEntry, balanceSeconds: newBalanceSeconds, balanceMinutes: newCallingBalanceMinutes };
    };

    if (tx) {
      return await run(tx);
    } else {
      return await prisma.$transaction(run);
    }
  }

  /**
   * Backfills an initial opening balance ledger entry for an existing user if one does not exist.
   */
  static async backfillOpeningBalance(userId: string, tx?: Prisma.TransactionClient) {
    const idempotencyKey = `opening_balance_${userId}`;
    const run = async (prismaTx: Prisma.TransactionClient) => {
      const existing = await prismaTx.minutesLedger.findUnique({
        where: { idempotencyKey },
      });
      if (existing) return existing;

      const user = await prismaTx.user.findUnique({ where: { id: userId } });
      if (!user) return null;

      const initialSeconds = user.minutesRemainingSeconds > 0
        ? Math.round(user.minutesRemainingSeconds)
        : Math.round(user.callingBalanceMinutes * 60);

      return await prismaTx.minutesLedger.create({
        data: {
          userId,
          deltaSeconds: initialSeconds,
          reason: 'opening_balance',
          note: 'Initial backfilled balance snapshot',
          actorType: 'system',
          balanceAfterSeconds: initialSeconds,
          idempotencyKey,
        },
      });
    };

    return tx ? await run(tx) : await prisma.$transaction(run);
  }

  /**
   * Verifies reconciliation between the sum of ledger entries and the cached user balance.
   */
  static async reconcileUser(userId: string) {
    const aggregate = await prisma.minutesLedger.aggregate({
      where: { userId },
      _sum: { deltaSeconds: true },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { minutesRemainingSeconds: true, callingBalanceMinutes: true },
    });

    const ledgerSumSeconds = aggregate._sum.deltaSeconds || 0;
    const cachedSeconds = Math.round(user?.minutesRemainingSeconds ?? 0);
    const diff = ledgerSumSeconds - cachedSeconds;

    return {
      userId,
      ledgerSumSeconds,
      cachedSeconds,
      cachedMinutes: user?.callingBalanceMinutes ?? 0,
      diff,
      isReconciled: Math.abs(diff) <= 1, // Allow 1s rounding tolerance
    };
  }
}
