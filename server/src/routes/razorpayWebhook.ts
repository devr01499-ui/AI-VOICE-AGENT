import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { fulfillPlanPurchase } from '../services/PlanFulfillmentService';
import { prisma } from '../lib/prisma';
import { revokeUserSessions } from '../utils/sessionManager';
import { logAuditEvent } from '../utils/auditLogger';

export const razorpayWebhookRouter = Router();

/**
 * Razorpay Webhook Handler
 * Verifies HMAC-SHA256 signature using raw body, processes payment/subscription events idempotently,
 * and maintains synchronized entitlement and session states.
 */
razorpayWebhookRouter.post('/razorpay', async (req: Request, res: Response): Promise<void> => {
  const signature = req.headers['x-razorpay-signature'] as string;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  const rawBodyBuffer = (req as any).rawBody || Buffer.from(JSON.stringify(req.body));

  // 1. Signature Verification with timingSafeEqual
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

    const sigBuf = Buffer.from(signature, 'utf8');
    const expBuf = Buffer.from(expectedSignature, 'utf8');

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      logger.warn('[RAZORPAY_WEBHOOK] Invalid signature verification failed');
      res.status(400).json({ error: 'Invalid webhook signature' });
      return;
    }
  } else {
    if (process.env.NODE_ENV === 'production') {
      logger.error('[RAZORPAY_WEBHOOK] RAZORPAY_WEBHOOK_SECRET missing in production. Rejecting webhook.');
      res.status(500).json({ error: 'Webhook secret not configured' });
      return;
    }
    logger.warn('[RAZORPAY_WEBHOOK] RAZORPAY_WEBHOOK_SECRET not configured, running in test mode');
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

      let userId = notes.userId || notes.user_id;
      const planKey = notes.planKey || notes.plan_key || notes.plan;
      const source = notes.source || 'self_serve';
      const staffId = notes.staffId || notes.staff_id;

      // Fallback: If userId not directly in notes, look up by customer email
      if (!userId && paymentEntity?.email) {
        const matchedUser = await prisma.user.findUnique({
          where: { email: paymentEntity.email.toLowerCase().trim() },
          select: { id: true },
        });
        if (matchedUser) {
          userId = matchedUser.id;
          logger.info('[RAZORPAY_WEBHOOK] Resolved userId from payment customer email', { userId, email: paymentEntity.email });
        }
      }

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

      await logAuditEvent({
        workspaceOwnerId: userId,
        actorUserId: staffId || userId,
        action: 'billing.payment.captured',
        targetId: paymentId,
        metadata: { orderId, planKey, source },
      });
    } else if (event === 'payment_link.paid') {
      const linkEntity = payload?.payment_link?.entity;
      const paymentEntity = payload?.payment?.entity;

      const razorpayLinkId = linkEntity?.id;
      const paymentId = paymentEntity?.id || `plink_pay_${razorpayLinkId}`;
      const orderId = paymentEntity?.order_id || `plink_ord_${razorpayLinkId}`;
      const notes = linkEntity?.notes || {};

      let userId = notes.userId || notes.user_id;
      const planKey = notes.planKey || notes.plan_key;
      const staffId = notes.staffId || notes.staff_id;

      if (!userId && linkEntity?.customer?.email) {
        const matchedUser = await prisma.user.findUnique({
          where: { email: linkEntity.customer.email.toLowerCase().trim() },
          select: { id: true },
        });
        if (matchedUser) {
          userId = matchedUser.id;
        }
      }

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
          await (prisma as any).paymentLink?.updateMany({
            where: { razorpayLinkId },
            data: { status: 'paid' },
          });
        }

        await logAuditEvent({
          workspaceOwnerId: userId,
          actorUserId: staffId || userId,
          action: 'billing.payment_link.paid',
          targetId: paymentId,
          metadata: { razorpayLinkId, planKey },
        });
      }
    } else if (event === 'subscription.charged') {
      // Recurring subscription period renewed and charged
      const subscriptionEntity = payload?.subscription?.entity;
      const paymentEntity = payload?.payment?.entity;

      const subId = subscriptionEntity?.id;
      const paymentId = paymentEntity?.id || `sub_charge_${subId}_${Date.now()}`;
      const orderId = paymentEntity?.order_id || `sub_ord_${subId}_${Date.now()}`;
      const notes = subscriptionEntity?.notes || paymentEntity?.notes || {};

      let userId = notes.userId || notes.user_id;
      const planKey = notes.planKey || notes.plan_key || 'developer';

      if (!userId && (subscriptionEntity?.customer_email || paymentEntity?.email)) {
        const email = (subscriptionEntity?.customer_email || paymentEntity?.email).toLowerCase().trim();
        const matchedUser = await prisma.user.findUnique({
          where: { email },
          select: { id: true },
        });
        if (matchedUser) {
          userId = matchedUser.id;
        }
      }

      if (userId) {
        await fulfillPlanPurchase({
          userId,
          orderId,
          paymentId,
          planKey,
          source: 'self_serve',
        });

        await logAuditEvent({
          workspaceOwnerId: userId,
          actorUserId: userId,
          action: 'billing.subscription.charged',
          targetId: subId || paymentId,
          metadata: { paymentId, orderId, planKey },
        });

        logger.info('[RAZORPAY_WEBHOOK] Subscription renewed and credited successfully', { subId, userId, planKey });
      } else {
        logger.warn('[RAZORPAY_WEBHOOK] subscription.charged received but could not resolve user identity', { subId });
      }
    } else if (event === 'subscription.cancelled') {
      // Subscription cancelled by customer or admin
      const subscriptionEntity = payload?.subscription?.entity;
      const subId = subscriptionEntity?.id;
      const notes = subscriptionEntity?.notes || {};
      let userId = notes.userId || notes.user_id;

      if (!userId && subscriptionEntity?.customer_email) {
        const matched = await prisma.user.findUnique({
          where: { email: subscriptionEntity.customer_email.toLowerCase().trim() },
          select: { id: true },
        });
        if (matched) userId = matched.id;
      }

      if (userId) {
        // Downgrade account to free tier
        await prisma.user.update({
          where: { id: userId },
          data: { accountType: 'free' },
        });

        // Revoke active sessions so client permissions immediately update
        await revokeUserSessions(userId);

        await logAuditEvent({
          workspaceOwnerId: userId,
          actorUserId: userId,
          action: 'billing.subscription.cancelled',
          targetId: subId || 'unknown',
          metadata: { subId, reason: subscriptionEntity?.cancel_reason || 'user_or_admin_cancelled' },
        });

        logger.info('[RAZORPAY_WEBHOOK] Subscription cancelled and account downgraded to free', { subId, userId });
      }
    } else if (event === 'subscription.paused' || event === 'subscription.halted') {
      // Subscription paused or halted due to payment failures
      const subscriptionEntity = payload?.subscription?.entity;
      const subId = subscriptionEntity?.id;
      const notes = subscriptionEntity?.notes || {};
      let userId = notes.userId || notes.user_id;

      if (!userId && subscriptionEntity?.customer_email) {
        const matched = await prisma.user.findUnique({
          where: { email: subscriptionEntity.customer_email.toLowerCase().trim() },
          select: { id: true },
        });
        if (matched) userId = matched.id;
      }

      if (userId) {
        await prisma.user.update({
          where: { id: userId },
          data: { accountType: 'free' },
        });

        await revokeUserSessions(userId);

        await logAuditEvent({
          workspaceOwnerId: userId,
          actorUserId: userId,
          action: `billing.${event}`,
          targetId: subId || 'unknown',
          metadata: { subId, status: subscriptionEntity?.status },
        });

        logger.warn(`[RAZORPAY_WEBHOOK] Subscription ${event}: Account downgraded and sessions revoked`, { subId, userId });
      }
    } else if (event === 'payment.failed') {
      const paymentEntity = payload?.payment?.entity;
      const paymentId = paymentEntity?.id || 'unknown';
      const orderId = paymentEntity?.order_id || 'unknown';
      const notes = paymentEntity?.notes || {};
      const userId = notes.userId || notes.user_id;

      logger.warn('[RAZORPAY_WEBHOOK] Payment marked as failed by carrier', {
        paymentId,
        errorCode: paymentEntity?.error_code,
        errorDesc: paymentEntity?.error_description,
      });

      if (userId) {
        try {
          await prisma.paymentTransaction.create({
            data: {
              userId,
              orderId: `${orderId}_failed_${Date.now()}`,
              paymentId: `${paymentId}_failed_${Date.now()}`,
              planName: notes.planKey || notes.plan_key || 'unknown',
              amount: ((paymentEntity?.amount || 0) / 100),
              currency: paymentEntity?.currency || 'INR',
              status: 'failed',
              source: 'self_serve',
            },
          });
        } catch (dbErr: any) {
          logger.warn('[RAZORPAY_WEBHOOK] Could not record failed payment transaction', { error: dbErr.message });
        }
      }
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
