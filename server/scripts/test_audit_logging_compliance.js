const assert = require('assert');
const path = require('path');
const http = require('http');
const express = require('express');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });
if (!process.env.SIP_ENCRYPTION_KEY && !process.env.VOBIZ_WEBHOOK_SECRET) {
  process.env.SIP_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
}

process.env.NODE_ENV = 'development';
delete process.env.RESEND_API_KEY;

const { prisma } = require('../dist/lib/prisma');
const { supabaseClient } = require('../dist/utils/supabase');
const billingRouter = require('../dist/routes/billing').default || require('../dist/routes/billing');
const numbersRouter = require('../dist/routes/numbers').default || require('../dist/routes/numbers');
const kycRouter = require('../dist/routes/kyc').default || require('../dist/routes/kyc');
const auditLogRouter = require('../dist/routes/auditLog').default || require('../dist/routes/auditLog');

async function run() {
  console.log('--- Testing Ticket 3: Real Audit Logging for Billing, Numbers, and KYC ---');

  const testUserId = `test-audit-${Date.now()}`;
  const testEmail = `audit-${Date.now()}@example.com`;

  let server;

  try {
    // 1. Create a test admin user (so GET /api/v2/audit-logs and admin routes can be queried)
    await prisma.user.create({
      data: {
        id: testUserId,
        email: testEmail,
        passwordHash: 'dummy_hash',
        fullName: 'Audit Test User',
        accountType: 'admin',
        callingBalanceMinutes: 100,
      },
    });

    // Mock Supabase auth to return our test admin user
    supabaseClient.auth.getUser = async () => ({
      data: {
        user: {
          id: testUserId,
          email: testEmail,
          email_confirmed_at: new Date().toISOString(),
          user_metadata: { email_confirmed_at: new Date().toISOString() },
        },
      },
      error: null,
    });

    // Set up express app with real application routers
    const app = express();
    app.use(express.json());
    app.use('/api/v2/billing', billingRouter);
    app.use('/api/v2/numbers', numbersRouter);
    app.use('/api/v2/kyc', kycRouter);
    app.use('/api/v2/audit-logs', auditLogRouter);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test_valid_token',
    };

    // Sub-test 1: Real Billing Route Purchase -> billing.plan.purchased
    console.log('\n[Sub-test 1] Calling real POST /api/v2/billing/verify-plan...');
    const crypto = require('crypto');
    const orderId = `order_mock_plan_starter_${Date.now()}`;
    const paymentId = `pay_mock_${Date.now()}`;
    const secret = process.env.RAZORPAY_KEY_SECRET || 'dummy_secret';
    const validSignature = crypto.createHmac('sha256', secret).update(orderId + '|' + paymentId).digest('hex');

    const billingRes = await fetch(`${baseUrl}/api/v2/billing/verify-plan`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        plan: 'Starter',
        orderId,
        paymentId,
        signature: validSignature,
      }),
    });
    const billingData = await billingRes.json();
    assert.strictEqual(billingRes.status, 200, `Expected 200, got ${billingRes.status}: ${JSON.stringify(billingData)}`);
    assert.strictEqual(billingData.success, true);

    const billingAudit = await prisma.auditLog.findFirst({
      where: {
        workspaceOwnerId: testUserId,
        action: 'billing.plan.purchased',
        targetId: orderId,
      },
    });
    assert.ok(billingAudit, 'billing.plan.purchased audit row must exist in DB');
    console.log('✓ Verified real DB row for billing.plan.purchased:', billingAudit.action);

    // Restore admin role for subsequent admin endpoint tests
    await prisma.user.update({ where: { id: testUserId }, data: { accountType: 'admin' } });

    // Sub-test 2: Real Numbers Route Activation -> number.activated
    console.log('\n[Sub-test 2] Calling real PATCH /api/v2/numbers/:id/activate...');
    const testPhone = await prisma.phoneNumber.create({
      data: {
        userId: testUserId,
        phoneNumber: `+91999${Math.floor(1000000 + Math.random() * 9000000)}`,
        status: 'pending_activation',
        type: 'local',
        countryCode: 'IN',
        telephonyProvider: 'vobiz',
      },
    });

    const activateRes = await fetch(`${baseUrl}/api/v2/numbers/${testPhone.id}/activate`, {
      method: 'PATCH',
      headers,
    });
    const activateData = await activateRes.json();
    assert.strictEqual(activateRes.status, 200, `Expected 200, got ${activateRes.status}: ${JSON.stringify(activateData)}`);

    const numberAudit = await prisma.auditLog.findFirst({
      where: {
        workspaceOwnerId: testUserId,
        action: 'number.activated',
        targetId: testPhone.id,
      },
    });
    assert.ok(numberAudit, 'number.activated audit row must exist in DB');
    console.log('✓ Verified real DB row for number.activated:', numberAudit.action);

    // Sub-test 3: Real KYC Route Start -> kyc.initiated
    console.log('\n[Sub-test 3] Calling real POST /api/v2/kyc/start...');
    const kycStartRes = await fetch(`${baseUrl}/api/v2/kyc/start`, {
      method: 'POST',
      headers,
    });
    const kycStartData = await kycStartRes.json();
    assert.strictEqual(kycStartRes.status, 200, `Expected 200, got ${kycStartRes.status}: ${JSON.stringify(kycStartData)}`);

    const kycInitiatedAudit = await prisma.auditLog.findFirst({
      where: {
        workspaceOwnerId: testUserId,
        action: 'kyc.initiated',
      },
    });
    assert.ok(kycInitiatedAudit, 'kyc.initiated audit row must exist in DB');
    console.log('✓ Verified real DB row for kyc.initiated:', kycInitiatedAudit.action);

    // Sub-test 4: Real KYC Webhook -> kyc.status_changed
    console.log('\n[Sub-test 4] Calling real POST /api/v2/kyc/webhook/vobiz...');
    const subAccount = await prisma.vobizSubAccount.findUnique({ where: { userId: testUserId } });
    const webhookSecret = process.env.VOBIZ_WEBHOOK_SECRET || process.env.SIP_ENCRYPTION_KEY || 'test_webhook_secret_key_12345';
    const webhookRes = await fetch(`${baseUrl}/api/v2/kyc/webhook/vobiz`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Vobiz-Token': webhookSecret,
      },
      body: JSON.stringify({
        sub_account_auth_id: subAccount ? subAccount.authId : 'SA_AUDIT_TEST',
        status: 'verified',
        reason: 'Documents validated successfully',
      }),
    });
    const webhookData = await webhookRes.json();
    assert.strictEqual(webhookRes.status, 200, `Expected 200, got ${webhookRes.status}`);

    const kycChangedAudit = await prisma.auditLog.findFirst({
      where: {
        workspaceOwnerId: testUserId,
        action: 'kyc.status_changed',
      },
    });
    assert.ok(kycChangedAudit, 'kyc.status_changed audit row must exist in DB');
    console.log('✓ Verified real DB row for kyc.status_changed:', kycChangedAudit.action);

    // Sub-test 5: Verify all rows are returned by GET /api/v2/audit-logs
    console.log('\n[Sub-test 5] Querying real GET /api/v2/audit-logs...');
    const logsRes = await fetch(`${baseUrl}/api/v2/audit-logs`, {
      headers,
    });
    const logsData = await logsRes.json();
    assert.strictEqual(logsRes.status, 200);
    assert.strictEqual(logsData.success, true);
    const actions = logsData.data.map((l) => l.action);
    console.log('Returned actions from GET /api/v2/audit-logs:', actions);
    assert.ok(actions.includes('billing.plan.purchased'), 'Must include billing.plan.purchased');
    assert.ok(actions.includes('number.activated'), 'Must include number.activated');
    assert.ok(actions.includes('kyc.initiated'), 'Must include kyc.initiated');
    assert.ok(actions.includes('kyc.status_changed'), 'Must include kyc.status_changed');

    console.log('\n✅ All Ticket 3 Compliance Audit Log tests passed successfully against real application code!');
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    // Cleanup
    try {
      await prisma.auditLog.deleteMany({ where: { workspaceOwnerId: testUserId } });
      await prisma.phoneNumber.deleteMany({ where: { userId: testUserId } });
      await prisma.paymentTransaction.deleteMany({ where: { userId: testUserId } });
      await prisma.vobizSubAccount.deleteMany({ where: { userId: testUserId } });
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
