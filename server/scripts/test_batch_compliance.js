require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Phase 8 (issue B10): batch calling compliance and restart safety.
 *  - TRAI calling hours 09:00–21:00 IST: a campaign may narrow them, never switch them off or widen them;
 *    the developer bypass switch is ignored in production.
 *  - Retries: at most 3 attempts per person, at least 10 minutes apart, whatever the campaign says.
 *  - After a restart, a recipient whose call is still going on is never dialled again; an ended
 *    call decides the outcome; only a call that was never placed goes back to pending.
 *  - Campaigns paused because calling hours closed resume by themselves when they reopen.
 *
 * Production BatchService against the local TEST database; no calls are placed (dispatch off).
 * Run: npm run test:batch-compliance   (part of npm run test:security)
 */
const assert = require('assert');
const crypto = require('crypto');
const { prisma } = require('../dist/lib/prisma');
const { BatchService, resolveRetryPolicy, MAX_ATTEMPTS_CAP, MIN_RETRY_INTERVAL_MS, CALLING_WINDOW_PAUSE_PREFIX } = require('../dist/services/BatchService');

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
/** A Date for the given IST wall-clock time today. */
const ist = (h, m = 0) => new Date(Date.UTC(2026, 10, 18, h, m) - 5.5 * 3600 * 1000);
const allowed = (cfg, h, m) => BatchService.isWithinCallingWindow(cfg === undefined ? undefined : JSON.stringify(cfg), ist(h, m)).allowed;

async function main() {
  console.log('\n--- BATCH CALLING COMPLIANCE (B10) ---');

  await test('calling hours: 09:00–21:00 IST by default', async () => {
    assert.strictEqual(allowed(undefined, 8, 59), false);
    assert.strictEqual(allowed(undefined, 9, 0), true);
    assert.strictEqual(allowed(undefined, 20, 59), true);
    assert.strictEqual(allowed(undefined, 21, 0), false);
    assert.strictEqual(allowed(undefined, 2, 0), false);
  });

  await test('a campaign can narrow calling hours but never switch them off or widen them', async () => {
    assert.strictEqual(allowed({ ignoreCallingHours: true }, 23, 0), false, 'ignoreCallingHours must be ignored');
    assert.strictEqual(allowed({ startHour: 0, endHour: 24 }, 22, 30), false, 'cannot widen past 21:00');
    assert.strictEqual(allowed({ startHour: 0, endHour: 24 }, 7, 0), false, 'cannot widen before 09:00');
    assert.strictEqual(allowed({ startHour: 10, endHour: 18 }, 9, 30), false, 'narrower start respected');
    assert.strictEqual(allowed({ startHour: 10, endHour: 18 }, 17, 59), true);
    assert.strictEqual(allowed({ startHour: 10, endHour: 18 }, 18, 0), false, 'narrower end respected');
    assert.strictEqual(allowed({ startHour: 20, endHour: 10 }, 12, 0), false, 'empty window never allows calls');
  });

  await test('the developer bypass switch is ignored in production', async () => {
    process.env.ALLOW_OFFHOURS_BATCH_CALLS = 'true';
    try {
      assert.strictEqual(allowed(undefined, 23, 0), true, 'works in test');
      process.env.NODE_ENV = 'production';
      assert.strictEqual(allowed(undefined, 23, 0), false, 'must not work in production');
    } finally {
      process.env.NODE_ENV = 'test';
      delete process.env.ALLOW_OFFHOURS_BATCH_CALLS;
    }
  });

  await test('retries: at most 3 attempts, at least 10 minutes apart', async () => {
    assert.deepStrictEqual(resolveRetryPolicy(JSON.stringify({ maxAttempts: 50, intervalMinutes: 1 })), { maxAttempts: MAX_ATTEMPTS_CAP, retryIntervalMs: MIN_RETRY_INTERVAL_MS });
    assert.deepStrictEqual(resolveRetryPolicy('{}'), { maxAttempts: 3, retryIntervalMs: 30 * 60 * 1000 });
    assert.deepStrictEqual(resolveRetryPolicy({ maxAttempts: 0, intervalMs: 60 * 60 * 1000 }), { maxAttempts: 1, retryIntervalMs: 60 * 60 * 1000 });
    assert.deepStrictEqual(resolveRetryPolicy('not json'), { maxAttempts: 3, retryIntervalMs: 30 * 60 * 1000 });
  });

  // Fixture for recovery tests.
  const userId = crypto.randomUUID();
  await prisma.user.create({ data: { id: userId, email: `${userId}@example.org`, fullName: 'Batch Test', passwordHash: 'x', accountType: 'starter' } });
  const agent = await prisma.agent.create({ data: { userId, name: 'Batch agent' } });
  const longAgo = new Date(Date.now() - 60 * 60 * 1000);

  await test('after a restart: a live call is never re-dialled; ended calls decide; unplaced calls go back to pending', async () => {
    const batch = await prisma.batch.create({ data: { userId, agentId: agent.id, name: 'Recovery', status: 'paused', statusReason: 'Paused by user' } });
    const mkCall = (status, extra = {}) => prisma.call.create({ data: { agentId: agent.id, userId, batchId: batch.id, recipientPhoneNumber: extra.to || '+919800000001', status, ...extra.data } });
    const live = await mkCall('in_progress');
    const ended = await mkCall('completed', { to: '+919800000002', data: { startTime: longAgo, durationSeconds: 95 } });
    const liveNoId = await mkCall('ringing', { to: '+919800000004' });
    const rLive = await prisma.batchRecipient.create({ data: { batchId: batch.id, phoneNumber: '+919800000001', status: 'in_progress', callId: live.id, attempts: 1, lastAttemptAt: longAgo } });
    const rEnded = await prisma.batchRecipient.create({ data: { batchId: batch.id, phoneNumber: '+919800000002', status: 'in_progress', callId: ended.id, attempts: 1, lastAttemptAt: longAgo } });
    const rNever = await prisma.batchRecipient.create({ data: { batchId: batch.id, phoneNumber: '+919800000003', status: 'in_progress', attempts: 0, lastAttemptAt: longAgo } });
    // Crash between placing the call and saving its id: the call exists, the recipient has no callId.
    const rLiveNoId = await prisma.batchRecipient.create({ data: { batchId: batch.id, phoneNumber: '+919800000004', status: 'in_progress', attempts: 0, lastAttemptAt: new Date(liveNoId.createdAt.getTime() - 1000) } });
    // lastAttemptAt must be older than the stuck threshold for recovery to look at it.
    await prisma.batchRecipient.update({ where: { id: rLiveNoId.id }, data: { lastAttemptAt: longAgo } });
    await prisma.call.update({ where: { id: liveNoId.id }, data: { createdAt: new Date(longAgo.getTime() + 1000) } });

    await BatchService.recoverStaleBatches({ dispatch: false });
    const get = async (r) => prisma.batchRecipient.findUnique({ where: { id: r.id } });
    assert.strictEqual((await get(rLive)).status, 'in_progress', 'a call still going on must not be re-dialled');
    assert.strictEqual((await get(rEnded)).status, 'completed', 'an answered call completes the recipient');
    assert.strictEqual((await get(rNever)).status, 'pending', 'a call never placed goes back to pending');
    assert.strictEqual((await get(rLiveNoId)).status, 'in_progress', 'a live call found by number must not be re-dialled');
  });

  await test('a campaign paused by closed calling hours resumes when they reopen; a user pause does not', async () => {
    const reason = `${CALLING_WINDOW_PAUSE_PREFIX} (09:00 - 21:00 IST). Resumes automatically when calling hours open.`;
    const byWindow = await prisma.batch.create({ data: { userId, agentId: agent.id, name: 'Night', status: 'paused', statusReason: reason } });
    const byUser = await prisma.batch.create({ data: { userId, agentId: agent.id, name: 'Manual', status: 'paused', statusReason: 'Paused by user' } });
    await BatchService.recoverStaleBatches({ now: ist(22, 0), dispatch: false });
    assert.strictEqual((await prisma.batch.findUnique({ where: { id: byWindow.id } })).status, 'paused', 'still night');
    await BatchService.recoverStaleBatches({ now: ist(9, 5), dispatch: false });
    assert.strictEqual((await prisma.batch.findUnique({ where: { id: byWindow.id } })).status, 'running');
    assert.strictEqual((await prisma.batch.findUnique({ where: { id: byUser.id } })).status, 'paused', 'a user pause is never resumed automatically');
    await prisma.batch.update({ where: { id: byWindow.id }, data: { status: 'cancelled' } });
  });

  console.log(`\nBATCH COMPLIANCE: ${passed === total ? 'PASS' : 'FAIL'} — ${passed}/${total} tests passed\n`);
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error in batch compliance tests:', err);
  process.exit(1);
});
