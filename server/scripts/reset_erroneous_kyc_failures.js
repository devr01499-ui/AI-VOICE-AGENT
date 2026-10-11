const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');

async function main() {
  const rawConnectionString = process.env.DATABASE_URL;
  if (!rawConnectionString) {
    console.error('Missing DATABASE_URL');
    process.exit(1);
  }

  const connectionString = rawConnectionString.includes('sslmode=require')
    ? rawConnectionString.replace('sslmode=require', 'sslmode=no-verify')
    : rawConnectionString;

  const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$connect();
    console.log('Connected to database. Checking for erroneous 401 KYC failure records...');

    const erroneousDocs = await prisma.kycDocument.findMany({
      where: {
        status: 'failed',
        OR: [
          { failureReason: { contains: '401' } },
          { failureReason: { contains: 'Invalid authentication credentials' } },
          { failureReason: { contains: 'Verification provider returned status' } }
        ]
      }
    });

    console.log(`Found ${erroneousDocs.length} erroneous failed KYC document records to reset.`);

    for (const doc of erroneousDocs) {
      console.log(`Resetting doc ID: ${doc.id}, userId: ${doc.userId}, type: ${doc.documentType}`);
      await prisma.kycDocument.update({
        where: { id: doc.id },
        data: {
          status: 'pending',
          failureReason: null,
          vobizReference: null,
        }
      });
      console.log(`  -> Successfully reset doc ${doc.id} to status: 'pending'`);
    }

    console.log('Reset completed successfully.');
  } catch (err) {
    console.error('Error during KYC reset:', err);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
