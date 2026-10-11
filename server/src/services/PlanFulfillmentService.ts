import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { MinutesService } from './MinutesService';
import { InvoiceService } from './InvoiceService';
import { PLAN_CONFIG } from '../config/plans';

export interface FulfillPlanPurchaseParams {
  userId: string;
  orderId: string;
  paymentId: string;
  planKey: string;
  source: 'self_serve' | 'admin';
  staffId?: string;
  razorpayLinkId?: string;
  amountOverrideInr?: number;
}

/**
 * Authoritative single code path for fulfilling plan purchases.
 * Shared by Razorpay Webhooks and the client POST /api/v2/billing/verify-plan route.
 */
export async function fulfillPlanPurchase(params: FulfillPlanPurchaseParams) {
  const { userId, orderId, paymentId, planKey, source, staffId, razorpayLinkId, amountOverrideInr } = params;

  // 1. Resolve Plan from PlanCatalog, falling back to PLAN_CONFIG
  const catalogPlan = await prisma.planCatalog.findUnique({
    where: { key: planKey.toLowerCase() },
  });

  let planName = '';
  let priceInr = 0;
  let addedMinutes = 0;
  let accountType = 'developer';

  if (catalogPlan) {
    planName = catalogPlan.name;
    priceInr = amountOverrideInr ?? catalogPlan.priceInr;
    addedMinutes = catalogPlan.minutes;
    accountType = catalogPlan.accountType;
  } else {
    // Fallback to existing PLAN_CONFIG constant
    const staticPlan = (PLAN_CONFIG as any)[planKey.toUpperCase()];
    if (!staticPlan) {
      throw new Error(`INVALID_PLAN: Plan key '${planKey}' not recognized.`);
    }
    planName = staticPlan.name;
    priceInr = amountOverrideInr ?? staticPlan.price;
    addedMinutes = staticPlan.minutes;
    accountType = staticPlan.accountType || 'developer';
  }

  // 2. Atomic Transaction: Record payment, credit minutes ledger, and generate sequential GST invoice
  const result = await prisma.$transaction(async (tx) => {
    // Check if payment transaction already exists
    const existingPayment = await tx.paymentTransaction.findFirst({
      where: {
        OR: [{ orderId }, { paymentId }],
      },
    });

    if (existingPayment) {
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

    // Update User Account Type
    await tx.user.update({
      where: { id: userId },
      data: { accountType },
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

  return result;
}
