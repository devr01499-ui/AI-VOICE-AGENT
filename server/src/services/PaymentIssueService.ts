/**
 * Payments that need the owner's decision (owner rule 2026-11-23: NO automatic refunds).
 *
 * When a customer has paid but did not get what they paid for (a phone number that could not be
 * set up, a number slot already taken, a price that changed during checkout, or a paid number the
 * reconciliation job finds without a number), nothing is refunded by the system. Instead:
 *   1. the payment is recorded (so it can never be redeemed for something else),
 *   2. an internal PAYMENT_REVIEW alert appears in the admin console (Payments page),
 *   3. the customer is told, in their notification bell, that the payment is safe and the team
 *      will contact them.
 * The owner then either refunds with one click (POST /api/v2/admin/payments/:id/refund, which
 * refunds through Razorpay, closes the case and tells the customer) or closes the case without a
 * refund (e.g. the number was set up by hand).
 */
import { Resend } from 'resend';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { NotificationService } from './NotificationService';

export const PAYMENT_REVIEW_TYPE = 'PAYMENT_REVIEW';

export interface PaymentIssueInput {
  userId: string;
  paymentId: string;
  orderId: string;
  amountInr: number;
  /** Plain-language cause shown to the owner. */
  reason: string;
  source: 'number_purchase' | 'reconciliation';
}

export interface PaymentIssueMeta {
  paymentTransactionId: string | null;
  paymentId: string;
  orderId: string;
  customerId: string;
  amountInr: number;
  reason: string;
  source: string;
}

const inrText = (n: number) => `Rs ${Number(n || 0).toLocaleString('en-IN')}`;

export function parseIssueMeta(raw: string | null): PaymentIssueMeta | null {
  try {
    const m = JSON.parse(raw || '{}');
    return m && typeof m.paymentId === 'string' ? m : null;
  } catch {
    return null;
  }
}

/** Open (unresolved) review cases for a payment. */
export async function openIssuesForPayment(paymentId: string) {
  const rows = await prisma.systemAlert.findMany({
    where: { userId: null, type: PAYMENT_REVIEW_TYPE, isResolved: false, metadata: { contains: `"paymentId":"${paymentId}"` } },
  });
  return rows.filter((r) => parseIssueMeta(r.metadata)?.paymentId === paymentId);
}

/**
 * Records a payment that needs a decision. Idempotent per payment: a second report while a case is
 * open changes nothing (and the customer is told once).
 */
export async function reportPaymentIssue(input: PaymentIssueInput): Promise<{ alertId: string; created: boolean }> {
  // 1. The payment is on record (the number purchase route records it before provisioning; a
  //    payment found only by reconciliation is recorded here).
  let tx = await prisma.paymentTransaction.findFirst({ where: { paymentId: input.paymentId } });
  if (!tx) {
    try {
      tx = await prisma.paymentTransaction.create({
        data: {
          userId: input.userId,
          orderId: input.orderId,
          paymentId: input.paymentId,
          planName: 'phone_number',
          amount: input.amountInr,
          currency: 'INR',
          status: 'completed',
          source: input.source,
        },
      });
    } catch (err: any) {
      if (err?.code !== 'P2002') throw err;
      tx = await prisma.paymentTransaction.findFirst({ where: { OR: [{ paymentId: input.paymentId }, { orderId: input.orderId }] } });
    }
  }

  // 2. One open case per payment.
  const open = await openIssuesForPayment(input.paymentId);
  if (open.length) return { alertId: open[0].id, created: false };

  const customer = await prisma.user.findUnique({ where: { id: input.userId }, select: { email: true } });
  const meta: PaymentIssueMeta = {
    paymentTransactionId: tx?.id || null,
    paymentId: input.paymentId,
    orderId: input.orderId,
    customerId: input.userId,
    amountInr: input.amountInr,
    reason: input.reason,
    source: input.source,
  };
  const alert = await prisma.systemAlert.create({
    data: {
      userId: null, // internal: never shown in any customer's bell
      type: PAYMENT_REVIEW_TYPE,
      title: 'Payment needs your decision',
      message: `${inrText(input.amountInr)} paid by ${customer?.email || input.userId} (payment ${input.paymentId}): ${input.reason}. Refund it, or set the number up by hand and close the case.`,
      severity: 'critical',
      metadata: JSON.stringify(meta),
    },
  });
  logger.error('[ADMIN_ALERT][PAYMENT_REVIEW] a paid purchase was not delivered; waiting for the owner to refund or resolve', {
    alertId: alert.id, userId: input.userId, paymentId: input.paymentId, amountInr: input.amountInr, reason: input.reason,
  });

  // 3. Tell the customer once (their own bell), without promising a refund.
  await NotificationService.createInAppNotification({
    userId: input.userId,
    title: 'We received your payment',
    message: `We received your payment of ${inrText(input.amountInr)}, but your phone number could not be set up yet. Your money is safe and you do not need to pay again: our team will contact you within one working day to set it up or refund you.`,
    severity: 'warning',
    isImportant: true,
  }).catch((err) => logger.warn('[PAYMENT_REVIEW] customer notification failed (non-fatal)', { error: String(err) }));

  return { alertId: alert.id, created: true };
}

/**
 * Closes every open case for a payment (after a refund, or when the owner resolves it by hand).
 */
export async function closeIssuesForPayment(paymentId: string): Promise<number> {
  const open = await openIssuesForPayment(paymentId);
  if (!open.length) return 0;
  const res = await prisma.systemAlert.updateMany({ where: { id: { in: open.map((o) => o.id) } }, data: { isResolved: true } });
  return res.count;
}

/**
 * Tells the customer a refund was issued: notification bell always, email when email is configured.
 * Best effort: a failure here never undoes the refund.
 */
export async function notifyCustomerOfRefund(p: { userId: string; amountInr: number; refundId?: string; planName: string }): Promise<void> {
  const what = p.planName === 'phone_number' ? 'your phone number purchase' : `your ${p.planName} plan`;
  const text = `We have refunded ${inrText(p.amountInr)} for ${what}${p.refundId ? ` (Razorpay refund ${p.refundId})` : ''}. It goes back to the card, UPI or bank account you paid with; banks usually take 5-7 working days to show it.`;
  await NotificationService.createInAppNotification({ userId: p.userId, title: 'Refund issued', message: text, severity: 'info', isImportant: true })
    .catch((err) => logger.warn('[REFUND] customer notification failed (non-fatal)', { error: String(err) }));

  if (!process.env.RESEND_API_KEY) return;
  try {
    const user = await prisma.user.findUnique({ where: { id: p.userId }, select: { email: true, fullName: true } });
    if (!user?.email) return;
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Claritiy Voice <notifications@claritiy.com>',
      to: user.email,
      subject: 'Claritiy Voice: your refund has been issued',
      html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #0F172A;">
        <p>Hello ${escapeHtml(user.fullName || 'there')},</p>
        <p>${escapeHtml(text)}</p>
        <p>If you have any question, reply to this email or write to support@claritiy.com.</p>
      </div>`,
    });
  } catch (err) {
    logger.warn('[REFUND] refund email failed (non-fatal)', { userId: p.userId, error: String(err) });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
