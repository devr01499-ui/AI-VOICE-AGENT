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
  const failNextFindUnique = (err) => {
    prisma.user.findUnique = async (...args) => {
      prisma.user.findUnique = realFindUnique;
      throw err;
    };
  };

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
      assert.strictEqual(r.status, 503, JSON.stringify(r.json));
    });

    await test('a real bug -> 500 with reference, no internal text', async () => {
      providerMode = 'ok';
      failNextFindUnique(new Error('secret internal detail xyz'));
      const r = await get(port, '/whoami', id);
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
