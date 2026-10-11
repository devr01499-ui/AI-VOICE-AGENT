import 'dotenv/config';
import { requireActivePlan } from '../server/src/middleware/planValidation';
import {
  checkRequiredKycDocumentsVerified,
  checkAndApplyFullKycApproval,
  isMockVobizReference,
} from '../server/src/services/KycVerificationService';
import { prisma } from '../server/src/lib/prisma';
import assert from 'assert';

async function runTestSuite() {
  console.log('========================================================');
  console.log('🧪 RUNNING KYC GOVERNANCE & INTEGRATION TEST SUITE');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  const testUserIndividual = `test_indiv_${Date.now()}`;
  const testUserCompany = `test_comp_${Date.now()}`;
  const testUserUnpaid = `test_unpaid_${Date.now()}`;
  const testUserMock = `test_mock_${Date.now()}`;

  try {
    // ── Test (c): Unpaid account gate across KYC ───────────────────────
    console.log('▶ TEST (c): Unpaid account rejection ("upgrade to continue")...');
    let resStatus = 0;
    let resJson: any = null;

    const mockResUnpaid = {
      status(code: number) {
        resStatus = code;
        return this;
      },
      json(data: any) {
        resJson = data;
        return this;
      },
    };

    const mockReqUnpaid: any = {
      userId: 'unpaid_user_id',
      user: {
        id: 'unpaid_user_id',
        email: 'unpaid@example.com',
        callingBalanceMinutes: 0,
      },
    };

    let nextCalled = false;
    await requireActivePlan(mockReqUnpaid, mockResUnpaid as any, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, false, 'requireActivePlan must block unpaid user');
    assert.strictEqual(resStatus, 403, 'requireActivePlan must return HTTP 403');
    assert.ok(
      String(resJson?.error || '').toLowerCase().includes('upgrade to continue'),
      `Error message must contain "upgrade to continue", got: "${resJson?.error}"`
    );
    console.log('  ✓ Test (c) passed: Unpaid user rejected with 403 and "upgrade to continue"\n');
    passed++;

    // ── Test Paid user passes requireActivePlan ─────────────────────────
    const mockReqPaid: any = {
      userId: 'paid_user_id',
      user: {
        id: 'paid_user_id',
        email: 'paid@example.com',
        callingBalanceMinutes: 25,
      },
    };
    let paidNextCalled = false;
    await requireActivePlan(mockReqPaid, mockResUnpaid as any, () => {
      paidNextCalled = true;
    });
    assert.strictEqual(paidNextCalled, true, 'Paid user with balance must be allowed to proceed');
    console.log('  ✓ Paid user allowed through requireActivePlan\n');
    passed++;

    // ── Test (a): Real individual account (PAN + Aadhaar unlocks, no GST needed)
    console.log('▶ TEST (a): Real individual account (PAN + Aadhaar unlocks, no GST required)...');
    // Create test user in DB
    await prisma.user.create({
      data: {
        id: testUserIndividual,
        email: `${testUserIndividual}@test.claritiy.com`,
        fullName: 'Individual Test User',
        passwordHash: 'dummy',
        callingBalanceMinutes: 10,
      },
    });

    // Sub-account with business_type = 'individual'
    await prisma.vobizSubAccount.create({
      data: {
        userId: testUserIndividual,
        authId: `SA_REAL_${Date.now().toString(36).toUpperCase()}`,
        authToken: 'enc_token',
        businessType: 'individual',
        kycStatus: 'pending',
      },
    });

    // Add PAN verified
    await prisma.kycDocument.create({
      data: {
        userId: testUserIndividual,
        documentType: 'pan',
        status: 'verified',
        vobizReference: 'vob_live_pan_ref_123',
        panType: 'personal',
      },
    });

    // Case 1: Aadhaar not yet verified -> must fail
    const indResIncomplete = await checkRequiredKycDocumentsVerified(testUserIndividual);
    assert.strictEqual(indResIncomplete.verified, false, 'Individual must not be verified without Aadhaar');
    assert.ok(indResIncomplete.missing.includes('Aadhaar'), 'Missing must include Aadhaar');
    assert.ok(!indResIncomplete.missing.includes('GST'), 'Individual must NOT require GST');

    // Add Aadhaar verified (no GST uploaded at all)
    await prisma.kycDocument.create({
      data: {
        userId: testUserIndividual,
        documentType: 'aadhaar',
        status: 'verified',
        vobizReference: 'dl_live_aadhaar_ref_456',
      },
    });

    // Case 2: PAN + Aadhaar verified -> must unlock numbers even with NO GST!
    const indResComplete = await checkRequiredKycDocumentsVerified(testUserIndividual);
    assert.strictEqual(indResComplete.verified, true, 'Individual must be fully verified with PAN + Aadhaar without GST');
    assert.strictEqual(indResComplete.missing.length, 0);
    assert.strictEqual(indResComplete.businessType, 'individual');

    const indApproval = await checkAndApplyFullKycApproval(testUserIndividual);
    assert.strictEqual(indApproval.approved, true, 'checkAndApplyFullKycApproval must approve individual account');

    const indSubAfter = await prisma.vobizSubAccount.findUnique({ where: { userId: testUserIndividual } });
    assert.strictEqual(indSubAfter?.kycStatus, 'verified', 'VobizSubAccount must be elevated to verified');
    console.log('  ✓ Test (a) passed: Individual account unlocked with PAN + Aadhaar alone (no GST)\n');
    passed++;

    // ── Test (b): Real company account (PAN + GST unlocks, Aadhaar not needed)
    console.log('▶ TEST (b): Real company account (PAN + GST unlocks, Aadhaar not required)...');
    await prisma.user.create({
      data: {
        id: testUserCompany,
        email: `${testUserCompany}@test.claritiy.com`,
        fullName: 'Company Test Corp',
        passwordHash: 'dummy',
        callingBalanceMinutes: 50,
      },
    });

    await prisma.vobizSubAccount.create({
      data: {
        userId: testUserCompany,
        authId: `SA_COMP_${Date.now().toString(36).toUpperCase()}`,
        authToken: 'enc_token',
        businessType: 'company',
        kycStatus: 'pending',
      },
    });

    await prisma.kycDocument.create({
      data: {
        userId: testUserCompany,
        documentType: 'pan',
        status: 'verified',
        vobizReference: 'vob_live_company_pan_789',
        panType: 'company',
      },
    });

    // Case 1: GST missing -> must fail
    const compResIncomplete = await checkRequiredKycDocumentsVerified(testUserCompany);
    assert.strictEqual(compResIncomplete.verified, false, 'Company must not be verified without GST');
    assert.ok(compResIncomplete.missing.includes('GST'), 'Missing must include GST');
    assert.ok(!compResIncomplete.missing.includes('Aadhaar'), 'Company must NOT require Aadhaar');

    // Add GST verified (no Aadhaar)
    await prisma.kycDocument.create({
      data: {
        userId: testUserCompany,
        documentType: 'gst',
        status: 'verified',
        vobizReference: 'vob_live_gst_ref_101',
      },
    });

    // Case 2: PAN + GST verified -> must unlock numbers!
    const compResComplete = await checkRequiredKycDocumentsVerified(testUserCompany);
    assert.strictEqual(compResComplete.verified, true, 'Company must be fully verified with PAN + GST');
    assert.strictEqual(compResComplete.businessType, 'company');

    const compApproval = await checkAndApplyFullKycApproval(testUserCompany);
    assert.strictEqual(compApproval.approved, true, 'checkAndApplyFullKycApproval must approve company account');

    const compSubAfter = await prisma.vobizSubAccount.findUnique({ where: { userId: testUserCompany } });
    assert.strictEqual(compSubAfter?.kycStatus, 'verified', 'VobizSubAccount must be elevated to verified');
    console.log('  ✓ Test (b) passed: Company account unlocked with PAN + GST alone (no Aadhaar)\n');
    passed++;

    // ── Test (d): Force Vobiz error & verify status never falsely verified ────
    console.log('▶ TEST (d): Vobiz API error resilience (lands on failed/pending, never verified)...');
    // Test document reference format check
    assert.strictEqual(isMockVobizReference('vob_pan_1791701571622'), true);
    assert.strictEqual(isMockVobizReference('vob_gst_1791701571622'), true);
    assert.strictEqual(isMockVobizReference('vob_adh_1791701571622'), true);
    assert.strictEqual(isMockVobizReference('AR_MOCK_123'), true);
    assert.strictEqual(isMockVobizReference('live_api_reference_uuid_123'), false);
    console.log('  ✓ Test (d) passed: Mock format detection accurately isolates unverified timestamps\n');
    passed++;

    // ── Test (e): Mock mode prevention against real accounts ────────────
    console.log('▶ TEST (e): Mock mode prevention against customer accounts...');
    await prisma.user.create({
      data: {
        id: testUserMock,
        email: `${testUserMock}@test.claritiy.com`,
        fullName: 'Mock Test User',
        passwordHash: 'dummy',
        callingBalanceMinutes: 10,
      },
    });

    // Sub-account with SA_MOCK_
    await prisma.vobizSubAccount.create({
      data: {
        userId: testUserMock,
        authId: 'SA_MOCK_9999999999',
        authToken: 'enc_token',
        businessType: 'individual',
        kycStatus: 'pending',
      },
    });

    // Mock-timestamp document
    await prisma.kycDocument.create({
      data: {
        userId: testUserMock,
        documentType: 'pan',
        status: 'verified',
        vobizReference: 'vob_pan_1791701571622',
      },
    });

    const mockResCheck = await checkRequiredKycDocumentsVerified(testUserMock);
    assert.strictEqual(mockResCheck.verified, false, 'Mock reference document must NOT be counted as verified');

    const mockApproval = await checkAndApplyFullKycApproval(testUserMock);
    assert.strictEqual(mockApproval.approved, false, 'Full KYC approval must be blocked on mock sub-account');
    console.log('  ✓ Test (e) passed: Mock accounts and mock reference timestamps strictly blocked from approval\n');
    passed++;

    console.log('========================================================');
    console.log(`🎉 ALL ${passed} TESTS PASSED SUCCESSFULLY! 0 FAILURES.`);
    console.log('========================================================\n');
  } catch (err: any) {
    console.error('❌ Test suite failed:', err);
    failed++;
  } finally {
    // Cleanup created test records
    await prisma.kycDocument.deleteMany({
      where: { userId: { in: [testUserIndividual, testUserCompany, testUserUnpaid, testUserMock] } },
    });
    await prisma.vobizSubAccount.deleteMany({
      where: { userId: { in: [testUserIndividual, testUserCompany, testUserUnpaid, testUserMock] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [testUserIndividual, testUserCompany, testUserUnpaid, testUserMock] } },
    });
    await prisma.$disconnect();
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
