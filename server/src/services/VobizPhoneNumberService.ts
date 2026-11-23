import { VobizIntegrationService } from './VobizIntegrationService';
import { VobizInventoryService } from './VobizInventoryService';
import { VobizSubAccountService } from './VobizSubAccountService';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { ProviderError } from '../types/errors';
import { NotificationService } from './NotificationService';
import { ownedAgentIdOrNull } from '../utils/agentOwnership';

export class VobizPhoneNumberService extends VobizIntegrationService {
  
  /**
   * Validates fresh price, creates order idempotently, purchases number under master,
   * provisions user sub-account with email naming, explicitly assigns number to sub-account,
   * and activates the number once it is assigned (no manual funding step).
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
      if (existingOrder.orderStatus === 'resolved') {
         throw new Error('Our support team has already closed this purchase (refunded or set up by hand). Please check your email or contact support.');
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

      // If price has changed by more than 0.01 (floating point tolerance), reject (unless bundled claim where expectedPrice is 0)
      if (params.expectedPrice > 0 && Math.abs(currentMonthlyFee - params.expectedPrice) > 0.01 && Math.abs(currentTotalCost - params.expectedPrice) > 0.01) {
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
          // Documented body (Vobiz Purchase from Inventory): e164 + currency. The number lands in the
          // master pool (master is charged setup + monthly fee) and is then assigned below.
          e164: numberDetails.e164,
          currency: numberDetails.currency || 'INR',
        },
        { userId: params.userId }
      );

      if (!purchaseRes.success) {
        // Tag this specifically — the route layer needs to detect this to trigger refund
        throw new ProviderError('vobiz', `[VOBIZ_PURCHASE_FAILURE] Provider rejected purchase for ${numberDetails.e164}. Operational error — user should not be blamed.`);
      }

      // 5. Explicitly assign the purchased number to that specific user's sub-account
      const assignResult = await subAccountService.assignNumberToSubAccount(subAccount.authId, numberDetails.e164, numberDetails.id);

      if (!assignResult || !assignResult.success) {
        const failureReason = `Number purchased from inventory, but sub-account DID assignment failed: ${(assignResult as any)?.error || (assignResult as any)?.status || 'unknown'}`;
        
        await prisma.phoneNumberOrder.update({
          where: { id: order.id },
          data: {
            orderStatus: 'assignment_failed',
            providerStatus: 'assignment_failed',
            failureReason,
          }
        });

        logger.error('[CRITICAL_ADMIN_ALERT] Number assignment failed after purchase', {
          orderId: order.id,
          userId: params.userId,
          subAuthId: subAccount.authId,
          e164: numberDetails.e164,
          assignResult,
        });

        // Internal operations alert for the admin console (type FAILED_PROVISIONING). It has no owner,
        // so it is never shown in any customer's bell (only ANNOUNCEMENT rows are shared).
        NotificationService.createInAppNotification({
          userId: null,
          type: 'FAILED_PROVISIONING',
          title: 'Number assignment failed',
          severity: 'critical',
          metadata: { orderId: order.id, userId: params.userId, e164: numberDetails.e164 },
          message: `🚨 ADMIN ALERT: Phone number ${numberDetails.e164} was purchased but assignment to sub-account ${subAccount.authId} failed (Order #${order.id}). Manual intervention required in Vobiz console.`,
          isImportant: true,
        });

        // Do not tell the user it is done
        throw new ProviderError(
          'vobiz',
          `Number ${numberDetails.e164} was reserved, but could not be assigned to your sub-account. Our engineering team has been alerted (Order ID: ${order.id}).`
        );
      }

      // 6. Calculate next billing date (today + 1 month)
      const nextBillingDate = new Date();
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

      // 7. Record the number, then activate it (no manual top-up: a sub-account uses the master
      // ledger). A number that needs its own Aadhaar KYC stays pending until that is verified.
      const newPhone = await prisma.phoneNumber.create({
        data: {
          userId: params.userId,
          assignedAgentId: await ownedAgentIdOrNull(params.userId, params.agentId), // tenant isolation
          phoneNumber: numberDetails.e164,
          countryCode: numberDetails.country,
          region: numberDetails.region || null,
          type: 'local',
          telephonyProvider: 'vobiz',
          status: 'activation_pending',
          kycStatus: numberDetails.aadhaar_verification_required ? 'pending' : 'verified',
          monthlyCost: currentMonthlyFee,
          setupFee: currentSetupFee,
          currency: numberDetails.currency || 'INR',
          aadhaarRequired: numberDetails.aadhaar_verification_required || false,
          vobizNumberId: numberDetails.id,
          nextBillingDate,
        }
      });

      const { PhoneNumberActivationService } = await import('./PhoneNumberActivationService');
      await PhoneNumberActivationService.evaluateAndActivateUserNumbers(params.userId, 'purchase');
      const activePhone = (await prisma.phoneNumber.findUnique({ where: { id: newPhone.id } })) || newPhone;

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
        status: activePhone.status,
      });

      return { order: successOrder, phoneNumber: activePhone };

    } catch (err: any) {
      const error = err as any;
      const currentOrder = await prisma.phoneNumberOrder.findUnique({ where: { id: order.id } });
      const finalOrderStatus = currentOrder?.orderStatus === 'assignment_failed' ? 'assignment_failed' : 'failed';
      await prisma.phoneNumberOrder.update({
        where: { id: order.id },
        data: { 
          orderStatus: finalOrderStatus, 
          failureReason: error.message || 'Unknown error' 
        }
      }).catch(() => {});
      error.orderId = order.id;
      throw error;
    }
  }
}
