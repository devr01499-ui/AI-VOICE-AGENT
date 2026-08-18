import Razorpay from 'razorpay';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

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
      logger.warn('BillingService: Razorpay keys not found, running in mock mode');
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
   */
  async createPlanPurchaseOrder(baseMonthlyCost: number) {
    // Amount in smallest currency unit (e.g., paise for INR)
    const amountInPaise = Math.round(baseMonthlyCost * 100);

    if (amountInPaise < 100) {
      throw new Error('Minimum amount must be at least 100 paise');
    }

    if (!this.razorpay) {
      // Mock order
      return {
        id: `order_mock_plan_${Date.now()}`,
        amount: amountInPaise,
        currency: 'INR',
        mock: true,
      };
    }

    try {
      const order = await this.razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `receipt_plan_${Date.now()}`,
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
    if (!this.razorpay) return true; // Accept all in mock mode

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
   */
  async processPlanPurchase(userId: string, planName: string) {
    let accountType = 'free';
    let addedMinutes = 0;

    switch (planName.toLowerCase()) {
      case 'trial':
        accountType = 'trial';
        addedMinutes = 20;
        break;
      case 'startup':
        accountType = 'developer';
        addedMinutes = 750;
        break;
      case 'growth':
        accountType = 'professional';
        addedMinutes = 2865;
        break;
      case 'enterprise':
        accountType = 'enterprise';
        addedMinutes = 10000;
        break;
      default:
        throw new Error(`Unknown plan: ${planName}`);
    }

    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error('User not found');

      const newBalance = user.callingBalanceMinutes + addedMinutes;

      await prisma.user.update({
        where: { id: userId },
        data: {
          accountType,
          callingBalanceMinutes: newBalance,
        },
      });

      logger.info(`BillingService: Provisioned ${planName} for user ${userId}. Added ${addedMinutes} mins.`);
      return true;
    } catch (err) {
      logger.error('BillingService: Failed to process plan purchase in DB', { error: String(err) });
      throw new Error('Failed to provision account');
    }
  }
}
