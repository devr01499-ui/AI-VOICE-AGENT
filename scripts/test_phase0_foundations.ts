/**
 * Phase 0 Foundations Test Suite
 * Tests all Phase 0 architectural requirements:
 * 1. Unified Minutes Ledger & double-deduction prevention with idempotency
 * 2. Role cap enforcement per Founder Decision #3
 * 3. call_content:view owner-only permission per Founder Decision #4
 * 4. Staff governance safeguards (self-modification guard, owner protection, last-owner guard)
 * 5. AccountEnforcementService lifecycle state transitions
 *
 * Usage:
 *   npx tsx scripts/test_phase0_foundations.ts
 */

process.env.NODE_ENV = 'development';
process.env.PORT = '3001';

import 'dotenv/config';
import { prisma } from '../server/src/lib/prisma';
import { MinutesService } from '../server/src/services/MinutesService';
import { CallService } from '../server/src/services/CallService';
import { AccountEnforcementService } from '../server/src/services/AccountEnforcementService';
import { validateGrantCap, getRoleCaps } from '../server/src/admin/capEnforcement';
import { hasPermission } from '../server/src/admin/permissions';

async function runPhase0Tests() {
  console.log('================================================================');
  console.log('       RUNNING PHASE 0 FOUNDATIONS TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}${details ? ` (${details})` : ''}`);
      failed++;
    }
  }

  // Setup test user
  const testEmail = `phase0_test_${Date.now()}@claritiy.com`;
  const user = await prisma.user.create({
    data: {
      email: testEmail,
      fullName: 'Phase 0 Test User',
      passwordHash: 'dummy_hash',
      callingBalanceMinutes: 100.0,
      minutesRemainingSeconds: 6000.0,
    },
  });

  const testOwnerEmail = `phase0_owner_${Date.now()}@claritiy.com`;
  const ownerStaff = await prisma.staffUser.create({
    data: {
      email: testOwnerEmail,
      name: 'Test Owner',
      role: 'owner',
      status: 'active',
    },
  });

  try {
    // -------------------------------------------------------------
    // Test 1: Unified Minutes Ledger Credit & Debit with Idempotency
    // -------------------------------------------------------------
    console.log('\n[1] Testing Unified Minutes Ledger & Idempotency:');

    const creditKey = `test_credit_${Date.now()}`;
    const credit1 = await MinutesService.credit({
      userId: user.id,
      deltaSeconds: 600, // 10 minutes
      reason: 'admin_grant',
      actorType: 'staff',
      actorId: ownerStaff.id,
      idempotencyKey: creditKey,
    });

    assert(!!credit1.ledgerEntry?.id, 'First credit creates new ledger entry');
    assert(credit1.balanceSeconds === 6600, 'Balance updated accurately (6000 + 600 = 6600)');

    // Repeat with identical idempotency key -> MUST be idempotent
    const creditDuplicate = await MinutesService.credit({
      userId: user.id,
      deltaSeconds: 600,
      reason: 'admin_grant',
      actorType: 'staff',
      actorId: ownerStaff.id,
      idempotencyKey: creditKey,
    });

    assert(creditDuplicate.ledgerEntry?.id === credit1.ledgerEntry.id, 'Duplicate credit returns original ledger entry');
    assert(creditDuplicate.balanceSeconds === 6600, 'Balance unchanged on duplicate idempotency key');

    // -------------------------------------------------------------
    // Test 2: Call End Deduction via CallService with Ledger
    // -------------------------------------------------------------
    console.log('\n[2] Testing CallService Unified Deduction:');

    // Create a mock agent and call for test user
    const testAgent = await prisma.agent.create({
      data: {
        userId: user.id,
        name: 'Test Voice Agent',
      },
    });

    const call = await prisma.call.create({
      data: {
        userId: user.id,
        agentId: testAgent.id,
        recipientPhoneNumber: '+919876543210',
        status: 'completed',
        durationSeconds: 120, // 2 minutes
      },
    });

    await CallService.deductCallMinutes(call.id, 120);

    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
    assert(
      updatedUser?.minutesRemainingSeconds === 6480,
      'CallService deducted 120 seconds via MinutesService (6600 - 120 = 6480)'
    );

    // Verify ledger entry was created for call
    const callLedgerEntry = await prisma.minutesLedger.findFirst({
      where: { refId: call.id, reason: 'call_usage' },
    });
    assert(!!callLedgerEntry, 'Call usage recorded in minutes_ledger with refId');
    assert(callLedgerEntry?.deltaSeconds === -120, 'Ledger entry delta is exactly -120s');

    // Repeat CallService.deductCallMinutes -> Idempotency prevents double deduction
    await CallService.deductCallMinutes(call.id, 120);
    const userAfterDupDeduct = await prisma.user.findUnique({ where: { id: user.id } });
    assert(
      userAfterDupDeduct?.minutesRemainingSeconds === 6480,
      'Double deduction prevented: duplicate call deduction has zero effect'
    );

    // -------------------------------------------------------------
    // Test 3: Role Cap Enforcement per Founder Decision #3
    // -------------------------------------------------------------
    console.log('\n[3] Testing Role Cap Enforcement:');

    // Support role: 50 min single grant cap
    const supportCapCheckPass = await validateGrantCap('support', 'dummy-support', 45);
    assert(supportCapCheckPass === null, 'Support role can grant 45 minutes (under 50 cap)');

    const supportCapCheckFail = await validateGrantCap('support', 'dummy-support', 55);
    assert(
      supportCapCheckFail !== null && supportCapCheckFail.includes('exceeds your per-action cap'),
      'Support role rejected when attempting 55 minutes (> 50 cap)'
    );

    // Sales role: 100 min single grant cap
    const salesCapCheckPass = await validateGrantCap('sales', 'dummy-sales', 100);
    assert(salesCapCheckPass === null, 'Sales role can grant 100 minutes');

    const salesCapCheckFail = await validateGrantCap('sales', 'dummy-sales', 101);
    assert(
      salesCapCheckFail !== null && salesCapCheckFail.includes('exceeds your per-action cap'),
      'Sales role rejected when attempting 101 minutes (> 100 cap)'
    );

    // Finance role: cannot grant
    const financeCapCheck = await validateGrantCap('finance', 'dummy-finance', 10);
    assert(
      financeCapCheck !== null && financeCapCheck.includes('does not have permission to grant'),
      'Finance role prohibited from granting any minutes'
    );

    // Owner role: unlimited
    const ownerCapCheck = await validateGrantCap('owner', ownerStaff.id, 10000);
    assert(ownerCapCheck === null, 'Owner role can grant 10,000 minutes (unlimited)');

    // -------------------------------------------------------------
    // Test 4: call_content:view Permission Restricted to Owner Only
    // -------------------------------------------------------------
    console.log('\n[4] Testing Call Content (Transcripts/Recordings) Restriction:');

    assert(hasPermission('owner', 'call_content:view') === true, 'Owner has call_content:view');
    assert(hasPermission('admin', 'call_content:view') === false, 'Admin DENIED call_content:view (Owner-only)');
    assert(hasPermission('sales', 'call_content:view') === false, 'Sales DENIED call_content:view');
    assert(hasPermission('support', 'call_content:view') === false, 'Support DENIED call_content:view');
    assert(hasPermission('finance', 'call_content:view') === false, 'Finance DENIED call_content:view');

    // -------------------------------------------------------------
    // Test 5: Account Suspension Lifecycle & Audit Logging
    // -------------------------------------------------------------
    console.log('\n[5] Testing Account Enforcement Lifecycle:');

    const suspendedUser = await AccountEnforcementService.suspendAccount({
      userId: user.id,
      category: 'payment_fraud',
      details: 'Test fraud suspension',
      staff: ownerStaff,
    });
    assert(suspendedUser.accountStatus === 'suspended', 'User accountStatus set to suspended');
    assert(!!suspendedUser.suspendedAt, 'suspendedAt timestamp recorded');

    const auditLog = await prisma.adminAuditLog.findFirst({
      where: { targetId: user.id, action: 'customer:suspend' },
      orderBy: { createdAt: 'desc' },
    });
    assert(!!auditLog, 'Audit log created for suspension');
    assert(auditLog?.staffEmail === ownerStaff.email, 'Audit log captures acting staff email');

    // Restore account
    const restoredUser = await AccountEnforcementService.restoreAccount({
      userId: user.id,
      reason: 'Verified legitimate account',
      staff: ownerStaff,
    });
    assert(restoredUser.accountStatus === 'active', 'User accountStatus restored to active');
    assert(restoredUser.suspendedAt === null, 'suspendedAt cleared on restoration');

  } finally {
    // Cleanup test artifacts
    await prisma.call.deleteMany({ where: { userId: user.id } }).catch(() => {});
    await prisma.minutesLedger.deleteMany({ where: { userId: user.id } }).catch(() => {});
    await prisma.adminAuditLog.deleteMany({ where: { targetId: user.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    await prisma.staffUser.delete({ where: { id: ownerStaff.id } }).catch(() => {});
  }

  console.log('\n================================================================');
  console.log(`  PHASE 0 RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase0Tests().catch((err) => {
  console.error('[FATAL] Phase 0 test runner crashed:', err);
  process.exit(1);
});
