import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { fulfillPlanPurchase } from '../services/PlanFulfillmentService';
import { prisma } from '../lib/prisma';
import { revokeUserSessions } from '../utils/sessionManager';
import { logAuditEvent } from '../utils/auditLogger';
import { webhookRateLimiter } from '../middleware/rateLimiter';
import { getPlanConfig } from '../config/plans';
import { BillingService, normaliseNotes } from '../services/BillingService';
import { fulfilCapturedPlanPayment } from '../services/PaymentReconciliationService';
import { MinutesService } from '../services/MinutesService';

export const razorpayWebhookRouter = Router();

// In-flight concurrency claim set and sliding window replay cache (only for events that succeeded)
const inFlightWebhookEvents = new Set<string>();
const razorpayReplayCache = new Map<string, number>();
const REPLAY_TTL_MS = 15 * 60 * 1000; // 15 minutes

function cleanupExpiredRazorpayEvents(): void {
  const now = Date.now();
  for (const [key, expiresAt] of razorpayReplayCache.entries()) {
    if (now >= expiresAt) razorpayReplayCache.delete(key);
  }
}

/** Clears the in-memory caches for automated testing. */
export function clearRazorpayReplayCacheForTesting(): void {
  inFlightWebhookEvents.clear();
  razorpayReplayCache.clear();
}

/** A failure Razorpay should retry (we answer 5xx so it re-sends the event later). */
class RetryableWebhookError extends Error {}

/** The webhook secret. A built-in test secret exists ONLY when NODE_ENV is "test". */
function webhookSecret(): string | undefined {
  if (process.env.RAZORPAY_WEBHOOK_SECRET) return process.env.RAZORPAY_WEBHOOK_SECRET;
  return process.env.NODE_ENV === 'test' ? 'test_webhook_secret' : undefined;
}

function sameAmount(paise: unknown, inr: number): boolean {
  return Number.isInteger(Number(paise)) && Number(paise) === Math.round(inr * 100);
}

/**
 * Plan payment captured (payment.captured / order.paid). The user, plan and purpose come from the
 * order notes the server set when it created the order (Razorpay sends empty notes as [], and
 * payment.captured carries no order notes, so the order is fetched when needed). The paid amount
 * must equal the plan price, in INR, captured. Number payments are provisioned by the purchase
 * route, not here.
 */
async function handlePaymentCaptured(event: string, payload: any, eventId: string | null): Promise<void> {
  const paymentEntity = payload?.payment?.entity || {};
  const orderEntity = payload?.order?.entity || {};
  const paymentId: string | undefined = paymentEntity.id;
  const orderId: string | undefined = paymentEntity.order_id || orderEntity.id;
  if (!paymentId || !orderId) {
    logger.warn('[RAZORPAY_WEBHOOK] captured payment without payment/order id; ignored', { event });
    return;
  }

  // Only the ORDER's notes count: the server wrote them. Payment notes can be set by the browser's
  // checkout script and are never trusted.
  let notes = orderEntity.id === orderId ? normaliseNotes(orderEntity.notes) : {};
  if (!notes.userId || !(notes.planKey || notes.purpose)) {
    try {
      notes = (await new BillingService().fetchOrder(orderId)).notes;
    } catch (err: any) {
      throw new RetryableWebhookError(`could not fetch order ${orderId}: ${err?.message || err}`);
    }
  }

  await fulfilCapturedPlanPayment({
    paymentId,
    orderId,
    amountPaise: Number(paymentEntity.amount),
    currency: String(paymentEntity.currency || 'INR'),
    status: paymentEntity.status,
    notes,
    via: 'webhook',
  });
}

async function handlePaymentLinkPaid(payload: any): Promise<void> {
  const linkEntity = payload?.payment_link?.entity || {};
  const paymentEntity = payload?.payment?.entity || {};
  const razorpayLinkId: string | undefined = linkEntity.id;
  if (!razorpayLinkId || !paymentEntity.id) return;
  // The staff-created link row is the source of truth for who pays what.
  const link = await prisma.paymentLink.findFirst({ where: { razorpayLinkId } });
  if (!link || !link.planKey) {
    logger.error('[RAZORPAY_WEBHOOK] payment_link.paid for an unknown link or link without plan; NOT fulfilled', { razorpayLinkId });
    return;
  }
  if ((paymentEntity.currency || 'INR') !== 'INR' || !sameAmount(paymentEntity.amount, Number(link.amountInr))) {
    logger.error('[RAZORPAY_WEBHOOK] Security alert: payment link amount mismatch; NOT fulfilled', { razorpayLinkId, paidPaise: paymentEntity.amount, linkInr: link.amountInr });
    return;
  }
  await fulfillPlanPurchase({
    userId: link.userId,
    orderId: paymentEntity.order_id || `plink_ord_${razorpayLinkId}`,
    paymentId: paymentEntity.id,
    planKey: link.planKey,
    source: 'admin',
    staffId: link.createdByStaffId || undefined,
    razorpayLinkId,
    amountOverrideInr: Number(link.amountInr),
  });
  await prisma.paymentLink.updateMany({ where: { razorpayLinkId }, data: { status: 'paid' } });
  await logAuditEvent({
    workspaceOwnerId: link.userId,
    actorUserId: link.createdByStaffId || link.userId,
    action: 'billing.payment_link.paid',
    targetId: paymentEntity.id,
    metadata: { razorpayLinkId, planKey: link.planKey },
  });
}

async function handleSubscriptionCharged(payload: any): Promise<void> {
  const subscriptionEntity = payload?.subscription?.entity || {};
  const paymentEntity = payload?.payment?.entity || {};
  const notes = normaliseNotes(subscriptionEntity.notes); // server-side subscription notes only
  const userId = notes.userId || notes.user_id;
  const planConfig = getPlanConfig(notes.planKey || notes.plan_key || '');
  if (!userId || !planConfig || !paymentEntity.id) {
    logger.error('[RAZORPAY_WEBHOOK] subscription.charged without user/plan/payment; NOT credited', { subId: subscriptionEntity.id });
    return;
  }
  if ((paymentEntity.currency || 'INR') !== 'INR' || !sameAmount(paymentEntity.amount, planConfig.price)) {
    logger.error('[RAZORPAY_WEBHOOK] Security alert: subscription charge amount mismatch; NOT credited', { subId: subscriptionEntity.id, paidPaise: paymentEntity.amount });
    return;
  }
  const planKey = String(notes.planKey || notes.plan_key).toLowerCase();
  await fulfillPlanPurchase({
    userId,
    orderId: paymentEntity.order_id || `sub_ord_${subscriptionEntity.id}_${paymentEntity.id}`,
    paymentId: paymentEntity.id,
    planKey,
    source: 'self_serve',
  });
  await logAuditEvent({
    workspaceOwnerId: userId,
    actorUserId: userId,
    action: 'billing.subscription.charged',
    targetId: subscriptionEntity.id || paymentEntity.id,
    metadata: { paymentId: paymentEntity.id, planKey },
  });
}

async function handleSubscriptionEnded(event: string, payload: any): Promise<void> {
  const subscriptionEntity = payload?.subscription?.entity || {};
  const subId = subscriptionEntity.id;
  const userId = normaliseNotes(subscriptionEntity.notes).userId;
  if (!userId) {
    logger.warn(`[RAZORPAY_WEBHOOK] ${event} without userId in notes; ignored`, { subId });
    return;
  }
  await prisma.user.update({ where: { id: userId }, data: { accountType: 'free' } });
  await revokeUserSessions(userId);
  await logAuditEvent({
    workspaceOwnerId: userId,
    actorUserId: userId,
    action: event === 'subscription.cancelled' ? 'billing.subscription.cancelled' : `billing.${event}`,
    targetId: subId || 'unknown',
    metadata: { subId, status: subscriptionEntity.status, reason: subscriptionEntity.cancel_reason },
  });
  logger.warn(`[RAZORPAY_WEBHOOK] ${event}: account downgraded and sessions revoked`, { subId, userId });
}

async function handlePaymentFailed(payload: any): Promise<void> {
  const paymentEntity = payload?.payment?.entity || {};
  logger.warn('[RAZORPAY_WEBHOOK] payment failed', {
    paymentId: paymentEntity.id,
    orderId: paymentEntity.order_id,
    errorCode: paymentEntity.error_code,
    errorDesc: paymentEntity.error_description,
  });
}

/** refund.processed only (refund.created for the same refund would count it twice). */
async function handleRefundProcessed(payload: any): Promise<void> {
  const refundEntity = payload?.refund?.entity || {};
  const paymentId: string | undefined = refundEntity.payment_id;
  if (!paymentId) return;
  const tx = await prisma.paymentTransaction.findFirst({ where: { paymentId } });
  if (!tx) {
    logger.warn('[RAZORPAY_WEBHOOK] refund for a payment we have no record of', { paymentId });
    return;
  }
  const refundedAmount = Number(tx.refundedAmount || 0) + Number(refundEntity.amount || 0) / 100;
  const fully = tx.amount != null && refundedAmount + 0.001 >= Number(tx.amount);
  await prisma.paymentTransaction.update({
    where: { id: tx.id },
    data: { refundedAmount, status: fully ? 'refunded' : 'partially_refunded' },
  });
  logger.info('[RAZORPAY_WEBHOOK] refund recorded', { paymentId, refundedAmount });

  // A refunded PLAN takes back its minutes (audit #19: the minutes stayed). The share follows the
  // refunded amount; never more than the customer still has (used minutes are flagged instead).
  // A full refund also ends the plan, so the number is released after the usual grace period.
  if (tx.planName === 'phone_number') return;
  const credit = await prisma.minutesLedger.findUnique({ where: { idempotencyKey: `plan_purchase_${paymentId}` } });
  const thisRefundInr = Number(refundEntity.amount || 0) / 100;
  if (credit && credit.deltaSeconds > 0 && tx.amount && thisRefundInr > 0) {
    const share = Math.min(1, thisRefundInr / Number(tx.amount));
    const target = Math.round(credit.deltaSeconds * share);
    const owner = await prisma.user.findUnique({ where: { id: tx.userId }, select: { minutesRemainingSeconds: true } });
    const take = Math.min(target, Math.max(0, Math.floor(Number(owner?.minutesRemainingSeconds) || 0)));
    if (take > 0) {
      await MinutesService.debit({
        userId: tx.userId,
        deltaSeconds: take,
        reason: 'refund',
        refType: 'payment_refund',
        refId: String(refundEntity.id || paymentId),
        note: `Plan payment refunded (Rs ${thisRefundInr}); minutes taken back`,
        actorType: 'system',
        idempotencyKey: `plan_refund_${refundEntity.id || `${paymentId}_${refundedAmount}`}`,
      });
    }
    if (take < target) {
      logger.error('[ADMIN_ALERT][PAYMENTS] plan refunded after its minutes were used; review the refund', { paymentId, userId: tx.userId, minutesToReverse: target / 60, minutesReversed: take / 60 });
    }
  }
  if (fully) {
    await prisma.user.update({ where: { id: tx.userId }, data: { planExpiresAt: new Date() } }).catch(() => {});
  }
}

/**
 * Razorpay webhook. Signature (HMAC-SHA256 of the raw body, constant-time compare) is checked
 * first and fails closed. Each event is processed BEFORE answering: 200 when done (or ignored on
 * purpose), 500 when a retry may help, so Razorpay re-sends it. Processed events are recorded and
 * never applied twice.
 */
razorpayWebhookRouter.post('/razorpay', webhookRateLimiter, async (req: Request, res: Response): Promise<void> => {
  const signature = req.headers['x-razorpay-signature'];
  const secret = webhookSecret();
  if (!secret) {
    logger.error('[RAZORPAY_WEBHOOK] RAZORPAY_WEBHOOK_SECRET is not configured. Rejecting webhook.');
    res.status(500).json({ error: 'Webhook secret not configured' });
    return;
  }
  if (!signature || typeof signature !== 'string') {
    res.status(400).json({ error: 'Missing signature header' });
    return;
  }
  const rawBody: Buffer | undefined = (req as any).rawBody;
  if (!rawBody) {
    res.status(400).json({ error: 'Missing body' });
    return;
  }
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    logger.warn('[RAZORPAY_WEBHOOK] Invalid signature');
    res.status(400).json({ error: 'Invalid webhook signature' });
    return;
  }

  const event: string = req.body?.event;
  const payload = req.body?.payload;
  const headerId = req.headers['x-razorpay-event-id'];
  const eventId: string | null =
    (typeof headerId === 'string' && headerId) ||
    req.body?.id ||
    (payload?.payment?.entity?.id ? `evt_${event}_${payload.payment.entity.id}` : null) ||
    (payload?.refund?.entity?.id ? `evt_${event}_${payload.refund.entity.id}` : null);

  cleanupExpiredRazorpayEvents();
  if (eventId && (razorpayReplayCache.has(eventId) || inFlightWebhookEvents.has(eventId))) {
    res.status(200).json({ status: 'ok', idempotent: true });
    return;
  }
  if (eventId) inFlightWebhookEvents.add(eventId);

  try {
    if (eventId) {
      const already = await prisma.auditLog.findFirst({ where: { action: 'billing.webhook.event_processed', targetId: eventId }, select: { id: true } });
      if (already) {
        razorpayReplayCache.set(eventId, Date.now() + REPLAY_TTL_MS);
        res.status(200).json({ status: 'ok', idempotent: true });
        return;
      }
    }

    if (event === 'payment.captured' || event === 'order.paid') await handlePaymentCaptured(event, payload, eventId);
    else if (event === 'payment_link.paid') await handlePaymentLinkPaid(payload);
    else if (event === 'subscription.charged') await handleSubscriptionCharged(payload);
    else if (event === 'subscription.cancelled' || event === 'subscription.paused' || event === 'subscription.halted') await handleSubscriptionEnded(event, payload);
    else if (event === 'payment.failed') await handlePaymentFailed(payload);
    else if (event === 'refund.processed') await handleRefundProcessed(payload);
    else logger.info('[RAZORPAY_WEBHOOK] event ignored', { event });

    if (eventId) {
      await prisma.auditLog.create({
        data: {
          workspaceOwnerId: 'system',
          actorUserId: 'razorpay',
          action: 'billing.webhook.event_processed',
          targetId: eventId,
          metadata: { event },
        },
      }).catch((err: any) => logger.warn('[RAZORPAY_WEBHOOK] could not record processed event', { eventId, error: err?.message }));
      razorpayReplayCache.set(eventId, Date.now() + REPLAY_TTL_MS);
    }
    res.status(200).json({ status: 'ok' });
  } catch (err: any) {
    const retryable = err instanceof RetryableWebhookError || !(err instanceof Error && /INVALID_PLAN|USER_NOT_FOUND|Unauthorized|already been redeemed/.test(err.message));
    logger.error('[RAZORPAY_WEBHOOK_ERROR] failed processing event', { event, eventId, retryable, error: err?.message });
    if (retryable) res.status(500).json({ error: 'Temporary processing error' });
    else res.status(200).json({ status: 'ignored' });
  } finally {
    if (eventId) inFlightWebhookEvents.delete(eventId);
  }
});
