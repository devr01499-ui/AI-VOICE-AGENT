/**
 * Claritiy Voice — First Owner Bootstrap Script
 *
 * Usage:
 *   FIRST_OWNER_EMAIL="founder@claritiy.com" FIRST_OWNER_NAME="Founder" npx tsx scripts/create-first-owner.ts
 *
 * Recovery Path:
 *   If the owner is locked out, set FIRST_OWNER_EMAIL in Render/server environment variables
 *   and re-run this script, or execute direct SQL:
 *   INSERT INTO staff_users (id, email, name, role, status, updated_at)
 *   VALUES (gen_random_uuid(), 'recovery@claritiy.com', 'Owner', 'owner', 'active', NOW())
 *   ON CONFLICT (email) DO UPDATE SET role = 'owner', status = 'active';
 */

import 'dotenv/config';
import { prisma } from '../server/src/lib/prisma';

async function bootstrapFirstOwner() {
  const email = (process.env.FIRST_OWNER_EMAIL || '').toLowerCase().trim();
  const name = process.env.FIRST_OWNER_NAME?.trim() || 'Claritiy Owner';

  if (!email || !email.includes('@')) {
    console.error('ERROR: FIRST_OWNER_EMAIL environment variable is required and must be a valid email.');
    process.exit(1);
  }

  console.log(`[BOOTSTRAP] Checking status of owner account: ${email}...`);

  const existingStaff = await prisma.staffUser.findUnique({
    where: { email },
  });

  if (existingStaff) {
    if (existingStaff.role === 'owner' && existingStaff.status === 'active') {
      console.log(`[BOOTSTRAP] Staff user ${email} is already an active owner. (ID: ${existingStaff.id})`);
      process.exit(0);
    }

    const updated = await prisma.staffUser.update({
      where: { email },
      data: {
        role: 'owner',
        status: 'active',
      },
    });
    console.log(`[BOOTSTRAP] Updated existing staff member ${email} to active owner role. (ID: ${updated.id})`);
    process.exit(0);
  }

  const created = await prisma.staffUser.create({
    data: {
      email,
      name,
      role: 'owner',
      status: 'active',
      createdBy: 'system_bootstrap',
    },
  });

  console.log(`[BOOTSTRAP] Successfully created initial owner: ${created.email} (ID: ${created.id})`);
}

bootstrapFirstOwner()
  .catch((err) => {
    console.error('[BOOTSTRAP_ERROR] Failed to bootstrap first owner:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
