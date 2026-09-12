import Razorpay from 'razorpay';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { getPlanConfig, PLAN_CONFIG } from '../config/plans';

export class BillingService {
  private razorpay: any;

  constructor() {
    if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
      this.razorpay = new Razorpay({
        key_id: env.RAZORPAY_KEY_ID,
        key_secret: env.RAZORPAY_KEY_SECRET,
      });
    } else {
      logger.warn('BillingService: Razorpay keys not found, running in mock mode');
      this.razorpay = null;
    }
  }

  /**
   * Creates a Razorpay order for purchasing a phone number.
   * Calculates total price based on base cost + setup fee.
   */
  async createNumberPurchaseOrder(
    userId: string,
    baseMonthlyCost: number,
    setupFee: number = 0,
    currency: string = 'INR'
  ) {
    const totalCost = (baseMonthlyCost || 0) + (setupFee || 0);
    const finalAmount = Math.max(totalCost, 1);
    const amountInPaise = Math.round(finalAmount * 100);

    if (amountInPaise < 100) {
      throw new Error('Minimum amount must be at least 100 paise (₹1)');
    }

    if (!this.razorpay) {
      if (env.NODE_ENV === 'production') {
        logger.error('BillingService: Attempted mock order creation in production environment without Razorpay keys');
        throw new Error('Payment Gateway Error: Razorpay production credentials missing. Purchase cannot proceed.');
      }
      logger.warn('BillingService: Razorpay keys not found, running in development mock mode');
      return {
        id: `order_mock_${Date.now()}`,
        amount: amountInPaise,
        currency: 'INR',
        mock: true,
      };
    }

    try {
      const order = await this.razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR', // Razorpay India account requires INR
        receipt: `num_${userId.slice(0, 8)}_${Date.now()}`,
      });
      return order;
    } catch (err: any) {
      const errorMsg = err?.description || err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      logger.error('BillingService: Failed to create order in Razorpay', {
        error: errorMsg,
        amountInPaise,
        currency: 'INR',
        userId,
        rawError: err,
      });
      throw new Error(`Razorpay Order Error: ${errorMsg}`);
    }
  }

  /**
   * Creates a Razorpay order for purchasing a subscription plan.
   * Validates plan name server-side against single source of truth (PLAN_CONFIG).
   */
  async createPlanPurchaseOrder(planInput: string | number) {
    let planConfig = null;

    if (typeof planInput === 'string') {
      planConfig = getPlanConfig(planInput);
    } else if (typeof planInput === 'number') {
      planConfig = Object.values(PLAN_CONFIG).find((p) => p.price === planInput) || null;
    }

    if (!planConfig) {
      throw new Error('Invalid or unknown plan name');
    }

    const amountInPaise = Math.round(planConfig.price * 100);

    if (amountInPaise < 100) {
      throw new Error('Minimum amount must be at least 100 paise');
    }

    const planKey = planConfig.name.toLowerCase();

    if (!this.razorpay) {
      if (env.NODE_ENV === 'production') {
        logger.error('BillingService: Attempted mock plan order creation in production environment without Razorpay keys');
        throw new Error('Payment Gateway Error: Razorpay production credentials missing. Plan purchase cannot proceed.');
      }
      // Mock order with embedded plan key for verification validation
      return {
        id: `order_mock_plan_${planKey}_${Date.now()}`,
        amount: amountInPaise,
        currency: 'INR',
        mock: true,
      };
    }

    try {
      const order = await this.razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `receipt_plan_${planKey}_${Date.now()}`,
      });
      return order;
    } catch (err) {
      logger.error('BillingService: Failed to create plan order', { error: String(err) });
      throw new Error('Payment initialization failed');
    }
  }

  /**
   * Verifies the Razorpay payment signature.
   */
  verifyPayment(orderId: string, paymentId: string, signature: string): boolean {
    if (!this.razorpay) {
      if (env.NODE_ENV === 'production') {
        logger.error('BillingService: Mock payment verification rejected in production');
        return false;
      }
      return true; // Accept all in development mock mode
    }

    const crypto = require('crypto');
    const secret = env.RAZORPAY_KEY_SECRET;
    
    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(orderId + '|' + paymentId)
      .digest('hex');

    return generatedSignature === signature;
  }

  /**
   * Refunds a Razorpay payment fully.
   * Called when a post-payment Vobiz purchase failure occurs.
   * The user must NEVER be left charged without a number.
   */
  async refundOrder(paymentId: string, amountInPaise: number): Promise<{ success: boolean; refundId?: string }> {
    if (!this.razorpay) {
      logger.warn('BillingService.refundOrder: Mock mode — refund not executed', { paymentId });
      return { success: true, refundId: `refund_mock_${Date.now()}` };
    }

    try {
      const refund = await this.razorpay.payments.refund(paymentId, {
        amount: amountInPaise,
        speed: 'optimum',
        notes: { reason: 'VOBIZ_PURCHASE_FAILURE - number could not be provisioned' },
      });
      logger.info('BillingService.refundOrder: Refund issued', { paymentId, refundId: refund.id });
      return { success: true, refundId: refund.id };
    } catch (err) {
      logger.error('BillingService.refundOrder: REFUND FAILED — MANUAL ACTION REQUIRED', {
        paymentId,
        error: String(err),
      });
      return { success: false };
    }
  }


  /**
   * Provisions a user's account after a successful plan purchase.
   * Enforces server-side order price cross-check validation and atomic DB payment replay protection.
   */
  async processPlanPurchase(userId: string, planName: string, paymentId?: string, orderId?: string) {
    const planConfig = getPlanConfig(planName);
    if (!planConfig) {
      throw new Error(`Unknown plan: ${planName}`);
    }

    const accountType = planConfig.accountType;
    const addedMinutes = planConfig.minutes;
    const expectedAmountInPaise = Math.round(planConfig.price * 100);

    // SECURITY CHECK: Validate that the payment order matches the requested plan price
    if (orderId) {
      if (this.razorpay && !orderId.startsWith('order_mock_')) {
        try {
          const razorpayOrder = await this.razorpay.orders.fetch(orderId);
          if (razorpayOrder && razorpayOrder.amount !== expectedAmountInPaise) {
            logger.error('BillingService: Security Alert — Payment order amount does not match requested plan price!', {
              userId,
              planName,
              orderId,
              paidAmountPaise: razorpayOrder.amount,
              expectedAmountPaise: expectedAmountInPaise,
            });
            throw new Error('Payment order amount does not match requested plan price.');
          }
        } catch (err: any) {
          if (err.message === 'Payment order amount does not match requested plan price.') throw err;
          logger.warn('BillingService: Could not fetch Razorpay order for validation', { orderId, error: String(err) });
        }
      } else if (orderId.startsWith('order_mock_')) {
        const planKey = planConfig.name.toLowerCase();
        if (!orderId.includes(`_plan_${planKey}_`)) {
          logger.error('BillingService: Security Alert — Mock order plan tag mismatch!', {
            userId,
            planName,
            orderId,
            expectedPlanKey: planKey,
          });
          throw new Error('Payment order amount does not match requested plan price.');
        }
      }
    }

    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error('User not found');

      // Atomic DB Transaction: Insert payment transaction record first to enforce unique constraint
      await prisma.$transaction(async (tx) => {
        if (paymentId || orderId) {
          const effectiveOrderId = orderId || paymentId!;
          const effectivePaymentId = paymentId || orderId!;
          try {
            await tx.paymentTransaction.create({
              data: {
                userId,
                orderId: effectiveOrderId,
                paymentId: effectivePaymentId,
                planName,
              }
            });
          } catch (dbErr: any) {
            if (dbErr.code === 'P2002' || String(dbErr).includes('Unique constraint') || String(dbErr).includes('unique')) {
              logger.warn('BillingService: Duplicate payment transaction blocked by DB unique constraint', { paymentId, orderId, userId });
              throw new Error('Payment has already been redeemed.');
            }
            throw dbErr;
          }
        }

        const newBalanceMinutes = user.callingBalanceMinutes + addedMinutes;
        const newMinutesRemainingSeconds = (user.minutesRemainingSeconds || 0) + (addedMinutes * 60);

        await tx.user.update({
          where: { id: userId },
          data: {
            accountType,
            callingBalanceMinutes: newBalanceMinutes,
            minutesRemainingSeconds: newMinutesRemainingSeconds,
          },
        });
      });

      logger.info(`BillingService: Provisioned ${planName} for user ${userId}. Added ${addedMinutes} mins (${addedMinutes * 60} seconds).`);
      return true;
    } catch (err: any) {
      if (err.message === 'Payment has already been redeemed.') throw err;
      logger.error('BillingService: Failed to process plan purchase in DB', { error: String(err) });
      throw new Error('Failed to provision account');
    }
  }
}
