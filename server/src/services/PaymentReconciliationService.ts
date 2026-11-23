import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { getPlanConfig } from '../config/plans';
import { fulfillPlanPurchase } from './PlanFulfillmentService';
import { BillingService, planTermsFromOrderNotes } from './BillingService';
import { logAuditEvent } from '../utils/auditLogger';

/**
 * One rule set for "a plan payment was captured", used by the Razorpay webhook and by the
 * reconciliation job, so both grant exactly the same thing under exactly the same checks:
 * order notes set by the server (userId, purpose=plan, planKey), INR, captured, amount equal to
 * the plan price. Idempotent (fulfillPlanPurchase keys on the unique order/payment ids).
 */
export type CapturedOutcome = 'fulfilled' | 'already_fulfilled' | 'number_payment' | 'not_captured' | 'rejected';

export async function fulfilCapturedPlanPayment(p: {
  paymentId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  status?: string;
  notes: Record<string, string>;
  via: 'webhook' | 'reconciliation';
}): Promise<CapturedOutcome> {
  const purpose = p.notes.purpose || (p.notes.planKey ? 'plan' : '');
  if (purpose === 'number') return 'number_payment';
  const userId = p.notes.userId;
  const planConfig = getPlanConfig(p.notes.planKey || '');
  if (purpose !== 'plan' || !userId || !planConfig) {
    logger.error('[PAYMENTS] captured payment is not a known plan order; NOT fulfilled', { orderId: p.orderId, paymentId: p.paymentId, purpose, hasUser: Boolean(userId), via: p.via });
    return 'rejected';
  }
  if (p.status && p.status !== 'captured') return 'not_captured';
  // The price and minutes stamped on the order at checkout (an admin edit since then does not matter).
  const terms = planTermsFromOrderNotes(p.notes, planConfig);
  if ((p.currency || 'INR') !== 'INR' || !Number.isInteger(p.amountPaise) || p.amountPaise !== terms.pricePaise) {
    logger.error('[PAYMENTS] Security alert: paid amount/currency does not match the plan; NOT fulfilled', {
      orderId: p.orderId, paymentId: p.paymentId, paidPaise: p.amountPaise, currency: p.currency, expectedPaise: terms.pricePaise, via: p.via,
    });
    return 'rejected';
  }
  const planKey = String(p.notes.planKey).toLowerCase();
  const result = await fulfillPlanPurchase({
    userId, orderId: p.orderId, paymentId: p.paymentId, planKey, source: 'self_serve',
    amountOverrideInr: terms.pricePaise / 100,
    minutesOverride: terms.minutes,
  });
  if (result.isIdempotent) return 'already_fulfilled';
  await logAuditEvent({
    workspaceOwnerId: userId,
    actorUserId: userId,
    action: 'billing.payment.captured',
    targetId: p.paymentId,
    metadata: { orderId: p.orderId, planKey, via: p.via },
  });
  if (p.via === 'reconciliation') {
    logger.warn('[PAYMENTS] reconciliation activated a paid plan the checkout and webhook had missed', { userId, orderId: p.orderId, paymentId: p.paymentId });
  }
  return 'fulfilled';
}

export interface ReconciliationReport {
  checked: number;
  fulfilled: number;
  alreadyRecorded: number;
  /** Paid numbers with no provisioning record after the grace period: need a person (assign or refund). */
  unprovisionedNumberPayments: Array<{ paymentId: string; orderId: string; userId?: string; amountInr: number }>;
  rejected: number;
  errors: number;
}

/** Number payments younger than this may still be completing in the browser. */
const NUMBER_GRACE_MS = 30 * 60 * 1000;

/**
 * Lists payments Razorpay captured in the look-back window and makes sure each one was
 * fulfilled: plans are activated (same checks as the webhook); paid numbers with no record are
 * reported for a person to assign or refund. Safe to run often and from several servers.
 */
export async function runPaymentReconciliation(opts: { lookbackHours?: number; now?: number } = {}): Promise<ReconciliationReport> {
  const report: ReconciliationReport = { checked: 0, fulfilled: 0, alreadyRecorded: 0, unprovisionedNumberPayments: [], rejected: 0, errors: 0 };
  const billing = new BillingService();
  if (!billing.hasGateway()) return report;

  const now = opts.now ?? Date.now();
  const from = Math.floor((now - (opts.lookbackHours ?? 48) * 3600 * 1000) / 1000);
  const payments = await billing.listCapturedPayments(from, Math.floor(now / 1000));

  for (const pay of payments) {
    report.checked++;
    try {
      const recorded = await prisma.paymentTransaction.findFirst({
        where: { OR: [{ paymentId: pay.id }, { orderId: pay.order_id || '__none__' }] },
        select: { id: true, planName: true, status: true, userId: true, orderId: true },
      });
      if (recorded) {
        // A recorded NUMBER payment is only done when its order provisioned a number (or it was
        // refunded). Number orders use the payment's order id as their idempotency key (audit #4).
        if (recorded.planName === 'phone_number' && recorded.status !== 'refunded') {
          const createdMs = Number(pay.created_at || 0) * 1000;
          const orderRow = await prisma.phoneNumberOrder.findUnique({ where: { idempotencyKey: recorded.orderId }, select: { orderStatus: true } });
          if (orderRow?.orderStatus !== 'success' && !(createdMs && now - createdMs < NUMBER_GRACE_MS)) {
            const entry = { paymentId: pay.id, orderId: recorded.orderId, userId: recorded.userId, amountInr: Number(pay.amount) / 100 };
            report.unprovisionedNumberPayments.push(entry);
            logger.error('[ADMIN_ALERT][PAYMENTS] paid phone number was never provisioned — assign a number or refund', entry);
            continue;
          }
        }
        report.alreadyRecorded++;
        continue;
      }
      if (!pay.order_id) { report.rejected++; continue; }
      const order = await billing.fetchOrder(pay.order_id);
      const outcome = await fulfilCapturedPlanPayment({
        paymentId: pay.id,
        orderId: pay.order_id,
        amountPaise: Number(pay.amount),
        currency: String(pay.currency || ''),
        status: pay.status,
        notes: order.notes,
        via: 'reconciliation',
      });
      if (outcome === 'fulfilled') report.fulfilled++;
      else if (outcome === 'already_fulfilled') report.alreadyRecorded++;
      else if (outcome === 'rejected') report.rejected++;
      else if (outcome === 'number_payment') {
        const createdMs = Number(pay.created_at || 0) * 1000;
        if (createdMs && now - createdMs < NUMBER_GRACE_MS) continue;
        const entry = { paymentId: pay.id, orderId: pay.order_id, userId: order.notes.userId, amountInr: Number(pay.amount) / 100 };
        report.unprovisionedNumberPayments.push(entry);
        logger.error('[ADMIN_ALERT][PAYMENTS] paid phone number was never provisioned — assign a number or refund', entry);
      }
    } catch (err: any) {
      report.errors++;
      logger.error('[PAYMENTS] reconciliation could not check a payment', { paymentId: pay.id, error: err?.message });
    }
  }
  if (report.fulfilled || report.unprovisionedNumberPayments.length || report.errors) {
    logger.warn('[PAYMENTS] reconciliation finished with findings', { ...report, unprovisionedNumberPayments: report.unprovisionedNumberPayments.length });
  }
  return report;
}

let timer: NodeJS.Timeout | null = null;
/** Every 15 minutes (first run 2 minutes after boot). No-op without gateway keys. */
export function startPaymentReconciliation(intervalMs = 15 * 60 * 1000): void {
  if (timer) return;
  const tick = () => runPaymentReconciliation().catch((err) => logger.error('[PAYMENTS] reconciliation run failed', { error: err?.message }));
  setTimeout(tick, 2 * 60 * 1000).unref?.();
  timer = setInterval(tick, intervalMs);
  timer.unref?.();
}
