require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Audit #160: agent tags sent as a plain string ("vip, lead") were stored as-is, and every read
 * ran JSON.parse on them, so creating the agent answered 500 and the agent could no longer be
 * opened. Tags are now stored as a JSON array whatever the client sends, and old rows that
 * hold a plain string are read safely.
 * Production route handlers, local TEST database.
 * Run: npm run test:agent-tags   (part of npm run test:security)
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
function call(fn, { userId, params = {}, body = {} }) {
  return new Promise((resolve) => {
    const res = { statusCode: 200 };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; resolve(res); return res; };
    const next = (err) => resolve({ statusCode: err ? 500 : 'next', body: err && String(err.message || err) });
    Promise.resolve(fn({ effectiveWorkspaceId: userId, userId, user: { id: userId }, workspaceRole: 'admin', params, body, query: {}, headers: {} }, res, next))
      .catch((e) => resolve({ statusCode: 'threw', body: String(e && e.stack || e) }));
  });
}

const users = [];
async function newUser() {
  const id = crypto.randomUUID();
  users.push(id);
  await prisma.user.create({ data: { id, email: `tags-${id.slice(0, 8)}@claritiy-test.co.in`, fullName: 'Tags', passwordHash: 'x', accountType: 'professional' } });
  return id;
}

async function main() {
  const router = require('../dist/routes/agents').default;
  const create = handlerOf(router, 'post', '/');
  const get = handlerOf(router, 'get', '/:agentId');
  const update = handlerOf(router, 'put', '/:agentId');
  console.log('\n--- AGENT TAGS (#160) ---');

  await test('creating an agent with tags as a plain string works and stores a JSON array', async () => {
    const ws = await newUser();
    const r = await call(create, { userId: ws, body: { name: 'Tag Agent', agentType: 'prompt', systemPrompt: 'x', tags: 'vip, lead' } });
    assert.strictEqual(r.statusCode, 201, JSON.stringify(r.body).slice(0, 300));
    assert.deepStrictEqual(r.body.data.tags, ['vip', 'lead']);
    const row = await prisma.agent.findFirst({ where: { userId: ws } });
    assert.deepStrictEqual(JSON.parse(row.tags), ['vip', 'lead'], 'stored as a JSON array');
    const g = await call(get, { userId: ws, params: { agentId: row.id } });
    assert.strictEqual(g.statusCode, 200, JSON.stringify(g.body).slice(0, 300));
    assert.deepStrictEqual(g.body.data.tags, ['vip', 'lead']);
  });

  await test('updating tags with a string, a JSON string or an array all store a clean array', async () => {
    const ws = await newUser();
    const agent = await prisma.agent.create({ data: { userId: ws, name: 'T', systemPrompt: 'x' } });
    for (const [tags, want] of [['a, b ,,c', ['a', 'b', 'c']], ['["x","y"]', ['x', 'y']], [['p', ' q '], ['p', 'q']]]) {
      const r = await call(update, { userId: ws, params: { agentId: agent.id }, body: { tags } });
      assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body).slice(0, 300));
      assert.deepStrictEqual(JSON.parse((await prisma.agent.findUnique({ where: { id: agent.id } })).tags), want, `for ${JSON.stringify(tags)}`);
    }
  });

  await test('an agent already stored with plain-text tags can still be opened', async () => {
    const ws = await newUser();
    const agent = await prisma.agent.create({ data: { userId: ws, name: 'Legacy', systemPrompt: 'x', tags: 'legacy, imported' } });
    const g = await call(get, { userId: ws, params: { agentId: agent.id } });
    assert.strictEqual(g.statusCode, 200, JSON.stringify(g.body).slice(0, 300));
    assert.deepStrictEqual(g.body.data.tags, ['legacy', 'imported']);
  });

  await prisma.user.deleteMany({ where: { id: { in: users } } }).catch(() => {});
  console.log(`\nAgent tags: ${passed}/${total} passed`);
  await prisma.$disconnect();
  process.exit(passed === total ? 0 : 1);
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect().catch(() => {}); process.exit(1); });
