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
   * Calculates price based on base cost + Claritiy margin.
   */
  async createNumberPurchaseOrder(userId: string, baseMonthlyCost: number) {
    const margin = 2.0; // 2 USD / equivalent margin
    const totalAmount = baseMonthlyCost + margin; 
    
    // Amount in smallest currency unit (e.g., paise for INR)
    const amountInPaise = Math.round(totalAmount * 100);

    if (amountInPaise < 100) {
      throw new Error('Minimum amount must be at least 100 paise');
    }

    if (!this.razorpay) {
      // Mock order
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
        currency: 'INR',
        receipt: `receipt_${userId}_${Date.now()}`,
      });
      return order;
    } catch (err) {
      logger.error('BillingService: Failed to create order', { error: String(err) });
      throw new Error('Payment initialization failed');
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
}
