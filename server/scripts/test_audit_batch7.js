require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
process.env.RAZORPAY_KEY_ID = 'rzp_test_fake_key_for_tests';
process.env.RAZORPAY_KEY_SECRET = 'test_only_checkout_secret';
/**
 * Audit batch 7 (teams and workspaces) — real routers behind the real requireAuth (Supabase stubbed).
 *  #49 a person who runs their own workspace or is in another team cannot be pulled into a team;
 *      a person in two teams always lands in the same (oldest) one
 *  #50 invite emails are matched case-insensitively
 *  #60 API keys belong to the workspace; viewers cannot create them
 *  #61 the customer Gemini key is saved on the workspace; only admins may change it
 *  #88 team members can open and act on the workspace's calls (viewers cannot end/delete them)
 *  #11/#89 numbers, calling config and plan purchases use the workspace, not the member's own account
 * Run: npm run test:audit-batch7   (part of npm run test:security)
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
const phone = () => `+9198${Math.floor(10000000 + Math.random() * 89999999)}`;

async function main() {
  console.log('\n--- AUDIT BATCH 7 ---');
  const { supabaseClient } = require('../dist/utils/supabase');
  const { requireAuth } = require('../dist/middleware/auth');
  const { requireAuthOrApiKey } = require('../dist/middleware/authWrapper');
  const { BillingService } = require('../dist/services/BillingService');
  const orders = [];
  BillingService.setRazorpayClientForTests({ orders: { create: async (o) => { orders.push(o); return { id: `order_${orders.length}_${crypto.randomBytes(3).toString('hex')}`, ...o }; } } });
  const emails = new Map();
  supabaseClient.auth.getUser = async (token) => {
    if (!emails.has(token)) return { data: { user: null }, error: { message: 'invalid' } };
    const now = new Date().toISOString();
    return { data: { user: { id: token, email: emails.get(token), email_confirmed_at: now, user_metadata: { email_confirmed_at: now } } }, error: null };
  };
  const newUser = async (accountType = 'free', extra = {}) => {
    const id = crypto.randomUUID();
    const email = `b7-${id.slice(0, 8)}@claritiy-test.co.in`;
    emails.set(id, email);
    await prisma.user.create({ data: { id, email, fullName: 'Batch Seven', passwordHash: 'x', accountType, callingBalanceMinutes: 100, minutesRemainingSeconds: 6000, ...extra } });
    return { id, email };
  };

  const app = express();
  app.use(express.json());
  app.get('/whoami', requireAuth, (req, res) => res.json({ workspace: req.effectiveWorkspaceId, role: req.workspaceRole }));
  app.use('/api/v2/team', require('../dist/routes/team').default);
  app.use('/api/v2/api-keys', require('../dist/routes/apikeys').default);
  require('../dist/routes/user').mountUserRoutes(app, requireAuth);
  app.use('/api/v2/calls', requireAuthOrApiKey, require('../dist/routes/calls').default);
  app.use('/api/v2/numbers', require('../dist/routes/numbers').default);
  app.use('/api/v2/billing', require('../dist/routes/billing').default);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (method, url, token, body) => fetch(base + url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined })
    .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

  const owner = await newUser('developer', { planExpiresAt: new Date(Date.now() + 20 * 86400000) });
  const dev = await newUser();
  const viewer = await newUser();
  try {
    await test('#49/#50 invites: case-insensitive email; own-workspace and other-team people are refused', async () => {
      const r = await call('POST', '/api/v2/team/invite', owner.id, { email: `  ${dev.email.toUpperCase()} `, role: 'developer' });
      assert.strictEqual(r.status, 201, JSON.stringify(r.body));
      assert.strictEqual((await call('POST', '/api/v2/team/invite', owner.id, { email: viewer.email, role: 'viewer' })).status, 201);

      const runsOwn = await newUser('free');
      await prisma.agent.create({ data: { userId: runsOwn.id, name: 'Mine', status: 'active' } });
      const own = await call('POST', '/api/v2/team/invite', owner.id, { email: runsOwn.email });
      assert.strictEqual(own.status, 409);
      assert.strictEqual(own.body.code, 'HAS_OWN_WORKSPACE');
      const paid = await newUser('developer');
      assert.strictEqual((await call('POST', '/api/v2/team/invite', owner.id, { email: paid.email })).body.code, 'HAS_OWN_WORKSPACE');

      const otherOwner = await newUser('developer');
      const other = await call('POST', '/api/v2/team/invite', otherOwner.id, { email: dev.email });
      assert.strictEqual(other.status, 409);
      assert.strictEqual(other.body.code, 'ALREADY_IN_TEAM');
    });

    await test('#49 a person in two teams always lands in the oldest one', async () => {
      const a = await newUser('developer');
      const b = await newUser('developer');
      const m = await newUser();
      // Newer membership inserted FIRST, so row order alone would pick the wrong team.
      await prisma.teamMember.create({ data: { ownerId: b.id, memberId: m.id, role: 'admin' } });
      await prisma.teamMember.create({ data: { ownerId: a.id, memberId: m.id, role: 'viewer', createdAt: new Date(Date.now() - 86400000) } });
      for (let i = 0; i < 3; i++) assert.strictEqual((await call('GET', '/whoami', m.id)).body.workspace, a.id);
    });

    await test('#60 API keys belong to the workspace; viewers cannot create or revoke them', async () => {
      const made = await call('POST', '/api/v2/api-keys', dev.id, { name: 'ci' });
      assert.strictEqual(made.status, 200, JSON.stringify(made.body));
      const row = await prisma.apiKey.findUnique({ where: { id: made.body.data.id } });
      assert.strictEqual(row.userId, owner.id, 'stored on the workspace');
      assert.ok((await call('GET', '/api/v2/api-keys', owner.id)).body.data.some((k) => k.id === row.id), 'owner sees it');
      assert.strictEqual((await call('POST', '/api/v2/api-keys', viewer.id, { name: 'x' })).status, 403);
      assert.strictEqual((await call('DELETE', `/api/v2/api-keys/${row.id}`, viewer.id)).status, 403);
      const stranger = await newUser('developer', { planExpiresAt: new Date(Date.now() + 86400000) });
      assert.strictEqual((await call('DELETE', `/api/v2/api-keys/${row.id}`, stranger.id)).status, 404, 'other workspaces cannot touch it');
      assert.strictEqual((await call('DELETE', `/api/v2/api-keys/${row.id}`, dev.id)).status, 200);
    });

    await test('#61 the Gemini key is saved on the workspace; only admins may change it', async () => {
      await prisma.teamMember.update({ where: { ownerId_memberId: { ownerId: owner.id, memberId: dev.id } }, data: { role: 'admin' } });
      const r = await call('POST', '/api/v2/user/billing-config', dev.id, { geminiApiKey: 'AIza-test-only-key' });
      assert.strictEqual(r.status, 200, JSON.stringify(r.body));
      assert.ok((await prisma.user.findUnique({ where: { id: owner.id } })).geminiApiKey, 'on the workspace owner');
      assert.strictEqual((await prisma.user.findUnique({ where: { id: dev.id } })).geminiApiKey, null, 'not on the member');
      assert.strictEqual((await call('POST', '/api/v2/user/billing-config', viewer.id, { geminiApiKey: 'x' })).status, 403);
      await prisma.teamMember.update({ where: { ownerId_memberId: { ownerId: owner.id, memberId: dev.id } }, data: { role: 'developer' } });
    });

    await test('#88 members open the workspace calls; viewers cannot end or delete them', async () => {
      const agent = await prisma.agent.create({ data: { userId: owner.id, name: 'Shared', status: 'active' } });
      const c = await prisma.call.create({ data: { userId: owner.id, agentId: agent.id, recipientPhoneNumber: phone(), fromPhoneNumber: phone(), callDirection: 'outbound', status: 'completed', durationSeconds: 40 } });
      assert.strictEqual((await call('GET', `/api/v2/calls/${c.id}`, dev.id)).status, 200);
      assert.strictEqual((await call('GET', `/api/v2/calls/${c.id}/transcript`, viewer.id)).status, 200);
      assert.strictEqual((await call('DELETE', `/api/v2/calls/${c.id}`, viewer.id)).status, 403);
      assert.strictEqual((await call('POST', `/api/v2/calls/${c.id}/terminate`, viewer.id)).status, 403);
    });

    await test('#11/#89 numbers, calling config and plan purchases use the workspace', async () => {
      const num = await prisma.phoneNumber.create({ data: { userId: owner.id, phoneNumber: phone(), countryCode: 'IN', telephonyProvider: 'vobiz', status: 'active' } });
      const cfg = await call('GET', '/api/v2/numbers/calling-config', viewer.id);
      assert.strictEqual(cfg.status, 200);
      assert.ok(JSON.stringify(cfg.body).includes(num.phoneNumber), 'member sees the workspace number');
      orders.length = 0;
      await prisma.teamMember.update({ where: { ownerId_memberId: { ownerId: owner.id, memberId: dev.id } }, data: { role: 'admin' } });
      const o = await call('POST', '/api/v2/billing/create-plan-order', dev.id, { planName: 'Startup' });
      assert.strictEqual(o.status, 200, JSON.stringify(o.body));
      assert.strictEqual(orders[0].notes.userId, owner.id, 'the plan is bought for the workspace');
      assert.strictEqual((await call('POST', '/api/v2/billing/create-plan-order', viewer.id, { planName: 'Startup' })).status, 403, 'viewers cannot buy');
    });
  } finally {
    server.close();
    BillingService.setRazorpayClientForTests(null);
  }

  console.log(`\nAudit batch 7: ${passed}/${total} passed`);
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}

main().catch(async (err) => { console.error(err); await prisma.$disconnect().catch(() => {}); process.exit(1); });
