require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Phase 4: live-call limits from the agent's Call Settings (they were never enforced on live calls).
 *  - Max call duration: agent setting when set, else the call's limit, never above 60 min.
 *  - End on silence: ends the call after N seconds with no speech from either side.
 *  - Timers are cleared when the call ends.
 *  - Closing message reaches the agent's instructions; "ambient noise" no longer does.
 *
 * Production CallOrchestrator (its endCallGracefully is replaced by a recorder so no real call is
 * needed) and buildFinalSystemInstruction. Uses the local TEST database.
 * Run: npm run test:call-limits   (part of npm run test:security)
 */
const assert = require('assert');
const crypto = require('crypto');
const { CallOrchestrator, resolveMaxCallSeconds, resolveSilenceSeconds, PLATFORM_MAX_CALL_SECONDS } = require('../dist/core/orchestrator/CallOrchestrator');
const { eventBus, PROVIDER_EVENTS } = require('../dist/core/provider-sdk/provider.events');
const { buildFinalSystemInstruction } = require('../dist/utils/systemInstructionBuilder');

let total = 0;
let passed = 0;
async function test(name, fn) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}\n    ${err.message}`);
  }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log('\n--- CALL LIMITS ---');
  const orch = CallOrchestrator.instance || CallOrchestrator.getInstance();
  const ended = [];
  orch.endCallGracefully = async (callId, reason) => { ended.push({ callId, reason }); };

  await test('max duration: agent setting wins, else the call limit, never above the platform ceiling', async () => {
    assert.strictEqual(PLATFORM_MAX_CALL_SECONDS, 3600);
    assert.strictEqual(resolveMaxCallSeconds(600, 1800), 600);
    assert.strictEqual(resolveMaxCallSeconds(3600, 1800), 3600);
    assert.strictEqual(resolveMaxCallSeconds(undefined, 1800), 1800);
    assert.strictEqual(resolveMaxCallSeconds(99999, 1800), 3600);
    assert.strictEqual(resolveMaxCallSeconds(10, null), 60);
    assert.strictEqual(resolveMaxCallSeconds(undefined, undefined), 3600);
  });

  await test('silence period: 0 means off; otherwise 10–600 s', async () => {
    assert.strictEqual(resolveSilenceSeconds(0), 0);
    assert.strictEqual(resolveSilenceSeconds(undefined), 0);
    assert.strictEqual(resolveSilenceSeconds(5), 10);
    assert.strictEqual(resolveSilenceSeconds(45), 45);
    assert.strictEqual(resolveSilenceSeconds(10_000), 600);
  });

  await test('the call is ended when the max duration is reached', async () => {
    const id = crypto.randomUUID();
    orch.armCallTimers(id, { maxDurationSeconds: 0.08, silenceSeconds: 0 });
    await wait(200);
    assert.deepStrictEqual(ended.filter((e) => e.callId === id).map((e) => e.reason), ['max_duration']);
    orch.clearCallTimers(id);
  });

  await test('the call is ended after the silence period, and speech resets the timer', async () => {
    const id = crypto.randomUUID();
    orch.armCallTimers(id, { maxDurationSeconds: 60, silenceSeconds: 0.15 });
    for (let i = 0; i < 4; i++) {
      await wait(80);
      eventBus.publish(PROVIDER_EVENTS.TRANSCRIPT_UPDATED, { callId: id, speaker: i % 2 ? 'agent' : 'user', text: 'hello', isFinal: false });
    }
    assert.strictEqual(ended.filter((e) => e.callId === id).length, 0, 'speech must keep the call alive');
    await wait(300);
    assert.deepStrictEqual(ended.filter((e) => e.callId === id).map((e) => e.reason), ['silence_timeout']);
    orch.clearCallTimers(id);
  });

  await test('speech on another call does not keep this call alive', async () => {
    const id = crypto.randomUUID();
    orch.armCallTimers(id, { maxDurationSeconds: 60, silenceSeconds: 0.15 });
    for (let i = 0; i < 4; i++) {
      await wait(60);
      eventBus.publish(PROVIDER_EVENTS.TRANSCRIPT_UPDATED, { callId: 'other-call', speaker: 'user', text: 'hello', isFinal: true });
    }
    await wait(100);
    assert.deepStrictEqual(ended.filter((e) => e.callId === id).map((e) => e.reason), ['silence_timeout']);
    orch.clearCallTimers(id);
  });

  await test('ending the call clears its timers', async () => {
    const id = crypto.randomUUID();
    orch.armCallTimers(id, { maxDurationSeconds: 0.1, silenceSeconds: 0.1 });
    assert.strictEqual(orch.hasCallTimers(id), true);
    await orch.endCallSession(id, 'caller_hangup').catch(() => {});
    assert.strictEqual(orch.hasCallTimers(id), false);
    await wait(250);
    assert.strictEqual(ended.filter((e) => e.callId === id).length, 0, 'no limit may fire after the call ended');
  });

  await test('closing message reaches the instructions; ambient noise does not', async () => {
    const prompt = buildFinalSystemInstruction({ name: 'A', systemPrompt: 'You are a helpful agent for a clinic.', agentConfig: JSON.stringify({ callSettings: { closingMessage: 'Thank you for calling Lotus Clinic!', ambientNoise: 'Coffee Shop' } }) }, {});
    assert.ok(prompt.includes('Thank you for calling Lotus Clinic!'));
    assert.ok(!/AMBIENT ENVIRONMENT/i.test(prompt));
  });

  console.log(`\nCALL LIMITS: ${passed === total ? 'PASS' : 'FAIL'} — ${passed}/${total} tests passed\n`);
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error in call limit tests:', err);
  process.exit(1);
});
