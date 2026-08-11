import { prisma } from './src/lib/prisma';

async function main() {
  const logs = await prisma.integrationAuditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log(JSON.stringify(logs, null, 2));
}

main().finally(() => prisma.$disconnect());
