const path = require('path');
process.env.VOBIZ_WEBHOOK_SECRET = 'test_webhook_secret_key_12345';
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const http = require('http');
const express = require('express');
const { prisma } = require('../dist/lib/prisma');
const kycRouter = require('../dist/routes/kyc').default;

async function main() {
  console.log('--- Testing Item 4: KYC Webhook Status Mapping & Downgrade Prevention ---');

  const testUserId = 'test-kyc-mapping-' + Date.now();
  const subAccountAuthId = 'SA_MAP_' + Date.now();

  try {
    // 1. Create test user
    await prisma.user.create({
      data: {
        id: testUserId,
        email: `kyc_mapping_${Date.now()}@example.com`,
        fullName: 'KYC Mapping Test User',
        accountType: 'user',
        callingBalanceMinutes: 100,
        passwordHash: 'dummy'
      }
    });

    // 2. Create sub-account in pending status
    const subAccount = await prisma.vobizSubAccount.create({
      data: {
        userId: testUserId,
        authId: subAccountAuthId,
        authToken: 'token_map_123',
        kycStatus: 'pending'
      }
    });

    // Setup mock express app with kycRouter mounted at /api/v2/kyc
    const app = express();
    app.use(express.json());
    app.use('/api/v2/kyc', kycRouter);

    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;

    const secret = process.env.VOBIZ_WEBHOOK_SECRET || process.env.SIP_ENCRYPTION_KEY || 'test_webhook_secret_key_12345';
    const postWebhook = async (payload) => {
      const res = await fetch(`http://localhost:${port}/api/v2/kyc/webhook/vobiz`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Vobiz-Token': secret
        },
        body: JSON.stringify(payload)
      });
      return { status: res.status, body: await res.json() };
    };

    // Case 1: Vobiz sends 'in_review' -> must map to 'pending', NOT 'failed'
    console.log('\n[Case 1] Vobiz sends status: in_review');
    const res1 = await postWebhook({
      sub_account_auth_id: subAccountAuthId,
      status: 'in_review'
    });
    const sub1 = await prisma.vobizSubAccount.findUnique({ where: { id: subAccount.id } });
    if (sub1.kycStatus === 'pending') {
      console.log('✓ in_review mapped to pending (not failed)');
    } else {
      throw new Error(`Expected pending, got ${sub1.kycStatus}`);
    }

    // Case 2: Vobiz sends 'verified' -> must map to 'verified'
    console.log('\n[Case 2] Vobiz sends status: verified');
    const res2 = await postWebhook({
      sub_account_auth_id: subAccountAuthId,
      status: 'verified'
    });
    const sub2 = await prisma.vobizSubAccount.findUnique({ where: { id: subAccount.id } });
    if (sub2.kycStatus === 'verified' && sub2.kycVerifiedAt) {
      console.log('✓ verified mapped to verified and kycVerifiedAt set');
    } else {
      throw new Error(`Expected verified, got ${sub2.kycStatus}`);
    }

    // Case 3: Vobiz sends 'pending' or 'in_review' on already verified account -> NO DOWNGRADE
    console.log('\n[Case 3] Vobiz sends in_review on already-verified account (downgrade prevention)');
    const res3 = await postWebhook({
      sub_account_auth_id: subAccountAuthId,
      status: 'in_review'
    });
    const sub3 = await prisma.vobizSubAccount.findUnique({ where: { id: subAccount.id } });
    if (sub3.kycStatus === 'verified') {
      console.log('✓ Account remained verified; downgrade correctly prevented');
    } else {
      throw new Error(`Account was downgraded to ${sub3.kycStatus}!`);
    }

    // Case 4: Vobiz sends 'rejected' on pending account -> maps to 'failed'
    console.log('\n[Case 4] Vobiz sends rejected');
    const testUserId2 = 'test-kyc-mapping-2-' + Date.now();
    await prisma.user.create({
      data: {
        id: testUserId2,
        email: `kyc_mapping_2_${Date.now()}@example.com`,
        fullName: 'KYC Mapping Test User 2',
        accountType: 'user',
        callingBalanceMinutes: 100,
        passwordHash: 'dummy'
      }
    });

    const subAccountAuthId2 = 'SA_MAP2_' + Date.now();
    const subAccount2 = await prisma.vobizSubAccount.create({
      data: {
        userId: testUserId2,
        authId: subAccountAuthId2,
        authToken: 'token_map_456',
        kycStatus: 'pending'
      }
    });
    await postWebhook({
      sub_account_auth_id: subAccountAuthId2,
      status: 'rejected',
      reason: 'Blurred ID card'
    });
    const sub4 = await prisma.vobizSubAccount.findUnique({ where: { id: subAccount2.id } });
    if (sub4.kycStatus === 'failed') {
      console.log('✓ rejected mapped to failed');
    } else {
      throw new Error(`Expected failed, got ${sub4.kycStatus}`);
    }

    server.close();
    await prisma.vobizSubAccount.deleteMany({ where: { userId: testUserId2 } });
    await prisma.user.deleteMany({ where: { id: testUserId2 } });
    console.log('\n--- ALL KYC WEBHOOK MAPPING TESTS PASSED (4/4) ---');
  } finally {
    await prisma.vobizSubAccount.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
