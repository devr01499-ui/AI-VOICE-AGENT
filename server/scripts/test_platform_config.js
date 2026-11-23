require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Admin control panel (fix/admin-panel, owner request 2026-11-23): settings changed from the panel
 * instead of the code. Production services and route handlers against the local TEST database.
 *
 *  P1  a plan edit changes what checkout charges and what limits apply; bad values are refused
 *  P2  a price edit never breaks a payment already started (order carries its own terms)
 *  P3  a plan switched off cannot be bought; reset returns to the code values
 *  P4  stored settings are applied after a restart; a corrupt stored value is ignored
 *  P5  "pause outgoing calls" stops new calls and scheduled calls; paused campaigns resume after
 *  P6  "pause sign-ups" blocks new accounts only (existing customers still sign in)
 *  P7  role caps edited in the panel are enforced; owner caps cannot be edited
 *  P8  assign a plan / extend a plan: correct tier, end date, minutes, once per request
 *  P9  announcements reach every customer's bell and can be removed
 *  P10 public endpoint: live prices + banner, nothing private; admin routes need a reason
 * Run: npm run test:platform-config   (part of npm run test:security)
 */
const assert = require('assert');
const crypto = require('crypto');
const { prisma } = require('../dist/lib/prisma');
const { BillingService, planTermsFromOrderNotes } = require('../dist/services/BillingService');
const { PlatformConfigService, PLATFORM_PAUSE_PREFIX } = require('../dist/services/PlatformConfigService');
const { PLAN_CONFIG, DEFAULT_PLAN_CONFIG, getKbPlanLimits, getPlanConcurrency } = require('../dist/config/plans');

BillingService.setRazorpayClientForTests(null); // dev/test mock gateway (NODE_ENV=test)

let total = 0;
let passed = 0;
async function test(name, fn) {
  total++;
  try { await fn(); passed++; console.log(`  ✓ ${name}`); } catch (err) { console.error(`  ✗ FAIL: ${name}\n    ${err.stack || err.message}`); }
}
function handlerOf(router, method, path) {
  const layer = router.stack.find((l) => l.route && l.route.path === path && l.route.methods[method]);
  if (!layer) throw new Error(`route ${method.toUpperCase()} ${path} not found`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}
function call(fn, { params = {}, query = {}, body = {}, staff, headers = {} } = {}) {
  return new Promise((resolve) => {
    const res = { statusCode: 200, headers: {} };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; resolve(res); return res; };
    res.send = (b) => { res.body = b; resolve(res); return res; };
    res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
    const req = { params, query, body, headers, ip: '127.0.0.1', get: () => 'test-agent', staff };
    Promise.resolve(fn(req, res, (err) => resolve({ statusCode: 'next', body: String(err && err.stack || err) })))
      .catch((e) => resolve({ statusCode: 'threw', body: String(e && e.stack || e) }));
  });
}
const OWNER = { id: `owner-${crypto.randomUUID().slice(0, 8)}`, email: 'owner@claritiy-test.co.in', name: 'Owner', role: 'owner', status: 'active' };
const ctx = (reason = 'test change') => ({ staff: OWNER, reason });

const users = [];
async function newUser(extra = {}) {
  const id = crypto.randomUUID();
  users.push(id);
  await prisma.user.create({ data: { id, email: `pc-${id.slice(0, 8)}@claritiy-test.co.in`, fullName: 'Platform Config', passwordHash: 'x', accountType: 'free', ...extra } });
  return id;
}
async function clearSettings() {
  await prisma.adminSetting.deleteMany({ where: { key: { in: ['platform.plans', 'platform.switches', 'caps_sales'] } } });
  PlatformConfigService.resetForTests();
  await PlatformConfigService.ensureLoaded();
}

async function main() {
  console.log('\n--- PLATFORM CONTROL PANEL ---');
  await clearSettings();
  const billing = new BillingService();

  await test('P1 a plan edit changes checkout price and limits; bad values are refused', async () => {
    const bad = await PlatformConfigService.updatePlan('growth', { price: 0 }, ctx());
    assert.strictEqual(bad.ok, false);
    const bad2 = await PlatformConfigService.updatePlan('growth', { kbLimits: { maxFileSizeMb: 400, maxStorageMb: 100 } }, ctx());
    assert.strictEqual(bad2.ok, false, 'file size larger than storage');
    const bad3 = await PlatformConfigService.updatePlan('nonexistent', { price: 10 }, ctx());
    assert.strictEqual(bad3.ok, false);
    const ok = await PlatformConfigService.updatePlan('growth', { price: 11999, minutes: 3000, maxConcurrentCalls: 7, kbLimits: { maxDocuments: 150 } }, ctx('new growth price'));
    assert.strictEqual(ok.ok, true, JSON.stringify(ok.errors));
    assert.strictEqual(PLAN_CONFIG.growth.price, 11999);
    assert.strictEqual(DEFAULT_PLAN_CONFIG.growth.price, 10799, 'code defaults untouched');
    assert.strictEqual(getKbPlanLimits('professional').maxDocuments, 150, 'limits read by tier follow the edit');
    assert.strictEqual(getPlanConcurrency('professional'), 7);
    const u = await newUser();
    const order = await billing.createPlanPurchaseOrder('growth', u);
    assert.strictEqual(order.amount, 1199900);
    const log = await prisma.adminAuditLog.findFirst({ where: { action: 'platform:plan_update', targetId: 'growth' }, orderBy: { createdAt: 'desc' } });
    assert.strictEqual(log.reason, 'new growth price');
    assert.strictEqual(log.before.price, 10799);
    assert.strictEqual(log.after.price, 11999);
  });

  await test('P2 a payment started before a price edit is fulfilled with its own price and minutes', async () => {
    const u = await newUser();
    const order = await billing.createPlanPurchaseOrder('startup', u); // 3799 / 750 (defaults)
    assert.strictEqual(order.amount, 379900);
    await PlatformConfigService.updatePlan('startup', { price: 4999, minutes: 900 }, ctx('price rise'));
    const r = await billing.processPlanPurchase({ userId: u, orderId: order.orderId, paymentId: order.mockPayment.paymentId, signature: order.mockPayment.signature });
    assert.strictEqual(r.planKey, 'startup');
    const user = await prisma.user.findUnique({ where: { id: u } });
    assert.strictEqual(user.minutesRemainingSeconds, 750 * 60, 'the minutes shown at checkout');
    const tx = await prisma.paymentTransaction.findFirst({ where: { userId: u } });
    assert.strictEqual(tx.amount, 3799, 'recorded at the price paid');
    // Webhook/reconciliation path uses the same order terms; an order without terms uses the live price.
    assert.deepStrictEqual(planTermsFromOrderNotes({ planPricePaise: '379900', planMinutes: '750' }, PLAN_CONFIG.startup), { pricePaise: 379900, minutes: 750 });
    assert.deepStrictEqual(planTermsFromOrderNotes({}, PLAN_CONFIG.startup), { pricePaise: 499900, minutes: 900 });
    const { fulfilCapturedPlanPayment } = require('../dist/services/PaymentReconciliationService');
    const u2 = await newUser();
    const outcome = await fulfilCapturedPlanPayment({ paymentId: `pay_pc_${u2.slice(0, 8)}`, orderId: `order_pc_${u2.slice(0, 8)}`, amountPaise: 379900, currency: 'INR', status: 'captured', notes: { userId: u2, purpose: 'plan', planKey: 'startup', planPricePaise: '379900', planMinutes: '750' }, via: 'webhook' });
    assert.strictEqual(outcome, 'fulfilled');
    assert.strictEqual((await prisma.user.findUnique({ where: { id: u2 } })).minutesRemainingSeconds, 750 * 60);
    const forged = await fulfilCapturedPlanPayment({ paymentId: `pay_pc2_${u2.slice(0, 8)}`, orderId: `order_pc2_${u2.slice(0, 8)}`, amountPaise: 100, currency: 'INR', status: 'captured', notes: { userId: u2, purpose: 'plan', planKey: 'startup', planPricePaise: '379900', planMinutes: '750' }, via: 'webhook' });
    assert.strictEqual(forged, 'rejected', 'paid amount must equal the order terms');
  });

  await test('P3 a plan switched off cannot be bought; reset returns to the code values', async () => {
    await PlatformConfigService.updatePlan('enterprise', { purchasable: false }, ctx('sold out'));
    const u = await newUser();
    await assert.rejects(billing.createPlanPurchaseOrder('enterprise', u), (e) => e.code === 'PLAN_NOT_AVAILABLE');
    assert.strictEqual(PlatformConfigService.getPublicState().plans.find((p) => p.key === 'enterprise').purchasable, false);
    const reset = await PlatformConfigService.resetPlan('enterprise', ctx('back on sale'));
    assert.strictEqual(reset.ok, true);
    assert.strictEqual(PLAN_CONFIG.enterprise.purchasable, true);
    assert.strictEqual(PLAN_CONFIG.enterprise.price, DEFAULT_PLAN_CONFIG.enterprise.price);
    await PlatformConfigService.resetPlan('growth', ctx('reset'));
    await PlatformConfigService.resetPlan('startup', ctx('reset'));
    assert.strictEqual(PLAN_CONFIG.growth.price, 10799);
    assert.strictEqual(getPlanConcurrency('professional'), DEFAULT_PLAN_CONFIG.growth.maxConcurrentCalls);
  });

  await test('P4 stored settings are applied after a restart; a corrupt stored value is ignored', async () => {
    await prisma.adminSetting.upsert({
      where: { key: 'platform.plans' },
      create: { key: 'platform.plans', value: { overrides: { starter: { price: 999, minutes: 600 }, trial: { price: -5 } } } },
      update: { value: { overrides: { starter: { price: 999, minutes: 600 }, trial: { price: -5 } } } },
    });
    PlatformConfigService.resetForTests();
    assert.strictEqual(PLAN_CONFIG.starter.price, DEFAULT_PLAN_CONFIG.starter.price, 'reset to defaults');
    await PlatformConfigService.ensureLoaded();
    assert.strictEqual(PLAN_CONFIG.starter.price, 999);
    assert.strictEqual(PLAN_CONFIG.starter.minutes, 600);
    assert.strictEqual(PLAN_CONFIG.trial.price, DEFAULT_PLAN_CONFIG.trial.price, 'invalid stored trial price ignored');
    await clearSettings();
    assert.strictEqual(PLAN_CONFIG.starter.price, DEFAULT_PLAN_CONFIG.starter.price);
  });

  await test('P5 pausing outgoing calls stops calls and scheduled calls; paused campaigns resume after', async () => {
    const u = await newUser({ accountType: 'professional', minutesRemainingSeconds: 6000, planExpiresAt: new Date(Date.now() + 86400000) });
    const agent = await prisma.agent.create({ data: { userId: u, name: 'Pause test', systemPrompt: 'x' } });
    const on = await PlatformConfigService.updateSwitches({ outboundCallingPaused: true, outboundPausedMessage: 'Carrier maintenance tonight.' }, ctx('carrier outage'));
    assert.strictEqual(on.ok, true, JSON.stringify(on.errors));
    const { CallService } = require('../dist/services/CallService');
    await assert.rejects(
      CallService.createCall({ phoneNumber: '+919876543210', agentId: agent.id, userId: u }),
      (e) => /paused/i.test(e.message) && JSON.stringify(e.details || e.errors || '').includes('Carrier maintenance tonight.')
    );
    const sc = await prisma.scheduledCall.create({ data: { source: 'test', agentId: agent.id, phoneNumber: '+919876543210', scheduledAtUtc: new Date(Date.now() - 60000), timezone: 'Asia/Kolkata', idempotencyKey: `pc_${crypto.randomUUID()}` } });
    const { runScheduledCalls } = require('../dist/services/ScheduledCallService');
    const report = await runScheduledCalls(new Date(), { ids: [sc.id] });
    assert.strictEqual(report.claimed, 0);
    assert.strictEqual((await prisma.scheduledCall.findUnique({ where: { id: sc.id } })).status, 'scheduled', 'left for later');
    const batch = await prisma.batch.create({ data: { userId: u, agentId: agent.id, name: 'Paused campaign', status: 'paused', statusReason: PLATFORM_PAUSE_PREFIX } });
    const { BatchService } = require('../dist/services/BatchService');
    await BatchService.recoverStaleBatches({ dispatch: false });
    assert.strictEqual((await prisma.batch.findUnique({ where: { id: batch.id } })).status, 'paused', 'stays paused while the switch is on');
    const off = await PlatformConfigService.updateSwitches({ outboundCallingPaused: false }, ctx('carrier back'));
    assert.strictEqual(off.ok, true);
    await BatchService.recoverStaleBatches({ dispatch: false });
    assert.strictEqual((await prisma.batch.findUnique({ where: { id: batch.id } })).status, 'running', 'resumed by itself');
    await prisma.batch.delete({ where: { id: batch.id } }).catch(() => {});
    await prisma.scheduledCall.delete({ where: { id: sc.id } }).catch(() => {});
  });

  await test('P6 pausing sign-ups blocks new accounts only', async () => {
    const r = await PlatformConfigService.updateSwitches({ signupsPaused: true }, ctx('launch prep'));
    assert.strictEqual(r.ok, true);
    const { publicUserRouter } = require('../dist/routes/user');
    const validate = handlerOf(publicUserRouter, 'post', '/validate-signup');
    const v = await call(validate, { body: { email: 'new.person@claritiy-test.co.in' } });
    assert.strictEqual(v.statusCode, 403);
    assert.strictEqual(v.body.code, 'SIGNUPS_PAUSED');
    assert.ok(/paused/i.test(v.body.error), 'readable message for the sign-up form');
    const supa = require('../dist/utils/supabase');
    const { requireAuth } = require('../dist/middleware/auth');
    const existing = await newUser({ accountType: 'professional' });
    const existingEmail = (await prisma.user.findUnique({ where: { id: existing } })).email;
    const brandNew = crypto.randomUUID();
    const original = supa.supabaseClient.auth.getUser;
    const who = { id: existing, email: existingEmail };
    supa.supabaseClient.auth.getUser = async () => ({ data: { user: { id: who.id, email: who.email, email_confirmed_at: new Date().toISOString(), user_metadata: { full_name: 'Platform Config' } } }, error: null });
    const authAs = () => new Promise((resolve) => {
      const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; resolve(this); return this; }, setHeader() {} };
      const now = Math.floor(Date.now() / 1000);
      const token = `x.${Buffer.from(JSON.stringify({ sub: who.id, iat: now })).toString('base64')}.y`;
      requireAuth({ headers: { authorization: `Bearer ${token}` }, ip: '127.0.0.1', path: '/x', get: () => 'test' }, res, () => resolve({ statusCode: 'next' }));
    });
    try {
      assert.strictEqual((await authAs()).statusCode, 'next', 'existing customer signs in');
      who.id = brandNew;
      who.email = `brand-new-${brandNew.slice(0, 6)}@claritiy-test.co.in`;
      const denied = await authAs();
      assert.strictEqual(denied.statusCode, 403);
      assert.strictEqual(denied.body.error, 'SIGNUPS_PAUSED');
      assert.strictEqual(await prisma.user.findUnique({ where: { id: brandNew } }), null, 'no account row created');
    } finally {
      supa.supabaseClient.auth.getUser = original;
      await PlatformConfigService.updateSwitches({ signupsPaused: false }, ctx('open again'));
    }
  });

  await test('P7 role caps edited in the panel are enforced; owner caps cannot be edited', async () => {
    const { validateGrantCap } = require('../dist/admin/capEnforcement');
    const bad = await PlatformConfigService.updateRoleCaps('owner', { maxMinutesPerGrant: 1 }, ctx());
    assert.strictEqual(bad.ok, false);
    const incoherent = await PlatformConfigService.updateRoleCaps('sales', { maxMinutesPerGrant: 500, maxMinutesPerDay: 100, maxDiscountPercent: 10, canGrant: true, canDeduct: false }, ctx());
    assert.strictEqual(incoherent.ok, false, 'per-action above daily');
    const ok = await PlatformConfigService.updateRoleCaps('sales', { maxMinutesPerGrant: 10, maxMinutesPerDay: 50, maxDiscountPercent: 5, canGrant: true, canDeduct: false }, ctx('tighter sales caps'));
    assert.strictEqual(ok.ok, true);
    assert.ok(await validateGrantCap('sales', `staff-${crypto.randomUUID()}`, 20), '20 > new per-action cap 10');
    assert.strictEqual(await validateGrantCap('sales', `staff-${crypto.randomUUID()}`, 10), null);
    const view = await PlatformConfigService.getAdminView();
    assert.strictEqual(view.caps.sales.maxMinutesPerGrant, 10);
    assert.strictEqual(view.caps.owner.maxMinutesPerGrant, null, 'owner shown as unlimited');
    await prisma.adminSetting.deleteMany({ where: { key: 'caps_sales' } });
  });

  await test('P8 assign and extend a plan: tier, end date, minutes, once per request', async () => {
    const { adminRouter } = require('../dist/routes/adminRoutes');
    const assign = handlerOf(adminRouter, 'post', '/customers/:id/plan/assign');
    const extend = handlerOf(adminRouter, 'post', '/customers/:id/plan/extend');
    const u = await newUser();
    const key = crypto.randomUUID();
    const body = { planKey: 'growth', reason: 'goodwill upgrade', idempotencyKey: key };
    const a = await call(assign, { params: { id: u }, body, staff: OWNER });
    assert.strictEqual(a.statusCode, 200, JSON.stringify(a.body));
    const again = await call(assign, { params: { id: u }, body, staff: OWNER });
    assert.strictEqual(again.statusCode, 200);
    const user = await prisma.user.findUnique({ where: { id: u } });
    assert.strictEqual(user.accountType, 'professional');
    assert.strictEqual(user.minutesRemainingSeconds, PLAN_CONFIG.growth.minutes * 60, 'minutes added once');
    const days = Math.round((user.planExpiresAt.getTime() - Date.now()) / 86400000);
    assert.ok(days === 30, `30-day validity, got ${days}`);
    const e = await call(extend, { params: { id: u }, body: { days: 10, reason: 'outage compensation', idempotencyKey: crypto.randomUUID() }, staff: OWNER });
    assert.strictEqual(e.statusCode, 200, JSON.stringify(e.body));
    const after = await prisma.user.findUnique({ where: { id: u } });
    assert.strictEqual(Math.round((after.planExpiresAt.getTime() - user.planExpiresAt.getTime()) / 86400000), 10);
    const noMinutes = await newUser();
    const b = await call(assign, { params: { id: noMinutes }, body: { planKey: 'startup', creditMinutes: false, validityDays: 7, reason: 'trial extension', idempotencyKey: crypto.randomUUID() }, staff: OWNER });
    assert.strictEqual(b.statusCode, 200);
    const nm = await prisma.user.findUnique({ where: { id: noMinutes } });
    assert.strictEqual(nm.minutesRemainingSeconds, 0);
    assert.strictEqual(nm.accountType, 'developer');
    const adminAcct = await newUser({ accountType: 'admin' });
    const refused = await call(assign, { params: { id: adminAcct }, body: { planKey: 'growth', reason: 'x y z', idempotencyKey: crypto.randomUUID() }, staff: OWNER });
    assert.strictEqual(refused.statusCode, 409, 'platform admin account is never downgraded');
    const support = { ...OWNER, id: `support-${crypto.randomUUID().slice(0, 6)}`, role: 'support' };
    const { hasPermission } = require('../dist/admin/permissions');
    assert.strictEqual(hasPermission(support.role, 'plans:assign'), false, 'support cannot give plans away');
  });

  await test('P9 announcements reach every customer and can be removed', async () => {
    const { adminRouter } = require('../dist/routes/adminRoutes');
    const { NotificationService } = require('../dist/services/NotificationService');
    const post = handlerOf(adminRouter, 'post', '/announcements');
    const del = handlerOf(adminRouter, 'post', '/announcements/:id/delete');
    const text = `Planned maintenance ${crypto.randomUUID().slice(0, 6)}`;
    const r = await call(post, { body: { message: text, isImportant: true, reason: 'maintenance notice' }, staff: OWNER });
    assert.strictEqual(r.statusCode, 201, JSON.stringify(r.body));
    const u = await newUser();
    const seen = (await NotificationService.getForUser(u)).find((n) => n.message === text);
    assert.ok(seen, 'in the customer bell');
    const d = await call(del, { params: { id: r.body.data.id }, body: { reason: 'done' }, staff: OWNER });
    assert.strictEqual(d.statusCode, 200);
    assert.ok(!(await NotificationService.getForUser(u)).find((n) => n.message === text), 'gone');
  });

  await test('P10 public endpoint shows live prices and banner only; admin changes need a reason', async () => {
    await PlatformConfigService.updateSwitches({ maintenanceBanner: { enabled: true, message: 'Calls may drop 2-3 AM IST', level: 'warning' } }, ctx('banner'));
    const { publicPlatformRouter } = require('../dist/routes/publicPlatform');
    const r = await call(handlerOf(publicPlatformRouter, 'get', '/platform'));
    assert.strictEqual(r.statusCode, 200);
    const s = JSON.stringify(r.body);
    assert.strictEqual(r.body.data.banner.message, 'Calls may drop 2-3 AM IST');
    assert.strictEqual(r.body.data.plans.find((p) => p.key === 'growth').price, PLAN_CONFIG.growth.price);
    for (const word of ['caps', 'updatedBy', 'outboundPausedMessage', 'email', 'reason']) assert.ok(!s.includes(word), `no ${word}`);
    const noBanner = await PlatformConfigService.updateSwitches({ maintenanceBanner: { enabled: true, message: '' } }, ctx('x y z'));
    assert.strictEqual(noBanner.ok, false, 'a banner needs a message');
    const { adminRouter } = require('../dist/routes/adminRoutes');
    const put = handlerOf(adminRouter, 'put', '/platform/plans/:key');
    const noReason = await call(put, { params: { key: 'growth' }, body: { plan: { price: 1 } }, staff: OWNER });
    assert.strictEqual(noReason.statusCode, 400);
    const invalid = await call(put, { params: { key: 'growth' }, body: { plan: { price: 'cheap' }, reason: 'try it' }, staff: OWNER });
    assert.strictEqual(invalid.statusCode, 400);
    assert.strictEqual(PLAN_CONFIG.growth.price, 10799, 'nothing applied');
  });

  console.log(`\nPlatform control panel: ${passed}/${total} passed`);
}

main()
  .catch((e) => { console.error(e); total++; })
  .finally(async () => {
    await clearSettings().catch(() => {});
    for (const id of users) {
      await prisma.minutesLedger.deleteMany({ where: { userId: id } }).catch(() => {});
      await prisma.invoice.deleteMany({ where: { userId: id } }).catch(() => {});
      await prisma.paymentTransaction.deleteMany({ where: { userId: id } }).catch(() => {});
      await prisma.auditLog.deleteMany({ where: { workspaceOwnerId: id } }).catch(() => {});
      await prisma.agent.deleteMany({ where: { userId: id } }).catch(() => {});
      await prisma.user.delete({ where: { id } }).catch(() => {});
    }
    await prisma.$disconnect();
    process.exit(passed === total ? 0 : 1);
  });
