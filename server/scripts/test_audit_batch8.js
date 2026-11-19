require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
process.env.GEMINI_API_KEY = 'test-only-not-a-real-key';
/**
 * Audit batch 8 (live calls) — production code; the AI pipeline and Google's socket are local fakes.
 *  #39  inbound calls give the AI the CALLER's number; an opt-out always lands on the DNC list
 *  #33  a failed AI start leaves no dead session behind
 *  #34  an expired pre-warmed session is cleaned up with its timers
 *  #37  closing the test tab during setup closes the model session
 *  #146 long calls: compression + resumption enabled; handles captured; resume reuses the full setup
 * Run: npm run test:audit-batch8   (part of npm run test:security)
 */
// Fake Google socket for the provider (installed before anything loads 'ws' users).
const { EventEmitter } = require('events');
const sockets = [];
class FakeGoogleSocket extends EventEmitter {
  constructor(url) { super(); this.url = url; this.readyState = 0; this.sent = []; sockets.push(this); setImmediate(() => { this.readyState = 1; this.emit('open'); }); }
  send(data) { const m = JSON.parse(String(data)); this.sent.push(m); if (m.setup) setImmediate(() => this.emit('message', Buffer.from(JSON.stringify({ setupComplete: {} })))); }
  close() { this.readyState = 3; }
  terminate() { this.readyState = 3; }
  ping() {}
  removeAllListeners(...a) { return super.removeAllListeners(...a); }
}
FakeGoogleSocket.OPEN = 1; FakeGoogleSocket.CLOSED = 3; FakeGoogleSocket.CONNECTING = 0; FakeGoogleSocket.CLOSING = 2;
FakeGoogleSocket.WebSocketServer = class {};
require.cache[require.resolve('ws')] = { id: require.resolve('ws'), filename: require.resolve('ws'), loaded: true, exports: FakeGoogleSocket };

const assert = require('assert');
const crypto = require('crypto');
const { prisma } = require('../dist/lib/prisma');

let total = 0;
let passed = 0;
async function test(name, fn) {
  total++;
  try { await fn(); passed++; console.log(`  ✓ ${name}`); } catch (err) { console.error(`  ✗ FAIL: ${name}\n    ${err.stack || err.message}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const phone = () => `+9198${Math.floor(10000000 + Math.random() * 89999999)}`;

async function main() {
  console.log('\n--- AUDIT BATCH 8 ---');
  // Fake pipeline runner: records the tool handler; start() succeeds unless told otherwise.
  const runnerModule = require('../dist/core/pipeline/PipecatRunner');
  const RealRunner = runnerModule.PipecatRunner;
  const runners = [];
  let failStart = false;
  class FakeRunner {
    constructor(callId, config, onAudio, onFunctionCall) { this.callId = callId; this.config = config; this.onFunctionCall = onFunctionCall; this.stopped = false; runners.push(this); }
    async start() { if (failStart) throw new Error('model setup failed'); }
    async stop() { this.stopped = true; }
    setOutputSink() {}
    handleInboundAudio() {}
    triggerGreeting() {}
  }
  runnerModule.PipecatRunner = FakeRunner;
  const { callOrchestrator } = require('../dist/core/orchestrator/CallOrchestrator');
  const carrierHangup = require('../dist/core/telephony/carrierHangup');
  carrierHangup.hangupCarrierLeg = async () => 'hung_up';

  const uid = crypto.randomUUID();
  await prisma.user.create({ data: { id: uid, email: `b8-${uid.slice(0, 8)}@claritiy-test.co.in`, fullName: 'Batch Eight', passwordHash: 'x', accountType: 'developer', callingBalanceMinutes: 100, minutesRemainingSeconds: 6000 } });
  const agent = await prisma.agent.create({ data: { userId: uid, name: 'B8', status: 'active', systemPrompt: 'You are a test agent.' } });

  try {
    await test('#39 inbound: the AI gets the caller\'s number, and an opt-out puts the caller on the DNC list', async () => {
      const { AudioStreamHandler } = require('../dist/websockets/AudioStreamHandler');
      const caller = phone();
      const ourDid = phone();
      const c = await prisma.call.create({ data: { userId: uid, agentId: agent.id, recipientPhoneNumber: ourDid, fromPhoneNumber: caller, callDirection: 'inbound', status: 'connected' } });
      const orig = callOrchestrator.attachPrewarmedVoiceSession;
      let passedNumber = null;
      callOrchestrator.attachPrewarmedVoiceSession = async (callId, agentId, num) => { passedNumber = num; return 'sess-1'; };
      try {
        const h = new AudioStreamHandler();
        h.connections.set(c.id, { callId: c.id, ws: Object.assign(new EventEmitter(), { readyState: 1, send() {}, close() {} }), audioStats: { packetsReceived: 0, bytesReceived: 0 }, sessionReady: false, inboundAudioBuffer: [] });
        h.handleStreamStart(c.id, { event: 'start', streamId: 's1', start: {} });
        for (let i = 0; i < 30 && !passedNumber; i++) await sleep(50);
        assert.strictEqual(passedNumber, caller, 'caller number, not our DID');
        h.connections.delete(c.id);
      } finally {
        callOrchestrator.attachPrewarmedVoiceSession = orig;
      }

      // The AI's end_call tool with an opt-out, for a caller who is not yet a contact.
      runners.length = 0;
      const live = await prisma.call.create({ data: { userId: uid, agentId: agent.id, recipientPhoneNumber: ourDid, fromPhoneNumber: caller, callDirection: 'inbound', status: 'connected' } });
      await callOrchestrator.startVoiceSession(live.id, agent.id, caller);
      const runner = runners.pop();
      const origEnd = callOrchestrator.endCallGracefully;
      callOrchestrator.endCallGracefully = async () => {};
      try {
        await runner.onFunctionCall('t1', 'end_call', JSON.stringify({ reason: 'opt_out' }));
      } finally {
        callOrchestrator.endCallGracefully = origEnd;
      }
      const contact = await prisma.contact.findFirst({ where: { userId: uid, phoneNumber: caller } });
      assert.ok(contact && contact.optedOutAt, 'new contact created on the DNC list');
      assert.strictEqual(await prisma.contact.count({ where: { userId: uid, phoneNumber: ourDid, optedOutAt: { not: null } } }), 0, 'our own number is never marked DNC');
      callOrchestrator.activeCalls.delete(live.id);
    });

    await test('#33 a failed AI start leaves no dead session behind', async () => {
      const c = await prisma.call.create({ data: { userId: uid, agentId: agent.id, recipientPhoneNumber: phone(), fromPhoneNumber: phone(), callDirection: 'outbound', status: 'ringing' } });
      failStart = true;
      try {
        await assert.rejects(callOrchestrator.startVoiceSession(c.id, agent.id, c.recipientPhoneNumber), /model setup failed/);
      } finally {
        failStart = false;
      }
      assert.strictEqual(callOrchestrator.activeCalls.has(c.id), false, 'no dead session to be reused');
      assert.ok(runners[runners.length - 1].stopped, 'runner stopped');
    });

    await test('#34 an expired pre-warmed session is cleaned up with its timers', async () => {
      const c = await prisma.call.create({ data: { userId: uid, agentId: agent.id, recipientPhoneNumber: phone(), fromPhoneNumber: phone(), callDirection: 'outbound', status: 'ringing' } });
      await callOrchestrator.prewarmVoiceSession(c.id, agent.id, c.recipientPhoneNumber);
      for (let i = 0; i < 40 && !callOrchestrator.activeCalls.has(c.id); i++) await sleep(50);
      assert.ok(callOrchestrator.activeCalls.has(c.id), 'prewarmed');
      const runner = runners[runners.length - 1];
      await sleep(15600); // TTL is 15 s
      assert.strictEqual(callOrchestrator.prewarmedSessions.has(c.id), false);
      assert.strictEqual(callOrchestrator.activeCalls.has(c.id), false, 'its session is removed too');
      assert.ok(runner.stopped, 'model session stopped');
    });

    await test('#37 closing the test tab during setup closes the model session', async () => {
      const { SandboxStreamHandler } = require('../dist/websockets/SandboxStreamHandler');
      const authUtils = require('../dist/utils/auth');
      const origVerify = authUtils.verifySupabaseToken;
      authUtils.verifySupabaseToken = async () => ({ sub: uid });
      const h = new SandboxStreamHandler();
      const closed = [];
      let releaseSetup;
      h.provider = {
        createSession: () => new Promise((r) => { releaseSetup = () => r({ sessionId: 'sandbox-sess-1' }); }),
        closeSession: async (id) => { closed.push(id); },
        triggerGreeting() {},
        sendAudio() {},
      };
      const ws = Object.assign(new EventEmitter(), { readyState: 1, send() {}, close() { this.readyState = 3; } });
      try {
        const done = h.handleConnection(ws, { url: `/sandbox?agentId=${agent.id}&token=t`, headers: { host: 'localhost' } });
        for (let i = 0; i < 100 && !releaseSetup; i++) await sleep(50);
        assert.ok(releaseSetup, 'setup in progress');
        ws.readyState = 3;
        ws.emit('close');          // the tab closes while the model session is still being set up
        releaseSetup();
        await done;
        assert.deepStrictEqual(closed, ['sandbox-sess-1'], 'late session closed straight away');
      } finally {
        authUtils.verifySupabaseToken = origVerify;
      }
    });

    await test('#146 long calls: compression + resumption, handle captured, resume reuses the full setup', async () => {
      const { parseGoAwayMs, buildResumptionSetup, GeminiLiveProvider } = require('../dist/providers/gemini/GeminiLiveProvider');
      assert.strictEqual(parseGoAwayMs({ timeLeft: '9.5s' }), 9500);
      assert.strictEqual(parseGoAwayMs({ timeLeft: { seconds: '12', nanos: 500000000 } }), 12500);
      assert.strictEqual(parseGoAwayMs({ timeLeftMs: 3000 }), 3000);
      assert.deepStrictEqual(buildResumptionSetup({ setup: { model: 'models/m', systemInstruction: { parts: [{ text: 'X' }] } } }, 'models/m', 'h1'), { setup: { model: 'models/m', systemInstruction: { parts: [{ text: 'X' }] }, sessionResumption: { handle: 'h1' } } });

      const provider = new GeminiLiveProvider();
      sockets.length = 0;
      const result = await provider.createSession(
        { callId: `sandbox-${crypto.randomUUID()}`, agentId: agent.id, userId: uid, model: 'models/gemini-3.8-live', instructions: 'You are a test agent.', voice: 'Puck', tools: [] },
        { onAudio() {}, onTranscript() {}, onError() {}, onClose() {} },
      );
      const first = sockets[0];
      const setup = first.sent.find((m) => m.setup).setup;
      assert.deepStrictEqual(setup.contextWindowCompression, { slidingWindow: {} });
      assert.deepStrictEqual(setup.sessionResumption, {});
      first.emit('message', Buffer.from(JSON.stringify({ sessionResumptionUpdate: { newHandle: 'handle-42', resumable: true } })));
      first.emit('message', Buffer.from(JSON.stringify({ goAway: { timeLeft: '5s' } })));
      for (let i = 0; i < 40 && sockets.length < 2; i++) await sleep(50);
      assert.ok(sockets[1], 'a new connection is opened');
      for (let i = 0; i < 40 && !sockets[1].sent.length; i++) await sleep(50);
      const resumed = sockets[1].sent[0].setup;
      assert.deepStrictEqual(resumed.sessionResumption, { handle: 'handle-42' });
      assert.strictEqual(resumed.systemInstruction.parts[0].text, setup.systemInstruction.parts[0].text, 'same instructions');
      assert.strictEqual(resumed.model, setup.model);
      try { await provider.closeSession?.(result.sessionId); } catch {}
    });
  } finally {
    runnerModule.PipecatRunner = RealRunner;
  }

  console.log(`\nAudit batch 8: ${passed}/${total} passed`);
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}

main().catch(async (err) => { console.error(err); await prisma.$disconnect().catch(() => {}); process.exit(1); });
