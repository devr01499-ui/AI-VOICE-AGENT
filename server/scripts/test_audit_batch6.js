require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
process.env.TZ = 'UTC';
process.env.RAZORPAY_KEY_ID = 'rzp_test_fake_key_for_tests';
process.env.RAZORPAY_KEY_SECRET = 'test_only_checkout_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'test_only_webhook_secret';
/**
 * Audit batch 6 (money and billing correctness), production code; carriers and the payment
 * gateway are local fakes.
 *  #8  a staff catalog row cannot override a built-in plan or another customer's custom plan
 *  #9  an answered call that ends on an error is recorded as completed (it is billed); unanswered = failed
 *  #10 calls orphaned by a restart are hung up and billed on the carrier's duration only
 *  #13 restoring an account turns back on only the API keys the suspension switched off
 *  #14 no carrier keys in production: no fake numbers / calls
 *  #15 repeating a successful paid purchase answers with the number (not "already claimed")
 *  #16 busy / no-answer from the telephony webhook stay busy / no_answer
 *  #18 campaign billed minutes follow the per-call billing rule
 *  #19 a refunded plan takes back its minutes (never more than are left)
 *  #20 a payment for a different plan says so (not "amount does not match")
 *  #21 suspended / restricted accounts cannot start a purchase
 *  #40 a late hangup webhook does not change the duration of a billed call
 * Run: npm run test:audit-batch6   (part of npm run test:security)
 */
const assert = require('assert');
const crypto = require('crypto');
const http = require('http');
const express = require('express');
const { prisma } = require('../dist/lib/prisma');

let total = 0;
let passed = 0;
async function test(name, fn) {
  total++;
  try { await fn(); passed++; console.log(`  ✓ ${name}`); } catch (err) { console.error(`  ✗ FAIL: ${name}\n    ${err.stack || err.message}`); }
}
const uid = () => crypto.randomUUID();
const phone = () => `+9198${Math.floor(10000000 + Math.random() * 89999999)}`;
async function newUser(extra = {}) {
  const id = uid();
  await prisma.user.create({ data: { id, email: `b6-${id.slice(0, 8)}@claritiy-test.co.in`, fullName: 'Batch Six', passwordHash: 'x', accountType: 'developer', callingBalanceMinutes: 100, minutesRemainingSeconds: 6000, ...extra } });
  return id;
}

// Fake Razorpay gateway (same shape as test_billing_verification)
const gw = { orders: new Map(), payments: new Map() };
const gwApi = {
  orders: {
    create: async (o) => { const id = `order_${crypto.randomBytes(7).toString('hex')}`; const order = { id, ...o, notes: o.notes || {} }; gw.orders.set(id, order); return order; },
    fetch: async (id) => gw.orders.get(id),
  },
  payments: { fetch: async (id) => gw.payments.get(id), refund: async (id) => ({ id: `rfnd_${id}` }) },
};
const sign = (o, p) => crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${o}|${p}`).digest('hex');
function pay(order) {
  const id = `pay_${crypto.randomBytes(7).toString('hex')}`;
  gw.payments.set(id, { id, order_id: order.id, amount: order.amount, currency: 'INR', status: 'captured', notes: {}, created_at: Math.floor(Date.now() / 1000) - 60 });
  return { orderId: order.id, paymentId: id, signature: sign(order.id, id) };
}
function invoke(handler, req) {
  return new Promise((resolve) => {
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { resolve({ status: this.statusCode, body: b }); return this; }, send(b) { resolve({ status: this.statusCode, body: b }); return this; }, set() { return this; } };
    Promise.resolve(handler(req, res, (e) => resolve({ status: 500, body: { error: String(e) } })));
  });
}

async function main() {
  console.log('\n--- AUDIT BATCH 6 ---');
  const carrierHangup = require('../dist/core/telephony/carrierHangup');
  const hangups = [];
  carrierHangup.hangupCarrierLeg = async (id) => { hangups.push(id); return 'hung_up'; };
  const { BillingService, PaymentVerificationError } = require('../dist/services/BillingService');
  BillingService.setRazorpayClientForTests(gwApi);
  const { PLAN_CONFIG } = require('../dist/config/plans');

  await test('#8 catalog rows cannot override built-in plans or other customers\' custom plans', async () => {
    const { fulfillPlanPurchase } = require('../dist/services/PlanFulfillmentService');
    await prisma.planCatalog.upsert({ where: { key: 'startup' }, create: { key: 'startup', name: 'Startup', priceInr: 1, minutes: 99999, accountType: 'enterprise' }, update: { minutes: 99999, accountType: 'enterprise' } });
    try {
      const u = await newUser({ minutesRemainingSeconds: 0, callingBalanceMinutes: 0 });
      const t = uid().slice(0, 10);
      await fulfillPlanPurchase({ userId: u, orderId: `order_b6a_${t}`, paymentId: `pay_b6a_${t}`, planKey: 'startup', source: 'self_serve' });
      const row = await prisma.user.findUnique({ where: { id: u } });
      assert.strictEqual(row.minutesRemainingSeconds, PLAN_CONFIG.startup.minutes * 60, 'built-in plan minutes');
    } finally {
      await prisma.planCatalog.deleteMany({ where: { key: 'startup' } });
    }
    const owner = await newUser();
    const other = await newUser();
    const key = `custom_${uid().slice(0, 6)}`;
    await prisma.planCatalog.create({ data: { key, name: 'Custom', priceInr: 5000, minutes: 1234, accountType: 'professional', customerUserId: owner, validityDays: 60 } });
    const t2 = uid().slice(0, 10);
    await assert.rejects(fulfillPlanPurchase({ userId: other, orderId: `order_b6b_${t2}`, paymentId: `pay_b6b_${t2}`, planKey: key, source: 'admin' }), /INVALID_PLAN/);
    const t3 = uid().slice(0, 10);
    const before = Date.now();
    await fulfillPlanPurchase({ userId: owner, orderId: `order_b6c_${t3}`, paymentId: `pay_b6c_${t3}`, planKey: key, source: 'admin' });
    const o = await prisma.user.findUnique({ where: { id: owner } });
    assert.ok(o.planExpiresAt.getTime() - before > 59 * 86400000, 'custom validity (60 days) used');
  });

  const { callOrchestrator } = require('../dist/core/orchestrator/CallOrchestrator');
  const caller = await newUser();
  const agent = await prisma.agent.create({ data: { userId: caller, name: 'B6', status: 'active', systemPrompt: 'x' } });

  await test('#9 an answered call ending on an error is completed (billed); an unanswered one is failed', async () => {
    const answered = await prisma.call.create({ data: { userId: caller, agentId: agent.id, recipientPhoneNumber: phone(), fromPhoneNumber: phone(), callDirection: 'outbound', status: 'in_progress', startTime: new Date(Date.now() - 95000) } });
    await callOrchestrator.endCallSession(answered.id, 'provider_error', 'socket dropped');
    const a = await prisma.call.findUnique({ where: { id: answered.id } });
    assert.strictEqual(a.status, 'completed');
    assert.strictEqual(a.endReason, 'provider_error');
    const never = await prisma.call.create({ data: { userId: caller, agentId: agent.id, recipientPhoneNumber: phone(), fromPhoneNumber: phone(), callDirection: 'outbound', status: 'ringing' } });
    await callOrchestrator.endCallSession(never.id, 'provider_error', 'carrier error');
    const n = await prisma.call.findUnique({ where: { id: never.id } });
    assert.strictEqual(n.status, 'failed');
    assert.ok(!(n.durationSeconds > 0), 'nothing to bill');
  });

  await test('#10 calls orphaned by a restart are hung up and billed on the carrier duration only', async () => {
    const { reapStuckCalls } = require('../dist/utils/concurrency');
    const old = new Date(Date.now() - 2 * 3600 * 1000);
    const known = await prisma.call.create({ data: { userId: caller, agentId: agent.id, recipientPhoneNumber: phone(), fromPhoneNumber: phone(), callDirection: 'outbound', status: 'in_progress', startTime: old, durationSeconds: 125, createdAt: old } });
    const unknown = await prisma.call.create({ data: { userId: caller, agentId: agent.id, recipientPhoneNumber: phone(), fromPhoneNumber: phone(), callDirection: 'outbound', status: 'in_progress', startTime: old, createdAt: old } });
    hangups.length = 0;
    await reapStuckCalls();
    assert.ok(hangups.includes(known.id) && hangups.includes(unknown.id), 'carrier legs hung up');
    const k = await prisma.call.findUnique({ where: { id: known.id } });
    assert.strictEqual(k.status, 'timeout');
    await new Promise((r) => setTimeout(r, 300));
    const ledger = await prisma.minutesLedger.findUnique({ where: { idempotencyKey: `call_usage_${known.id}` } });
    assert.ok(ledger, 'billed');
    assert.strictEqual(-ledger.deltaSeconds || ledger.deltaSeconds, 180, '125 s = 3 started minutes');
    assert.strictEqual(await prisma.minutesLedger.findUnique({ where: { idempotencyKey: `call_usage_${unknown.id}` } }), null, 'no guessing without a carrier duration');
  });

  await test('#13 restore turns back on only the API keys the suspension switched off', async () => {
    const { AccountEnforcementService } = require('../dist/services/AccountEnforcementService');
    const u = await newUser();
    const on = await prisma.apiKey.create({ data: { userId: u, keyHash: uid(), keyPrefix: 'blna_live_', name: 'on', isActive: true } });
    const revoked = await prisma.apiKey.create({ data: { userId: u, keyHash: uid(), keyPrefix: 'blna_live_', name: 'revoked', isActive: false } });
    const staff = { id: uid(), email: 'ops@claritiy-test.co.in', name: 'Ops', role: 'owner', status: 'active' };
    await AccountEnforcementService.suspendAccount({ userId: u, category: 'fraud', details: 'test suspension', staff });
    assert.strictEqual((await prisma.apiKey.findUnique({ where: { id: on.id } })).isActive, false);
    await AccountEnforcementService.restoreAccount({ userId: u, reason: 'test restore', staff });
    assert.strictEqual((await prisma.apiKey.findUnique({ where: { id: on.id } })).isActive, true, 'key the suspension switched off is back');
    assert.strictEqual((await prisma.apiKey.findUnique({ where: { id: revoked.id } })).isActive, false, 'customer-revoked key stays off');
  });

  await test('#14 without carrier keys in production there are no fake numbers or calls', async () => {
    const { PlivoService } = require('../dist/core/telephony/PlivoService');
    const prev = process.env.NODE_ENV;
    const prevId = process.env.PLIVO_AUTH_ID;
    process.env.PLIVO_AUTH_ID = '';
    process.env.NODE_ENV = 'production';
    try {
      const svc = new PlivoService();
      await assert.rejects(svc.searchIndianNumbers({}), /not available/);
      await assert.rejects(svc.initiateCall({ to: '+919800000000', from: '+918000000000', answerUrl: 'https://x', hangupUrl: 'https://x' }), /not available/);
    } finally {
      process.env.NODE_ENV = prev;
      process.env.PLIVO_AUTH_ID = prevId || '';
    }
  });

  await test('#15 repeating a successful paid purchase answers with the number', async () => {
    const { supabaseClient } = require('../dist/utils/supabase');
    const u = await newUser({ numberLocked: true, planExpiresAt: new Date(Date.now() + 20 * 86400000) });
    const email = (await prisma.user.findUnique({ where: { id: u } })).email;
    const orig = supabaseClient.auth.getUser;
    supabaseClient.auth.getUser = async (token) => token === u ? { data: { user: { id: u, email, email_confirmed_at: new Date().toISOString(), user_metadata: {} } }, error: null } : { data: { user: null }, error: { message: 'x' } };
    const num = await prisma.phoneNumber.create({ data: { userId: u, phoneNumber: phone(), countryCode: 'IN', telephonyProvider: 'vobiz', status: 'active', vobizNumberId: `inv-${uid().slice(0, 6)}` } });
    const app = express(); app.use(express.json()); app.use('/api/v2/numbers', require('../dist/routes/numbers').default);
    const server = http.createServer(app); await new Promise((r) => server.listen(0, '127.0.0.1', r));
    try {
      const r = await fetch(`http://127.0.0.1:${server.address().port}/api/v2/numbers/purchase`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${u}` }, body: JSON.stringify({ vobizNumberId: num.vobizNumberId, orderId: 'order_x', paymentId: 'pay_x', signature: 'sig' }) });
      const body = await r.json();
      assert.strictEqual(r.status, 200, JSON.stringify(body));
      assert.strictEqual(body.data.phoneNumberId, num.id);
    } finally {
      server.close();
      supabaseClient.auth.getUser = orig;
    }
  });

  await test('#16 busy / no-answer from the telephony webhook stay busy / no_answer', async () => {
    const { WebhookController } = require('../dist/controllers/WebhookController');
    for (const [carrierStatus, want] of [['busy', 'busy'], ['no-answer', 'no_answer'], ['failed', 'failed']]) {
      const sid = `CA${uid().replace(/-/g, '')}`;
      const c = await prisma.call.create({ data: { userId: caller, agentId: agent.id, recipientPhoneNumber: phone(), fromPhoneNumber: phone(), callDirection: 'outbound', status: 'ringing', providerCallSid: sid } });
      await invoke(WebhookController.handleTelephonyWebhook, { body: { CallSid: sid, CallStatus: carrierStatus }, headers: {}, header: () => '', protocol: 'https', get: () => 'localhost', originalUrl: '/api/v2/telephony/webhook' });
      assert.strictEqual((await prisma.call.findUnique({ where: { id: c.id } })).status, want, carrierStatus);
    }
  });

  await test('#18 campaign billed minutes follow the per-call rule', async () => {
    const { BatchService } = require('../dist/services/BatchService');
    const b = await prisma.batch.create({ data: { userId: caller, agentId: agent.id, name: 'B6', status: 'completed', totalRecipients: 2 } });
    for (const d of [30, 61]) {
      const c = await prisma.call.create({ data: { userId: caller, agentId: agent.id, recipientPhoneNumber: phone(), fromPhoneNumber: phone(), callDirection: 'outbound', status: 'completed', durationSeconds: d, startTime: new Date() } });
      await prisma.batchRecipient.create({ data: { batchId: b.id, phoneNumber: c.recipientPhoneNumber, status: 'completed', callId: c.id, attempts: 1 } });
    }
    const counters = await BatchService.computeBatchCounters(b.id);
    assert.strictEqual(counters.totalBilledMinutes, 3, '30 s = 1 min, 61 s = 2 min');
  });

  await test('#19 a refunded plan takes back its minutes (never more than are left); #20 wrong-plan message', async () => {
    const { razorpayWebhookRouter } = require('../dist/routes/razorpayWebhook');
    const handler = razorpayWebhookRouter.stack.find((l) => l.route && l.route.path === '/razorpay').route.stack.slice(-1)[0].handle;
    const u = await newUser({ minutesRemainingSeconds: 0, callingBalanceMinutes: 0, accountType: 'free' });
    const svc = new BillingService();
    const order = await svc.createPlanPurchaseOrder('Startup', u);
    const p = pay(order);
    await assert.rejects(svc.processPlanPurchase({ userId: u, ...p, clientPlan: 'Growth' }), (e) => e instanceof PaymentVerificationError && /different plan/.test(e.message));
    await svc.processPlanPurchase({ userId: u, ...p, clientPlan: 'Startup' });
    const credited = PLAN_CONFIG.startup.minutes * 60;
    assert.strictEqual((await prisma.user.findUnique({ where: { id: u } })).minutesRemainingSeconds, credited);
    const send = (body) => { const raw = Buffer.from(JSON.stringify(body)); return invoke(handler, { body, rawBody: raw, headers: { 'x-razorpay-signature': crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex'), 'x-razorpay-event-id': uid() } }); };
    const half = Math.round(order.amount / 2);
    const r1 = await send({ event: 'refund.processed', payload: { refund: { entity: { id: `rfnd_${uid().slice(0, 8)}`, payment_id: p.paymentId, amount: half } } } });
    assert.strictEqual(r1.status, 200, JSON.stringify(r1.body));
    const afterHalf = (await prisma.user.findUnique({ where: { id: u } })).minutesRemainingSeconds;
    assert.ok(Math.abs(afterHalf - credited / 2) <= 60, `half the minutes taken back (${afterHalf})`);
    await prisma.user.update({ where: { id: u }, data: { minutesRemainingSeconds: 60 } }); // customer used most of the rest
    await send({ event: 'refund.processed', payload: { refund: { entity: { id: `rfnd_${uid().slice(0, 8)}`, payment_id: p.paymentId, amount: order.amount - half } } } });
    const end = await prisma.user.findUnique({ where: { id: u } });
    assert.strictEqual(end.minutesRemainingSeconds, 0, 'never below zero');
    assert.ok(end.planExpiresAt && end.planExpiresAt.getTime() <= Date.now() + 1000, 'full refund ends the plan');
  });

  await test('#21 suspended or restricted accounts cannot start a purchase', async () => {
    const svc = new BillingService();
    for (const accountStatus of ['suspended', 'restricted']) {
      const u = await newUser({ accountStatus });
      await assert.rejects(svc.createPlanPurchaseOrder('Startup', u), (e) => e.code === 'ACCOUNT_RESTRICTED');
      await assert.rejects(svc.createNumberPurchaseOrder(u, 499, { provider: 'vobiz', numberRef: 'n1' }), (e) => e.code === 'ACCOUNT_RESTRICTED');
    }
  });

  await test('#40 a late hangup webhook does not change the duration of a billed call', async () => {
    const { CallController } = require('../dist/controllers/CallController');
    const done = await prisma.call.create({ data: { userId: caller, agentId: agent.id, recipientPhoneNumber: phone(), fromPhoneNumber: phone(), callDirection: 'outbound', status: 'completed', durationSeconds: 65 } });
    await CallController.recordCarrierDuration(done.id, 130);
    assert.strictEqual((await prisma.call.findUnique({ where: { id: done.id } })).durationSeconds, 65);
    const open = await prisma.call.create({ data: { userId: caller, agentId: agent.id, recipientPhoneNumber: phone(), fromPhoneNumber: phone(), callDirection: 'outbound', status: 'in_progress' } });
    await CallController.recordCarrierDuration(open.id, 130);
    assert.strictEqual((await prisma.call.findUnique({ where: { id: open.id } })).durationSeconds, 130, 'used for billing while open');
  });

  console.log(`\nAudit batch 6: ${passed}/${total} passed`);
  BillingService.setRazorpayClientForTests(null);
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}

main().catch(async (err) => { console.error(err); await prisma.$disconnect().catch(() => {}); process.exit(1); });
