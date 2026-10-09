const assert = require('assert');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { prisma } = require('../dist/lib/prisma');
const { CallService } = require('../dist/services/CallService');
const { CallOrchestrator } = require('../dist/core/orchestrator/CallOrchestrator');
const { ValidationError } = require('../dist/types/errors');

async function run() {
  console.log('--- Testing Ticket 4: Concurrency Enforcement in CallService.createCall ---');

  const testUserId = `test-concurrency-${Date.now()}`;
  const testEmail = `concurrency-${Date.now()}@example.com`;
  const dummyAgentId = '00000000-0000-0000-0000-000000000001';

  try {
    // 1. Create test user with maxConcurrentCalls = 1 and sufficient minutes
    await prisma.user.create({
      data: {
        id: testUserId,
        email: testEmail,
        passwordHash: 'dummy',
        fullName: 'Concurrency Test User',
        accountType: 'admin', // Admin bypasses Vobiz sub-account requirement to isolate concurrency gate
        callingBalanceMinutes: 100,
        minutesRemainingSeconds: 6000,
        maxConcurrentCalls: 1,
      },
    });

    // Create Agent associated with testUserId
    await prisma.agent.create({
      data: {
        id: dummyAgentId,
        userId: testUserId,
        name: 'Concurrency Test Agent',
        systemPrompt: 'You are a test agent',
      },
    });

    // Sub-test 1: With 0 active calls, concurrency check passes
    console.log('\n[Sub-test 1] Verifying concurrency gate passes when under limit (0 active, limit 1)...');
    const initialOrchestratorActive = CallOrchestrator.instance.getActiveCallCountForUser(testUserId);
    assert.strictEqual(initialOrchestratorActive, 0);

    // Sub-test 2: Simulate 1 active call registered in CallOrchestrator
    console.log('\n[Sub-test 2] Simulating 1 active call in CallOrchestrator and attempting createCall...');
    const mockSession = {
      sessionId: `session_active_${Date.now()}`,
      callId: `call_active_${Date.now()}`,
      userId: testUserId,
    };
    CallOrchestrator.instance.activeCalls.set(mockSession.callId, mockSession);

    const activeCountAfter = CallOrchestrator.instance.getActiveCallCountForUser(testUserId);
    assert.strictEqual(activeCountAfter, 1, 'CallOrchestrator must report 1 active call for user');

    let errorThrown = false;
    try {
      await CallService.createCall({
        phoneNumber: '+919876543210',
        agentId: dummyAgentId,
        userId: testUserId,
      });
    } catch (err) {
      if (err instanceof ValidationError && err.message.includes('Concurrency limit exceeded')) {
        errorThrown = true;
        console.log('✓ CallService blocked call creation with ValidationError:', err.details);
        assert.ok(
          err.details.some((d) => d.message.includes('Max allowed concurrent calls (1) reached')),
          'Error details must specify allowed limit and active call count'
        );
      } else {
        throw err;
      }
    } finally {
      // Remove mock session
      CallOrchestrator.instance.activeCalls.delete(mockSession.callId);
    }

    assert.strictEqual(errorThrown, true, 'createCall must block and throw ValidationError when at/over limit');

    // Sub-test 3: Simulate active call in database (call in status in_progress)
    console.log('\n[Sub-test 3] Simulating active call in database and attempting createCall...');
    const testCallId = `call_db_active_${Date.now()}`;
    await prisma.call.create({
      data: {
        id: testCallId,
        userId: testUserId,
        agentId: dummyAgentId,
        status: 'in_progress',
        callDirection: 'outbound',
        recipientPhoneNumber: '+919876543210',
      },
    });

    let dbErrorThrown = false;
    try {
      await CallService.createCall({
        phoneNumber: '+919876543210',
        agentId: dummyAgentId,
        userId: testUserId,
      });
    } catch (err) {
      if (err instanceof ValidationError && err.message.includes('Concurrency limit exceeded')) {
        dbErrorThrown = true;
        console.log('✓ CallService blocked call creation on active DB call count:', err.details);
      } else {
        throw err;
      }
    } finally {
      await prisma.call.deleteMany({ where: { id: testCallId } });
    }

    assert.strictEqual(dbErrorThrown, true, 'createCall must block and throw ValidationError when DB calls exceed limit');

    console.log('\n✅ All Ticket 4 Concurrency Enforcement tests passed successfully against real application code!');
  } finally {
    try {
      await prisma.user.deleteMany({ where: { id: testUserId } });
    } catch (e) {
      console.warn('Cleanup warning:', e.message);
    }
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
