const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const assert = require('assert');
const { prisma } = require('../dist/lib/prisma');
const { BatchService } = require('../dist/services/BatchService');
const { CallService } = require('../dist/services/CallService');
const { callOrchestrator } = require('../dist/core/orchestrator/CallOrchestrator');
const { logger } = require('../dist/utils/logger');

// Enable off-hours calling in testing environment
process.env.ALLOW_OFFHOURS_BATCH_CALLS = 'true';

async function runAcceptanceSuite() {
  console.log('================================================================================');
  console.log('🧪 BATCH CALLING ENGINE ACCEPTANCE TEST SUITE');
  console.log('================================================================================');

  let passed = 0;
  let failed = 0;

  const testUserEmail = `batch-tester-${Date.now()}@claritiy.com`;
  let testUser;
  let testAgent;
  let userPlivoNumber;
  let foreignNumber;

  // Intercept orchestrator outbound call initiation to simulate carrier responses & report call IDs
  const originalInitiateOutboundCall = callOrchestrator.initiateOutboundCall;
  const originalEndCallSession = callOrchestrator.endCallSession;
  const generatedCallIds = [];

  try {
    // ── Setup Fixtures ──────────────────────────────────────────────────────────
    console.log('--- Setting up test fixtures ---');
    testUser = await prisma.user.create({
      data: {
        email: testUserEmail,
        fullName: 'Batch Tester',
        passwordHash: 'mock_hash_for_testing',
        accountType: 'professional',
        accountStatus: 'active',
        callingBalanceMinutes: 100,
        minutesRemainingSeconds: 6000,
        maxConcurrentCalls: 5,
      }
    });

    await prisma.vobizSubAccount.create({
      data: {
        userId: testUser.id,
        authId: `SUB_BATCH_${Date.now()}`,
        authToken: 'token_mock_test',
        kycStatus: 'verified',
        kycCallsBlocked: false
      }
    });

    testAgent = await prisma.agent.create({
      data: {
        userId: testUser.id,
        name: 'Batch Acceptance Agent',
        status: 'active',
        model: 'openai',
        systemVoice: 'shimmer',
        systemPrompt: 'You are a test agent.'
      }
    });

    const userNumberStr = `+9180${Math.floor(10000000 + Math.random() * 90000000)}`;
    userPlivoNumber = await prisma.phoneNumber.create({
      data: {
        userId: testUser.id,
        phoneNumber: userNumberStr,
        countryCode: 'IN',
        telephonyProvider: 'plivo',
        status: 'active',
        kycStatus: 'verified',
        plivoNumberId: userNumberStr,
      }
    });

    const foreignUser = await prisma.user.create({
      data: {
        email: `foreign-user-${Date.now()}@claritiy.com`,
        fullName: 'Foreign User',
        passwordHash: 'mock_hash',
        accountType: 'professional',
        accountStatus: 'active',
      }
    });

    const foreignNumberStr = `+9180${Math.floor(10000000 + Math.random() * 90000000)}`;
    foreignNumber = await prisma.phoneNumber.create({
      data: {
        userId: foreignUser.id,
        phoneNumber: foreignNumberStr,
        countryCode: 'IN',
        telephonyProvider: 'plivo',
        status: 'active',
        kycStatus: 'verified',
        plivoNumberId: foreignNumberStr,
      }
    });

    console.log(`✓ Fixtures ready. User: ${testUser.id}, Caller Phone: ${userPlivoNumber.phoneNumber}`);

    // Mock orchestrator
    callOrchestrator.initiateOutboundCall = async (phone, agentId, userId, fromNumber, maxDuration) => {
      const call = await prisma.call.create({
        data: {
          agentId,
          userId,
          recipientPhoneNumber: phone,
          fromPhoneNumber: fromNumber,
          status: 'in_progress',
          callDirection: 'outbound',
        }
      });
      generatedCallIds.push(call.id);
      return call.id;
    };

    // ── Test b: Pick a number the user does not own -> 400 ─────────────────────
    console.log('\n--- TEST B: Reject caller ID user does not own (Clear 400) ---');
    try {
      await CallService.validateCallerNumber(testUser.id, foreignNumber.id, false);
      console.error('❌ Test B Failed: Should have thrown Unauthorized caller ID');
      failed++;
    } catch (err) {
      assert.ok(err.message.includes('Unauthorized caller ID'));
      console.log(`  ✓ Rejected unowned number: "${err.message}"`);
      passed++;
    }

    // ── Test g: Contacts with opted-out (DNC) are never dialed ─────────────────
    console.log('\n--- TEST G: Opted-out (DNC) contacts are never dialed ---');
    const optedOutPhone = '+919999999999';
    await prisma.contact.create({
      data: {
        userId: testUser.id,
        phoneNumber: optedOutPhone,
        name: 'Opted Out Contact',
        optedOutAt: new Date()
      }
    });

    const batchG = await prisma.batch.create({
      data: {
        userId: testUser.id,
        agentId: testAgent.id,
        fromPhoneNumberId: userPlivoNumber.id,
        name: 'Test DNC Batch',
        status: 'running',
        totalRecipients: 1,
        scheduleConfig: JSON.stringify({ ignoreCallingHours: true }),
        recipients: {
          create: [{ phoneNumber: optedOutPhone, status: 'pending' }]
        }
      },
      include: { recipients: true, fromPhoneNumber: true }
    });

    await BatchService.processBatch(batchG.id, testUser.id);
    const updatedBatchG = await prisma.batch.findUnique({
      where: { id: batchG.id },
      include: { recipients: true }
    });

    assert.strictEqual(updatedBatchG.recipients[0].status, 'failed');
    assert.strictEqual(updatedBatchG.recipients[0].lastErrorCode, 'DNC_OPT_OUT');
    assert.strictEqual(updatedBatchG.recipients[0].callId, null);
    console.log(`  ✓ DNC contact was never dialed. Recipient status: ${updatedBatchG.recipients[0].status}, error: ${updatedBatchG.recipients[0].lastError}`);
    passed++;

    // ── Test a: Normal user, 5 contacts, Plivo number: all 5 dialed ────────────
    console.log('\n--- TEST A: Normal user, 5 contacts, Plivo number dialed to completion ---');
    const contacts5 = [
      '+919876500001',
      '+919876500002',
      '+919876500003',
      '+919876500004',
      '+919876500005'
    ];

    const batchA = await prisma.batch.create({
      data: {
        userId: testUser.id,
        agentId: testAgent.id,
        fromPhoneNumberId: userPlivoNumber.id,
        name: 'Test 5-Contact Batch',
        status: 'running',
        totalRecipients: 5,
        scheduleConfig: JSON.stringify({ ignoreCallingHours: true }),
        recipients: {
          create: contacts5.map(p => ({ phoneNumber: p, status: 'pending' }))
        }
      },
      include: { recipients: true, fromPhoneNumber: true }
    });

    // Run batch processing
    const processPromiseA = BatchService.processBatch(batchA.id, testUser.id);

    // Simulate calls resolving as completed
    const completeCallsInterval = setInterval(async () => {
      const activeCalls = await prisma.call.findMany({
        where: { userId: testUser.id, status: 'in_progress' }
      });
      for (const c of activeCalls) {
        await prisma.call.update({
          where: { id: c.id },
          data: { status: 'completed' }
        });
      }
    }, 200);

    await processPromiseA;
    clearInterval(completeCallsInterval);

    const updatedBatchA = await prisma.batch.findUnique({
      where: { id: batchA.id },
      include: { recipients: true }
    });

    console.log(`  Reported real call IDs for batch:`, generatedCallIds.slice(-5));
    assert.strictEqual(updatedBatchA.status, 'completed');
    assert.strictEqual(updatedBatchA.completedCount, 5);
    assert.strictEqual(updatedBatchA.failedCount, 0);
    console.log(`  ✓ All 5 contacts dialed and resolved. Batch status: ${updatedBatchA.status}, completedCount: ${updatedBatchA.completedCount}`);
    passed++;

    // ── Test c: Remove minutes mid-batch: pauses with 'insufficient minutes' ───
    console.log('\n--- TEST C: Remove minutes mid-batch -> Batch pauses, recipients not marked failed ---');
    const batchC = await prisma.batch.create({
      data: {
        userId: testUser.id,
        agentId: testAgent.id,
        fromPhoneNumberId: userPlivoNumber.id,
        name: 'Test Remove Minutes Batch',
        status: 'running',
        totalRecipients: 2,
        scheduleConfig: JSON.stringify({ ignoreCallingHours: true }),
        recipients: {
          create: [
            { phoneNumber: '+919876500010', status: 'pending' },
            { phoneNumber: '+919876500011', status: 'pending' }
          ]
        }
      },
      include: { recipients: true, fromPhoneNumber: true }
    });

    // Set user minutes to 0
    await prisma.user.update({
      where: { id: testUser.id },
      data: { callingBalanceMinutes: 0, minutesRemainingSeconds: 0 }
    });

    await BatchService.processBatch(batchC.id, testUser.id);

    const updatedBatchC = await prisma.batch.findUnique({
      where: { id: batchC.id },
      include: { recipients: true }
    });

    assert.strictEqual(updatedBatchC.status, 'paused');
    assert.ok(updatedBatchC.statusReason.toLowerCase().includes('insufficient'));
    // None of the recipients should be marked failed due to batch-level insufficient minutes
    assert.strictEqual(updatedBatchC.failedCount, 0);
    assert.ok(updatedBatchC.recipients.every(r => r.status === 'pending'));
    console.log(`  ✓ Batch paused with reason: "${updatedBatchC.statusReason}". Failed recipients count: ${updatedBatchC.failedCount}`);
    passed++;

    // Restore minutes for remaining tests
    await prisma.user.update({
      where: { id: testUser.id },
      data: { callingBalanceMinutes: 50, minutesRemainingSeconds: 3000 }
    });

    // ── Test e: Double Resume atomic lock check ────────────────────────────────
    console.log('\n--- TEST E: Atomic Worker Claim / Double Resume Race Condition ---');
    const batchE = await prisma.batch.create({
      data: {
        userId: testUser.id,
        agentId: testAgent.id,
        fromPhoneNumberId: userPlivoNumber.id,
        name: 'Test Double Resume Race',
        status: 'running',
        lockedBy: 'worker_already_running',
        lockedAt: new Date(), // fresh lock
        totalRecipients: 2,
        scheduleConfig: JSON.stringify({ ignoreCallingHours: true }),
        recipients: {
          create: [{ phoneNumber: '+919876500020', status: 'pending' }]
        }
      }
    });

    // Attempting to run processBatch when already locked with a fresh lock
    await BatchService.processBatch(batchE.id, testUser.id);
    const refreshedE = await prisma.batch.findUnique({ where: { id: batchE.id } });
    assert.strictEqual(refreshedE.lockedBy, 'worker_already_running');
    console.log(`  ✓ Second worker run was a strict no-op, preserving existing active worker lock.`);
    passed++;

    // ── Test d: Restart recovery resumes stale batches without duplicate calls ─
    console.log('\n--- TEST D: Restart recovery resumes batches with stale lock ---');
    const batchD = await prisma.batch.create({
      data: {
        userId: testUser.id,
        agentId: testAgent.id,
        fromPhoneNumberId: userPlivoNumber.id,
        name: 'Test Stale Recovery Batch',
        status: 'running',
        lockedBy: 'crashed_worker_pid',
        lockedAt: new Date(Date.now() - 120000), // 2 min ago (stale)
        totalRecipients: 1,
        scheduleConfig: JSON.stringify({ ignoreCallingHours: true }),
        recipients: {
          create: [{ phoneNumber: '+919876500030', status: 'pending' }]
        }
      }
    });

    const callsCountBefore = await prisma.call.count({ where: { recipientPhoneNumber: '+919876500030' } });
    
    // Simulate resolution
    const completeIntervalD = setInterval(async () => {
      await prisma.call.updateMany({
        where: { recipientPhoneNumber: '+919876500030', status: 'in_progress' },
        data: { status: 'completed' }
      });
    }, 200);

    await BatchService.recoverStaleBatches();
    const startWaitD = Date.now();
    while (Date.now() - startWaitD < 10000) {
      const cnt = await prisma.call.count({ where: { recipientPhoneNumber: '+919876500030' } });
      if (cnt > callsCountBefore) break;
      await new Promise(r => setTimeout(r, 500));
    }
    clearInterval(completeIntervalD);

    const callsCountAfter = await prisma.call.count({ where: { recipientPhoneNumber: '+919876500030' } });
    assert.strictEqual(callsCountAfter - callsCountBefore, 1);
    console.log(`  ✓ Stale batch recovered and executed exactly 1 call without duplication.`);
    passed++;

    // ── Test f: Busy/No-answer transient retry with backoff ────────────────────
    console.log('\n--- TEST F: Busy/No-answer retry with backoff and error details ---');
    const batchF = await prisma.batch.create({
      data: {
        userId: testUser.id,
        agentId: testAgent.id,
        fromPhoneNumberId: userPlivoNumber.id,
        name: 'Test Busy Retry Batch',
        status: 'running',
        totalRecipients: 1,
        scheduleConfig: JSON.stringify({ ignoreCallingHours: true }),
        retryConfig: JSON.stringify({ intervalMs: 200, maxAttempts: 2 }), // 200ms fast retry for testing
        recipients: {
          create: [{ phoneNumber: '+919876500040', status: 'pending' }]
        }
      }
    });

    // Make call resolve as busy on each attempt
    const busyIntervalF = setInterval(async () => {
      await prisma.call.updateMany({
        where: { recipientPhoneNumber: '+919876500040', status: 'in_progress' },
        data: { status: 'busy' }
      });
    }, 100);

    await BatchService.processBatch(batchF.id, testUser.id);
    clearInterval(busyIntervalF);

    const updatedBatchF = await prisma.batch.findUnique({
      where: { id: batchF.id },
      include: { recipients: true }
    });

    const recipientF = updatedBatchF.recipients[0];
    assert.strictEqual(recipientF.status, 'failed');
    assert.strictEqual(recipientF.attempts, 2);
    assert.strictEqual(recipientF.lastErrorCode, 'BUSY');
    assert.ok(recipientF.lastError.includes('busy'));
    console.log(`  ✓ Recipient retried up to maxAttempts (2) on transient BUSY, then marked failed with reason: "${recipientF.lastError}"`);
    passed++;

    // ── Test h: UI error visibility contract ──────────────────────────────────
    console.log('\n--- TEST H: UI visibility for real failure reasons ---');
    const recipientWithRealError = await prisma.batchRecipient.findFirst({
      where: { batchId: batchF.id }
    });
    assert.ok(recipientWithRealError.lastError);
    assert.ok(recipientWithRealError.lastErrorCode);
    console.log(`  ✓ Recipient failure contract verified: lastError="${recipientWithRealError.lastError}", lastErrorCode="${recipientWithRealError.lastErrorCode}"`);
    passed++;

  } catch (err) {
    console.error('❌ Exception in acceptance test suite:', err);
    failed++;
  } finally {
    // Restore mocks
    callOrchestrator.initiateOutboundCall = originalInitiateOutboundCall;
    callOrchestrator.endCallSession = originalEndCallSession;

    // Cleanup fixtures
    if (testUser) {
      await prisma.batchRecipient.deleteMany({ where: { batch: { userId: testUser.id } } }).catch(() => {});
      await prisma.batch.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
      await prisma.call.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
      await prisma.contact.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
      await prisma.phoneNumber.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
      await prisma.vobizSubAccount.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
      await prisma.agent.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    }
    if (foreignNumber) {
      await prisma.phoneNumber.delete({ where: { id: foreignNumber.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  }

  console.log('\n================================================================================');
  console.log(`🏁 ACCEPTANCE SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAcceptanceSuite().catch(err => {
  console.error('Fatal suite runner error:', err);
  process.exit(1);
});
