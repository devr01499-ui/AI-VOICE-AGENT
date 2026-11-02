/**
 * Claritiy Voice — Admin Plan Upgrade Script
 * 
 * Usage:
 *   npx tsx scripts/admin_upgrade_plan.ts --email=devr0144@gmail.com --plan=growth --reason="special gesture / promotional upgrade" --dry-run
 *   npx tsx scripts/admin_upgrade_plan.ts --email=devr0144@gmail.com --plan=growth --reason="special gesture / promotional upgrade"
 *
 * Flags:
 *   --email=    User email to upgrade (required)
 *   --plan=     Target plan key from plans.ts (required)
 *   --reason=   Audit log reason (required)
 *   --dry-run   Print what would happen without writing anything (default: false)
 *   --rollback  Print the rollback command for the current state (reads current state, exits)
 */

import path from 'path';
import dotenv from 'dotenv';

// Load root and server environment configurations before importing database client
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { prisma } from '../src/lib/prisma';
import { PLAN_CONFIG } from '../src/config/plans';
import { fulfillPlanPurchase } from '../src/services/PlanFulfillmentService';

interface CommandLineArgs {
  email?: string;
  plan?: string;
  reason?: string;
  dryRun: boolean;
  rollback: boolean;
}

function parseCommandLineArgs(): CommandLineArgs {
  const rawArgs = process.argv.slice(2);
  const parsed: CommandLineArgs = {
    dryRun: false,
    rollback: false,
  };

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];

    if (arg === '--dry-run' || arg === '--dryRun') {
      parsed.dryRun = true;
    } else if (arg === '--rollback') {
      parsed.rollback = true;
    } else if (arg.startsWith('--email=')) {
      parsed.email = arg.substring('--email='.length).trim().replace(/^['"]|['"]$/g, '');
    } else if (arg === '--email' && i + 1 < rawArgs.length) {
      parsed.email = rawArgs[++i].trim().replace(/^['"]|['"]$/g, '');
    } else if (arg.startsWith('--plan=')) {
      parsed.plan = arg.substring('--plan='.length).trim().replace(/^['"]|['"]$/g, '');
    } else if (arg === '--plan' && i + 1 < rawArgs.length) {
      parsed.plan = rawArgs[++i].trim().replace(/^['"]|['"]$/g, '');
    } else if (arg.startsWith('--reason=')) {
      parsed.reason = arg.substring('--reason='.length).trim().replace(/^['"]|['"]$/g, '');
    } else if (arg === '--reason' && i + 1 < rawArgs.length) {
      parsed.reason = rawArgs[++i].trim().replace(/^['"]|['"]$/g, '');
    }
  }

  return parsed;
}

async function resolveCurrentPlan(userId: string, accountType: string): Promise<string> {
  // 1. Check latest successful payment transaction
  const latestTx = await prisma.paymentTransaction.findFirst({
    where: { userId, status: 'completed' },
    orderBy: { createdAt: 'desc' },
  });

  if (latestTx?.planName) {
    const txPlan = latestTx.planName.trim().toLowerCase();
    if (PLAN_CONFIG[txPlan]) return txPlan;
    // Map known names
    for (const [key, details] of Object.entries(PLAN_CONFIG)) {
      if (details.name.toLowerCase() === txPlan) return key;
    }
  }

  // 2. Map based on user.accountType
  const type = (accountType || 'free').toLowerCase();
  if (type === 'professional') return 'growth';
  if (type === 'developer') return 'startup';
  if (type === 'starter') return 'starter';
  if (type === 'trial') return 'trial';
  if (type === 'enterprise') return 'enterprise';
  if (type === 'growth') return 'growth';

  return type;
}

async function main(): Promise<void> {
  const args = parseCommandLineArgs();

  // 1. Validate Email Flag
  if (!args.email) {
    console.error('ERROR: Missing required flag --email=<user@example.com>');
    console.error('Usage: npx tsx scripts/admin_upgrade_plan.ts --email=<email> --plan=<plan> --reason="<reason>" [--dry-run] [--rollback]');
    process.exit(1);
  }

  const email = args.email;

  // 2. Look up user by email
  let user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user && email.toLowerCase() !== email) {
    user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  if (!user) {
    console.error(`ERROR: User ${email} not found in the database. Not creating.`);
    process.exit(1);
  }

  // 3. Confirm exactly one match & resolve current state
  const currentPlan = await resolveCurrentPlan(user.id, user.accountType);

  console.log(`User match confirmed:`);
  console.log(`  id: ${user.id}`);
  console.log(`  currentPlan: ${currentPlan}`);
  console.log(`  currentCredits: ${user.callingBalanceMinutes} minutes (${user.minutesRemainingSeconds} seconds)`);

  // Handle Rollback flag inspection mode
  if (args.rollback) {
    // Check previous upgrade audit log to identify original plan
    const latestAudit = await prisma.auditLog.findFirst({
      where: {
        targetId: user.id,
        action: 'PLAN_UPGRADE',
      },
      orderBy: { createdAt: 'desc' },
    });

    let originalPlan = 'free';
    if (latestAudit && latestAudit.metadata && typeof latestAudit.metadata === 'object') {
      const meta = latestAudit.metadata as Record<string, any>;
      if (meta.fromPlan) {
        originalPlan = meta.fromPlan;
      }
    }

    console.log(`\nROLLBACK COMMAND (run to undo this change):`);
    console.log(`npx tsx scripts/admin_upgrade_plan.ts --email=${user.email} --plan=${originalPlan} --reason="rollback of promo upgrade"\n`);
    process.exit(0);
  }

  // Validate Plan and Reason for upgrade/downgrade execution
  if (!args.plan) {
    console.error('ERROR: Missing required flag --plan=<planKey> (e.g. --plan=growth)');
    process.exit(1);
  }

  if (!args.reason || !args.reason.trim()) {
    console.error('ERROR: Missing required flag --reason="<reason for audit>"');
    process.exit(1);
  }

  const targetPlanKey = args.plan.toLowerCase();

  // Validate target plan definition against PLAN_CONFIG or PlanCatalog
  const catalogPlan = await prisma.planCatalog.findUnique({
    where: { key: targetPlanKey },
  });
  const staticPlan = PLAN_CONFIG[targetPlanKey];

  if (!catalogPlan && !staticPlan && targetPlanKey !== 'free') {
    const validKeys = Object.keys(PLAN_CONFIG).concat(['free']).join(', ');
    console.error(`ERROR: Target plan '${args.plan}' is not recognized. Valid plans: ${validKeys}`);
    process.exit(1);
  }

  const targetPlanDisplayName = catalogPlan?.name || staticPlan?.name || (targetPlanKey === 'free' ? 'Free' : targetPlanKey);
  const targetAccountType = catalogPlan?.accountType || staticPlan?.accountType || (targetPlanKey === 'free' ? 'free' : targetPlanKey);
  const targetMinutes = catalogPlan?.minutes || staticPlan?.minutes || 0;

  // 4. Check idempotency: If user is already on the target plan, nothing to do
  const isAlreadyOnPlan =
    currentPlan.toLowerCase() === targetPlanKey ||
    user.accountType.toLowerCase() === targetAccountType.toLowerCase() ||
    user.accountType.toLowerCase() === targetPlanKey;

  if (isAlreadyOnPlan) {
    console.log(`User is already on ${targetPlanDisplayName} plan. Nothing to do.`);
    process.exit(0);
  }

  // 5. Print before state
  console.log(`\nBEFORE:`);
  console.log(`  id: ${user.id}`);
  console.log(`  email: ${user.email}`);
  console.log(`  currentPlan: ${currentPlan}`);
  console.log(`  callingBalanceMinutes: ${user.callingBalanceMinutes}`);
  console.log(`  accountType: ${user.accountType}`);

  // Construct Rollback Command for this specific user and current state
  const rollbackCommand = `npx tsx scripts/admin_upgrade_plan.ts --email=${user.email} --plan=${currentPlan} --reason="rollback of promo upgrade"`;

  // 10. Dry-run mode
  if (args.dryRun) {
    console.log(`\n[DRY RUN] Would execute:`);
    console.log(`  - Code path: ${targetPlanKey === 'free' ? 'Direct Prisma accountType reset' : 'PlanFulfillmentService.fulfillPlanPurchase'}`);
    console.log(`  - Target Plan: '${targetPlanKey}' (${targetPlanDisplayName})`);
    console.log(`  - Target Account Type: '${targetAccountType}'`);
    console.log(`  - Minutes to Grant: ${targetMinutes} minutes (${targetMinutes * 60} seconds)`);
    console.log(`  - Projected Calling Balance: ${user.callingBalanceMinutes + targetMinutes} minutes`);
    console.log(`  - Payment ID Sentinel: ADMIN_NO_CHARGE_PROMO_<timestamp>`);
    console.log(`  - Order ID Sentinel: ADMIN_ORDER_PROMO_<timestamp>`);
    console.log(`  - Financial charge: ₹0 (promotional / special gesture)`);
    console.log(`  - Audit log entries: AuditLog & AdminAuditLog`);
    console.log(`\nROLLBACK COMMAND (run to undo this change):`);
    console.log(`${rollbackCommand}\n`);
    process.exit(0);
  }

  // 6. Use PlanFulfillmentService.fulfillPlanPurchase (Authoritative real upgrade code path)
  const timestamp = Date.now();
  const sentinelPaymentId = `ADMIN_NO_CHARGE_PROMO_${timestamp}`;
  const sentinelOrderId = `ADMIN_ORDER_PROMO_${timestamp}`;

  if (targetPlanKey === 'free') {
    // Direct Prisma reset for free tier rollback
    await prisma.user.update({
      where: { id: user.id },
      data: {
        accountType: 'free',
      },
    });
  } else {
    // Real upgrade code path: PlanFulfillmentService handles atomic payment transaction,
    // minutes ledger crediting via MinutesService, accountType update, and GST invoice generation.
    await fulfillPlanPurchase({
      userId: user.id,
      orderId: sentinelOrderId,
      paymentId: sentinelPaymentId,
      planKey: targetPlanKey,
      source: 'admin',
      staffId: 'SYSTEM_ADMIN',
      amountOverrideInr: 0, // ₹0 charge for special gesture / promo upgrade
    });
  }

  // Query updated user state
  const updatedUser = await prisma.user.findUnique({
    where: { id: user.id },
  });

  if (!updatedUser) {
    throw new Error(`CRITICAL: User record ${user.id} disappeared after upgrade execution.`);
  }

  // 7. Write audit log rows
  // Write to customer-visible AuditLog
  await prisma.auditLog.create({
    data: {
      workspaceOwnerId: user.id,
      actorUserId: 'SYSTEM_ADMIN',
      action: 'PLAN_UPGRADE',
      targetId: user.id,
      metadata: {
        fromPlan: currentPlan,
        toPlan: targetPlanKey,
        reason: args.reason,
        scriptVersion: '1.0',
        executedAt: new Date().toISOString(),
      },
    },
  });

  // Write to administrative AdminAuditLog
  await prisma.adminAuditLog.create({
    data: {
      staffId: 'SYSTEM_ADMIN',
      staffEmail: 'admin@claritiy.ai',
      staffRole: 'owner',
      action: 'PLAN_UPGRADE',
      targetType: 'user',
      targetId: user.id,
      customerId: user.id,
      reason: args.reason,
      before: {
        plan: currentPlan,
        callingBalanceMinutes: user.callingBalanceMinutes,
        accountType: user.accountType,
      },
      after: {
        plan: targetPlanKey,
        callingBalanceMinutes: updatedUser.callingBalanceMinutes,
        accountType: updatedUser.accountType,
      },
    },
  });

  // 8. Print after state
  console.log(`\nAFTER:`);
  console.log(`  id: ${updatedUser.id}`);
  console.log(`  email: ${updatedUser.email}`);
  console.log(`  currentPlan: ${targetPlanKey}`);
  console.log(`  callingBalanceMinutes: ${updatedUser.callingBalanceMinutes}`);
  console.log(`  accountType: ${updatedUser.accountType}`);

  // 9. Print rollback command
  console.log(`\nROLLBACK COMMAND (run to undo this change):`);
  console.log(`${rollbackCommand}\n`);
}

// 11. Error handling: wrap in try/catch, always disconnect prisma in finally
main()
  .catch((err) => {
    console.error('\nERROR: Execution failed:', err.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
