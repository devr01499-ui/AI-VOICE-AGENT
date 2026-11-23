require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Deploy schema sync (owner report 2026-11-23: AUTH-TRACE ... user_lookup/42703 — production was
 * missing five migrations because the Render build never touched the database).
 *
 * Builds a throw-away database from the BASELINE only (= production's state: the five later
 * migrations missing), then runs the real scripts/deploy_schema_sync.js against it.
 * Needs a real Postgres that can CREATE DATABASE (native test DB; PGlite has one database only).
 */
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const pg = require('pg');
const { classify, migrationUrl } = require('./deploy_schema_sync');

let passed = 0;
let total = 0;
async function test(name, fn) {
  total++;
  try { await fn(); passed++; console.log(`  ✓ ${name}`); } catch (err) { console.error(`  ✗ FAIL: ${name}\n    ${err.stack || err.message}`); }
}

const SERVER = path.join(__dirname, '..');

function runSync(env) {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'deploy_schema_sync.js')], {
    cwd: SERVER,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: 300000,
  });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

async function main() {
  console.log('\n--- deploy schema sync ---');

  await test('classify: a merged ALTER TABLE keeps only its ADD clauses; drops are never applied', async () => {
    const sql = [
      '-- DropIndex',
      'DROP INDEX "kb_chunks_content_fts_idx";',
      '',
      '-- AlterTable',
      'ALTER TABLE "users" DROP COLUMN "legacy",',
      'ADD COLUMN     "plan_expires_at" TIMESTAMP(3);',
      '',
      '-- AlterTable',
      'ALTER TABLE "batches" ALTER COLUMN "name" SET DATA TYPE VARCHAR(10);',
      '',
      '-- CreateTable',
      'CREATE TABLE "t" (',
      '    "id" TEXT NOT NULL,',
      '    CONSTRAINT "t_pkey" PRIMARY KEY ("id")',
      ');',
      '',
      '-- CreateIndex',
      'CREATE UNIQUE INDEX "t_id_key" ON "t"("id");',
      '',
      '-- AddForeignKey',
      'ALTER TABLE "t" ADD CONSTRAINT "t_fk" FOREIGN KEY ("id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;',
      '',
      '-- DropTable',
      'DROP TABLE "old_table";',
    ].join('\n');
    const { additive, skipped } = classify(sql);
    assert.strictEqual(additive.length, 4, additive.join('\n---\n'));
    assert.ok(additive.some((s) => /ALTER TABLE "users" ADD COLUMN\s+"plan_expires_at"/.test(s)));
    assert.ok(additive.every((s) => !/\bDROP\b|ALTER COLUMN/.test(s.replace(/ON (DELETE|UPDATE) CASCADE/g, ''))));
    assert.strictEqual(skipped.length, 4, skipped.join('\n---\n'));
    assert.ok(skipped.some((s) => /DROP INDEX "kb_chunks_content_fts_idx"/.test(s)));
    assert.ok(skipped.some((s) => /DROP COLUMN "legacy"/.test(s)));
    assert.ok(skipped.some((s) => /DROP TABLE "old_table"/.test(s)));
  });

  await test('Supabase transaction pooler (6543) is switched to session mode (5432) for schema changes', async () => {
    assert.strictEqual(
      migrationUrl('postgresql://u:p@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true'),
      'postgresql://u:p@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
    );
    assert.strictEqual(migrationUrl('postgresql://u:p@127.0.0.1:54329/db'), 'postgresql://u:p@127.0.0.1:54329/db');
  });

  await test('never runs on a developer machine: no Render flag -> skipped; RENDER=true but a local .env -> skipped', async () => {
    const a = runSync({ RENDER: '', SCHEMA_SYNC_TEST: '' });
    assert.strictEqual(a.code, 0);
    assert.match(a.out, /skipped: not a Render build/);
    if (fs.existsSync(path.join(SERVER, '.env'))) {
      const b = runSync({ RENDER: 'true', SCHEMA_SYNC_TEST: '' });
      assert.strictEqual(b.code, 0);
      assert.match(b.out, /skipped: not a Render build/);
    }
  });

  // ── Integration: a database in production's state ──
  const base = new URL(process.env.TEST_DATABASE_URL);
  const dbName = `schema_sync_${crypto.randomBytes(4).toString('hex')}`;
  const admin = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  admin.on('error', () => {});
  await admin.connect();
  // PGlite serves one database and drops the socket on CREATE DATABASE: detect it, never try.
  const version = (await admin.query('SELECT version() AS v')).rows[0].v;
  if (/PGlite|emscripten/i.test(version)) {
    console.log('  (integration part skipped on PGlite: it needs a Postgres that can CREATE DATABASE; run test:schema-sync on the native test DB / CI)');
    await admin.end();
    return finish();
  }
  try {
    await admin.query(`CREATE DATABASE "${dbName}" WITH ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C'`);
  } catch (err) {
    console.log(`  (integration skipped: this test database cannot CREATE DATABASE: ${err.message})`);
    await admin.end();
    return finish();
  }
  const url = new URL(base.toString());
  url.pathname = `/${dbName}`;
  if (!url.searchParams.get('sslmode')) url.searchParams.set('sslmode', 'disable');
  const driftUrl = url.toString();
  const db = new pg.Client({ connectionString: driftUrl });
  await db.connect();

  // Plain Postgres: no pgvector, no Supabase auth schema (as in CI).
  const schemaCopy = path.join(os.tmpdir(), `schema_sync_${dbName}.prisma`);
  fs.writeFileSync(schemaCopy, fs.readFileSync(path.join(SERVER, 'prisma', 'schema.prisma'), 'utf8').replace('Unsupported("vector(3072)")', 'Unsupported("text")'));
  const env = { SCHEMA_SYNC_TEST: '1', TEST_DATABASE_URL: driftUrl, SCHEMA_SYNC_SCHEMA: schemaCopy, RENDER: '' };
  const has = async (table, column) => (await db.query(
    'SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2', [table, column])).rowCount === 1;
  const hasTable = async (table) => (await db.query('SELECT to_regclass($1) AS t', [`"${table}"`])).rows[0].t !== null;
  const hasIndex = async (name) => (await db.query('SELECT 1 FROM pg_indexes WHERE indexname = $1', [name])).rowCount === 1;

  try {
    await db.query("CREATE SCHEMA IF NOT EXISTS auth; CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT NULL::uuid'");
    const baseline = fs.readFileSync(path.join(SERVER, 'prisma', 'migrations', '20261118000000_baseline', 'migration.sql'), 'utf8')
      .replace(/^CREATE EXTENSION IF NOT EXISTS vector;$/m, '')
      .replace(/vector\(3072\)/g, 'text');
    await db.query(baseline);

    await test('production state reproduced: users.plan_expires_at missing (the 42703)', async () => {
      assert.strictEqual(await has('users', 'plan_expires_at'), false);
      await assert.rejects(db.query('SELECT plan_expires_at FROM users'), (e) => e.code === '42703');
    });

    // A phone number turned "inactive" by the old code: the inbound_enabled migration converts it.
    await db.query(`INSERT INTO users (id, email, full_name, password_hash, updated_at) VALUES ('u-sync', 'sync@claritiy-test.co.in', 'Sync', 'x', now())`);
    const phoneCols = (await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'phone_numbers' AND is_nullable = 'NO' AND column_default IS NULL`)).rows.map((r) => r.column_name);
    const values = { id: 'pn-sync', user_id: 'u-sync', number: '+911234567890', phone_number: '+911234567890', status: 'inactive', country_code: 'IN', telephony_provider: 'vobiz', updated_at: new Date() };
    const insertCols = phoneCols.filter((c) => c in values);
    let phoneSeeded = insertCols.length === phoneCols.length;
    if (phoneSeeded) {
      if (!insertCols.includes('status')) insertCols.push('status');
      await db.query(`INSERT INTO phone_numbers (${insertCols.map((c) => `"${c}"`).join(',')}) VALUES (${insertCols.map((_, i) => `$${i + 1}`).join(',')})`, insertCols.map((c) => values[c]));
    } else {
      console.log(`  (phone row not seeded: phone_numbers needs ${phoneCols.join(', ')})`);
    }

    // An extra column production may carry: the sync must keep it.
    await db.query('ALTER TABLE users ADD COLUMN legacy_note TEXT');

    // Production (Render build of 80e3140): calendar_bookings had no foreign key to agents and
    // held a booking of an agent that no longer exists; adding the key failed the whole deploy.
    await db.query('ALTER TABLE calendar_bookings DROP CONSTRAINT calendar_bookings_agent_id_fkey');
    await db.query(`INSERT INTO calendar_bookings (id, workspace_id, agent_id, start_utc, end_utc, idempotency_key, updated_at)
      VALUES ('bk-orphan', 'u-sync', 'agent-that-was-deleted', now(), now() + interval '30 minutes', 'idem-orphan', now())`);

    await test('sync adds every missing column and table, in one go', async () => {
      const r = runSync(env);
      assert.strictEqual(r.code, 0, r.out);
      assert.match(r.out, /applied \d+ additive statement/);
      for (const [t, c] of [['users', 'plan_expires_at'], ['phone_numbers', 'inbound_enabled'], ['batches', 'scheduled_at']]) {
        assert.ok(await has(t, c), `${t}.${c}`);
      }
      for (const t of ['plivo_compliance_applications', 'whatsapp_accounts', 'whatsapp_messages', 'whatsapp_consents', 'call_transfers']) {
        assert.ok(await hasTable(t), t);
      }
      await db.query('SELECT plan_expires_at FROM users'); // the failing query now works
    });

    await test('a missing foreign key with old orphan rows no longer fails the deploy (production 80e3140)', async () => {
      const con = (await db.query(`SELECT convalidated FROM pg_constraint WHERE conname = 'calendar_bookings_agent_id_fkey'`)).rows[0];
      assert.ok(con, 'the foreign key was added');
      assert.strictEqual(con.convalidated, false, 'NOT VALID: old rows not checked');
      assert.strictEqual((await db.query(`SELECT 1 FROM calendar_bookings WHERE id = 'bk-orphan'`)).rowCount, 1, 'old row untouched');
      await assert.rejects(
        db.query(`INSERT INTO calendar_bookings (id, workspace_id, agent_id, start_utc, end_utc, idempotency_key, updated_at)
          VALUES ('bk-new', 'u-sync', 'no-such-agent', now(), now(), 'idem-new', now())`),
        (e) => e.code === '23503',
        'enforced for new rows',
      );
    });

    await test('nothing is ever dropped: the full-text index and an extra column survive', async () => {
      assert.ok(await hasIndex('kb_chunks_content_fts_idx'));
      assert.ok(await has('users', 'legacy_note'));
    });

    if (phoneSeeded) {
      await test('the inbound migration\'s one-time data step ran with its column', async () => {
        const row = (await db.query(`SELECT status, inbound_enabled FROM phone_numbers WHERE id = 'pn-sync'`)).rows[0];
        assert.deepStrictEqual(row, { status: 'active', inbound_enabled: false });
      });
    }

    await test('a second deploy changes nothing', async () => {
      const r = runSync(env);
      assert.strictEqual(r.code, 0, r.out);
      assert.match(r.out, /up to date \(nothing additive to apply\)/);
      assert.doesNotMatch(r.out, /apply:/);
    });

    await test('a failing statement rolls everything back and fails the build (exit 1)', async () => {
      await db.query('ALTER TABLE batches DROP COLUMN scheduled_at');
      await db.query('DROP TABLE plivo_compliance_applications');
      // Index names are global: this one blocks re-creating the Plivo table's index.
      await db.query('CREATE INDEX "plivo_compliance_applications_status_idx" ON users (email)');
      const r = runSync(env);
      assert.strictEqual(r.code, 1, r.out);
      assert.strictEqual(await has('batches', 'scheduled_at'), false, 'all or nothing: no partial apply');
      assert.strictEqual(await hasTable('plivo_compliance_applications'), false);
    });
  } finally {
    await db.end().catch(() => {});
    await admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`).catch((e) => console.log('cleanup:', e.message));
    await admin.end().catch(() => {});
    fs.rmSync(schemaCopy, { force: true });
  }
  return finish();
}

function finish() {
  console.log(`\nDeploy schema sync: ${passed}/${total} passed`);
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
