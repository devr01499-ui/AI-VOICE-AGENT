const path = require('path');
process.env.VOBIZ_FROM_NUMBER = '+919999000000';
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
if (!process.env.VOBIZ_FROM_NUMBER) {
  process.env.VOBIZ_FROM_NUMBER = '+919999000000';
}

const { prisma } = require('../dist/lib/prisma');
const { env } = require('../dist/config/env');
env.VOBIZ_FROM_NUMBER = '+919999000000';

async function main() {
  console.log('--- Testing Caller ID Validation and Fallback Isolation ---');

  const { CallService } = require('../dist/services/CallService');
  const { callOrchestrator } = require('../dist/core/orchestrator/CallOrchestrator');

  const originalInitiate = callOrchestrator.initiateOutboundCall;
  let lastInitiatedFromNumber = null;
  callOrchestrator.initiateOutboundCall = async (phone, agentId, userId, fromNumber, maxDuration) => {
    lastInitiatedFromNumber = fromNumber;
    return 'mock-call-id-caller-id-test';
  };

  const testUserId = 'test-caller-id-user-' + Date.now();
  const adminUserId = 'test-caller-id-admin-' + Date.now();
  const testAgentId = 'test-agent-' + Date.now();

  try {
    // 1. Create non-admin and admin users
    await prisma.user.create({
      data: {
        id: testUserId,
        email: `nonadmin_${Date.now()}@example.com`,
        fullName: 'Non-Admin Caller',
        accountType: 'user',
        callingBalanceMinutes: 500,
        passwordHash: 'dummy-hash'
      }
    });

    await prisma.user.create({
      data: {
        id: adminUserId,
        email: `admin_${Date.now()}@example.com`,
        fullName: 'Admin Caller',
        accountType: 'admin',
        callingBalanceMinutes: 500,
        passwordHash: 'dummy-hash'
      }
    });

    // Sub-accounts
    await prisma.vobizSubAccount.create({
      data: {
        userId: testUserId,
        authId: `SA_TEST_${Date.now()}`,
        authToken: 'token',
        kycStatus: 'verified',
        walletFundedAt: new Date()
      }
    });

    await prisma.agent.create({
      data: {
        id: testAgentId,
        userId: testUserId,
        name: 'Test Voice Agent',
        status: 'active'
      }
    });

    // Create an active phone number and a pending phone number for customer
    const activeNumber = `+9198765${Math.floor(10000 + Math.random() * 90000)}`;
    const pendingNumber = `+9198764${Math.floor(10000 + Math.random() * 90000)}`;

    await prisma.phoneNumber.create({
      data: {
        userId: testUserId,
        phoneNumber: activeNumber,
        status: 'active',
        kycStatus: 'verified',
        countryCode: 'IN',
        type: 'local',
        telephonyProvider: 'vobiz',
        monthlyCost: 500,
        setupFee: 0,
        currency: 'INR'
      }
    });

    await prisma.phoneNumber.create({
      data: {
        userId: testUserId,
        phoneNumber: pendingNumber,
        status: 'activation_pending',
        kycStatus: 'verified',
        countryCode: 'IN',
        type: 'local',
        telephonyProvider: 'vobiz',
        monthlyCost: 500,
        setupFee: 0,
        currency: 'INR'
      }
    });

    // Mock CallRepository findById
    const { CallRepository } = require('../dist/repositories/CallRepository');
    const originalFindById = CallRepository.findById;
    CallRepository.findById = async (id) => ({
      id,
      status: 'initiated',
      recipientPhoneNumber: '+919999999999',
      agentId: testAgentId,
      createdAt: new Date()
    });

    // Test 1: Non-admin calls without fromPhoneNumber -> REJECTED
    console.log('\n[Case 1] Non-admin calls without fromPhoneNumber:');
    let rejectedMissing = false;
    try {
      await CallService.createCall({
        phoneNumber: '+919999999999',
        agentId: testAgentId,
        userId: testUserId,
      });
    } catch (err) {
      if (err.message === 'Caller ID required') {
        rejectedMissing = true;
        console.log('✓ Successfully rejected with: Caller ID required');
      } else {
        console.error('Unexpected error:', err);
      }
    }
    if (!rejectedMissing) throw new Error('Case 1 FAILED: Non-admin call without fromPhoneNumber was not rejected!');

    // Test 2: Non-admin calls with founder master number / unowned number -> REJECTED
    console.log('\n[Case 2] Non-admin calls with unowned number (founder number):');
    let rejectedUnowned = false;
    try {
      await CallService.createCall({
        phoneNumber: '+919999999999',
        agentId: testAgentId,
        userId: testUserId,
        fromPhoneNumber: '+918000000000' // not owned
      });
    } catch (err) {
      if (err.message === 'Unauthorized caller ID') {
        rejectedUnowned = true;
        console.log('✓ Successfully rejected with: Unauthorized caller ID');
      } else {
        console.error('Unexpected error:', err);
      }
    }
    if (!rejectedUnowned) throw new Error('Case 2 FAILED: Non-admin call with unowned number was not rejected!');

    // Test 3: Non-admin calls with pending number -> REJECTED
    console.log('\n[Case 3] Non-admin calls with owned pending number:');
    let rejectedPending = false;
    try {
      await CallService.createCall({
        phoneNumber: '+919999999999',
        agentId: testAgentId,
        userId: testUserId,
        fromPhoneNumber: pendingNumber
      });
    } catch (err) {
      if (err.message === 'Your number is awaiting activation') {
        rejectedPending = true;
        console.log('✓ Successfully rejected with: Your number is awaiting activation');
      } else {
        console.error('Unexpected error:', err);
      }
    }
    if (!rejectedPending) throw new Error('Case 3 FAILED: Non-admin call with pending number was not rejected!');

    // Test 4: Non-admin calls with owned active number -> SUCCESS
    console.log('\n[Case 4] Non-admin calls with owned active number:');
    const callRes = await CallService.createCall({
      phoneNumber: '+919999999999',
      agentId: testAgentId,
      userId: testUserId,
      fromPhoneNumber: activeNumber
    });
    if (callRes && lastInitiatedFromNumber === activeNumber) {
      console.log(`✓ Successfully initiated call with verified active caller ID: ${lastInitiatedFromNumber}`);
    } else {
      throw new Error('Case 4 FAILED: Active caller ID failed to initiate!');
    }

    // Test 5: Admin calls without fromPhoneNumber -> FALLS BACK TO PLATFORM DEFAULT
    console.log('\n[Case 5] Admin calls without fromPhoneNumber (master number fallback):');
    const adminCallRes = await CallService.createCall({
      phoneNumber: '+919999999999',
      agentId: testAgentId,
      userId: adminUserId,
    });
    if (adminCallRes && lastInitiatedFromNumber) {
      console.log(`✓ Admin successfully fell back to platform default: ${lastInitiatedFromNumber}`);
    } else {
      throw new Error('Case 5 FAILED: Admin fallback failed!');
    }

    CallRepository.findById = originalFindById;
    console.log('\n--- ALL CALLER ID FALLBACK TESTS PASSED (5/5) ---');
  } finally {
    callOrchestrator.initiateOutboundCall = originalInitiate;
    await prisma.phoneNumber.deleteMany({ where: { userId: testUserId } });
    await prisma.agent.deleteMany({ where: { id: testAgentId } });
    await prisma.vobizSubAccount.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: { in: [testUserId, adminUserId] } } });
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
