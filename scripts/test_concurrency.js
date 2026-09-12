require('dotenv').config({ path: './server/.env' });
const { prisma } = require('../server/dist/lib/prisma');
const { CallOrchestrator } = require('../server/dist/core/orchestrator/CallOrchestrator');

async function runTest() {
  console.log("=== Phase 6 Concurrency Telemetry Verification ===");

  let passed = 0;
  let failed = 0;

  function assert(condition, description) {
    if (condition) {
      console.log(`  [PASS] ${description}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${description}`);
      failed++;
    }
  }

  try {
    const user = await prisma.user.findFirst();
    if (!user) {
      throw new Error("No test user found in database");
    }

    console.log(`Test user: ${user.email} (id: ${user.id})`);

    // Test 1: Query initial concurrency limit
    const initialLimit = user.maxConcurrentCalls ?? 10;
    assert(typeof initialLimit === 'number' && initialLimit > 0, `Initial soft concurrency limit valid (${initialLimit})`);

    // Test 2: In-memory & DB Call Session active call count query
    const orchestratorCount = CallOrchestrator.instance.getActiveCallCountForUser(user.id);
    const dbCount = await prisma.callSession.count({
      where: {
        userId: user.id,
        status: { in: ['IN_PROGRESS', 'initiated', 'queued', 'active'] },
      },
    });

    const activeCount = Math.max(orchestratorCount, dbCount);
    assert(typeof activeCount === 'number' && activeCount >= 0, `Active concurrent call count calculated: ${activeCount}`);

    // Test 3: Update soft limit to 25
    console.log("\nUpdating soft limit to 25...");
    await prisma.user.update({
      where: { id: user.id },
      data: { maxConcurrentCalls: 25 },
    });

    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
    assert(updatedUser.maxConcurrentCalls === 25, "Soft limit successfully updated to 25 in database");

    // Test 4: Reset soft limit back to 10
    await prisma.user.update({
      where: { id: user.id },
      data: { maxConcurrentCalls: 10 },
    });
    console.log("Reset soft limit back to 10.");

    console.log("\n==========================================");
    console.log(`Summary: ${passed} Passed, ${failed} Failed`);
    console.log("==========================================");

    if (failed > 0) process.exit(1);

  } catch (err) {
    console.error("❌ Verification failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
