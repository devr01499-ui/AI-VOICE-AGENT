/**
 * Claritiy Voice — Plan Catalog Seeding Script
 * Seeds the public plans from PLAN_CONFIG into the additive plan_catalog database table.
 *
 * Usage:
 *   npx tsx scripts/seed-plan-catalog.ts
 */

import 'dotenv/config';
import { prisma } from '../server/src/lib/prisma';
import { PLAN_CONFIG } from '../server/src/config/plans';

async function seedPlanCatalog() {
  console.log('[PLAN_CATALOG] Seeding catalog from PLAN_CONFIG...');

  for (const [key, config] of Object.entries(PLAN_CONFIG)) {
    const planKey = key.toLowerCase();
    const existing = await prisma.planCatalog.findUnique({
      where: { key: planKey },
    });

    if (existing) {
      console.log(`[PLAN_CATALOG] Plan '${planKey}' already exists. Updating price/minutes to match config.`);
      await prisma.planCatalog.update({
        where: { key: planKey },
        data: {
          name: config.name,
          priceInr: config.price,
          minutes: config.minutes,
          accountType: config.accountType || 'developer',
          isPublic: true,
          active: true,
        },
      });
    } else {
      console.log(`[PLAN_CATALOG] Creating plan '${planKey}': ₹${config.price} for ${config.minutes} mins`);
      await prisma.planCatalog.create({
        data: {
          key: planKey,
          name: config.name,
          priceInr: config.price,
          minutes: config.minutes,
          accountType: config.accountType || 'developer',
          isPublic: true,
          active: true,
          createdBy: 'system_seed',
        },
      });
    }
  }

  const allPlans = await prisma.planCatalog.findMany();
  console.log(`[PLAN_CATALOG] Seeding complete. Total active plans in DB: ${allPlans.length}`);
}

seedPlanCatalog()
  .catch((err) => {
    console.error('[PLAN_CATALOG_ERROR] Seeding failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
