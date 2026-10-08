const assert = require('assert');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });
if (!process.env.SIP_ENCRYPTION_KEY && !process.env.VOBIZ_WEBHOOK_SECRET) {
  process.env.SIP_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
}

const { prisma } = require('../dist/lib/prisma');
const { VobizSubAccountService } = require('../dist/services/VobizSubAccountService');
const { ProviderError } = require('../dist/types/errors');

async function run() {
  console.log('--- Testing Item 9: Mock sub-accounts blocked in production & auto-repair path ---');

  const testUserId = `test-user-repair-${Date.now()}`;
  const testEmail = `repair-test-${Date.now()}@example.com`;

  try {
    // Setup test user in database
    await prisma.user.create({
      data: {
        id: testUserId,
        email: testEmail,
        passwordHash: 'dummy',
        fullName: 'Repair Test User',
      },
    });

    // Sub-test 1: Verify createSubAccount throws ProviderError in production if credentials are mock
    console.log('\n[Sub-test 1] Verifying mock sub-account creation throws in production...');
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const mockService = new VobizSubAccountService();
    // Force isMock
    mockService.masterAuthId = 'MA_PLACEHOLDER';

    let errorThrown = false;
    try {
      await mockService.createSubAccount(testUserId, testEmail);
    } catch (err) {
      if (err instanceof ProviderError && err.message.includes('CRITICAL CONFIG ERROR')) {
        errorThrown = true;
        console.log('✓ Correctly rejected mock sub-account in production:', err.message);
      } else {
        throw err;
      }
    }
    assert.strictEqual(errorThrown, true, 'createSubAccount must throw ProviderError in production if credentials are mock');

    // Restore NODE_ENV
    process.env.NODE_ENV = originalEnv;

    // Sub-test 2: Verify repairMockSubAccount is triggered when SA_MOCK_ subaccount exists
    console.log('\n[Sub-test 2] Verifying auto-repair of legacy SA_MOCK_ record...');
    const legacyMockSubAccount = await prisma.vobizSubAccount.create({
      data: {
        userId: testUserId,
        authId: 'SA_MOCK_LEGACY_123',
        authToken: 'enc_legacy_token',
        kycStatus: 'pending',
      },
    });

    const liveService = new VobizSubAccountService();
    // Mock the live Vobiz fetch for repair
    const originalFetch = global.fetch;
    let fetchCalled = false;
    global.fetch = async (url, options) => {
      fetchCalled = true;
      assert.ok(url.includes('/sub-accounts/'), `Unexpected URL called: ${url}`);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          sub_account: {
            auth_id: 'SA_REPAIRED_LIVE_999',
            auth_token: 'live_token_secret_xyz',
          },
        }),
      };
    };

    try {
      const repairedResult = await liveService.getOrCreateSubAccount(testUserId, testEmail);
      assert.strictEqual(fetchCalled, true, 'fetch should have been invoked to provision real sub-account on Vobiz');
      assert.strictEqual(repairedResult.authId, 'SA_REPAIRED_LIVE_999', 'Repaired sub-account should have new live authId');

      // Verify DB record was updated in place
      const dbRow = await prisma.vobizSubAccount.findUnique({ where: { userId: testUserId } });
      assert.strictEqual(dbRow.authId, 'SA_REPAIRED_LIVE_999');
      assert.strictEqual(dbRow.id, legacyMockSubAccount.id, 'Record ID must be preserved during in-place repair');
      console.log('✓ Successfully repaired legacy SA_MOCK_ record in-place to:', dbRow.authId);
    } finally {
      global.fetch = originalFetch;
    }

    console.log('\n✅ All Item 9 tests passed successfully!');
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
