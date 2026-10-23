import { ADMIN_EMAIL } from '../config/constants';

export interface UserBalanceFields {
  accountType?: string | null;
  email?: string | null;
  minutesRemainingSeconds?: number | null;
  callingBalanceMinutes?: number | null;
}

/**
 * Returns the effective callable seconds remaining for a user.
 * 
 * Rules:
 * 1. Admin accounts (accountType === 'admin' or email === ADMIN_EMAIL) are exempt (returns Infinity).
 * 2. minutesRemainingSeconds is the primary source of truth.
 * 3. Fallback to callingBalanceMinutes * 60 if minutesRemainingSeconds is not set or 0 while callingBalanceMinutes > 0.
 * 4. Never returns negative numbers (clamped to 0).
 */
export function getCallableSecondsRemaining(user: UserBalanceFields | null | undefined): number {
  if (!user) return 0;

  if (user.accountType === 'admin' || user.email === ADMIN_EMAIL) {
    return Infinity;
  }

  const seconds = typeof user.minutesRemainingSeconds === 'number' ? user.minutesRemainingSeconds : 0;
  if (seconds > 0) {
    return seconds;
  }

  const minutesSec = typeof user.callingBalanceMinutes === 'number' ? user.callingBalanceMinutes * 60 : 0;
  return Math.max(0, minutesSec);
}

/**
 * Checks whether the user has sufficient balance to place or answer a call.
 */
export function hasCallableBalance(user: UserBalanceFields | null | undefined): boolean {
  return getCallableSecondsRemaining(user) > 0;
}
