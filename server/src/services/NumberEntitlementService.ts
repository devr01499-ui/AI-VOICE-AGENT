import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

/**
 * The one-number rule: an account with an active paid plan may hold ONE phone number, on either
 * carrier, at a time.
 *
 * The old code read `numberLocked`, provisioned, then set it — two requests at the same moment
 * both passed the check and each got a number. Now the slot is taken FIRST with one conditional
 * UPDATE ("set numberLocked=true where it is still false"); the database row lock lets exactly
 * one request win. The slot is given back only if provisioning fails and the account still holds
 * no number.
 */
export async function reserveNumberSlot(userId: string): Promise<boolean> {
  const held = await prisma.phoneNumber.count({ where: { userId } });
  if (held > 0) return false;
  const won = await prisma.user.updateMany({ where: { id: userId, numberLocked: false }, data: { numberLocked: true } });
  return won.count === 1;
}

/** Gives the slot back after a failed provisioning attempt (never while a number is held). */
export async function releaseNumberSlot(userId: string, reason: string): Promise<void> {
  try {
    const held = await prisma.phoneNumber.count({ where: { userId } });
    if (held > 0) return;
    await prisma.user.updateMany({ where: { id: userId, numberLocked: true }, data: { numberLocked: false } });
    logger.info('[NUMBER_SLOT] released after failed provisioning', { userId, reason });
  } catch (err: any) {
    logger.error('[NUMBER_SLOT] could not release slot — account stays locked, support must unlock', { userId, reason, error: err?.message });
  }
}

export const NUMBER_SLOT_TAKEN_MESSAGE =
  'Your plan includes one phone number and your account already has one (or is setting one up right now). Release it first to choose another.';
