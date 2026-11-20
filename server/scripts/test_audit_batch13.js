require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Audit batch 13 (server side of the remaining low findings) — production code, TEST database.
 *  #75/#103 the contacts list pages with a real total and searches names regardless of case
 *  #109 the Reports "Unclear" filter includes rows without a label
 *  #143 the agent temperature field validates real numbers (the regex had lost its backslashes)
 *        and live calls use one named, fixed temperature
 * The browser side (#75 #103 #104 #105 #106 #108 #110 #140) is e2e/audit-batch13.spec.ts.
 * Run: npm run test:audit-batch13   (part of npm run test:security)
 */
const assert = require('assert');
const crypto = require('crypto');
const { prisma } = require('../dist/lib/prisma');

let total = 0;
let passed = 0;
async function test(name, fn) {
  total++;
  try { await fn(); passed++; console.log(`  ✓ ${name}`); } catch (err) { console.error(`  ✗ FAIL: ${name}\n    ${err.stack || err.message}`); }
}
function handlerOf(router, method, path) {
  const layer = router.stack.find((l) => l.route && l.route.path === path && l.route.methods[method]);
  if (!layer) throw new Error(`route ${method.toUpperCase()} ${path} not found`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}
function call(fn, { workspaceId, query = {} }) {
  return new Promise((resolve) => {
    const res = { statusCode: 200 };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; resolve(res); return res; };
    Promise.resolve(fn({ effectiveWorkspaceId: workspaceId, userId: workspaceId, params: {}, query, body: {}, headers: {} }, res, (e) => resolve({ statusCode: 'next', body: String(e) })))
      .catch((e) => resolve({ statusCode: 'threw', body: String(e) }));
  });
}
const users = [];
async function newUser() {
  const id = crypto.randomUUID();
  users.push(id);
  await prisma.user.create({ data: { id, email: `b13-${id.slice(0, 8)}@claritiy-test.co.in`, fullName: 'Batch Thirteen', passwordHash: 'x', accountType: 'professional' } });
  return id;
}

async function main() {
  console.log('\n--- AUDIT BATCH 13 ---');

  await test('#75/#103 contacts: real total, next pages, and case-insensitive name search', async () => {
    const { ContactsController } = require('../dist/controllers/ContactsController');
    const ws = await newUser();
    await prisma.contact.createMany({ data: Array.from({ length: 120 }, (_, i) => ({ userId: ws, phoneNumber: `+91981000${String(i).padStart(4, '0')}`, name: i === 117 ? 'Asha Verma' : `Customer ${i}` })) });
    const p1 = await call(ContactsController.listContacts, { workspaceId: ws, query: { page: '1', limit: '100' } });
    assert.strictEqual(p1.body.data.length, 100);
    assert.strictEqual(p1.body.pagination.total, 120);
    const p2 = await call(ContactsController.listContacts, { workspaceId: ws, query: { page: '2', limit: '100' } });
    assert.strictEqual(p2.body.data.length, 20, 'the rest are reachable');
    const found = await call(ContactsController.listContacts, { workspaceId: ws, query: { search: 'asha' } });
    assert.strictEqual(found.body.data.length, 1, 'found regardless of case, on the server');
    assert.strictEqual(found.body.data[0].name, 'Asha Verma');
  });

  await test('#109 the "Unclear" filter includes rows without a label', async () => {
    const reportsRouter = require('../dist/routes/reports').default;
    const list = handlerOf(reportsRouter, 'get', '/');
    const ws = await newUser();
    const agent = await prisma.agent.create({ data: { userId: ws, name: 'U', systemPrompt: 'x' } });
    for (const label of ['Unclear', '', 'Interested']) {
      const c = await prisma.call.create({ data: { userId: ws, agentId: agent.id, recipientPhoneNumber: '+919822200000', status: 'completed' } });
      await prisma.callResult.create({ data: { callId: c.id, workspaceId: ws, resultLabel: label, confidence: 0.5, status: 'completed' } });
    }
    const r = await call(list, { workspaceId: ws, query: { label: 'Unclear' } });
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body).slice(0, 200));
    assert.strictEqual(r.body.data.items.length, 2, 'labelled "Unclear" and unlabelled (shown as Unclear)');
    assert.ok(r.body.data.items.every((i) => i.label === 'Unclear'));
  });

  await test('#143 temperature: "0.7" is accepted as 0.7, junk is refused; live calls use one named value', async () => {
    const { agentBodySchema } = require('../dist/routes/agents');
    const temp = (v) => agentBodySchema.safeParse({ name: 'T', temperature: v });
    assert.strictEqual(temp('0.7').success, true, 'a numeric string is valid');
    assert.strictEqual(temp('0.7').data.temperature, 0.7, 'stored as a number');
    assert.strictEqual(temp('dd').success, false, 'the broken regex accepted "dd"');
    assert.strictEqual(temp('5').success, false, 'out of range');
    assert.strictEqual(temp(1.2).success, true);
    const { LIVE_CALL_TEMPERATURE } = require('../dist/providers/gemini/GeminiLiveProvider');
    assert.strictEqual(LIVE_CALL_TEMPERATURE, 0.5);
  });

  await test('#106 #140 no hard-coded carrier rental for an included number; no celebrity likeness in the app', async () => {
    const fs = require('fs');
    const path = require('path');
    const fe = path.join(__dirname, '../../Frontend');
    const numbers = fs.readFileSync(path.join(fe, 'src/app/components/numbers/NumberSearchAndPurchase.tsx'), 'utf8');
    assert.ok(!/₹450\/mo|81 GST|Customer Monthly Rental/.test(numbers), 'the carrier price is not shown to customers as a charge');
    const offenders = [];
    (function walk(dir) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); continue; }
        if (/tom_holland/i.test(e.name) || (/\.(tsx?|jsx?|html|css)$/.test(e.name) && /tom_holland/i.test(fs.readFileSync(p, 'utf8')))) offenders.push(path.relative(fe, p));
      }
    })(path.join(fe, 'src'));
    (function walkPublic(dir) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walkPublic(p); else if (/tom_holland/i.test(e.name)) offenders.push(path.relative(fe, p));
      }
    })(path.join(fe, 'public'));
    assert.deepStrictEqual(offenders, []);
  });

  await prisma.analysisJob.deleteMany({ where: { workspaceId: { in: users } } }).catch(() => {});
  console.log(`\nAudit batch 13: ${passed}/${total} passed`);
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}

main().catch(async (err) => { console.error(err); await prisma.$disconnect().catch(() => {}); process.exit(1); });
