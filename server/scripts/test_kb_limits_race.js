require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Phase 5 (B8): plan limits under REAL concurrency (a normal Postgres with a 10-connection pool,
 * so parallel requests really overlap). Many parallel uploads / attaches must never get past the
 * plan's last free slot.
 *
 * Production KnowledgeBaseController against the local TEST database. Needs a real Postgres
 * (the in-memory PGlite serialises connections, so it cannot prove this).
 * Run: npm run test:kb-race
 */
const assert = require('assert');
const crypto = require('crypto');
const { prisma } = require('../dist/lib/prisma');
const { KnowledgeBaseController } = require('../dist/controllers/KnowledgeBaseController');
const { KnowledgeBaseService } = require('../dist/services/KnowledgeBaseService');

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

function call(method, userId, { body = {}, params = {} } = {}) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      setHeader() {},
      status(code) { this.statusCode = code; return this; },
      json(payload) { resolve({ status: this.statusCode, body: payload }); return this; },
    };
    Promise.resolve(KnowledgeBaseController[method]({ userId, body, params, headers: {} }, res, (err) => reject(err || new Error('next() called')))).catch(reject);
  });
}
const b64 = (t) => Buffer.from(t, 'utf8').toString('base64');

async function makeUser(accountType) {
  const id = crypto.randomUUID();
  await prisma.user.create({ data: { id, email: `${id}@example.org`, fullName: 'KB Race', passwordHash: 'x', accountType } });
  return id;
}

async function main() {
  console.log('\n--- KB LIMITS UNDER CONCURRENCY ---');
  // Indexing is not under test here (this database may not have the vector type).
  KnowledgeBaseService.enqueueIngestion = async () => {};

  await test('8 parallel uploads on a 2-document plan create exactly 2 documents (5 rounds)', async () => {
    for (let round = 0; round < 5; round++) {
      const u = await makeUser('trial');
      const results = await Promise.all(Array.from({ length: 8 }, (_, i) =>
        call('upload', u, { body: { name: `r${round}-${i}.txt`, fileBase64: b64(`Round ${round} document ${i} with some text.`) } })));
      const created = await prisma.knowledgeBase.count({ where: { userId: u } });
      assert.strictEqual(created, 2, `round ${round}: ${created} documents created; statuses ${results.map((r) => r.status)}`);
      assert.strictEqual(results.filter((r) => r.status === 202).length, 2);
      assert.ok(results.filter((r) => r.status !== 202).every((r) => r.body.code === 'KB_DOCUMENT_LIMIT'));
    }
  });

  await test('parallel attaches never exceed the documents-per-agent limit', async () => {
    const u = await makeUser('starter'); // 3 per agent, 10 documents
    const agent = await prisma.agent.create({ data: { userId: u, name: 'Race agent' } });
    const docs = [];
    for (let i = 0; i < 8; i++) {
      docs.push(await prisma.knowledgeBase.create({ data: { userId: u, name: `d${i}.txt`, contentText: 'x', sizeChars: 1, status: 'ready' } }));
    }
    const results = await Promise.all(docs.map((d) => call('assignToAgent', u, { params: { id: d.id }, body: { agentId: agent.id } })));
    const attached = await prisma.agentKnowledgeBase.count({ where: { agentId: agent.id } });
    assert.strictEqual(attached, 3, `${attached} attached; statuses ${results.map((r) => r.status)}`);
  });

  console.log(`\nKB RACE: ${passed === total ? 'PASS' : 'FAIL'} — ${passed}/${total} tests passed\n`);
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error in KB race tests:', err);
  process.exit(1);
});
