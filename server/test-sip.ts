import { prisma } from './src/lib/prisma';
import { callOrchestrator } from './src/core/orchestrator/CallOrchestrator';
import { ProviderManager } from './src/providers/ProviderManager';
import { SipProvider } from './src/providers/sip/SipProvider';
import { EncryptionService } from './src/utils/EncryptionService';
import { env } from './src/config/env';
import { randomUUID } from 'crypto';

process.env.SIP_PORT = Math.floor(Math.random() * 1000 + 5065).toString();

async function testGenericSip() {
  console.log('=== Setting up test users ===');
  
  const testUserId = randomUUID();
  const testAgentId = randomUUID();

  // Create a non-admin user
  await prisma.user.upsert({
    where: { email: 'nonadmin_sip@example.com' },
    update: {},
    create: {
      id: testUserId,
      email: 'nonadmin_sip@example.com',
      fullName: 'Non Admin SIP User',
      passwordHash: 'dummy'
    }
  });

  const user = await prisma.user.findUnique({ where: { email: 'nonadmin_sip@example.com' } });
  const finalUserId = user!.id;

  // Create a SIP Trunk for the user
  const trunkId = 'generic-test-trunk';
  await prisma.sipTrunk.upsert({
    where: { id: trunkId },
    update: {
      sipUri: 'example.sip.twilio.com',
      username: 'twilio_user',
      password: EncryptionService.encrypt('twilio_pass'),
    },
    create: {
      id: trunkId,
      userId: finalUserId,
      name: 'Twilio Generic Trunk',
      sipUri: 'example.sip.twilio.com',
      username: 'twilio_user',
      password: EncryptionService.encrypt('twilio_pass'),
      status: 'active'
    }
  });

  // Create Agent
  await prisma.agent.upsert({
    where: { id: testAgentId },
    update: {},
    create: {
      id: testAgentId,
      userId: finalUserId,
      name: 'Test Agent',
      agentConfig: JSON.stringify({ voice: 'Puck' })
    }
  });

  console.log('Users created. Registering SIP Provider manually for test...');
  const sipProvider = new SipProvider();
  await sipProvider.connect();
  ProviderManager.instance.registerProvider(sipProvider);

  console.log('\nTesting Non-Admin Call with Generic SIP...');
  try {
    const callId = await callOrchestrator.initiateOutboundCall(
      '+1234567890',
      testAgentId,
      finalUserId,
      '+1987654321',
      60
    );
    console.log(`\nGeneric SIP Call Created with Call ID: ${callId}`);
  } catch (err: any) {
    console.error(`\nGeneric SIP Call Failed: ${err.message}`);
  }

  // Allow some time for async logs to flush
  await new Promise(r => setTimeout(r, 2000));
  await sipProvider.disconnect();
  await prisma.$disconnect();
}

testGenericSip().catch(console.error);
