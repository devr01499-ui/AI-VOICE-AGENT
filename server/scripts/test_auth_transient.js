require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * requireAuth during a restart or a database / auth-provider blip (owner report
 * "Internal Server Authentication Exception (Reference: AUTH-TRACE-...)", 2026-11-22).
 *
 * Production code path: the real requireAuth middleware on an express app; only the Supabase
 * token check is stubbed, and one Prisma call is made to fail the way a lost connection fails.
 * Expected:
 *  - auth provider unreachable  -> 503 (retryable), NOT 401 (a 401 signs the customer out)
 *  - database briefly unreachable -> 503 with Retry-After, reference code kept
 *  - a real bug (non-transient)   -> 500 with a reference, no internal error text
 *  - a rejected token             -> 401, unchanged
 *  - a normal request             -> 200, unchanged
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
        resolve({ status: res.statusCode, headers: res.headers, json });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('\n--- requireAuth: transient failures ---');
  const { supabaseClient } = require('../dist/utils/supabase');
  const { requireAuth } = require('../dist/middleware/auth');
  const { isTransientDbError, isTransientAuthProviderError } = require('../dist/utils/transientErrors');

  const id = crypto.randomUUID();
  const email = `auth-transient-${id.slice(0, 8)}@claritiy-test.co.in`;
  await prisma.user.create({ data: { id, email, fullName: 'Auth Transient', passwordHash: 'x' } });

  let providerMode = 'ok';
  supabaseClient.auth.getUser = async (token) => {
    if (providerMode === 'network') {
      // What supabase-js returns when fetch fails (Render restart, DNS, timeout).
      const error = Object.assign(new Error('fetch failed'), { name: 'AuthRetryableFetchError', status: 0 });
      return { data: { user: null }, error };
    }
    if (providerMode === 'gateway') {
      const error = Object.assign(new Error('Bad Gateway'), { name: 'AuthRetryableFetchError', status: 502 });
      return { data: { user: null }, error };
    }
    if (token !== id) {
      const error = Object.assign(new Error('invalid JWT'), { name: 'AuthApiError', status: 403 });
      return { data: { user: null }, error };
    }
    const now = new Date().toISOString();
    return { data: { user: { id, email, email_confirmed_at: now, user_metadata: {} } }, error: null };
  };

  const app = express();
  app.get('/whoami', requireAuth, (req, res) => res.json({ success: true, data: { userId: req.userId } }));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const port = server.address().port;

  // Make the first user lookup inside requireAuth fail like a dropped database connection.
  const realFindUnique = prisma.user.findUnique.bind(prisma.user);
  // `times` failures, then the real call again (Infinity = the outage outlasts the request).
  const failNextFindUnique = (err, times = Infinity) => {
    let left = times;
    prisma.user.findUnique = async (...args) => {
      if (left <= 0) return realFindUnique(...args);
      left--;
      throw err;
    };
  };
  const restoreFindUnique = () => { prisma.user.findUnique = realFindUnique; };

  // Real Prisma 7 + adapter-pg errors, raised by the test database itself (not hand-made objects):
  // this is the shape production sees (P2010 / P2039 with the pg code in meta.driverAdapterError).
  // Raising 57P01 ("terminating connection") makes the pool drop that connection, and the next
  // query can then fail with "connection terminated" instead of the requested code. Only an error
  // that really carries the requested code is returned (up to 5 tries), so the classifier is
  // always judged on the error the test means.
  async function realDbError(pgCode, message) {
    let last = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await prisma.$queryRawUnsafe(`DO $$ BEGIN RAISE EXCEPTION '${message}' USING ERRCODE = '${pgCode}'; END $$`);
      } catch (err) {
        last = err;
        if (String(err && err.message).includes(`Code: \`${pgCode}\``)) return err;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`expected the database to raise ${pgCode}, got: ${String(last && last.message).slice(0, 200)}`);
  }
  const realRestart = await realDbError('57P01', 'terminating connection due to administrator command');
  const realTooMany = await realDbError('53300', 'sorry, too many clients already');
  const realPoolerLimit = await realDbError('XX000', 'Max client connections reached');
  const realSessionLimit = await realDbError('XX000', '(EMAXCONNSESSION) max clients reached in session mode - max clients are limited to pool_size: 15');
  const realBug = await realDbError('42883', 'function does_not_exist() does not exist');

  // Counts Supabase token checks, to prove a request is authenticated once even when the
  // router is mounted with requireAuth and the route lists it again.
  let getUserCalls = 0;
  const countedGetUser = supabaseClient.auth.getUser;
  supabaseClient.auth.getUser = async (token) => { getUserCalls++; return countedGetUser(token); };
  app.get('/double', requireAuth, requireAuth, (req, res) => res.json({ success: true, data: { userId: req.userId } }));

  try {
    await test('normal request still passes (200)', async () => {
      providerMode = 'ok';
      const r = await get(port, '/whoami', id);
      assert.strictEqual(r.status, 200, JSON.stringify(r.json));
      assert.strictEqual(r.json.data.userId, id);
    });

    await test('rejected token is still 401', async () => {
      providerMode = 'ok';
      const r = await get(port, '/whoami', 'not-a-real-user');
      assert.strictEqual(r.status, 401);
    });

    await test('auth provider unreachable -> 503 retryable, not 401 (no sign-out)', async () => {
      providerMode = 'network';
      const r = await get(port, '/whoami', id);
      assert.strictEqual(r.status, 503, JSON.stringify(r.json));
      assert.strictEqual(r.json.code, 'AUTH_TEMPORARILY_UNAVAILABLE');
      assert.ok(Number(r.headers['retry-after']) > 0, 'Retry-After header');
    });

    await test('auth provider 5xx -> 503, not 401', async () => {
      providerMode = 'gateway';
      const r = await get(port, '/whoami', id);
      assert.strictEqual(r.status, 503, JSON.stringify(r.json));
    });

    await test('database connection lost (P1001) -> 503 with reference and Retry-After', async () => {
      providerMode = 'ok';
      failNextFindUnique(Object.assign(new Error("Can't reach database server at db:5432"), { code: 'P1001' }));
      const r = await get(port, '/whoami', id);
      restoreFindUnique();
      assert.strictEqual(r.status, 503, JSON.stringify(r.json));
      assert.strictEqual(r.json.code, 'AUTH_TEMPORARILY_UNAVAILABLE');
      assert.match(r.json.error, /AUTH-TRACE-\d+/);
      assert.ok(!/reach database|db:5432/i.test(r.json.error), 'no internal error text');
      assert.ok(Number(r.headers['retry-after']) > 0, 'Retry-After header');
    });

    await test('pg pool error wrapped in a cause chain -> 503', async () => {
      providerMode = 'ok';
      failNextFindUnique(Object.assign(new Error('DriverAdapterError'), { cause: Object.assign(new Error('Connection terminated unexpectedly'), { code: 'ECONNRESET' }) }));
      const r = await get(port, '/whoami', id);
      restoreFindUnique();
      assert.strictEqual(r.status, 503, JSON.stringify(r.json));
    });

    // Owner report 2026-11-22 23:37 IST (AUTH-TRACE-1795370858084): real Prisma 7 errors for a
    // database restart, "too many clients" and the Supabase pooler limit were classified as bugs,
    // so customers got the 500 "We could not verify your session" instead of a retry.
    for (const [label, err] of [
      ['database restart (57P01)', realRestart],
      ['too many clients (53300)', realTooMany],
      ['Supabase pooler: Max client connections reached (XX000)', realPoolerLimit],
      ['Supabase pooler: EMAXCONNSESSION (XX000)', realSessionLimit],
    ]) {
      await test(`real Prisma error, ${label} -> transient (503, never the 500)`, async () => {
        assert.strictEqual(isTransientDbError(err), true, `classifier; error code ${err.code}`);
        providerMode = 'ok';
        failNextFindUnique(err);
        const r = await get(port, '/whoami', id);
        restoreFindUnique();
        assert.strictEqual(r.status, 503, JSON.stringify(r.json));
        assert.strictEqual(r.json.code, 'AUTH_TEMPORARILY_UNAVAILABLE');
      });
    }

    await test('a single database blip is retried on the server: the customer gets 200', async () => {
      providerMode = 'ok';
      failNextFindUnique(realPoolerLimit, 1);
      const r = await get(port, '/whoami', id);
      restoreFindUnique();
      assert.strictEqual(r.status, 200, JSON.stringify(r.json));
      assert.strictEqual(r.json.data.userId, id);
    });

    await test('a real Prisma query bug (42883) is NOT transient -> 500, no retry', async () => {
      assert.strictEqual(isTransientDbError(realBug), false);
      providerMode = 'ok';
      failNextFindUnique(realBug);
      const r = await get(port, '/whoami', id);
      restoreFindUnique();
      assert.strictEqual(r.status, 500, JSON.stringify(r.json));
      assert.ok(!/does_not_exist/.test(r.json.error), 'no internal error text');
    });

    await test('requireAuth twice on one request (router + route) checks the session once', async () => {
      providerMode = 'ok';
      getUserCalls = 0;
      const r = await get(port, '/double', id);
      assert.strictEqual(r.status, 200, JSON.stringify(r.json));
      assert.strictEqual(r.json.data.userId, id);
      assert.strictEqual(getUserCalls, 1, `Supabase token checks: ${getUserCalls}`);
      const bad = await get(port, '/double', 'not-a-real-user');
      assert.strictEqual(bad.status, 401, 'a rejected token is still refused');
    });

    await test('a real bug -> 500 with reference, no internal text', async () => {
      providerMode = 'ok';
      failNextFindUnique(new Error('secret internal detail xyz'));
      const r = await get(port, '/whoami', id);
      restoreFindUnique();
      assert.strictEqual(r.status, 500, JSON.stringify(r.json));
      assert.match(r.json.error, /AUTH-TRACE-\d+/);
      assert.ok(!/secret internal detail/.test(r.json.error), 'no internal error text');
      assert.ok(!/Internal Server Authentication Exception/.test(r.json.error), 'customer-readable wording');
    });

    await test('classifier: unique-constraint and validation errors are NOT transient', async () => {
      assert.strictEqual(isTransientDbError(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })), false);
      assert.strictEqual(isTransientDbError(new Error('Invalid value for argument')), false);
      assert.strictEqual(isTransientDbError(null), false);
      assert.strictEqual(isTransientDbError(Object.assign(new Error('x'), { code: '57P03' })), true);
      assert.strictEqual(isTransientAuthProviderError({ name: 'AuthApiError', status: 401 }), false);
      assert.strictEqual(isTransientAuthProviderError({ name: 'AuthRetryableFetchError', status: 0 }), true);
    });
  } finally {
    prisma.user.findUnique = realFindUnique;
    server.close();
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }

  console.log(`\nrequireAuth transient failures: ${passed}/${total} passed`);
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
