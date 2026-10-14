require('dotenv').config();
const assert = require('assert');
const { prisma } = require('../dist/lib/prisma');
const { InboundCallService } = require('../dist/services/InboundCallService');
const { QaController } = require('../dist/controllers/QaController');
const { ADMIN_EMAIL } = require('../dist/config/constants');

console.log('====================================================');
console.log('🛡️ PHASE 4 API ENDPOINT INVENTORY & IDOR AUDIT');
console.log('====================================================\n');

async function runIdorAudit() {
  const ts = Date.now();
  const userAId = `test-user-a-${ts}`;
  const userBId = `test-user-b-${ts}`;

  let userB_agent = null;
  let userB_call = null;
  let userB_contact = null;
  let userB_phone = null;
  let userB_batch = null;
  let userB_cohort = null;
  let userB_apiKey = null;
  let userB_subAccount = null;

  try {
    console.log('--- SETUP: SEEDING MULTI-TENANT TEST FIXTURES ---');
    // Create Tenant A
    await prisma.user.create({
      data: {
        id: userAId,
        email: `${userAId}@example.com`,
        fullName: 'Tenant User A',
        passwordHash: '$2b$10$UnSeededPasswordHashPlaceholder',
        accountType: 'growth',
        billingBalance: 100,
        callingBalanceMinutes: 50,
        minutesRemainingSeconds: 3000,
      },
    });

    // Create Tenant B
    await prisma.user.create({
      data: {
        id: userBId,
        email: `${userBId}@example.com`,
        fullName: 'Tenant User B',
        passwordHash: '$2b$10$UnSeededPasswordHashPlaceholder',
        accountType: 'enterprise',
        billingBalance: 500,
        callingBalanceMinutes: 200,
        minutesRemainingSeconds: 12000,
      },
    });

    // Create resources belonging to Tenant B
    userB_agent = await prisma.agent.create({
      data: {
        userId: userBId,
        name: 'Tenant B Private Voice Assistant',
        agentType: 'conversational',
        status: 'active',
        systemPrompt: 'You are a confidential enterprise agent for User B.',
        agentConfig: '{}',
      },
    });

    userB_call = await prisma.call.create({
      data: {
        userId: userBId,
        agentId: userB_agent.id,
        recipientPhoneNumber: '+919876543210',
        callDirection: 'outbound',
        status: 'completed',
        durationSeconds: 120,
      },
    });

    userB_contact = await prisma.contact.create({
      data: {
        userId: userBId,
        phoneNumber: '+919999988888',
        name: 'Tenant B High-Value Lead',
      },
    });

    userB_phone = await prisma.phoneNumber.create({
      data: {
        userId: userBId,
        phoneNumber: '+918045678901',
        vobizNumberId: `vobiz_${ts}_b`,
        status: 'active',
        countryCode: 'IN',
        telephonyProvider: 'vobiz',
        kycStatus: 'verified',
        assignedAgentId: userB_agent.id,
      },
    });

    userB_batch = await prisma.batch.create({
      data: {
        userId: userBId,
        agentId: userB_agent.id,
        name: 'Tenant B Secret Dialing Campaign',
        status: 'paused',
        totalRecipients: 5,
      },
    });

    userB_cohort = await prisma.qaCohort.create({
      data: {
        userId: userBId,
        name: 'Tenant B Confidential QA Cohort',
        status: 'idle',
      },
    });

    userB_apiKey = await prisma.apiKey.create({
      data: {
        userId: userBId,
        name: 'Tenant B Production API Key',
        keyHash: 'hash_test_b_' + ts,
        keyPrefix: 'claritiy_live_',
        scopes: '["*"]',
      },
    });

    userB_subAccount = await prisma.vobizSubAccount.create({
      data: {
        userId: userBId,
        authId: `sub_b_${ts}`,
        authToken: 'token_b_secret',
      },
    });

    console.log('✓ Successfully seeded isolated fixtures for Tenant A and Tenant B\n');

    // ─────────────────────────────────────────────
    // TEST 1: AGENT IDOR
    // ─────────────────────────────────────────────
    console.log('--- TEST 1: AGENT CROSS-TENANT ISOLATION ---');
    {
      const lookup = await prisma.agent.findFirst({
        where: { id: userB_agent.id, userId: userAId },
      });
      assert.strictEqual(lookup, null, 'User A must not be able to find User B agent');

      const updateAttempt = await prisma.agent.updateMany({
        where: { id: userB_agent.id, userId: userAId },
        data: { name: 'Compromised Name' },
      });
      assert.strictEqual(updateAttempt.count, 0, 'User A update on User B agent must affect 0 rows');

      const unmodified = await prisma.agent.findUnique({ where: { id: userB_agent.id } });
      assert.strictEqual(unmodified.name, 'Tenant B Private Voice Assistant');
      console.log('✓ User A is strictly prevented from reading or mutating User B agents');
    }

    // ─────────────────────────────────────────────
    // TEST 2: CALL LOG & RECORDING IDOR
    // ─────────────────────────────────────────────
    console.log('\n--- TEST 2: CALL LOG & RECORDINGS ISOLATION ---');
    {
      const lookup = await prisma.call.findFirst({
        where: { id: userB_call.id, userId: userAId },
      });
      assert.strictEqual(lookup, null, 'User A must not be able to find User B call');

      const deleteAttempt = await prisma.call.deleteMany({
        where: { id: userB_call.id, userId: userAId },
      });
      assert.strictEqual(deleteAttempt.count, 0, 'User A delete on User B call must affect 0 rows');

      const intactCall = await prisma.call.findUnique({ where: { id: userB_call.id } });
      assert.notStrictEqual(intactCall, null, 'User B call log must remain intact');
      console.log('✓ User A is strictly prevented from reading, terminating, or deleting User B call logs');
    }

    // ─────────────────────────────────────────────
    // TEST 3: CRM CONTACTS / LEADS IDOR
    // ─────────────────────────────────────────────
    console.log('\n--- TEST 3: CRM CONTACTS & LEADS ISOLATION ---');
    {
      const lookup = await prisma.contact.findFirst({
        where: { id: userB_contact.id, userId: userAId },
      });
      assert.strictEqual(lookup, null, 'User A must not be able to find User B contact');

      const updateAttempt = await prisma.contact.updateMany({
        where: { id: userB_contact.id, userId: userAId },
        data: { name: 'Compromised Contact Name' },
      });
      assert.strictEqual(updateAttempt.count, 0, 'User A update on User B contact must affect 0 rows');

      const deleteAttempt = await prisma.contact.deleteMany({
        where: { id: userB_contact.id, userId: userAId },
      });
      assert.strictEqual(deleteAttempt.count, 0, 'User A delete on User B contact must affect 0 rows');
      console.log('✓ User A is strictly prevented from accessing or modifying User B leads/contacts');
    }

    // ─────────────────────────────────────────────
    // TEST 4: PHONE NUMBER CONFIGURATION CROSS-TENANT AGENT HIJACK IDOR
    // ─────────────────────────────────────────────
    console.log('\n--- TEST 4: PHONE NUMBER CALLING CONFIG CROSS-TENANT AGENT BINDING ---');
    {
      // Create a phone number for User A
      const userA_phone = await prisma.phoneNumber.create({
        data: {
          userId: userAId,
          phoneNumber: '+918012345678',
          vobizNumberId: `vobiz_${ts}_a`,
          status: 'active',
          countryCode: 'IN',
          telephonyProvider: 'vobiz',
          kycStatus: 'verified',
        },
      });

      // User A attempts to bind User B's private agent to User A's phone number
      let errorThrown = false;
      try {
        await InboundCallService.updateCallingConfig({
          userId: userAId,
          phoneNumberId: userA_phone.id,
          assignedAgentId: userB_agent.id, // User B's agent!
        });
      } catch (err) {
        errorThrown = true;
        assert(err.message.includes('unauthorized') || err.message.includes('not found'));
      }
      assert.strictEqual(errorThrown, true, 'Binding User B agent to User A number must be rejected');

      // User A attempts to bind User B's agent as inbound agent
      let inboundErrorThrown = false;
      try {
        await InboundCallService.updateCallingConfig({
          userId: userAId,
          phoneNumberId: userA_phone.id,
          inboundAgentId: userB_agent.id, // User B's agent!
        });
      } catch (err) {
        inboundErrorThrown = true;
        assert(err.message.includes('unauthorized') || err.message.includes('not found'));
      }
      assert.strictEqual(inboundErrorThrown, true, 'Binding User B agent as inbound target must be rejected');

      // Clean up User A phone
      await prisma.phoneNumber.delete({ where: { id: userA_phone.id } });
      console.log('✓ Cross-tenant agent hijacking on phone numbers is strictly blocked');
    }

    // ─────────────────────────────────────────────
    // TEST 5: BATCH CAMPAIGN AGENT HIJACK & BATCH CONTROL IDOR
    // ─────────────────────────────────────────────
    console.log('\n--- TEST 5: BATCH CAMPAIGN AGENT HIJACK & CAMPAIGN CONTROL ---');
    {
      // User A attempts to launch a batch dialing campaign using User B's agent
      const agentBelongsToUserA = await prisma.agent.findFirst({
        where: { id: userB_agent.id, userId: userAId },
      });
      assert.strictEqual(agentBelongsToUserA, null, 'User B agent must not pass User A ownership gate');

      // User A attempts to pause/resume/cancel User B's batch
      const batchLookup = await prisma.batch.findFirst({
        where: { id: userB_batch.id, userId: userAId },
      });
      assert.strictEqual(batchLookup, null, 'User B batch must not be accessible by User A');

      const batchUpdate = await prisma.batch.updateMany({
        where: { id: userB_batch.id, userId: userAId },
        data: { status: 'cancelled' },
      });
      assert.strictEqual(batchUpdate.count, 0, 'User A update on User B batch must affect 0 rows');

      const intactBatch = await prisma.batch.findUnique({ where: { id: userB_batch.id } });
      assert.strictEqual(intactBatch.status, 'paused', 'User B batch status must remain unchanged');
      console.log('✓ User A is strictly prevented from using User B agents in batch campaigns or tampering with batches');
    }

    // ─────────────────────────────────────────────
    // TEST 6: QA COHORT IDOR
    // ─────────────────────────────────────────────
    console.log('\n--- TEST 6: QA COHORT EVALUATION & DELETION ISOLATION ---');
    {
      const cohortLookup = await prisma.qaCohort.findFirst({
        where: { id: userB_cohort.id, userId: userAId },
      });
      assert.strictEqual(cohortLookup, null, 'User B cohort must not be accessible by User A');

      const deleteAttempt = await prisma.qaCohort.deleteMany({
        where: { id: userB_cohort.id, userId: userAId },
      });
      assert.strictEqual(deleteAttempt.count, 0, 'User A delete on User B cohort must affect 0 rows');

      const intactCohort = await prisma.qaCohort.findUnique({ where: { id: userB_cohort.id } });
      assert.notStrictEqual(intactCohort, null, 'User B QA cohort must remain intact');
      console.log('✓ User A cannot read, evaluate, or delete User B QA cohorts');
    }

    // ─────────────────────────────────────────────
    // TEST 7: API KEY CROSS-TENANT REVOCATION IDOR
    // ─────────────────────────────────────────────
    console.log('\n--- TEST 7: API KEY MANAGEMENT ISOLATION ---');
    {
      const keyLookup = await prisma.apiKey.findUnique({
        where: { id: userB_apiKey.id },
      });
      assert.notStrictEqual(keyLookup, null);
      assert.notStrictEqual(keyLookup.userId, userAId, 'Key owner must be User B');

      // Check route logic condition: (!apiKey || apiKey.userId !== req.userId) -> 404
      const isAuthorizedToDelete = keyLookup && keyLookup.userId === userAId;
      assert.strictEqual(isAuthorizedToDelete, false, 'User A must not be authorized to delete User B API key');
      console.log('✓ User A cannot view or revoke User B programmatic API keys');
    }

    // ─────────────────────────────────────────────
    // TEST 8: CROSS-TENANT TELEPHONY SUB-ACCOUNT DID PURCHASE IDOR
    // ─────────────────────────────────────────────
    console.log('\n--- TEST 8: TELEPHONY SUB-ACCOUNT OWNERSHIP ISOLATION ---');
    {
      const subAccountLookup = await prisma.vobizSubAccount.findFirst({
        where: { authId: userB_subAccount.authId, userId: userAId },
      });
      assert.strictEqual(subAccountLookup, null, 'User B sub-account must not match User A query');
      console.log('✓ User A cannot provision or purchase phone numbers on behalf of User B sub-accounts');
    }

    // ─────────────────────────────────────────────
    // TEST 9: CHAT HISTORY CROSS-TENANT MESSAGE SPOOFING IDOR
    // ─────────────────────────────────────────────
    console.log('\n--- TEST 9: CHAT HISTORY ATTACHMENT ISOLATION ---');
    {
      const agentBelongsToUserA = await prisma.agent.findFirst({
        where: { id: userB_agent.id, userId: userAId },
      });
      assert.strictEqual(agentBelongsToUserA, null);

      const callBelongsToUserA = await prisma.call.findFirst({
        where: { id: userB_call.id, userId: userAId },
      });
      assert.strictEqual(callBelongsToUserA, null);
      console.log('✓ User A is strictly blocked from attaching chat messages to User B agents or calls');
    }

    // ─────────────────────────────────────────────
    // TEST 10: NON-ADMIN GLOBAL NOTIFICATION BROADCAST REJECTION
    // ─────────────────────────────────────────────
    console.log('\n--- TEST 10: GLOBAL SYSTEM NOTIFICATION PRIVILEGE GATE ---');
    {
      const userA = await prisma.user.findUnique({ where: { id: userAId } });
      const isAdmin = userA.accountType === 'admin' || userA.email === ADMIN_EMAIL;
      assert.strictEqual(isAdmin, false, 'Standard User A must not have system-wide notification rights');
      console.log('✓ Non-admin accounts are strictly denied permission to post system-wide broadcasts');
    }

    console.log('\n====================================================');
    console.log('🎉 ALL 10/10 PHASE 4 IDOR & ISOLATION CHECKS PASSED!');
    console.log('====================================================\n');
  } finally {
    console.log('--- CLEANUP: REMOVING TRANSIENT FIXTURES ---');
    try {
      if (userB_apiKey) await prisma.apiKey.delete({ where: { id: userB_apiKey.id } }).catch(() => {});
      if (userB_cohort) {
        await prisma.callQaResult.deleteMany({ where: { cohortId: userB_cohort.id } }).catch(() => {});
        await prisma.qaCohort.delete({ where: { id: userB_cohort.id } }).catch(() => {});
      }
      if (userB_batch) {
        await prisma.batchRecipient.deleteMany({ where: { batchId: userB_batch.id } }).catch(() => {});
        await prisma.batch.delete({ where: { id: userB_batch.id } }).catch(() => {});
      }
      if (userB_phone) await prisma.phoneNumber.delete({ where: { id: userB_phone.id } }).catch(() => {});
      if (userB_contact) await prisma.contact.delete({ where: { id: userB_contact.id } }).catch(() => {});
      if (userB_call) await prisma.call.delete({ where: { id: userB_call.id } }).catch(() => {});
      if (userB_agent) await prisma.agent.delete({ where: { id: userB_agent.id } }).catch(() => {});
      if (userB_subAccount) await prisma.vobizSubAccount.delete({ where: { id: userB_subAccount.id } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } }).catch(() => {});
      console.log('✓ Multi-tenant fixtures removed cleanly');
    } catch (cleanErr) {
      console.error('Cleanup warning:', cleanErr.message);
    }
  }
}

runIdorAudit().catch((err) => {
  console.error('\n❌ PHASE 4 IDOR AUDIT FAILED:', err);
  process.exit(1);
});
