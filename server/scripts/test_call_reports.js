require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Call reports (owner 2026-11-26: "the AI agent is an employee; its reports must be accurate").
 * Production code only; the AI model is replaced through the shared helper's test transport.
 *  A. the report is built from the COMPLETE transcript (last turns saved before it is queued).
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
  const { TurnAggregator } = require('../dist/runtime/TurnAggregator');
  const { CallFinalizer, REPORT_SETTLE_SECONDS } = require('../dist/services/CallFinalizer');
  console.log('\n--- CALL REPORTS ---');
  const users = [];
  const newUser = async () => {
    const id = crypto.randomUUID();
    users.push(id);
    await prisma.user.create({ data: { id, email: `cr-${id.slice(0, 8)}@claritiy-test.co.in`, fullName: 'Report Test', passwordHash: 'x', accountType: 'developer' } });
    const agent = await prisma.agent.create({ data: { userId: id, name: 'Lotus Dental Receptionist', status: 'active', systemPrompt: 'You are the receptionist of a dental clinic.' } });
    return { id, agentId: agent.id };
  };

  try {
    await test('A1 call end waits until the last transcript turns are saved', async () => {
      const saved = [];
      const agg = new TurnAggregator('call-test', Date.now(), 1500, {
        publish: () => {},
        transcriptManager: { addUtterance: async (_c, speaker, text) => { await new Promise((r) => setTimeout(r, 300)); saved.push(`${speaker}:${text}`); } },
      });
      agg.handleFragment('user', 'Please do not call me again', false);
      const done = agg.destroy();
      assert.ok(done && typeof done.then === 'function', 'destroy() returns a promise');
      await done;
      assert.deepStrictEqual(saved, ['user:Please do not call me again'], 'the final caller words are saved before the call is finalized');
    });

    await test(`A2 the report job waits ${REPORT_SETTLE_SECONDS} s after the call ends (carrier webhook can arrive before the stream closes)`, async () => {
      const u = await newUser();
      const call = await prisma.call.create({ data: { userId: u.id, agentId: u.agentId, recipientPhoneNumber: '+919812345678', status: 'completed' } });
      const before = Date.now();
      await CallFinalizer.onCallFinalized(call.id);
      const job = await prisma.analysisJob.findUnique({ where: { callId: call.id } });
      assert.ok(job, 'job queued');
      const waitMs = job.nextRunAt.getTime() - before;
      assert.ok(waitMs >= (REPORT_SETTLE_SECONDS - 2) * 1000, `job runs after the settle time (waits ${waitMs} ms)`);
      assert.ok(REPORT_SETTLE_SECONDS >= 10 && REPORT_SETTLE_SECONDS <= 60);
      await CallFinalizer.onCallFinalized(call.id);
      assert.strictEqual(await prisma.analysisJob.count({ where: { callId: call.id } }), 1, 'still one job (idempotent)');
    });
  } finally {
    await prisma.analysisJob.deleteMany({ where: { workspaceId: { in: users } } }).catch(() => {});
    await prisma.callResult.deleteMany({ where: { workspaceId: { in: users } } }).catch(() => {});
    await prisma.call.deleteMany({ where: { userId: { in: users } } }).catch(() => {});
    await prisma.agent.deleteMany({ where: { userId: { in: users } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: users } } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  }
  console.log(`CALL REPORTS: ${passed === total ? 'PASS' : 'FAIL'} — ${passed}/${total} tests passed`);
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
