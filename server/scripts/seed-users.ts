import { prisma } from '../src/config/database';

async function seed() {
  console.log('Seeding Supabase dev identity mapping in Prisma...');
  await prisma.user.upsert({
    where: { id: '1e69187e-82d5-4166-929f-4bbba90e5304' },
    update: {},
    create: {
      id: '1e69187e-82d5-4166-929f-4bbba90e5304',
      email: 'devr01499@gmail.com',
      fullName: 'devr01499',
      passwordHash: 'seeded-supabase-auth-placeholder',
      billingBalance: 1000.0,
    }
  });
  console.log('Supabase dev identity mapping seeded successfully!');
}

seed().catch(err => {
  console.error('Failed to seed Supabase dev identity mapping', err);
  process.exit(1);
});
