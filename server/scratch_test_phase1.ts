import 'dotenv/config';
import { prisma } from './src/lib/prisma';
import { VobizSubAccountService } from './src/services/VobizSubAccountService';
import { EncryptionService } from './src/utils/EncryptionService';

async function testPhase1() {
  console.log('Testing Phase 1...');
  
  // Create a dummy user
  const user = await prisma.user.create({
    data: {
      email: `test_${Date.now()}@claritiy.test`,
      passwordHash: 'dummy',
      fullName: 'Test User Phase 1',
    }
  });

  console.log(`Created test user: ${user.id}`);

  const service = new VobizSubAccountService();
  const subAccount = await service.getOrCreateSubAccount(user.id);
  
  console.log(`Sub-account created:`, subAccount);
  
  // Verify encryption
  console.log(`AuthToken encrypted format:`, subAccount.authToken);
  
  const decrypted = EncryptionService.decrypt(subAccount.authToken);
  console.log(`Decrypted AuthToken:`, decrypted);
  
  if (EncryptionService.isEncrypted(subAccount.authToken)) {
    console.log('SUCCESS: AuthToken is correctly encrypted.');
  } else {
    console.log('FAILED: AuthToken is not encrypted correctly.');
  }

  // Cleanup
  await prisma.user.delete({ where: { id: user.id } });
  console.log('Test completed and cleaned up.');
}

testPhase1().catch(console.error).finally(() => process.exit(0));
