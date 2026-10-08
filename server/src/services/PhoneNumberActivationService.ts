import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { logAuditEvent } from '../utils/auditLogger';

export class PhoneNumberActivationService {
  /**
   * Evaluates the activation rule for all numbers belonging to a user:
   * Rule: A number becomes active automatically when:
   *   (KYC verified OR number does not require KYC) AND walletFundedAt is set.
   *
   * @param userId - ID of the user owning the numbers and sub-account
   * @param triggeredBy - Context ('kyc_webhook' | 'sync_kyc' | 'admin_wallet_funding')
   * @param actorUserId - User ID performing the action (for audit logs)
   * @returns Array of activated phone records
   */
  static async evaluateAndActivateUserNumbers(
    userId: string,
    triggeredBy: string,
    actorUserId?: string
  ): Promise<any[]> {
    // 1. Fetch user's sub-account to check walletFundedAt
    const subAccount = await prisma.vobizSubAccount.findUnique({
      where: { userId },
    });

    if (!subAccount || !subAccount.walletFundedAt) {
      logger.info('PhoneNumberActivationService: wallet is not yet funded, skipping auto-activation', {
        userId,
        triggeredBy,
      });
      return [];
    }

    // 2. Find all pending activation numbers for this user
    const pendingNumbers = await prisma.phoneNumber.findMany({
      where: {
        userId,
        status: { not: 'active' },
      },
    });

    const activated: any[] = [];

    for (const phone of pendingNumbers) {
      // Rule: (KYC verified OR number does not require KYC) AND walletFundedAt is set
      const isKycSatisfied = phone.kycStatus === 'verified' || !phone.aadhaarRequired;

      if (isKycSatisfied) {
        const updated = await prisma.phoneNumber.update({
          where: { id: phone.id },
          data: { status: 'active' },
        });

        activated.push(updated);

        await logAuditEvent({
          workspaceOwnerId: userId,
          actorUserId: actorUserId || userId,
          action: 'number.activated',
          targetId: phone.id,
          metadata: {
            phoneNumber: phone.phoneNumber,
            reason: 'Auto-activated: KYC verified or not required AND wallet funded',
            triggeredBy,
            walletFundedAt: subAccount.walletFundedAt,
            kycStatus: phone.kycStatus,
            aadhaarRequired: phone.aadhaarRequired,
          },
        });

        logger.info('PhoneNumberActivationService: auto-activated phone number', {
          userId,
          phoneId: phone.id,
          phoneNumber: phone.phoneNumber,
          triggeredBy,
        });
      }
    }

    return activated;
  }
}
