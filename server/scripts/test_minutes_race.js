require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Audit #1: concurrent minute debits/credits for one account must never lose an update.
 * Needs a real Postgres with parallel connections (not PGlite): see RUNBOOK. In CI it runs on the
 * service Postgres. Run: npm run test:minutes-race
 */
const assert = require('assert');
const crypto = require('crypto');
const { prisma } = require('../dist/lib/prisma');
const { MinutesService } = require('../dist/services/MinutesService');

let total = 0;
let passed = 0;
async function test(name, fn) {
  total++;
  try { await fn(); passed++; console.log(`  ✓ ${name}`); } catch (err) { console.error(`  ✗ FAIL: ${name}\n    ${err.stack || err.message}`); }
}

async function main() {
  console.log('\n--- MINUTES RACE (audit #1) ---');

  await test('20 parallel 60 s call debits on a 3,000 s balance leave exactly 1,800 s', async () => {
    for (let round = 0; round < 3; round++) {
      const id = crypto.randomUUID();
      await prisma.user.create({ data: { id, email: `${id}@claritiy-test.co.in`, fullName: 'Race', passwordHash: 'x', accountType: 'starter', minutesRemainingSeconds: 3000, callingBalanceMinutes: 50 } });
      await Promise.all(Array.from({ length: 20 }, (_, i) => MinutesService.debit({
        userId: id, deltaSeconds: 60, reason: 'call_usage', refType: 'call', refId: `c${i}`, actorType: 'system', idempotencyKey: `race_${id}_${i}`,
      })));
      const u = await prisma.user.findUnique({ where: { id } });
      assert.strictEqual(u.minutesRemainingSeconds, 1800, `round ${round}: balance ${u.minutesRemainingSeconds}`);
      const ledger = await prisma.minutesLedger.count({ where: { userId: id } });
      assert.strictEqual(ledger, 20);
    }
  });

  await test('a plan credit racing call debits keeps every change', async () => {
    const id = crypto.randomUUID();
    await prisma.user.create({ data: { id, email: `${id}@claritiy-test.co.in`, fullName: 'Race', passwordHash: 'x', accountType: 'starter', minutesRemainingSeconds: 600, callingBalanceMinutes: 10 } });
    await Promise.all([
      ...Array.from({ length: 5 }, (_, i) => MinutesService.debit({ userId: id, deltaSeconds: 60, reason: 'call_usage', actorType: 'system', idempotencyKey: `d_${id}_${i}` })),
      MinutesService.credit({ userId: id, deltaSeconds: 45000, reason: 'plan_purchase', actorType: 'system', idempotencyKey: `cr_${id}` }),
    ]);
    const u = await prisma.user.findUnique({ where: { id } });
    assert.strictEqual(u.minutesRemainingSeconds, 600 - 300 + 45000);
  });

  await test('the same idempotency key applied in parallel debits only once', async () => {
    const id = crypto.randomUUID();
    await prisma.user.create({ data: { id, email: `${id}@claritiy-test.co.in`, fullName: 'Race', passwordHash: 'x', accountType: 'starter', minutesRemainingSeconds: 600, callingBalanceMinutes: 10 } });
    const key = `same_${id}`;
    await Promise.allSettled(Array.from({ length: 6 }, () => MinutesService.debit({ userId: id, deltaSeconds: 120, reason: 'call_usage', actorType: 'system', idempotencyKey: key })));
    const u = await prisma.user.findUnique({ where: { id } });
    assert.strictEqual(u.minutesRemainingSeconds, 480);
  });

  console.log(`\nMINUTES RACE: ${passed === total ? 'PASS' : 'FAIL'} — ${passed}/${total} tests passed\n`);
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}
main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
