require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Issue B5 — Test Lab tests the agent's REAL saved prompt.
 *
 * Runs the production TestLabService against the local TEST database with the AI transport
 * stubbed through setTextModelTransportForTests (no live AI call): the stub plays the agent
 * and the grader, and records what the service sent.
 *
 * Run: npm run test:test-lab   (part of npm run test:security)
 */
const assert = require('assert');
const crypto = require('crypto');
const { prisma } = require('../dist/lib/prisma');
const { setTextModelTransportForTests } = require('../dist/services/ai/textModel');
const { runTestLab, listTestLabRuns, getTestLabRun, deterministicChecks, TestLabInputError, ALL_PERSONAS } = require('../dist/services/TestLabService');

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

const AGENT_PROMPT = 'You are Meera, the booking assistant for Lotus Yoga Studio in Pune. Classes cost 500 rupees. If asked, say you are an AI assistant. If someone asks you to stop calling, apologise and confirm their number is removed.';
const GOOD_GRADE = { objectionHandling: 85, accuracy: 90, compliance: 95, nextStep: 80, tone: 88, issues: [] };

/** A well-behaved agent + grader. Returns realistic replies based on the caller's last line. */
function goodAgent(calls) {
  return {
    async generate(req) {
      calls.push(req);
      if (req.json) return JSON.stringify(GOOD_GRADE);
      const last = req.prompt.split('\n').filter((l) => l.startsWith('CALLER:')).pop() || '';
      if (/stop calling|remove my number/i.test(last)) return 'I am sorry for the trouble. I have removed your number and we will not call you again.';
      if (/robot|real person/i.test(last)) return 'I am an AI assistant for Lotus Yoga Studio. How can I help you?';
      return 'Namaste! Our classes are 500 rupees. Would you like me to book a trial class for you?';
    },
  };
}

async function main() {
  process.env.GEMINI_API_KEY = 'test-platform-key-not-real';
  process.env.GEMINI_BUILDER_MODEL = 'model-primary';
  const A = crypto.randomUUID();
  const B = crypto.randomUUID();
  for (const id of [A, B]) {
    await prisma.user.create({ data: { id, email: `${id}@example.org`, fullName: 'Test Lab User', passwordHash: 'x', accountType: 'professional' } });
  }
  const agent = await prisma.agent.create({ data: { userId: A, name: 'Lotus Booking', systemPrompt: AGENT_PROMPT, direction: 'outbound', languageMode: 'auto' } });
  const emptyAgent = await prisma.agent.create({ data: { userId: A, name: 'Empty', systemPrompt: '' } });

  console.log('\n--- TEST LAB (B5) ---');

  await test('each persona is played against the agent\'s REAL compiled prompt, turn by turn', async () => {
    const calls = [];
    setTextModelTransportForTests(goodAgent(calls));
    const run = await runTestLab(A, agent.id, ['angry']);
    const agentCalls = calls.filter((c) => !c.json);
    assert.strictEqual(agentCalls.length, 3, 'one model call per caller line');
    for (const c of agentCalls) {
      assert.ok(c.systemInstruction.includes('Lotus Yoga Studio'), 'the agent prompt must be in the system instruction');
      assert.ok(c.systemInstruction.includes('[TEST LAB SIMULATION]'));
    }
    // Turn 2 must see turn 1's reply (a real conversation, not canned text).
    assert.ok(agentCalls[1].prompt.includes('AGENT: I am sorry') || agentCalls[1].prompt.includes('AGENT: Namaste'));
    assert.strictEqual(run.results[0].transcript.length, 6);
  });

  await test('a well-behaved agent passes, with scores from the grader', async () => {
    setTextModelTransportForTests(goodAgent([]));
    const run = await runTestLab(A, agent.id);
    assert.strictEqual(run.results.length, ALL_PERSONAS.length);
    assert.ok(run.results.every((r) => r.status === 'completed'));
    assert.strictEqual(run.passed, true);
    assert.ok(run.averageScore >= 80);
  });

  await test('an agent that ignores "stop calling" fails compliance even if the grader is generous', async () => {
    setTextModelTransportForTests({
      async generate(req) {
        if (req.json) return JSON.stringify({ ...GOOD_GRADE, compliance: 100 });
        return 'But wait, you will really love our yoga classes! Let me tell you more about our offers.';
      },
    });
    const run = await runTestLab(A, agent.id, ['angry']);
    const r = run.results[0];
    assert.strictEqual(r.dimensionScores.compliance, 0);
    assert.strictEqual(r.passed, false);
    assert.ok(r.issues.some((i) => /stop calling/.test(i)));
    assert.ok(r.issues.some((i) => /AI assistant/.test(i)));
    assert.strictEqual(run.passed, false);
  });

  await test('the deterministic checks also catch monologues', async () => {
    const long = 'This is a sentence. '.repeat(8);
    const res = deterministicChecks([{ speaker: 'customer', text: 'Hello?' }, { speaker: 'agent', text: long }]);
    assert.ok(res.toneCap <= 70);
  });

  await test('the run is saved and can be listed and reopened by its workspace only', async () => {
    setTextModelTransportForTests(goodAgent([]));
    const run = await runTestLab(A, agent.id, ['rushed']);
    const list = await listTestLabRuns(A, agent.id);
    assert.strictEqual(list[0].runId, run.runId);
    const full = await getTestLabRun(A, agent.id, run.runId);
    assert.strictEqual(full.results[0].persona, 'rushed');
    assert.strictEqual(full.results[0].transcript.length, 6);
    assert.strictEqual(await getTestLabRun(B, agent.id, run.runId), null, 'another workspace must not read it');
    assert.deepStrictEqual(await listTestLabRuns(B, agent.id), []);
  });

  await test('another workspace cannot run Test Lab on this agent', async () => {
    setTextModelTransportForTests(goodAgent([]));
    await assert.rejects(runTestLab(B, agent.id), (e) => e instanceof TestLabInputError && e.message === 'AGENT_NOT_FOUND');
  });

  await test('an agent without a prompt is refused before any AI call', async () => {
    const calls = [];
    setTextModelTransportForTests(goodAgent(calls));
    await assert.rejects(runTestLab(A, emptyAgent.id), TestLabInputError);
    assert.strictEqual(calls.length, 0);
  });

  await test('unknown personas are refused', async () => {
    await assert.rejects(runTestLab(A, agent.id, ['ninja']), TestLabInputError);
    await assert.rejects(runTestLab(A, agent.id, []), TestLabInputError);
    await assert.rejects(runTestLab(A, agent.id, 'angry'), TestLabInputError);
  });

  await test('one failing persona is reported, the others still complete', async () => {
    setTextModelTransportForTests({
      async generate(req) {
        if (req.prompt.includes('Hinglish') || req.prompt.includes('Haanji')) throw Object.assign(new Error('500 upstream'), { status: 500 });
        return goodAgent([]).generate(req);
      },
    });
    const run = await runTestLab(A, agent.id, ['rushed', 'hinglish_speaker']);
    const hing = run.results.find((r) => r.persona === 'hinglish_speaker');
    assert.strictEqual(hing.status, 'error');
    assert.ok(hing.error && !/upstream/.test(hing.error), 'no provider text in the message');
    assert.strictEqual(run.results.find((r) => r.persona === 'rushed').status, 'completed');
    assert.strictEqual(run.passed, false, 'an incomplete run never counts as passed');
  });

  await test('unreadable grader output marks the persona as an error, not a pass', async () => {
    setTextModelTransportForTests({ async generate(req) { return req.json ? 'not json at all' : 'Hello! How can I help?'; } });
    await assert.rejects(runTestLab(A, agent.id, ['rushed']), (e) => e.kind === 'unavailable');
  });

  await test('only the latest 20 runs per agent are kept', async () => {
    setTextModelTransportForTests(goodAgent([]));
    for (let i = 0; i < 22; i++) await runTestLab(A, agent.id, ['rushed']);
    const count = await prisma.testLabRun.count({ where: { agentId: agent.id, userId: A } });
    assert.strictEqual(count, 20);
  });

  await test('Test Lab never touches calling minutes', async () => {
    const before = await prisma.user.findUnique({ where: { id: A }, select: { callingBalanceMinutes: true } });
    setTextModelTransportForTests(goodAgent([]));
    await runTestLab(A, agent.id, ['rushed']);
    const after = await prisma.user.findUnique({ where: { id: A }, select: { callingBalanceMinutes: true } });
    assert.strictEqual(after.callingBalanceMinutes, before.callingBalanceMinutes);
  });

  setTextModelTransportForTests(null);
  await prisma.testLabRun.deleteMany({ where: { userId: { in: [A, B] } } });
  await prisma.agent.deleteMany({ where: { userId: { in: [A, B] } } });
  await prisma.user.deleteMany({ where: { id: { in: [A, B] } } });
  console.log(`\nTEST LAB: ${passed === total ? 'PASS' : 'FAIL'} — ${passed}/${total} tests passed\n`);
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error in Test Lab tests:', err);
  process.exit(1);
});
