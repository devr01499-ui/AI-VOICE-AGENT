import fs from 'fs';
import path from 'path';
import { prisma } from '../src/lib/prisma';
import { logger } from '../src/utils/logger';

async function runMigration() {
  const migrationPath = path.join(__dirname, '../prisma/migrations/20261028170000_add_analysis_jobs_and_call_results/migration.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  logger.info('[MIGRATION] Applying 20261028170000_add_analysis_jobs_and_call_results...');
  
  // Split statements by semicolon or execute as block
  await prisma.$executeRawUnsafe(sql);
  
  logger.info('[MIGRATION_SUCCESS] Successfully created analysis_jobs and call_results tables and indexes.');
  process.exit(0);
}

runMigration().catch(err => {
  logger.error('[MIGRATION_FAILED]', { error: err.message, stack: err.stack });
  process.exit(1);
});
