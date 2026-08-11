import { VobizIntegrationService } from './VobizIntegrationService';
import { VobizSubAccountService } from './VobizSubAccountService';
import { VobizInventoryService } from './VobizInventoryService';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

export class VobizPhoneNumberService extends VobizIntegrationService {
  
  /**
   * Validates fresh price, creates order idempotently, purchases number, and assigns it.
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
         throw new Error(`Previous purchase attempt failed: ${existingOrder.failureReason}`);
      }
      throw new Error('Purchase is already in progress');
    }

    const order = await prisma.phoneNumberOrder.create({
      data: {
        userId: params.userId,
        internalOrganizationId: 'default', // Map to org if multi-tenant workspace
        idempotencyKey: params.idempotencyKey,
        selectedNumber: 'pending',
        vobizNumberId: params.vobizNumberId,
        priceSnapshot: params.expectedPrice,
        orderStatus: 'validating',
      }
    });

    try {
      // 2. Validate Fresh Price
      const inventoryService = new VobizInventoryService();
      const numberDetails = await inventoryService.getNumberDetails(params.userId, params.vobizNumberId);
      
      const currentTotalMonthlyCost = numberDetails.monthly_fee; // simplified calculation
      if (currentTotalMonthlyCost !== params.expectedPrice) {
        throw new Error('Price or availability has changed. Please refresh and try again.');
      }

      await prisma.phoneNumberOrder.update({
        where: { id: order.id },
        data: { orderStatus: 'purchase_pending', selectedNumber: numberDetails.e164 }
      });

      // 3. Ensure Sub-Account
      const subAccountService = new VobizSubAccountService();
      const subAccount = await subAccountService.getOrCreateSubAccount(params.userId);

      // 4. Purchase into Master Account
      const purchaseEndpoint = `/api/v1/Account/${this.authId}/numbers/purchase-from-inventory`;
      const purchaseRes = await this.request(
        'POST', 
        purchaseEndpoint, 
        { number_id: params.vobizNumberId },
        { userId: params.userId }
      );

      if (!purchaseRes.success) {
        throw new Error(`Provider purchase failed: ${purchaseRes.error}`);
      }

      // 5. Assign to Sub Account
      const assignEndpoint = `/api/v1/account/${this.authId}/numbers/${numberDetails.e164}/assign-subaccount`;
      const assignRes = await this.request(
        'POST',
        assignEndpoint,
        { sub_account_auth_id: subAccount.authId },
        { userId: params.userId }
      );

      if (!assignRes.success) {
        // We bought it, but assignment failed. This requires reconciliation.
        await prisma.phoneNumberOrder.update({
          where: { id: order.id },
          data: { orderStatus: 'reconciliation_required', failureReason: `Assignment failed: ${assignRes.error}` }
        });
        throw new Error(`Number purchased but assignment failed: ${assignRes.error}`);
      }

      // Fund the sub-account wallet so it can make calls
      await subAccountService.transferBalance(subAccount.authId, currentTotalMonthlyCost);

      // 6. Record the purchased number in our database
      const newPhone = await prisma.phoneNumber.create({
        data: {
          userId: params.userId,
          assignedAgentId: params.agentId || null,
          phoneNumber: numberDetails.e164,
          countryCode: numberDetails.country,
          type: 'local',
          telephonyProvider: 'vobiz',
          status: 'inactive', // Active only after KYC if customer_use
          kycStatus: subAccount.kycMode === 'personal_use' ? 'verified' : 'pending',
          monthlyCost: currentTotalMonthlyCost,
        }
      });

      // 7. Mark Order Success
      const successOrder = await prisma.phoneNumberOrder.update({
        where: { id: order.id },
        data: { orderStatus: 'success', providerStatus: 'success' }
      });

      return { order: successOrder, phoneNumber: newPhone };

    } catch (error: any) {
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
