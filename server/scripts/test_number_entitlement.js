require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Phase 7 (issue B9; pre-launch items P3, P4, P8): who may hold a phone number.
 *  - P4: numbers need an ACTIVE PAID plan; leftover free minutes are not enough; suspended never.
 *  - P8: trial (₹1) and starter are paid plans (paying Starter customers were treated as free).
 *  - P3: ONE number per account, taken atomically: many parallel claims → exactly one wins.
 *  - The slot is given back only when provisioning failed and no number is held.
 *  - The old /telephony/purchase route (bought carrier numbers with no payment, KYC or limit) is gone.
 *
 * Production middleware/services against the local TEST database (a real Postgres for the race).
 * Run: npm run test:number-entitlement   (part of npm run test:security)
 */
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { prisma } = require('../dist/lib/prisma');
const { requirePaidPlan, hasActivePaidPlan, requireAgentQuota, PAID_ACCOUNT_TYPES } = require('../dist/middleware/planValidation');
const { reserveNumberSlot, releaseNumberSlot } = require('../dist/services/NumberEntitlementService');

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

async function makeUser(data = {}) {
  const id = crypto.randomUUID();
  await prisma.user.create({ data: { id, email: `${id}@example.org`, fullName: 'Number Test', passwordHash: 'x', accountType: 'free', ...data } });
  return id;
}
function runMiddleware(mw, userId) {
  return new Promise((resolve) => {
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { resolve({ status: this.statusCode, body: b }); return this; } };
    Promise.resolve(mw({ userId, headers: {} }, res, (err) => resolve(err ? { status: 500, body: String(err) } : { status: 'next' })));
  });
}
async function giveNumber(userId) {
  return prisma.phoneNumber.create({ data: { phoneNumber: `+9180${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`, userId, countryCode: 'IN', telephonyProvider: 'vobiz' } });
}

async function main() {
  console.log('\n--- NUMBER ENTITLEMENT (B9: P3, P4, P8) ---');

  await test('P4: a free account with leftover minutes cannot take a number; a paid one can', async () => {
    const free = await makeUser({ accountType: 'free', minutesRemainingSeconds: 6000 });
    const r = await runMiddleware(requirePaidPlan, free);
    assert.strictEqual(r.status, 403);
    assert.strictEqual(r.body.code, 'PAID_PLAN_REQUIRED');
    for (const t of ['trial', 'starter', 'developer', 'professional', 'enterprise']) {
      assert.strictEqual((await runMiddleware(requirePaidPlan, await makeUser({ accountType: t }))).status, 'next', t);
    }
    const suspended = await makeUser({ accountType: 'enterprise', accountStatus: 'suspended' });
    assert.strictEqual((await runMiddleware(requirePaidPlan, suspended)).status, 403);
    assert.strictEqual(hasActivePaidPlan({ accountType: 'free' }), false);
  });

  await test('P8: trial and starter are paid plans (Starter is no longer capped at 2 agents)', async () => {
    assert.ok(PAID_ACCOUNT_TYPES.includes('trial') && PAID_ACCOUNT_TYPES.includes('starter'));
    // ...but they are minute packs: with 0 minutes they still cannot place calls.
    const { isUserEntitled } = require('../dist/middleware/planValidation');
    assert.strictEqual(isUserEntitled({ accountType: 'trial', minutesRemainingSeconds: 0 }), false);
    assert.strictEqual(isUserEntitled({ accountType: 'starter', minutesRemainingSeconds: 0 }), false);
    assert.strictEqual(isUserEntitled({ accountType: 'starter', minutesRemainingSeconds: 60 }), true);
    const starter = await makeUser({ accountType: 'starter' });
    for (let i = 0; i < 3; i++) await prisma.agent.create({ data: { userId: starter, name: `A${i}` } });
    assert.strictEqual((await runMiddleware(requireAgentQuota, starter)).status, 'next');
    const free = await makeUser();
    for (let i = 0; i < 2; i++) await prisma.agent.create({ data: { userId: free, name: `F${i}` } });
    assert.strictEqual((await runMiddleware(requireAgentQuota, free)).status, 403);
  });

  await test('P3: 12 parallel claims for one account → exactly one wins (5 rounds)', async () => {
    for (let round = 0; round < 5; round++) {
      const u = await makeUser({ accountType: 'starter' });
      const results = await Promise.all(Array.from({ length: 12 }, () => reserveNumberSlot(u)));
      assert.strictEqual(results.filter(Boolean).length, 1, `round ${round}: ${results.filter(Boolean).length} winners`);
    }
  });

  await test('an account that already holds a number cannot take another, even if its flag was cleared', async () => {
    const u = await makeUser({ accountType: 'starter', numberLocked: false });
    await giveNumber(u);
    assert.strictEqual(await reserveNumberSlot(u), false);
  });

  await test('the slot is given back after a failed setup, never while a number is held', async () => {
    const u = await makeUser({ accountType: 'starter' });
    assert.strictEqual(await reserveNumberSlot(u), true);
    await releaseNumberSlot(u, 'test_failure');
    assert.strictEqual((await prisma.user.findUnique({ where: { id: u } })).numberLocked, false);
    assert.strictEqual(await reserveNumberSlot(u), true);
    await giveNumber(u);
    await releaseNumberSlot(u, 'test_failure');
    assert.strictEqual((await prisma.user.findUnique({ where: { id: u } })).numberLocked, true);
  });

  await test('every number route requires a paid plan and takes the slot before provisioning', async () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/routes/numbers.ts'), 'utf8');
    for (const route of ["'/create-order'", "'/purchase'", "'/claim'", "'/plivo/claim'"]) {
      const line = src.split('\n').find((l) => l.includes(`router.post(${route}`));
      assert.ok(line && line.includes('requirePaidPlan') && !line.includes('requireActivePlan'), `${route} must require a paid plan`);
    }
    const section = (from, to) => src.slice(src.indexOf(from), to ? src.indexOf(to) : undefined);
    const claim = section("router.post('/claim'", "router.delete('/:id'");
    assert.ok(claim.indexOf('reserveNumberSlot(userId)') < claim.indexOf('purchaseAndAssignNumber'), 'claim reserves before provisioning');
    const purchase = section("router.post('/purchase'", "router.post('/claim'");
    assert.ok(purchase.indexOf('reserveNumberSlot(userId)') > purchase.indexOf('redeemNumberPayment') && purchase.indexOf('reserveNumberSlot(userId)') < purchase.indexOf('purchaseAndAssignNumber'));
    assert.ok(/NUMBER_SLOT_TAKEN[\s\S]{0,40}|refundOrder\(paymentId, paid\.amountPaise\)/.test(purchase), 'a paid purchase that loses the slot is refunded');
    const plivoClaim = section("router.post('/plivo/claim'");
    assert.ok(plivoClaim.indexOf('reserveNumberSlot(userId)') < plivoClaim.indexOf('purchaseAndAssignNumber'));
    // Phase 13: the unused paid /plivo/purchase route (no screen, no order flow creates its orders) is gone.
    assert.ok(!src.includes("router.post('/plivo/purchase'"), 'unused paid Plivo purchase route removed');
  });

  await test('the unpaid /telephony/purchase route is gone', async () => {
    assert.ok(!fs.existsSync(path.join(__dirname, '../src/routes/telephony.ts')));
    assert.ok(!fs.existsSync(path.join(__dirname, '../src/controllers/telephony.controller.ts')));
    const index = fs.readFileSync(path.join(__dirname, '../src/index.ts'), 'utf8');
    assert.ok(!index.includes('telephonyRoutes') && !index.includes("'/api/v2/telephony', requireAuth"));
    assert.ok(index.includes("'/api/v2/telephony/webhook'"), 'the carrier webhook must stay');
  });

  await test('every KYC route the KYC page calls exists on the server', async () => {
    const kycRouter = require('../dist/routes/kyc').default;
    const paths = new Set();
    for (const l of kycRouter.stack) if (l.route) [].concat(l.route.path).forEach((p) => paths.add(`${Object.keys(l.route.methods)[0]} ${p}`));
    const page = fs.readFileSync(path.join(__dirname, '../../Frontend/src/app/components/kyc/KycComplianceSettings.tsx'), 'utf8');
    const called = [...new Set((page.match(/kyc\/[a-zA-Z0-9/_-]+/g) || []).map((m) => m.slice(3)))];
    assert.ok(called.length >= 5, `found ${called.length} calls`);
    for (const p of called) {
      assert.ok([...paths].some((x) => x.endsWith(` ${p}`)), `KYC page calls ${p} but the server has no such route`);
    }
  });

  await test('P6: no carrier names in user-facing error messages (white-label)', async () => {
    const files = ['src/routes/numbers.ts', 'src/routes/kyc.ts', 'src/routes/billing.ts', 'src/services/CallService.ts', 'src/services/KycVerificationService.ts', 'src/services/VobizIntegrationService.ts'];
    const offenders = [];
    for (const f of files) {
      fs.readFileSync(path.join(__dirname, '..', f), 'utf8').split('\n').forEach((line, i) => {
        if (/logger\./.test(line)) return;
        if (/(error|message)['"]?:\s*[`'"][^`'"]*\b(Vobiz|Plivo)\b/i.test(line)) offenders.push(`${f}:${i + 1}`);
      });
    }
    assert.deepStrictEqual(offenders, []);
  });

  console.log(`\nNUMBER ENTITLEMENT: ${passed === total ? 'PASS' : 'FAIL'} — ${passed}/${total} tests passed\n`);
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error in number entitlement tests:', err);
  process.exit(1);
});
