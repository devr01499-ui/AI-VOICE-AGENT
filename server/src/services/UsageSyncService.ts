import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { releaseCarrierNumber, type ReleaseOutcome } from './CarrierNumberReleaseService';

export type NumberReleaseResult =
  | { released: true }
  | { released: false; pending: true; retryAfter: Date | null; reason: string };

export class UsageSyncService {
  /**
   * Releases a user's phone number back to its carrier, then removes it from Claritiy.
   *
   * The local record is deleted ONLY after the carrier confirms (or says the number is already
   * gone). Before, the row was deleted even when the carrier refused, so Claritiy's master account
   * kept paying the monthly fee for a number nobody could see. When the carrier cannot release yet
   * (Vobiz 15-day cool-off after the last call, or an error), the number is kept as
   * 'release_pending' (no calls) and the release job retries it.
   */
  static async releaseNumber(phoneNumberId: string, userId: string): Promise<NumberReleaseResult> {
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: { id: phoneNumberId, userId }
    });

    if (!phoneNumber) {
      throw new Error('Phone number not found or not owned by user');
    }

    let outcome: ReleaseOutcome = await releaseCarrierNumber(phoneNumber);
    // Local development and tests run without carrier keys: nothing is rented there to release.
    if (outcome.result === 'failed' && /not configured|no_credentials/.test(outcome.detail) && env.NODE_ENV !== 'production') {
      outcome = { result: 'already_gone' };
    }

    if (outcome.result === 'cool_off' || outcome.result === 'failed') {
      const pendingOutcome = outcome as Extract<ReleaseOutcome, { result: 'cool_off' | 'failed' }>;
      const reason = pendingOutcome.result === 'cool_off' ? 'carrier cool-off after recent calls' : `carrier refused: ${pendingOutcome.detail}`;
      const retryAfter = pendingOutcome.result === 'cool_off' ? pendingOutcome.retryAfter : null;
      await prisma.phoneNumber.update({ where: { id: phoneNumber.id }, data: { status: 'release_pending' } });
      logger.error('[ADMIN_ALERT][NUMBER_RELEASE] number could not be released at the carrier yet; kept as release_pending and retried', {
        userId, phoneNumberId, provider: phoneNumber.telephonyProvider, reason, retryAfter,
      });
      return { released: false, pending: true, retryAfter, reason };
    }

    // Clean up child inbound configs to prevent foreign key errors
    await prisma.inboundConfig.deleteMany({
      where: { phoneNumberId: phoneNumber.id }
    }).catch(() => {});

    await prisma.phoneNumber.delete({
      where: { id: phoneNumber.id }
    });

    // The plan's one number has been used: releasing it does NOT give back a free slot (audit #5:
    // claim -> release -> claim bought a new number on the master account every time). Buying a plan
    // grants a new slot (PlanFulfillmentService).
    const remainingCount = await prisma.phoneNumber.count({ where: { userId } });
    if (remainingCount === 0) {
      logger.info('UsageSyncService: last number released; the bundled-number slot stays used until the next plan purchase', { userId });
    }

    logger.info('UsageSyncService: number released at the carrier and removed', { phoneNumberId, userId, carrierResult: outcome.result });
    return { released: true };
  }
}
