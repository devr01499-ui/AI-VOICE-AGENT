require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Caller audio reaches Gemini Live (owner report 2026-11-23, and many times before: "the agent
 * spoke, I answered, no response").
 *
 * Root cause: caller audio was sent as `realtime_input.media_chunks`, which Google deprecated and
 * gemini-3.8-live silently drops. The greeting (sent as text) worked, the caller was never heard.
 *
 * Production code only (GeminiLiveProvider, the class desktop tests and phone calls both use);
 * the Google socket is a local fake that behaves like gemini-3.8-live:
 *   setup -> setupComplete; text turn -> spoken greeting; `realtime_input.audio` -> spoken answer;
 *   `media_chunks` -> silently ignored; `audio` + `media_chunks` together -> closed with 1007.
 */
process.env.GEMINI_API_KEY = 'test-only-not-a-real-key';

const { EventEmitter } = require('events');
const sent = [];
let heardCaller = 0;
class FakeGemini38Socket extends EventEmitter {
  constructor(url) {
    super();
    this.url = url;
    this.readyState = 0;
    this.answered = false;
    setImmediate(() => { this.readyState = 1; this.emit('open'); });
  }
  reply(obj) { setImmediate(() => this.emit('message', Buffer.from(JSON.stringify(obj)))); }
  speak(tag) {
    this.reply({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: Buffer.from(tag).toString('base64') } }] } } });
    this.reply({ serverContent: { turnComplete: true } });
  }
  send(data) {
    const msg = JSON.parse(String(data));
    sent.push(msg);
    if (msg.setup) return this.reply({ setupComplete: {} });
    if (msg.clientContent) return this.speak('greeting');
    const rt = msg.realtime_input || msg.realtimeInput;
    if (!rt) return;
    if ((rt.media_chunks || rt.mediaChunks) && rt.audio) return this.close(1007, 'Request contains an invalid argument.');
    const audio = rt.audio;
    if (audio && /^audio\/pcm/.test(String(audio.mime_type || audio.mimeType)) && audio.data) {
      heardCaller++;
      if (!this.answered) { this.answered = true; this.speak('answer'); }
    }
    // media_chunks: dropped without any error, exactly like the real model
  }
  close(code = 1000, reason = '') { this.readyState = 3; this.emit('close', code, Buffer.from(reason)); }
  terminate() { this.readyState = 3; }
  ping() {}
}
FakeGemini38Socket.OPEN = 1; FakeGemini38Socket.CLOSED = 3; FakeGemini38Socket.CONNECTING = 0; FakeGemini38Socket.CLOSING = 2;
require.cache[require.resolve('ws')] = { id: require.resolve('ws'), filename: require.resolve('ws'), loaded: true, exports: FakeGemini38Socket };

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { prisma } = require('../dist/lib/prisma');

let total = 0;
let passed = 0;
async function test(name, fn) {
  total++;
  try { await fn(); passed++; console.log(`  ✓ ${name}`); } catch (err) { console.error(`  ✗ FAIL: ${name}\n    ${err.stack || err.message}`); }
}
const waitFor = async (cond, ms = 3000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (cond()) return true; await new Promise((r) => setTimeout(r, 10)); }
  return cond();
};

async function main() {
  console.log('\n--- GEMINI LIVE: caller audio input ---');
  const providerModule = require('../dist/providers/gemini/GeminiLiveProvider');
  const { GeminiLiveProvider } = providerModule;
  const { resolveLiveModel } = require('../dist/utils/modelResolver');
  const { logger } = require('../dist/utils/logger');

  await test('caller audio is sent as realtime_input.audio (never the deprecated media_chunks)', async () => {
    assert.strictEqual(typeof providerModule.buildRealtimeAudioMessage, 'function', 'buildRealtimeAudioMessage exported');
    const msg = providerModule.buildRealtimeAudioMessage('AAAA');
    assert.deepStrictEqual(msg, { realtime_input: { audio: { mime_type: 'audio/pcm;rate=16000', data: 'AAAA' } } });
    assert.ok(!/media_?chunks/i.test(JSON.stringify(msg)));
  });

  const userId = crypto.randomUUID();
  await prisma.user.create({ data: { id: userId, email: `ai-${userId.slice(0, 8)}@claritiy-test.co.in`, fullName: 'Audio Input', passwordHash: 'x', accountType: 'developer', callingBalanceMinutes: 10, minutesRemainingSeconds: 600 } });
  const agent = await prisma.agent.create({ data: { userId, name: 'Medical Clinic Receptionist', status: 'active', systemPrompt: 'You are a clinic receptionist.', model: 'gemini-3.8-live' } });

  try {
    await test('greeting, then the caller speaks, then the agent ANSWERS (fake behaves like gemini-3.8-live)', async () => {
      const provider = new GeminiLiveProvider();
      const heardFromAgent = [];
      const result = await provider.createSession(
        { callId: `sandbox-${crypto.randomUUID()}`, agentId: agent.id, userId, model: resolveLiveModel(agent.model), instructions: 'You are a clinic receptionist.', voice: 'Aoede' },
        { onAudioDelta: (_s, b64) => heardFromAgent.push(Buffer.from(b64, 'base64').toString()), onTranscriptDelta() {}, onError() {}, onClose() {}, onFunctionCall() {} },
      );
      provider.triggerGreeting(result.sessionId, 'Greet the caller.');
      assert.ok(await waitFor(() => heardFromAgent.includes('greeting')), 'agent greets');
      // 20 ms of 16 kHz caller audio, as the phone pipeline and the desktop test send it.
      provider.sendAudio(result.sessionId, Buffer.alloc(640, 1).toString('base64'));
      assert.ok(await waitFor(() => heardFromAgent.includes('answer')), `agent answers the caller (heard: ${JSON.stringify(heardFromAgent)})`);
      const audioMsgs = sent.filter((m) => m.realtime_input || m.realtimeInput);
      assert.ok(audioMsgs.length >= 1);
      assert.ok(audioMsgs.every((m) => !/media_?chunks/i.test(JSON.stringify(m))), 'no media_chunks on the wire');
      await provider.closeSession(result.sessionId).catch(() => {});
    });

    await test('one log line per ~1000 caller chunks, not one per chunk (log flood removed)', async () => {
      const provider = new GeminiLiveProvider();
      const result = await provider.createSession(
        { callId: `sandbox-${crypto.randomUUID()}`, agentId: agent.id, userId, model: resolveLiveModel(agent.model), instructions: 'x', voice: 'Aoede' },
        { onAudioDelta() {}, onTranscriptDelta() {}, onError() {}, onClose() {}, onFunctionCall() {} },
      );
      const realInfo = logger.info;
      let callerLines = 0;
      logger.info = (message, meta) => { if (/caller audio/i.test(String(message))) callerLines++; else realInfo.call(logger, message, meta); };
      try {
        for (let i = 0; i < 1500; i++) provider.sendAudio(result.sessionId, 'AAAA');
      } finally {
        logger.info = realInfo;
      }
      assert.ok(callerLines <= 2, `caller-audio log lines for 1500 chunks: ${callerLines}`);
      await provider.closeSession(result.sessionId).catch(() => {});
    });

    await test('no code path sends media_chunks any more (desktop test and phone calls share sendAudio)', async () => {
      const offenders = [];
      const walk = (dir) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, e.name);
          if (e.isDirectory()) { if (e.name !== 'deprecated') walk(p); continue; }
          if (!/\.ts$/.test(e.name)) continue;
          fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
            if (/^\s*(\/\/|\*)/.test(line)) return;
            if (/\bmedia_?chunks\s*:/i.test(line)) offenders.push(`${path.relative(path.join(__dirname, '..'), p)}:${i + 1}`);
          });
        }
      };
      walk(path.join(__dirname, '..', 'src'));
      assert.deepStrictEqual(offenders, []);
    });
  } finally {
    await prisma.agent.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  }

  console.log(`\nGemini audio input: ${passed}/${total} passed (caller frames heard by the fake: ${heardCaller})`);
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
