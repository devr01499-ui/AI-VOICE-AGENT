require('dotenv').config();
const assert = require('assert');
const { derivePanCategory, checkRequiredKycDocumentsVerified } = require('../dist/services/KycVerificationService');

async function testPanGating() {
  console.log('=== RUNNING PAN KYC GATING & MISMATCH TESTS ===\n');

  // Test 1: Statutory derivation
  const personalPan = 'ABCPE1234F';
  const companyPan = 'ABCCO1234F';

  assert.strictEqual(derivePanCategory(personalPan), 'personal');
  assert.strictEqual(derivePanCategory(companyPan), 'company');
  console.log('✓ Statutory PAN derivation verified (P -> personal, C -> company)');

  // Test 2: KycVerificationService enforcement
  // Even if subAccount.businessType was 'company', an individual PAN MUST force Aadhaar
  const testUserId = '1e69187e-82d5-4166-929f-4bbba90e5304';
  const kycResult = await checkRequiredKycDocumentsVerified(testUserId);

  console.log('User KYC Result:', {
    verified: kycResult.verified,
    businessType: kycResult.businessType,
    requiredDocs: kycResult.requiredDocs,
    missing: kycResult.missing,
  });

  // Verify that an account with a personal PAN is classified as 'individual' and requires Aadhaar
  assert.strictEqual(kycResult.businessType, 'individual', 'Expected user with personal PAN to be classified as individual');
  assert.ok(kycResult.requiredDocs.includes('Aadhaar'), 'Expected Aadhaar to be in requiredDocs for personal PAN holder');
  assert.ok(!kycResult.requiredDocs.includes('GST'), 'GST should not be required for personal PAN holder');
  console.log('✓ KycVerificationService strictly forces Aadhaar for personal PAN holders, completely blocking Aadhaar bypass!');

  console.log('\n=== ALL PAN GATING VERIFICATION TESTS PASSED! ===');
  process.exit(0);
}

testPanGating().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
