require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Audit batch 10 (server side of the dashboard fixes) — production route handlers, TEST database.
 *  #93  the Reports "pending"/"processing" filters list the calls waiting for analysis (tenant-scoped)
 *  #94  a report's history shows the customer's own corrections; staff entries carry no staff identity
 *  #149 the "Billed Minutes" alert metric follows the billing rule (per started minute, connected calls)
 * The browser side (#85 #87 #93 #96 #98 #99 #100 #152, #53 in the editor) is e2e/audit-batch10.spec.ts.
 * Run: npm run test:audit-batch10   (part of npm run test:security)
 */
const assert = require('assert');
const crypto = require('crypto');
const { prisma } = require('../dist/lib/prisma');

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
function call(fn, { workspaceId, params = {}, query = {}, body = {} }) {
  return new Promise((resolve) => {
    const res = { statusCode: 200 };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; resolve(res); return res; };
    Promise.resolve(fn({ effectiveWorkspaceId: workspaceId, userId: workspaceId, params, query, body, headers: {} }, res, (err) => resolve({ statusCode: 'next', body: String(err && err.stack || err) })))
      .catch((e) => resolve({ statusCode: 'threw', body: String(e) }));
  });
}
const users = [];
async function newUser(fullName = 'Batch Ten') {
  const id = crypto.randomUUID();
  users.push(id);
  await prisma.user.create({ data: { id, email: `b10-${id.slice(0, 8)}@claritiy-test.co.in`, fullName, passwordHash: 'x', accountType: 'professional' } });
  return id;
}

async function main() {
  console.log('\n--- AUDIT BATCH 10 ---');
  const reportsRouter = require('../dist/routes/reports').default;
  const list = handlerOf(reportsRouter, 'get', '/');
  const detail = handlerOf(reportsRouter, 'get', '/:callId');

  await test('#93 the pending filter lists the calls waiting for analysis, only for this workspace', async () => {
    const ws = await newUser();
    const other = await newUser();
    const agent = await prisma.agent.create({ data: { userId: ws, name: 'Queue', systemPrompt: 'x' } });
    const c = await prisma.call.create({ data: { userId: ws, agentId: agent.id, recipientPhoneNumber: '+919811112222', status: 'completed', durationSeconds: 75 } });
    try {
      await prisma.analysisJob.create({ data: { callId: c.id, workspaceId: ws, agentId: agent.id, status: 'pending', nextRunAt: new Date(Date.now() + 3600000) } });
      const r = await call(list, { workspaceId: ws, query: { status: 'pending' } });
      assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
      const items = r.body.data.items;
      assert.strictEqual(items.length, 1, 'the queued call is listed');
      assert.strictEqual(items[0].callId, c.id);
      assert.strictEqual(items[0].queued, true);
      assert.strictEqual(items[0].call.contactNumber, '+919811112222');
      assert.strictEqual(r.body.data.totalCount, 1);
      const o = await call(list, { workspaceId: other, query: { status: 'pending' } });
      assert.strictEqual(o.body.data.items.length, 0, 'another workspace sees nothing');
      assert.strictEqual((await call(list, { workspaceId: ws, query: { status: 'processing' } })).body.data.items.length, 0);
    } finally {
      await prisma.analysisJob.deleteMany({ where: { callId: c.id } }); // keep the shared queue clean
    }
  });

  await test('#94 report history shows the customer\'s own corrections; staff entries are anonymous', async () => {
    const ws = await newUser('Priya Sharma');
    const agent = await prisma.agent.create({ data: { userId: ws, name: 'Hist', systemPrompt: 'x' } });
    const c = await prisma.call.create({ data: { userId: ws, agentId: agent.id, recipientPhoneNumber: '+919833334444', status: 'completed', durationSeconds: 40 } });
    await prisma.callResult.create({ data: { callId: c.id, workspaceId: ws, resultLabel: 'Interested', confidence: 0.9, status: 'completed' } });
    await prisma.auditLog.create({ data: { workspaceOwnerId: ws, actorUserId: ws, action: 'CALL_REPORT_CORRECTED', targetId: c.id, metadata: { previousLabel: 'Unclear', newLabel: 'Interested' } } });
    await prisma.auditLog.create({ data: { workspaceOwnerId: crypto.randomUUID(), actorUserId: ws, action: 'CALL_REPORT_CORRECTED', targetId: c.id, metadata: { foreign: true } } });
    await prisma.adminAuditLog.create({ data: { staffId: 'staff-1', staffEmail: 'ops.person@claritiy.example', staffRole: 'support', action: 'report.override', targetType: 'call', targetId: c.id, reason: 'QA check' } });
    try {
      const r = await call(detail, { workspaceId: ws, params: { callId: c.id } });
      assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body).slice(0, 300));
      const logs = r.body.data.auditLogs;
      const mine = logs.find((l) => l.action === 'CALL_REPORT_CORRECTED');
      assert.ok(mine, 'the customer correction is listed');
      assert.strictEqual(mine.actorUserId, 'Priya Sharma');
      assert.ok(!logs.some((l) => l.metadata && l.metadata.foreign), 'another workspace\'s entry is not shown');
      const staff = logs.find((l) => l.action === 'report.override');
      assert.ok(staff, 'staff entry still listed');
      assert.strictEqual(staff.actorUserId, 'Claritiy support');
      assert.ok(!JSON.stringify(r.body).includes('ops.person@claritiy.example'), 'no staff email reaches the customer');
    } finally {
      await prisma.adminAuditLog.deleteMany({ where: { targetId: c.id } });
      await prisma.auditLog.deleteMany({ where: { targetId: c.id } });
      await prisma.analysisJob.deleteMany({ where: { callId: c.id } });
    }
  });

  await test('#149 "Billed Minutes" counts per started minute, connected calls only', async () => {
    const { AlertEvaluator } = require('../dist/services/AlertEvaluator');
    const ws = await newUser();
    const agent = await prisma.agent.create({ data: { userId: ws, name: 'Bill', systemPrompt: 'x' } });
    for (const durationSeconds of [61, 30, 0, null]) {
      await prisma.call.create({ data: { userId: ws, agentId: agent.id, recipientPhoneNumber: '+919855556666', status: durationSeconds ? 'completed' : 'no_answer', durationSeconds } });
    }
    const rule = { id: 'r', userId: ws, name: 'Minutes', metric: 'cost', comparator: 'greater_than', thresholdValue: 2, evaluationWindowMins: 60 };
    const r = await AlertEvaluator.evaluateSingleRule(rule);
    assert.strictEqual(r.metricValue, 3, '61 s = 2 min, 30 s = 1 min, unanswered = 0');
    assert.strictEqual(r.isBreached, true);
    await prisma.analysisJob.deleteMany({ where: { workspaceId: ws } });
  });

  await prisma.analysisJob.deleteMany({ where: { workspaceId: { in: users } } }).catch(() => {});
  console.log(`\nAudit batch 10: ${passed}/${total} passed`);
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}

main().catch(async (err) => { console.error(err); await prisma.$disconnect().catch(() => {}); process.exit(1); });
