const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { prisma } = require('../dist/lib/prisma');
const { BatchService } = require('../dist/services/BatchService');

async function reproduce() {
  console.log('=== REPRODUCING BATCH CALLING ISSUE AS NORMAL USER ===');
  
  // 1. Find or create a normal user (non-admin)
  let normalUser = await prisma.user.findFirst({
    where: {
      accountType: { not: 'admin' },
      accountStatus: 'active',
      email: { not: 'founder@claritiy.com' }
    }
  });

  if (!normalUser) {
    console.log('Creating a temporary non-admin user...');
    normalUser = await prisma.user.create({
      data: {
        email: `normal-user-${Date.now()}@example.com`,
        accountType: 'user',
        accountStatus: 'active',
        callingBalanceMinutes: 100,
        minutesRemainingSeconds: 6000
      }
    });
  } else {
    // Ensure sufficient minutes
    if (normalUser.minutesRemainingSeconds < 300) {
      await prisma.user.update({
        where: { id: normalUser.id },
        data: { minutesRemainingSeconds: 3600, callingBalanceMinutes: 60 }
      });
    }
  }

  console.log(`Using normal user: ${normalUser.email} (id: ${normalUser.id}, accountType: ${normalUser.accountType})`);

  // Ensure Vobiz sub-account exists for the user so it doesn't fail on sub-account check
  const subAccount = await prisma.vobizSubAccount.findUnique({ where: { userId: normalUser.id } });
  if (!subAccount) {
    await prisma.vobizSubAccount.create({
      data: {
        userId: normalUser.id,
        authId: `SUB_${Date.now()}`,
        authToken: 'sub_auth_token_mock',
        kycStatus: 'verified',
        kycCallsBlocked: false
      }
    });
  }

  // 2. Find or create an agent owned by this normal user
  let agent = await prisma.agent.findFirst({
    where: { userId: normalUser.id }
  });

  if (!agent) {
    agent = await prisma.agent.create({
      data: {
        userId: normalUser.id,
        name: 'Batch Test Agent',
        status: 'active',
        llm: 'openai',
        voice: 'shimmer',
        prompt: 'You are a friendly assistant.'
      }
    });
  }

  // 3. Create a batch campaign
  const testBatch = await prisma.batch.create({
    data: {
      userId: normalUser.id,
      agentId: agent.id,
      name: 'Repro Batch Test',
      status: 'running',
      totalRecipients: 2,
      startedAt: new Date(),
      recipients: {
        create: [
          { phoneNumber: '+919876543210', status: 'pending' },
          { phoneNumber: '+919876543211', status: 'pending' }
        ]
      }
    },
    include: {
      recipients: true
    }
  });

  console.log(`Created test batch: ${testBatch.id} with ${testBatch.recipients.length} recipients`);

  // 4. Run BatchService.processBatchOneAtATime
  console.log('Invoking BatchService.processBatchOneAtATime...');
  await BatchService.processBatchOneAtATime(testBatch.id, normalUser.id);

  // 5. Query batch and recipients
  const updatedBatch = await prisma.batch.findUnique({
    where: { id: testBatch.id },
    include: { recipients: true }
  });

  console.log('=== UPDATED BATCH RECIPIENTS ROWS ===');
  console.log(JSON.stringify(updatedBatch?.recipients.map(r => ({
    id: r.id,
    phoneNumber: r.phoneNumber,
    status: r.status,
    attempts: r.attempts,
    callId: r.callId
  })), null, 2));

  console.log('=== UPDATED BATCH ROW ===');
  console.log(JSON.stringify({
    id: updatedBatch?.id,
    status: updatedBatch?.status,
    completedCount: updatedBatch?.completedCount,
    failedCount: updatedBatch?.failedCount
  }, null, 2));

  await prisma.$disconnect();
}

reproduce().catch(err => {
  console.error('Reproduction error:', err);
  process.exit(1);
});
