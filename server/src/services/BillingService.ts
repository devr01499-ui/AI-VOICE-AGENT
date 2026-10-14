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
      return {
        ...order,
        id: order.id,
        orderId: order.id,
        keyId: env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || 'rzp_test_TO7mXkVkl4AFCy',
        key: env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || 'rzp_test_TO7mXkVkl4AFCy',
      };
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
   * Attaches authentic userId in notes for strict Object-Level Authorization.
   */
  async createPlanPurchaseOrder(planInput: string | number, userId?: string) {
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
      // Mock order with embedded plan key and user ID for tamper-evident verification
      const mockOrderId = `order_mock_plan_${planKey}_${userId || 'usr'}_${Date.now()}`;
      return {
        id: mockOrderId,
        orderId: mockOrderId,
        amount: amountInPaise,
        currency: 'INR',
        keyId: env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || 'rzp_test_TO7mXkVkl4AFCy',
        key: env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || 'rzp_test_TO7mXkVkl4AFCy',
        mock: true,
      };
    }

    try {
      const receipt = `rcpt_plan_${planKey}_${userId ? userId.slice(0, 8) : 'usr'}_${Date.now()}`;
      const order = await this.razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt,
        notes: {
          userId: userId || '',
          planKey,
        },
      });
      return {
        ...order,
        id: order.id,
        orderId: order.id,
        keyId: env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || 'rzp_test_TO7mXkVkl4AFCy',
        key: env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || 'rzp_test_TO7mXkVkl4AFCy',
      };
    } catch (err: any) {
      logger.error('BillingService: Failed to create plan order', { error: String(err) });
      throw new Error('Payment initialization failed');
    }
  }

  /**
   * Verifies the Razorpay payment signature using timingSafeEqual to prevent side-channel timing attacks.
   */
  verifyPayment(orderId: string, paymentId: string, signature: string): boolean {
    if (!orderId || !paymentId || !signature || typeof signature !== 'string') {
      return false;
    }

    const crypto = require('crypto');
    const secret = env.RAZORPAY_KEY_SECRET;

    if (!secret) {
      if (env.NODE_ENV === 'production') {
        logger.error('BillingService: Mock payment verification rejected in production');
        return false;
      }
      // In development / testing without secret, reject arbitrary forged signatures
      return signature.startsWith('mock_sig_') || signature === 'test_valid_signature';
    }

    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(orderId + '|' + paymentId)
      .digest('hex');

    const sigBuf = Buffer.from(signature, 'utf8');
    const genBuf = Buffer.from(generatedSignature, 'utf8');

    if (sigBuf.length !== genBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuf, genBuf);
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
   * Enforces server-side order price cross-check, Object-Level Authorization,
   * Gateway API status verification, and atomic DB payment replay protection.
   */
  async processPlanPurchase(userId: string, planName: string, paymentId?: string, orderId?: string) {
    const planConfig = getPlanConfig(planName);
    if (!planConfig) {
      throw new Error(`Unknown plan: ${planName}`);
    }

    const accountType = planConfig.accountType;
    const addedMinutes = planConfig.minutes;
    const expectedAmountInPaise = Math.round(planConfig.price * 100);

    // SECURITY CHECK: Validate that the payment order matches the requested plan price & belongs to userId
    if (orderId) {
      if (this.razorpay && !orderId.startsWith('order_mock_')) {
        try {
          const razorpayOrder = await this.razorpay.orders.fetch(orderId);
          if (razorpayOrder) {
            if (razorpayOrder.amount !== expectedAmountInPaise) {
              logger.error('BillingService: Security Alert — Payment order amount does not match requested plan price!', {
                userId,
                planName,
                orderId,
                paidAmountPaise: razorpayOrder.amount,
                expectedAmountPaise: expectedAmountInPaise,
              });
              throw new Error('Payment order amount does not match requested plan price.');
            }

            // Object-Level Authorization (IDOR Defense): Check if order was created for another user
            const orderUserId = razorpayOrder.notes?.userId || razorpayOrder.notes?.user_id;
            if (orderUserId && orderUserId !== userId) {
              logger.error('BillingService: Security Alert — Cross-tenant order redemption attempt blocked!', {
                requestingUserId: userId,
                orderOwnerUserId: orderUserId,
                orderId,
              });
              throw new Error('Unauthorized: This payment order belongs to another account.');
            }
          }
        } catch (err: any) {
          if (err.message === 'Payment order amount does not match requested plan price.' || err.message.includes('Unauthorized')) throw err;
          logger.warn('BillingService: Could not fetch Razorpay order for validation', { orderId, error: String(err) });
        }

        // Server-Side Payment Verification: Verify payment status directly with Gateway API
        if (paymentId && !paymentId.startsWith('pay_mock_')) {
          try {
            const payment = await this.razorpay.payments.fetch(paymentId);
            if (payment) {
              if (payment.status !== 'captured' && payment.status !== 'authorized') {
                logger.error('BillingService: Security Alert — Payment status is not captured/paid!', {
                  paymentId,
                  status: payment.status,
                });
                throw new Error(`Payment verification failed: Payment status is '${payment.status}'. Expected 'captured'.`);
              }
              if (payment.amount !== expectedAmountInPaise) {
                throw new Error('Captured payment amount does not match plan price.');
              }
              if (payment.order_id && payment.order_id !== orderId) {
                throw new Error('Payment order ID does not match specified order.');
              }
              const payUserId = payment.notes?.userId || payment.notes?.user_id;
              if (payUserId && payUserId !== userId) {
                throw new Error('Unauthorized: This payment belongs to another account.');
              }
            }
          } catch (payErr: any) {
            if (payErr.message.includes('Payment verification failed') || payErr.message.includes('does not match') || payErr.message.includes('Unauthorized')) {
              throw payErr;
            }
            logger.warn('BillingService: Could not fetch Razorpay payment for validation', { paymentId, error: String(payErr) });
          }
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

        // Object-Level Authorization on mock order
        const parts = orderId.split('_');
        // Format: order_mock_plan_<planKey>_<userId>_<timestamp>
        if (parts.length >= 6 && parts[4] !== 'usr' && parts[4] !== 'anon' && parts[4] !== userId) {
          logger.error('BillingService: Security Alert — Mock order belongs to different user!', {
            requestingUserId: userId,
            orderUserId: parts[4],
          });
          throw new Error('Unauthorized: This payment order belongs to another account.');
        }
      }
    }

    try {
      const { fulfillPlanPurchase } = await import('./PlanFulfillmentService');
      const effectiveOrderId = orderId || paymentId!;
      const effectivePaymentId = paymentId || orderId!;

      const result = await fulfillPlanPurchase({
        userId,
        orderId: effectiveOrderId,
        paymentId: effectivePaymentId,
        planKey: planName.toLowerCase(),
        source: 'self_serve',
      });

      if (result.isIdempotent) {
        logger.warn('BillingService: Duplicate payment transaction blocked by DB unique constraint', { paymentId, orderId, userId });
        throw new Error('Payment has already been redeemed.');
      }

      logger.info(`BillingService: Provisioned ${planName} for user ${userId}. Added ${addedMinutes} mins (${addedMinutes * 60} seconds).`);
      return true;
    } catch (err: any) {
      if (err.message === 'Payment has already been redeemed.') throw err;
      logger.error('BillingService: Failed to process plan purchase in DB', { error: String(err) });
      throw new Error('Failed to provision account');
    }
  }
}
