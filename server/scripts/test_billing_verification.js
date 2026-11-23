require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Phase 6 (issue B13): payment verification and fraud prevention.
 *
 * Production BillingService, PlanFulfillmentService, billing routes, Razorpay webhook and
 * reconciliation job against the local TEST database. The Razorpay API is replaced by an
 * in-memory fake gateway (setRazorpayClientForTests); signatures use a test-only secret.
 *
 * Covers: forged signature, replay, amount tampering, wrong user, double submit, webhook before /
 * racing the browser confirmation, gateway outage (fail closed), not-yet-captured payments,
 * spoofed payment notes, empty-notes webhooks, double-counted refunds, plan↔number cross
 * redemption, reconciliation of missed payments, no mock payments in production.
 * Run: npm run test:billing   (part of npm run test:security)
 */
process.env.RAZORPAY_KEY_ID = 'rzp_test_fake_key_for_tests';
process.env.RAZORPAY_KEY_SECRET = 'test_only_checkout_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'test_only_webhook_secret';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { prisma } = require('../dist/lib/prisma');
const { BillingService, PaymentVerificationError } = require('../dist/services/BillingService');
const { runPaymentReconciliation } = require('../dist/services/PaymentReconciliationService');
const billingRouter = require('../dist/routes/billing').default;
const { razorpayWebhookRouter, clearRazorpayReplayCacheForTesting } = require('../dist/routes/razorpayWebhook');
const limiters = require('../dist/middleware/rateLimiter');

let total = 0;
let passed = 0;
async function test(name, fn) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}\n    ${err.stack || err.message}`);
  }
}

// ── Fake Razorpay gateway ─────────────────────────────────────────────
const gw = {
  orders: new Map(),
  payments: new Map(),
  down: false,
  refunds: [],
  api: {
    orders: {
      create: async (o) => { const id = `order_${crypto.randomBytes(7).toString('hex')}`; const order = { id, ...o, notes: o.notes || [] }; gw.orders.set(id, order); return order; },
      fetch: async (id) => { if (gw.down) throw new Error('ECONNRESET'); const o = gw.orders.get(id); if (!o) throw new Error('not found'); return o; },
    },
    payments: {
      fetch: async (id) => { if (gw.down) throw new Error('ECONNRESET'); const p = gw.payments.get(id); if (!p) throw new Error('not found'); return p; },
      refund: async (id, o) => { gw.refunds.push({ id, ...o }); return { id: `rfnd_${id}` }; },
      all: async () => ({ items: [...gw.payments.values()] }),
    },
  },
};
BillingService.setRazorpayClientForTests(gw.api);

const sign = (orderId, paymentId) => crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');

/** Simulates the customer paying an order in the checkout. */
function pay(order, overrides = {}) {
  const id = `pay_${crypto.randomBytes(7).toString('hex')}`;
  const payment = { id, order_id: order.id, amount: order.amount, currency: 'INR', status: 'captured', notes: [], created_at: Math.floor(Date.now() / 1000) - 3600, ...overrides };
  gw.payments.set(id, payment);
  return { orderId: order.id, paymentId: id, signature: sign(order.id, id), payment };
}

async function makeUser() {
  const id = crypto.randomUUID();
  await prisma.user.create({ data: { id, email: `${id}@example.org`, fullName: 'Billing Test', passwordHash: 'x', accountType: 'free' } });
  return id;
}
const seconds = async (u) => (await prisma.user.findUnique({ where: { id: u } })).minutesRemainingSeconds;
const txCount = async (where) => prisma.paymentTransaction.count({ where });

// Route doubles: run the real handler chain's last function with a fake req/res.
function routeHandler(router, method, p) {
  const layer = router.stack.find((l) => l.route && l.route.path === p && l.route.methods[method]);
  if (!layer) return null;
  return layer.route.stack[layer.route.stack.length - 1].handle;
}
function invoke(handler, req) {
  return new Promise((resolve) => {
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { resolve({ status: this.statusCode, body: b }); return this; }, send(b) { resolve({ status: this.statusCode, body: b }); return this; } };
    Promise.resolve(handler(req, res, (e) => resolve({ status: 500, body: { error: String(e) } })));
  });
}
const verifyPlan = (userId, body) => invoke(routeHandler(billingRouter, 'post', '/verify-plan'), { userId, body, headers: {} });
function webhook(bodyObj, { secret = process.env.RAZORPAY_WEBHOOK_SECRET, eventId } = {}) {
  const raw = Buffer.from(JSON.stringify(bodyObj));
  const sig = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const handler = razorpayWebhookRouter.stack.find((l) => l.route && l.route.path === '/razorpay').route.stack.slice(-1)[0].handle;
  return invoke(handler, { body: bodyObj, rawBody: raw, headers: { 'x-razorpay-signature': sig, ...(eventId ? { 'x-razorpay-event-id': eventId } : {}) } });
}

async function main() {
  const billing = () => new BillingService();
  console.log('\n--- BILLING / PAYMENT VERIFICATION (B13) ---');

  await test('a genuine payment activates the plan recorded on the server order, once', async () => {
    const u = await makeUser();
    const order = await billing().createPlanPurchaseOrder('Startup', u);
    assert.strictEqual(order.amount, 379900);
    assert.strictEqual(order.payment_capture, 1);
    const p = pay(order);
    const r = await verifyPlan(u, { ...p, plan: 'Startup' });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.data.plan, 'startup');
    const user = await prisma.user.findUnique({ where: { id: u } });
    assert.strictEqual(user.accountType, 'developer');
    assert.strictEqual(user.minutesRemainingSeconds, 750 * 60);
  });

  await test('forged signature is refused and grants nothing', async () => {
    const u = await makeUser();
    const order = await billing().createPlanPurchaseOrder('Growth', u);
    const p = pay(order);
    const r = await verifyPlan(u, { ...p, signature: 'a'.repeat(64) });
    assert.strictEqual(r.status, 400);
    assert.strictEqual(r.body.code, 'PAYMENT_SIGNATURE_INVALID');
    assert.strictEqual(await seconds(u), 0);
  });

  await test('replaying the same payment never adds minutes twice', async () => {
    const u = await makeUser();
    const p = pay(await billing().createPlanPurchaseOrder('Starter', u));
    await verifyPlan(u, p);
    const before = await seconds(u);
    const again = await verifyPlan(u, p);
    assert.strictEqual(again.status, 200);
    assert.strictEqual(again.body.data.alreadyActive, true);
    assert.strictEqual(await seconds(u), before);
    assert.strictEqual(await txCount({ paymentId: p.paymentId }), 1);
  });

  await test('amount tampering: a cheap order cannot buy an expensive plan; paid ≠ ordered is refused', async () => {
    const u = await makeUser();
    // A ₹1 trial order whose payment is presented as "Enterprise".
    const cheap = pay(await billing().createPlanPurchaseOrder('Trial', u));
    const claim = await verifyPlan(u, { ...cheap, plan: 'Enterprise' });
    assert.strictEqual(claim.status, 400);
    assert.strictEqual(claim.body.code, 'PLAN_MISMATCH');
    // An order whose notes say "enterprise" but whose amount is ₹1 (not created by our server).
    const forgedOrder = await gw.api.orders.create({ amount: 100, currency: 'INR', notes: { userId: u, purpose: 'plan', planKey: 'enterprise' } });
    const r = await verifyPlan(u, pay(forgedOrder));
    assert.strictEqual(r.status, 400);
    assert.strictEqual(r.body.code, 'PAYMENT_AMOUNT_MISMATCH');
    // A payment for less than its order.
    const short = pay(await billing().createPlanPurchaseOrder('Growth', u), { amount: 100 });
    const r2 = await verifyPlan(u, short);
    assert.strictEqual(r2.status, 400);
    assert.strictEqual(await seconds(u), 0);
  });

  await test('wrong user: another account cannot redeem someone else\'s payment', async () => {
    const owner = await makeUser();
    const thief = await makeUser();
    const p = pay(await billing().createPlanPurchaseOrder('Growth', owner));
    const r = await verifyPlan(thief, p);
    assert.strictEqual(r.status, 403);
    assert.strictEqual(r.body.code, 'PAYMENT_WRONG_USER');
    assert.strictEqual(await seconds(thief), 0);
  });

  await test('double submit: two confirmations at once fulfil once', async () => {
    const u = await makeUser();
    const p = pay(await billing().createPlanPurchaseOrder('Starter', u));
    const [a, b] = await Promise.all([verifyPlan(u, p), verifyPlan(u, p)]);
    assert.ok([a.status, b.status].every((s) => s === 200), JSON.stringify([a.body, b.body]));
    assert.strictEqual(await seconds(u), 500 * 60);
    assert.strictEqual(await txCount({ orderId: p.orderId }), 1);
  });

  await test('gateway outage: nothing is granted (fail closed), with a clear "pending" message', async () => {
    const u = await makeUser();
    const p = pay(await billing().createPlanPurchaseOrder('Growth', u));
    gw.down = true;
    let r;
    try { r = await verifyPlan(u, p); } finally { gw.down = false; }
    assert.strictEqual(r.status, 503);
    assert.strictEqual(r.body.code, 'PAYMENT_UNCONFIRMED');
    assert.strictEqual(r.body.pending, true);
    assert.strictEqual(await seconds(u), 0);
  });

  await test('an authorised-but-not-captured payment is pending, not granted', async () => {
    const u = await makeUser();
    const p = pay(await billing().createPlanPurchaseOrder('Growth', u), { status: 'authorized' });
    const r = await verifyPlan(u, p);
    assert.strictEqual(r.status, 202);
    assert.strictEqual(r.body.code, 'PAYMENT_PENDING');
    assert.strictEqual(await seconds(u), 0);
    const failed = pay(await billing().createPlanPurchaseOrder('Growth', u), { status: 'failed' });
    assert.strictEqual((await verifyPlan(u, failed)).status, 402);
  });

  await test('webhook first, browser second: activated once; browser gets success', async () => {
    clearRazorpayReplayCacheForTesting();
    const u = await makeUser();
    const order = await billing().createPlanPurchaseOrder('Starter', u);
    const p = pay(order);
    // Real-world payload: payment.captured carries no order notes (empty notes arrive as []).
    const wh = await webhook({ event: 'payment.captured', payload: { payment: { entity: p.payment } } }, { eventId: `evt_${p.paymentId}` });
    assert.strictEqual(wh.status, 200);
    assert.strictEqual(await seconds(u), 500 * 60, 'webhook must activate the plan from the order notes');
    const r = await verifyPlan(u, p);
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.data.alreadyActive, true);
    assert.strictEqual(await seconds(u), 500 * 60);
  });

  await test('webhook and browser racing each other credit once', async () => {
    clearRazorpayReplayCacheForTesting();
    const u = await makeUser();
    const p = pay(await billing().createPlanPurchaseOrder('Growth', u));
    const [wh, r] = await Promise.all([
      webhook({ event: 'order.paid', payload: { payment: { entity: p.payment }, order: { entity: gw.orders.get(p.orderId) } } }, { eventId: `evt_race_${p.paymentId}` }),
      verifyPlan(u, p),
    ]);
    assert.strictEqual(wh.status, 200);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(await seconds(u), 2865 * 60);
    assert.strictEqual(await txCount({ paymentId: p.paymentId }), 1);
  });

  await test('webhook ignores user/plan set in payment notes (only the server order counts)', async () => {
    clearRazorpayReplayCacheForTesting();
    const victim = await makeUser();
    const attacker = await makeUser();
    const p = pay(await billing().createPlanPurchaseOrder('Trial', attacker), { notes: { userId: victim, planKey: 'enterprise', purpose: 'plan' } });
    await webhook({ event: 'payment.captured', payload: { payment: { entity: p.payment } } }, { eventId: `evt_spoof_${p.paymentId}` });
    assert.strictEqual(await seconds(victim), 0);
    const att = await prisma.user.findUnique({ where: { id: attacker } });
    assert.strictEqual(att.accountType, 'trial', 'only the ₹1 trial that was actually ordered and paid');
  });

  await test('webhook: bad signature refused; a missing secret outside tests fails closed; duplicates ignored', async () => {
    clearRazorpayReplayCacheForTesting();
    const bad = await webhook({ event: 'payment.captured', payload: {} }, { secret: 'wrong' });
    assert.strictEqual(bad.status, 400);
    const saved = process.env.RAZORPAY_WEBHOOK_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    process.env.NODE_ENV = 'production';
    let noSecret;
    try { noSecret = await webhook({ event: 'payment.captured', payload: {} }, { secret: 'test_webhook_secret' }); }
    finally { process.env.RAZORPAY_WEBHOOK_SECRET = saved; process.env.NODE_ENV = 'test'; }
    assert.strictEqual(noSecret.status, 500, 'the built-in test secret must never work outside tests');

    const u = await makeUser();
    const p = pay(await billing().createPlanPurchaseOrder('Starter', u));
    const body = { event: 'payment.captured', payload: { payment: { entity: p.payment } } };
    await webhook(body, { eventId: `evt_dup_${p.paymentId}` });
    clearRazorpayReplayCacheForTesting(); // simulate a restart: the DB record must still dedupe
    const second = await webhook(body, { eventId: `evt_dup_${p.paymentId}` });
    assert.strictEqual(second.body.idempotent, true);
    assert.strictEqual(await seconds(u), 500 * 60);
  });

  await test('webhook: a temporary gateway failure answers 500 so Razorpay retries', async () => {
    clearRazorpayReplayCacheForTesting();
    const u = await makeUser();
    const p = pay(await billing().createPlanPurchaseOrder('Starter', u));
    gw.down = true;
    let r;
    try { r = await webhook({ event: 'payment.captured', payload: { payment: { entity: p.payment } } }, { eventId: `evt_retry_${p.paymentId}` }); } finally { gw.down = false; }
    assert.strictEqual(r.status, 500);
    const retry = await webhook({ event: 'payment.captured', payload: { payment: { entity: p.payment } } }, { eventId: `evt_retry_${p.paymentId}` });
    assert.strictEqual(retry.status, 200);
    assert.strictEqual(await seconds(u), 500 * 60, 'the retry must be processed, not blocked as a duplicate');
  });

  await test('a refund is recorded once (refund.created + refund.processed used to count it twice)', async () => {
    clearRazorpayReplayCacheForTesting();
    const u = await makeUser();
    const p = pay(await billing().createPlanPurchaseOrder('Starter', u));
    await verifyPlan(u, p);
    const refund = { id: `rfnd_${p.paymentId}`, payment_id: p.paymentId, amount: 80000 };
    await webhook({ event: 'refund.created', payload: { refund: { entity: refund } } }, { eventId: `evt_rc_${refund.id}` });
    await webhook({ event: 'refund.processed', payload: { refund: { entity: refund } } }, { eventId: `evt_rp_${refund.id}` });
    const tx = await prisma.paymentTransaction.findFirst({ where: { paymentId: p.paymentId } });
    assert.strictEqual(tx.refundedAmount, 800);
    assert.strictEqual(tx.status, 'refunded');
  });

  await test('a plan payment cannot buy a number, and a number payment cannot be reused', async () => {
    const u = await makeUser();
    const planPay = pay(await billing().createPlanPurchaseOrder('Starter', u));
    await assert.rejects(billing().redeemNumberPayment({ userId: u, ...planPay, numberRef: 'num_1' }), (e) => e instanceof PaymentVerificationError && e.code === 'PAYMENT_WRONG_PURPOSE');
    const numPay = pay(await billing().createNumberPurchaseOrder(u, 499, { provider: 'vobiz', numberRef: 'num_1' }));
    const first = await billing().redeemNumberPayment({ userId: u, ...numPay, numberRef: 'num_1' });
    assert.strictEqual(first.amountPaise, 49900);
    assert.strictEqual(first.alreadyRedeemed, false);
    const retry = await billing().redeemNumberPayment({ userId: u, ...numPay, numberRef: 'num_1' });
    assert.strictEqual(retry.alreadyRedeemed, true);
    await assert.rejects(billing().redeemNumberPayment({ userId: u, ...numPay, numberRef: 'num_2' }), (e) => e.code === 'PAYMENT_WRONG_NUMBER');
    const asPlan = await verifyPlan(u, numPay);
    assert.strictEqual(asPlan.status, 400);
    assert.strictEqual(asPlan.body.code, 'PAYMENT_WRONG_PURPOSE');
  });

  await test('number orders are priced by the server, never by the browser', async () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/routes/numbers.ts'), 'utf8');
    const createOrder = src.slice(src.indexOf("router.post('/create-order'"), src.indexOf("router.post('/purchase'"));
    assert.ok(createOrder.includes('getNumberDetails(userId, vobizNumberId)'));
    assert.ok(!/baseCost|setupFee\s*=/.test(createOrder), 'browser price fields must not be read');
    const purchase = src.slice(src.indexOf("router.post('/purchase'"), src.indexOf("router.post('/claim'"));
    assert.ok(purchase.includes('redeemNumberPayment') && !/req\.body[^;]*expectedPrice/.test(purchase));
    // Owner rule 2026-11-23: no automatic refund in the purchase route; undelivered payments become
    // owner cases with the verified amount (refunds happen only from the admin console).
    assert.ok(!purchase.includes('refundOrder('), 'no automatic refund');
    assert.ok(purchase.includes('amountInr: paid.amountInr'), 'cases carry the verified amount');
    // Phase 13: the only other paid number route (/plivo/purchase) was unused and removed.
    assert.ok(!src.includes("router.post('/plivo/purchase'") && !src.includes('verifyPayment('));
  });

  await test('reconciliation activates a paid plan nobody confirmed and reports an unprovisioned paid number', async () => {
    gw.payments.clear();
    const u = await makeUser();
    const missed = pay(await billing().createPlanPurchaseOrder('Starter', u));
    const num = pay(await billing().createNumberPurchaseOrder(u, 499, { provider: 'vobiz', numberRef: 'num_9' }));
    const report = await runPaymentReconciliation();
    assert.strictEqual(report.fulfilled, 1, JSON.stringify(report));
    assert.strictEqual(await seconds(u), 500 * 60);
    assert.deepStrictEqual(report.unprovisionedNumberPayments.map((x) => x.paymentId), [num.paymentId]);
    const again = await runPaymentReconciliation();
    assert.strictEqual(again.fulfilled, 0);
    assert.ok(again.alreadyRecorded >= 1);
    assert.ok(missed);
  });

  await test('no mock payments outside development/test, and no gateway means no orders in production', async () => {
    BillingService.setRazorpayClientForTests(null);
    const savedSecret = process.env.RAZORPAY_KEY_SECRET;
    try {
      const u = await makeUser();
      const mock = await new BillingService().createPlanPurchaseOrder('Starter', u); // NODE_ENV=test → mock allowed
      assert.strictEqual(mock.mock, true);
      assert.ok(mock.mockPayment.signature);
      process.env.NODE_ENV = 'production';
      const { env } = require('../dist/config/env');
      const savedEnv = env.NODE_ENV; env.NODE_ENV = 'production';
      try {
        await assert.rejects(new BillingService().createPlanPurchaseOrder('Starter', u), (e) => e.code === 'PAYMENT_GATEWAY_UNAVAILABLE');
        assert.strictEqual(new BillingService().verifyPayment(mock.id, mock.mockPayment.paymentId, mock.mockPayment.signature), false);
      } finally { env.NODE_ENV = savedEnv; process.env.NODE_ENV = 'test'; }
    } finally {
      process.env.RAZORPAY_KEY_SECRET = savedSecret;
      BillingService.setRazorpayClientForTests(gw.api);
    }
  });

  await test('invoices: unique consecutive numbers per financial year even under parallel purchases', async () => {
    const { financialYearLabel } = require('../dist/services/InvoiceService');
    assert.strictEqual(financialYearLabel(new Date('2026-11-18T05:00:00Z')), 'FY26-27');
    assert.strictEqual(financialYearLabel(new Date('2027-03-31T17:00:00Z')), 'FY26-27'); // 31 Mar 22:30 IST
    assert.strictEqual(financialYearLabel(new Date('2027-03-31T19:00:00Z')), 'FY27-28'); // 1 Apr 00:30 IST
    const users = await Promise.all([1, 2, 3, 4, 5, 6].map(() => makeUser()));
    const payments = await Promise.all(users.map(async (u) => ({ u, p: pay(await billing().createPlanPurchaseOrder('Starter', u)) })));
    const results = await Promise.all(payments.map(({ u, p }) => verifyPlan(u, p)));
    assert.ok(results.every((r) => r.status === 200), JSON.stringify(results.map((r) => [r.status, r.body.error])));
    const inv = await prisma.invoice.findMany({ where: { userId: { in: users } } });
    assert.strictEqual(inv.length, 6);
    assert.strictEqual(new Set(inv.map((i) => i.invoiceNumber)).size, 6);
    assert.ok(inv.every((i) => /^CLR-FY\d\d-\d\d-\d{4}$/.test(i.invoiceNumber)));
  });

  await test('invoices: no made-up seller GSTIN, correct GST split, customer text escaped', async () => {
    const { InvoiceService } = require('../dist/services/InvoiceService');
    const base = { invoiceNumber: 'CLR-FY26-27-0001', createdAt: new Date(), buyerName: '<script>alert(1)</script>', buyerEmail: 'a@example.org', planName: 'Starter', minutesCredited: 500, subtotalInr: 677.97, gstAmountInr: 122.03, amountInr: 800, gstRate: 18 };
    const receipt = InvoiceService.generateInvoiceHtml({ ...base, sellerGstin: null, buyerGstin: null });
    assert.ok(receipt.includes('PAYMENT RECEIPT') && !receipt.includes('TAX INVOICE'));
    assert.ok(!receipt.includes('<script>alert(1)</script>') && receipt.includes('&lt;script&gt;'));
    const intra = InvoiceService.generateInvoiceHtml({ ...base, sellerGstin: '29ABCDE1234F1Z5', buyerGstin: '29PQRSX5678K1Z2' });
    assert.ok(intra.includes('TAX INVOICE') && intra.includes('CGST (9%)') && intra.includes('SGST (9%)'));
    const inter = InvoiceService.generateInvoiceHtml({ ...base, sellerGstin: '29ABCDE1234F1Z5', buyerGstin: '27PQRSX5678K1Z2' });
    assert.ok(inter.includes('IGST (18%)') && !inter.includes('CGST'));
    const src = fs.readFileSync(path.join(__dirname, '../src/services/InvoiceService.ts'), 'utf8');
    assert.ok(!/process\.env\.COMPANY_GSTIN\s*\|\|\s*'[0-9]{2}[A-Z]/.test(src), 'no hard-coded seller GSTIN fallback');
  });

  await test('routes: duplicate verify route removed, GSTIN rate limited, no unused key/config routes', async () => {
    const paths = billingRouter.stack.filter((l) => l.route).map((l) => l.route.path);
    assert.ok(!paths.includes('/verify-plan-payment'));
    const gst = billingRouter.stack.find((l) => l.route && l.route.path === '/gstin').route.stack.map((s) => s.handle);
    assert.ok(gst.includes(limiters.sensitiveOperationsLimiter));
    // Phase 13: /config, /subscription-status and /sync-entitlements had no caller and were removed;
    // checkout receives the public key id in the create-order response.
    for (const gone of ['/config', '/subscription-status', '/sync-entitlements']) assert.ok(!paths.includes(gone), `${gone} removed`);
    for (const f of ['src/services/BillingService.ts', 'src/routes/billing.ts', 'src/routes/numbers.ts']) {
      assert.ok(!fs.readFileSync(path.join(__dirname, '..', f), 'utf8').includes('rzp_test_TO7mXkVkl4AFCy'), `${f} still has a hard-coded key`);
    }
  });

  console.log(`\nBILLING: ${passed === total ? 'PASS' : 'FAIL'} — ${passed}/${total} tests passed\n`);
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error in billing tests:', err);
  process.exit(1);
});
