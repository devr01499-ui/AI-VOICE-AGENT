require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Phase 9 (issue B11): the Calling Configuration page loads fast.
 * Root cause: GET /numbers/calling-config waited for a live carrier KYC call (no timeout) on
 * every load, and loaded every agent's full row (prompt, config, flow) just to show its name.
 *
 * Production route handler against the local TEST database; the carrier KYC call is replaced by
 * a deliberately slow (3 s) stand-in to prove the page no longer waits for it.
 * Run: npm run test:calling-config   (part of npm run test:security)
 */
const assert = require('assert');
const crypto = require('crypto');
const { prisma } = require('../dist/lib/prisma');
const numbersRouter = require('../dist/routes/numbers');
const { VobizSubAccountService } = require('../dist/services/VobizSubAccountService');

let total = 0;
let passed = 0;
async function test(name, fn) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}\n    ${err.stack || err.message}`);
  }
}
function getCallingConfig(userId) {
  const layer = numbersRouter.default.stack.find((l) => l.route && l.route.path === '/calling-config' && l.route.methods.get);
  const handler = layer.route.stack[layer.route.stack.length - 1].handle;
  return new Promise((resolve) => {
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { resolve({ status: this.statusCode, body: b }); return this; } };
    handler({ userId, headers: {} }, res, (e) => resolve({ status: 500, body: String(e) }));
  });
}

async function main() {
  console.log('\n--- CALLING CONFIGURATION SPEED (B11) ---');
  let syncCalls = 0;
  VobizSubAccountService.prototype.syncKycStatus = async function () { syncCalls++; await new Promise((r) => setTimeout(r, 3000)); return { kycStatus: 'verified', isVerified: true }; };

  const userId = crypto.randomUUID();
  await prisma.user.create({ data: { id: userId, email: `${userId}@example.org`, fullName: 'Config Test', passwordHash: 'x', accountType: 'starter' } });
  const agent = await prisma.agent.create({ data: { userId, name: 'Front Desk', systemPrompt: 'x'.repeat(200000) } });
  await prisma.phoneNumber.create({ data: { phoneNumber: `+9180${crypto.randomInt(10_000_000, 99_999_999)}`, userId, countryCode: 'IN', telephonyProvider: 'vobiz', assignedAgentId: agent.id } });

  await test('the page answers without waiting for the carrier (slow carrier = 3 s)', async () => {
    const t0 = Date.now();
    const r = await getCallingConfig(userId);
    const ms = Date.now() - t0;
    assert.strictEqual(r.status, 200);
    assert.ok(ms < 1000, `took ${ms} ms (must not wait for the 3 s carrier call)`);
    assert.strictEqual(r.body.data.length, 1);
    assert.strictEqual(r.body.data[0].outboundAgentName, 'Front Desk');
    await new Promise((res) => setImmediate(res));
    assert.strictEqual(syncCalls, 1, 'KYC is still refreshed, in the background');
  });

  await test('the carrier refresh runs at most once per 5 minutes per account', async () => {
    await getCallingConfig(userId);
    await getCallingConfig(userId);
    await new Promise((res) => setImmediate(res));
    assert.strictEqual(syncCalls, 1);
  });

  await test('agent rows are not loaded in full (names only)', async () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../src/routes/numbers.ts'), 'utf8');
    const route = src.slice(src.indexOf("router.get('/calling-config'"), src.indexOf("router.post('/:id/calling-config'"));
    assert.ok(!/agent:\s*true/.test(route), 'agent: true loads prompts and configs');
    assert.ok(!route.includes('await subService.syncKycStatus'), 'must not await the carrier');
  });

  console.log(`\nCALLING CONFIG: ${passed === total ? 'PASS' : 'FAIL'} — ${passed}/${total} tests passed\n`);
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error in calling config tests:', err);
  process.exit(1);
});
