/**
 * Permanent Demo Data Purge Script
 * Cleans up seeded demo agents, fake calls, demo KB documents, and mock phone numbers from PostgreSQL/Supabase.
 */

require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');

function getPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return new PrismaClient();
  }
  const pool = new pg.Pool({
    connectionString: connectionString.includes('sslmode=require')
      ? connectionString.replace('sslmode=require', 'sslmode=no-verify')
      : connectionString,
    ssl: { rejectUnauthorized: false }
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

const prisma = getPrismaClient();

async function purgeDemoData() {
  console.log("====================================================");
  console.log("🧹 Starting Permanent Demo Data Purge across Database & Supabase");
  console.log("====================================================\n");

  const TEST_UUID = "1e69187e-82d5-4166-929f-4bbba90e5304";
  const TEST_PHONE = "+12345678901";

  try {
    // 1. Delete Demo Agents
    const deletedAgents = await prisma.agent.deleteMany({
      where: {
        OR: [
          { id: TEST_UUID },
          { name: { contains: "Claritiy HR Customer Support Screener" } },
          { name: { contains: "Demo" } },
          { name: { contains: "Test" } },
          { name: { contains: "E2E" } }
        ]
      }
    });
    console.log(`  [CLEANUP] Deleted ${deletedAgents.count} demo agent record(s).`);

    // 2. Delete Fake Call Logs
    const deletedCalls = await prisma.call.deleteMany({
      where: {
        OR: [
          { id: { contains: "test" } },
          { id: { contains: "demo" } },
          { recipientPhoneNumber: TEST_PHONE },
          { fromPhoneNumber: TEST_PHONE }
        ]
      }
    });
    console.log(`  [CLEANUP] Deleted ${deletedCalls.count} fake call log record(s).`);

    // 3. Delete Demo KB Documents
    const deletedKB = await prisma.knowledgeBase.deleteMany({
      where: {
        OR: [
          { name: { contains: "Demo" } },
          { name: { contains: "Sample" } },
          { name: { contains: "Test" } }
        ]
      }
    });
    console.log(`  [CLEANUP] Deleted ${deletedKB.count} demo Knowledge Base document(s).`);

    // 4. Delete Mock Phone Number
    const deletedNumbers = await prisma.phoneNumber.deleteMany({
      where: {
        phoneNumber: TEST_PHONE
      }
    });
    console.log(`  [CLEANUP] Deleted ${deletedNumbers.count} mock phone number (+12345678901).`);

    console.log("\n====================================================");
    console.log("Purge Summary: Permanent demo data purge complete ✓");
    console.log("====================================================");
  } catch (err) {
    console.error("Purge Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

purgeDemoData();
