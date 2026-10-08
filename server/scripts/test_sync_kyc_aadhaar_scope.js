const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { prisma } = require('../dist/lib/prisma');
const { VobizSubAccountService } = require('../dist/services/VobizSubAccountService');

async function main() {
  console.log('--- Testing Item 6: syncKycStatus Scoped to aadhaarRequired Numbers ---');

  const testUserId = 'test-sync-scope-' + Date.now();
  const testSubAuthId = 'SA_SYNC_SCOPE_' + Date.now();

  try {
    // 1. Create test user
    await prisma.user.create({
      data: {
        id: testUserId,
        email: `sync_scope_${Date.now()}@example.com`,
        fullName: 'Sync Scope User',
        accountType: 'user',
        callingBalanceMinutes: 100,
        passwordHash: 'dummy'
      }
    });

    await prisma.vobizSubAccount.create({
      data: {
        userId: testUserId,
        authId: testSubAuthId,
        authToken: 'token_sync_scope',
        kycStatus: 'pending'
      }
    });

    // 2. Create non-KYC number (aadhaarRequired: false, verified)
    const nonKycPhone = await prisma.phoneNumber.create({
      data: {
        userId: testUserId,
        phoneNumber: `+9198765${Math.floor(10000 + Math.random() * 90000)}`,
        countryCode: 'IN',
        type: 'local',
        telephonyProvider: 'vobiz',
        status: 'active',
        kycStatus: 'verified',
        aadhaarRequired: false,
        monthlyCost: 500,
        setupFee: 0,
        currency: 'INR'
      }
    });

    // 3. Create KYC-required number (aadhaarRequired: true, verified)
    const kycPhone = await prisma.phoneNumber.create({
      data: {
        userId: testUserId,
        phoneNumber: `+9198764${Math.floor(10000 + Math.random() * 90000)}`,
        countryCode: 'IN',
        type: 'local',
        telephonyProvider: 'vobiz',
        status: 'activation_pending',
        kycStatus: 'verified',
        aadhaarRequired: true,
        monthlyCost: 500,
        setupFee: 0,
        currency: 'INR'
      }
    });

    // 4. Run syncKycStatus.
    // In test environment, the live sub-account won't be verified on Vobiz, so it resolves to subKycStatus: 'pending'
    const service = new VobizSubAccountService();
    const result = await service.syncKycStatus(testUserId);
    console.log('syncKycStatus result:', result);

    // 5. Inspect database records after sync
    const refreshedNonKyc = await prisma.phoneNumber.findUnique({ where: { id: nonKycPhone.id } });
    const refreshedKyc = await prisma.phoneNumber.findUnique({ where: { id: kycPhone.id } });

    console.log('Non-KYC number kycStatus:', refreshedNonKyc.kycStatus);
    console.log('KYC-required number kycStatus:', refreshedKyc.kycStatus);

    if (refreshedNonKyc.kycStatus !== 'verified') {
      throw new Error(`Item 6 FAILED: Non-KYC number was overwritten to '${refreshedNonKyc.kycStatus}'!`);
    }

    if (refreshedKyc.kycStatus !== 'pending') {
      throw new Error(`Item 6 FAILED: KYC number was expected to be 'pending', but got '${refreshedKyc.kycStatus}'`);
    }

    console.log('✓ Successfully preserved verified status on aadhaarRequired: false number');
    console.log('✓ Successfully updated aadhaarRequired: true number to subKycStatus');
    console.log('\n--- ALL SYNC SCOPE TESTS PASSED ---');
  } finally {
    await prisma.phoneNumber.deleteMany({ where: { userId: testUserId } });
    await prisma.vobizSubAccount.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
