import { prisma } from '../src/lib/prisma';
import { EncryptionService } from '../src/utils/EncryptionService';
import { config } from 'dotenv';
config();

async function runMigration() {
  console.log("=== Starting SipTrunk Password Encryption Migration ===");
  
  // First, let's insert a mock plaintext SipTrunk to guarantee we have something to migrate,
  // representing a legacy plain-text record.
  const testUserId = '1e69187e-82d5-4166-929f-4bbba90e5304';
  
  await prisma.user.upsert({
    where: { id: testUserId },
    update: {},
    create: {
      id: testUserId,
      email: 'devr01499@gmail.com',
      fullName: 'devr01499',
      passwordHash: 'dummy'
    }
  });

  const dummyId = 'dummy-trunk-for-migration-test';
  
  // Ensure it's in plaintext before migration
  await prisma.sipTrunk.upsert({
    where: { id: dummyId },
    update: { password: 'my-super-secret-plaintext-password' },
    create: {
      id: dummyId,
      userId: testUserId,
      name: 'Legacy Plaintext Trunk',
      sipUri: 'sip.example.com',
      password: 'my-super-secret-plaintext-password'
    }
  });

  console.log("\n[BEFORE MIGRATION] Raw DB Record:");
  const beforeRecords: any[] = await prisma.$queryRaw`SELECT id, password FROM sip_trunks WHERE id = ${dummyId}`;
  console.log(beforeRecords[0]);

  // Execute Migration
  const allTrunks = await prisma.sipTrunk.findMany();
  let migratedCount = 0;

  for (const trunk of allTrunks) {
    if (trunk.password && !EncryptionService.isEncrypted(trunk.password)) {
      console.log(`Encrypting password for SipTrunk ID: ${trunk.id}`);
      const encryptedPassword = EncryptionService.encrypt(trunk.password);
      
      await prisma.sipTrunk.update({
        where: { id: trunk.id },
        data: { password: encryptedPassword }
      });
      migratedCount++;
    }
  }

  console.log(`\nMigration Complete! Encrypted ${migratedCount} trunks.`);

  console.log("\n[AFTER MIGRATION] Raw DB Record (directly queried, bypassing application layer):");
  const afterRecords: any[] = await prisma.$queryRaw`SELECT id, password FROM sip_trunks WHERE id = ${dummyId}`;
  console.log(afterRecords[0]);
  
  console.log("\n[VERIFICATION] Application Layer Decryption Test:");
  const appLayerRecord = await prisma.sipTrunk.findUnique({ where: { id: dummyId } });
  if (appLayerRecord?.password) {
    const decrypted = EncryptionService.decrypt(appLayerRecord.password);
    console.log(`Decrypted value matches original: ${decrypted === 'my-super-secret-plaintext-password'}`);
  }

  await prisma.$disconnect();
}

runMigration().catch(console.error);
