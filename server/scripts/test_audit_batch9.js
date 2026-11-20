require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Audit batch 9 (medium findings) — production route handlers and services, local TEST database.
 *  #52  the daily booking cap counts today's earlier bookings, by the rule's local day
 *  #53  a buffer / minimum notice of 0 is saved and used (not turned into the default)
 *  #55  resuming right after a pause really resumes the campaign
 *  #56  re-analysing a call never answers "queued" when nothing was queued
 *  #58/#59  alert rules: metric/comparator/threshold validated; clearing a field stores null, not "null"
 *  #62  admin daily metrics are the LATEST 14 days
 *  #65  appointments and scheduled calls are listed together; a scheduled call can be cancelled
 *  #101 the QA latency flag uses seconds correctly
 *  #7   a document shown as "Verified" is one the number gate accepts
 *  #95  no carrier names in customer-facing errors and notifications
 * Run: npm run test:audit-batch9   (part of npm run test:security)
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

function call(fn, { workspaceId, params = {}, body = {}, query = {}, originalUrl = '/api/v2/test' }) {
  return new Promise((resolve) => {
    const res = { statusCode: 200 };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; resolve(res); return res; };
    res.send = (b) => { res.body = b; resolve(res); return res; };
    const next = (err) => resolve({ statusCode: 'next', body: err });
    Promise.resolve(fn({ effectiveWorkspaceId: workspaceId, userId: workspaceId, params, body, query, headers: {}, originalUrl }, res, next))
      .catch((e) => resolve({ statusCode: 'threw', body: String(e && e.stack || e) }));
  });
}

const CARRIER = /vobiz|plivo/i;
const users = [];
async function newUser() {
  const id = crypto.randomUUID();
  users.push(id);
  await prisma.user.create({ data: { id, email: `b9-${id.slice(0, 8)}@claritiy-test.co.in`, fullName: 'Batch Nine', passwordHash: 'x', accountType: 'professional' } });
  return id;
}

/** A time zone where it is now between 06:00 and 18:00, so "earlier today" and "later today" both exist. */
function middayZone() {
  for (const tz of ['Asia/Kolkata', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Pacific/Honolulu', 'Asia/Tokyo', 'Pacific/Kiritimati', 'Pacific/Auckland', 'Asia/Dubai']) {
    const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(new Date()));
    if (h >= 6 && h < 18) return tz;
  }
  throw new Error('no midday time zone found');
}

async function main() {
  console.log('\n--- AUDIT BATCH 9 ---');
  const calendarRouter = require('../dist/routes/calendar').default;
  const { CalendarService } = require('../dist/core/orchestrator/CalendarService');
  const localDateKey = (d, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

  await test('#52 the daily cap counts bookings made earlier today, by the local day', async () => {
    const ws = await newUser();
    const agent = await prisma.agent.create({ data: { userId: ws, name: 'Cap', systemPrompt: 'x' } });
    const tz = middayZone();
    await prisma.agentSchedulingRule.create({ data: { agentId: agent.id, timeZone: tz, workingDays: '[0,1,2,3,4,5,6]', workingHours: '{"start":"00:00","end":"23:59"}', appointmentMinutes: 30, bufferBeforeAfterMinutes: 0, minNoticeMinutes: 0, maxDaysAhead: 30, maxBookingsPerDay: 1 } });
    const earlier = new Date(Date.now() - 3 * 3600 * 1000); // same local day (it is 06:00-18:00 there)
    await prisma.calendarBooking.create({ data: { workspaceId: ws, agentId: agent.id, startUtc: earlier, endUtc: new Date(earlier.getTime() + 1800000), callerName: 'A', callerPhone: '+919876543210', idempotencyKey: crypto.randomUUID(), status: 'confirmed' } });
    const origConn = CalendarService.getConnectionForWorkspace;
    const origAvail = CalendarService.checkAvailability;
    CalendarService.getConnectionForWorkspace = async () => ({ status: 'healthy' });
    CalendarService.checkAvailability = async () => ({ busySlots: [] });
    try {
      const slots = await CalendarService.getFreeSlots(ws, agent.id, {});
      const today = localDateKey(new Date(), tz);
      assert.ok(slots.length > 0, 'later days still have slots');
      assert.strictEqual(slots.filter((s) => localDateKey(new Date(s.startIso), tz) === today).length, 0, 'today is full (1 booking, cap 1)');
    } finally {
      CalendarService.getConnectionForWorkspace = origConn;
      CalendarService.checkAvailability = origAvail;
    }
  });

  await test('#53 a buffer and minimum notice of 0 are saved and used', async () => {
    const ws = await newUser();
    const agent = await prisma.agent.create({ data: { userId: ws, name: 'Zero', systemPrompt: 'x' } });
    const save = handlerOf(calendarRouter, 'post', '/rules/:agentId');
    const r = await call(save, { workspaceId: ws, params: { agentId: agent.id }, body: { bufferBeforeAfterMinutes: 0, minNoticeMinutes: 0, appointmentMinutes: 20 } });
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
    const row = await prisma.agentSchedulingRule.findUnique({ where: { agentId: agent.id } });
    assert.strictEqual(row.bufferBeforeAfterMinutes, 0);
    assert.strictEqual(row.minNoticeMinutes, 0);
    const rule = await CalendarService.getSchedulingRule(agent.id, ws);
    assert.strictEqual(rule.bufferBeforeAfterMinutes, 0, 'read back as 0');
    assert.strictEqual(rule.minNoticeMinutes, 0, 'read back as 0');
    // a missing field still gets the default
    await call(save, { workspaceId: ws, params: { agentId: agent.id }, body: {} });
    assert.strictEqual((await prisma.agentSchedulingRule.findUnique({ where: { agentId: agent.id } })).bufferBeforeAfterMinutes, 10);
  });

  await test('#55 resuming right after a pause really resumes the campaign', async () => {
    const ws = await newUser();
    const agent = await prisma.agent.create({ data: { userId: ws, name: 'Batch', systemPrompt: 'x' } });
    // Paused a moment ago; the worker that ran it still holds a fresh lock.
    const batch = await prisma.batch.create({ data: { userId: ws, agentId: agent.id, name: 'B9', status: 'paused', lockedBy: 'worker-still-finishing', lockedAt: new Date() } });
    const resume = handlerOf(calendarRouter, 'post', '/batches/:id/resume');
    const r = await call(resume, { workspaceId: ws, params: { id: batch.id } });
    assert.strictEqual(r.body.success, true, JSON.stringify(r.body));
    const after = await prisma.batch.findUnique({ where: { id: batch.id } });
    assert.strictEqual(after.status, 'running', 'status is running, not left paused');
    assert.strictEqual(after.lockedBy, 'worker-still-finishing', 'no second worker took it');
    await prisma.batch.update({ where: { id: batch.id }, data: { status: 'cancelled', lockedBy: null, lockedAt: null } });
  });

  await test('#56 re-analysis: a live lock answers 409; a stale one is really re-queued', async () => {
    const reportsRouter = require('../dist/routes/reports').default;
    const reanalyze = handlerOf(reportsRouter, 'post', '/:callId/reanalyze');
    const ws = await newUser();
    const agent = await prisma.agent.create({ data: { userId: ws, name: 'QA', systemPrompt: 'x' } });
    const c = await prisma.call.create({ data: { userId: ws, agentId: agent.id, recipientPhoneNumber: '+919812345678', status: 'completed' } });
    try {
      await prisma.analysisJob.create({ data: { callId: c.id, workspaceId: ws, agentId: agent.id, status: 'processing', lockedBy: 'w1', lockedAt: new Date(Date.now() - 10 * 60000) } });
      const r1 = await call(reanalyze, { workspaceId: ws, params: { callId: c.id } });
      assert.strictEqual(r1.statusCode, 409, `10-min lock is live for the worker: ${JSON.stringify(r1.body)}`);
      await prisma.analysisJob.update({ where: { callId: c.id }, data: { lockedAt: new Date(Date.now() - 20 * 60000) } });
      const r2 = await call(reanalyze, { workspaceId: ws, params: { callId: c.id } });
      assert.strictEqual(r2.body.success, true, JSON.stringify(r2.body));
      assert.strictEqual((await prisma.analysisJob.findUnique({ where: { callId: c.id } })).status, 'pending', '"queued" means queued');
    } finally {
      await prisma.analysisJob.deleteMany({ where: { callId: c.id } }); // keep the shared queue clean
    }
  });

  await test('#58/#59 alert rules are validated; clearing a field stores null', async () => {
    const { AlertingController } = require('../dist/controllers/AlertingController');
    const ws = await newUser();
    const base = { name: 'Fails', metric: 'error_rate', comparator: 'greater_than', thresholdValue: 20 };
    assert.strictEqual((await call(AlertingController.createRule, { workspaceId: ws, body: { ...base, metric: 'cpu' } })).statusCode, 400, 'unknown metric');
    assert.strictEqual((await call(AlertingController.createRule, { workspaceId: ws, body: { ...base, comparator: 'around' } })).statusCode, 400, 'unknown comparator');
    assert.strictEqual((await call(AlertingController.createRule, { workspaceId: ws, body: { ...base, thresholdValue: 'abc' } })).statusCode, 400, 'NaN threshold');
    assert.strictEqual((await call(AlertingController.createRule, { workspaceId: ws, body: { ...base, notificationWebhookUrl: 'not a url' } })).statusCode, 400, 'bad webhook URL');
    const ok = await call(AlertingController.createRule, { workspaceId: ws, body: { ...base, notificationEmail: 'Ops@Example.org' } });
    assert.strictEqual(ok.statusCode, 201, JSON.stringify(ok.body));
    const id = ok.body.data.id;
    const cleared = await call(AlertingController.updateRule, { workspaceId: ws, params: { id }, body: { notificationEmail: null } });
    assert.strictEqual(cleared.statusCode, 200, JSON.stringify(cleared.body));
    assert.strictEqual((await prisma.alertRule.findUnique({ where: { id } })).notificationEmail, null, 'null, not the text "null"');
    assert.strictEqual((await call(AlertingController.updateRule, { workspaceId: ws, params: { id }, body: { thresholdValue: 'x' } })).statusCode, 400);
    assert.strictEqual((await prisma.alertRule.findUnique({ where: { id } })).thresholdValue, 20, 'unchanged after a rejected update');
  });

  await test('#62 admin daily metrics are the latest 14 days, oldest first', async () => {
    const { adminRouter } = require('../dist/routes/adminRoutes');
    const daily = handlerOf(adminRouter, 'get', '/metrics/daily');
    const dates = Array.from({ length: 20 }, (_, i) => `2091-01-${String(i + 1).padStart(2, '0')}`);
    await prisma.dailyMetric.createMany({ data: dates.map((date) => ({ date })) });
    try {
      const r = await call(daily, { workspaceId: null });
      const got = r.body.data.map((d) => d.date);
      assert.strictEqual(got.length, 14);
      assert.strictEqual(got[got.length - 1], '2091-01-20', 'ends with the latest day');
      assert.deepStrictEqual(got.slice(-14), dates.slice(-14), 'the latest 14, in order');
    } finally {
      await prisma.dailyMetric.deleteMany({ where: { date: { in: dates } } });
    }
  });

  await test('#65 appointments and scheduled calls are listed together; a scheduled call can be cancelled', async () => {
    const ws = await newUser();
    const agent = await prisma.agent.create({ data: { userId: ws, name: 'Cal', systemPrompt: 'x' } });
    const at = new Date(Date.now() + 2 * 86400000);
    const appt = await prisma.calendarBooking.create({ data: { workspaceId: ws, agentId: agent.id, startUtc: at, endUtc: new Date(at.getTime() + 1800000), callerName: 'Asha', callerPhone: '+919876543210', idempotencyKey: crypto.randomUUID() } });
    const sc = await prisma.scheduledCall.create({ data: { source: 'ai_booked', agentId: agent.id, phoneNumber: '+919876543211', scheduledAtUtc: new Date(at.getTime() + 3600000), timezone: 'Asia/Kolkata', idempotencyKey: crypto.randomUUID() } });
    const list = await call(handlerOf(calendarRouter, 'get', '/bookings'), { workspaceId: ws });
    const ids = list.body.data.map((b) => b.id);
    assert.ok(ids.includes(appt.id) && ids.includes(sc.id), 'both are listed');
    assert.strictEqual(list.body.data.find((b) => b.id === sc.id).kind, 'scheduled_call');
    const other = await newUser();
    const cancel = handlerOf(calendarRouter, 'post', '/bookings/:id/cancel');
    assert.strictEqual((await call(cancel, { workspaceId: other, params: { id: sc.id } })).statusCode, 404, 'another workspace cannot cancel it');
    const r = await call(cancel, { workspaceId: ws, params: { id: sc.id } });
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
    assert.strictEqual((await prisma.scheduledCall.findUnique({ where: { id: sc.id } })).status, 'canceled');
    assert.strictEqual((await call(cancel, { workspaceId: ws, params: { id: sc.id } })).statusCode, 409, 'already cancelled');
    await prisma.scheduledCall.delete({ where: { id: sc.id } });
  });

  await test('#101 a 4-second reply gap is flagged as high latency (segment times are seconds)', async () => {
    const { QaController } = require('../dist/controllers/QaController');
    const ws = await newUser();
    const agent = await prisma.agent.create({ data: { userId: ws, name: 'Lat', systemPrompt: 'x' } });
    const c = await prisma.call.create({ data: { userId: ws, agentId: agent.id, recipientPhoneNumber: '+919812345670', status: 'completed' } });
    await prisma.transcriptSegment.createMany({ data: [
      { callId: c.id, speaker: 'user', content: 'Hello, is this the clinic?', startTime: 0, endTime: 2, sequenceNumber: 1 },
      { callId: c.id, speaker: 'agent', content: 'Yes, how can I help?', startTime: 6, endTime: 8, sequenceNumber: 2 },
    ] });
    const cohort = await prisma.qaCohort.create({ data: { userId: ws, name: 'Latency' } });
    const r = await call(QaController.evaluateCohort, { workspaceId: ws, params: { id: cohort.id } });
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
    const result = await prisma.callQaResult.findFirst({ where: { cohortId: cohort.id, callId: c.id } });
    assert.strictEqual(result.latencyGapMs, 4000);
    assert.ok(JSON.parse(result.flaggedIssues).some((f) => /High response latency/.test(f)), 'latency flagged');
    await prisma.analysisJob.deleteMany({ where: { workspaceId: ws } });
  });

  await test('#7 a document shown as "Verified" is one the number gate accepts', async () => {
    const kyc = require('../dist/services/KycVerificationService');
    const kycRouter = require('../dist/routes/kyc').default;
    const ws = await newUser();
    await prisma.kycDocument.create({ data: { userId: ws, documentType: 'pan', status: 'verified', panNumber: 'ABCPE1234F', panType: 'personal', vobizReference: `vob_${Date.now()}`, verifiedAt: new Date() } });
    const r = await call(handlerOf(kycRouter, 'get', '/documents'), { workspaceId: ws });
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body).slice(0, 300));
    const data = r.body.data;
    const pan = (data.documents || data.documentList || []).find((d) => d.documentType === 'pan');
    assert.ok(pan, 'pan listed');
    assert.strictEqual(pan.status, 'pending', 'made-up reference: not shown as verified');
    assert.notStrictEqual(data.overallStatus, 'verified');
    assert.strictEqual((await kyc.checkRequiredKycDocumentsVerified(ws)).verified, false, 'and the gate agrees');
    // A document the carrier confirms in the user's own live KYC gets a real reference.
    const ref = kyc.liveKycDocumentReference('SA_ABCDEF12', 'pan');
    assert.strictEqual(ref, 'KYCSTATUS_SA_ABCDEF12_PAN');
    assert.strictEqual(kyc.isMockVobizReference(ref), false, 'a live carrier result is a real reference');
    assert.strictEqual(kyc.liveKycDocumentReference('SA_MOCK_1234', 'pan'), null, 'never for a simulated sub-account');
  });

  await test('#95 no carrier names in customer-facing errors and notifications', async () => {
    const { scrubCarrierNames, whiteLabelResponses } = require('../dist/utils/whiteLabel');
    const { errorHandler } = require('../dist/utils/errorHandler');
    const { ProviderError, ValidationError } = require('../dist/types/errors');
    assert.strictEqual(scrubCarrierNames('Vobiz account not provisioned'), 'calling account not provisioned');
    assert.ok(!CARRIER.test(scrubCarrierNames('[plivo] Plivo inventory search error: VobizSubAccount missing')));

    const viaHandler = (err, url = '/api/v2/numbers/search') => new Promise((resolve) => {
      const res = { statusCode: 200 };
      res.status = (c) => { res.statusCode = c; return res; };
      res.json = (b) => { res.body = b; resolve(res); return res; };
      errorHandler(err, { headers: { 'x-request-id': 'req-1' }, originalUrl: url }, res, () => {});
    });
    const p = await viaHandler(new ProviderError('vobiz', 'Failed to fetch inventory from Vobiz: 401 bad token'));
    assert.strictEqual(p.body.error.code, 'PROVIDER_ERROR');
    assert.ok(!CARRIER.test(JSON.stringify(p.body)), JSON.stringify(p.body));
    assert.ok(!/bad token/.test(p.body.error.message), 'no raw provider detail');
    const v = await viaHandler(new ValidationError('Plivo carrier account is disabled for this user.', [{ field: 'x', message: 'Vobiz down' }]));
    assert.ok(!CARRIER.test(JSON.stringify(v.body)), JSON.stringify(v.body));

    // Every customer JSON answer is guarded; the staff console keeps the real names.
    const send = (url, body) => new Promise((resolve) => {
      const res = { json: (b) => { resolve(b); return res; } };
      whiteLabelResponses({ originalUrl: url }, res, () => res.json(body));
    });
    assert.ok(!CARRIER.test(JSON.stringify(await send('/api/v2/numbers/plivo/onboard', { success: false, error: 'Failed to create Plivo subaccount: x' }))));
    assert.ok(CARRIER.test(JSON.stringify(await send('/api/v2/admin/numbers', { success: false, error: 'Vobiz balance low' }))), 'staff route unchanged');

    // The number-search route no longer passes the carrier's raw error through.
    const numbersRouter = require('../dist/routes/numbers').default;
    const { PlivoService } = require('../dist/core/telephony/PlivoService');
    const origSearch = PlivoService.prototype.searchIndianNumbers;
    PlivoService.prototype.searchIndianNumbers = async () => { throw new Error('Plivo inventory search error: {"api_id":"x"}'); };
    try {
      const ws = await newUser();
      const r = await call(handlerOf(numbersRouter, 'get', '/plivo/search'), { workspaceId: ws });
      assert.strictEqual(r.statusCode, 502);
      assert.ok(!CARRIER.test(r.body.error) && !/api_id/.test(r.body.error), r.body.error);
    } finally {
      PlivoService.prototype.searchIndianNumbers = origSearch;
    }

    // A customer's notification never names the carrier.
    const { NotificationService } = require('../dist/services/NotificationService');
    const ws = await newUser();
    await NotificationService.createInAppNotification({ userId: ws, title: 'Number Claim Error: VOBIZ_SUBACCOUNT_FAILED', message: 'Vobiz could not assign the number' });
    const alert = await prisma.systemAlert.findFirst({ where: { userId: ws }, orderBy: { createdAt: 'desc' } });
    assert.ok(alert && !CARRIER.test(alert.title + alert.message), `${alert && alert.title} / ${alert && alert.message}`);
  });

  // cleanup
  await prisma.analysisJob.deleteMany({ where: { workspaceId: { in: users } } }).catch(() => {});
  await prisma.systemAlert.deleteMany({ where: { userId: { in: users } } }).catch(() => {});

  console.log(`\nAudit batch 9: ${passed}/${total} passed`);
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}

main().catch(async (err) => { console.error(err); await prisma.$disconnect().catch(() => {}); process.exit(1); });
