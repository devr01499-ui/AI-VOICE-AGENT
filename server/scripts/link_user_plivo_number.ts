import path from 'path';
import dotenv from 'dotenv';

// Load root .env FIRST before importing anything that touches process.env
const rootEnvPath = path.resolve(__dirname, '../../.env');
console.log('Loading .env from:', rootEnvPath);
dotenv.config({ path: rootEnvPath });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const { prisma } = await import('../src/lib/prisma');

  console.log('--- Linking Plivo Number to devr01499@gmail.com ---');

  const email = 'devr01499@gmail.com';
  const targetNumber = '+918065530386';

  // 1. Locate the User
  let user = await prisma.user.findFirst({
    where: { email },
    include: {
      phoneNumbers: true,
      agents: true,
    },
  });

  if (!user) {
    console.log(`User ${email} not found by direct email. Searching by admin ID...`);
    user = await prisma.user.findFirst({
      where: { id: '1e69187e-82d5-4166-929f-4bbba90e5304' },
      include: {
        phoneNumbers: true,
        agents: true,
      },
    });
  }

  if (!user) {
    // List all users to see what exists
    const allUsers = await prisma.user.findMany({ select: { id: true, email: true, accountType: true } });
    console.log('Existing users in DB:', allUsers);
    throw new Error(`Could not find user with email ${email}`);
  }

  console.log(`Found user: ID=${user.id}, Email=${user.email}, AccountType=${user.accountType}`);

  // 2. Locate or create default agent
  let agentId = user.agents?.[0]?.id;
  if (!agentId) {
    const defaultAgent = await prisma.agent.findFirst({
      where: { userId: user.id },
    });
    if (defaultAgent) {
      agentId = defaultAgent.id;
    } else {
      const globalAgent = await prisma.agent.findFirst();
      agentId = globalAgent?.id;
    }
  }

  console.log(`Assigned Agent ID: ${agentId || 'None'}`);

  // 3. Upsert PhoneNumber record for +918065530386
  const existingNumber = await prisma.phoneNumber.findFirst({
    where: {
      phoneNumber: {
        in: [targetNumber, '+91 80 6553 0386', '918065530386', '08065530386'],
      },
    },
  });

  let provisionedNumber;
  if (existingNumber) {
    console.log(`Existing number record found (ID=${existingNumber.id}). Updating...`);
    provisionedNumber = await prisma.phoneNumber.update({
      where: { id: existingNumber.id },
      data: {
        userId: user.id,
        phoneNumber: targetNumber,
        assignedAgentId: agentId || existingNumber.assignedAgentId || null,
        countryCode: 'IN',
        region: 'Bangalore, India',
        type: 'local',
        telephonyProvider: 'plivo',
        capabilities: JSON.stringify(['voice']),
        status: 'active',
        kycStatus: 'verified',
        monthlyCost: 450,
        currency: 'INR',
        plivoNumberId: targetNumber,
      },
    });
  } else {
    console.log(`Creating new number record for ${targetNumber}...`);
    provisionedNumber = await prisma.phoneNumber.create({
      data: {
        userId: user.id,
        phoneNumber: targetNumber,
        assignedAgentId: agentId || null,
        countryCode: 'IN',
        region: 'Bangalore, India',
        type: 'local',
        telephonyProvider: 'plivo',
        capabilities: JSON.stringify(['voice']),
        status: 'active',
        kycStatus: 'verified',
        monthlyCost: 450,
        currency: 'INR',
        plivoNumberId: targetNumber,
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  }

  console.log('PhoneNumber provisioned successfully:', provisionedNumber);

  // 4. Ensure calling balance is sufficient
  if ((user.callingBalanceMinutes ?? 0) < 60) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        callingBalanceMinutes: 120,
        numberLocked: true,
      },
    });
    console.log('Updated user callingBalanceMinutes to 120.');
  }

  // 5. Ensure PlivoSubAccount exists or create admin reference
  const existingSub = await prisma.plivoSubAccount.findUnique({
    where: { userId: user.id },
  });
  if (!existingSub) {
    const parentAuth = process.env.PLIVO_AUTH_ID || 'PLIVO_PARENT';
    await prisma.plivoSubAccount.create({
      data: {
        userId: user.id,
        authId: parentAuth,
        authToken: 'DIRECT_PARENT_ACCOUNT',
        name: `Claritiy_Admin_${user.id.substring(0, 8)}`,
        enabled: true,
      },
    });
    console.log('Created PlivoSubAccount mapping for admin.');
  }

  console.log('--- DONE: Number is now active on devr01499@gmail.com dashboard ---');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    try {
      const { prisma } = await import('../src/lib/prisma');
      await prisma.$disconnect();
    } catch {}
  });
