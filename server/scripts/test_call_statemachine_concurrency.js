/**
 * CLARITIY VOICE — BATCH B AUTOMATED TEST SUITE
 * Validates Call State Machine Integrity, Concurrency Caps, Stuck Call Reaper,
 * and Anti-Double-Dialing Single-Claim Semantics.
 */

const assert = require('assert');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { prisma } = require('../dist/lib/prisma');
const { CallStateMachine } = require('../dist/core/orchestrator/CallStateMachine');
const { CallRepository } = require('../dist/repositories/CallRepository');
const {
  countActiveCalls,
  countGlobalActiveCalls,
  reapStuckCalls,
  withUserCallLock,
  GLOBAL_TELEPHONY_CAP,
  MAX_ACTIVE_CALL_AGE_MS
} = require('../dist/utils/concurrency');

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
  console.log('🛡️  CLARITIY VOICE — CALL STATE MACHINE & CONCURRENCY AUDIT SUITE (BATCH B)');
  console.log('================================================================================\n');

  const testTenantId = `tenant_b_test_${Date.now()}`;
  const testAgentId = `agent_b_test_${Date.now()}`;

  // Seed baseline tenant & agent in Postgres
  await prisma.user.create({
    data: {
      id: testTenantId,
      email: `${testTenantId}@claritiy.test`,
      fullName: 'Batch B Concurrency Tester',
      passwordHash: 'hashed_password_fixture',
      accountType: 'trial',
      accountStatus: 'active',
      callingBalanceMinutes: 100,
      minutesRemainingSeconds: 6000,
      maxConcurrentCalls: 1
    }
  });

  await prisma.agent.create({
    data: {
      id: testAgentId,
      userId: testTenantId,
      name: 'Batch B Test Voice Agent',
      status: 'active',
      voiceName: 'Puck',
      agentConfig: JSON.stringify({ voice: 'Puck' })
    }
  });

  // ─── 1. CALL STATE MACHINE INTEGRITY (P0-1) ─────────────────────────────────────────
  console.log('--- 1. CALL STATE MACHINE INTEGRITY (P0-1) ---');

  await runAsyncTest('Valid forward transition chain succeeds (queued -> ringing -> connected -> in_progress -> completed)', async () => {
    const sm = new CallStateMachine('call_sm_1');
    assert.strictEqual(sm.getCurrentStatus(), 'queued');

    assert.strictEqual(sm.transitionTo('ringing'), true);
    assert.strictEqual(sm.getCurrentStatus(), 'ringing');

    assert.strictEqual(sm.transitionTo('connected'), true);
    assert.strictEqual(sm.getCurrentStatus(), 'connected');

    assert.strictEqual(sm.transitionTo('in_progress'), true);
    assert.strictEqual(sm.getCurrentStatus(), 'in_progress');

    assert.strictEqual(sm.transitionTo('completed'), true);
    assert.strictEqual(sm.getCurrentStatus(), 'completed');
  });

  await runAsyncTest('Direct transition from queued to in_progress succeeds for zero-latency telephony answers', async () => {
    const sm = new CallStateMachine('call_sm_direct');
    assert.strictEqual(sm.getCurrentStatus(), 'queued');
    assert.strictEqual(sm.transitionTo('in_progress'), true);
    assert.strictEqual(sm.getCurrentStatus(), 'in_progress');
  });

  await runAsyncTest('Invalid reverse transition from completed back to in_progress fails closed (returns false, status preserved)', async () => {
    const sm = new CallStateMachine('call_sm_terminal_revive');
    sm.transitionTo('in_progress');
    sm.transitionTo('completed');
    assert.strictEqual(sm.getCurrentStatus(), 'completed');

    const result = sm.transitionTo('in_progress');
    assert.strictEqual(result, false, 'Reviving a completed call must return false');
    assert.strictEqual(sm.getCurrentStatus(), 'completed', 'Current status must remain completed');
  });

  await runAsyncTest('All terminal states strictly forbid subsequent transitions', async () => {
    const terminalStates = ['completed', 'failed', 'no_answer', 'busy', 'cancelled', 'timeout'];

    for (const term of terminalStates) {
      const sm = new CallStateMachine(`call_term_${term}`, term);
      assert.strictEqual(sm.getCurrentStatus(), term);

      // Attempt invalid transition to ringing
      const attempted = sm.transitionTo('ringing');
      assert.strictEqual(attempted, false, `State ${term} must reject transition to ringing`);
      assert.strictEqual(sm.getCurrentStatus(), term, `State ${term} must remain unchanged`);
    }
  });

  await runAsyncTest('Constructor initialStatus properly sets starting state', async () => {
    const sm = new CallStateMachine('call_init_status', 'in_progress');
    assert.strictEqual(sm.getCurrentStatus(), 'in_progress');
    assert.strictEqual(sm.transitionTo('completed'), true);
    assert.strictEqual(sm.getCurrentStatus(), 'completed');
  });

  // ─── 2. CALL REPOSITORY OUT-OF-ORDER WEBHOOK DEFENSE (P0-1) ─────────────────────────
  console.log('\n--- 2. CALL REPOSITORY OUT-OF-ORDER WEBHOOK DEFENSE (P0-1) ---');

  const callDbTest = await CallRepository.create({
    agentId: testAgentId,
    userId: testTenantId,
    recipientPhoneNumber: '+919876543210',
    fromPhoneNumber: '+18005550199',
    maxDuration: 1800
  });

  await runAsyncTest('Call transition to terminal state (completed) populates endTime', async () => {
    const updated = await CallRepository.updateStatus(callDbTest.id, 'completed', { durationSeconds: 45 });
    assert.strictEqual(updated.status, 'completed');
    assert.ok(updated.endTime !== null, 'Terminal transition must set endTime');
    assert.strictEqual(updated.durationSeconds, 45);
  });

  await runAsyncTest('Delayed out-of-order webhook (ringing/connected) cannot overwrite terminal completed call', async () => {
    // Telephony delayed webhook arrives with status 'connected'
    const attempted = await CallRepository.updateStatus(callDbTest.id, 'connected');
    assert.strictEqual(attempted.status, 'completed', 'Call status must remain completed despite delayed webhook');

    const freshCall = await CallRepository.findById(callDbTest.id);
    assert.strictEqual(freshCall.status, 'completed', 'DB record must NOT be corrupted to connected');
  });

  // ─── 3. CONCURRENCY CONTROLS & MUTEX SERIALIZATION (P0-4) ────────────────────────────
  console.log('\n--- 3. CONCURRENCY CONTROLS & MUTEX SERIALIZATION (P0-4) ---');

  await runAsyncTest('countActiveCalls correctly counts active calls within freshness window', async () => {
    // Current active call count should be 0 since previous call is completed
    const initialActive = await countActiveCalls(testTenantId);
    assert.strictEqual(initialActive, 0);

    // Create an active call
    const activeCall = await CallRepository.create({
      agentId: testAgentId,
      userId: testTenantId,
      recipientPhoneNumber: '+919876543211',
      fromPhoneNumber: '+18005550199',
      maxDuration: 1800
    });
    await CallRepository.updateStatus(activeCall.id, 'in_progress', { startTime: new Date() });

    const activeCount = await countActiveCalls(testTenantId);
    assert.strictEqual(activeCount, 1, 'Active call count must be 1');

    // Clean up active call
    await CallRepository.updateStatus(activeCall.id, 'completed');
  });

  await runAsyncTest('withUserCallLock serializes concurrent burst requests per tenant', async () => {
    let activeExecutions = 0;
    let maxSimultaneous = 0;

    const runSimulatedCallCheck = async () => {
      return withUserCallLock(testTenantId, async () => {
        activeExecutions++;
        maxSimultaneous = Math.max(maxSimultaneous, activeExecutions);
        await new Promise((r) => setTimeout(r, 50));
        activeExecutions--;
      });
    };

    // Fire 5 concurrent requests simultaneously
    await Promise.all([
      runSimulatedCallCheck(),
      runSimulatedCallCheck(),
      runSimulatedCallCheck(),
      runSimulatedCallCheck(),
      runSimulatedCallCheck()
    ]);

    assert.strictEqual(maxSimultaneous, 1, 'withUserCallLock must strictly serialize execution (maxSimultaneous = 1)');
    assert.strictEqual(activeExecutions, 0);
  });

  await runAsyncTest('countGlobalActiveCalls accurately reflects platform-wide concurrency', async () => {
    const globalCount = await countGlobalActiveCalls();
    assert.strictEqual(typeof globalCount, 'number');
    assert.ok(globalCount >= 0);
    assert.ok(globalCount <= GLOBAL_TELEPHONY_CAP);
  });

  // ─── 4. STUCK CALL REAPER (P0-1 / P0-4) ───────────────────────────────────────────────
  console.log('\n--- 4. STUCK CALL REAPER (P0-1 / P0-4) ---');

  await runAsyncTest('reapStuckCalls marks orphaned calls (>1 hour) as timeout with endTime', async () => {
    // Create an artificial stuck call with createdAt 2 hours ago
    const stuckTimestamp = new Date(Date.now() - (MAX_ACTIVE_CALL_AGE_MS + 3600000));
    const stuckCall = await prisma.call.create({
      data: {
        agentId: testAgentId,
        userId: testTenantId,
        recipientPhoneNumber: '+919876543299',
        fromPhoneNumber: '+18005550199',
        status: 'in_progress',
        createdAt: stuckTimestamp
      }
    });

    const reapResult = await reapStuckCalls();
    assert.ok(reapResult.reapedCalls >= 1, 'At least 1 stuck call must be reaped');

    const reapedDbCall = await prisma.call.findUnique({ where: { id: stuckCall.id } });
    assert.strictEqual(reapedDbCall.status, 'timeout', 'Stuck call status must be updated to timeout');
    assert.ok(reapedDbCall.endTime !== null, 'Reaped call must have endTime populated');
  });

  // ─── 5. BATCH RECIPIENT SINGLE-CLAIM SEMANTICS (P0-1) ────────────────────────────────
  console.log('\n--- 5. BATCH RECIPIENT SINGLE-CLAIM SEMANTICS (P0-1) ---');

  await runAsyncTest('Atomic recipient claim prevents duplicate worker dispatch', async () => {
    const batch = await prisma.batch.create({
      data: {
        userId: testTenantId,
        agentId: testAgentId,
        name: 'Batch Concurrency Test Campaign',
        status: 'running',
        totalRecipients: 1
      }
    });

    const recipient = await prisma.batchRecipient.create({
      data: {
        batchId: batch.id,
        phoneNumber: '+919876543201',
        status: 'pending'
      }
    });

    // Worker 1 claims recipient
    const worker1Claim = await prisma.batchRecipient.updateMany({
      where: {
        id: recipient.id,
        status: { in: ['pending', 'failed'] }
      },
      data: {
        status: 'in_progress',
        lastAttemptAt: new Date()
      }
    });
    assert.strictEqual(worker1Claim.count, 1, 'First worker claim must succeed (count = 1)');

    // Worker 2 attempts simultaneous claim on same recipient
    const worker2Claim = await prisma.batchRecipient.updateMany({
      where: {
        id: recipient.id,
        status: { in: ['pending', 'failed'] }
      },
      data: {
        status: 'in_progress',
        lastAttemptAt: new Date()
      }
    });
    assert.strictEqual(worker2Claim.count, 0, 'Second worker claim must be rejected (count = 0)');

    // Cleanup batch fixtures
    await prisma.batchRecipient.deleteMany({ where: { batchId: batch.id } });
    await prisma.batch.delete({ where: { id: batch.id } });
  });

  // ─── CLEANUP TRANSIENT FIXTURES ──────────────────────────────────────────────────────
  console.log('\n--- CLEANUP FIXTURES ---');
  await runAsyncTest('Clean up test tenant records', async () => {
    await prisma.call.deleteMany({ where: { userId: testTenantId } }).catch(() => {});
    await prisma.agent.deleteMany({ where: { userId: testTenantId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: testTenantId } }).catch(() => {});
  });

  console.log('================================================================================');
  console.log(`🎉 CALL STATE MACHINE & CONCURRENCY SUITE: ${passedTests}/${totalTests} TESTS PASSED`);
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
