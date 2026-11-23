import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { MinutesService } from './MinutesService';
import { InvoiceService } from './InvoiceService';
import { PLAN_CONFIG, PLAN_VALIDITY_DAYS } from '../config/plans';

export interface FulfillPlanPurchaseParams {
  userId: string;
  orderId: string;
  paymentId: string;
  planKey: string;
  source: 'self_serve' | 'admin';
  staffId?: string;
  razorpayLinkId?: string;
  amountOverrideInr?: number;
  /**
   * Minutes promised when the order or link was created (checkout snapshot). Used instead of the
   * plan's current minutes, so an admin price/minutes edit never changes what was already paid for.
   */
  minutesOverride?: number;
}

/**
 * Authoritative single code path for fulfilling plan purchases.
 * Shared by Razorpay Webhooks and the client POST /api/v2/billing/verify-plan route.
 */
/** Tier order used so a purchase never downgrades an account. Unknown/custom tiers keep the higher known one. */
const ACCOUNT_TIER_ORDER = ['free', 'trial', 'starter', 'developer', 'professional', 'growth', 'enterprise', 'scale', 'admin'];
export function higherAccountTier(current: string | null | undefined, purchased: string): string {
  const rank = (t: string | null | undefined) => ACCOUNT_TIER_ORDER.indexOf(String(t || '').toLowerCase());
  return rank(current) > rank(purchased) ? String(current) : purchased;
}

export async function fulfillPlanPurchase(params: FulfillPlanPurchaseParams) {
  const { userId, orderId, paymentId, planKey, source, staffId, razorpayLinkId, amountOverrideInr } = params;
  const minutesOverride = typeof params.minutesOverride === 'number' && Number.isFinite(params.minutesOverride) && params.minutesOverride > 0
    ? params.minutesOverride
    : undefined;

  // 1. Resolve the plan. Built-in plans always come from PLAN_CONFIG (the server's price list). A
  // staff catalog row applies only when it is active, uses its own key, and, when it is made for one
  // customer, only to that customer (audit #8: a row keyed like a built-in plan, or another
  // customer's custom plan, changed what every buyer received).
  const key = planKey.toLowerCase();
  const builtInPlan = (PLAN_CONFIG as any)[key];
  const catalogRow = await prisma.planCatalog.findUnique({ where: { key } });
  const catalogPlan = catalogRow && catalogRow.active && !builtInPlan
    && (!catalogRow.customerUserId || catalogRow.customerUserId === userId)
    ? catalogRow
    : null;

  let planName = '';
  let priceInr = 0;
  let addedMinutes = 0;
  let accountType = 'developer';

  if (catalogPlan) {
    planName = catalogPlan.name;
    priceInr = amountOverrideInr ?? catalogPlan.priceInr;
    addedMinutes = minutesOverride ?? catalogPlan.minutes;
    accountType = catalogPlan.accountType;
  } else {
    // Fallback to existing PLAN_CONFIG constant
    const staticPlan = builtInPlan;
    if (!staticPlan) {
      throw new Error(`INVALID_PLAN: Plan key '${planKey}' not recognized.`);
    }
    planName = staticPlan.name;
    priceInr = amountOverrideInr ?? staticPlan.price;
    addedMinutes = minutesOverride ?? staticPlan.minutes;
    accountType = staticPlan.accountType || 'developer';
  }

  // 2. Pre-verify customer user existence
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });
  if (!targetUser) {
    logger.error('[PLAN_FULFILLMENT] Customer user ID not found in database', { userId });
    throw new Error(`USER_NOT_FOUND: User '${userId}' does not exist.`);
  }

  // 3. Atomic Transaction: Record payment, credit minutes ledger, and generate sequential GST invoice.
  // The browser confirmation and the Razorpay webhook can arrive at the same moment; the loser of
  // that race hits the unique orderId/paymentId constraint and is answered idempotently below.
  try {
    return await runFulfillment();
  } catch (err: any) {
    if (err?.code !== 'P2002') throw err;
    const existing = await prisma.paymentTransaction.findFirst({ where: { OR: [{ orderId }, { paymentId }] } });
    if (!existing) throw err;
    if (existing.userId !== userId || existing.orderId !== orderId || existing.paymentId !== paymentId) {
      logger.error('[PLAN_FULFILLMENT] Payment already redeemed for a different purchase', { userId, orderId, paymentId, existingUserId: existing.userId });
      throw new Error('Unauthorized: This payment was already redeemed by another user.');
    }
    logger.info('[PLAN_FULFILLMENT] Concurrent fulfilment resolved idempotently', { orderId, paymentId });
    return { success: true, paymentTransaction: existing, isIdempotent: true };
  }

  async function runFulfillment() {
  return prisma.$transaction(async (tx) => {
    // Check if payment transaction already exists
    const existingPayment = await tx.paymentTransaction.findFirst({
      where: {
        OR: [{ orderId }, { paymentId }],
      },
    });

    if (existingPayment) {
      const samePurchase = existingPayment.orderId === orderId && existingPayment.paymentId === paymentId && existingPayment.planName === planName;
      if (existingPayment.userId === userId && !samePurchase) {
        logger.error('[PLAN_FULFILLMENT] Payment already used for a different purchase', { userId, orderId, paymentId, existingPlan: existingPayment.planName });
        throw new Error('Payment has already been redeemed.');
      }
      if (existingPayment.userId !== userId) {
        logger.error('[PLAN_FULFILLMENT] Cross-user payment replay attack detected!', {
          attemptingUserId: userId,
          paymentOwnerUserId: existingPayment.userId,
          paymentId,
          orderId,
        });
        throw new Error('Unauthorized: This payment was already redeemed by another user.');
      }
      logger.info('[PLAN_FULFILLMENT] Payment already recorded, idempotent return', {
        paymentId,
        orderId,
        existingPaymentId: existingPayment.id,
      });
      return { success: true, paymentTransaction: existingPayment, isIdempotent: true };
    }

    // Insert PaymentTransaction record
    const paymentTx = await tx.paymentTransaction.create({
      data: {
        userId,
        orderId,
        paymentId,
        planName,
        amount: priceInr,
        currency: 'INR',
        status: 'completed',
        source,
        createdByStaffId: staffId || null,
        razorpayLinkId: razorpayLinkId || null,
      },
    });

    // Credit Minutes via MinutesService
    const creditResult = await MinutesService.credit(
      {
        userId,
        deltaSeconds: Math.round(addedMinutes * 60),
        reason: 'plan_purchase',
        refType: 'payment_transaction',
        refId: paymentTx.id,
        note: `Purchased ${planName} plan (${addedMinutes} mins)`,
        actorType: source === 'admin' ? 'staff' : 'customer',
        actorId: staffId || userId,
        idempotencyKey: `plan_purchase_${paymentId}`,
      },
      tx
    );

    // Account tier: a purchase never lowers it (audit #12: an Enterprise customer buying the Rs 1 trial
    // was downgraded to 'trial'). One phone number per plan purchase (audit #5): a new plan grants a
    // fresh number slot only when the account holds no number.
    const current = await tx.user.findUnique({ where: { id: userId }, select: { accountType: true } });
    const heldNumbers = await tx.phoneNumber.count({ where: { userId } });
    await tx.user.update({
      where: { id: userId },
      data: {
        accountType: higherAccountTier(current?.accountType, accountType),
        // A new plan starts a fresh validity window (any older window is replaced).
        planExpiresAt: new Date(Date.now() + (catalogPlan?.validityDays && catalogPlan.validityDays > 0 ? catalogPlan.validityDays : PLAN_VALIDITY_DAYS) * 24 * 60 * 60 * 1000),
        ...(heldNumbers === 0 ? { numberLocked: false } : {}),
      },
    });

    // Generate GST Invoice
    const invoice = await InvoiceService.generateInvoice(
      {
        userId,
        paymentTransactionId: paymentTx.id,
        amountInr: priceInr,
        planKey,
        planName,
        minutesCredited: addedMinutes,
      },
      tx
    );

    logger.info('[PLAN_FULFILLMENT] Plan purchased and fulfilled successfully', {
      userId,
      planName,
      priceInr,
      addedMinutes,
      invoiceNumber: invoice.invoiceNumber,
      orderId,
      paymentId,
    });

    return {
      success: true,
      paymentTransaction: paymentTx,
      invoice,
      creditResult,
      isIdempotent: false,
    };
  });
  }
}
