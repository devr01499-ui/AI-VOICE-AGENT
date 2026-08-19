import { VobizIntegrationService } from './VobizIntegrationService';
import { VobizInventoryService } from './VobizInventoryService';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { ProviderError } from '../types/errors';

export class VobizPhoneNumberService extends VobizIntegrationService {
  
  /**
   * Validates fresh price, creates order idempotently, purchases number, and assigns it.
   * 
   * Failure contract:
   * - If Vobiz purchase fails AFTER payment, we throw ProviderError (tagged [VOBIZ_PURCHASE_FAILURE])
   *   so the route layer can issue a refund and alert ops.
   * - The order record is always left in a terminal state (success | failed).
   * - No raw Vobiz error strings leave this service boundary.
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

      // 3. Purchase into Master Account (ADR-004: standard API, master account purchase)
      const purchaseEndpoint = `/api/v1/Account/${this.authId}/numbers/purchase-from-inventory`;
      const purchaseRes = await this.request(
        'POST', 
        purchaseEndpoint, 
        { e164: numberDetails.e164, currency: numberDetails.currency || 'INR' },
        { userId: params.userId }
      );

      if (!purchaseRes.success) {
        // Tag this specifically — the route layer needs to detect this to trigger refund
        throw new ProviderError('vobiz', `[VOBIZ_PURCHASE_FAILURE] Provider rejected purchase for ${numberDetails.e164}. Operational error — user should not be blamed.`);
      }

      // 4. Calculate next billing date (today + 1 month)
      const nextBillingDate = new Date();
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

      // 5. Record the purchased number in our database
      const newPhone = await prisma.phoneNumber.create({
        data: {
          userId: params.userId,
          assignedAgentId: params.agentId || null,
          phoneNumber: numberDetails.e164,
          countryCode: numberDetails.country,
          region: numberDetails.region || null,
          type: 'local',
          telephonyProvider: 'vobiz',
          status: 'active',
          kycStatus: numberDetails.aadhaar_verification_required ? 'pending' : 'verified',
          monthlyCost: currentMonthlyFee,
          setupFee: currentSetupFee,
          currency: numberDetails.currency || 'INR',
          aadhaarRequired: numberDetails.aadhaar_verification_required || false,
          vobizNumberId: numberDetails.id,
          nextBillingDate,
        }
      });

      // 6. Mark Order Success
      const successOrder = await prisma.phoneNumberOrder.update({
        where: { id: order.id },
        data: { orderStatus: 'success', providerStatus: 'success' }
      });

      logger.info('[NUMBER_PURCHASE_SUCCESS] Number purchased and assigned', {
        userId: params.userId,
        e164: numberDetails.e164,
        orderId: order.id,
        nextBillingDate,
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
