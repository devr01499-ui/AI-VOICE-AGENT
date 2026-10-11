require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');

/**
 * Statutory PAN 4th-character entity category derivation (NSDL / Income Tax Department rule):
 * - Character 4 = 'P' (Person / Individual) -> 'personal'
 * - Character 4 = 'H' (Hindu Undivided Family) -> 'personal'
 * - Character 4 in ['C', 'F', 'A', 'T', 'B', 'L', 'J', 'G'] -> 'company'
 */
function derivePanCategory(panNumber) {
  if (!panNumber || typeof panNumber !== 'string') return 'personal';
  const clean = panNumber.trim().toUpperCase();
  if (clean.length < 4) return 'personal';
  const fourthChar = clean.charAt(3);
  if (fourthChar === 'P' || fourthChar === 'H') {
    return 'personal';
  }
  if (['C', 'F', 'A', 'T', 'B', 'L', 'J', 'G'].includes(fourthChar)) {
    return 'company';
  }
  return 'personal';
}

async function main() {
  const connectionString = (process.env.DATABASE_URL || '').replace('sslmode=require', 'sslmode=no-verify');
  const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('=== STARTING PAN CATEGORY AUDIT & BACKFILL ===');

  try {
    // 1. Audit all PAN KycDocument rows
    const panDocs = await prisma.$queryRawUnsafe(
      "SELECT * FROM kyc_documents WHERE document_type = 'pan'"
    );
    console.log(`Found ${panDocs.length} total PAN KycDocument rows.`);

    let correctedCount = 0;
    let aadhaarGatedCount = 0;

    for (const doc of panDocs) {
      const panNum = doc.pan_number || '';
      const declaredType = (doc.pan_type || '').toLowerCase();
      const derivedType = derivePanCategory(panNum);

      console.log(`PAN Doc ID=${doc.id}, User=${doc.user_id}, Declared=${declaredType}, Derived=${derivedType}, PAN=${panNum}`);

      // Check if declared company but derived is personal (or 4th char is P)
      if (declaredType === 'company' && (derivedType === 'personal' || panNum.charAt(3) === 'P')) {
        console.warn(`[ALERT] Individual PAN falsely declared as company! Correcting User=${doc.user_id}`);

        // Update KycDocument to personal
        await prisma.$executeRawUnsafe(
          "UPDATE kyc_documents SET pan_type = 'personal' WHERE id = $1",
          doc.id
        );
        correctedCount++;

        // Check if user has verified Aadhaar
        const aadhaarDocs = await prisma.$queryRawUnsafe(
          "SELECT * FROM kyc_documents WHERE user_id = $1 AND document_type = 'aadhaar' AND status = 'verified'",
          doc.user_id
        );

        if (aadhaarDocs.length === 0) {
          console.warn(`[SECURITY_GATE] User=${doc.user_id} has no verified Aadhaar! Revoking sub-account KYC elevation and locking numbers.`);

          // Reset sub-account KYC status and block calls
          await prisma.$executeRawUnsafe(
            "UPDATE vobiz_sub_accounts SET kyc_status = 'pending', kyc_calls_blocked = true, business_type = 'individual' WHERE user_id = $1",
            doc.user_id
          );

          // Reset active phone numbers to pending kyc
          await prisma.$executeRawUnsafe(
            "UPDATE phone_numbers SET kyc_status = 'pending' WHERE user_id = $1",
            doc.user_id
          );

          aadhaarGatedCount++;
        }
      } else if (declaredType === 'personal' && derivedType === 'company') {
        console.warn(`[NOTICE] Company PAN marked personal. Updating User=${doc.user_id} to company.`);
        await prisma.$executeRawUnsafe(
          "UPDATE kyc_documents SET pan_type = 'company' WHERE id = $1",
          doc.id
        );
        correctedCount++;
      }
    }

    // 2. Align any vobiz_sub_accounts where business_type contradicts PAN document
    const subAccounts = await prisma.$queryRawUnsafe("SELECT * FROM vobiz_sub_accounts");
    for (const sa of subAccounts) {
      const userPan = panDocs.find((p) => p.user_id === sa.user_id);
      if (userPan) {
        const panCategory = (userPan.pan_type || '').toLowerCase();
        if (panCategory === 'personal' && (sa.business_type || '').toLowerCase() === 'company') {
          console.log(`Aligning SubAccount ID=${sa.id} business_type to individual (PAN is personal)`);
          await prisma.$executeRawUnsafe(
            "UPDATE vobiz_sub_accounts SET business_type = 'individual' WHERE id = $1",
            sa.id
          );
        }
      }
    }

    console.log('\n=== AUDIT & BACKFILL SUMMARY ===');
    console.log(`Total PAN documents audited: ${panDocs.length}`);
    console.log(`Total category mismatches corrected: ${correctedCount}`);
    console.log(`Total unverified individual accounts gated for Aadhaar: ${aadhaarGatedCount}`);
    console.log('Backfill successfully completed.');
  } catch (err) {
    console.error('Error during PAN category backfill:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch(console.error);
