require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
process.env.TZ = 'UTC'; // production (Render) runs in UTC
/**
 * Audit #148: follow-up calls booked by the agent are dialled when due (they were never dialled).
 * Production executor; only the dial itself (CallService.createCall) is stubbed.
 *  - due booking: dialled once with the caller ID of the original call; marked completed
 *  - opted-out contact: never dialled; outside 09:00-21:00 IST: moved to the next allowed slot
 *  - no free line: retried in 2 min without using an attempt; other errors: 15 min backoff, then failed
 *  - two workers at once: one dial; restart mid-dial: never rings twice
 * Run: npm run test:scheduled-calls   (part of npm run test:security)
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
const phone = () => `+9198${Math.floor(10000000 + Math.random() * 89999999)}`;
// 11:30 IST and 23:00 IST on the same day
const DAY_IST = new Date('2026-11-20T06:00:00.000Z');
const NIGHT_IST = new Date('2026-11-20T17:30:00.000Z');

async function main() {
  console.log('\n--- SCHEDULED FOLLOW-UP CALLS (#148) ---');
  const { CallService } = require('../dist/services/CallService');
  const { runScheduledCalls, recoverStuckScheduledCalls, nextAllowedTime } = require('../dist/services/ScheduledCallService');
  const dials = [];
  let behaviour = () => ({ callId: crypto.randomUUID() });
  const origCreate = CallService.createCall;
  CallService.createCall = async (input) => { dials.push(input); await new Promise((r) => setTimeout(r, 30)); return behaviour(input); };

  const uid = crypto.randomUUID();
  await prisma.user.create({ data: { id: uid, email: `sc-${uid.slice(0, 8)}@claritiy-test.co.in`, fullName: 'Sched', passwordHash: 'x', accountType: 'developer', callingBalanceMinutes: 100, minutesRemainingSeconds: 6000 } });
  const agent = await prisma.agent.create({ data: { userId: uid, name: 'Follow-up agent', status: 'active', systemPrompt: 'x' } });
  const ourNumber = phone();
  await prisma.phoneNumber.create({ data: { userId: uid, phoneNumber: phone(), countryCode: 'IN', telephonyProvider: 'vobiz', status: 'active', purchasedAt: new Date('2026-01-01') } });
  await prisma.phoneNumber.create({ data: { userId: uid, phoneNumber: ourNumber, countryCode: 'IN', telephonyProvider: 'vobiz', status: 'active' } });
  const origin = await prisma.call.create({ data: { userId: uid, agentId: agent.id, recipientPhoneNumber: phone(), fromPhoneNumber: ourNumber, callDirection: 'outbound', status: 'completed' } });
  const booking = (extra = {}) => prisma.scheduledCall.create({ data: { source: 'ai_booked', agentId: agent.id, phoneNumber: phone(), scheduledAtUtc: new Date(DAY_IST.getTime() - 60000), timezone: 'Asia/Kolkata', idempotencyKey: crypto.randomUUID(), ...extra } });

  try {
    await test('a due booking is dialled once with the original call\'s caller ID, then completed', async () => {
      const b = await booking({ originCallId: origin.id });
      const future = await booking({ scheduledAtUtc: new Date(DAY_IST.getTime() + 3600000) });
      dials.length = 0;
      const r = await runScheduledCalls(DAY_IST, { ids: [b.id, future.id] });
      assert.strictEqual(r.placed, 1);
      assert.strictEqual(dials.length, 1);
      assert.deepStrictEqual({ to: dials[0].phoneNumber, agent: dials[0].agentId, user: dials[0].userId, from: dials[0].fromPhoneNumber }, { to: b.phoneNumber, agent: agent.id, user: uid, from: ourNumber });
      const row = await prisma.scheduledCall.findUnique({ where: { id: b.id } });
      assert.strictEqual(row.status, 'completed');
      assert.strictEqual(row.attemptCount, 1);
      assert.strictEqual((await prisma.scheduledCall.findUnique({ where: { id: future.id } })).status, 'scheduled', 'not due yet: untouched');
    });

    await test('an opted-out contact is never dialled', async () => {
      const b = await booking();
      await prisma.contact.create({ data: { userId: uid, phoneNumber: b.phoneNumber, optedOutAt: new Date() } });
      dials.length = 0;
      await runScheduledCalls(DAY_IST, { ids: [b.id] });
      assert.strictEqual(dials.length, 0);
      assert.strictEqual((await prisma.scheduledCall.findUnique({ where: { id: b.id } })).status, 'canceled');
    });

    await test('outside 09:00-21:00 IST the call moves to the next morning instead of ringing at night', async () => {
      const b = await booking({ scheduledAtUtc: new Date(NIGHT_IST.getTime() - 60000) });
      dials.length = 0;
      await runScheduledCalls(NIGHT_IST, { ids: [b.id] });
      assert.strictEqual(dials.length, 0);
      const row = await prisma.scheduledCall.findUnique({ where: { id: b.id } });
      assert.strictEqual(row.status, 'scheduled');
      assert.strictEqual(row.scheduledAtUtc.toISOString(), '2026-11-21T03:30:00.000Z', '09:00 IST next day');
      assert.strictEqual(nextAllowedTime(DAY_IST, 'Asia/Kolkata').toISOString(), DAY_IST.toISOString(), 'daytime stays');
    });

    await test('no free line: retried in 2 minutes without using an attempt', async () => {
      const b = await booking();
      behaviour = () => { throw new Error('Concurrency limit exceeded'); };
      await runScheduledCalls(DAY_IST, { ids: [b.id] });
      const row = await prisma.scheduledCall.findUnique({ where: { id: b.id } });
      assert.strictEqual(row.status, 'scheduled');
      assert.strictEqual(row.attemptCount, 0);
      assert.strictEqual(row.scheduledAtUtc.getTime(), DAY_IST.getTime() + 2 * 60000);
    });

    await test('other errors back off 15 minutes, and fail after the last attempt', async () => {
      const b = await booking({ maxAttempts: 2 });
      behaviour = () => { throw new Error('Insufficient call minutes'); };
      await runScheduledCalls(DAY_IST, { ids: [b.id] });
      let row = await prisma.scheduledCall.findUnique({ where: { id: b.id } });
      assert.strictEqual(row.status, 'scheduled');
      assert.strictEqual(row.attemptCount, 1);
      assert.strictEqual(row.scheduledAtUtc.getTime(), DAY_IST.getTime() + 15 * 60000);
      await runScheduledCalls(new Date(DAY_IST.getTime() + 16 * 60000), { ids: [b.id] });
      row = await prisma.scheduledCall.findUnique({ where: { id: b.id } });
      assert.strictEqual(row.status, 'failed');
      assert.strictEqual(row.attemptCount, 2);
    });

    await test('two workers at the same moment dial the booking once', async () => {
      behaviour = () => ({ callId: crypto.randomUUID() });
      const b = await booking();
      dials.length = 0;
      await Promise.all([runScheduledCalls(DAY_IST, { ids: [b.id] }), runScheduledCalls(DAY_IST, { ids: [b.id] })]);
      assert.strictEqual(dials.length, 1);
    });

    await test('after a restart mid-dial the customer is never rung twice', async () => {
      const claimedAt = new Date(Date.now() - 20 * 60000);
      const dialled = await booking({ status: 'in_progress', lastAttemptAt: claimedAt });
      await prisma.call.create({ data: { userId: uid, agentId: agent.id, recipientPhoneNumber: dialled.phoneNumber, fromPhoneNumber: ourNumber, callDirection: 'outbound', status: 'completed' } });
      const notDialled = await booking({ status: 'in_progress', lastAttemptAt: claimedAt });
      await recoverStuckScheduledCalls(new Date());
      assert.strictEqual((await prisma.scheduledCall.findUnique({ where: { id: dialled.id } })).status, 'completed', 'call already happened');
      assert.strictEqual((await prisma.scheduledCall.findUnique({ where: { id: notDialled.id } })).status, 'scheduled', 'no call happened: back in the queue');
    });
  } finally {
    CallService.createCall = origCreate;
  }

  console.log(`\nScheduled calls: ${passed}/${total} passed`);
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}

main().catch(async (err) => { console.error(err); await prisma.$disconnect().catch(() => {}); process.exit(1); });
