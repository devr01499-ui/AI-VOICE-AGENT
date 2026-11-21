require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Audit #156: internal error text (database, Google) never reaches the customer.
 *  - Call History: a database failure answers with a plain sentence, not Prisma's message.
 *  - Calling configuration: "not found" stays a clear 404; any other failure is a plain 500.
 *  - Google Calendar link: Google's error text (which can name tokens or client details) stays in the log.
 * Production route handlers run against the local TEST database. The database call and Google's
 * token refresh are made to fail on purpose; no network call is made.
 * Run: npm run test:error-leaks   (part of npm run test:security)
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

function call(fn, { workspaceId, params = {}, body = {}, query = {}, user }) {
  return new Promise((resolve) => {
    const res = { statusCode: 200, headersSent: false };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; resolve(res); return res; };
    res.setHeader = () => res;
    const next = (err) => resolve({ statusCode: 'next', body: err });
    Promise.resolve(fn({ effectiveWorkspaceId: workspaceId, userId: workspaceId, user: user || { id: workspaceId }, params, body, query, headers: {}, get: () => undefined }, res, next))
      .catch((e) => resolve({ statusCode: 'threw', body: String(e && e.stack || e) }));
  });
}

const SECRET = 'db-internal-host.secret.example:5432 password=hunter2';
const users = [];
async function newUser() {
  const id = crypto.randomUUID();
  users.push(id);
  await prisma.user.create({ data: { id, email: `leak-${id.slice(0, 8)}@claritiy-test.co.in`, fullName: 'Leak Test', passwordHash: 'x', accountType: 'professional' } });
  return id;
}
const leaks = (body) => /hunter2|secret\.example|prisma|invalid_grant|client_secret|invocation/i.test(JSON.stringify(body));

async function main() {
  console.log('\n--- INTERNAL ERROR TEXT STAYS INTERNAL (#156) ---');

  await test('Call History: a database failure answers with a plain sentence', async () => {
    const router = require('../dist/routes/calls').default;
    const list = handlerOf(router, 'get', '/');
    const ws = await newUser();
    const original = prisma.call.findMany;
    prisma.call.findMany = async () => { throw new Error(`Invalid \`prisma.call.findMany()\` invocation: can't reach ${SECRET}`); };
    let r;
    try { r = await call(list, { workspaceId: ws }); } finally { prisma.call.findMany = original; }
    assert.strictEqual(r.statusCode, 500, JSON.stringify(r.body));
    assert.ok(!leaks(r.body), `leaked: ${JSON.stringify(r.body)}`);
    assert.strictEqual(r.body.success, false);
  });

  await test('Calling configuration: an unknown number is a clear 404; a database failure is a plain 500', async () => {
    const router = require('../dist/routes/numbers').default;
    const save = handlerOf(router, 'post', '/:id/calling-config');
    const ws = await newUser();
    const nf = await call(save, { workspaceId: ws, params: { id: crypto.randomUUID() }, body: { inboundEnabled: true } });
    assert.strictEqual(nf.statusCode, 404, JSON.stringify(nf.body));
    assert.match(nf.body.error, /Phone number not found/);
    const original = prisma.phoneNumber.findFirst;
    prisma.phoneNumber.findFirst = async () => { throw new Error(`Invalid \`prisma.phoneNumber.findFirst()\` invocation: ${SECRET}`); };
    let r;
    try { r = await call(save, { workspaceId: ws, params: { id: crypto.randomUUID() }, body: { inboundEnabled: true } }); } finally { prisma.phoneNumber.findFirst = original; }
    assert.strictEqual(r.statusCode, 500, JSON.stringify(r.body));
    assert.ok(!leaks(r.body), `leaked: ${JSON.stringify(r.body)}`);
  });

  await test('Google Calendar link: Google\'s error text stays in the log', async () => {
    const { OAuth2Client } = require('google-auth-library');
    const original = OAuth2Client.prototype.refreshAccessToken;
    OAuth2Client.prototype.refreshAccessToken = async () => { throw new Error('invalid_grant: Token has been expired or revoked. client_secret=abc123'); };
    const router = require('../dist/routes/calendar').default;
    const link = handlerOf(router, 'post', '/link-from-signin');
    const ws = await newUser();
    let r;
    try { r = await call(link, { workspaceId: ws, body: { providerRefreshToken: 'refresh-token-not-real' }, user: { id: ws, email: 'x@claritiy-test.co.in' } }); } finally { OAuth2Client.prototype.refreshAccessToken = original; }
    assert.strictEqual(r.statusCode, 500, JSON.stringify(r.body));
    assert.ok(!leaks(r.body), `leaked: ${JSON.stringify(r.body)}`);
    assert.strictEqual(r.body.error, 'CALENDAR_LINK_FAILED');
  });

  await prisma.user.deleteMany({ where: { id: { in: users } } }).catch(() => {});
  console.log(`\nInternal error text: ${passed}/${total} passed`);
  await prisma.$disconnect();
  process.exit(passed === total ? 0 : 1);
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect().catch(() => {}); process.exit(1); });
