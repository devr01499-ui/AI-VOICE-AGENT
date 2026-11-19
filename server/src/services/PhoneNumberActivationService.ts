import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { logAuditEvent } from '../utils/auditLogger';

export class PhoneNumberActivationService {
  /**
   * Evaluates the activation rule for all numbers belonging to a user. A number waiting for
   * activation becomes active automatically when its KYC is verified, or when the number itself
   * needs no extra KYC.
   *
   * No manual "wallet funded" step (owner decision 2026-11-19): a Vobiz sub-account (SA_) uses the
   * master account's ledger, so nothing has to be topped up before a number can work. Calls stay
   * gated separately by the user's own Vobiz KYC (kycCallsBlocked).
   * Only numbers in 'activation_pending' are touched; suspended, released or failed numbers are not.
   *
   * @param userId - ID of the user owning the numbers
   * @param triggeredBy - Context ('purchase' | 'kyc_webhook' | 'sync_kyc' | 'admin_wallet_funding')
   * @param actorUserId - User ID performing the action (for audit logs)
   * @returns Array of activated phone records
   */
  static async evaluateAndActivateUserNumbers(
    userId: string,
    triggeredBy: string,
    actorUserId?: string
  ): Promise<any[]> {
    const pendingNumbers = await prisma.phoneNumber.findMany({
      where: { userId, status: 'activation_pending' },
    });

    const activated: any[] = [];

    for (const phone of pendingNumbers) {
      const isKycSatisfied = phone.kycStatus === 'verified' || !phone.aadhaarRequired;
      if (!isKycSatisfied) continue;

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
          reason: 'Auto-activated: number KYC verified or not required',
          triggeredBy,
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

    return activated;
  }
}
