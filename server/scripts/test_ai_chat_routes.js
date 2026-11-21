require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Audit #155: the chat-style AI endpoints use the shared text-model client.
 * Covered: Test LLM (POST /agents/test-prompt), the AI Companion (POST /agents/:id/chat) and the
 * conversational builder (POST /agents/conversational-builder).
 *  - The fallback model answers when the primary model fails (it used to be a hard error).
 *  - The conversation history reaches the model as alternating turns.
 *  - The workspace's own key is used when it is saved.
 *  - The provider's error text and keys never reach the customer.
 * Production route handlers run against the local TEST database. The network transport is the
 * production stub hook (setTextModelTransportForTests), so no live AI call is made.
 * Run: npm run test:ai-chat   (part of npm run test:security)
 */
const assert = require('assert');
const crypto = require('crypto');
const { prisma } = require('../dist/lib/prisma');
const { setTextModelTransportForTests, sanitizeChatHistory } = require('../dist/services/ai/textModel');

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

function call(fn, { workspaceId, params = {}, body = {} }) {
  return new Promise((resolve) => {
    const res = { statusCode: 200 };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; resolve(res); return res; };
    const next = (err) => resolve({ statusCode: 'next', body: err });
    Promise.resolve(fn({ effectiveWorkspaceId: workspaceId, userId: workspaceId, user: { id: workspaceId }, params, body, query: {}, headers: {} }, res, next))
      .catch((e) => resolve({ statusCode: 'threw', body: String(e && e.stack || e) }));
  });
}

/** Stub transport: the primary model fails, every other model answers via `answer(req)`. */
function primaryDown(answer) {
  const calls = [];
  return {
    calls,
    transport: {
      async generate(req) {
        calls.push(req);
        if (req.model === 'model-primary') { const e = new Error('[503 Service Unavailable] model-primary is overloaded'); e.status = 503; throw e; }
        return answer(req);
      },
    },
  };
}
const LEAK = 'API key not valid. Please pass a valid API key. key=AIzaLEAKEDKEY123';
const leakingTransport = { async generate() { const e = new Error(`[400 Bad Request] ${LEAK}`); e.status = 400; throw e; } };

const users = [];
async function newUser(data = {}) {
  const id = crypto.randomUUID();
  users.push(id);
  await prisma.user.create({ data: { id, email: `ai-chat-${id.slice(0, 8)}@claritiy-test.co.in`, fullName: 'AI Chat', passwordHash: 'x', accountType: 'professional', ...data } });
  return id;
}

async function main() {
  process.env.GEMINI_API_KEY = 'test-platform-key-not-real';
  process.env.GEMINI_BUILDER_MODEL = 'model-primary';
  const router = require('../dist/routes/agents').default;
  const testPrompt = handlerOf(router, 'post', '/test-prompt');
  const chat = handlerOf(router, 'post', '/:agentId/chat');
  const builder = handlerOf(router, 'post', '/conversational-builder');

  console.log('\n--- AI CHAT ENDPOINTS (#155) ---');

  await test('Test LLM: the fallback model answers when the primary fails; history arrives as alternating turns', async () => {
    const ws = await newUser();
    const s = primaryDown(() => 'Namaste! How can I help you today?');
    setTextModelTransportForTests(s.transport);
    const history = [{ role: 'model', content: 'Hello, Lotus Dental.' }, { role: 'user', content: 'Hi' }, { role: 'model', content: 'How can I help?' }];
    const r = await call(testPrompt, { workspaceId: ws, body: { systemPrompt: 'You are the receptionist.', userQuery: 'Book a cleaning', history } });
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.data.reply, 'Namaste! How can I help you today?');
    const last = s.calls[s.calls.length - 1];
    assert.notStrictEqual(last.model, 'model-primary', 'answered by the fallback model');
    assert.strictEqual(last.prompt, 'Book a cleaning');
    assert.ok(last.systemInstruction.startsWith('You are the receptionist.'), 'agent prompt is the system instruction');
    assert.deepStrictEqual(last.history.map((t) => t.role), ['user', 'model', 'user', 'model'], 'opens with the user, alternates');
    assert.strictEqual(last.history[1].text, 'Hello, Lotus Dental.', 'the greeting is kept');
  });

  await test('Test LLM uses the workspace\'s own AI key when one is saved', async () => {
    const ws = await newUser({ geminiApiKey: 'workspace-own-key-not-real' });
    const s = primaryDown(() => 'ok');
    setTextModelTransportForTests(s.transport);
    const r = await call(testPrompt, { workspaceId: ws, body: { systemPrompt: 'x', userQuery: 'hi' } });
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
    assert.ok(s.calls.every((c) => c.apiKey === 'workspace-own-key-not-real'), 'own key used');
  });

  await test('AI Companion chat: fallback answers; the agent prompt and temperature are used', async () => {
    const ws = await newUser();
    const agent = await prisma.agent.create({ data: { userId: ws, name: 'Companion', systemPrompt: 'You are Samantha, a warm companion.', temperature: 0.4 } });
    const s = primaryDown(() => 'I am here for you.');
    setTextModelTransportForTests(s.transport);
    const r = await call(chat, { workspaceId: ws, params: { agentId: agent.id }, body: { message: 'Hello', history: [{ role: 'user', text: 'Hi' }, { role: 'model', text: 'Hey!' }] } });
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.data.text, 'I am here for you.');
    const last = s.calls[s.calls.length - 1];
    assert.strictEqual(last.systemInstruction, 'You are Samantha, a warm companion.');
    assert.strictEqual(last.temperature, 0.4);
    assert.deepStrictEqual(last.history, [{ role: 'user', text: 'Hi' }, { role: 'model', text: 'Hey!' }]);
  });

  await test('AI Companion chat: another customer\'s agent is not found', async () => {
    const owner = await newUser();
    const other = await newUser();
    const agent = await prisma.agent.create({ data: { userId: owner, name: 'Private', systemPrompt: 'secret prompt' } });
    setTextModelTransportForTests(primaryDown(() => 'should not run').transport);
    const r = await call(chat, { workspaceId: other, params: { agentId: agent.id }, body: { message: 'Hello' } });
    assert.strictEqual(r.statusCode, 404, JSON.stringify(r.body));
  });

  await test('the provider\'s error text and keys never reach the customer (all three endpoints)', async () => {
    const ws = await newUser();
    const agent = await prisma.agent.create({ data: { userId: ws, name: 'A', systemPrompt: 'x' } });
    setTextModelTransportForTests(leakingTransport);
    const results = [
      await call(testPrompt, { workspaceId: ws, body: { systemPrompt: 'x', userQuery: 'hi' } }),
      await call(chat, { workspaceId: ws, params: { agentId: agent.id }, body: { message: 'hi' } }),
      await call(builder, { workspaceId: ws, body: { message: 'Build a sales agent' } }),
    ];
    for (const r of results) {
      const text = JSON.stringify(r.body);
      assert.ok(typeof r.statusCode === 'number' && r.statusCode >= 500, `server error status, got ${r.statusCode}: ${text}`);
      assert.ok(!/AIza|API key not valid|400 Bad Request|model-primary/i.test(text), `leaked: ${text}`);
      assert.strictEqual(r.body.success, false);
    }
  });

  await test('conversational builder: fallback answers and a finished configuration is returned', async () => {
    const ws = await newUser();
    const s = primaryDown(() => JSON.stringify({ systemPrompt: 'You are a bakery sales agent.', systemVoice: 'Kore', temperature: 0.7, languageMode: 'en' }));
    setTextModelTransportForTests(s.transport);
    const r = await call(builder, { workspaceId: ws, body: { message: 'English, friendly, outbound sales for a bakery', history: [{ role: 'user', content: 'Build an agent' }, { role: 'model', content: 'What is it for?' }] } });
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.data.isFinal, true);
    assert.strictEqual(r.body.data.config.systemVoice, 'Kore');
  });

  await test('chat history is cleaned: roles coerced, empty turns dropped, same-speaker turns merged, size capped', () => {
    const h = sanitizeChatHistory([{ role: 'model', text: 'Hi there' }, { role: 'user', content: 'a' }, { role: 'user', text: 'b' }, { role: 'system', text: 'evil' }, { role: 'user', text: '   ' }, 'junk', { role: 'user', text: 'x'.repeat(9000) }]);
    assert.deepStrictEqual(h.map((t) => t.role), ['user', 'model', 'user', 'model', 'user', 'model']);
    assert.strictEqual(h[0].text, '(call connected)');
    assert.strictEqual(h[2].text, 'a\nb');
    assert.ok(h[4].text.length <= 4000);
    assert.deepStrictEqual(sanitizeChatHistory('not an array'), []);
    assert.strictEqual(sanitizeChatHistory(new Array(100).fill(0).map((_, i) => ({ role: i % 2 ? 'model' : 'user', text: String(i) }))).length <= 41, true);
  });

  setTextModelTransportForTests(null);
  await prisma.user.deleteMany({ where: { id: { in: users } } }).catch(() => {});
  console.log(`\nAI chat endpoints: ${passed}/${total} passed`);
  await prisma.$disconnect();
  process.exit(passed === total ? 0 : 1);
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect().catch(() => {}); process.exit(1); });
