require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Plan validity and number release (owner decision 2026-11-19). Production code; no carrier is
 * contacted (without carrier keys in a test run, a release counts as already done).
 *  - a purchase sets planExpiresAt = purchase + 30 days; an expired window is no longer a paid plan
 *  - at the 30-day end unused minutes lapse, once
 *  - plan end = minutes used up OR 30 days, whichever first; the user is warned once, and the number
 *    is released NUMBER_RELEASE_GRACE_DAYS (5) days after the end
 *  - buying a plan inside the grace period cancels the release; admins are never touched
 *  - numbers stuck in release_pending are retried
 * Run: npm run test:plan-lifecycle   (part of npm run test:security)
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
const DAY = 24 * 60 * 60 * 1000;
const phone = () => `+9180${Math.floor(10000000 + Math.random() * 89999999)}`;

async function newUser(extra = {}) {
  const id = crypto.randomUUID();
  await prisma.user.create({ data: { id, email: `pl-${id.slice(0, 8)}@claritiy-test.co.in`, fullName: 'Plan Life', passwordHash: 'x', accountType: 'developer', callingBalanceMinutes: 0, minutesRemainingSeconds: 0, ...extra } });
  return id;
}
const addNumber = (userId, status = 'active') => prisma.phoneNumber.create({ data: { userId, phoneNumber: phone(), countryCode: 'IN', telephonyProvider: 'vobiz', status } });

async function main() {
  console.log('\n--- PLAN LIFECYCLE ---');
  const { PLAN_VALIDITY_DAYS, NUMBER_RELEASE_GRACE_DAYS } = require('../dist/config/plans');
  const { hasActivePaidPlan } = require('../dist/middleware/planValidation');
  const { fulfillPlanPurchase } = require('../dist/services/PlanFulfillmentService');
  const { runPlanLifecycle, lapseExpiredMinutes } = require('../dist/services/PlanLifecycleService');
  assert.strictEqual(PLAN_VALIDITY_DAYS, 30);
  assert.strictEqual(NUMBER_RELEASE_GRACE_DAYS, 5);

  await test('a purchase sets a 30-day validity; an expired window is not an active paid plan', async () => {
    const u = await newUser({ accountType: 'free' });
    const t = crypto.randomUUID().slice(0, 10);
    const before = Date.now();
    await fulfillPlanPurchase({ userId: u, orderId: `order_pl_${t}`, paymentId: `pay_pl_${t}`, planKey: 'startup', source: 'self_serve' });
    const row = await prisma.user.findUnique({ where: { id: u } });
    const delta = row.planExpiresAt.getTime() - before;
    assert.ok(delta >= 30 * DAY - 5000 && delta <= 30 * DAY + 60000, `about 30 days (${delta})`);
    assert.strictEqual(hasActivePaidPlan(row), true);
    assert.strictEqual(hasActivePaidPlan(row, new Date(row.planExpiresAt.getTime() + 1000)), false, 'after the window');
    assert.strictEqual(hasActivePaidPlan({ ...row, planExpiresAt: null }), true, 'older plans without an end date stay active');
  });

  await test('at the 30-day end unused minutes lapse, once', async () => {
    const u = await newUser({ minutesRemainingSeconds: 600, callingBalanceMinutes: 10, planExpiresAt: new Date(Date.now() - 1000) });
    const user = await prisma.user.findUnique({ where: { id: u } });
    assert.strictEqual(await lapseExpiredMinutes(user, new Date()), 600);
    const after = await prisma.user.findUnique({ where: { id: u } });
    assert.strictEqual(after.minutesRemainingSeconds, 0);
    const ledger = await prisma.minutesLedger.findMany({ where: { userId: u, reason: 'plan_expired' } });
    assert.strictEqual(ledger.length, 1);
    assert.strictEqual(await lapseExpiredMinutes(after, new Date()), 0, 'nothing left to lapse');
    await lapseExpiredMinutes(user, new Date()).catch(() => {}); // replay of the same window
    assert.strictEqual((await prisma.minutesLedger.findMany({ where: { userId: u, reason: 'plan_expired' } })).length, 1, 'idempotent');
  });

  await test('minutes used up: warned once, number kept during the 5-day grace, released after it', async () => {
    const u = await newUser({ minutesRemainingSeconds: 0, planExpiresAt: new Date(Date.now() + 20 * DAY) });
    const n = await addNumber(u);
    const now = new Date();
    const r1 = await runPlanLifecycle(now, { userIds: [u] });
    assert.strictEqual(r1.warned, 1, 'warned when the plan ends');
    assert.ok(await prisma.phoneNumber.findUnique({ where: { id: n.id } }), 'kept during the grace period');
    const note = await prisma.systemAlert.findFirst({ where: { userId: u, type: 'PLAN_ENDED' } });
    assert.ok(note && /will be released on/.test(note.message));
    const r2 = await runPlanLifecycle(new Date(now.getTime() + 2 * DAY), { userIds: [u] });
    assert.strictEqual(r2.warned, 0, 'warned only once');
    assert.ok(await prisma.phoneNumber.findUnique({ where: { id: n.id } }));
    const r3 = await runPlanLifecycle(new Date(now.getTime() + 5 * DAY + 60 * 60 * 1000), { userIds: [u] });
    assert.strictEqual(r3.released, 1);
    assert.strictEqual(await prisma.phoneNumber.findUnique({ where: { id: n.id } }), null, 'released after 5 days');
    assert.ok(await prisma.systemAlert.findFirst({ where: { userId: u, type: 'NUMBER_RELEASED' } }));
  });

  await test('30 days up (minutes left): minutes lapse and the number goes 5 days after the 30-day end', async () => {
    const u = await newUser({ minutesRemainingSeconds: 3000, callingBalanceMinutes: 50, planExpiresAt: new Date(Date.now() - 6 * DAY) });
    const n = await addNumber(u);
    const r = await runPlanLifecycle(new Date(), { userIds: [u] });
    assert.strictEqual(r.minutesLapsed, 3000);
    assert.strictEqual(r.released, 1, 'ended 6 days ago: past the 5-day grace');
    assert.strictEqual(await prisma.phoneNumber.findUnique({ where: { id: n.id } }), null);
  });

  await test('buying a plan inside the grace period cancels the release', async () => {
    const u = await newUser({ accountType: 'free', minutesRemainingSeconds: 0 });
    const n = await addNumber(u);
    const now = new Date();
    await runPlanLifecycle(now, { userIds: [u] }); // plan ended (no minutes): warning
    const t = crypto.randomUUID().slice(0, 10);
    await fulfillPlanPurchase({ userId: u, orderId: `order_pl2_${t}`, paymentId: `pay_pl2_${t}`, planKey: 'startup', source: 'self_serve' });
    const r = await runPlanLifecycle(new Date(now.getTime() + 6 * DAY), { userIds: [u] });
    assert.strictEqual(r.released, 0);
    assert.ok(await prisma.phoneNumber.findUnique({ where: { id: n.id } }), 'kept: a new plan was bought');
  });

  await test('admins are never touched; numbers stuck in release_pending are retried', async () => {
    const admin = await newUser({ accountType: 'admin', minutesRemainingSeconds: 0, planExpiresAt: new Date(Date.now() - 40 * DAY) });
    const an = await addNumber(admin);
    const r = await runPlanLifecycle(new Date(Date.now() + 10 * DAY), { userIds: [admin] });
    assert.strictEqual(r.released, 0);
    assert.ok(await prisma.phoneNumber.findUnique({ where: { id: an.id } }));

    const u = await newUser({ minutesRemainingSeconds: 6000, callingBalanceMinutes: 100, planExpiresAt: new Date(Date.now() + 20 * DAY) });
    const stuck = await addNumber(u, 'release_pending');
    const r2 = await runPlanLifecycle(new Date(), { userIds: [u] });
    assert.strictEqual(r2.released, 1);
    assert.strictEqual(await prisma.phoneNumber.findUnique({ where: { id: stuck.id } }), null);
  });

  console.log(`\nPlan lifecycle: ${passed}/${total} passed`);
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}

main().catch(async (err) => { console.error(err); await prisma.$disconnect().catch(() => {}); process.exit(1); });
