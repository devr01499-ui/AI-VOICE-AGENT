require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * POST /api/v2/calls: the agent is looked up with the caller's own userId (governance: tenant data
 * is never read by id alone). Before fix/initiate-call-agent-owner the controller read any agent by
 * id, and any customer who sent the legacy default-agent id made the server create that agent
 * under the platform owner's account.
 *  - another customer's agent -> 404 "Agent not found" (no id echoed back), nothing placed
 *  - the legacy default-agent id from a customer -> 404, and no agent row is created
 *  - the customer's own agent passes this check (the request goes on to the call rules)
 * Production routers (scripts/lib/demoApp.cjs), local TEST database; no carrier is contacted.
 * Run: npm run test:call-agent-owner   (part of npm run test:security)
 */
const assert = require('assert');
const crypto = require('crypto');
const http = require('http');
const { prisma } = require('../dist/lib/prisma');
const { buildApp, installAuthStub } = require('./lib/demoApp.cjs');

const LEGACY_DEFAULT_AGENT_ID = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d22';

let total = 0;
let passed = 0;
async function test(name, fn) {
  total++;
  try { await fn(); passed++; console.log(`  ✓ ${name}`); } catch (e) { console.error(`  ✗ ${name}\n      ${e.message}`); }
}

(async () => {
  console.log('\n--- CALL AGENT OWNERSHIP (POST /api/v2/calls) ---');
  const alice = crypto.randomUUID();
  const bob = crypto.randomUUID();
  // Minutes and a live plan, so the request reaches the controller (the minutes gate runs first).
  // The caller ID below is not Alice's, so CallService refuses before any carrier is contacted.
  const mk = (id, tag) => prisma.user.create({ data: { id, email: `${tag}-${id.slice(0, 8)}@claritiy-test.co.in`, fullName: tag, passwordHash: 'x', accountType: 'professional', callingBalanceMinutes: 100, planExpiresAt: new Date(Date.now() + 86400000) } });
  await mk(alice, 'alice');
  await mk(bob, 'bob');
  const bobsAgent = await prisma.agent.create({ data: { userId: bob, name: 'Bob agent', systemPrompt: 'secret prompt', status: 'active' } });
  const alicesAgent = await prisma.agent.create({ data: { userId: alice, name: 'Alice agent', systemPrompt: 'x', status: 'active' } });
  const legacyBefore = await prisma.agent.findUnique({ where: { id: LEGACY_DEFAULT_AGENT_ID } });

  installAuthStub(async (token) => (token === 'alice-token' ? { id: alice, email: `alice@claritiy-test.co.in` } : null));
  const server = http.createServer(buildApp());
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (agentId) => fetch(`${base}/api/v2/calls`, {
    method: 'POST',
    headers: { authorization: 'Bearer alice-token', 'content-type': 'application/json' },
    body: JSON.stringify({ phoneNumber: '+919812345678', agentId, fromPhoneNumber: '+918045670000' }),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  try {
    await test("another customer's agent -> 404 Agent not found, id not echoed", async () => {
      const r = await call(bobsAgent.id);
      assert.strictEqual(r.status, 404, JSON.stringify(r.body));
      const text = JSON.stringify(r.body);
      assert.ok(/Agent not found/i.test(text), text);
      assert.ok(!text.includes(bobsAgent.id), 'the agent id is echoed back: ' + text);
    });

    await test('the legacy default-agent id from a customer -> 404 and no agent is created', async () => {
      const r = await call(LEGACY_DEFAULT_AGENT_ID);
      assert.strictEqual(r.status, 404, JSON.stringify(r.body));
      const after = await prisma.agent.findUnique({ where: { id: LEGACY_DEFAULT_AGENT_ID } });
      assert.strictEqual(Boolean(after), Boolean(legacyBefore), 'a default agent row was created by a customer request');
    });

    await test("the customer's own agent passes the ownership check (refused later for other reasons, never 404)", async () => {
      const r = await call(alicesAgent.id);
      assert.notStrictEqual(r.status, 404, JSON.stringify(r.body));
      assert.ok(r.status < 500, JSON.stringify(r.body));
    });
  } finally {
    server.close();
    if (!legacyBefore) await prisma.agent.deleteMany({ where: { id: LEGACY_DEFAULT_AGENT_ID } }).catch(() => {});
    await prisma.agent.deleteMany({ where: { userId: { in: [alice, bob] } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [alice, bob] } } }).catch(() => {});
  }

  console.log(`\nCALL AGENT OWNERSHIP: ${passed}/${total} ${passed === total ? 'PASS' : 'FAIL'}`);
  await prisma.$disconnect();
  process.exit(passed === total ? 0 : 1);
})().catch(async (e) => { console.error(e); await prisma.$disconnect().catch(() => {}); process.exit(1); });
