require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * The in-call minutes guard shares one balance across a customer's live calls.
 * Before: each call was compared to the whole balance on its own, so a customer with 2 minutes left
 * could run three 2-minute calls at once (6 minutes; batch "Concurrent" or the API).
 * Production code: CallOrchestrator.enforceMinutesOnActiveCalls; only the call ending is stubbed.
 */
const assert = require('assert');
const crypto = require('crypto');

let total = 0;
let passed = 0;
async function test(name, fn) {
  total++;
  try { await fn(); passed++; console.log(`  ✓ ${name}`); } catch (err) { console.error(`  ✗ FAIL: ${name}\n    ${err.stack || err.message}`); }
}

async function main() {
  const { prisma } = require('../dist/lib/prisma');
  const { callOrchestrator } = require('../dist/core/orchestrator/CallOrchestrator');
  const { CallService } = require('../dist/services/CallService');
  console.log('\n--- MINUTES GUARD: CONCURRENT CALLS ---');

  const users = [];
  const ended = [];
  const originalTerminate = CallService.terminateCall;
  CallService.terminateCall = async (callId) => { ended.push(callId); };
  const live = callOrchestrator.activeCalls; // the orchestrator's own live-call map
  const now = Date.now();

  const customer = async (remainingSeconds, extra = {}) => {
    const id = crypto.randomUUID();
    users.push(id);
    await prisma.user.create({ data: { id, email: `mg-${id.slice(0, 8)}@claritiy-test.co.in`, fullName: 'Minutes Guard', passwordHash: 'x', accountType: 'developer', minutesRemainingSeconds: remainingSeconds, callingBalanceMinutes: remainingSeconds / 60, ...extra } });
    const agent = await prisma.agent.create({ data: { userId: id, name: 'A', status: 'active' } });
    return { id, agentId: agent.id };
  };
  const liveCall = async (u, secondsAgo) => {
    const c = await prisma.call.create({ data: { userId: u.id, agentId: u.agentId, recipientPhoneNumber: '+919812345678', status: 'in_progress', startTime: new Date(now - secondsAgo * 1000) } });
    live.set(c.id, {});
    return c.id;
  };
  const run = async () => { ended.length = 0; return callOrchestrator.enforceMinutesOnActiveCalls(now); };
  const fresh = (name, fn) => test(name, async () => { live.clear(); await fn(); });

  try {
    await test('the guard exists and is the production method', () => {
      assert.strictEqual(typeof callOrchestrator.enforceMinutesOnActiveCalls, 'function');
    });

    await fresh('2 minutes left, three calls 70 s in: the oldest keeps going, the two others are ended (shared balance)', async () => {
      const u = await customer(120);
      const c1 = await liveCall(u, 72);
      const c2 = await liveCall(u, 71);
      const c3 = await liveCall(u, 70);
      const out = await run();
      assert.deepStrictEqual(out.sort(), [c2, c3].sort());
      assert.ok(!ended.includes(c1), 'the oldest call (within the balance) keeps going');
    });

    await fresh('a single call inside the balance is never ended; one past it is', async () => {
      const u = await customer(120);
      const c = await liveCall(u, 70);
      assert.deepStrictEqual(await run(), []);
      const v = await customer(60);
      const d = await liveCall(v, 61);
      const out = await run();
      assert.ok(out.includes(d) && !out.includes(c));
    });

    await fresh("customers never share a balance; the owner's account is not limited", async () => {
      const a = await customer(100);
      const b = await customer(100);
      const ca = await liveCall(a, 60);
      const cb = await liveCall(b, 60);
      const owner = await customer(0, { accountType: 'admin' });
      const co = await liveCall(owner, 600);
      const out = await run();
      assert.ok(!out.includes(ca) && !out.includes(cb), 'each customer measured against their own balance');
      assert.ok(!out.includes(co), 'owner (main account) is not cut');
    });
  } finally {
    CallService.terminateCall = originalTerminate;
    live.clear();
    await prisma.call.deleteMany({ where: { userId: { in: users } } }).catch(() => {});
    await prisma.agent.deleteMany({ where: { userId: { in: users } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: users } } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  }
  console.log(`MINUTES GUARD: ${passed === total ? 'PASS' : 'FAIL'} — ${passed}/${total} tests passed`);
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
