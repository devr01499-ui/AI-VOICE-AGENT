require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
process.env.TZ = 'UTC'; // production (Render) runs in UTC
process.env.ALLOW_OFFHOURS_BATCH_CALLS = 'true'; // dev-only switch; ignored when NODE_ENV=production
// Test-only values (real keys are blanked by the guard). No carrier is ever reached: fetch is stubbed.
process.env.PLIVO_AUTH_TOKEN = 'test_only_plivo_token';
process.env.VOBIZ_AUTH_ID = 'MA_TESTONLYB5';
process.env.VOBIZ_AUTH_TOKEN = 'test_only_vobiz_token';
process.env.VOBIZ_API_URL = 'https://carrier-a.test.invalid/api/v1';
/**
 * Audit batch 5 (docs/AUDIT_FINDINGS.md) — production code; carriers and Gemini are stubbed.
 *  #28  a per-call webhook token acts only on its own call
 *  #29  carrier-A calls keep the live CallUUID; hangup also cancels a dial request id
 *  #30  hangup cause is read before the source: busy / rejected / no-answer stay retryable
 *  #31  the silent-caller greeting timer is cancelled only by real speech, not by silence frames
 *  #35  a failed session start ends the call properly (carrier hangup + callEnded); a repeat end
 *       of a finished call still releases waiters
 *  #36  waiting for a call that already ended returns at once
 *  #38  a platform-wide capacity refusal does not burn the contact's attempt
 *  #145 an unauthenticated audio-stream connection cannot change the call it names
 * Run: npm run test:audit-batch5   (part of npm run test:security)
 */
const assert = require('assert');
const crypto = require('crypto');
const http = require('http');
const express = require('express');
const { EventEmitter } = require('events');
const { prisma } = require('../dist/lib/prisma');

let total = 0;
let passed = 0;
async function test(name, fn) {
  total++;
  try { await fn(); passed++; console.log(`  ✓ ${name}`); } catch (err) { console.error(`  ✗ FAIL: ${name}\n    ${err.stack || err.message}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const uid = () => crypto.randomUUID();
const phone = () => `+9198${Math.floor(10000000 + Math.random() * 89999999)}`;

// Outbound network: local test server only; carrier calls are recorded, never sent.
const carrierRequests = [];
let carrierReply = () => ({ status: 404, body: '' });
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (/^http:\/\/127\.0\.0\.1:/.test(u)) return realFetch(url, opts);
  carrierRequests.push({ url: u, method: opts.method || 'GET' });
  const r = carrierReply(u, opts);
  return new Response([204, 304].includes(r.status) ? null : (r.body || ''), { status: r.status });
};

const createdUsers = [];
async function newUser(accountType = 'developer', extra = {}) {
  const id = uid();
  createdUsers.push(id);
  await prisma.user.create({
    data: { id, email: `b5-${id.slice(0, 8)}@claritiy-test.co.in`, fullName: 'Batch Five', passwordHash: 'x', accountType, accountStatus: 'active', callingBalanceMinutes: 100, minutesRemainingSeconds: 6000, ...extra },
  });
  return id;
}
async function newCall(userId, agentId, data = {}) {
  return prisma.call.create({ data: { userId, agentId, recipientPhoneNumber: phone(), fromPhoneNumber: phone(), callDirection: 'outbound', status: 'in_progress', ...data } });
}
function fakeRes() {
  return {
    statusCode: 200, body: null, headers: {},
    set(k, v) { this.headers[k] = v; return this; },
    type() { return this; },
    status(c) { this.statusCode = c; return this; },
    send(b) { this.body = b; return this; },
    json(b) { this.body = b; return this; },
  };
}

async function main() {
  console.log('\n--- AUDIT BATCH 5 ---');
  const carrierHangup = require('../dist/core/telephony/carrierHangup');
  const hangups = [];
  carrierHangup.hangupCarrierLeg = async (callId) => { hangups.push(callId); return 'hung_up'; };
  const { callOrchestrator } = require('../dist/core/orchestrator/CallOrchestrator');
  const { CallController } = require('../dist/controllers/CallController');
  const u = await newUser();
  const agent = await prisma.agent.create({ data: { userId: u, name: 'B5', status: 'active', systemPrompt: 'You are a test agent.' } });

  await test('#28 a per-call webhook token cannot act on another call', async () => {
    const { getWebhookSigningSecret } = require('../dist/utils/security');
    const a = await newCall(u, agent.id);
    const b = await newCall(u, agent.id, { telemetryId: `uuid-b-${uid()}` });
    const sigA = crypto.createHmac('sha256', getWebhookSigningSecret()).update(a.id).digest('hex');
    const app = express();
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use('/api/v2/webhooks', require('../dist/routes/webhooks').default);
    const server = http.createServer(app);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}/api/v2/webhooks/plivo/hangup?callId=${a.id}&sig=${sigA}`;
    try {
      const forged = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callId: b.id, HangupCause: 'NORMAL_CLEARING' }) });
      assert.strictEqual(forged.status, 403, 'token for call A naming call B is refused');
      assert.strictEqual((await prisma.call.findUnique({ where: { id: b.id } })).status, 'in_progress', 'call B untouched');
      assert.strictEqual((await prisma.call.findUnique({ where: { id: a.id } })).status, 'in_progress', 'call A untouched by the refused request');

      const viaUuid = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ CallUUID: b.telemetryId, HangupCause: 'NORMAL_CLEARING', HangupSource: 'Callee' }) });
      assert.strictEqual(viaUuid.status, 200);
      assert.strictEqual((await prisma.call.findUnique({ where: { id: b.id } })).status, 'in_progress', 'a carrier uuid in the body cannot redirect the token to call B');
      assert.notStrictEqual((await prisma.call.findUnique({ where: { id: a.id } })).status, 'in_progress', 'the signed call A is the one ended');
    } finally {
      server.close();
    }
  });

  await test('#29 the live CallUUID is stored at answer; hangup of a request id cancels the request', async () => {
    const origPrewarm = callOrchestrator.prewarmVoiceSession;
    callOrchestrator.prewarmVoiceSession = async () => {};
    try {
      const c = await newCall(u, agent.id, { status: 'ringing', telemetryId: `req-${uid()}` });
      const callUuid = `call-${uid()}`;
      const res = fakeRes();
      await CallController.handleVobizAnswer({ query: { callId: c.id }, body: { RequestUUID: c.telemetryId, CallUUID: callUuid, Direction: 'outbound' }, headers: {}, get() { return undefined; }, protocol: 'https' }, res, (e) => { throw e; });
      assert.ok(String(res.body || '').includes('<Stream'), 'answer returns stream XML');
      assert.strictEqual((await prisma.call.findUnique({ where: { id: c.id } })).telemetryId, callUuid, 'telemetryId is now the CallUUID');
    } finally {
      callOrchestrator.prewarmVoiceSession = origPrewarm;
    }

    const admin = await newUser('admin');
    const { VobizProvider } = require('../dist/providers/vobiz/VobizProvider');
    carrierRequests.length = 0;
    carrierReply = (url) => ({ status: url.includes('/Request/') ? 204 : 404 });
    await new VobizProvider().terminateCall('req-uuid-1', admin);
    assert.ok(carrierRequests.some((r) => r.method === 'DELETE' && r.url.endsWith('/Call/req-uuid-1/')), 'live call hangup tried');
    assert.ok(carrierRequests.some((r) => r.method === 'DELETE' && r.url.endsWith('/Request/req-uuid-1/')), 'dial request cancelled after a 404');
    carrierReply = () => ({ status: 404 });
  });

  await test('#30 hangup cause wins over source; busy / rejected / no-answer stay retryable', async () => {
    const { mapCarrierHangup } = require('../dist/core/telephony/hangupCause');
    const cases = [
      ['USER_BUSY', 'Plivo', 0, 'busy'], ['Busy Line', 'plivo', 0, 'busy'], ['CALL_REJECTED', 'vobiz', 0, 'rejected'],
      ['NO_ANSWER', 'plivo', 0, 'no_answer'], ['ORIGINATOR_CANCEL', 'api', 0, 'no_answer'], ['UNALLOCATED_NUMBER', 'plivo', 0, 'failed'],
      ['NORMAL_CLEARING', 'plivo', 40, 'agent_hangup'], ['NORMAL_CLEARING', 'Callee', 40, 'caller_hangup'], ['ORIGINATOR_CANCEL', 'api', 30, 'agent_hangup'],
    ];
    for (const [cause, source, secs, want] of cases) assert.strictEqual(mapCarrierHangup(cause, source, secs).reason, want, `${cause}/${source}`);
    const c = await newCall(u, agent.id);
    await CallController.handlePlivoHangup({ query: { callId: c.id }, body: { HangupCause: 'USER_BUSY', HangupSource: 'Plivo' } }, fakeRes(), (e) => { throw e; });
    assert.strictEqual((await prisma.call.findUnique({ where: { id: c.id } })).status, 'busy', 'busy line recorded as busy (retryable)');
  });

  await test('#31 silence frames do not cancel the silent-caller greeting; speech does', async () => {
    const { AudioStreamHandler, speechFrameMs } = require('../dist/websockets/AudioStreamHandler');
    const silence = Buffer.alloc(640).toString('base64'); // 20 ms of L16 silence
    const tone = Buffer.alloc(640);
    for (let i = 0; i < 320; i++) tone.writeInt16LE(Math.round(8000 * Math.sin(i / 3)), i * 2);
    const speech = tone.toString('base64');
    assert.strictEqual(speechFrameMs(silence, 'audio/x-l16'), 0);
    assert.strictEqual(speechFrameMs(speech, 'audio/x-l16'), 20);
    assert.strictEqual(speechFrameMs(Buffer.alloc(160, 0xff).toString('base64'), 'audio/x-mulaw'), 0, 'mu-law silence');
    assert.strictEqual(speechFrameMs(Buffer.alloc(160, 0x10).toString('base64'), 'audio/x-mulaw'), 20, 'loud mu-law');

    const h = new AudioStreamHandler();
    const callId = uid();
    const timer = setTimeout(() => {}, 60000);
    const conn = { callId, ws: { close() {} }, silenceTimer: timer, audioStats: { packetsReceived: 0, bytesReceived: 0 }, sessionReady: false, inboundAudioBuffer: [], inboundFormat: 'audio/x-l16' };
    h.connections.set(callId, conn);
    for (let i = 0; i < 50; i++) h.handleMediaEvent(callId, { event: 'media', media: { payload: silence } });
    assert.ok(conn.silenceTimer, 'one second of silence keeps the greeting timer');
    assert.ok(!conn.greetingResolved);
    for (let i = 0; i < 8; i++) h.handleMediaEvent(callId, { event: 'media', media: { payload: speech } });
    assert.strictEqual(conn.silenceTimer, undefined, 'speech cancels the timer');
    assert.strictEqual(conn.greetingResolved, true);
    clearTimeout(timer);
    h.connections.delete(callId);
  });

  await test('#35 a failed session start hangs up and emits callEnded; a repeat end still releases waiters', async () => {
    const { AudioStreamHandler } = require('../dist/websockets/AudioStreamHandler');
    const origAttach = callOrchestrator.attachPrewarmedVoiceSession;
    callOrchestrator.attachPrewarmedVoiceSession = async () => { throw new Error('model setup failed'); };
    const ended = [];
    const onEnded = (e) => ended.push(e);
    callOrchestrator.on('callEnded', onEnded);
    try {
      const c = await newCall(u, agent.id, { status: 'connected' });
      const h = new AudioStreamHandler();
      const ws = Object.assign(new EventEmitter(), { readyState: 1, close() { this.readyState = 3; }, send() {} });
      h.connections.set(c.id, { callId: c.id, ws, audioStats: { packetsReceived: 0, bytesReceived: 0 }, sessionReady: false, inboundAudioBuffer: [] });
      hangups.length = 0;
      h.handleStreamStart(c.id, { event: 'start', streamId: 'stream-1', start: {} });
      for (let i = 0; i < 40 && !ended.some((e) => e.callId === c.id); i++) await sleep(100);
      assert.ok(ended.some((e) => e.callId === c.id), 'callEnded emitted');
      assert.ok(hangups.includes(c.id), 'carrier leg hung up');
      const row = await prisma.call.findUnique({ where: { id: c.id } });
      assert.strictEqual(row.status, 'failed');
      assert.strictEqual(row.endReason, 'gemini_setup_failed');

      const done = await newCall(u, agent.id, { status: 'busy', endReason: 'busy', endTime: new Date() });
      ended.length = 0;
      await callOrchestrator.endCallSession(done.id, 'ws_closed', 'late close');
      assert.deepStrictEqual(ended.find((e) => e.callId === done.id), { callId: done.id, reason: 'busy' }, 'repeat end releases waiters with the recorded outcome');
    } finally {
      callOrchestrator.attachPrewarmedVoiceSession = origAttach;
      callOrchestrator.off('callEnded', onEnded);
    }
  });

  await test('#36 waiting for a call that already ended returns at once', async () => {
    const c = await newCall(u, agent.id, { status: 'no_answer', endReason: 'no_answer', endTime: new Date() });
    const t0 = Date.now();
    const r = await callOrchestrator.waitForCallEnd(c.id, 5000);
    assert.strictEqual(r.reason, 'no_answer');
    assert.ok(Date.now() - t0 < 3000, `returned in ${Date.now() - t0} ms`);
    const live = await newCall(u, agent.id, { status: 'ringing' });
    const waiting = callOrchestrator.waitForCallEnd(live.id, 10000, 1000);
    await sleep(300);
    await prisma.call.update({ where: { id: live.id }, data: { status: 'busy', endReason: 'busy' } }); // ended elsewhere, no event
    const r2 = await waiting;
    assert.strictEqual(r2.reason, 'busy', 'an end recorded without an event is noticed by the recheck');
  });

  await test('#38 a platform capacity refusal requeues the contact without using an attempt', async () => {
    const { BatchService } = require('../dist/services/BatchService');
    const { CallService } = require('../dist/services/CallService');
    assert.strictEqual(BatchService.isCapacityRefusal('Global telephony capacity reached'), true);
    assert.strictEqual(BatchService.isCapacityRefusal('Concurrency limit exceeded'), true);
    assert.strictEqual(BatchService.isCapacityRefusal('Invalid number'), false);
    const bu = await newUser('professional');
    await prisma.vobizSubAccount.create({ data: { userId: bu, authId: `SUB_B5_${uid().slice(0, 8)}`, authToken: 't', kycStatus: 'verified', kycCallsBlocked: false } });
    const ag = await prisma.agent.create({ data: { userId: bu, name: 'B5 batch', status: 'active', systemPrompt: 'x' } });
    const fromStr = phone();
    const from = await prisma.phoneNumber.create({ data: { userId: bu, phoneNumber: fromStr, countryCode: 'IN', telephonyProvider: 'plivo', status: 'active', kycStatus: 'verified', plivoNumberId: fromStr } });
    const batch = await prisma.batch.create({
      data: { userId: bu, agentId: ag.id, fromPhoneNumberId: from.id, name: 'Capacity', status: 'running', totalRecipients: 1, recipients: { create: [{ phoneNumber: phone(), status: 'pending' }] } },
    });
    const origCreate = CallService.createCall;
    CallService.createCall = async () => {
      await prisma.batch.update({ where: { id: batch.id }, data: { status: 'paused' } }); // stop the loop after this attempt
      throw new Error('Global telephony capacity reached');
    };
    try {
      await BatchService.processBatch(batch.id, bu);
    } finally {
      CallService.createCall = origCreate;
    }
    const r = await prisma.batchRecipient.findFirst({ where: { batchId: batch.id } });
    assert.strictEqual(r.status, 'pending', 'contact waits for a free line');
    assert.strictEqual(r.attempts, 0, 'no attempt used');
    assert.strictEqual(r.lastErrorCode, 'CONCURRENCY_WAIT');
  });

  await test('#145 an unauthenticated audio-stream connection leaves the call untouched', async () => {
    const { AudioStreamHandler } = require('../dist/websockets/AudioStreamHandler');
    const c = await newCall(u, agent.id);
    const h = new AudioStreamHandler();
    let closedWith = null;
    const ws = Object.assign(new EventEmitter(), { readyState: 1, close(code) { closedWith = code; }, send() {} });
    await h.handleConnection(ws, { url: `/audio-stream?callId=${c.id}&token=forged&ts=${Date.now()}`, headers: { host: 'localhost' } });
    await sleep(300);
    assert.strictEqual(closedWith, 1008, 'connection refused');
    const row = await prisma.call.findUnique({ where: { id: c.id } });
    assert.strictEqual(row.status, 'in_progress', 'live call not marked failed');
    assert.strictEqual(row.endReason, null);
  });

  console.log(`\nAudit batch 5: ${passed}/${total} passed`);
  // Post-call analysis jobs queued by the calls ended here would crowd the shared test queue
  // (the M1 suite processes the oldest pending jobs); remove them.
  await sleep(500);
  await prisma.analysisJob.deleteMany({ where: { workspaceId: { in: createdUsers } } }).catch(() => {});
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
