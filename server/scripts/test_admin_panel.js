require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Admin console backend (fix/admin-panel, 2026-11-23) — production route handlers and services
 * against the local TEST database. Razorpay is an in-memory fake (setRazorpayClientForTests);
 * Supabase token checks are stubbed on the real client object.
 *
 *  A1  customer profile never sends secrets (password hash, BYOK AI key, calendar tokens, carrier token);
 *      KYC numbers are masked; "total spent" counts completed payments
 *  A2  grant/deduct: minutes must be a real number in range, the customer must exist, an
 *      idempotency key is required and a repeat does not credit twice
 *  A3  notes / follow-ups / profile: bad input is a 400 (not a 500), unknown customer is a 404,
 *      profile changes are audited
 *  A4  refunds: a failed gateway refund is NOT recorded as refunded; a refund takes back the
 *      minutes that purchase added; a second refund is refused
 *  A5  payment links are real gateway links (no made-up URL), priced by the server, and the paid
 *      link credits the minutes the link promised
 *  A6  custom plans: no built-in key, no duplicate key, sane numbers, discount computed by the server
 *  A7  staff auth: the owner also needs two-factor; staff rate limit is per person
 *  A8  number order "retry" (which stranded customers) is replaced by an audited "resolve";
 *      KYC bypass routes are gone; terminating an unknown call is a 404
 *  A9  exports are recorded as sensitive reads; staff invite validates the email
 * Run: npm run test:admin-panel   (part of npm run test:security)
 */
const assert = require('assert');
const crypto = require('crypto');
const { prisma } = require('../dist/lib/prisma');
const { BillingService } = require('../dist/services/BillingService');

// ── Fake Razorpay gateway (installed before any route module builds a BillingService) ──
const gw = {
  refundShouldFail: false,
  refunds: [],
  links: [],
  api: {
    orders: { create: async (o) => ({ id: `order_${crypto.randomUUID().slice(0, 12)}`, ...o }), fetch: async () => ({}) },
    payments: {
      fetch: async () => ({}),
      refund: async (id, o) => {
        if (gw.refundShouldFail) throw new Error('gateway down');
        gw.refunds.push({ id, ...o });
        return { id: `rfnd_${crypto.randomUUID().slice(0, 10)}` };
      },
    },
    paymentLink: {
      create: async (o) => {
        const id = `plink_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`;
        gw.links.push({ id, ...o });
        return { id, short_url: `https://rzp.io/i/${id.slice(6, 14)}`, status: 'created', ...o };
      },
      cancel: async (id) => ({ id, status: 'cancelled' }),
    },
  },
};
BillingService.setRazorpayClientForTests(gw.api);

let total = 0;
let passed = 0;
async function test(name, fn) {
  total++;
  try { await fn(); passed++; console.log(`  ✓ ${name}`); } catch (err) { console.error(`  ✗ FAIL: ${name}\n    ${err.stack || err.message}`); }
}
function routeLayer(router, method, path) {
  return router.stack.find((l) => l.route && l.route.path === path && l.route.methods[method]);
}
function handlerOf(router, method, path) {
  const layer = routeLayer(router, method, path);
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
    const req = { params, query, body, headers, ip: '127.0.0.1', get: () => 'test-agent', staff, app: { get: () => 1 } };
    Promise.resolve(fn(req, res, (err) => resolve({ statusCode: 'next', body: String(err && err.stack || err) })))
      .catch((e) => resolve({ statusCode: 'threw', body: String(e && e.stack || e) }));
  });
}
const OWNER = { id: `owner-${crypto.randomUUID().slice(0, 8)}`, email: 'owner@claritiy-test.co.in', name: 'Owner', role: 'owner', status: 'active' };
const SALES = { id: `sales-${crypto.randomUUID().slice(0, 8)}`, email: 'sales@claritiy-test.co.in', name: 'Sales', role: 'sales', status: 'active' };

const users = [];
async function newUser(extra = {}) {
  const id = crypto.randomUUID();
  users.push(id);
  await prisma.user.create({ data: { id, email: `adm-${id.slice(0, 8)}@claritiy-test.co.in`, fullName: 'Admin Panel Test', passwordHash: 'secret-hash', accountType: 'professional', ...extra } });
  return id;
}

async function main() {
  console.log('\n--- ADMIN PANEL BACKEND ---');
  const { adminRouter } = require('../dist/routes/adminRoutes');
  const h = (m, p) => handlerOf(adminRouter, m, p);

  await test('A1 customer profile has no secrets, masks KYC numbers, counts completed payments', async () => {
    const id = await newUser({ geminiApiKey: 'AIza-customer-own-key', googleCalendarTokens: 'enc:tokens' });
    await prisma.vobizSubAccount.create({ data: { userId: id, authId: 'SA_TEST', authToken: 'sub-account-secret-token' } });
    await prisma.kycDocument.create({ data: { userId: id, documentType: 'pan', status: 'verified', panNumber: 'ABCDE1234F', aadhaarNumber: '123412341234' } });
    await prisma.paymentTransaction.create({ data: { userId: id, orderId: `o_${id}`, paymentId: `p_${id}`, planName: 'Growth', amount: 10799, currency: 'INR', status: 'completed', source: 'self_serve' } });
    const r = await call(h('get', '/customers/:id'), { params: { id }, staff: OWNER });
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body).slice(0, 300));
    const text = JSON.stringify(r.body);
    for (const secret of ['secret-hash', 'AIza-customer-own-key', 'enc:tokens', 'sub-account-secret-token', 'ABCDE1234F', '123412341234']) {
      assert.ok(!text.includes(secret), `leaked: ${secret}`);
    }
    assert.strictEqual(r.body.data.vobizSubAccount.authId, 'SA_TEST', 'safe sub-account fields still shown');
    assert.ok(/1234$/.test(r.body.data.kycDocuments[0].aadhaarNumber || ''), 'last 4 digits kept');
    assert.strictEqual(r.body.data.stats.totalSpentInr, 10799, 'completed payments count as spent');
  });

  await test('A2 grant: bad minutes are 400, unknown customer 404, key required, repeat credits once', async () => {
    const id = await newUser();
    const grant = h('post', '/customers/:id/minutes/grant');
    for (const minutes of ['abc', -5, 0, 1e9, null]) {
      const r = await call(grant, { params: { id }, body: { minutes, reason: 'goodwill', idempotencyKey: crypto.randomUUID() }, staff: OWNER });
      assert.strictEqual(r.statusCode, 400, `minutes=${minutes}: ${JSON.stringify(r.body)}`);
    }
    const noKey = await call(grant, { params: { id }, body: { minutes: 10, reason: 'goodwill' }, staff: OWNER });
    assert.strictEqual(noKey.statusCode, 400, 'idempotency key required');
    const missing = await call(grant, { params: { id: crypto.randomUUID() }, body: { minutes: 10, reason: 'nobody here', idempotencyKey: crypto.randomUUID() }, staff: OWNER });
    assert.strictEqual(missing.statusCode, 404);
    const key = crypto.randomUUID();
    const a = await call(grant, { params: { id }, body: { minutes: 10, reason: 'goodwill', idempotencyKey: key }, staff: OWNER });
    const b = await call(grant, { params: { id }, body: { minutes: 10, reason: 'goodwill', idempotencyKey: key }, staff: OWNER });
    assert.strictEqual(a.statusCode, 200, JSON.stringify(a.body));
    assert.strictEqual(b.statusCode, 200);
    const u = await prisma.user.findUnique({ where: { id } });
    assert.strictEqual(u.minutesRemainingSeconds, 600, 'credited once');
    const deduct = h('post', '/customers/:id/minutes/deduct');
    const over = await call(deduct, { params: { id }, body: { minutes: 50, reason: 'correction', idempotencyKey: crypto.randomUUID() }, staff: OWNER });
    assert.strictEqual(over.statusCode, 400, 'more than the balance is a clear 400, not a 500');
  });

  await test('A3 notes, follow-ups and profile validate input and audit changes', async () => {
    const id = await newUser();
    const note = await call(h('post', '/customers/:id/notes'), { params: { id }, body: { body: { evil: true } }, staff: OWNER });
    assert.strictEqual(note.statusCode, 400);
    const noteMissing = await call(h('post', '/customers/:id/notes'), { params: { id: crypto.randomUUID() }, body: { body: 'hello' }, staff: OWNER });
    assert.strictEqual(noteMissing.statusCode, 404);
    const fu = await call(h('post', '/customers/:id/follow-ups'), { params: { id }, body: { note: 'call back', dueAt: 'not-a-date' }, staff: OWNER });
    assert.strictEqual(fu.statusCode, 400);
    const fuOk = await call(h('post', '/customers/:id/follow-ups'), { params: { id }, body: { note: 'call back', dueAt: new Date(Date.now() + 86400000).toISOString() }, staff: OWNER });
    assert.strictEqual(fuOk.statusCode, 201);
    const done = await call(h('post', '/customers/:id/follow-ups/:followUpId/done'), { params: { id, followUpId: fuOk.body.data.id }, staff: OWNER });
    assert.strictEqual(done.statusCode, 200);
    assert.ok((await prisma.followUp.findUnique({ where: { id: fuOk.body.data.id } })).doneAt, 'marked done');
    const bad = await call(h('patch', '/customers/:id/profile'), { params: { id }, body: { riskLevel: 'extreme', reason: 'x' }, staff: OWNER });
    assert.strictEqual(bad.statusCode, 400);
    const ghost = await call(h('patch', '/customers/:id/profile'), { params: { id: crypto.randomUUID() }, body: { riskLevel: 'watch', reason: 'x' }, staff: OWNER });
    assert.strictEqual(ghost.statusCode, 404, 'no profile for a customer that does not exist');
    const ok = await call(h('patch', '/customers/:id/profile'), { params: { id }, body: { riskLevel: 'watch', tags: ['vip'], reason: 'chargeback risk' }, staff: OWNER });
    assert.strictEqual(ok.statusCode, 200, JSON.stringify(ok.body));
    const log = await prisma.adminAuditLog.findFirst({ where: { customerId: id, action: 'customers:profile_update' } });
    assert.ok(log, 'profile change audited');
  });

  await test('A4 refund: gateway failure is not "refunded"; success takes the minutes back; no double refund', async () => {
    const id = await newUser();
    const { fulfillPlanPurchase } = require('../dist/services/PlanFulfillmentService');
    const r0 = await fulfillPlanPurchase({ userId: id, orderId: `order_rf_${id}`, paymentId: `pay_rf_${id}`, planKey: 'startup', source: 'self_serve' });
    const txId = r0.paymentTransaction.id;
    const refund = h('post', '/payments/:id/refund');
    gw.refundShouldFail = true;
    const failed = await call(refund, { params: { id: txId }, body: { reason: 'customer asked' }, staff: OWNER });
    gw.refundShouldFail = false;
    assert.strictEqual(failed.statusCode, 502, JSON.stringify(failed.body));
    assert.strictEqual((await prisma.paymentTransaction.findUnique({ where: { id: txId } })).status, 'completed', 'still completed');
    const ok = await call(refund, { params: { id: txId }, body: { reason: 'customer asked' }, staff: OWNER });
    assert.strictEqual(ok.statusCode, 200, JSON.stringify(ok.body));
    assert.strictEqual((await prisma.paymentTransaction.findUnique({ where: { id: txId } })).status, 'refunded');
    assert.strictEqual(gw.refunds.filter((x) => x.id === `pay_rf_${id}`).length, 1);
    assert.strictEqual(gw.refunds.find((x) => x.id === `pay_rf_${id}`).amount, 379900, 'full amount in paise');
    const u = await prisma.user.findUnique({ where: { id } });
    assert.strictEqual(u.minutesRemainingSeconds, 0, 'the 750 purchased minutes were taken back');
    const again = await call(refund, { params: { id: txId }, body: { reason: 'again' }, staff: OWNER });
    assert.strictEqual(again.statusCode, 409);
    assert.strictEqual(gw.refunds.filter((x) => x.id === `pay_rf_${id}`).length, 1, 'gateway called once');
  });

  await test('A5 payment link: real gateway link, server price, paid link credits the promised minutes', async () => {
    const id = await newUser();
    const create = h('post', '/payments/create-link');
    const noPlan = await call(create, { body: { customerUserId: id, amountInr: 1, minutes: 99999, reason: 'deal' }, staff: OWNER });
    assert.strictEqual(noPlan.statusCode, 400, 'a plan is required; the browser cannot set price/minutes');
    const r = await call(create, { body: { customerUserId: id, planKey: 'growth', discountPercent: 10, reason: 'annual deal' }, staff: OWNER });
    assert.strictEqual(r.statusCode, 201, JSON.stringify(r.body));
    const link = r.body.data;
    assert.ok(link.shortUrl.startsWith('https://rzp.io/'), 'gateway URL, not a made-up one');
    assert.strictEqual(link.amountInr, 9719, '10% off 10,799 rounded to the rupee');
    assert.strictEqual(link.minutes, 2865);
    const sent = gw.links.find((l) => l.id === link.razorpayLinkId);
    assert.strictEqual(sent.amount, 971900);
    assert.strictEqual(sent.notes.userId, id);
    const salesOver = await call(create, { body: { customerUserId: id, planKey: 'growth', discountPercent: 40, reason: 'x' }, staff: SALES });
    assert.strictEqual(salesOver.statusCode, 403, 'sales cap is 15%');
    // The paid-link webhook credits the link's minutes and price.
    const { handlePaymentLinkPaidForTests } = require('../dist/routes/razorpayWebhook');
    await handlePaymentLinkPaidForTests({ payment_link: { entity: { id: link.razorpayLinkId } }, payment: { entity: { id: `pay_link_${id.slice(0, 8)}`, order_id: `order_link_${id.slice(0, 8)}`, amount: 971900, currency: 'INR' } } });
    const u = await prisma.user.findUnique({ where: { id } });
    assert.strictEqual(u.minutesRemainingSeconds, 2865 * 60);
    assert.strictEqual((await prisma.paymentLink.findUnique({ where: { id: link.id } })).status, 'paid');
  });

  await test('A6 custom plan: rejects built-in keys, duplicates and nonsense; discount is computed', async () => {
    const create = h('post', '/plans/custom');
    const id = await newUser();
    const builtIn = await call(create, { body: { key: 'growth', name: 'Growth copy', priceInr: 1, minutes: 99999, accountType: 'professional', reason: 'x' }, staff: OWNER });
    assert.strictEqual(builtIn.statusCode, 400);
    for (const body of [{ name: 'X', priceInr: -1, minutes: 10 }, { name: 'X', priceInr: 100, minutes: 'lots' }, { name: '', priceInr: 100, minutes: 10 }]) {
      const r = await call(create, { body: { ...body, accountType: 'professional', reason: 'x' }, staff: OWNER });
      assert.strictEqual(r.statusCode, 400, JSON.stringify(body));
    }
    const key = `deal_${crypto.randomUUID().slice(0, 6)}`;
    const ok = await call(create, { body: { key, name: 'Acme deal', priceInr: 5000, minutes: 2000, accountType: 'professional', customerUserId: id, validityDays: 60, reason: 'negotiated' }, staff: OWNER });
    assert.strictEqual(ok.statusCode, 201, JSON.stringify(ok.body));
    assert.ok(ok.body.data.discountPercent > 0, 'server computed the discount vs list price per minute');
    const dup = await call(create, { body: { key, name: 'Again', priceInr: 5000, minutes: 2000, accountType: 'professional', reason: 'x' }, staff: OWNER });
    assert.strictEqual(dup.statusCode, 409);
    const salesDeep = await call(create, { body: { name: 'Too cheap', priceInr: 100, minutes: 5000, accountType: 'professional', reason: 'x' }, staff: SALES });
    assert.strictEqual(salesDeep.statusCode, 403, 'a 98% discount is over the sales cap even when the browser says 0');
    const off = await call(h('patch', '/plans/:id'), { params: { id: ok.body.data.id }, body: { active: false, reason: 'deal ended' }, staff: OWNER });
    assert.strictEqual(off.statusCode, 200);
    assert.strictEqual((await prisma.planCatalog.findUnique({ where: { key } })).active, false);
    await prisma.planCatalog.delete({ where: { key } }).catch(() => {});
  });

  await test('A7 staff auth: owner needs two-factor; rate limit is per staff member', async () => {
    const supa = require('../dist/utils/supabase');
    const { requireStaff, resetStaffRateLimitForTests } = require('../dist/middleware/requireStaff');
    const email = `owner-${crypto.randomUUID().slice(0, 6)}@claritiy-test.co.in`;
    const staffRow = await prisma.staffUser.create({ data: { email, name: 'Owner', role: 'owner', status: 'active' } });
    const original = supa.supabaseClient.auth.getUser;
    const prevStrict = process.env.ENABLE_STRICT_AUTH;
    process.env.ENABLE_STRICT_AUTH = 'true';
    const tokenFor = (aal) => `x.${Buffer.from(JSON.stringify({ aal, sub: 'u' })).toString('base64')}.y`;
    supa.supabaseClient.auth.getUser = async () => ({ data: { user: { email, app_metadata: {} } }, error: null });
    try {
      const mw = requireStaff('customers:view');
      const run = (token) => call(mw, { headers: { authorization: `Bearer ${token}` } });
      const aal1 = await run(tokenFor('aal1'));
      assert.strictEqual(aal1.statusCode, 403, 'owner without 2FA refused');
      assert.strictEqual(aal1.body.error, 'MFA_REQUIRED');
      const aal2 = await run(tokenFor('aal2'));
      assert.strictEqual(aal2.statusCode, 'next', 'owner with 2FA allowed');
      resetStaffRateLimitForTests();
      let limited = 0;
      for (let i = 0; i < 125; i++) { const r = await run(tokenFor('aal2')); if (r.statusCode === 429) limited++; }
      assert.ok(limited > 0, 'one person is limited after 120 requests a minute');
    } finally {
      supa.supabaseClient.auth.getUser = original;
      process.env.ENABLE_STRICT_AUTH = prevStrict;
      resetStaffRateLimitForTests();
      await prisma.staffUser.delete({ where: { id: staffRow.id } }).catch(() => {});
    }
  });

  await test('A8 order resolve replaces retry; KYC bypass routes are gone; unknown call terminate is 404', async () => {
    assert.ok(!routeLayer(adminRouter, 'post', '/orders/:orderId/retry'), 'retry route removed');
    assert.ok(!routeLayer(adminRouter, 'patch', '/numbers/:id/activate'), 'activate-without-KYC route removed');
    assert.ok(!routeLayer(adminRouter, 'post', '/customers/:id/kyc/reset'), 'half KYC reset route removed');
    const id = await newUser();
    const order = await prisma.phoneNumberOrder.create({ data: { userId: id, internalOrganizationId: 'default', idempotencyKey: `idem_${id}`, selectedNumber: '+911234567890', priceSnapshot: 0, orderStatus: 'failed', failureReason: 'carrier said no' } });
    const noReason = await call(h('post', '/orders/:orderId/resolve'), { params: { orderId: order.id }, body: {}, staff: OWNER });
    assert.strictEqual(noReason.statusCode, 400);
    const r = await call(h('post', '/orders/:orderId/resolve'), { params: { orderId: order.id }, body: { resolution: 'refunded', reason: 'refunded in Razorpay' }, staff: OWNER });
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
    assert.strictEqual((await prisma.phoneNumberOrder.findUnique({ where: { id: order.id } })).orderStatus, 'resolved');
    assert.ok(await prisma.adminAuditLog.findFirst({ where: { targetId: order.id, action: 'orders:resolve' } }), 'audited');
    const t = await call(h('post', '/calls/:id/terminate'), { params: { id: crypto.randomUUID() }, body: { reason: 'stuck' }, staff: OWNER });
    assert.strictEqual(t.statusCode, 404, JSON.stringify(t.body));
  });

  await test('A9 exports are recorded as sensitive reads; staff invite validates the email', async () => {
    const before = await prisma.adminAuditLog.count({ where: { staffId: OWNER.id, action: 'exports:csv' } });
    const r = await call(h('get', '/exports/:type'), { params: { type: 'customers' }, staff: OWNER });
    assert.strictEqual(r.statusCode, 200);
    assert.ok(String(r.headers['content-type']).startsWith('text/csv'));
    assert.strictEqual(await prisma.adminAuditLog.count({ where: { staffId: OWNER.id, action: 'exports:csv' } }), before + 1);
    const inv = await call(h('post', '/staff/invite'), { body: { email: 'not-an-email', name: 'X', role: 'support' }, staff: OWNER });
    assert.strictEqual(inv.statusCode, 400);
  });

  await test('A10 force sign-out: sessions signed in before it are refused, a new sign-in works', async () => {
    const supa = require('../dist/utils/supabase');
    const { requireAuth, sessionSignInTimeMs } = require('../dist/middleware/auth');
    const id = await newUser();
    const email = (await prisma.user.findUnique({ where: { id } })).email;
    const jwt = (amrSec) => `x.${Buffer.from(JSON.stringify({ sub: id, iat: amrSec + 3000, amr: [{ method: 'password', timestamp: amrSec }, { method: 'totp', timestamp: amrSec + 60 }] })).toString('base64')}.y`;
    const oldSignIn = Math.floor(Date.now() / 1000) - 3600;
    assert.strictEqual(sessionSignInTimeMs(jwt(oldSignIn)), oldSignIn * 1000, 'sign-in time is the first amr entry, not the refresh time');
    const original = supa.supabaseClient.auth.getUser;
    supa.supabaseClient.auth.getUser = async () => ({ data: { user: { id, email, email_confirmed_at: new Date().toISOString(), user_metadata: { full_name: 'Admin Panel Test' } } }, error: null });
    const authAs = (token) => new Promise((resolve) => {
      const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; resolve(this); return this; }, setHeader() {} };
      const req = { headers: { authorization: `Bearer ${token}` }, ip: '127.0.0.1', path: '/x', get: () => 'test' };
      requireAuth(req, res, () => resolve({ statusCode: 'next' })).catch((e) => resolve({ statusCode: 'threw', body: String(e) }));
    });
    try {
      assert.strictEqual((await authAs(jwt(oldSignIn))).statusCode, 'next', 'works before the sign-out');
      const r = await call(h('post', '/customers/:id/force-logout'), { params: { id }, body: { reason: 'account takeover suspected' }, staff: OWNER });
      assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
      const denied = await authAs(jwt(oldSignIn));
      assert.strictEqual(denied.statusCode, 401);
      assert.strictEqual(denied.body.error, 'SESSION_REVOKED');
      assert.strictEqual((await authAs(jwt(Math.floor(Date.now() / 1000) + 5))).statusCode, 'next', 'a fresh sign-in is allowed');
      assert.ok(await prisma.auditLog.findFirst({ where: { workspaceOwnerId: id, actorUserId: 'Claritiy Support' } }), 'customer can see it in their audit log');
    } finally {
      supa.supabaseClient.auth.getUser = original;
    }
  });

  await test('A11 recordings: lists never carry the carrier URL; playback is a signed, audited link (owner only)', async () => {
    const id = await newUser();
    const agent = await prisma.agent.create({ data: { userId: id, name: 'Rec', systemPrompt: 'x' } });
    const carrierUrl = 'https://media.vobiz.ai/v1/Account/MA_X/Recording/rec-123.mp3';
    const callRow = await prisma.call.create({ data: { userId: id, agentId: agent.id, recipientPhoneNumber: '+919811100099', status: 'completed', recordingUrl: carrierUrl } });
    const list = await call(h('get', '/calls'), { query: { q: callRow.id }, staff: OWNER });
    assert.strictEqual(list.statusCode, 200, JSON.stringify(list.body));
    assert.ok(!JSON.stringify(list.body).includes('media.vobiz.ai'), 'carrier URL not sent');
    assert.strictEqual(list.body.data.find((c) => c.id === callRow.id).hasRecording, true);
    const perCustomer = await call(h('get', '/customers/:id/calls'), { params: { id }, staff: OWNER });
    assert.ok(!JSON.stringify(perCustomer.body).includes('media.vobiz.ai'));
    const { hasPermission } = require('../dist/admin/permissions');
    assert.strictEqual(hasPermission('admin', 'call_content:view'), false, 'owner only');
    const link = await call(h('post', '/calls/:id/recording-link'), { params: { id: callRow.id }, body: {}, staff: OWNER });
    assert.strictEqual(link.statusCode, 200, JSON.stringify(link.body));
    assert.ok(link.body.data.url.startsWith(`/api/v2/recordings/${callRow.id}/stream?`), 'our signed stream endpoint');
    assert.ok(!link.body.data.url.includes('vobiz'), 'not the carrier address');
    assert.ok(await prisma.adminAuditLog.findFirst({ where: { action: 'call_content:recording_play', targetId: callRow.id } }), 'listening is audited');
    await prisma.call.delete({ where: { id: callRow.id } }).catch(() => {});
    await prisma.agent.delete({ where: { id: agent.id } }).catch(() => {});
  });

  await test('A12 customer list sorting is done by the server across all pages', async () => {
    const r = await call(h('get', '/customers'), { query: { sort: 'oldest', limit: '5' }, staff: OWNER });
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
    const oldest = await prisma.user.findMany({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 5, select: { id: true } });
    assert.deepStrictEqual(r.body.data.map((u) => u.id), oldest.map((u) => u.id));
    const byCalls = await call(h('get', '/customers'), { query: { sort: 'calls', limit: '3' }, staff: OWNER });
    assert.strictEqual(byCalls.statusCode, 200, JSON.stringify(byCalls.body));
    const counts = byCalls.body.data.map((u) => u.callsCount);
    assert.deepStrictEqual(counts, [...counts].sort((a, b) => b - a));
  });

  await test('A13 no automatic refund: case → console list → one-click refund closes it and tells the customer', async () => {
    const { reportPaymentIssue } = require('../dist/services/PaymentIssueService');
    const id = await newUser();
    const paymentId = `pay_rev_${id.slice(0, 8)}`;
    const orderId = `order_rev_${id.slice(0, 8)}`;
    const first = await reportPaymentIssue({ userId: id, paymentId, orderId, amountInr: 499, reason: 'Carrier refused the number', source: 'reconciliation' });
    const again = await reportPaymentIssue({ userId: id, paymentId, orderId, amountInr: 499, reason: 'Carrier refused the number', source: 'reconciliation' });
    assert.strictEqual(first.created, true);
    assert.strictEqual(again.created, false, 'one case per payment');
    assert.strictEqual(await prisma.systemAlert.count({ where: { userId: id, title: 'We received your payment' } }), 1, 'customer told once');
    assert.strictEqual(gw.refunds.filter((r) => r.id === paymentId).length, 0, 'nothing refunded by itself');
    const list = await call(h('get', '/payment-issues'), { staff: OWNER });
    const row = list.body.data.find((r) => r.paymentId === paymentId);
    assert.ok(row && row.payment && row.payment.status === 'completed' && row.customer.email, JSON.stringify(row));
    const refund = await call(h('post', '/payments/:id/refund'), { params: { id: row.payment.id }, body: { reason: 'Owner approved the refund' }, staff: OWNER });
    assert.strictEqual(refund.statusCode, 200, JSON.stringify(refund.body));
    assert.strictEqual(refund.body.data.casesClosed, 1, 'the case closes with the refund');
    assert.strictEqual(gw.refunds.filter((r) => r.id === paymentId).length, 1, 'Razorpay asked once');
    assert.strictEqual(gw.refunds.find((r) => r.id === paymentId).amount, 49900);
    const tx = await prisma.paymentTransaction.findFirst({ where: { paymentId } });
    assert.strictEqual(tx.status, 'refunded');
    assert.strictEqual(tx.refundedAmount, 499);
    assert.ok(await prisma.systemAlert.findFirst({ where: { userId: id, title: 'Refund issued' } }), 'customer notified of the refund');
    const after = await call(h('get', '/payment-issues'), { staff: OWNER });
    assert.ok(!after.body.data.some((r) => r.paymentId === paymentId), 'no longer waiting');

    // Close without a refund (number set up by hand): audited, nothing sent to Razorpay.
    const p2 = `pay_rev2_${id.slice(0, 8)}`;
    const c2 = await reportPaymentIssue({ userId: id, paymentId: p2, orderId: `order_rev2_${id.slice(0, 8)}`, amountInr: 499, reason: 'Assignment failed', source: 'number_purchase' });
    const noReason = await call(h('post', '/payment-issues/:id/close'), { params: { id: c2.alertId }, body: { outcome: 'number_set_up' }, staff: OWNER });
    assert.strictEqual(noReason.statusCode, 400);
    const closed = await call(h('post', '/payment-issues/:id/close'), { params: { id: c2.alertId }, body: { outcome: 'number_set_up', reason: 'Assigned by hand in the carrier console' }, staff: OWNER });
    assert.strictEqual(closed.statusCode, 200, JSON.stringify(closed.body));
    assert.strictEqual(gw.refunds.filter((r) => r.id === p2).length, 0);
    assert.strictEqual((await prisma.paymentTransaction.findFirst({ where: { paymentId: p2 } })).status, 'completed');
    assert.ok(await prisma.adminAuditLog.findFirst({ where: { action: 'payments:issue_closed', targetId: c2.alertId } }));
    const { hasPermission } = require('../dist/admin/permissions');
    assert.strictEqual(hasPermission('support', 'refunds:manage'), false, 'support cannot refund or close cases');
    await prisma.systemAlert.deleteMany({ where: { OR: [{ userId: id }, { id: { in: [first.alertId, c2.alertId] } }] } });
  });

  console.log(`\nAdmin panel backend: ${passed}/${total} passed`);
}

main()
  .catch((e) => { console.error(e); total++; })
  .finally(async () => {
    for (const id of users) {
      await prisma.minutesLedger.deleteMany({ where: { userId: id } }).catch(() => {});
      await prisma.invoice.deleteMany({ where: { userId: id } }).catch(() => {});
      await prisma.paymentTransaction.deleteMany({ where: { userId: id } }).catch(() => {});
      await prisma.paymentLink.deleteMany({ where: { userId: id } }).catch(() => {});
      await prisma.phoneNumberOrder.deleteMany({ where: { userId: id } }).catch(() => {});
      await prisma.customerNote.deleteMany({ where: { userId: id } }).catch(() => {});
      await prisma.followUp.deleteMany({ where: { userId: id } }).catch(() => {});
      await prisma.customerAdminProfile.deleteMany({ where: { userId: id } }).catch(() => {});
      await prisma.auditLog.deleteMany({ where: { workspaceOwnerId: id } }).catch(() => {});
      await prisma.vobizSubAccount.deleteMany({ where: { userId: id } }).catch(() => {});
      await prisma.kycDocument.deleteMany({ where: { userId: id } }).catch(() => {});
      await prisma.user.delete({ where: { id } }).catch(() => {});
    }
    await prisma.$disconnect();
    process.exit(passed === total ? 0 : 1);
  });
