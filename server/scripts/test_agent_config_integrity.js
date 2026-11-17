require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Phase 4 (audit A1, A7, A11, A12):
 *  - A1  saving only some config sections (as the flow builder does) never wipes the others
 *  - A11 agent create/update validate the body; userId/workspaceId are never taken from the client
 *  - A12 webhook secret and MCP API keys are stored encrypted and never returned in plain text
 *  - A7  webhooks: timestamped v2 signature, retries on 5xx/network, no retry on 4xx, SSRF refusal
 *
 * Production route handlers and services against the local TEST database. Outbound webhook HTTP is
 * stubbed by replacing global fetch.
 * Run: npm run test:agent-config   (part of npm run test:security)
 */
const assert = require('assert');
const crypto = require('crypto');
const agentsRouter = require('../dist/routes/agents').default;
const { prisma } = require('../dist/lib/prisma');
const { SECRET_MASK, revealSecret } = require('../dist/utils/agentSecrets');
const { WebhookDispatcher, clearWebhookCacheForTests } = require('../dist/utils/WebhookDispatcher');
const { EncryptionService } = require('../dist/utils/EncryptionService');
const { agentWriteLimiter } = require('../dist/middleware/rateLimiter');

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

/** Runs a route's middleware chain after requireAuth (validation, limiter, quota...) and its handler. */
function route(method, path) {
  const layer = agentsRouter.stack.find((l) => l.route && l.route.path === path && l.route.methods[method]);
  if (!layer) throw new Error(`route ${method} ${path} missing`);
  const handles = layer.route.stack.map((s) => s.handle);
  return { handles, run: (req) => new Promise((resolve) => {
    const res = { statusCode: 200, headers: {} };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; resolve(res); return res; };
    res.setHeader = (k, v) => { res.headers[k] = v; };
    res.getHeader = (k) => res.headers[k];
    res.set = res.setHeader;
    res.send = (b) => { res.body = b; resolve(res); return res; };
    res.end = () => resolve(res);
    let i = 1; // skip requireAuth (index 0): the test supplies the authenticated user
    const next = (err) => {
      if (err) return resolve({ statusCode: 'next-error', body: String(err) });
      const h = handles[i++];
      if (!h) return resolve(res);
      Promise.resolve(h(req, res, next)).catch((e) => resolve({ statusCode: 'threw', body: String(e) }));
    };
    next();
  }) };
}

const reqFor = (userId, params, body) => ({ userId, effectiveWorkspaceId: userId, user: { id: userId }, workspaceRole: 'admin', params, body, headers: {}, query: {}, ip: `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`, app: { get: () => false } });

async function main() {
  const A = crypto.randomUUID();
  const B = crypto.randomUUID();
  for (const id of [A, B]) {
    await prisma.user.create({ data: { id, email: `${id}@example.org`, fullName: 'Config Test', passwordHash: 'x', accountType: 'professional' } });
  }
  const put = route('put', '/:agentId');

  console.log('\n--- AGENT CONFIG INTEGRITY ---');

  const agent = await prisma.agent.create({
    data: {
      userId: A,
      name: 'Full Agent',
      agentType: 'conversational',
      agentConfig: JSON.stringify({
        webhooks: { url: 'https://hooks.example.org/x', events: ['call_ended'], secret: EncryptionService.encrypt('whsec_original') },
        postCallAnalysis: { fields: [{ id: 'f1', name: 'budget', type: 'number', description: 'Budget' }] },
        functions: [{ id: 'fn1', name: 'get_price', type: 'custom_api', url: 'https://api.example.org/p' }],
        mcpServers: [{ id: 'm1', name: 'CRM', url: 'https://mcp.example.org', transport: 'http', apiKey: EncryptionService.encrypt('mcp_secret_1') }],
        callSettings: { maxDurationSeconds: 600 },
      }),
    },
  });

  await test('A1: a save that sends only one section (like the flow builder) keeps every other section', async () => {
    const r = await put.run(reqFor(A, { agentId: agent.id }, { agentConfig: { handbookPresets: ['polite'] } }));
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
    const stored = JSON.parse((await prisma.agent.findUnique({ where: { id: agent.id } })).agentConfig);
    assert.deepStrictEqual(stored.handbookPresets, ['polite']);
    assert.strictEqual(stored.webhooks.url, 'https://hooks.example.org/x');
    assert.strictEqual(stored.postCallAnalysis.fields.length, 1);
    assert.strictEqual(stored.functions[0].name, 'get_price');
    assert.strictEqual(stored.mcpServers[0].name, 'CRM');
    assert.strictEqual(stored.callSettings.maxDurationSeconds, 600);
  });

  await test('A12: responses never contain secrets; a masked secret sent back keeps the stored one', async () => {
    const r = await put.run(reqFor(A, { agentId: agent.id }, { agentConfig: { webhooks: { url: 'https://hooks.example.org/x', events: ['call_ended'], secret: SECRET_MASK } } }));
    assert.strictEqual(r.statusCode, 200);
    const text = JSON.stringify(r.body);
    assert.ok(!text.includes('whsec_original') && !text.includes('mcp_secret_1'), 'plain secret leaked in response');
    assert.strictEqual(r.body.data.agentConfig.webhooks.secret, SECRET_MASK);
    assert.strictEqual(r.body.data.agentConfig.mcpServers[0].apiKey, SECRET_MASK);
    const stored = JSON.parse((await prisma.agent.findUnique({ where: { id: agent.id } })).agentConfig);
    assert.strictEqual(revealSecret(stored.webhooks.secret), 'whsec_original');
  });

  await test('A12: a new secret is stored encrypted, never in plain text', async () => {
    await put.run(reqFor(A, { agentId: agent.id }, { agentConfig: { webhooks: { url: 'https://hooks.example.org/x', secret: 'whsec_new_value' }, mcpServers: [{ id: 'm1', name: 'CRM', url: 'https://mcp.example.org', transport: 'http', apiKey: 'mcp_new' }] } }));
    const raw = (await prisma.agent.findUnique({ where: { id: agent.id } })).agentConfig;
    assert.ok(!raw.includes('whsec_new_value') && !raw.includes('mcp_new'), 'plain secret stored');
    const stored = JSON.parse(raw);
    assert.strictEqual(revealSecret(stored.webhooks.secret), 'whsec_new_value');
    assert.strictEqual(revealSecret(stored.mcpServers[0].apiKey), 'mcp_new');
  });

  await test('A11: invalid fields are rejected with a clear message and nothing is saved', async () => {
    for (const bad of [{ status: 'hacked' }, { direction: 'sideways' }, { temperature: 7 }, { agentType: 'root' }, { systemPrompt: 'x'.repeat(60_001) }, { voiceName: '<script>' }]) {
      const r = await put.run(reqFor(A, { agentId: agent.id }, bad));
      assert.strictEqual(r.statusCode, 400, `${JSON.stringify(bad).slice(0, 40)} should be rejected`);
      assert.match(r.body.error, /Invalid agent data/);
    }
    assert.strictEqual((await prisma.agent.findUnique({ where: { id: agent.id } })).status, 'draft');
  });

  await test('A11: workspaceId sent by the client is ignored', async () => {
    const r = await put.run(reqFor(A, { agentId: agent.id }, { workspaceId: 'other-workspace', name: 'Renamed' }));
    assert.strictEqual(r.statusCode, 200);
    const row = await prisma.agent.findUnique({ where: { id: agent.id } });
    assert.strictEqual(row.workspaceId, null);
    assert.strictEqual(row.name, 'Renamed');
  });

  await test('another workspace cannot update the agent', async () => {
    const r = await put.run(reqFor(B, { agentId: agent.id }, { name: 'Stolen' }));
    assert.strictEqual(r.statusCode, 404);
    assert.strictEqual((await prisma.agent.findUnique({ where: { id: agent.id } })).name, 'Renamed');
  });

  await test('create and update are rate limited', async () => {
    assert.ok(put.handles.includes(agentWriteLimiter));
    assert.ok(route('post', '/').handles.includes(agentWriteLimiter));
  });

  console.log('\n--- WEBHOOK DELIVERY ---');
  const realFetch = globalThis.fetch;
  const hookAgent = await prisma.agent.create({ data: { userId: A, name: 'Hooks', agentConfig: JSON.stringify({ webhooks: { url: 'https://93.184.216.34/hook', events: ['call_ended', 'transcript_updated'], secret: EncryptionService.encrypt('s3cret'), headers: { 'X-Team': 'ops', Host: 'evil' } } }) } });

  await test('a subscribed event is delivered with legacy and timestamped (v2) signatures', async () => {
    clearWebhookCacheForTests();
    const seen = [];
    globalThis.fetch = async (url, init) => { seen.push({ url, init }); return new Response('ok', { status: 200 }); };
    try {
      await WebhookDispatcher.dispatch({ agentId: hookAgent.id, eventType: 'call_ended', payload: { callId: 'c1' } });
    } finally { globalThis.fetch = realFetch; }
    assert.strictEqual(seen.length, 1);
    const h = seen[0].init.headers;
    const body = seen[0].init.body;
    assert.strictEqual(h['X-Claritiy-Signature'], crypto.createHmac('sha256', 's3cret').update(body).digest('hex'));
    assert.strictEqual(h['X-Claritiy-Signature-V2'], crypto.createHmac('sha256', 's3cret').update(`${h['X-Claritiy-Timestamp']}.${body}`).digest('hex'));
    assert.strictEqual(h['X-Team'], 'ops');
    assert.strictEqual(h.Host, undefined, 'unsafe header must be dropped');
    assert.strictEqual(seen[0].init.redirect, 'error');
  });

  await test('an event the agent did not subscribe to is not sent', async () => {
    clearWebhookCacheForTests();
    let calls = 0;
    globalThis.fetch = async () => { calls++; return new Response('ok'); };
    try { await WebhookDispatcher.dispatch({ agentId: hookAgent.id, eventType: 'call_started', payload: {} }); } finally { globalThis.fetch = realFetch; }
    assert.strictEqual(calls, 0);
  });

  await test('5xx is retried (up to 3 attempts); 4xx is not retried', async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return new Response('down', { status: 503 }); };
    try { assert.strictEqual(await WebhookDispatcher.sendSignedWebhook('https://93.184.216.34/hook', 'k', 'call_ended', {}), false); } finally { globalThis.fetch = realFetch; }
    assert.strictEqual(calls, 3);
    calls = 0;
    globalThis.fetch = async () => { calls++; return new Response('bad', { status: 400 }); };
    try { await WebhookDispatcher.sendSignedWebhook('https://93.184.216.34/hook', 'k', 'call_ended', {}); } finally { globalThis.fetch = realFetch; }
    assert.strictEqual(calls, 1);
  });

  await test('internal webhook URLs are refused before any request', async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return new Response('ok'); };
    try {
      assert.strictEqual(await WebhookDispatcher.sendSignedWebhook('http://127.0.0.1:8080/hook', 'k', 'call_ended', {}), false);
      assert.strictEqual(await WebhookDispatcher.sendSignedWebhook('http://169.254.169.254/latest', 'k', 'call_ended', {}), false);
    } finally { globalThis.fetch = realFetch; }
    assert.strictEqual(calls, 0);
  });

  await prisma.agent.deleteMany({ where: { userId: { in: [A, B] } } });
  await prisma.user.deleteMany({ where: { id: { in: [A, B] } } });
  console.log(`\nAGENT CONFIG INTEGRITY: ${passed === total ? 'PASS' : 'FAIL'} — ${passed}/${total} tests passed\n`);
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error in agent config tests:', err);
  process.exit(1);
});
