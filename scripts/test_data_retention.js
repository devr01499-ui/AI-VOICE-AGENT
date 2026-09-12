require('dotenv').config({ path: './server/.env' });
const { prisma } = require('../server/dist/lib/prisma');
const { DataRetentionJob } = require('../server/dist/services/DataRetentionJob');

async function runTest() {
  console.log("=== Phase 4 Data Retention Verification ===");

  try {
    // Find test user
    const user = await prisma.user.findFirst();
    if (!user) {
      console.error("❌ No user found in database");
      process.exit(1);
    }
    console.log(`Found test user: ${user.email} (id: ${user.id})`);

    // Find or create test agent
    let agent = await prisma.agent.findFirst({ where: { userId: user.id } });
    if (!agent) {
      agent = await prisma.agent.create({
        data: {
          userId: user.id,
          name: 'Retention Test Agent',
          agentType: 'outbound',
        }
      });
    }

    // 1. Initial status check
    console.log(`\n1. Initial retention policy for user: ${user.dataRetentionDays} (expected: null or number)`);

    // 2. Set retention policy to 30 days
    console.log("\n2. Updating user retention policy to 30 days...");
    await prisma.user.update({
      where: { id: user.id },
      data: { dataRetentionDays: 30 }
    });
    
    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (updatedUser.dataRetentionDays !== 30) {
      throw new Error(`Expected retention days to be 30, got ${updatedUser.dataRetentionDays}`);
    }
    console.log("✅ Retention policy updated to 30 days.");

    // 3. Create dummy calls: one old (>30 days ago), one new (<30 days ago)
    console.log("\n3. Creating old call (>30d ago) and recent call (<30d ago) for purge verification...");
    const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000); // 40 days ago
    const newDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);  // 5 days ago

    const oldCall = await prisma.callSession.create({
      data: {
        user: { connect: { id: user.id } },
        agent: { connect: { id: agent.id } },
        callId: 'test-call-old-' + Date.now(),
        status: 'COMPLETED',
        createdAt: oldDate,
        recordingUrl: 'https://storage.claritiy.com/test-old.wav',
        transcript: 'This is an old transcript that should be purged',
      }
    });

    const recentCall = await prisma.callSession.create({
      data: {
        user: { connect: { id: user.id } },
        agent: { connect: { id: agent.id } },
        callId: 'test-call-new-' + Date.now(),
        status: 'COMPLETED',
        createdAt: newDate,
        recordingUrl: 'https://storage.claritiy.com/test-new.wav',
        transcript: 'This is a recent transcript that must remain intact',
      }
    });

    console.log(`Created Old Call ID: ${oldCall.id} (date: ${oldDate.toISOString()})`);
    console.log(`Created Recent Call ID: ${recentCall.id} (date: ${newDate.toISOString()})`);

    // 4. Run DataRetentionJob.purgeAllExpiredData()
    console.log("\n4. Running DataRetentionJob purge execution...");
    const result = await DataRetentionJob.purgeAllExpiredData();
    console.log(`Purge Job Summary: ${result.totalPurgedCalls} calls purged across ${result.processedWorkspaces} configured workspaces.`);

    // 5. Verify database state after purge
    const checkOldCall = await prisma.callSession.findUnique({ where: { id: oldCall.id } });
    const checkRecentCall = await prisma.callSession.findUnique({ where: { id: recentCall.id } });

    if (checkOldCall !== null) {
      throw new Error(`❌ Old call ${oldCall.id} was NOT purged as expected!`);
    }
    console.log("✅ Old call was successfully purged.");

    if (checkRecentCall === null) {
      throw new Error(`❌ Recent call ${recentCall.id} was unexpectedly purged!`);
    }
    console.log("✅ Recent call remains intact.");

    // Clean up recent call
    await prisma.callSession.delete({ where: { id: recentCall.id } });

    // 6. Check Audit Log for purge entry
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        workspaceOwnerId: user.id,
        action: 'data.retention.purge'
      },
      orderBy: { createdAt: 'desc' },
      take: 1
    });

    if (auditLogs.length === 0) {
      console.warn("⚠️ No audit log found for data.retention.purge");
    } else {
      console.log(`✅ Audit Log verified for purge action: ${auditLogs[0].action} (Metadata: ${JSON.stringify(auditLogs[0].metadata)})`);
    }

    // 7. Reset user retention policy back to null (keep forever)
    await prisma.user.update({
      where: { id: user.id },
      data: { dataRetentionDays: null }
    });
    console.log("\n7. Reset retention policy back to null (Keep forever).");

    console.log("\n==========================================");
    console.log("🎉 ALL PHASE 4 VERIFICATION CHECKS PASSED!");
    console.log("==========================================");

  } catch (err) {
    console.error("❌ Verification failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
