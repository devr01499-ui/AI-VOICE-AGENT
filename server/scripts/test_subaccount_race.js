const assert = require('assert');
const path = require('path');
const dotenv = require('dotenv');
const http = require('http');
const express = require('express');

dotenv.config({ path: path.join(__dirname, '../.env') });
if (!process.env.SIP_ENCRYPTION_KEY && !process.env.VOBIZ_WEBHOOK_SECRET) {
  process.env.SIP_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
}

const { prisma } = require('../dist/lib/prisma');
const { VobizSubAccountService } = require('../dist/services/VobizSubAccountService');
const kycRouter = require('../dist/routes/kyc').default;

async function run() {
  console.log('--- Testing Item 10: Concurrent KYC Sub-Account Race & Route Alias ---');

  const testUserId = `test-user-race-${Date.now()}`;
  const testEmail = `race-test-${Date.now()}@example.com`;

  try {
    // 1. Create test user
    await prisma.user.create({
      data: {
        id: testUserId,
        email: testEmail,
        passwordHash: 'dummy',
        fullName: 'Race Condition Test User',
      },
    });

    // 2. Test concurrent getOrCreateSubAccount calls
    console.log('\n[Sub-test 1] Testing in-flight mutex with concurrent getOrCreateSubAccount...');
    const service1 = new VobizSubAccountService();
    const service2 = new VobizSubAccountService();

    let fetchCount = 0;
    const originalFetch = global.fetch;
    global.fetch = async (url, options) => {
      if (url.includes('/sub-accounts/')) {
        fetchCount++;
        // Simulate network delay
        await new Promise((r) => setTimeout(r, 80));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            sub_account: {
              auth_id: `SA_RACE_CONCURRENT_${Date.now()}`,
              auth_token: 'test_token_secret',
            },
          }),
        };
      }
      return originalFetch(url, options);
    };

    try {
      // Fire two concurrent calls
      const [res1, res2] = await Promise.all([
        service1.getOrCreateSubAccount(testUserId, testEmail),
        service2.getOrCreateSubAccount(testUserId, testEmail),
      ]);

      assert.strictEqual(fetchCount, 1, `Fetch count should be exactly 1 due to mutex, but got ${fetchCount}`);
      assert.strictEqual(res1.id, res2.id, 'Both concurrent calls must return the same sub-account record ID');
      assert.strictEqual(res1.authId, res2.authId, 'Both concurrent calls must return the same authId');
      console.log('✓ Mutex successfully collapsed concurrent calls to 1 Vobiz call. Returned subAccount:', res1.authId);
    } finally {
      global.fetch = originalFetch;
    }

    // 3. Test Database P2002 Unique Constraint Race Fallback
    console.log('\n[Sub-test 2] Testing DB unique constraint fallback in createSubAccount...');
    const testUserId2 = `test-user-race2-${Date.now()}`;
    await prisma.user.create({
      data: {
        id: testUserId2,
        email: `race2-${Date.now()}@example.com`,
        passwordHash: 'dummy',
        fullName: 'Race 2 User',
      },
    });

    // Clean up testUserId2 later
    try {
      const raceService = new VobizSubAccountService();
      // Pre-create the subaccount in DB
      const existingSub = await prisma.vobizSubAccount.create({
        data: {
          userId: testUserId2,
          authId: 'SA_EXISTING_RACE_DB',
          authToken: 'dummy_token',
        },
      });

      // Call createSubAccount directly which tries to insert again for the same userId
      // It must catch P2002 and return the existing record instead of throwing
      const resultAfterRace = await raceService.createSubAccount(testUserId2, 'race2@example.com');
      assert.strictEqual(resultAfterRace.id, existingSub.id, 'createSubAccount must return existing record on duplicate race');
      assert.strictEqual(resultAfterRace.authId, 'SA_EXISTING_RACE_DB');
      console.log('✓ createSubAccount caught unique constraint duplicate and returned existing record smoothly.');
    } finally {
      await prisma.vobizSubAccount.deleteMany({ where: { userId: testUserId2 } });
      await prisma.user.deleteMany({ where: { id: testUserId2 } });
    }

    // 4. Test /api/v2/kyc/start route alias
    console.log('\n[Sub-test 3] Testing /api/v2/kyc/start route alias...');
    const { supabaseClient } = require('../dist/utils/supabase');
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

    const app = express();
    app.use(express.json());
    app.use('/api/v2/kyc', kycRouter);

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/v2/kyc/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test_mock_jwt_token',
        },
      });
      const data = await response.json();
      assert.strictEqual(response.status, 200, `Expected HTTP 200, got ${response.status}`);
      assert.strictEqual(data.success, true, 'Response must have success: true');
      assert.ok(data.data?.redirectUrl?.includes('console.vobiz.ai/kyc'), 'Redirect URL must target Vobiz hosted KYC');
      console.log('✓ /api/v2/kyc/start route alias successfully returned hosted KYC URL:', data.data.redirectUrl);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }

    console.log('\n✅ All Item 10 tests passed successfully!');
  } finally {
    // Cleanup
    try {
      await prisma.vobizSubAccount.deleteMany({ where: { userId: testUserId } });
      await prisma.user.deleteMany({ where: { id: testUserId } });
    } catch (cleanErr) {
      console.warn('Cleanup warning:', cleanErr.message);
    }
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
