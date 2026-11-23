import Razorpay from 'razorpay';
import crypto from 'crypto';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { getPlanConfig, PLAN_CONFIG } from '../config/plans';
import { PlatformConfigService } from './PlatformConfigService';

/**
 * Payments (Razorpay). Every decision about money is made here, on the server:
 *  - prices come from the plan catalogue / carrier inventory, never from the browser;
 *  - every order carries notes { userId, purpose, ... } set by the server;
 *  - a payment counts only when its signature is valid AND Razorpay's own API confirms the order
 *    and payment (same order, same amount, INR, captured, same user, same purpose);
 *  - if Razorpay cannot be reached, nothing is granted (fail closed) — the webhook fulfils later;
 *  - a payment id / order id can be redeemed once (unique PaymentTransaction rows).
 */

export type PaymentPurpose = 'plan' | 'number';

export class PaymentVerificationError extends Error {
  constructor(public status: number, message: string, public code: string) {
    super(message);
    this.name = 'PaymentVerificationError';
  }
}

interface RazorpayLike {
  orders: { create(o: any): Promise<any>; fetch(id: string): Promise<any> };
  payments: { fetch(id: string): Promise<any>; refund(id: string, o: any): Promise<any>; all?(q: any): Promise<any> };
  paymentLink?: { create(o: any): Promise<any>; cancel(id: string): Promise<any> };
}

/**
 * Price (paise) and minutes a plan order was created with. Orders made before the snapshot existed
 * (or with an unreadable one) fall back to the plan's current values, which is what they were
 * checked against before. Notes are set by the server and read back from Razorpay, never from the browser.
 */
export function planTermsFromOrderNotes(notes: Record<string, string>, planConfig: { price: number; minutes: number }): { pricePaise: number; minutes: number } {
  const snapPaise = Number(notes.planPricePaise);
  const snapMinutes = Number(notes.planMinutes);
  const hasSnapshot = Number.isInteger(snapPaise) && snapPaise >= 100 && Number.isFinite(snapMinutes) && snapMinutes > 0;
  return hasSnapshot
    ? { pricePaise: snapPaise, minutes: snapMinutes }
    : { pricePaise: Math.round(planConfig.price * 100), minutes: planConfig.minutes };
}

/** Razorpay returns empty notes as [] — normalise to a plain object. */
export function normaliseNotes(notes: unknown): Record<string, string> {
  if (!notes || Array.isArray(notes) || typeof notes !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(notes as Record<string, unknown>)) {
    if (v !== undefined && v !== null) out[k] = String(v);
  }
  return out;
}

export interface VerifiedPayment {
  orderId: string;
  paymentId: string;
  amountPaise: number;
  notes: Record<string, string>;
}

const MOCK_SIGNATURE = 'mock_sig_test_only';
/** Mock orders exist only in development/test, in memory, so they cannot be forged from outside. */
const mockOrders = new Map<string, { amount: number; currency: string; notes: Record<string, string> }>();

export class BillingService {
  private static clientOverride: RazorpayLike | null | undefined;
  private razorpay: RazorpayLike | null;

  /** Tests only: replace the Razorpay client (null = no gateway; undefined = real client). */
  static setRazorpayClientForTests(client: RazorpayLike | null | undefined): void {
    BillingService.clientOverride = client;
  }

  /** Mock payments are allowed only without gateway keys AND in an explicit dev/test environment. */
  static isMockAllowed(): boolean {
    return env.NODE_ENV === 'development' || env.NODE_ENV === 'test';
  }

  static mockSignatureFor(orderId: string, paymentId: string): string {
    return `${MOCK_SIGNATURE}:${crypto.createHash('sha256').update(`${orderId}|${paymentId}`).digest('hex').slice(0, 16)}`;
  }

  constructor() {
    if (BillingService.clientOverride !== undefined) {
      this.razorpay = BillingService.clientOverride;
    } else if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
      this.razorpay = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET }) as any;
    } else {
      this.razorpay = null;
    }
  }

  /** Public key id for the checkout widget (never a secret, never a hard-coded fallback). */
  static publicKeyId(): string {
    return env.RAZORPAY_KEY_ID || '';
  }

  private get mockMode(): boolean {
    return !this.razorpay && BillingService.isMockAllowed();
  }

  private requireGateway(): RazorpayLike {
    if (this.razorpay) return this.razorpay;
    logger.error('BillingService: payment gateway is not configured');
    throw new PaymentVerificationError(503, 'Payments are not available right now. Please try again later.', 'PAYMENT_GATEWAY_UNAVAILABLE');
  }

  private async createOrder(amountPaise: number, receipt: string, notes: Record<string, string>) {
    if (!Number.isInteger(amountPaise) || amountPaise < 100) {
      throw new PaymentVerificationError(400, 'Minimum amount must be at least 100 paise (₹1)', 'PAYMENT_AMOUNT_INVALID');
    }
    if (this.mockMode) {
      const id = `order_mock_${crypto.randomUUID().replace(/-/g, '')}`;
      mockOrders.set(id, { amount: amountPaise, currency: 'INR', notes });
      // Dev/test only: a ready-made "paid" result so local flows can finish without a gateway.
      const paymentId = `pay_mock_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      const mockPayment = { paymentId, signature: BillingService.mockSignatureFor(id, paymentId) };
      return { id, orderId: id, amount: amountPaise, currency: 'INR', mock: true, mockPayment, keyId: '', key: '' };
    }
    const gateway = this.requireGateway();
    try {
      // payment_capture: 1 = auto-capture, so a paid order reaches "captured" without manual action.
      const order = await gateway.orders.create({ amount: amountPaise, currency: 'INR', receipt: receipt.slice(0, 40), notes, payment_capture: 1 });
      const keyId = BillingService.publicKeyId();
      return { ...order, id: order.id, orderId: order.id, keyId, key: keyId };
    } catch (err: any) {
      logger.error('BillingService: failed to create order', { error: err?.description || err?.message || String(err), amountPaise });
      throw new PaymentVerificationError(502, 'Payment initialization failed. Please try again.', 'PAYMENT_INIT_FAILED');
    }
  }

  /** Order for a subscription plan. Price and plan come from the server catalogue. */
  /** A suspended or restricted account cannot start a new purchase (audit #21). */
  private async assertAccountCanBuy(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { accountStatus: true } });
    if (!user) throw new PaymentVerificationError(401, 'Unauthorized', 'UNAUTHORIZED');
    if (user.accountStatus === 'suspended' || user.accountStatus === 'restricted') {
      throw new PaymentVerificationError(403, 'Your account is restricted, so new purchases are paused. Please contact support.', 'ACCOUNT_RESTRICTED');
    }
  }

  async createPlanPurchaseOrder(planInput: string, userId: string) {
    if (!userId) throw new PaymentVerificationError(401, 'Unauthorized', 'UNAUTHORIZED');
    await this.assertAccountCanBuy(userId);
    // Prices and "can be bought" may be changed from the admin panel: use the stored values.
    await PlatformConfigService.ensureLoaded();
    const planConfig = typeof planInput === 'string' ? getPlanConfig(planInput) : null;
    if (!planConfig) throw new PaymentVerificationError(400, 'Invalid or unknown plan name', 'PLAN_UNKNOWN');
    const planKey = Object.keys(PLAN_CONFIG).find((k) => PLAN_CONFIG[k] === planConfig) || planConfig.name.toLowerCase();
    if (planConfig.purchasable === false) {
      throw new PaymentVerificationError(409, 'This plan is not available right now. Please choose another plan.', 'PLAN_NOT_AVAILABLE');
    }
    // The ₹1 trial is once per account (audit #3: it could be bought repeatedly, 25 × ₹1 = 500 minutes).
    if (planKey === 'trial') {
      const usedTrial = await prisma.paymentTransaction.findFirst({
        where: { userId, planName: { equals: planConfig.name, mode: 'insensitive' } },
        select: { id: true },
      });
      if (usedTrial) {
        throw new PaymentVerificationError(409, 'The trial can be used once per account. Please choose a plan.', 'TRIAL_ALREADY_USED');
      }
    }
    const pricePaise = Math.round(planConfig.price * 100);
    return this.createOrder(
      pricePaise,
      `plan_${planKey}_${userId.slice(0, 8)}_${Date.now()}`,
      // The terms shown at checkout travel with the order (set by the server, read back from
      // Razorpay), so an admin price/minutes change in between never breaks this payment.
      { userId, purpose: 'plan', planKey, planPricePaise: String(pricePaise), planMinutes: String(planConfig.minutes) }
    );
  }

  /** Order for a paid phone number. The amount is the server's inventory price (never the browser's). */
  async createNumberPurchaseOrder(userId: string, amountInr: number, ref: { provider: 'vobiz' | 'plivo'; numberRef: string }) {
    if (!userId) throw new PaymentVerificationError(401, 'Unauthorized', 'UNAUTHORIZED');
    await this.assertAccountCanBuy(userId);
    if (!Number.isFinite(amountInr) || amountInr <= 0) {
      throw new PaymentVerificationError(400, 'This number has no valid price. Please choose another number.', 'PAYMENT_AMOUNT_INVALID');
    }
    return this.createOrder(
      Math.round(amountInr * 100),
      `num_${userId.slice(0, 8)}_${Date.now()}`,
      { userId, purpose: 'number', provider: ref.provider, numberRef: ref.numberRef }
    );
  }

  /** Razorpay checkout signature (HMAC of "orderId|paymentId"), compared in constant time. */
  verifyPayment(orderId: string, paymentId: string, signature: string): boolean {
    if (!orderId || !paymentId || !signature || typeof signature !== 'string') return false;
    const secret = env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      if (!this.mockMode || !orderId.startsWith('order_mock_')) return false;
      const expected = BillingService.mockSignatureFor(orderId, paymentId);
      return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    }
    const generated = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
    const sigBuf = Buffer.from(signature, 'utf8');
    const genBuf = Buffer.from(generated, 'utf8');
    return sigBuf.length === genBuf.length && crypto.timingSafeEqual(sigBuf, genBuf);
  }

  /**
   * Confirms a payment with Razorpay's API (or the dev/test mock registry). Throws
   * PaymentVerificationError with a user-safe message on any mismatch or if Razorpay cannot be
   * reached — never grants anything on doubt.
   */
  async verifyCapturedPayment(params: { userId: string; orderId: string; paymentId: string; signature: string; purpose: PaymentPurpose }): Promise<VerifiedPayment> {
    const { userId, orderId, paymentId, signature, purpose } = params;
    if (!userId) throw new PaymentVerificationError(401, 'Unauthorized', 'UNAUTHORIZED');
    if (typeof orderId !== 'string' || typeof paymentId !== 'string' || typeof signature !== 'string' || !orderId || !paymentId || !signature) {
      throw new PaymentVerificationError(400, 'Missing required payment verification fields', 'PAYMENT_FIELDS_MISSING');
    }
    if (!this.verifyPayment(orderId, paymentId, signature)) {
      throw new PaymentVerificationError(400, 'Invalid payment signature', 'PAYMENT_SIGNATURE_INVALID');
    }

    let order: { amount: number; currency: string; notes: Record<string, string> };
    let payment: { order_id: string; amount: number; currency: string; status: string };
    if (this.mockMode && orderId.startsWith('order_mock_')) {
      const mock = mockOrders.get(orderId);
      if (!mock) throw new PaymentVerificationError(400, 'Unknown payment order', 'PAYMENT_ORDER_UNKNOWN');
      order = mock;
      payment = { order_id: orderId, amount: mock.amount, currency: mock.currency, status: 'captured' };
    } else {
      const gateway = this.requireGateway();
      try {
        const [o, p] = await Promise.all([gateway.orders.fetch(orderId), gateway.payments.fetch(paymentId)]);
        order = { amount: Number(o?.amount), currency: String(o?.currency || ''), notes: normaliseNotes(o?.notes) };
        payment = { order_id: String(p?.order_id || ''), amount: Number(p?.amount), currency: String(p?.currency || ''), status: String(p?.status || '') };
      } catch (err: any) {
        logger.error('BillingService: could not confirm payment with the gateway', { orderId, paymentId, error: err?.description || err?.message || String(err) });
        throw new PaymentVerificationError(503,
          'We could not confirm your payment yet. If money was deducted, your purchase will be activated automatically within a few minutes.',
          'PAYMENT_UNCONFIRMED');
      }
    }

    const fail = (status: number, message: string, code: string, detail: Record<string, unknown>) => {
      logger.error(`BillingService: payment rejected (${code})`, { userId, orderId, paymentId, ...detail });
      return new PaymentVerificationError(status, message, code);
    };
    if (order.notes.userId !== userId) {
      throw fail(403, 'Unauthorized: This payment belongs to another account.', 'PAYMENT_WRONG_USER', { orderUser: order.notes.userId || 'none' });
    }
    const orderPurpose = order.notes.purpose || (order.notes.planKey ? 'plan' : '');
    if (orderPurpose !== purpose) {
      throw fail(400, 'This payment was made for a different purchase.', 'PAYMENT_WRONG_PURPOSE', { orderPurpose, purpose });
    }
    if (payment.order_id !== orderId) {
      throw fail(400, 'Payment order ID does not match specified order.', 'PAYMENT_ORDER_MISMATCH', { paymentOrder: payment.order_id });
    }
    if (order.currency !== 'INR' || payment.currency !== 'INR') {
      throw fail(400, 'Payment currency does not match.', 'PAYMENT_CURRENCY_MISMATCH', { orderCurrency: order.currency, paymentCurrency: payment.currency });
    }
    if (!Number.isInteger(order.amount) || order.amount !== payment.amount) {
      throw fail(400, 'Paid amount does not match the order amount.', 'PAYMENT_AMOUNT_MISMATCH', { orderAmount: order.amount, paidAmount: payment.amount });
    }
    if (payment.status === 'authorized') {
      throw new PaymentVerificationError(202,
        'Your payment is being processed by the bank. Your purchase will be activated automatically once it completes.',
        'PAYMENT_PENDING');
    }
    if (payment.status !== 'captured') {
      throw fail(402, `Payment verification failed: payment status is '${payment.status}'.`, 'PAYMENT_NOT_CAPTURED', { status: payment.status });
    }
    return { orderId, paymentId, amountPaise: order.amount, notes: order.notes };
  }

  hasGateway(): boolean {
    return Boolean(this.razorpay);
  }

  /** Captured payments in [fromSec, toSec] (Unix seconds), paged, at most 1,000. */
  async listCapturedPayments(fromSec: number, toSec: number): Promise<any[]> {
    const gateway = this.requireGateway();
    if (!gateway.payments.all) return [];
    const out: any[] = [];
    for (let skip = 0; skip < 1000; skip += 100) {
      const page = await gateway.payments.all({ from: fromSec, to: toSec, count: 100, skip });
      const items: any[] = Array.isArray(page?.items) ? page.items : [];
      out.push(...items.filter((p) => p?.status === 'captured'));
      if (items.length < 100) break;
    }
    return out;
  }

  /** Order as Razorpay (or the dev/test mock registry) has it — used by the webhook for notes. */
  async fetchOrder(orderId: string): Promise<{ amount: number; currency: string; notes: Record<string, string> }> {
    if (this.mockMode && orderId.startsWith('order_mock_')) {
      const mock = mockOrders.get(orderId);
      if (!mock) throw new PaymentVerificationError(400, 'Unknown payment order', 'PAYMENT_ORDER_UNKNOWN');
      return mock;
    }
    const o = await this.requireGateway().orders.fetch(orderId);
    return { amount: Number(o?.amount), currency: String(o?.currency || ''), notes: normaliseNotes(o?.notes) };
  }

  /**
   * Plan purchase after checkout. The plan is the one recorded on the server's order (a plan name
   * sent by the browser is only compared, never trusted). Idempotent: the same payment confirmed
   * again (or already fulfilled by the webhook) returns success without adding minutes twice.
   */
  async processPlanPurchase(params: { userId: string; orderId: string; paymentId: string; signature: string; clientPlan?: string }) {
    const verified = await this.verifyCapturedPayment({ ...params, purpose: 'plan' });
    const planKey = (verified.notes.planKey || '').toLowerCase();
    const planConfig = getPlanConfig(planKey);
    if (!planConfig) {
      throw new PaymentVerificationError(400, 'This payment is not linked to a known plan.', 'PLAN_UNKNOWN');
    }
    if (params.clientPlan) {
      const claimed = getPlanConfig(String(params.clientPlan));
      if (!claimed || claimed !== planConfig) {
        logger.error('BillingService: plan in request does not match the paid order', { userId: params.userId, orderId: params.orderId, clientPlan: params.clientPlan, orderPlan: planKey });
        throw new PaymentVerificationError(400, 'This payment was made for a different plan. Please contact support if money was deducted.', 'PLAN_MISMATCH');
      }
    }
    const terms = planTermsFromOrderNotes(verified.notes, planConfig);
    if (verified.amountPaise !== terms.pricePaise) {
      throw new PaymentVerificationError(400, 'Payment order amount does not match requested plan price.', 'PAYMENT_AMOUNT_MISMATCH');
    }

    const { fulfillPlanPurchase } = await import('./PlanFulfillmentService');
    const result = await fulfillPlanPurchase({
      userId: params.userId,
      orderId: params.orderId,
      paymentId: params.paymentId,
      planKey,
      source: 'self_serve',
      amountOverrideInr: terms.pricePaise / 100,
      minutesOverride: terms.minutes,
    });
    return { planKey, planName: planConfig.name, alreadyActive: result.isIdempotent === true };
  }

  /**
   * Records a verified number payment so the same payment can never be redeemed again (for a plan
   * or another number). Idempotent for a retry of the same number purchase.
   */
  async redeemNumberPayment(params: { userId: string; orderId: string; paymentId: string; signature: string; numberRef: string }) {
    const verified = await this.verifyCapturedPayment({ ...params, purpose: 'number' });
    if (verified.notes.numberRef && verified.notes.numberRef !== String(params.numberRef)) {
      throw new PaymentVerificationError(400, 'This payment was made for a different number.', 'PAYMENT_WRONG_NUMBER');
    }
    const amountInr = verified.amountPaise / 100;
    const isSameRedemption = (t: { userId: string; orderId: string; paymentId: string; planName: string } | null) =>
      Boolean(t && t.userId === params.userId && t.orderId === params.orderId && t.paymentId === params.paymentId && t.planName === 'phone_number');
    // Normal retry path: answer from the existing record. The unique constraint below still decides races.
    const prior = await prisma.paymentTransaction.findFirst({ where: { OR: [{ orderId: params.orderId }, { paymentId: params.paymentId }] } });
    if (prior) {
      if (isSameRedemption(prior)) return { amountInr, amountPaise: verified.amountPaise, alreadyRedeemed: true };
      throw new PaymentVerificationError(409, 'Payment has already been redeemed.', 'PAYMENT_ALREADY_REDEEMED');
    }
    try {
      await prisma.paymentTransaction.create({
        data: {
          userId: params.userId,
          orderId: params.orderId,
          paymentId: params.paymentId,
          planName: 'phone_number',
          amount: amountInr,
          currency: 'INR',
          status: 'completed',
          source: 'self_serve',
        },
      });
      return { amountInr, amountPaise: verified.amountPaise, alreadyRedeemed: false };
    } catch (err: any) {
      if (err?.code !== 'P2002') throw err;
      const existing = await prisma.paymentTransaction.findFirst({ where: { OR: [{ orderId: params.orderId }, { paymentId: params.paymentId }] } });
      if (existing && existing.userId === params.userId && existing.orderId === params.orderId && existing.paymentId === params.paymentId && existing.planName === 'phone_number') {
        return { amountInr, amountPaise: verified.amountPaise, alreadyRedeemed: true };
      }
      throw new PaymentVerificationError(409, 'Payment has already been redeemed.', 'PAYMENT_ALREADY_REDEEMED');
    }
  }

  /**
   * Razorpay payment link for an admin-priced plan (the amount is computed by the caller from the
   * server's plan price). Without a gateway: a clearly marked test link in dev/test, 503 otherwise.
   */
  async createPaymentLink(params: {
    amountPaise: number;
    description: string;
    customer: { name?: string; email?: string; contact?: string };
    notes: Record<string, string>;
    expireBy: number;
  }): Promise<{ id: string; shortUrl: string; mock: boolean }> {
    if (!Number.isInteger(params.amountPaise) || params.amountPaise < 100) {
      throw new PaymentVerificationError(400, 'Minimum amount must be at least ₹1', 'PAYMENT_AMOUNT_INVALID');
    }
    if (this.mockMode) {
      const id = `plink_mock_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`;
      return { id, shortUrl: '', mock: true };
    }
    const gateway = this.requireGateway();
    if (!gateway.paymentLink) {
      throw new PaymentVerificationError(503, 'Payment links are not available right now.', 'PAYMENT_GATEWAY_UNAVAILABLE');
    }
    try {
      const contact = params.customer.contact && /^\+?\d{10,15}$/.test(params.customer.contact) ? params.customer.contact : undefined;
      const link = await gateway.paymentLink.create({
        amount: params.amountPaise,
        currency: 'INR',
        accept_partial: false,
        description: params.description,
        customer: { name: params.customer.name, email: params.customer.email, ...(contact ? { contact } : {}) },
        notify: { email: true, sms: Boolean(contact) },
        reminder_enable: true,
        notes: params.notes,
        expire_by: params.expireBy,
      });
      if (!link?.id || !link?.short_url) throw new Error('gateway returned no link');
      return { id: String(link.id), shortUrl: String(link.short_url), mock: false };
    } catch (err: any) {
      logger.error('BillingService: failed to create payment link', { error: err?.error?.description || err?.message || String(err) });
      throw new PaymentVerificationError(502, 'Razorpay could not create the payment link. Please try again.', 'PAYMENT_LINK_FAILED');
    }
  }

  /** Cancels an unpaid payment link at Razorpay (no-op for a dev/test mock link). */
  async cancelPaymentLink(linkId: string): Promise<void> {
    if (linkId.startsWith('plink_mock_') && BillingService.isMockAllowed()) return;
    const gateway = this.requireGateway();
    if (!gateway.paymentLink) {
      throw new PaymentVerificationError(503, 'Payment links are not available right now.', 'PAYMENT_GATEWAY_UNAVAILABLE');
    }
    try {
      await gateway.paymentLink.cancel(linkId);
    } catch (err: any) {
      logger.error('BillingService: failed to cancel payment link', { linkId, error: err?.error?.description || err?.message || String(err) });
      throw new PaymentVerificationError(502, 'Razorpay could not cancel the link (it may already be paid or expired). Check the Razorpay dashboard.', 'PAYMENT_LINK_CANCEL_FAILED');
    }
  }

  /** Full or partial refund (a paid number that cannot be provisioned, or an admin refund). */
  async refundOrder(paymentId: string, amountInPaise: number, reason = 'Number could not be provisioned'): Promise<{ success: boolean; refundId?: string }> {
    if (!this.razorpay) {
      if (this.mockMode) {
        logger.warn('BillingService.refundOrder: mock mode — refund not executed', { paymentId });
        return { success: true, refundId: `refund_mock_${Date.now()}` };
      }
      logger.error('BillingService.refundOrder: gateway not configured — MANUAL REFUND REQUIRED', { paymentId, amountInPaise });
      return { success: false };
    }
    try {
      const refund = await this.razorpay.payments.refund(paymentId, {
        amount: amountInPaise,
        speed: 'optimum',
        notes: { reason: reason.slice(0, 250) },
      });
      logger.info('BillingService.refundOrder: refund issued', { paymentId, refundId: refund.id });
      return { success: true, refundId: refund.id };
    } catch (err) {
      logger.error('BillingService.refundOrder: REFUND FAILED — MANUAL ACTION REQUIRED', { paymentId, error: String(err) });
      return { success: false };
    }
  }
}
