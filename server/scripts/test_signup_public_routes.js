require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Issue F2 — sign-up must work for a visitor who has no account yet.
 *
 * Uses the production code: mountUserRoutes() (the same function index.ts calls),
 * the real requireAuth middleware and the real phone validator. Only request paths
 * that return before any database query are exercised, so no database is needed.
 *
 * Run: npm run test:signup   (part of npm run test:security)
 */
const assert = require('assert');
const express = require('express');
const { mountUserRoutes } = require('../dist/routes/user');
const { requireAuth } = require('../dist/middleware/auth');
const { normalizePhoneNumber } = require('../dist/utils/phoneValidator');

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

async function main() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  mountUserRoutes(app, requireAuth);
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  // A different client IP per request keeps the per-IP sign-up limiter out of the way.
  let ip = 10;
  const post = async (path, body) => {
    const res = await fetch(base + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `203.0.113.${ip++}` },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: await res.json().catch(() => ({})) };
  };

  console.log('\n--- SIGN-UP PUBLIC ROUTES (F2) ---');

  await test('validate-signup is reachable without a login token (was 401)', async () => {
    const r = await post('/api/v2/user/validate-signup', { fullName: 'New User' });
    assert.notStrictEqual(r.status, 401, 'pre-signup route must not require auth');
    assert.strictEqual(r.status, 400);
    assert.match(r.json.error, /Email address is required/);
  });

  await test('validate-signup rejects a malformed email', async () => {
    const r = await post('/api/v2/user/validate-signup', { email: 'not-an-email', contactNumber: '9876543210' });
    assert.strictEqual(r.status, 400);
    assert.match(r.json.error, /Invalid email/);
  });

  await test('validate-signup rejects a missing contact number', async () => {
    const r = await post('/api/v2/user/validate-signup', { email: 'new.user@example.org' });
    assert.strictEqual(r.status, 400);
    assert.strictEqual(r.json.code, 'INVALID_CONTACT_NUMBER');
  });

  await test('validate-signup rejects an invalid Indian mobile number', async () => {
    for (const bad of ['12345', '5876543210', '+91 12345 67890', '98765432101', 'abcdefghij', '+91 98765-4321']) {
      const r = await post('/api/v2/user/validate-signup', { email: 'new.user@example.org', contactNumber: bad });
      assert.strictEqual(r.status, 400, `"${bad}" should be rejected`);
      assert.strictEqual(r.json.code, 'INVALID_CONTACT_NUMBER', `"${bad}" should be a contact-number error`);
    }
  });

  await test('validate-signup drops bots that fill the honeypot', async () => {
    const r = await post('/api/v2/user/validate-signup', { email: 'new.user@example.org', contactNumber: '9876543210', honeypot: 'x' });
    assert.strictEqual(r.status, 400);
    assert.match(r.json.error, /rejected/);
  });

  await test('consent is reachable without a login token (was 401)', async () => {
    const r = await post('/api/v2/user/consent', { fullName: 'New User' });
    assert.strictEqual(r.status, 400);
    assert.match(r.json.error, /Email is required/);
  });

  await test('every other user route still requires a login token', async () => {
    for (const [method, path] of [['GET', '/api/v2/user/notifications'], ['POST', '/api/v2/user/billing-config'], ['POST', '/api/v2/user/notifications/mark-all-read'], ['GET', '/api/v2/user/validate-signup']]) {
      const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json' }, body: method === 'POST' ? '{}' : undefined });
      assert.strictEqual(res.status, 401, `${method} ${path} must be 401 without a token, got ${res.status}`);
    }
  });

  await test('a forged bearer token cannot open the public router to protected routes', async () => {
    const res = await fetch(base + '/api/v2/user/notifications', { headers: { authorization: 'Bearer undefined' } });
    assert.strictEqual(res.status, 401);
  });

  console.log('\n--- PHONE NUMBER RULES ---');

  await test('Indian mobiles normalise to +91XXXXXXXXXX in every common format', async () => {
    for (const good of ['9876543210', '09876543210', '919876543210', '+919876543210', '+91 98765 43210', '+91-98765-43210', '(+91) 98765 43210', '6000000000']) {
      const r = normalizePhoneNumber(good);
      assert.ok(r.ok, `"${good}" should be accepted`);
      assert.match(r.e164, /^\+91[6-9]\d{9}$/);
    }
    assert.strictEqual(normalizePhoneNumber('+91 98765 43210').e164, '+919876543210');
  });

  await test('invalid numbers are rejected with a reason', async () => {
    for (const bad of ['', '   ', null, undefined, 12345, '5876543210', '1234567890', '98765', '+910876543210', '+91 98765 4321', '+0123456789', '+12', '+1234567890123456', '98765x3210', '+91+9876543210', '9876543210; DROP TABLE users']) {
      const r = normalizePhoneNumber(bad);
      assert.strictEqual(r.ok, false, `${JSON.stringify(bad)} should be rejected`);
      assert.ok(r.error && r.error.length > 10);
    }
  });

  await test('international numbers need a country code and valid E.164 length', async () => {
    assert.strictEqual(normalizePhoneNumber('+1 (415) 555-0123').e164, '+14155550123');
    assert.strictEqual(normalizePhoneNumber('+44 20 7946 0958').e164, '+442079460958');
    assert.strictEqual(normalizePhoneNumber('4155550123').ok, false);
  });

  console.log(`\nSIGN-UP PUBLIC ROUTES: ${passed === total ? 'PASS' : 'FAIL'} — ${passed}/${total} tests passed\n`);
  server.close();
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error in sign-up route tests:', err);
  process.exit(1);
});
