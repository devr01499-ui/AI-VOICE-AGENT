import { prisma } from '../src/config/database';

async function seed() {
  console.log('Seeding Supabase dev identity mapping in Prisma...');
  await prisma.user.upsert({
    where: { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' },
    update: {},
    create: {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
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
