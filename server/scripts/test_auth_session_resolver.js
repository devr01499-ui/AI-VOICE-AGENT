require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * requireAuth session resolver (owner reports 2026-11-22/23: "We could not open <agent>. We could
 * not verify your session ... AUTH-TRACE-..." on the free database plan).
 *
 * The old middleware, for EVERY request: verified the token with Supabase, read the user row,
 * looked the email up again, and wrote the user row (upsert); a page load fires ~10 such requests
 * in parallel with the same token, all writing the same row. Any failure in that write blocked an
 * existing, valid customer.
 *
 * Production code path: the real requireAuth on an express app; only the Supabase token check is
 * stubbed; Prisma calls are counted (and in one case made to fail) on the real test database.
 */
const assert = require('assert');
const crypto = require('crypto');
const http = require('http');
const express = require('express');
const { prisma } = require('../dist/lib/prisma');

let passed = 0;
let total = 0;
async function test(name, fn) {
  total++;
  try { await fn(); passed++; console.log(`  ✓ ${name}`); } catch (err) { console.error(`  ✗ FAIL: ${name}\n    ${err.stack || err.message}`); }
}

function get(port, path, token) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method: 'GET', headers: token ? { authorization: `Bearer ${token}` } : {} }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch { /* not JSON */ }
        resolve({ status: res.statusCode, json });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('\n--- requireAuth: session resolver ---');
  const { supabaseClient } = require('../dist/utils/supabase');
  const { requireAuth } = require('../dist/middleware/auth');

  // token -> Supabase user. Tokens are the user ids here.
  const users = new Map();
  let getUserCalls = 0;
  supabaseClient.auth.getUser = async (token) => {
    getUserCalls++;
    await new Promise((r) => setTimeout(r, 40)); // a real network round trip, so requests overlap
    const u = users.get(token);
    if (!u) return { data: { user: null }, error: Object.assign(new Error('invalid JWT'), { name: 'AuthApiError', status: 403 }) };
    return { data: { user: u }, error: null };
  };
  const now = new Date().toISOString();
  const makeUser = (name) => {
    const id = crypto.randomUUID();
    const email = `resolver-${id.slice(0, 8)}@claritiy-test.co.in`;
    users.set(id, { id, email, email_confirmed_at: now, user_metadata: { full_name: name } });
    return { id, email };
  };

  // Count user-row writes made by requireAuth.
  const writes = { upsert: 0, update: 0 };
  const realUpsert = prisma.user.upsert.bind(prisma.user);
  const realUpdate = prisma.user.update.bind(prisma.user);
  let failProfileSync = false;
  prisma.user.upsert = async (...args) => { writes.upsert++; return realUpsert(...args); };
  prisma.user.update = async (...args) => {
    const data = args[0] && args[0].data;
    const isLastSeen = data && Object.keys(data).length === 1 && 'lastSeenAt' in data;
    if (!isLastSeen) {
      writes.update++;
      if (failProfileSync) throw new Error('simulated: could not write the profile row');
    }
    return realUpdate(...args);
  };

  const app = express();
  app.get('/whoami', requireAuth, (req, res) => res.json({ success: true, data: { userId: req.userId, fullName: req.user.fullName } }));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const port = server.address().port;
  const created = [];

  try {
    const alice = makeUser('Alice Rao');
    created.push(alice.id);

    await test('a brand-new account: 10 parallel first requests -> all 200, one user row', async () => {
      const results = await Promise.all(Array.from({ length: 10 }, () => get(port, '/whoami', alice.id)));
      results.forEach((r) => assert.strictEqual(r.status, 200, JSON.stringify(r.json)));
      const rows = await prisma.user.count({ where: { id: alice.id } });
      assert.strictEqual(rows, 1);
    });

    await test('a brand-new account signing in from 8 tabs (8 tokens) at once -> all 200, one row', async () => {
      const dana = makeUser('Dana');
      created.push(dana.id);
      const tabs = Array.from({ length: 8 }, (_, i) => `${dana.id}-tab${i}`);
      tabs.forEach((t) => users.set(t, users.get(dana.id)));
      const results = await Promise.all(tabs.flatMap((t) => [get(port, '/whoami', t), get(port, '/whoami', t)]));
      results.forEach((r) => assert.strictEqual(r.status, 200, JSON.stringify(r.json)));
      assert.strictEqual(await prisma.user.count({ where: { id: dana.id } }), 1);
    });

    await test('10 parallel requests with the same token share ONE Supabase check', async () => {
      getUserCalls = 0;
      const results = await Promise.all(Array.from({ length: 10 }, () => get(port, '/whoami', alice.id)));
      results.forEach((r) => assert.strictEqual(r.status, 200));
      assert.strictEqual(getUserCalls, 1, `Supabase checks: ${getUserCalls}`);
    });

    await test('an existing account with nothing changed: NO user-row write per request', async () => {
      writes.upsert = 0; writes.update = 0;
      for (let i = 0; i < 3; i++) assert.strictEqual((await get(port, '/whoami', alice.id)).status, 200);
      assert.deepStrictEqual(writes, { upsert: 0, update: 0 });
    });

    await test('a changed name is still synced (same end state as before), once', async () => {
      users.get(alice.id).user_metadata.full_name = 'Alice R. Rao';
      writes.update = 0;
      const r = await get(port, '/whoami', alice.id);
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.json.data.fullName, 'Alice R. Rao');
      assert.strictEqual(writes.update, 1);
      const row = await prisma.user.findUnique({ where: { id: alice.id } });
      assert.strictEqual(row.fullName, 'Alice R. Rao');
    });

    await test('a failed profile write never locks an existing customer out (200, stored profile)', async () => {
      users.get(alice.id).user_metadata.full_name = 'Alice New Name';
      failProfileSync = true;
      const r = await get(port, '/whoami', alice.id);
      failProfileSync = false;
      assert.strictEqual(r.status, 200, JSON.stringify(r.json));
      assert.strictEqual(r.json.data.fullName, 'Alice R. Rao');
    });

    await test('signed-out / invalid token is still 401, and nothing is served from memory afterwards', async () => {
      const r = await get(port, '/whoami', 'not-a-real-user');
      assert.strictEqual(r.status, 401);
      users.delete(alice.id); // the session is revoked at Supabase
      const after = await get(port, '/whoami', alice.id);
      assert.strictEqual(after.status, 401, 'a revoked session must not be accepted from a cache');
    });

    await test('a suspended account is still refused (403)', async () => {
      const bob = makeUser('Bob');
      created.push(bob.id);
      assert.strictEqual((await get(port, '/whoami', bob.id)).status, 200);
      await prisma.user.update({ where: { id: bob.id }, data: { accountStatus: 'suspended' } });
      const r = await get(port, '/whoami', bob.id);
      assert.strictEqual(r.status, 403);
      assert.strictEqual(r.json.error, 'ACCOUNT_SUSPENDED');
    });

    await test('an unexpected failure names the stage and code in the reference, never the message', async () => {
      const carol = makeUser('Carol');
      created.push(carol.id);
      const realFindFirst = prisma.teamMember.findFirst.bind(prisma.teamMember);
      prisma.teamMember.findFirst = async () => { throw new TypeError('secret internal detail xyz'); };
      const r = await get(port, '/whoami', carol.id);
      prisma.teamMember.findFirst = realFindFirst;
      assert.strictEqual(r.status, 500);
      assert.match(r.json.error, /AUTH-TRACE-\d+ \(team_lookup\/TypeError\)/);
      assert.ok(!/secret internal detail/.test(r.json.error));
    });
  } finally {
    prisma.user.upsert = realUpsert;
    prisma.user.update = realUpdate;
    server.close();
    await prisma.user.deleteMany({ where: { id: { in: created } } }).catch(() => {});
  }

  console.log(`\nrequireAuth session resolver: ${passed}/${total} passed`);
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
