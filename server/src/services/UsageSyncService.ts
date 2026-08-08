import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { VobizSubAccountService } from './VobizSubAccountService';
import { env } from '../config/env';
import { ProviderError } from '../types/errors';

export class UsageSyncService {
  /**
   * Syncs usage from Vobiz CDRs for a specific user and deducts from their billing balance.
   * Vobiz confirmed rate is ₹0.45/min for base usage, but we mark it up based on plan (e.g. ₹3.99/min).
   */
  static async syncUsageForUser(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const subAccount = await prisma.vobizSubAccount.findUnique({ where: { userId } });
    if (!subAccount) {
      logger.info('UsageSyncService: User has no sub-account. Skipping.', { userId });
      return;
    }

    // Rate based on plan
    let perMinuteRate = 3.99; // Starter
    if (user.accountType === 'professional' || user.accountType === 'developer') {
      perMinuteRate = 2.99;
    } else if (user.accountType === 'enterprise') {
      perMinuteRate = 1.99;
    }

    logger.info(`UsageSyncService: Syncing usage for ${userId} at ₹${perMinuteRate}/min`);

    // In a real implementation, we would query the Vobiz CDR API using the subAccount authId/authToken
    // URL: `${env.VOBIZ_API_URL}/Account/${subAccount.authId}/Call/` 
    // And filter by `end_time` > lastSyncTime

    // For now, we mock the sync by finding completed calls that haven't been billed
    const unbilledCalls = await prisma.call.findMany({
      where: {
        userId,
        status: 'completed',
        // In a real DB, we'd have an `isBilled` flag, but we'll use a heuristic for the mock
        durationSeconds: { gt: 0 }
      },
      take: 50,
    });

    let totalDurationMinutes = 0;
    for (const call of unbilledCalls) {
      const minutes = Math.ceil((call.durationSeconds || 0) / 60);
      totalDurationMinutes += minutes;
    }

    if (totalDurationMinutes > 0) {
      const totalCost = totalDurationMinutes * perMinuteRate;

      await prisma.user.update({
        where: { id: userId },
        data: {
          billingBalance: { decrement: totalCost },
          totalMinutesConsumed: { increment: totalDurationMinutes }
        }
      });

      logger.info(`UsageSyncService: Billed ₹${totalCost} for ${totalDurationMinutes} mins`, { userId });
    }
  }

  /**
   * Releases a phone number from the user's sub-account back to Vobiz.
   */
  static async releaseNumber(phoneNumberId: string, userId: string) {
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: { id: phoneNumberId, userId }
    });

    if (!phoneNumber) {
      throw new Error('Phone number not found or not owned by user');
    }

    const subAccount = await prisma.vobizSubAccount.findUnique({ where: { userId } });
    if (!subAccount) {
      throw new Error('Sub-account not found');
    }

    // Mock mode or real API call
    if (env.VOBIZ_AUTH_ID !== 'MA_PLACEHOLDER' && !env.VOBIZ_AUTH_ID.includes('placeholder')) {
      const url = `${env.VOBIZ_API_URL}/Account/${subAccount.authId}/PhoneNumber/${phoneNumber.phoneNumber}/`;
      
      try {
        const response = await fetch(url, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Auth-ID': env.VOBIZ_AUTH_ID,
            'X-Auth-Token': env.VOBIZ_AUTH_TOKEN, // In reality, sub-account auth token decrypted
          },
        });

        if (!response.ok && response.status !== 404) {
          const text = await response.text();
          throw new ProviderError('vobiz', `Release number failed (${response.status}): ${text}`);
        }
      } catch (err) {
        logger.error('UsageSyncService: failed to release number from provider', { error: String(err) });
        throw err;
      }
    }

    // Remove from DB or mark as released
    await prisma.phoneNumber.delete({
      where: { id: phoneNumber.id }
    });

    logger.info('UsageSyncService: Successfully released number', { phoneNumberId, userId });
  }
}
