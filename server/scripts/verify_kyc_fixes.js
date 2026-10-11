const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { EncryptionService } = require('../dist/utils/EncryptionService');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');

async function runVerification() {
  console.log('====================================================');
  console.log('🧪 Starting Full KYC & Encryption Verification Suite');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // --- Test 1: Dedicated & Versioned Encryption ---
  console.log('--- Test 1: Dedicated & Versioned Encryption ---');
  const samplePlaintext = 'test_token_secret_12345';
  const encrypted = EncryptionService.encrypt(samplePlaintext);
  assert(encrypted.startsWith('v2:'), 'New ciphertext is prefixed with v2:');
  assert(EncryptionService.isEncrypted(encrypted), 'isEncrypted recognizes v2: format');

  const decrypted = EncryptionService.decrypt(encrypted);
  assert(decrypted === samplePlaintext, 'Decryption of v2: ciphertext matches plaintext');

  // --- Test 2: Multi-Key Legacy Fallback & Webhook Secret Rotation ---
  console.log('\n--- Test 2: Multi-Key Fallback & Webhook Secret Rotation ---');
  const rawConnectionString = process.env.DATABASE_URL;
  const connectionString = rawConnectionString.includes('sslmode=require')
    ? rawConnectionString.replace('sslmode=require', 'sslmode=no-verify')
    : rawConnectionString;

  const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const existingSub = await prisma.vobizSubAccount.findFirst({
      where: { authId: 'SA_DLBISHQG' }
    });
    assert(!!existingSub, 'Found existing sub-account SA_DLBISHQG in database');

    const meta = EncryptionService.decryptWithMetadata(existingSub.authToken);
    assert(meta.plaintext.length === 64, 'Successfully decrypted legacy token (64 chars)');

    // Simulate rotating VOBIZ_WEBHOOK_SECRET to a random string
    process.env.VOBIZ_WEBHOOK_SECRET = 'completely_new_rotated_webhook_secret_' + Date.now();
    const metaAfterRotate = EncryptionService.decryptWithMetadata(existingSub.authToken);
    assert(metaAfterRotate.plaintext === meta.plaintext, 'Sub-account token STILL decrypts after rotating VOBIZ_WEBHOOK_SECRET');

    // --- Test 3: Lazy Migration ---
    console.log('\n--- Test 3: Lazy Migration ---');
    const migratedCipher = EncryptionService.encrypt(meta.plaintext);
    assert(migratedCipher.startsWith('v2:'), 'Migrated token re-encrypted as v2:');
    const metaV2 = EncryptionService.decryptWithMetadata(migratedCipher);
    assert(!metaV2.isLegacy && !metaV2.needsMigration, 'v2: token does not need migration');

    // --- Test 4: Real Vobiz PAN Verification Endpoint ---
    console.log('\n--- Test 4: Real Vobiz Document Verification Spec ---');
    const baseUrl = (process.env.VOBIZ_API_URL || 'https://api.vobiz.ai').replace(/\/+$/, '').replace(/\/api\/v1$/i, '');
    const masterAuthId = process.env.VOBIZ_AUTH_ID;
    const masterAuthToken = process.env.VOBIZ_AUTH_TOKEN;

    const panUrl = `${baseUrl}/api/v1/sub-accounts/${existingSub.authId}/kyc/verify-pan`;

    // 4a: Test intentionally invalid PAN
    const invalidPanRes = await fetch(panUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-ID': masterAuthId,
        'X-Auth-Token': masterAuthToken,
      },
      body: JSON.stringify({ pan: 'ABCDE1234F' })
    });
    assert(invalidPanRes.status === 200, 'Real Vobiz endpoint responds with 200 for PAN verification check');
    const invalidPanData = await invalidPanRes.json();
    assert(invalidPanData.status === 'failed', 'Intentionally invalid PAN correctly returns status: failed');
    assert(!!invalidPanData.message, 'Invalid PAN returns plain reason: ' + invalidPanData.message);

    // 4b: Test provider auth failure simulation (bad master credentials)
    const badAuthRes = await fetch(panUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-ID': 'MA_INVALID',
        'X-Auth-Token': 'tok_invalid',
      },
      body: JSON.stringify({ pan: 'ABCDE1234F' })
    });
    assert(badAuthRes.status === 401 || badAuthRes.status === 403, 'Provider returns 401/403 when credentials bad');

    // --- Test 5: KycDocument PII Masking & Reset State ---
    console.log('\n--- Test 5: KycDocument Database State ---');
    const doc = await prisma.kycDocument.findFirst({
      where: { userId: existingSub.userId, documentType: 'pan' }
    });
    if (doc) {
      assert(doc.status === 'pending', 'Erroneously failed doc was reset to pending');
      assert(!doc.failureReason, 'Failure reason was cleared on reset');
    }

  } finally {
    await prisma.$disconnect();
    await pool.end();
  }

  console.log('\n====================================================');
  console.log(`Audit Summary: ${passed} passed, ${failed} failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification();
