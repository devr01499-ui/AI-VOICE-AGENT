import { VobizIntegrationService } from './VobizIntegrationService';
import { VobizInventoryService } from './VobizInventoryService';
import { VobizSubAccountService } from './VobizSubAccountService';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { ProviderError } from '../types/errors';

export class VobizPhoneNumberService extends VobizIntegrationService {
  
  /**
   * Validates fresh price, creates order idempotently, purchases number under master,
   * provisions user sub-account with email naming, explicitly assigns number to sub-account,
   * enforces ZERO auto-funding, and sets status to 'activation_pending'.
   */
  public async purchaseAndAssignNumber(params: {
    userId: string,
    idempotencyKey: string,
    vobizNumberId: string, // ID from the inventory list
    expectedPrice: number,
    agentId?: string,
  }) {
    logger.info('Starting number purchase workflow', { userId: params.userId, numberId: params.vobizNumberId });

    // 1. Idempotency Check & Order Creation
    const existingOrder = await prisma.phoneNumberOrder.findUnique({
      where: { idempotencyKey: params.idempotencyKey }
    });

    if (existingOrder) {
      if (existingOrder.orderStatus === 'success') {
         const existingPhone = await prisma.phoneNumber.findFirst({
           where: { userId: params.userId, phoneNumber: existingOrder.selectedNumber }
         });
         if (!existingPhone) {
           throw new Error('Order is successful but phone number record is missing');
         }
         return { order: existingOrder, phoneNumber: existingPhone };
      }
      if (existingOrder.orderStatus === 'failed') {
         throw new Error('This payment has already been processed but the purchase failed. Please contact support for a refund.');
      }
      throw new Error('Purchase is already in progress. Please wait.');
    }

    const order = await prisma.phoneNumberOrder.create({
      data: {
        userId: params.userId,
        internalOrganizationId: 'default',
        idempotencyKey: params.idempotencyKey,
        selectedNumber: 'pending',
        vobizNumberId: params.vobizNumberId,
        priceSnapshot: params.expectedPrice,
        orderStatus: 'validating',
      }
    });

    try {
      // 2. Validate Fresh Price & Get Number Details
      const inventoryService = new VobizInventoryService();
      const numberDetails = await inventoryService.getNumberDetails(params.userId, params.vobizNumberId);
      
      const currentMonthlyFee = numberDetails.monthly_fee;
      const currentSetupFee = numberDetails.setup_fee || 0;
      const currentTotalCost = currentMonthlyFee + currentSetupFee;

      // If price has changed by more than 0.01 (floating point tolerance), reject
      if (Math.abs(currentMonthlyFee - params.expectedPrice) > 0.01 && Math.abs(currentTotalCost - params.expectedPrice) > 0.01) {
        throw new Error(`Price changed from ₹${params.expectedPrice} to ₹${currentTotalCost}. Please refresh and try again.`);
      }

      await prisma.phoneNumberOrder.update({
        where: { id: order.id },
        data: { orderStatus: 'purchase_pending', selectedNumber: numberDetails.e164 }
      });

      // 3. Provision / Retrieve Sub-Account set with user's email address as name
      const subAccountService = new VobizSubAccountService();
      const user = await prisma.user.findUnique({
        where: { id: params.userId },
        select: { email: true }
      });
      const subAccount = await subAccountService.getOrCreateSubAccount(params.userId, user?.email || undefined);

      // 4. Purchase into Master Account & specify target sub-account
      const purchaseEndpoint = `/api/v1/Account/${this.authId}/numbers/purchase-from-inventory`;
      const purchaseRes = await this.request(
        'POST', 
        purchaseEndpoint, 
        {
          e164: numberDetails.e164,
          currency: numberDetails.currency || 'INR',
          sub_account_auth_id: subAccount.authId,
          subaccount: subAccount.authId,
        },
        { userId: params.userId }
      );

      if (!purchaseRes.success) {
        // Tag this specifically — the route layer needs to detect this to trigger refund
        throw new ProviderError('vobiz', `[VOBIZ_PURCHASE_FAILURE] Provider rejected purchase for ${numberDetails.e164}. Operational error — user should not be blamed.`);
      }

      // 5. Explicitly assign the purchased number to that specific user's sub-account
      await subAccountService.assignNumberToSubAccount(subAccount.authId, numberDetails.e164, numberDetails.id);

      // 6. Calculate next billing date (today + 1 month)
      const nextBillingDate = new Date();
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

      // 7. Record the purchased number in our database with status "activation_pending"
      // Sub-account has ₹0 balance until the founder manually tops it up via Vobiz console.
      const newPhone = await prisma.phoneNumber.create({
        data: {
          userId: params.userId,
          assignedAgentId: params.agentId || null,
          phoneNumber: numberDetails.e164,
          countryCode: numberDetails.country,
          region: numberDetails.region || null,
          type: 'local',
          telephonyProvider: 'vobiz',
          status: 'activation_pending', // Honesty in UI: activation pending manual founder top-up
          kycStatus: numberDetails.aadhaar_verification_required ? 'pending' : 'verified',
          monthlyCost: currentMonthlyFee,
          setupFee: currentSetupFee,
          currency: numberDetails.currency || 'INR',
          aadhaarRequired: numberDetails.aadhaar_verification_required || false,
          vobizNumberId: numberDetails.id,
          nextBillingDate,
        }
      });

      // 8. Mark Order Success
      const successOrder = await prisma.phoneNumberOrder.update({
        where: { id: order.id },
        data: { orderStatus: 'success', providerStatus: 'success' }
      });

      logger.info('[NUMBER_PURCHASE_SUCCESS] Number purchased and assigned to user sub-account', {
        userId: params.userId,
        e164: numberDetails.e164,
        subAuthId: subAccount.authId,
        orderId: order.id,
        status: 'activation_pending',
      });

      return { order: successOrder, phoneNumber: newPhone };

    } catch (err) {
      const error = err as Error;
      await prisma.phoneNumberOrder.update({
        where: { id: order.id },
        data: { 
          orderStatus: 'failed', 
          failureReason: error.message || 'Unknown error' 
        }
      });
      throw error;
    }
  }
}
