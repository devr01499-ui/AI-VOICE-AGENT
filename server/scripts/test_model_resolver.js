require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Gemini model policy (config/geminiModels.ts, utils/modelResolver.ts) and the Live setup message
 * actually sent to Google — production code only; the Google socket is a local fake.
 *  - agents on removed or unknown models run on gemini-3.8-live; supported Live models are kept
 *  - the fallback is a model Google still serves (not the removed gemini-2.0-flash-exp)
 *  - removed text models (gemini-2.0-flash, gemini-2.5-flash) are never used, even from env
 *  - the 3.8 Live setup omits `proactivity` (always on, not accepted) and declares tools BLOCKING
 * Run: npm run test:gemini-models   (part of npm run test:security)
 */
process.env.GEMINI_API_KEY = 'test-only-not-a-real-key';

// Fake Google Live socket: records the setup message and answers setupComplete. Installed before
// the provider loads, so no connection can leave this machine.
const { EventEmitter } = require('events');
const sent = [];
class FakeGoogleSocket extends EventEmitter {
  constructor(url) {
    super();
    this.url = url;
    this.readyState = 0;
    setImmediate(() => { this.readyState = 1; this.emit('open'); });
  }
  send(data) {
    sent.push(JSON.parse(String(data)));
    setImmediate(() => this.emit('message', Buffer.from(JSON.stringify({ setupComplete: {} }))));
  }
  close() { this.readyState = 3; }
  terminate() { this.readyState = 3; }
  ping() {}
}
FakeGoogleSocket.OPEN = 1; FakeGoogleSocket.CLOSED = 3; FakeGoogleSocket.CONNECTING = 0; FakeGoogleSocket.CLOSING = 2;
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

async function main() {
  console.log('\n--- GEMINI MODEL POLICY ---');
  const models = require('../dist/config/geminiModels');
  const { resolveLiveModel, DEFAULT_LIVE_MODEL, UNIVERSAL_FALLBACK_LIVE_MODEL } = require('../dist/utils/modelResolver');

  await test('agents on removed, unknown or text models run on gemini-3.8-live', async () => {
    assert.strictEqual(DEFAULT_LIVE_MODEL, 'models/gemini-3.8-live');
    for (const v of [null, undefined, '', '  ', 'gpt-4o', 'gemini-2.5-flash', 'models/gemini-2.5-flash', ...models.RETIRED_LIVE_MODELS, ...models.RETIRED_LIVE_MODELS.map((m) => `models/${m}`)]) {
      assert.strictEqual(resolveLiveModel(v), DEFAULT_LIVE_MODEL, `${JSON.stringify(v)} → default`);
    }
  });

  await test('supported Live models are kept (prefix added once)', async () => {
    for (const m of models.SUPPORTED_LIVE_MODELS) {
      assert.strictEqual(resolveLiveModel(m), `models/${m}`);
      assert.strictEqual(resolveLiveModel(`models/${m}`), `models/${m}`);
    }
  });

  await test('the fallback is a Live model Google still serves', async () => {
    assert.strictEqual(UNIVERSAL_FALLBACK_LIVE_MODEL, `models/${models.LIVE_MODEL_FALLBACK}`);
    assert.ok(!models.RETIRED_LIVE_MODELS.includes(models.LIVE_MODEL_FALLBACK));
    assert.notStrictEqual(models.LIVE_MODEL_FALLBACK, models.LIVE_MODEL_PRIMARY);
  });

  await test('removed text models are never used, even when set in the environment', async () => {
    assert.strictEqual(models.configuredTextModel(undefined), models.TEXT_MODEL_PRIMARY);
    assert.strictEqual(models.configuredTextModel('gemini-2.0-flash'), models.TEXT_MODEL_PRIMARY);
    assert.strictEqual(models.configuredTextModel('models/gemini-2.5-flash'), models.TEXT_MODEL_PRIMARY);
    assert.strictEqual(models.configuredTextModel('gemini-3.8-live'), models.TEXT_MODEL_PRIMARY, 'a voice model is not a text model');
    assert.strictEqual(models.configuredTextModel('gemini-3.8-flash'), 'gemini-3.8-flash', 'a current model from env is respected');
    assert.deepStrictEqual(models.textModelCandidates('gemini-2.0-flash'), [models.TEXT_MODEL_PRIMARY, models.TEXT_MODEL_FALLBACK]);
    for (const m of models.textModelCandidates(undefined)) assert.ok(!models.RETIRED_TEXT_MODELS.includes(m));
  });

  await test('the gemini-3.8-live setup sent to Google: no proactivity field, tools BLOCKING, current model', async () => {
    const { GeminiLiveProvider } = require('../dist/providers/gemini/GeminiLiveProvider');
    const userId = crypto.randomUUID();
    await prisma.user.create({ data: { id: userId, email: `gm-${userId.slice(0, 8)}@claritiy-test.co.in`, fullName: 'Model Test', passwordHash: 'x', accountType: 'developer', callingBalanceMinutes: 10, minutesRemainingSeconds: 600 } });
    // Saved on a model Google has removed: must still run, on the current model.
    const agent = await prisma.agent.create({ data: { userId, name: 'Model test', status: 'active', systemPrompt: 'You are a test agent.', model: 'gemini-2.5-flash-native-audio-latest', agentConfig: JSON.stringify({ speechSettings: { proactiveAudio: true } }) } });
    const provider = new GeminiLiveProvider();
    sent.length = 0;
    const tools = [{ name: 'end_call', description: 'End the call', parameters: { type: 'OBJECT', properties: {} } }];
    const result = await provider.createSession(
      { callId: `sandbox-${crypto.randomUUID()}`, agentId: agent.id, userId, model: resolveLiveModel(agent.model), instructions: 'You are a test agent.', voice: 'Puck', tools },
      { onAudio() {}, onTranscript() {}, onError() {}, onClose() {}, onToolCall() {}, onFunctionCall() {} },
    );
    assert.ok(result, 'session set up');
    const setup = sent.find((m) => m.setup)?.setup;
    assert.ok(setup, 'setup message sent');
    assert.strictEqual(setup.model, 'models/gemini-3.8-live');
    assert.ok(!('proactivity' in (setup.realtimeInputConfig || {})) && !('proactivity' in setup), 'no proactivity field for 3.8 Live');
    assert.ok(!JSON.stringify(setup).includes('enableAffectiveDialog'), 'no affective dialog');
    assert.ok(!JSON.stringify(setup).includes('thinkingConfig'), 'no thinking config');
    const fns = (setup.tools || []).flatMap((t) => t.functionDeclarations || []);
    assert.ok(fns.some((f) => f.name === 'end_call'), 'agent tool declared');
    assert.ok(fns.every((f) => f.behavior === 'BLOCKING'), 'every tool is BLOCKING (3.8 default is NON_BLOCKING)');
    try { await provider.closeSession?.(result.sessionId); } catch {}
  });

  console.log(`\nGemini models: ${passed}/${total} passed`);
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
