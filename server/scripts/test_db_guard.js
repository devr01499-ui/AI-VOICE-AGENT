/**
 * Tests for the test-database guard (scripts/lib/testDbGuardCore.cjs).
 * Runs the production guard code: pure checks in-process, and the real
 * entry file in child processes. Needs no database and opens no connection.
 *
 * Run via: npm run test:security (first step) or node scripts/test_db_guard.js
 */
const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');
const { findViolation, describeDbUrl } = require('./lib/testDbGuardCore.cjs');

// Fake values only — these are not real hosts or credentials.
const PROD_POOLER = 'postgresql://postgres.abcdefprodref:pw@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';
const PROD_DIRECT = 'postgresql://postgres:pw@db.abcdefprodref.supabase.co:5432/postgres';
const LOCAL_TEST = 'postgresql://postgres:pw@127.0.0.1:54329/claritiy_test?sslmode=disable';

let total = 0;
let passed = 0;
function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}\n    ${err.message}`);
  }
}

console.log('\n--- TEST DATABASE GUARD ---');

test('missing TEST_DATABASE_URL is refused (no fallback to DATABASE_URL)', () => {
  assert.match(findViolation(undefined, [PROD_POOLER], false), /not set/);
  assert.match(findViolation('', [], false), /not set/);
});

test('non-postgres value is refused', () => {
  assert.match(findViolation('file:./dev.db', [], false), /not a valid/);
});

test('exact production URL is refused', () => {
  assert.match(findViolation(PROD_POOLER, [PROD_POOLER], true), /production/);
});

test('same Supabase project via a different host (direct vs pooler) is refused', () => {
  assert.match(findViolation(PROD_DIRECT, [PROD_POOLER], true), /production/);
  assert.match(findViolation(PROD_POOLER, [PROD_DIRECT], true), /production/);
});

test('same remote host with another user or database is refused', () => {
  const other = 'postgresql://postgres.otherref:pw@aws-0-ap-south-1.pooler.supabase.com:6543/other';
  assert.match(findViolation(other, [PROD_POOLER], true), /production/);
});

test('host comparison ignores case', () => {
  assert.match(findViolation(PROD_DIRECT.replace('db.abcdefprodref', 'DB.ABCDEFPRODREF'), [PROD_DIRECT], true), /production/);
});

test('remote test database needs explicit TEST_DATABASE_ALLOW_REMOTE', () => {
  const remote = 'postgresql://u:pw@test-db.example.internal:5432/claritiy_test';
  assert.match(findViolation(remote, [PROD_POOLER], false), /not a local database/);
  assert.strictEqual(findViolation(remote, [PROD_POOLER], true), null);
});

test('local test database is accepted', () => {
  assert.strictEqual(findViolation(LOCAL_TEST, [PROD_POOLER, PROD_DIRECT], false), null);
});

test('local test DB identical to a local .env DB is refused; a different local DB is accepted', () => {
  const localDev = 'postgresql://postgres:pw@127.0.0.1:54329/claritiy_test';
  assert.match(findViolation(LOCAL_TEST, [localDev], false), /production/);
  assert.strictEqual(findViolation(LOCAL_TEST, ['postgresql://postgres:pw@127.0.0.1:5432/claritiy_dev'], false), null);
});

test('unparsable .env URL fails closed for remote test databases', () => {
  const remote = 'postgresql://u:pw@test-db.example.internal:5432/claritiy_test';
  assert.match(findViolation(remote, ['not-a-url'], true), /could not be parsed/);
});

test('password with unescaped characters is still parsed, and never returned', () => {
  const d = describeDbUrl('postgresql://postgres.abcdefprodref:p@ss/w#rd@aws-0-ap-south-1.pooler.supabase.com:6543/postgres');
  assert.ok(d, 'should parse');
  assert.strictEqual(JSON.stringify(d).includes('ss/w'), false);
});

function runEntry(env) {
  const clean = { ...process.env };
  delete clean.TEST_DATABASE_URL;
  delete clean.TEST_DATABASE_ALLOW_REMOTE;
  return spawnSync(
    process.execPath,
    ['-e', "require(process.argv[1]); console.log('STARTED url=' + (process.env.DATABASE_URL === process.env.TEST_DATABASE_URL));", path.join(__dirname, 'lib', 'testDbGuard.cjs')],
    { env: { ...clean, ...env }, encoding: 'utf8' }
  );
}

test('entry file exits 1 before the script body when TEST_DATABASE_URL is missing', () => {
  const r = runEntry({ DATABASE_URL: LOCAL_TEST });
  assert.strictEqual(r.status, 1);
  assert.strictEqual(r.stdout.includes('STARTED'), false);
  assert.match(r.stderr, /BLOCKED/);
});

test('entry file forces DATABASE_URL to the test URL and hides credentials', () => {
  const r = runEntry({ TEST_DATABASE_URL: LOCAL_TEST, DATABASE_URL: PROD_POOLER });
  // On a machine whose .env already points at this same local DB the guard refuses; both outcomes are safe.
  if (r.status === 0) {
    assert.match(r.stdout, /STARTED url=true/);
  } else {
    assert.match(r.stderr, /BLOCKED/);
  }
  assert.strictEqual((r.stdout + r.stderr).includes(':pw@'), false);
});

// ── Live-service secret isolation ─────────────────────────────────────────────
const { isolateLiveServiceSecrets, LIVE_SERVICE_KEYS } = require('./lib/testDbGuardCore.cjs');

test('every live-service secret is blanked, so .env values can never load later', () => {
  const env = {};
  for (const k of LIVE_SERVICE_KEYS) env[k] = 'real-looking-value';
  assert.strictEqual(isolateLiveServiceSecrets(env), null);
  for (const k of LIVE_SERVICE_KEYS) assert.strictEqual(env[k], '', `${k} should be blank`);
  assert.strictEqual(env.NODE_ENV, 'test');
});

test('covers payment, email, carrier, AI and Supabase-admin keys', () => {
  for (const k of ['RAZORPAY_KEY_SECRET', 'RESEND_API_KEY', 'VOBIZ_AUTH_TOKEN', 'PLIVO_AUTH_TOKEN', 'GEMINI_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
    assert.ok(LIVE_SERVICE_KEYS.includes(k), `${k} missing from LIVE_SERVICE_KEYS`);
  }
});

test('explicit TEST_<NAME> sandbox value is used instead of the real one', () => {
  const env = { RAZORPAY_KEY_ID: 'rzp_live_real', TEST_RAZORPAY_KEY_ID: 'rzp_test_sandbox' };
  assert.strictEqual(isolateLiveServiceSecrets(env), null);
  assert.strictEqual(env.RAZORPAY_KEY_ID, 'rzp_test_sandbox');
});

test('a live Razorpay key passed as a test override is refused', () => {
  assert.match(isolateLiveServiceSecrets({ TEST_RAZORPAY_KEY_ID: 'rzp_live_abc123' }), /LIVE Razorpay key/);
});

test('NODE_ENV=production is refused', () => {
  assert.match(isolateLiveServiceSecrets({ NODE_ENV: 'production' }), /production/);
});

test('entry file blanks real secrets already present in the environment', () => {
  const r = spawnSync(
    process.execPath,
    ['-e', "require(process.argv[1]); console.log('KEYS=' + JSON.stringify([process.env.RAZORPAY_KEY_SECRET, process.env.RESEND_API_KEY, process.env.NODE_ENV]));", path.join(__dirname, 'lib', 'testDbGuard.cjs')],
    { env: { ...process.env, TEST_DATABASE_URL: LOCAL_TEST, NODE_ENV: '', RAZORPAY_KEY_SECRET: 'real', RESEND_API_KEY: 'real', TEST_RAZORPAY_KEY_SECRET: '', TEST_RESEND_API_KEY: '' }, encoding: 'utf8' }
  );
  if (r.status === 0) {
    assert.match(r.stdout, /KEYS=\["","","test"\]/);
  } else {
    assert.match(r.stderr, /BLOCKED/);
  }
});

console.log(`\nTEST DATABASE GUARD: ${passed === total ? 'PASS' : 'FAIL'} — ${passed}/${total} tests passed\n`);
process.exit(passed === total ? 0 : 1);
