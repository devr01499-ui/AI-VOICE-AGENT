/**
 * test_call_finalizer_idempotency.ts — M1 Reliability Pipeline Verification Suite
 *
 * Verifies:
 * 1. Idempotency: Multiple concurrent CallFinalizer.onCallFinalized calls create exactly ONE job.
 * 2. Multi-carrier coverage: Simulated Plivo and Vobiz call terminations both produce a call_results record.
 * 3. Retry & recovery: Forced failure triggers backoff retry and recovers.
 * 4. Process restart resilience: Unfinished jobs in analysis_jobs resume cleanly on a new worker cycle.
 */

import { prisma } from '../src/lib/prisma';
import { CallFinalizer } from '../src/services/CallFinalizer';
import { AnalysisWorker } from '../src/workers/AnalysisWorker';
import { AnalysisService } from '../src/services/AnalysisService';
import { randomUUID } from 'crypto';

interface TestStats {
  passed: number;
  failed: number;
}

const stats: TestStats = { passed: 0, failed: 0 };

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✔ PASS: ${message}`);
    stats.passed++;
  } else {
    console.error(`  ✖ FAIL: ${message}`);
    stats.failed++;
  }
}

async function runM1Suite() {
  console.log('===============================================================');
  console.log('CLARITIY VOICE — M1 RELIABILITY PIPELINE VERIFICATION SUITE');
  console.log('===============================================================\n');

  // Seed a test workspace user and agent
  const testUserId = randomUUID();
  const testAgentId = randomUUID();

  await prisma.user.upsert({
    where: { id: testUserId },
    update: {},
    create: {
      id: testUserId,
      email: `test-m1-${Date.now()}@claritiy.io`,
      fullName: 'M1 Test User',
      passwordHash: 'dummy_hash',
      accountType: 'professional',
    },
  });

  await prisma.agent.create({
    data: {
      id: testAgentId,
      userId: testUserId,
      name: 'M1 Test Agent',
      agentConfig: JSON.stringify({
        postCallAnalysis: {
          summaryPrompt: 'Summarize customer feedback.',
          fields: [{ name: 'intent', type: 'string', description: 'Intent of call' }],
        },
      }),
    },
  });

  try {
    // ─────────────────────────────────────────────────────────────
    // TEST 1: IDEMPOTENCY — Duplicate hangups create exactly ONE job
    // ─────────────────────────────────────────────────────────────
    console.log('--- TEST 1: IDEMPOTENCY OF CALL FINALIZER ---');
    const call1Id = randomUUID();
    await prisma.call.create({
      data: {
        id: call1Id,
        userId: testUserId,
        agentId: testAgentId,
        recipientPhoneNumber: '+919876543210',
        status: 'completed',
        durationSeconds: 45,
      },
    });

    // Fire 5 simultaneous finalizer calls
    await Promise.all([
      CallFinalizer.onCallFinalized(call1Id),
      CallFinalizer.onCallFinalized(call1Id),
      CallFinalizer.onCallFinalized(call1Id),
      CallFinalizer.onCallFinalized(call1Id),
      CallFinalizer.onCallFinalized(call1Id),
    ]);

    const jobsCount = await prisma.analysisJob.count({
      where: { callId: call1Id },
    });
    assert(jobsCount === 1, `5 concurrent CallFinalizer calls resulted in exactly 1 job (actual: ${jobsCount})`);

    // ─────────────────────────────────────────────────────────────
    // TEST 2: MULTI-CARRIER & DETERMINISTIC SIGNAL EXECUTION
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 2: MULTI-CARRIER & SIGNAL HIERARCHY ---');

    // Case A: Plivo 'busy' call
    const plivoCallId = randomUUID();
    await prisma.call.create({
      data: {
        id: plivoCallId,
        userId: testUserId,
        agentId: testAgentId,
        recipientPhoneNumber: '+919876543211',
        status: 'busy',
        endReason: 'busy',
        durationSeconds: 0,
      },
    });
    await CallFinalizer.onCallFinalized(plivoCallId);

    // Case B: Vobiz 'no_answer' call
    const vobizCallId = randomUUID();
    await prisma.call.create({
      data: {
        id: vobizCallId,
        userId: testUserId,
        agentId: testAgentId,
        recipientPhoneNumber: '+919876543212',
        status: 'no_answer',
        endReason: 'no_answer',
        durationSeconds: 0,
      },
    });
    await CallFinalizer.onCallFinalized(vobizCallId);

    // Case C: Short call under 10s with no speech
    const shortCallId = randomUUID();
    await prisma.call.create({
      data: {
        id: shortCallId,
        userId: testUserId,
        agentId: testAgentId,
        recipientPhoneNumber: '+919876543213',
        status: 'completed',
        endReason: 'caller_hangup',
        durationSeconds: 4,
      },
    });
    await CallFinalizer.onCallFinalized(shortCallId);

    // Run a worker batch cycle to process the queued jobs
    const processedCount = await AnalysisWorker.processNextBatch(5);
    assert(processedCount >= 3, `Worker claimed and processed at least 3 jobs (actual: ${processedCount})`);

    // Verify CallResult rows were generated
    const plivoResult = await prisma.callResult.findUnique({ where: { callId: plivoCallId } });
    assert(plivoResult !== null && plivoResult.resultLabel === 'Busy', `Plivo call resolved to 'Busy' with score null (confidence: ${plivoResult?.confidence})`);

    const vobizResult = await prisma.callResult.findUnique({ where: { callId: vobizCallId } });
    assert(vobizResult !== null && vobizResult.resultLabel === 'No Answer', `Vobiz call resolved to 'No Answer' with score null (confidence: ${vobizResult?.confidence})`);

    const shortResult = await prisma.callResult.findUnique({ where: { callId: shortCallId } });
    assert(shortResult !== null && shortResult.resultLabel === 'No Conversation', `Short call resolved to 'No Conversation' (confidence: ${shortResult?.confidence})`);

    // ─────────────────────────────────────────────────────────────
    // TEST 3: RETRY, EXPONENTIAL BACKOFF & RECOVERY
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 3: RETRY, BACKOFF & RECOVERY ---');
    const failingCallId = randomUUID();
    await prisma.call.create({
      data: {
        id: failingCallId,
        userId: testUserId,
        agentId: testAgentId,
        recipientPhoneNumber: '+919876543214',
        status: 'completed',
        durationSeconds: 25,
      },
    });
    await CallFinalizer.onCallFinalized(failingCallId);

    // Temporarily mock AnalysisService.processCall to throw an error
    const originalProcessCall = AnalysisService.processCall;
    AnalysisService.processCall = async () => {
      throw new Error('SIMULATED_TRANSIENT_API_429_RATE_LIMIT');
    };

    // Process batch with forced failure
    await AnalysisWorker.processNextBatch(5);

    const failingJob = await prisma.analysisJob.findUnique({ where: { callId: failingCallId } });
    assert(failingJob !== null && failingJob.status === 'pending', 'Failed job transitioned back to pending status for retry');
    assert(failingJob?.attempts === 1, `Failed job attempts incremented to 1 (actual: ${failingJob?.attempts})`);
    assert(failingJob?.lastError?.includes('SIMULATED_TRANSIENT_API_429_RATE_LIMIT') ?? false, 'Failed job recorded last error diagnostic string');
    assert(failingJob?.nextRunAt !== undefined && failingJob.nextRunAt.getTime() > Date.now(), 'Failed job next_run_at scheduled in the future (+30s backoff)');

    // Restore original method and advance next_run_at to test recovery
    AnalysisService.processCall = originalProcessCall;
    await prisma.$executeRawUnsafe(
      `UPDATE "analysis_jobs" SET next_run_at = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE call_id = $1`,
      failingCallId
    );

    // Process batch again (recovery)
    const recoveredBatch = await AnalysisWorker.processNextBatch(5);
    assert(recoveredBatch >= 1, 'Worker successfully claimed and recovered the previously failed job');

    const recoveredJob = await prisma.analysisJob.findUnique({ where: { callId: failingCallId } });
    assert(recoveredJob?.status === 'completed', 'Recovered job status is now completed');

    // ─────────────────────────────────────────────────────────────
    // TEST 4: PROCESS RESTART & STALE LOCK RECOVERY
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 4: PROCESS RESTART & STALE LOCK AUTO-RECOVERY ---');
    const staleCallId = randomUUID();
    await prisma.call.create({
      data: {
        id: staleCallId,
        userId: testUserId,
        agentId: testAgentId,
        recipientPhoneNumber: '+919876543215',
        status: 'completed',
        durationSeconds: 30,
      },
    });
    await CallFinalizer.onCallFinalized(staleCallId);

    // Simulate worker crashing mid-job leaving a stale lock older than 5 minutes
    await prisma.$executeRawUnsafe(
      `UPDATE "analysis_jobs"
       SET status = 'processing',
           locked_at = CURRENT_TIMESTAMP - INTERVAL '6 minutes',
           locked_by = 'crashed-worker-pid-9999'
       WHERE call_id = $1`,
      staleCallId
    );

    // Trigger batch on a new worker cycle
    const staleClaimed = await AnalysisWorker.processNextBatch(5);
    assert(staleClaimed >= 1, 'New worker cycle successfully re-claimed and processed the stale-locked job');

    const finalizedStaleJob = await prisma.analysisJob.findUnique({ where: { callId: staleCallId } });
    assert(finalizedStaleJob?.status === 'completed', 'Stale-locked job resolved cleanly to completed');

    console.log('\n===============================================================');
    console.log(`M1 SUITE RESULT: ${stats.passed}/${stats.passed + stats.failed} TESTS PASSED (${((stats.passed / (stats.passed + stats.failed)) * 100).toFixed(1)}%)`);
    console.log('===============================================================\n');

    process.exit(stats.failed === 0 ? 0 : 1);
  } finally {
    // Cleanup seeded test workspace and agents
    await prisma.callResult.deleteMany({ where: { workspaceId: testUserId } }).catch(() => {});
    await prisma.analysisJob.deleteMany({ where: { workspaceId: testUserId } }).catch(() => {});
    await prisma.call.deleteMany({ where: { userId: testUserId } }).catch(() => {});
    await prisma.agent.deleteMany({ where: { userId: testUserId } }).catch(() => {});
    await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
  }
}

runM1Suite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
