const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { prisma } = require('../dist/lib/prisma');
const { NotificationService } = require('../dist/services/NotificationService');
const { notifyUserKycStatus } = require('../dist/routes/kyc');

async function main() {
  console.log('--- Testing Item 5: KYC Email Delivery & In-App Notification Backup ---');

  const testUserId = 'test-kyc-notif-' + Date.now();
  const testEmail = `kyc_notif_${Date.now()}@example.com`;

  try {
    // 1. Create test user
    await prisma.user.create({
      data: {
        id: testUserId,
        email: testEmail,
        fullName: 'KYC Notification Recipient',
        accountType: 'user',
        callingBalanceMinutes: 100,
        passwordHash: 'dummy'
      }
    });

    // Case 1: In-app notification creation
    console.log('\n[Case 1] Verify in-app notification is generated on KYC status update:');
    delete process.env.RESEND_API_KEY;
    const oldNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    await notifyUserKycStatus(testUserId, 'verified');

    const userNotifs = NotificationService.getForUser(testUserId);
    const kycNotif = userNotifs.find(n => n.userId === testUserId && n.message.includes('KYC Verification Approved'));
    if (kycNotif) {
      console.log('✓ In-app notification successfully created and verified:', kycNotif.message);
    } else {
      throw new Error('Case 1 FAILED: In-app notification not found for user!');
    }

    // Case 2: Fail loudly when RESEND_API_KEY is missing in production
    console.log('\n[Case 2] Fail loudly in production when RESEND_API_KEY is missing:');
    process.env.NODE_ENV = 'production';
    delete process.env.RESEND_API_KEY;

    let failedLoudly = false;
    try {
      await notifyUserKycStatus(testUserId, 'verified');
    } catch (err) {
      if (err.message && err.message.includes('RESEND_API_KEY')) {
        failedLoudly = true;
        console.log('✓ Successfully failed loudly in production:', err.message);
      } else {
        console.error('Unexpected error:', err);
      }
    }

    if (!failedLoudly) {
      throw new Error('Case 2 FAILED: notifyUserKycStatus did not fail loudly in production when RESEND_API_KEY was missing!');
    }

    // Even though email failed loudly in production, verify in-app notification was STILL saved!
    const updatedNotifs = NotificationService.getForUser(testUserId);
    const matchingNotifs = updatedNotifs.filter(n => n.userId === testUserId);
    if (matchingNotifs.length >= 2) {
      console.log('✓ Verified: in-app notification was preserved even when production email failed loudly.');
    } else {
      throw new Error('In-app notification was not saved before email attempt!');
    }

    process.env.NODE_ENV = oldNodeEnv;
    console.log('\n--- ALL KYC NOTIFICATION & EMAIL TESTS PASSED (2/2) ---');
  } finally {
    await prisma.user.deleteMany({ where: { id: testUserId } });
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
