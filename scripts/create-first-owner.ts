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
import { supabaseAdmin } from '../server/src/utils/supabase';

async function bootstrapFirstOwner() {
  const email = (process.env.FIRST_OWNER_EMAIL || '').toLowerCase().trim();
  const name = process.env.FIRST_OWNER_NAME?.trim() || 'Claritiy Owner';
  const password = process.env.FIRST_OWNER_PASSWORD?.trim();

  if (!email || !email.includes('@')) {
    console.error('ERROR: FIRST_OWNER_EMAIL environment variable is required and must be a valid email.');
    process.exit(1);
  }

  console.log(`[BOOTSTRAP] Checking status of owner account: ${email}...`);

  // 1. Database staffUser record
  const existingStaff = await prisma.staffUser.findUnique({
    where: { email },
  });

  if (existingStaff) {
    if (existingStaff.role !== 'owner' || existingStaff.status !== 'active') {
      const updated = await prisma.staffUser.update({
        where: { email },
        data: {
          role: 'owner',
          status: 'active',
        },
      });
      console.log(`[BOOTSTRAP] Updated existing staff member ${email} to active owner role. (ID: ${updated.id})`);
    } else {
      console.log(`[BOOTSTRAP] Staff user ${email} is already an active owner. (ID: ${existingStaff.id})`);
    }
  } else {
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

  // 2. Supabase Auth account creation / password update
  if (supabaseAdmin && password) {
    console.log(`[BOOTSTRAP] Syncing Supabase Auth credentials for ${email}...`);
    try {
      const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) {
        console.warn('[BOOTSTRAP] Could not list Supabase users:', listError.message);
      } else {
        const supaUser = listData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
        if (supaUser) {
          const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(supaUser.id, {
            password,
            email_confirm: true,
          });
          if (updateErr) {
            console.error('[BOOTSTRAP] Failed to update password in Supabase Auth:', updateErr.message);
          } else {
            console.log(`[BOOTSTRAP] Successfully updated Supabase Auth password for ${email}. (UID: ${supaUser.id})`);
          }
        } else {
          const { data: newSupaUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { name, role: 'owner' },
          });
          if (createErr) {
            console.error('[BOOTSTRAP] Failed to create user in Supabase Auth:', createErr.message);
          } else {
            console.log(`[BOOTSTRAP] Successfully created Supabase Auth user for ${email}. (UID: ${newSupaUser.user?.id})`);
          }
        }
      }
    } catch (authErr: any) {
      console.error('[BOOTSTRAP] Supabase Auth sync error:', authErr.message);
    }
  } else if (!supabaseAdmin) {
    console.warn('[BOOTSTRAP] SUPABASE_SERVICE_ROLE_KEY not configured, skipped Supabase Auth sync.');
  }
}

bootstrapFirstOwner()
  .catch((err) => {
    console.error('[BOOTSTRAP_ERROR] Failed to bootstrap first owner:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
