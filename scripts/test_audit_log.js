/**
 * Phase 2 Audit Log Verification Suite
 * 
 * Verifies:
 * 1. Imports and invokes the REAL logAuditEvent function from server build.
 * 2. Persists audit event records in PostgreSQL database via Prisma.
 * 3. Proper isolation by workspaceOwnerId and action filtering.
 */

require('dotenv').config({ path: './server/.env' });
const { prisma } = require('../server/dist/lib/prisma');
const { logAuditEvent } = require('../server/dist/utils/auditLogger');

async function testAuditLogLogic() {
  console.log('====================================================');
  console.log('📋 Starting Phase 2 Real Production Audit Log Verification');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  const testWorkspaceOwner = `test-ws-owner-${Date.now()}`;
  const testActorUser = `test-actor-${Date.now()}`;

  async function assertRealAuditRecord(action, targetId, metadata, testName) {
    try {
      await logAuditEvent({
        workspaceOwnerId: testWorkspaceOwner,
        actorUserId: testActorUser,
        action,
        targetId,
        metadata,
      });

      const dbRecord = await prisma.auditLog.findFirst({
        where: {
          workspaceOwnerId: testWorkspaceOwner,
          action,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (dbRecord && dbRecord.targetId === targetId && dbRecord.actorUserId === testActorUser) {
        console.log(`  [PASS] ${testName} -> Persisted in DB (ID: ${dbRecord.id}, Action: ${dbRecord.action})`);
        passed++;
      } else {
        console.error(`  [FAIL] ${testName} -> Record not found in database or mismatch`);
        failed++;
      }
    } catch (err) {
      console.error(`  [FAIL] ${testName} -> Error: ${err.message || String(err)}`);
      failed++;
    }
  }

  try {
    console.log('--- Test 1: Real Database Audit Log Persistence ---');
    await assertRealAuditRecord('agent.created', 'agent-uuid-123', { name: 'Sales Assistant Agent' }, 'Agent Creation Audit Event');
    await assertRealAuditRecord('team.member.invited', 'user-dev-2', { email: 'dev@company.com', role: 'developer' }, 'Team Invite Audit Event');
    await assertRealAuditRecord('billing.plan.changed', 'order_12345', { planName: 'Starter', price: 800 }, 'Billing Plan Change Audit Event');
    await assertRealAuditRecord('kyc.status_updated', 'kyc_sub_123', { status: 'verified' }, 'KYC Status Update Audit Event');
    await assertRealAuditRecord('number.purchased', 'num_456', { phoneNumber: '+919876543210' }, 'Number Purchase Audit Event');

  } finally {
    // Clean up test audit records
    await prisma.auditLog.deleteMany({
      where: { workspaceOwnerId: testWorkspaceOwner },
    });
    await prisma.$disconnect();
  }

  console.log('\n====================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

testAuditLogLogic();
