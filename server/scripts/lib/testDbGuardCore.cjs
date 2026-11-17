'use strict';
/**
 * Test-database guard — implementation. Scripts load ./testDbGuard.cjs, which runs it.
 *
 * Load this FIRST in every test script and every script that reads or writes
 * the database:
 *
 *   require('./lib/testDbGuard.cjs');      // CommonJS
 *   import './lib/testDbGuard.cjs';        // ESM / TypeScript
 *
 * What it does, before any other module can open a connection:
 *   1. Requires TEST_DATABASE_URL. There is NO fallback to DATABASE_URL.
 *   2. Refuses to start if TEST_DATABASE_URL points at the database configured
 *      in server/.env or the repo-root .env (the production database): same
 *      host, same Supabase project ref, or same host+port+database name.
 *   3. Refuses any non-local host unless TEST_DATABASE_ALLOW_REMOTE=1 is set.
 *   4. Blanks live-service secrets (see LIVE_SERVICE_KEYS) unless TEST_<NAME> is set.
 *   5. Overwrites process.env.DATABASE_URL and DIRECT_URL with the test URL so
 *      Prisma, pg and later dotenv loads (which never override) use it.
 *
 * It never prints a connection string, password or the production host.
 */

const fs = require('fs');
const path = require('path');

const ENV_FILES = [
  path.resolve(__dirname, '../../.env'), // server/.env
  path.resolve(__dirname, '../../../.env'), // repo-root .env
];
const PROTECTED_KEYS = ['DATABASE_URL', 'DIRECT_URL'];
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function readProtectedUrls() {
  const urls = [];
  for (const file of ENV_FILES) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue; // file absent (e.g. CI) — nothing to protect from this file
    }
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m || !PROTECTED_KEYS.includes(m[1])) continue;
      let value = m[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (value) urls.push(value);
    }
  }
  return urls;
}

/** Extracts comparable, non-secret parts of a Postgres URL. Returns null if unparsable. */
function describeDbUrl(raw) {
  if (typeof raw !== 'string' || !/^postgres(ql)?:\/\//i.test(raw.trim())) return null;
  let host = '';
  let port = '';
  let user = '';
  let database = '';
  try {
    const u = new URL(raw.trim());
    host = u.hostname;
    port = u.port;
    user = decodeURIComponent(u.username || '');
    database = decodeURIComponent((u.pathname || '').replace(/^\//, ''));
  } catch {
    // Passwords with unescaped characters can break URL parsing; fall back to a regex.
    const m = raw.trim().match(/^postgres(?:ql)?:\/\/(?:([^:@/]*)(?::.*)?@)?(\[[^\]]+\]|[^:/?#]+)(?::(\d+))?(?:\/([^?#]*))?/i);
    if (!m) return null;
    user = m[1] || '';
    host = m[2] || '';
    port = m[3] || '';
    database = m[4] || '';
  }
  host = host.toLowerCase();
  if (!host) return null;
  const refFromHost = host.match(/^db\.([a-z0-9]+)\.supabase\.(?:co|com)$/);
  const refFromUser = user.toLowerCase().match(/^postgres\.([a-z0-9]+)$/);
  return {
    host,
    port: port || '5432',
    database: database.toLowerCase(),
    projectRef: (refFromHost && refFromHost[1]) || (refFromUser && refFromUser[1]) || '',
    isLocal: LOOPBACK.has(host),
  };
}

/** Returns a reason string if `test` must be refused, otherwise null. */
function findViolation(testUrl, protectedUrls, allowRemote) {
  if (!testUrl || !String(testUrl).trim()) {
    return 'TEST_DATABASE_URL is not set. Tests and DB scripts never fall back to DATABASE_URL.';
  }
  const test = describeDbUrl(testUrl);
  if (!test) {
    return 'TEST_DATABASE_URL is not a valid postgres:// connection string.';
  }
  for (const raw of protectedUrls) {
    const prod = describeDbUrl(raw);
    if (!prod) {
      // Fail closed: we cannot prove the test DB differs from an unreadable production URL.
      if (!test.isLocal) {
        return 'A DATABASE_URL in .env could not be parsed, so a remote TEST_DATABASE_URL cannot be proven safe.';
      }
      continue;
    }
    const sameProject = Boolean(test.projectRef) && test.projectRef === prod.projectRef;
    const sameRemoteHost = test.host === prod.host && !test.isLocal;
    const sameDatabase = test.host === prod.host && test.port === prod.port && test.database === prod.database;
    if (sameProject || sameRemoteHost || sameDatabase) {
      return 'TEST_DATABASE_URL points at the database configured in .env (production). Refusing to run.';
    }
  }
  if (!test.isLocal && !allowRemote) {
    return 'TEST_DATABASE_URL is not a local database. Set TEST_DATABASE_ALLOW_REMOTE=1 only for a dedicated, disposable test database.';
  }
  return null;
}

/**
 * Live-service isolation. Guarded scripts must never reach real payment, email,
 * carrier, AI or Supabase-admin services with the keys from server/.env.
 * Each key below is blanked before dotenv can load it (dotenv never overrides a
 * key that already exists), so application code falls back to its mock mode.
 * To use a sandbox/test credential on purpose, set TEST_<NAME> (for example
 * TEST_RAZORPAY_KEY_ID=rzp_test_...). Live Razorpay keys are always refused.
 */
const LIVE_SERVICE_KEYS = [
  'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'VOBIZ_AUTH_ID', 'VOBIZ_AUTH_TOKEN', 'VOBIZ_WEBHOOK_SECRET',
  'PLIVO_AUTH_ID', 'PLIVO_AUTH_TOKEN', 'TELEPHONY_AUTH_TOKEN',
  'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENAI_API_KEY', 'OPENAI_API_KEY',
  'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY',
  'GOOGLE_CLIENT_SECRET', 'NGROK_AUTH_TOKEN',
];

/** Keys that must have a value: tests get these test-only values instead of production's. */
const TEST_ONLY_KEYS = {
  ENCRYPTION_KEY: 'test-only-encryption-key-never-used-in-production',
  SIP_ENCRYPTION_KEY: 'test-only-sip-encryption-key-never-used-in-production',
};

/** Returns a reason string if the environment must be refused, otherwise null. Mutates `env`. */
function isolateLiveServiceSecrets(env) {
  if (env.NODE_ENV === 'production') {
    return 'NODE_ENV is "production". Tests and DB scripts never run in production mode.';
  }
  for (const key of LIVE_SERVICE_KEYS) {
    const override = env['TEST_' + key];
    if (override && /^rzp_live_/i.test(override)) {
      return 'TEST_' + key + ' is a LIVE Razorpay key. Only rzp_test_ keys are allowed in tests.';
    }
    env[key] = override || '';
  }
  // Encryption keys cannot be blank (startup validation requires them), so tests get fixed
  // test-only keys instead of the production keys from server/.env.
  for (const [key, testValue] of Object.entries(TEST_ONLY_KEYS)) {
    env[key] = env['TEST_' + key] || testValue;
  }
  // Pin the mode so a later dotenv load cannot switch the process to production.
  if (!env.NODE_ENV) env.NODE_ENV = 'test';
  return null;
}

function assertTestDatabase() {
  const testUrl = process.env.TEST_DATABASE_URL;
  const violation = findViolation(testUrl, readProtectedUrls(), process.env.TEST_DATABASE_ALLOW_REMOTE === '1');
  if (violation) {
    console.error('\n[test-db-guard] BLOCKED: ' + violation);
    console.error('[test-db-guard] Start a throwaway local Postgres and set TEST_DATABASE_URL (see docs/RUNBOOK.md).\n');
    process.exit(1);
  }
  const secretsViolation = isolateLiveServiceSecrets(process.env);
  if (secretsViolation) {
    console.error('\n[test-db-guard] BLOCKED: ' + secretsViolation + '\n');
    process.exit(1);
  }
  process.env.DATABASE_URL = testUrl;
  process.env.DIRECT_URL = testUrl;
  const d = describeDbUrl(testUrl);
  if (!process.env.TEST_DB_GUARD_QUIET) {
    console.log(`[test-db-guard] Using test database ${d.host}:${d.port}/${d.database}`);
  }
}

module.exports = { assertTestDatabase, findViolation, describeDbUrl, isolateLiveServiceSecrets, LIVE_SERVICE_KEYS, TEST_ONLY_KEYS };
