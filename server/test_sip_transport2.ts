import { SipProvider } from './src/providers/sip/SipProvider';
import { prisma } from './src/lib/prisma';
import { EncryptionService } from './src/utils/EncryptionService';

async function runTest() {
  console.log("--- STARTING DIAGNOSTIC SIP TEST 2 ---");
  const provider = new SipProvider();
  console.log('Provider instantiated');
  await provider.connect();
  console.log('Provider connected');

  let testUser;
  let testTrunk;

  try {
    testUser = await prisma.user.create({
      data: {
        email: 'diagnostic-test-' + Date.now() + '@example.com',
        passwordHash: 'dummy',
        fullName: 'Diagnostic Test User',
      }
    });
    console.log('Test user created');

    testTrunk = await prisma.sipTrunk.create({
      data: {
        userId: testUser.id,
        name: 'Twilio SIP Trunk',
        sipUri: 'sip.twilio.com',
        username: 'trialuser',
        password: EncryptionService.encrypt('trialpassword'),
        status: 'active'
      }
    });
    console.log('Test trunk created');

    console.log("Attempting to initiate call to sip.twilio.com via sip.js (WSS)...");
    const promise = provider.initiateCall({
      to: '+1234567890',
      from: '+0987654321',
      answerUrl: 'http://localhost/answer',
      userId: testUser.id
    });

    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT_EXCEEDED')), 10000));
    
    await Promise.race([promise, timeout]);
    
    console.log("Call initiation step completed");
    
  } catch (err) {
    console.error("\n--- EXACT ERROR CAPTURED ---");
    console.error(err);
    console.error("----------------------------\n");
  } finally {
    console.log('Starting cleanup');
    if (testTrunk) await prisma.sipTrunk.delete({ where: { id: testTrunk.id } });
    if (testUser) await prisma.user.delete({ where: { id: testUser.id } });
    await provider.disconnect();
    await prisma.$disconnect();
    console.log("Cleanup complete.");
  }
}

runTest().catch(console.error);
