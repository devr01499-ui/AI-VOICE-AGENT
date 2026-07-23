import { prisma } from '../src/lib/prisma';
import { EncryptionService } from '../src/utils/EncryptionService';
import { env } from '../src/config/env';

async function migrateAdminVobizTrunk() {
  console.log("=== Migrating Admin Vobiz Account to SipTrunk ===");
  const adminId = '1e69187e-82d5-4166-929f-4bbba90e5304';

  const trunkId = 'admin-vobiz-trunk-id';
  
  if (!env.VOBIZ_AUTH_TOKEN) {
    console.error("No VOBIZ_AUTH_TOKEN found in env to migrate.");
    return;
  }

  const encryptedPassword = EncryptionService.encrypt(env.VOBIZ_AUTH_TOKEN);

  await prisma.sipTrunk.upsert({
    where: { id: trunkId },
    update: {
      sipUri: env.VOBIZ_API_URL,
      username: env.VOBIZ_AUTH_ID,
      password: encryptedPassword,
    },
    create: {
      id: trunkId,
      userId: adminId,
      name: 'Vobiz Admin Trunk',
      sipUri: env.VOBIZ_API_URL,
      username: env.VOBIZ_AUTH_ID,
      password: encryptedPassword,
      status: 'active'
    }
  });

  console.log("Migration successful. Admin Vobiz trunk created.");

  const row: any[] = await prisma.$queryRaw`SELECT id, name, sip_uri, username, password FROM sip_trunks WHERE id = ${trunkId}`;
  console.log("\n[VERIFICATION] Raw DB Row for Admin Trunk:");
  console.log(row[0]);

  await prisma.$disconnect();
}

migrateAdminVobizTrunk().catch(console.error);
