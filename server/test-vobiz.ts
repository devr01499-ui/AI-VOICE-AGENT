import { config } from 'dotenv';
config();
import { prisma } from './src/lib/prisma';
import { callOrchestrator } from './src/core/orchestrator/CallOrchestrator';
import { ADMIN_EMAIL } from './src/config/constants';
import { ProviderManager } from './src/providers/ProviderManager';
import { VobizProvider } from './src/providers/vobiz/VobizProvider';

async function runTest() {
  const vobiz = new VobizProvider();
  ProviderManager.instance.registerProvider(vobiz);

  console.log("=== Setting up test users ===");
  const adminId = '1e69187e-82d5-4166-929f-4bbba90e5304';
  const nonAdminId = '99999999-9999-9999-9999-999999999999';

  await prisma.user.upsert({
    where: { id: adminId },
    update: { email: ADMIN_EMAIL },
    create: {
      id: adminId,
      email: ADMIN_EMAIL,
      fullName: 'Admin',
      passwordHash: 'dummy'
    }
  });

  await prisma.user.upsert({
    where: { id: nonAdminId },
    update: { email: 'nonadmin@example.com' },
    create: {
      id: nonAdminId,
      email: 'nonadmin@example.com',
      fullName: 'Non Admin',
      passwordHash: 'dummy'
    }
  });

  const agentId = 'dummy-agent-id-1234';
  await prisma.agent.upsert({
    where: { id: agentId },
    update: {},
    create: {
      id: agentId,
      name: 'Dummy Agent',
      systemPrompt: 'prompt',
      voiceName: 'voice',
      model: 'model',
      userId: adminId
    }
  });

  console.log("Users created. Testing Admin...");
  try {
    const callId1 = await callOrchestrator.initiateOutboundCall(
      '+1234567890',
      agentId,
      adminId,
      '+1987654321',
      300
    );
    console.log("Admin Call Initiated Successfully. Call ID:", callId1);
  } catch (err: any) {
    console.error("Admin Call Failed:", err.message);
  }

  console.log("\nTesting Non-Admin...");
  try {
    const callId2 = await callOrchestrator.initiateOutboundCall(
      '+1234567890',
      agentId,
      nonAdminId,
      '+1987654321',
      300
    );
    console.log("Non-Admin Call Initiated Successfully. Call ID:", callId2);
  } catch (err: any) {
    console.error("Non-Admin Call Blocked Correctly:", err.message);
  }

  await prisma.$disconnect();
}

runTest().catch(console.error);
