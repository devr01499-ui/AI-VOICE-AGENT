const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const http = require('http');
const express = require('express');
const { prisma } = require('../dist/lib/prisma');
const kycRouter = require('../dist/routes/kyc').default;
const { VobizSubAccountService } = require('../dist/services/VobizSubAccountService');

async function main() {
  console.log('--- Testing Item 8: /kyc/status Caching and Live-Sync Throttling ---');

  const testUserId = 'test-kyc-cache-' + Date.now();
  const testSubAuthId = 'SA_KYC_CACHE_' + Date.now();

  try {
    // 1. Create test user
    await prisma.user.create({
      data: {
        id: testUserId,
        email: `kyc_cache_${Date.now()}@example.com`,
        fullName: 'KYC Cache Test User',
        accountType: 'user',
        callingBalanceMinutes: 100,
        passwordHash: 'dummy'
      }
    });

    // Create sub-account recently updated (0 seconds ago) in pending status
    await prisma.vobizSubAccount.create({
      data: {
        userId: testUserId,
        authId: testSubAuthId,
        authToken: 'token_cache_123',
        kycStatus: 'pending'
      }
    });

    // Mock syncKycStatus to count how many times it gets called
    let syncCallCount = 0;
    const originalSync = VobizSubAccountService.prototype.syncKycStatus;
    VobizSubAccountService.prototype.syncKycStatus = async () => {
      syncCallCount += 1;
      return { kycStatus: 'pending', isVerified: false };
    };

    const { supabaseClient } = require('../dist/utils/supabase');
    const originalGetUser = supabaseClient.auth.getUser;
    supabaseClient.auth.getUser = async () => ({
      data: { 
        user: { 
          id: testUserId, 
          email: 'test@example.com', 
          email_confirmed_at: new Date().toISOString(),
          user_metadata: { email_confirmed_at: new Date().toISOString() }
        } 
      },
      error: null
    });

    // Mount test express app
    const app = express();
    app.use(express.json());
    app.use('/api/v2/kyc', kycRouter);

    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;

    const getStatus = async () => {
      const res = await fetch(`http://localhost:${port}/api/v2/kyc/status`, {
        headers: {
          'Authorization': 'Bearer test_valid_jwt_mock_token'
        }
      });
      return { status: res.status, body: await res.json() };
    };

    // Request 1: Fresh DB record (updatedAt < 3 mins) -> should NOT invoke syncKycStatus
    console.log('\n[Case 1] Querying /kyc/status for fresh record:');
    const res1 = await getStatus();
    console.log('HTTP status:', res1.status, 'Response body:', JSON.stringify(res1.body));
    console.log('Status result 1:', res1.body.data?.kycStatus);
    console.log('syncKycStatus call count:', syncCallCount);
    if (syncCallCount !== 0) {
      throw new Error(`Case 1 FAILED: syncKycStatus was called ${syncCallCount} times for fresh record!`);
    }
    console.log('✓ Successfully served from DB cache without live Vobiz sync');

    // Case 2: Querying multiple times consecutively -> cache must hold (0 calls)
    console.log('\n[Case 2] Querying /kyc/status 5 times consecutively:');
    for (let i = 0; i < 5; i++) {
      await getStatus();
    }
    console.log('syncKycStatus call count after 5 calls:', syncCallCount);
    if (syncCallCount !== 0) {
      throw new Error(`Case 2 FAILED: Cache did not hold, syncKycStatus called ${syncCallCount} times!`);
    }
    console.log('✓ All 5 requests served from DB without live sync');

    // Case 3: When record is older than 3 minutes -> live sync triggered
    console.log('\n[Case 3] Stale record (older than 3 minutes):');
    const fourMinutesAgo = new Date(Date.now() - 4 * 60 * 1000);
    await prisma.vobizSubAccount.update({
      where: { userId: testUserId },
      data: { updatedAt: fourMinutesAgo }
    });

    await getStatus();
    console.log('syncKycStatus call count after stale query:', syncCallCount);
    if (syncCallCount !== 1) {
      throw new Error(`Case 3 FAILED: Expected 1 live sync call for stale record, got ${syncCallCount}`);
    }
    console.log('✓ Stale record triggered exactly 1 live sync as expected');

    // Restore prototype
    VobizSubAccountService.prototype.syncKycStatus = originalSync;
    server.close();
    console.log('\n--- ALL KYC STATUS CACHE TESTS PASSED ---');
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
