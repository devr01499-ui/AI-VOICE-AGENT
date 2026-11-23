/**
 * Deploy step (runs after `npm run build`, on Render only): bring the database up to the schema,
 * ADDITIVE CHANGES ONLY.
 *
 * Why (owner report 2026-11-23, AUTH-TRACE ... user_lookup/42703): the Render build command is
 * `npm install; npm run build` and never touched the database, so five migrations
 * (users.plan_expires_at, phone_numbers.inbound_enabled, batches.scheduled_at, Plivo compliance,
 * WhatsApp + transfers) never reached production. Every request that read the user row failed
 * with "column does not exist", shown to customers as "We could not verify your session".
 *
 * What it does:
 *  1. asks Prisma for the SQL that would turn the live database into prisma/schema.prisma;
 *  2. keeps only additive parts: CREATE TABLE, CREATE [UNIQUE] INDEX, ALTER TABLE ... ADD
 *     COLUMN / ADD CONSTRAINT (clause by clause: Prisma merges clauses per table);
 *  3. NEVER drops, renames or retypes anything: those parts are skipped and listed in the log
 *     (e.g. the full-text index the baseline creates, which schema.prisma cannot describe);
 *  4. applies the additive SQL in ONE transaction with lock/statement timeouts (all or nothing),
 *     plus the one-time data step of a migration whose column it adds;
 *  5. checks again that nothing additive is left.
 *
 * Safety: does nothing unless it is a Render build (RENDER=true and no local .env file: a
 * developer's `npm run build` must never touch the production database in server/.env), or the
 * test mode (SCHEMA_SYNC_TEST=1 with TEST_DATABASE_URL). SCHEMA_SYNC=off disables it.
 * Exit 1 (the build fails, Render keeps the running version) only when additive SQL failed.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SERVER_DIR = path.join(__dirname, '..');
const log = (...a) => console.log('[schema-sync]', ...a);

/** One-time data steps that belong to a column's migration (run only when that column is added). */
const COMPANION_DATA = [
  {
    // 20261118100000_phone_number_inbound_enabled: "inactive" used to mean "inbound off".
    table: 'phone_numbers',
    column: 'inbound_enabled',
    sql: `UPDATE "phone_numbers" SET "status" = 'active', "inbound_enabled" = false WHERE "status" = 'inactive'`,
  },
];

/** Supabase: schema changes need a session connection. Transaction pooler 6543 -> session 5432. */
function migrationUrl(raw) {
  if (!raw) return '';
  try {
    const u = new URL(raw);
    if (u.hostname.endsWith('pooler.supabase.com') && u.port === '6543') {
      u.port = '5432';
      u.searchParams.delete('pgbouncer');
      return u.toString();
    }
  } catch { /* not a URL: use as is */ }
  return raw;
}

function stripComments(sql) {
  return sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n').trim();
}

function splitStatements(sql) {
  return stripComments(sql).split(/;\s*(?:\n|$)/).map((s) => s.trim()).filter(Boolean);
}

/** Splits a Prisma diff script into additive statements and skipped (non-additive) parts. */
function classify(sql) {
  const additive = [];
  const skipped = [];
  for (const stmt of splitStatements(sql)) {
    const oneLine = stmt.replace(/\s+/g, ' ');
    if (/^CREATE TABLE "[^"]+" \(/i.test(oneLine) || /^CREATE (UNIQUE )?INDEX "[^"]+" ON "[^"]+"/i.test(oneLine)) {
      additive.push(stmt);
      continue;
    }
    const alter = stmt.match(/^ALTER TABLE ("[^"]+")\s+([\s\S]+)$/i);
    if (alter) {
      // Clauses are separated by ",\n" in Prisma's output.
      const clauses = alter[2].split(/,\s*\n\s*(?=(?:ADD|DROP|ALTER|RENAME|SET|VALIDATE)\b)/i).map((c) => c.trim());
      const adds = clauses.filter((c) => /^ADD (COLUMN|CONSTRAINT)\b/i.test(c));
      const others = clauses.filter((c) => !/^ADD (COLUMN|CONSTRAINT)\b/i.test(c));
      if (adds.length) additive.push(`ALTER TABLE ${alter[1]} ${adds.join(',\n')}`);
      others.forEach((c) => skipped.push(`ALTER TABLE ${alter[1]} ${c}`));
      continue;
    }
    skipped.push(stmt);
  }
  return { additive, skipped };
}

function prismaDiff(url, schemaPath) {
  const cli = require.resolve('prisma/build/index.js', { paths: [SERVER_DIR] });
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return execFileSync(process.execPath, [cli, 'migrate', 'diff', '--from-config-datasource', '--to-schema', schemaPath, '--script'], {
        cwd: SERVER_DIR,
        env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
        encoding: 'utf8',
        timeout: 120000,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      lastErr = err;
      log(`diff attempt ${attempt} failed: ${String(err.stderr || err.message).split('\n').filter(Boolean).slice(-2).join(' | ')}`);
    }
  }
  throw lastErr;
}

async function applyAdditive(url, statements) {
  const pg = require('pg');
  const sslDisabled = /sslmode=disable/.test(url);
  const client = new pg.Client({
    connectionString: url.replace('sslmode=require', 'sslmode=no-verify'),
    ...(sslDisabled ? {} : { ssl: { rejectUnauthorized: false } }),
  });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '15s'");
    await client.query("SET LOCAL statement_timeout = '120s'");
    for (const stmt of statements) {
      log('apply:', stmt.replace(/\s+/g, ' ').slice(0, 200));
      await client.query(stmt);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end().catch(() => {});
  }
}

async function main() {
  const testMode = process.env.SCHEMA_SYNC_TEST === '1';
  const onRender = process.env.RENDER === 'true' && !fs.existsSync(path.join(SERVER_DIR, '.env'));
  if (process.env.SCHEMA_SYNC === 'off') { log('disabled (SCHEMA_SYNC=off)'); return 0; }
  if (!onRender && !testMode) { log('skipped: not a Render build'); return 0; }

  const rawUrl = testMode ? process.env.TEST_DATABASE_URL : (process.env.DIRECT_URL || process.env.DATABASE_URL);
  if (!rawUrl) {
    log('WARNING: no database URL in the build environment; the schema was NOT checked.');
    return 0;
  }
  const url = testMode ? rawUrl : migrationUrl(rawUrl);
  const schemaPath = (testMode && process.env.SCHEMA_SYNC_SCHEMA) || path.join(SERVER_DIR, 'prisma', 'schema.prisma');

  const { additive, skipped } = classify(prismaDiff(url, schemaPath));
  skipped.forEach((s) => log('kept as is (not additive, never auto-applied):', s.replace(/\s+/g, ' ').slice(0, 200)));
  if (additive.length === 0) {
    log('database schema is up to date (nothing additive to apply)');
    return 0;
  }

  const companions = COMPANION_DATA
    .filter((c) => additive.some((s) => new RegExp(`^ALTER TABLE "${c.table}"[\\s\\S]*ADD COLUMN\\s+"${c.column}"`, 'i').test(s)))
    .map((c) => c.sql);
  await applyAdditive(url, [...additive, ...companions]);
  log(`applied ${additive.length} additive statement(s)${companions.length ? ` + ${companions.length} data step(s)` : ''}`);

  const after = classify(prismaDiff(url, schemaPath));
  if (after.additive.length) {
    log('ERROR: additive changes still missing after apply:', after.additive.join(' ; ').slice(0, 500));
    return 1;
  }
  log('database schema is up to date');
  return 0;
}

module.exports = { classify, migrationUrl };

if (require.main === module) {
  main().then((code) => process.exit(code)).catch((err) => {
    log('ERROR: schema sync failed (additive SQL runs as one transaction: a failed apply changes nothing). The build stops, so Render keeps the running version.');
    log(String(err && err.message ? err.message : err).split('\n').filter(Boolean).slice(-3).join(' | '));
    process.exit(1);
  });
}
