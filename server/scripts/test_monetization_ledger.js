/**
 * CLARITIY VOICE — BATCH C AUTOMATED TEST SUITE
 * Validates Monetization Gateway, Minute Decrement Correctness, Billable Ceiling Rounding,
 * Post-Call Ledger Idempotency, Negative Overdraft Defense, and Zero-Minute Pre-Call Gating.
 */

const assert = require('assert');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { prisma } = require('../dist/lib/prisma');
const { MinutesService } = require('../dist/services/MinutesService');
const { CallService } = require('../dist/services/CallService');
const { CallRepository } = require('../dist/repositories/CallRepository');
const { getEffectiveRemainingSeconds, isUserEntitled } = require('../dist/middleware/planValidation');

let totalTests = 0;
let passedTests = 0;

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`     Error: ${err.message || err}`);
    if (err.stack) console.error(err.stack);
  }
}

async function main() {
  console.log('================================================================================');
  console.log('💰 CLARITIY VOICE — MONETIZATION GATEWAY & MINUTE DECREMENT SUITE (BATCH C)');
  console.log('================================================================================\n');

  const testUserId = `monetize_user_${Date.now()}`;
  const testAgentId = `monetize_agent_${Date.now()}`;

  // Seed test tenant with initial 300 seconds (5 minutes)
  await prisma.user.create({
    data: {
      id: testUserId,
      email: `${testUserId}@claritiy.test`,
      fullName: 'Batch C Monetization Tester',
      passwordHash: 'hashed_fixture_password',
      accountType: 'trial',
      accountStatus: 'active',
      callingBalanceMinutes: 5,
      minutesRemainingSeconds: 300,
      maxConcurrentCalls: 1
    }
  });

  // Snapshot initial opening balance in ledger
  await MinutesService.backfillOpeningBalance(testUserId);

  await prisma.agent.create({
    data: {
      id: testAgentId,
      userId: testUserId,
      name: 'Monetization Voice Agent',
      status: 'active',
      voiceName: 'Puck',
      agentConfig: JSON.stringify({ voice: 'Puck' })
    }
  });

  // ─── 1. BILLABLE CEILING ROUNDING TO WHOLE MINUTES (P0-6) ────────────────────────────
  console.log('--- 1. BILLABLE CEILING ROUNDING TO WHOLE MINUTES (P0-6) ---');

  await runAsyncTest('A 12-second call is billed as 60 seconds (1 minute ceiling)', async () => {
    const call = await CallRepository.create({
      agentId: testAgentId,
      userId: testUserId,
      recipientPhoneNumber: '+919876543201',
      fromPhoneNumber: '+18005550199',
      maxDuration: 1800
    });

    await CallService.deductCallMinutes(call.id, 12);

    const ledger = await prisma.minutesLedger.findUnique({
      where: { idempotencyKey: `call_usage_${call.id}` }
    });

    assert.ok(ledger !== null, 'Ledger entry must exist');
    assert.strictEqual(ledger.deltaSeconds, -60, '12s duration must debit exactly -60s (1m)');
    assert.strictEqual(ledger.balanceAfterSeconds, 240, 'Balance must be 300 - 60 = 240s');

    const freshUser = await prisma.user.findUnique({ where: { id: testUserId } });
    assert.strictEqual(freshUser.minutesRemainingSeconds, 240);
    assert.strictEqual(freshUser.callingBalanceMinutes, 4.0);
  });

  await runAsyncTest('A 61-second call is billed as 120 seconds (2 minute ceiling)', async () => {
    const call = await CallRepository.create({
      agentId: testAgentId,
      userId: testUserId,
      recipientPhoneNumber: '+919876543202',
      fromPhoneNumber: '+18005550199',
      maxDuration: 1800
    });

    await CallService.deductCallMinutes(call.id, 61);

    const ledger = await prisma.minutesLedger.findUnique({
      where: { idempotencyKey: `call_usage_${call.id}` }
    });

    assert.ok(ledger !== null, 'Ledger entry must exist');
    assert.strictEqual(ledger.deltaSeconds, -120, '61s duration must debit exactly -120s (2m)');
    assert.strictEqual(ledger.balanceAfterSeconds, 120, 'Balance must be 240 - 120 = 120s');

    const freshUser = await prisma.user.findUnique({ where: { id: testUserId } });
    assert.strictEqual(freshUser.minutesRemainingSeconds, 120);
    assert.strictEqual(freshUser.callingBalanceMinutes, 2.0);
  });

  // ─── 2. IDEMPOTENT POST-CALL DEBIT PROTECTION (P0-6) ────────────────────────────────
  console.log('\n--- 2. IDEMPOTENT POST-CALL DEBIT PROTECTION (P0-6) ---');

  await runAsyncTest('Replaying deductCallMinutes for the same callId is strictly idempotent', async () => {
    const call = await CallRepository.create({
      agentId: testAgentId,
      userId: testUserId,
      recipientPhoneNumber: '+919876543203',
      fromPhoneNumber: '+18005550199',
      maxDuration: 1800
    });

    // 1st deduction: 30s call -> billed 60s
    await CallService.deductCallMinutes(call.id, 30);

    const userAfterFirst = await prisma.user.findUnique({ where: { id: testUserId } });
    assert.strictEqual(userAfterFirst.minutesRemainingSeconds, 60, '120 - 60 = 60s remaining');

    // 2nd duplicate deduction (simulating webhook replay or double hangup callback)
    await CallService.deductCallMinutes(call.id, 30);

    const userAfterSecond = await prisma.user.findUnique({ where: { id: testUserId } });
    assert.strictEqual(userAfterSecond.minutesRemainingSeconds, 60, 'Balance must remain unchanged after replayed deduction');

    const ledgerEntries = await prisma.minutesLedger.findMany({
      where: { idempotencyKey: `call_usage_${call.id}` }
    });
    assert.strictEqual(ledgerEntries.length, 1, 'Only one ledger entry may ever exist per callId');
  });

  // ─── 3. NEGATIVE BALANCE HANDLING & OVERDRAFT RECONCILIATION (P0-6) ──────────────────
  console.log('\n--- 3. NEGATIVE BALANCE HANDLING & OVERDRAFT RECONCILIATION (P0-6) ---');

  await runAsyncTest('Post-call deduction allows balance to dip into negative overdraft for final completed call', async () => {
    // User has 60s remaining. Call runs for 75s (billed 120s / 2m).
    const call = await CallRepository.create({
      agentId: testAgentId,
      userId: testUserId,
      recipientPhoneNumber: '+919876543204',
      fromPhoneNumber: '+18005550199',
      maxDuration: 1800
    });

    // Must NOT throw INSUFFICIENT_BALANCE error; must record accurate overdraft
    await CallService.deductCallMinutes(call.id, 75);

    const ledger = await prisma.minutesLedger.findUnique({
      where: { idempotencyKey: `call_usage_${call.id}` }
    });
    assert.strictEqual(ledger.deltaSeconds, -120);
    assert.strictEqual(ledger.balanceAfterSeconds, -60, 'Balance must accurately reflect 60 - 120 = -60s');

    const freshUser = await prisma.user.findUnique({ where: { id: testUserId } });
    assert.strictEqual(freshUser.minutesRemainingSeconds, -60);
    assert.strictEqual(freshUser.callingBalanceMinutes, -1.0, 'Calling balance minutes must stay in lockstep (-1.0)');
  });

  await runAsyncTest('Subsequent plan purchase / credit accurately offsets existing negative overdraft', async () => {
    // User is at -60s. Admin grants or user purchases 10 minutes (600s).
    const result = await MinutesService.credit({
      userId: testUserId,
      deltaSeconds: 600,
      reason: 'plan_purchase',
      actorType: 'system',
      idempotencyKey: `test_plan_purchase_${Date.now()}`
    });

    assert.strictEqual(result.balanceSeconds, 540, '-60s + 600s must equal 540s');
    assert.strictEqual(result.balanceMinutes, 9.0);

    const freshUser = await prisma.user.findUnique({ where: { id: testUserId } });
    assert.strictEqual(freshUser.minutesRemainingSeconds, 540);
    assert.strictEqual(freshUser.callingBalanceMinutes, 9.0);
  });

  // ─── 4. ZERO-MINUTE PRE-CALL GATE DEFENSE (P0-6) ──────────────────────────────────────
  console.log('\n--- 4. ZERO-MINUTE PRE-CALL GATE DEFENSE (P0-6) ---');

  await runAsyncTest('User with zero balance is strictly blocked by pre-call gate', async () => {
    const zeroBalanceUser = {
      minutesRemainingSeconds: 0,
      callingBalanceMinutes: 0,
      accountType: 'trial',
      accountStatus: 'active'
    };

    const remaining = getEffectiveRemainingSeconds(zeroBalanceUser);
    assert.strictEqual(remaining, 0);

    const entitled = isUserEntitled(zeroBalanceUser);
    assert.strictEqual(entitled, false, 'User with 0 balance must not be entitled');
  });

  await runAsyncTest('User with negative balance is strictly blocked from initiating new calls', async () => {
    const negativeBalanceUser = {
      minutesRemainingSeconds: -60,
      callingBalanceMinutes: -1.0,
      accountType: 'trial',
      accountStatus: 'active'
    };

    const remaining = getEffectiveRemainingSeconds(negativeBalanceUser);
    assert.strictEqual(remaining, 0, 'Negative balance must evaluate to 0 effective remaining seconds');

    const entitled = isUserEntitled(negativeBalanceUser);
    assert.strictEqual(entitled, false, 'Overdrawn account must not be entitled');
  });

  // ─── 5. FULL LEDGER RECONCILIATION AUDIT (P0-6) ───────────────────────────────────────
  console.log('\n--- 5. FULL LEDGER RECONCILIATION AUDIT (P0-6) ---');

  await runAsyncTest('MinutesService.reconcileUser confirms exact alignment between ledger sum and cached balance', async () => {
    const reconciliation = await MinutesService.reconcileUser(testUserId);
    assert.strictEqual(reconciliation.isReconciled, true, 'User ledger must be 100% reconciled');
    assert.strictEqual(reconciliation.diff, 0, 'Difference between ledger entries and cached balance must be 0');
  });

  // ─── CLEANUP TRANSIENT FIXTURES ──────────────────────────────────────────────────────
  console.log('\n--- CLEANUP FIXTURES ---');
  await runAsyncTest('Clean up test monetization records', async () => {
    await prisma.minutesLedger.deleteMany({ where: { userId: testUserId } }).catch(() => {});
    await prisma.call.deleteMany({ where: { userId: testUserId } }).catch(() => {});
    await prisma.agent.deleteMany({ where: { userId: testUserId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: testUserId } }).catch(() => {});
  });

  console.log('================================================================================');
  console.log(`🎉 MONETIZATION GATEWAY & LEDGER SUITE: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('================================================================================\n');

  await prisma.$disconnect();

  if (passedTests !== totalTests) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
