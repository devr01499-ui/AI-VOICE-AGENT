import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { fulfillPlanPurchase } from '../services/PlanFulfillmentService';
import { prisma } from '../lib/prisma';

export const razorpayWebhookRouter = Router();

/**
 * Razorpay Webhook Handler
 * Verifies HMAC-SHA256 signature, processes payment events idempotently, and credits minutes.
 */
razorpayWebhookRouter.post('/razorpay', async (req: Request, res: Response): Promise<void> => {
  const signature = req.headers['x-razorpay-signature'] as string;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  const rawBodyBuffer = (req as any).rawBody || Buffer.from(JSON.stringify(req.body));

  // 1. Signature Verification
  if (webhookSecret) {
    if (!signature) {
      logger.warn('[RAZORPAY_WEBHOOK] Missing X-Razorpay-Signature header');
      res.status(400).json({ error: 'Missing signature header' });
      return;
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBodyBuffer)
      .digest('hex');

    if (expectedSignature !== signature) {
      logger.warn('[RAZORPAY_WEBHOOK] Invalid signature verification failed');
      res.status(400).json({ error: 'Invalid webhook signature' });
      return;
    }
  } else {
    logger.warn('[RAZORPAY_WEBHOOK] RAZORPAY_WEBHOOK_SECRET not configured, proceeding in test mode');
  }

  // 2. Respond 200 immediately to acknowledge receipt to Razorpay
  res.status(200).json({ status: 'ok' });

  // 3. Process event asynchronously
  try {
    const event = req.body?.event;
    const payload = req.body?.payload;

    logger.info('[RAZORPAY_WEBHOOK] Received event', { event });

    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = payload?.payment?.entity;
      const orderEntity = payload?.order?.entity;

      const paymentId = paymentEntity?.id || payload?.payment?.id;
      const orderId = paymentEntity?.order_id || orderEntity?.id || paymentId;
      const notes = paymentEntity?.notes || orderEntity?.notes || {};

      const userId = notes.userId || notes.user_id;
      const planKey = notes.planKey || notes.plan_key || notes.plan;
      const source = notes.source || 'self_serve';
      const staffId = notes.staffId || notes.staff_id;

      if (!userId || !planKey) {
        logger.warn('[RAZORPAY_WEBHOOK] Payment captured but missing userId or planKey in notes', {
          paymentId,
          orderId,
          notes,
        });
        return;
      }

      await fulfillPlanPurchase({
        userId,
        orderId,
        paymentId,
        planKey,
        source: source === 'admin' ? 'admin' : 'self_serve',
        staffId,
      });
    } else if (event === 'payment_link.paid') {
      const linkEntity = payload?.payment_link?.entity;
      const paymentEntity = payload?.payment?.entity;

      const razorpayLinkId = linkEntity?.id;
      const paymentId = paymentEntity?.id || `plink_pay_${razorpayLinkId}`;
      const orderId = paymentEntity?.order_id || `plink_ord_${razorpayLinkId}`;
      const notes = linkEntity?.notes || {};

      const userId = notes.userId || notes.user_id;
      const planKey = notes.planKey || notes.plan_key;
      const staffId = notes.staffId || notes.staff_id;

      if (userId && planKey) {
        await fulfillPlanPurchase({
          userId,
          orderId,
          paymentId,
          planKey,
          source: 'admin',
          staffId,
          razorpayLinkId,
        });

        // Update PaymentLink status to paid
        if (razorpayLinkId) {
          await prisma.paymentLink.updateMany({
            where: { razorpayLinkId },
            data: { status: 'paid' },
          });
        }
      }
    } else if (event === 'payment.failed') {
      const paymentEntity = payload?.payment?.entity;
      logger.warn('[RAZORPAY_WEBHOOK] Payment marked as failed by carrier', {
        paymentId: paymentEntity?.id,
        errorCode: paymentEntity?.error_code,
        errorDesc: paymentEntity?.error_description,
      });
    } else if (event === 'refund.processed' || event === 'refund.created') {
      const refundEntity = payload?.refund?.entity;
      const paymentId = refundEntity?.payment_id;
      const refundedAmount = (refundEntity?.amount || 0) / 100; // Razorpay amounts in paise

      if (paymentId) {
        await prisma.paymentTransaction.updateMany({
          where: { paymentId },
          data: {
            status: 'refunded',
            refundedAmount: { increment: refundedAmount },
          },
        });
        logger.info('[RAZORPAY_WEBHOOK] Refund processed and recorded', { paymentId, refundedAmount });
      }
    }
  } catch (err: any) {
    logger.error('[RAZORPAY_WEBHOOK_ERROR] Failed processing webhook payload', { error: err.message });
  }
});
