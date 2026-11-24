require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Request validation cannot be used to exhaust server memory (zod advisory GHSA-mrhx-c7xc-m3w5,
 * SECURITY_AUDIT A1), and the zod 4 upgrade kept the old behaviour for real requests.
 *  - zod is 4.6.6 or newer (the release that stops at a collection's size limit)
 *  - a body with hundreds of thousands of bad items is refused with ONE issue, fast: Prompt Coach
 *    businessFacts (key cap before value checks) and agent tags (max 50)
 *  - every z.array() in src/routes has a .max(): an unbounded array still makes one issue per bad
 *    item in zod 4 (about 640 MB for a 10 MB body)
 *  - IDs keep zod 3's format check (any 8-4-4-4-12 hex), the contact form still names a bad email
 * Production schemas and routers (scripts/lib/demoApp.cjs), local TEST database.
 * Run: npm run test:validation-limits   (part of npm run test:security)
 */
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { prisma } = require('../dist/lib/prisma');
const { buildApp, installAuthStub } = require('./lib/demoApp.cjs');
const { PromptCoachGenerateRequestSchema, MAX_BUSINESS_FACTS } = require('../dist/types/promptCoach');
const { agentBodySchema } = require('../dist/routes/agents');

let total = 0;
let passed = 0;
async function test(name, fn) {
  total++;
  try { await fn(); passed++; console.log(`  ✓ ${name}`); } catch (e) { console.error(`  ✗ ${name}\n      ${e.message}`); }
}
const timed = (fn) => { const t = Date.now(); const r = fn(); return { r, ms: Date.now() - t }; };

(async () => {
  console.log('\n--- VALIDATION LIMITS (zod memory DoS) ---');

  await test('zod is 4.6.6 or newer (stops at a collection size limit)', () => {
    const v = require('zod/package.json').version.split('.').map(Number);
    assert.ok(v[0] > 4 || (v[0] === 4 && (v[1] > 6 || (v[1] === 6 && v[2] >= 6))), `zod ${v.join('.')}`);
  });

  await test('Prompt Coach: 300,000 non-string business facts are refused with one issue, fast', () => {
    const facts = {};
    for (let i = 0; i < 300000; i++) facts['k' + i] = i;
    const { r, ms } = timed(() => PromptCoachGenerateRequestSchema.safeParse({ playbookId: 'saas', businessFacts: facts }));
    assert.strictEqual(r.success, false);
    assert.ok(r.error.issues.length <= 2, `issues: ${r.error.issues.length}`);
    assert.ok(ms < 1500, `took ${ms} ms`);
  });

  await test(`Prompt Coach: real facts pass; ${MAX_BUSINESS_FACTS + 1} keys, arrays and non-strings are refused`, () => {
    const ok = PromptCoachGenerateRequestSchema.safeParse({ playbookId: 'saas', businessFacts: { companyName: 'Acme', productOrService: 'CRM', agentName: 'Riya' } });
    assert.strictEqual(ok.success, true);
    assert.deepStrictEqual(ok.data.businessFacts, { companyName: 'Acme', productOrService: 'CRM', agentName: 'Riya' });
    const many = {};
    for (let i = 0; i <= MAX_BUSINESS_FACTS; i++) many['k' + i] = 'v';
    assert.strictEqual(PromptCoachGenerateRequestSchema.safeParse({ playbookId: 'saas', businessFacts: many }).success, false);
    assert.strictEqual(PromptCoachGenerateRequestSchema.safeParse({ playbookId: 'saas', businessFacts: ['a'] }).success, false);
    assert.strictEqual(PromptCoachGenerateRequestSchema.safeParse({ playbookId: 'saas', businessFacts: { companyName: 5 } }).success, false);
  });

  await test('Agent tags: a 2,000,000-item array is refused with one issue, fast', () => {
    const { r, ms } = timed(() => agentBodySchema.safeParse({ tags: new Array(2000000).fill(0) }));
    assert.strictEqual(r.success, false);
    assert.ok(r.error.issues.length <= 2, `issues: ${r.error.issues.length}`);
    assert.ok(ms < 1500, `took ${ms} ms`);
  });

  await test('every z.array() in src/routes has a .max() size limit', () => {
    const dir = path.join(__dirname, '../src/routes');
    const bad = [];
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.ts'))) {
      fs.readFileSync(path.join(dir, f), 'utf8').split('\n').forEach((line, i) => {
        if (/z\.array\(/.test(line) && !/z\.array\([^\n]*\)\s*\.max\(/.test(line)) bad.push(`${f}:${i + 1}`);
      });
    }
    assert.deepStrictEqual(bad, [], 'arrays without .max(): ' + bad.join(', '));
  });

  // HTTP through the production routers.
  const userId = crypto.randomUUID();
  await prisma.user.create({ data: { id: userId, email: `limits-${userId.slice(0, 8)}@claritiy-test.co.in`, fullName: 'Limits Test', passwordHash: 'x', accountType: 'professional', callingBalanceMinutes: 0 } });
  installAuthStub(async (token) => (token === 'limits-token' ? { id: userId, email: `limits@claritiy-test.co.in` } : null));
  const server = http.createServer(buildApp());
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const auth = { authorization: 'Bearer limits-token', 'content-type': 'application/json' };

  try {
    await test('IDs keep the zod 3 format check: a non-RFC hex ID is "not found", not a validation error', async () => {
      const res = await fetch(`${base}/api/v2/agents/11111111-1111-1111-1111-111111111111`, { headers: auth });
      assert.strictEqual(res.status, 404, `status ${res.status}: ${(await res.text()).slice(0, 160)}`);
      const bad = await fetch(`${base}/api/v2/agents/not-a-uuid`, { headers: auth });
      assert.strictEqual(bad.status, 400);
    });

    await test('POST /agents/prompt-coach/generate with 300,000 bad facts answers 400 quickly', async () => {
      const facts = {};
      for (let i = 0; i < 300000; i++) facts['k' + i] = i;
      const t = Date.now();
      const res = await fetch(`${base}/api/v2/agents/prompt-coach/generate`, { method: 'POST', headers: auth, body: JSON.stringify({ playbookId: 'saas', businessFacts: facts }) });
      const body = await res.json();
      assert.strictEqual(res.status, 400, JSON.stringify(body).slice(0, 160));
      assert.match(body.error, /at most 50 fields/);
      assert.ok(Date.now() - t < 3000, `took ${Date.now() - t} ms`);
    });

    await test('contact form still names a bad email (ZodError.issues)', async () => {
      const res = await fetch(`${base}/api/v2/contact`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'A', email: 'not-an-email', message: 'hello there' }) });
      const body = await res.json();
      assert.strictEqual(res.status, 400, JSON.stringify(body).slice(0, 160));
      assert.strictEqual(body.error, 'Invalid email address');
    });
  } finally {
    server.close();
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  }

  console.log(`\nVALIDATION LIMITS: ${passed}/${total} ${passed === total ? 'PASS' : 'FAIL'}`);
  await prisma.$disconnect();
  process.exit(passed === total ? 0 : 1);
})().catch(async (e) => { console.error(e); await prisma.$disconnect().catch(() => {}); process.exit(1); });
