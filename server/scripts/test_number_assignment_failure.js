const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { prisma } = require('../dist/lib/prisma');
const { VobizPhoneNumberService } = require('../dist/services/VobizPhoneNumberService');
const { VobizInventoryService } = require('../dist/services/VobizInventoryService');
const { VobizSubAccountService } = require('../dist/services/VobizSubAccountService');
const { NotificationService } = require('../dist/services/NotificationService');

async function main() {
  console.log('--- Testing Item 7: Number Assignment Failure Handling ---');

  const testUserId = 'test-assign-fail-' + Date.now();
  const testSubAuthId = 'SA_ASSIGN_FAIL_' + Date.now();
  const testNumber = `+9198765${Math.floor(10000 + Math.random() * 90000)}`;

  try {
    // 1. Create test user and sub-account
    await prisma.user.create({
      data: {
        id: testUserId,
        email: `assign_fail_${Date.now()}@example.com`,
        fullName: 'Assignment Failure Test User',
        accountType: 'user',
        callingBalanceMinutes: 100,
        passwordHash: 'dummy'
      }
    });

    await prisma.vobizSubAccount.create({
      data: {
        userId: testUserId,
        authId: testSubAuthId,
        authToken: 'token_assign_fail',
        kycStatus: 'verified'
      }
    });

    // Mock getNumberDetails
    const originalGetNumberDetails = VobizInventoryService.prototype.getNumberDetails;
    VobizInventoryService.prototype.getNumberDetails = async () => ({
      id: 'num-inventory-123',
      e164: testNumber,
      country: 'IN',
      region: 'DL',
      monthly_fee: 500,
      setup_fee: 0,
      currency: 'INR',
      aadhaar_verification_required: true
    });

    // Mock purchase request to succeed
    const originalRequest = VobizPhoneNumberService.prototype.request;
    VobizPhoneNumberService.prototype.request = async () => ({
      success: true,
      data: { status: 'purchased' }
    });

    // Mock assignNumberToSubAccount to simulate assignment failure
    const originalAssign = VobizSubAccountService.prototype.assignNumberToSubAccount;
    VobizSubAccountService.prototype.assignNumberToSubAccount = async () => ({
      success: false,
      status: 502,
      error: 'Vobiz sub-account DID routing failed'
    });

    const phoneService = new VobizPhoneNumberService();
    const idempotencyKey = 'order-assign-fail-' + Date.now();

    console.log('\n[Case 1] Simulating assignment failure after inventory purchase:');
    let caughtError = null;
    try {
      await phoneService.purchaseAndAssignNumber({
        userId: testUserId,
        idempotencyKey,
        vobizNumberId: 'num-inventory-123',
        expectedPrice: 500
      });
    } catch (err) {
      caughtError = err;
      console.log('✓ Call failed as expected with error:', err.message);
    }

    if (!caughtError) {
      throw new Error('Case 1 FAILED: purchaseAndAssignNumber succeeded despite assignment failure!');
    }

    // Inspect database order status
    const orderRecord = await prisma.phoneNumberOrder.findUnique({
      where: { idempotencyKey }
    });

    console.log('Order status in DB:', orderRecord.orderStatus);
    if (orderRecord.orderStatus !== 'assignment_failed') {
      throw new Error(`Case 1 FAILED: Order status was '${orderRecord.orderStatus}', expected 'assignment_failed'!`);
    }
    console.log('✓ Order status correctly recorded as assignment_failed');

    // Confirm no phone number was created
    const createdPhone = await prisma.phoneNumber.findFirst({
      where: { userId: testUserId, phoneNumber: testNumber }
    });
    if (createdPhone) {
      throw new Error('Case 1 FAILED: Phone number was created despite assignment failure!');
    }
    console.log('✓ Verified: No phone number was created for the user');

    // Confirm admin alert in NotificationService
    const adminNotifs = NotificationService.getAll();
    const alertNotif = adminNotifs.find(n => n.message.includes('ADMIN ALERT') && n.message.includes(testNumber));
    if (!alertNotif) {
      throw new Error('Case 1 FAILED: Admin alert notification was not found in NotificationService!');
    }
    console.log('✓ Verified: Admin alert notification generated:', alertNotif.message);

    // Case 2: Successful assignment flow
    console.log('\n[Case 2] Simulating successful assignment flow:');
    VobizSubAccountService.prototype.assignNumberToSubAccount = async () => ({
      success: true,
      status: 200
    });

    const testNumber2 = `+9198765${Math.floor(10000 + Math.random() * 90000)}`;
    VobizInventoryService.prototype.getNumberDetails = async () => ({
      id: 'num-inventory-456',
      e164: testNumber2,
      country: 'IN',
      region: 'DL',
      monthly_fee: 500,
      setup_fee: 0,
      currency: 'INR',
      aadhaar_verification_required: true
    });

    const successIdempotencyKey = 'order-assign-success-' + Date.now();
    const successRes = await phoneService.purchaseAndAssignNumber({
      userId: testUserId,
      idempotencyKey: successIdempotencyKey,
      vobizNumberId: 'num-inventory-456',
      expectedPrice: 500
    });

    const successOrder = await prisma.phoneNumberOrder.findUnique({
      where: { idempotencyKey: successIdempotencyKey }
    });
    console.log('Success Order status in DB:', successOrder.orderStatus);
    if (successOrder.orderStatus !== 'success') {
      throw new Error(`Case 2 FAILED: Expected 'success', got '${successOrder.orderStatus}'`);
    }
    console.log('✓ Successful order marked as success');

    // Restore prototypes
    VobizInventoryService.prototype.getNumberDetails = originalGetNumberDetails;
    VobizPhoneNumberService.prototype.request = originalRequest;
    VobizSubAccountService.prototype.assignNumberToSubAccount = originalAssign;

    console.log('\n--- ALL NUMBER ASSIGNMENT FAILURE TESTS PASSED (2/2) ---');
  } finally {
    await prisma.phoneNumber.deleteMany({ where: { userId: testUserId } });
    await prisma.phoneNumberOrder.deleteMany({ where: { userId: testUserId } });
    await prisma.vobizSubAccount.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
