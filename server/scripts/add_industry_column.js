const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { prisma } = require('../dist/lib/prisma');

async function main() {
  try {
    const res = await prisma.$executeRawUnsafe(`
      ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "industry" TEXT DEFAULT 'auto';
    `);
    console.log('Successfully ensured industry column exists in agents table:', res);
  } catch (err) {
    console.error('Failed to alter agents table:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
