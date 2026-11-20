require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Audit batch 12 (low findings, server) — production handlers and services, local TEST database.
 *  #41  batch progress buckets add up to the total; retries follow the campaign's policy
 *  #66  the agent list has a bounded page size and reports a database failure as a failure
 *  #67  deleting an agent keeps its call history (archived, hidden, cannot be used)
 *  #68  the Reports summary's queue counts follow the agent filter
 *  #69  the Analytics trend does not count unanswered calls as failed
 *  #70  a staff role must be a real role
 *  #71  important notices are shown as important
 *  #72  each workspace's retention audit entry carries its own purge count
 *  #73  a batch's "created" date is the IST day
 *  #74  a finished campaign cannot be rewritten as cancelled
 *  #107 the calendar-connect error is a plain sentence (no raw code or environment variable names)
 * Run: npm run test:audit-batch12   (part of npm run test:security)
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
function call(fn, { workspaceId, params = {}, query = {}, body = {}, extra = {} }) {
  return new Promise((resolve) => {
    const res = { statusCode: 200 };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; resolve(res); return res; };
    const req = { effectiveWorkspaceId: workspaceId, userId: workspaceId, params, query, body, headers: {}, ip: '127.0.0.1', get: () => 'test', ...extra };
    Promise.resolve(fn(req, res, (err) => resolve({ statusCode: 'next', body: String(err && err.stack || err) })))
      .catch((e) => resolve({ statusCode: 'threw', body: String(e) }));
  });
}
const users = [];
async function newUser(extra = {}) {
  const id = crypto.randomUUID();
  users.push(id);
  await prisma.user.create({ data: { id, email: `b12-${id.slice(0, 8)}@claritiy-test.co.in`, fullName: 'Batch Twelve', passwordHash: 'x', accountType: 'professional', ...extra } });
  return id;
}

async function main() {
  console.log('\n--- AUDIT BATCH 12 ---');
  const agentsRouter = require('../dist/routes/agents').default;
  const calendarRouter = require('../dist/routes/calendar').default;
  const listAgents = handlerOf(agentsRouter, 'get', '/');

  await test('#66 agent list: bounded page size, 401 without a user, a DB failure is not "no agents"', async () => {
    const ws = await newUser();
    for (let i = 0; i < 3; i++) await prisma.agent.create({ data: { userId: ws, name: `A${i}`, systemPrompt: 'x' } });
    const r = await call(listAgents, { workspaceId: ws, query: { limit: '100000' } });
    assert.strictEqual(r.statusCode, 200);
    assert.strictEqual(r.body.data.length, 3);
    const neg = await call(listAgents, { workspaceId: ws, query: { limit: '-5', offset: 'x' } });
    assert.strictEqual(neg.body.data.length, 1, 'limit clamped to at least 1');
    assert.strictEqual((await call(listAgents, { workspaceId: undefined })).statusCode, 401);
    const orig = prisma.agent.findMany;
    prisma.agent.findMany = async () => { throw new Error('connection reset'); };
    try {
      const failed = await call(listAgents, { workspaceId: ws });
      assert.strictEqual(failed.statusCode, 503);
      assert.strictEqual(failed.body.success, false);
    } finally {
      prisma.agent.findMany = orig;
    }
  });

  await test('#67 deleting an agent keeps its calls, hides it, and stops its campaigns and follow-ups', async () => {
    const ws = await newUser();
    const agent = await prisma.agent.create({ data: { userId: ws, name: 'Gone', systemPrompt: 'x', status: 'active' } });
    const c = await prisma.call.create({ data: { userId: ws, agentId: agent.id, recipientPhoneNumber: '+919811100001', status: 'completed', durationSeconds: 90 } });
    await prisma.transcriptSegment.create({ data: { callId: c.id, speaker: 'agent', content: 'Hello', startTime: 0, sequenceNumber: 1 } });
    const batch = await prisma.batch.create({ data: { userId: ws, agentId: agent.id, name: 'Open', status: 'paused' } });
    const sc = await prisma.scheduledCall.create({ data: { source: 'ai_booked', agentId: agent.id, phoneNumber: '+919811100002', scheduledAtUtc: new Date(Date.now() + 86400000), timezone: 'Asia/Kolkata', idempotencyKey: crypto.randomUUID() } });
    const del = handlerOf(agentsRouter, 'delete', '/:agentId');
    const r = await call(del, { workspaceId: ws, params: { agentId: agent.id }, extra: { workspaceRole: 'admin' } });
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
    assert.ok(await prisma.call.findUnique({ where: { id: c.id } }), 'the call is kept');
    assert.strictEqual(await prisma.transcriptSegment.count({ where: { callId: c.id } }), 1, 'its transcript is kept');
    assert.strictEqual((await prisma.agent.findUnique({ where: { id: agent.id } })).status, 'archived');
    assert.strictEqual((await prisma.batch.findUnique({ where: { id: batch.id } })).status, 'cancelled');
    assert.strictEqual((await prisma.scheduledCall.findUnique({ where: { id: sc.id } })).status, 'canceled');
    const list = await call(listAgents, { workspaceId: ws });
    assert.ok(!list.body.data.some((a) => a.id === agent.id), 'not listed any more');
    assert.strictEqual((await call(handlerOf(agentsRouter, 'get', '/:agentId'), { workspaceId: ws, params: { agentId: agent.id } })).statusCode, 404);
    assert.strictEqual((await call(del, { workspaceId: ws, params: { agentId: agent.id }, extra: { workspaceRole: 'admin' } })).statusCode, 404, 'deleting twice: not found');
    await prisma.scheduledCall.delete({ where: { id: sc.id } });
  });

  await test('#68 the Reports summary queue counts follow the agent filter', async () => {
    const reportsRouter = require('../dist/routes/reports').default;
    const ws = await newUser();
    const a1 = await prisma.agent.create({ data: { userId: ws, name: 'One', systemPrompt: 'x' } });
    const a2 = await prisma.agent.create({ data: { userId: ws, name: 'Two', systemPrompt: 'x' } });
    const later = new Date(Date.now() + 3600000);
    const ids = [];
    for (const a of [a1, a1, a2]) {
      const c = await prisma.call.create({ data: { userId: ws, agentId: a.id, recipientPhoneNumber: '+919811100003', status: 'completed' } });
      ids.push(c.id);
      await prisma.analysisJob.create({ data: { callId: c.id, workspaceId: ws, agentId: a.id, status: 'pending', nextRunAt: later } });
    }
    try {
      const r = await call(handlerOf(reportsRouter, 'get', '/summary'), { workspaceId: ws, query: { agentId: a2.id } });
      const payload = r.body.data || r.body;
      assert.strictEqual(payload.pendingAnalysis, 1, 'only agent Two\'s queued call');
    } finally {
      await prisma.analysisJob.deleteMany({ where: { callId: { in: ids } } });
    }
  });

  await test('#69 the Analytics trend counts unanswered calls separately from failed ones', async () => {
    const { AnalyticsController } = require('../dist/controllers/AnalyticsController');
    const ws = await newUser();
    const agent = await prisma.agent.create({ data: { userId: ws, name: 'Trend', systemPrompt: 'x' } });
    for (const status of ['completed', 'no_answer', 'busy', 'failed']) {
      await prisma.call.create({ data: { userId: ws, agentId: agent.id, recipientPhoneNumber: '+919811100004', status, durationSeconds: status === 'completed' ? 30 : 0 } });
    }
    const r = await call(AnalyticsController.getAnalyticsSummary, { workspaceId: ws });
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body).slice(0, 300));
    const trend = (r.body.summary || r.body.data || r.body).volumeTrend;
    const sum = (k) => trend.reduce((acc, d) => acc + (d[k] || 0), 0);
    assert.strictEqual(sum('failed'), 1, 'only the failed call');
    assert.strictEqual(sum('unanswered'), 2, 'no-answer and busy');
    assert.strictEqual(sum('completed'), 1);
  });

  await test('#70 a staff role must be a real role', async () => {
    const { adminRouter } = require('../dist/routes/adminRoutes');
    const patch = handlerOf(adminRouter, 'patch', '/staff/:id');
    const target = await prisma.staffUser.create({ data: { email: `b12-staff-${crypto.randomUUID().slice(0, 6)}@claritiy-test.co.in`, name: 'Support person', role: 'support', status: 'active' } });
    try {
      const r = await call(patch, { workspaceId: null, params: { id: target.id }, body: { role: 'suport' }, extra: { staff: { id: 'owner-1', role: 'owner', email: 'owner@claritiy-test.co.in' } } });
      assert.strictEqual(r.statusCode, 400, JSON.stringify(r.body));
      assert.strictEqual((await prisma.staffUser.findUnique({ where: { id: target.id } })).role, 'support', 'unchanged');
    } finally {
      await prisma.staffUser.delete({ where: { id: target.id } }).catch(() => {});
    }
  });

  await test('#71 an important notice is shown as important', async () => {
    const { NotificationService } = require('../dist/services/NotificationService');
    const ws = await newUser();
    await NotificationService.createInAppNotification({ userId: ws, title: 'Plan expiring', message: 'Your plan ends tomorrow.', isImportant: true });
    const list = await NotificationService.getNotificationsForUser
      ? await NotificationService.getNotificationsForUser(ws)
      : null;
    const row = await prisma.systemAlert.findFirst({ where: { userId: ws }, orderBy: { createdAt: 'desc' } });
    assert.ok(JSON.parse(row.metadata || '{}').isImportant === true, 'flag stored');
    if (list) {
      const items = Array.isArray(list) ? list : (list.items || list.notifications || []);
      const n = items.find((x) => x.title === 'Plan expiring');
      assert.ok(n && n.isImportant === true, 'shown as important');
    }
  });

  await test('#72 each workspace\'s retention audit entry carries its own purge count', async () => {
    const { DataRetentionJob } = require('../dist/services/DataRetentionJob');
    const old = new Date(Date.now() - 5 * 86400000);
    const a = await newUser({ dataRetentionDays: 1 });
    const b = await newUser({ dataRetentionDays: 1 });
    const agA = await prisma.agent.create({ data: { userId: a, name: 'RA', systemPrompt: 'x' } });
    const agB = await prisma.agent.create({ data: { userId: b, name: 'RB', systemPrompt: 'x' } });
    for (let i = 0; i < 2; i++) await prisma.call.create({ data: { userId: a, agentId: agA.id, recipientPhoneNumber: '+919811100005', status: 'completed', createdAt: old } });
    for (let i = 0; i < 3; i++) await prisma.call.create({ data: { userId: b, agentId: agB.id, recipientPhoneNumber: '+919811100006', status: 'completed', createdAt: old } });
    await DataRetentionJob.purgeAllExpiredData();
    const entry = async (u) => (await prisma.auditLog.findFirst({ where: { workspaceOwnerId: u, action: 'data.retention.purge' }, orderBy: { createdAt: 'desc' } }))?.metadata?.purgedCallCount;
    assert.strictEqual(await entry(a), 2);
    assert.strictEqual(await entry(b), 3);
  });

  await test('#73 a batch\'s "created" date is the IST day', async () => {
    const ws = await newUser();
    const agent = await prisma.agent.create({ data: { userId: ws, name: 'Date', systemPrompt: 'x' } });
    // 20:00 UTC on 19 Nov = 01:30 IST on 20 Nov
    const b = await prisma.batch.create({ data: { userId: ws, agentId: agent.id, name: 'Night', status: 'completed', createdAt: new Date('2026-11-19T20:00:00Z') } });
    const r = await call(handlerOf(calendarRouter, 'get', '/batches'), { workspaceId: ws });
    const row = (r.body.data || []).find((x) => x.id === b.id);
    assert.ok(row, JSON.stringify(r.body).slice(0, 200));
    assert.strictEqual(row.created, '2026-11-20');
  });

  await test('#74 a finished campaign cannot be rewritten as cancelled; cancelling twice is harmless', async () => {
    const ws = await newUser();
    const agent = await prisma.agent.create({ data: { userId: ws, name: 'Fin', systemPrompt: 'x' } });
    const done = new Date('2026-11-18T10:00:00Z');
    const b = await prisma.batch.create({ data: { userId: ws, agentId: agent.id, name: 'Done', status: 'completed', completedAt: done } });
    const cancel = handlerOf(calendarRouter, 'post', '/batches/:id/cancel');
    const r = await call(cancel, { workspaceId: ws, params: { id: b.id } });
    assert.strictEqual(r.statusCode, 409, JSON.stringify(r.body));
    const after = await prisma.batch.findUnique({ where: { id: b.id } });
    assert.strictEqual(after.status, 'completed');
    assert.strictEqual(after.completedAt.toISOString(), done.toISOString());
    const c = await prisma.batch.create({ data: { userId: ws, agentId: agent.id, name: 'Stopped', status: 'cancelled' } });
    assert.strictEqual((await call(cancel, { workspaceId: ws, params: { id: c.id } })).body.success, true);
  });

  await test('#41 batch buckets add up to the total; retries follow the campaign policy', async () => {
    const { BatchService } = require('../dist/services/BatchService');
    const ws = await newUser();
    const agent = await prisma.agent.create({ data: { userId: ws, name: 'Count', systemPrompt: 'x' } });
    const b = await prisma.batch.create({ data: { userId: ws, agentId: agent.id, name: 'Mix', status: 'running', retryConfig: JSON.stringify({ maxAttempts: 1 }) } });
    const mk = (status, extra = {}) => prisma.batchRecipient.create({ data: { batchId: b.id, phoneNumber: '+9198111' + String(Math.floor(Math.random() * 1e5)).padStart(5, '0'), status, ...extra } });
    await mk('pending');
    await mk('in_progress', { attempts: 1 });
    await mk('failed', { attempts: 1, lastErrorCode: 'NO_ANSWER' });
    await mk('failed', { attempts: 1, lastErrorCode: 'CARRIER_ERROR' });
    const k = await BatchService.computeBatchCounters(b.id);
    assert.strictEqual(k.total, 4);
    assert.strictEqual(k.remaining + k.inProgress + k.answered + k.notAnswered + k.busy + k.failed + k.skipped + k.cancelled, k.total, JSON.stringify(k));
    assert.strictEqual(k.inProgress, 1);
    assert.strictEqual(k.progressPercent, 50, 'one attempt allowed: the unanswered person is final');
    await prisma.batch.update({ where: { id: b.id }, data: { status: 'cancelled' } });
  });

  await test('#107 the calendar-connect error is a plain sentence', async () => {
    const saved = [process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET];
    const { env } = require('../dist/config/env');
    const savedEnv = [env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET];
    delete process.env.GOOGLE_CLIENT_ID; delete process.env.GOOGLE_CLIENT_SECRET;
    env.GOOGLE_CLIENT_ID = ''; env.GOOGLE_CLIENT_SECRET = '';
    try {
      const ws = await newUser();
      const r = await call(handlerOf(calendarRouter, 'post', '/connect-url'), { workspaceId: ws });
      assert.strictEqual(r.statusCode, 503);
      assert.ok(!/GOOGLE_|_NOT_CONFIGURED/.test(r.body.error), r.body.error);
      assert.strictEqual(r.body.code, 'GOOGLE_OAUTH_NOT_CONFIGURED');
    } finally {
      if (saved[0] !== undefined) process.env.GOOGLE_CLIENT_ID = saved[0];
      if (saved[1] !== undefined) process.env.GOOGLE_CLIENT_SECRET = saved[1];
      env.GOOGLE_CLIENT_ID = savedEnv[0]; env.GOOGLE_CLIENT_SECRET = savedEnv[1];
    }
  });

  await prisma.analysisJob.deleteMany({ where: { workspaceId: { in: users } } }).catch(() => {});
  console.log(`\nAudit batch 12: ${passed}/${total} passed`);
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}

main().catch(async (err) => { console.error(err); await prisma.$disconnect().catch(() => {}); process.exit(1); });
