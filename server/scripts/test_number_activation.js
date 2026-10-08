/**
 * Verification test for Item 2: Number Unlocking & Auto-Activation
 * Per GOVERNANCE_RULES §6: Directly invokes compiled production code from dist/
 * Run with: node scripts/test_number_activation.js
 */

const path = require('path');
process.env.VOBIZ_WEBHOOK_SECRET = 'test_webhook_secret_key_12345';
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const http = require('http');
const express = require('express');
const { prisma } = require('../dist/lib/prisma');
const { PhoneNumberActivationService } = require('../dist/services/PhoneNumberActivationService');
const { CallService } = require('../dist/services/CallService');
const numbersRouter = require('../dist/routes/numbers').default || require('../dist/routes/numbers');
const kycRouter = require('../dist/routes/kyc').default || require('../dist/routes/kyc');
const { requestIdMiddleware } = require('../dist/middleware/requestId');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName} - ${details}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING NUMBER UNLOCKING & AUTO-ACTIVATION TEST SUITE');
  console.log('================================================================\n');

  // Test setup: Admin user and Customer user
  const adminUser = await prisma.user.upsert({
    where: { email: 'founder_admin_test@claritiy.internal' },
    update: { accountType: 'admin', callingBalanceMinutes: 100 },
    create: {
      email: 'founder_admin_test@claritiy.internal',
      fullName: 'Founder Admin',
      accountType: 'admin',
      passwordHash: 'dummy',
      callingBalanceMinutes: 100,
    }
  });

  const customerUser = await prisma.user.upsert({
    where: { email: 'customer_test_user@claritiy.internal' },
    update: { accountType: 'developer', callingBalanceMinutes: 100 },
    create: {
      email: 'customer_test_user@claritiy.internal',
      fullName: 'Customer Test User',
      accountType: 'developer',
      passwordHash: 'dummy',
      callingBalanceMinutes: 100,
    }
  });

  // Create a customer sub-account initially UNFUNDED and pending KYC
  await prisma.vobizSubAccount.upsert({
    where: { userId: customerUser.id },
    update: { walletFundedAt: null, kycStatus: 'pending' },
    create: {
      userId: customerUser.id,
      authId: `SA_TEST_${Date.now()}`,
      authToken: 'token_test_123',
      walletFundedAt: null,
      kycStatus: 'pending',
    }
  });

  // Create a customer phone number initially 'activation_pending' and requiring KYC
  const testNumber = `+9198765${Math.floor(10000 + Math.random() * 90000)}`;
  const customerPhone = await prisma.phoneNumber.create({
    data: {
      userId: customerUser.id,
      phoneNumber: testNumber,
      countryCode: 'IN',
      type: 'local',
      telephonyProvider: 'vobiz',
      status: 'activation_pending',
      kycStatus: 'pending',
      aadhaarRequired: true,
      monthlyCost: 500,
      setupFee: 0,
      currency: 'INR',
    }
  });

  // Also create a test agent for calling tests
  const testAgent = await prisma.agent.create({
    data: {
      userId: customerUser.id,
      name: 'Activation Test Agent',
      systemPrompt: 'You are a test agent.',
      voiceName: 'Puck',
      status: 'active',
    }
  });

  // Express app mounting numbersRouter and kycRouter
  const app = express();
  app.use(express.json());
  app.use(requestIdMiddleware);

  let currentAuthContext = {
    userId: adminUser.id,
    effectiveWorkspaceId: adminUser.id,
  };

  app.use((req, res, next) => {
    req.userId = currentAuthContext.userId;
    req.effectiveWorkspaceId = currentAuthContext.effectiveWorkspaceId;
    next();
  });

  app.use('/api/v2/numbers', numbersRouter);
  app.use('/api/v2/kyc', kycRouter);

  const server = http.createServer(app);
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // ── Test 1: CallService blocks call from non-active number with exact message ──
    console.log('--- Test 1: Outbound Call Gate on Activation Pending Number ---');
    let callBlockedWithAwaitingMsg = false;
    try {
      await CallService.createCall({
        phoneNumber: '+919999999999',
        agentId: testAgent.id,
        userId: customerUser.id,
        fromPhoneNumber: customerPhone.phoneNumber,
      });
    } catch (err) {
      if (err.message?.includes('Your number is awaiting activation') || err.validationErrors?.[0]?.message?.includes('Your number is awaiting activation')) {
        callBlockedWithAwaitingMsg = true;
      }
    }
    assert(callBlockedWithAwaitingMsg, 'CallService rejects unactivated customer number with "Your number is awaiting activation"');

    // ── Test 2: Admin Pending Activations List shows the customer number ──
    console.log('\n--- Test 2: Admin Pending Activations Queue ---');
    currentAuthContext = { userId: adminUser.id, effectiveWorkspaceId: adminUser.id };
    const pendingRes = await fetch(`${baseUrl}/api/v2/numbers/pending-activations`);
    const pendingData = await pendingRes.json();
    assert(pendingData.success && Array.isArray(pendingData.data), 'Admin successfully fetches pending activations');
    const inQueue = pendingData.data.find(n => n.id === customerPhone.id);
    assert(inQueue && inQueue.funded === false && inQueue.status === 'activation_pending', 'Customer number appears in queue as unfunded and activation_pending');

    // ── Test 3: Admin PATCH /numbers/:id/activate activates customer number without 404 ──
    console.log('\n--- Test 3: Admin Manual Activation by ID Scoped to Admin Role ---');
    const activateRes = await fetch(`${baseUrl}/api/v2/numbers/${customerPhone.id}/activate`, {
      method: 'PATCH'
    });
    const activateData = await activateRes.json();
    assert(activateData.success && activateData.data?.status === 'active', 'Admin activates customer number directly by ID (no 404)');

    // Reset phone status back to activation_pending for auto-activation rule tests
    await prisma.phoneNumber.update({
      where: { id: customerPhone.id },
      data: { status: 'activation_pending', kycStatus: 'pending' },
    });

    // ── Test 4: Mark wallet funded action sets walletFundedAt ──
    console.log('\n--- Test 4: Admin Action: Mark Wallet Funded ---');
    const fundRes = await fetch(`${baseUrl}/api/v2/numbers/${customerPhone.id}/mark-funded-and-activate`, {
      method: 'POST'
    });
    const fundData = await fundRes.json();
    assert(fundData.success, 'Mark wallet funded succeeds');

    const updatedSubAccount = await prisma.vobizSubAccount.findUnique({ where: { userId: customerUser.id } });
    assert(updatedSubAccount && updatedSubAccount.walletFundedAt !== null, 'VobizSubAccount.walletFundedAt is populated with timestamp');

    // Because KYC is still 'pending' and aadhaarRequired is true, number remains 'activation_pending'
    const phoneAfterFund = await prisma.phoneNumber.findUnique({ where: { id: customerPhone.id } });
    assert(phoneAfterFund.status === 'activation_pending', 'Number remains activation_pending while KYC is pending');

    // ── Test 5: KYC Webhook verifies KYC and auto-activates because wallet is funded ──
    console.log('\n--- Test 5: KYC Webhook Triggers Auto-Activation When Wallet is Funded ---');
    const webhookRes = await fetch(`${baseUrl}/api/v2/kyc/webhook/vobiz`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Vobiz-Token': 'test_webhook_secret_key_12345',
      },
      body: JSON.stringify({
        sub_account_auth_id: updatedSubAccount.authId,
        status: 'verified',
      })
    });
    const webhookData = await webhookRes.json();
    assert(webhookData.success, 'KYC webhook processed update');

    const phoneAfterKyc = await prisma.phoneNumber.findUnique({ where: { id: customerPhone.id } });
    assert(phoneAfterKyc.status === 'active', 'Customer number automatically flips to active upon KYC verification when wallet is funded');

    // ── Test 6: Audit log verification ──
    console.log('\n--- Test 6: Audit Log Entry Created for Activation ---');
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        workspaceOwnerId: customerUser.id,
        action: 'number.activated',
      },
      orderBy: { createdAt: 'desc' },
      take: 2,
    });
    assert(auditLogs.length > 0, 'Audit log correctly records number activation event');

  } finally {
    server.close();
    // Cleanup created records
    await prisma.phoneNumber.delete({ where: { id: customerPhone.id } }).catch(() => {});
    await prisma.agent.delete({ where: { id: testAgent.id } }).catch(() => {});
  }

  console.log('\n================================================================');
  console.log(`Number Activation Tests Complete: ${passedTests} passed, ${failedTests} failed`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
