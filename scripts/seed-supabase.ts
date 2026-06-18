import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import fs from 'fs';
import path from 'path';

// Disable unauthorized TLS rejection to allow connection to database
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Manual env loading for local execution
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const firstEquals = trimmed.indexOf('=');
    if (firstEquals === -1) continue;
    const key = trimmed.slice(0, firstEquals).trim();
    let val = trimmed.slice(firstEquals + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    } else if (val.startsWith("'") && val.endsWith("'")) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is missing.');
}
const pool = new pg.Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({
  adapter,
  log: ['query', 'info', 'warn', 'error'],
});

async function main() {
  console.log('Seeding Supabase Database...');

  // Create user
  const userId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const user = await prisma.user.upsert({
    where: { email: 'dev@bolna.ai' },
    update: {},
    create: {
      id: userId,
      email: 'dev@bolna.ai',
      passwordHash: 'dummy-hash',
      fullName: 'Developer User',
      accountType: 'developer',
    },
  });
  console.log('Seeded User ID:', user.id);

  // Create agent
  const agentId = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12';
  const agent = await prisma.agent.upsert({
    where: { id: agentId },
    update: {},
    create: {
      id: agentId,
      userId: userId,
      name: 'Dev Test Agent',
      description: 'An agent used for dev testing',
      agentType: 'conversational',
      status: 'active',
      agentConfig: JSON.stringify({
        voice_config: { provider: 'openai', voice: 'alloy' },
        llm_config: { provider: 'openai', model: 'gpt-4o' },
      }),
    },
  });
  console.log('Seeded Agent ID:', agent.id);

  console.log('Database Seeding Complete!');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
