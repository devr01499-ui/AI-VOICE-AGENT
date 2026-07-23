import { prisma } from './src/lib/prisma';
import { EncryptionService } from './src/utils/EncryptionService';

async function testSipTrunkCreation() {
  const reqBody = {
    name: 'Frontend Test Trunk',
    sipUri: 'frontend.sip.com',
    username: 'ui_user',
    password: 'super_secret_ui_password',
    outboundProxy: ''
  };

  const userId = '1e69187e-82d5-4166-929f-4bbba90e5304';

  // Simulate exactly what the POST /api/v2/calls/sip-trunks endpoint does
  const passwordToSave = reqBody.password ? EncryptionService.encrypt(reqBody.password) : undefined;
  
  console.log('Original password:', reqBody.password);
  console.log('Encrypted payload:', passwordToSave);

  const trunk = await prisma.sipTrunk.create({
    data: {
      userId,
      name: reqBody.name || 'Primary SIP Trunk',
      sipUri: reqBody.sipUri,
      username: reqBody.username,
      password: passwordToSave,
      outboundProxy: reqBody.outboundProxy,
      codecs: '["PCMU","PCMA"]',
      dtmfMode: 'rfc2833',
      status: 'active'
    }
  });

  console.log('Saved Trunk ID:', trunk.id);
  console.log('Saved Password in DB:', trunk.password);
  
  if (trunk.password === reqBody.password) {
    throw new Error('PASSWORD WAS SAVED IN PLAINTEXT!');
  }

  const decrypted = EncryptionService.decrypt(trunk.password!);
  console.log('Decrypted back:', decrypted);
  
  if (decrypted === reqBody.password) {
    console.log('SUCCESS: End-to-End Encryption verified for Frontend API.');
  } else {
    throw new Error('DECRYPTION MISMATCH!');
  }

  await prisma.sipTrunk.delete({ where: { id: trunk.id }});
  await prisma.$disconnect();
}

testSipTrunkCreation().catch(console.error);
