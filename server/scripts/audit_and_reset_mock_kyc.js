require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const connectionString = (process.env.DATABASE_URL || '').replace('sslmode=require', 'sslmode=no-verify');
  const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  let supabase = null;
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }

  console.log('=== STARTING KYC AUDIT & RESET MIGRATION ===');

  try {
    // 1. Audit KycDocument rows
    const docs = await prisma.$queryRawUnsafe('SELECT * FROM kyc_documents');
    console.log(`Found ${docs.length} total KycDocument rows.`);

    let resetCount = 0;
    for (const doc of docs) {
      const ref = doc.vobiz_reference || '';
      const isMockRef = ref.startsWith('vob_pan_') || ref.startsWith('vob_gst_') || ref.startsWith('vob_adh_') || ref.startsWith('mock_') || ref.startsWith('AR_MOCK_');
      const isStrayFile = String(doc.aadhaar_doc_url || '').includes('Partners-SOP_digilocker.pdf');

      // Check if associated with mock subaccount
      const subAccounts = await prisma.$queryRawUnsafe('SELECT * FROM vobiz_sub_accounts WHERE user_id = $1', doc.user_id);
      const isMockSubAccount = subAccounts.some((s) => s.auth_id?.startsWith('SA_MOCK_') || s.auth_id?.startsWith('SA_TEST_'));

      if ((doc.status === 'verified' && (isMockRef || isMockSubAccount)) || isStrayFile) {
        console.log(`Resetting fraudulent/mock-verified KycDocument: ID=${doc.id}, User=${doc.user_id}, Type=${doc.document_type}, Ref=${ref}`);

        await prisma.$executeRawUnsafe(
          `UPDATE kyc_documents
           SET status = 'pending',
               verified_at = NULL,
               failure_reason = 'Verification reset: Simulated verification detected. Please complete live verification against government records.',
               aadhaar_doc_url = CASE WHEN aadhaar_doc_url LIKE '%Partners-SOP_digilocker.pdf%' THEN NULL ELSE aadhaar_doc_url END
           WHERE id = $1`,
          doc.id
        );
        resetCount++;
      }
    }
    console.log(`Reset ${resetCount} mock-verified KycDocument rows.`);

    // 2. Audit VobizSubAccount rows marked verified with mock credentials or incomplete docs
    const subAccounts = await prisma.$queryRawUnsafe('SELECT * FROM vobiz_sub_accounts');
    console.log(`Found ${subAccounts.length} total VobizSubAccount rows.`);

    for (const sub of subAccounts) {
      const isMockAuth = sub.auth_id?.startsWith('SA_MOCK_') || sub.auth_id?.startsWith('SA_TEST_');
      if (sub.kyc_status === 'verified' && isMockAuth) {
        console.log(`Resetting mock sub-account ${sub.auth_id} (User: ${sub.user_id}) from verified to pending.`);
        await prisma.$executeRawUnsafe(
          "UPDATE vobiz_sub_accounts SET kyc_status = 'pending', kyc_verified_at = NULL WHERE id = $1",
          sub.id
        );
      }

      // If user 1e69187e-82d5-4166-929f-4bbba90e5304 has SA_DLBISHQG (which failed on Vobiz)
      if (sub.auth_id === 'SA_DLBISHQG' && sub.kyc_status === 'verified') {
        console.log(`Resetting SA_DLBISHQG to failed matching live Vobiz provider status.`);
        await prisma.$executeRawUnsafe(
          "UPDATE vobiz_sub_accounts SET kyc_status = 'failed', kyc_verified_at = NULL WHERE id = $1",
          sub.id
        );
        await prisma.$executeRawUnsafe(
          "UPDATE phone_numbers SET kyc_status = 'pending' WHERE user_id = $1",
          sub.user_id
        );
      }
    }

    // 3. Remove stray test artifact Partners-SOP_digilocker.pdf from Supabase Storage
    if (supabase) {
      try {
        const filePath = '1e69187e-82d5-4166-929f-4bbba90e5304/aadhaar_1791701571302_Partners-SOP_digilocker.pdf';
        console.log(`Attempting deletion of stray test artifact from Supabase Storage: ${filePath}`);
        const { data, error } = await supabase.storage.from('kyc-documents').remove([filePath]);
        if (error) {
          console.warn('Supabase storage removal note:', error.message);
        } else {
          console.log('Successfully removed stray artifact from Supabase Storage:', data);
        }
      } catch (storageErr) {
        console.warn('Storage removal caught non-fatal exception:', storageErr.message);
      }
    }

    console.log('=== KYC AUDIT & RESET MIGRATION COMPLETE ===');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
