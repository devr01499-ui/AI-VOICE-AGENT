/**
 * Claritiy Voice — Seed Default Admin Settings
 * Populates default role caps and system configuration into admin_settings table.
 *
 * Usage:
 *   npx tsx scripts/seed-admin-settings.ts
 */

import 'dotenv/config';
import { prisma } from '../server/src/lib/prisma';
import { DEFAULT_CAPS } from '../server/src/admin/capEnforcement';

async function seedAdminSettings() {
  console.log('[ADMIN_SETTINGS] Seeding default settings into admin_settings table...');

  // 1. Seed Role Caps per Founder Decision #3
  for (const [role, caps] of Object.entries(DEFAULT_CAPS)) {
    const key = `caps_${role}`;
    // Replace Infinity with null for valid JSON storage
    const storageCaps = {
      maxMinutesPerGrant: caps.maxMinutesPerGrant === Infinity ? null : caps.maxMinutesPerGrant,
      maxMinutesPerDay: caps.maxMinutesPerDay === Infinity ? null : caps.maxMinutesPerDay,
      maxDiscountPercent: caps.maxDiscountPercent,
      canGrant: caps.canGrant,
      canDeduct: caps.canDeduct,
    };

    await prisma.adminSetting.upsert({
      where: { key },
      create: {
        key,
        value: storageCaps,
        updatedBy: 'system_seed',
      },
      update: {
        value: storageCaps,
        updatedBy: 'system_seed',
      },
    });
    console.log(`[ADMIN_SETTINGS] Seeded role caps for: ${role}`);
  }

  // 2. Seed General Settings
  const generalSettings = {
    brandName: 'Claritiy Voice',
    gstRate: 18.0,
    sellerGstin: '27AAPCA1234F1Z5',
    sellerLegalName: 'Claritiy Voice Technologies Private Limited',
    sellerAddress: 'Mumbai, Maharashtra, India',
    supportEmail: 'support@claritiy.com',
  };

  await prisma.adminSetting.upsert({
    where: { key: 'general_settings' },
    create: {
      key: 'general_settings',
      value: generalSettings,
      updatedBy: 'system_seed',
    },
    update: {
      value: generalSettings,
      updatedBy: 'system_seed',
    },
  });
  console.log('[ADMIN_SETTINGS] Seeded general_settings');

  console.log('[ADMIN_SETTINGS] Seeding completed successfully.');
}

seedAdminSettings()
  .catch((err) => {
    console.error('[ADMIN_SETTINGS_ERROR] Seeding failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
