#!/usr/bin/env node
/**
 * Claritiy Voice — Graceful Shutdown & Drain State Machine Verification (Task T5)
 *
 * Verifies:
 *  1. Drain loop waits while active calls > 0
 *  2. Logs active call count and remaining seconds periodically
 *  3. Exits cleanly with drainedCleanly=true when active calls drop to 0
 *  4. Enforces upper bound timeout when active calls stay stuck
 */

const { drainActiveCalls } = require('../dist/utils/gracefulShutdown.js');

let failures = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failures++;
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

async function runDrainTests() {
  console.log('================================================================');
  console.log('TASK T5: GRACEFUL SHUTDOWN & DRAIN VERIFICATION');
  console.log('================================================================');

  // ── Test 1: Active Calls Drain Cleanly to 0 ──────────────────────────────
  console.log('\n--- Test 1: Active Calls Drain to 0 Within Deadline ---');
  let mockActiveCalls = 3;
  const logEvents = [];

  // Simulate calls finishing one by one
  const finishInterval = setInterval(() => {
    if (mockActiveCalls > 0) {
      mockActiveCalls--;
    }
  }, 40);

  const resultClean = await drainActiveCalls({
    timeoutSeconds: 30,
    checkIntervalMs: 25,
    getActiveCount: () => mockActiveCalls,
    onLog: (count, remSec) => {
      logEvents.push({ count, remSec });
    },
  });

  clearInterval(finishInterval);

  console.log(`  Drain completed. Log events recorded: ${logEvents.length}`);
  console.log(`  Result: drainedCleanly=${resultClean.drainedCleanly}, remainingCalls=${resultClean.remainingCalls}`);

  assert(resultClean.drainedCleanly === true, 'Drain must succeed cleanly when all calls finish');
  assert(resultClean.remainingCalls === 0, 'Remaining calls count must be 0');
  assert(logEvents.length > 0, 'Must record periodic drain logging events');
  assert(logEvents[0].count === 3, 'Initial log must report 3 active calls');

  // ── Test 2: Stuck Calls Exceed Timeout ───────────────────────────────────
  console.log('\n--- Test 2: Stuck Call Exceeds Drain Timeout ---');
  let stuckCalls = 2; // Never drops to 0

  const startTs = Date.now();
  const resultTimeout = await drainActiveCalls({
    timeoutSeconds: 30, // Minimum allowed
    checkIntervalMs: 15,
    getActiveCount: () => stuckCalls,
    onLog: () => {},
  });
  const elapsedMs = Date.now() - startTs;

  console.log(`  Timeout test elapsed: ${elapsedMs} ms, remainingCalls: ${resultTimeout.remainingCalls}`);
  assert(resultTimeout.drainedCleanly === false, 'Stuck calls must report drainedCleanly=false on timeout');
  assert(resultTimeout.remainingCalls === 2, 'Stuck calls count must be preserved for forced termination');

  console.log('\n================================================================');
  if (failures === 0) {
    console.log('🎉 ALL GRACEFUL SHUTDOWN TESTS PASSED WITH ZERO FAILURES');
    console.log('================================================================\n');
    process.exit(0);
  } else {
    console.error(`💥 ${failures} GRACEFUL SHUTDOWN TEST(S) FAILED`);
    console.log('================================================================\n');
    process.exit(1);
  }
}

runDrainTests().catch((err) => {
  console.error('Fatal drain test error:', err);
  process.exit(1);
});
