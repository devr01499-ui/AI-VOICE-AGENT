require('dotenv').config({ path: './server/.env' });
const { prisma } = require('../server/dist/lib/prisma');

async function runTest() {
  console.log("=== Phase 8 Integrations Expansion Verification ===");

  let passed = 0;
  let failed = 0;

  function assert(condition, description) {
    if (condition) {
      console.log(`  [PASS] ${description}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${description}`);
      failed++;
    }
  }

  try {
    const user = await prisma.user.findFirst();
    if (!user) {
      throw new Error("No test user found in database");
    }

    console.log(`Test user: ${user.email} (id: ${user.id})`);

    // Test 1: Save Cal.com direct self-serve integration
    console.log("\n1. Testing Cal.com self-serve integration save...");
    const calcomIntegration = await prisma.userIntegration.upsert({
      where: {
        userId_type: {
          userId: user.id,
          type: 'calcom',
        },
      },
      update: {
        name: 'Cal.com Booking',
        config: JSON.stringify({ apiKey: 'cal_live_test_key_12345', eventSlug: '30min-demo' }),
        enabled: true,
      },
      create: {
        userId: user.id,
        type: 'calcom',
        name: 'Cal.com Booking',
        config: JSON.stringify({ apiKey: 'cal_live_test_key_12345', eventSlug: '30min-demo' }),
        enabled: true,
      },
    });

    assert(calcomIntegration.type === 'calcom' && calcomIntegration.enabled === true, "Cal.com integration saved in database");

    // Test 2: Save Make.com scenario integration
    console.log("\n2. Testing Make.com scenario integration save...");
    const makeIntegration = await prisma.userIntegration.upsert({
      where: {
        userId_type: {
          userId: user.id,
          type: 'make',
        },
      },
      update: {
        name: 'Make.com Scenario',
        config: JSON.stringify({ webhookUrl: 'https://hook.us1.make.com/test_webhook_key' }),
        enabled: true,
      },
      create: {
        userId: user.id,
        type: 'make',
        name: 'Make.com Scenario',
        config: JSON.stringify({ webhookUrl: 'https://hook.us1.make.com/test_webhook_key' }),
        enabled: true,
      },
    });

    assert(makeIntegration.type === 'make' && makeIntegration.enabled === true, "Make.com scenario integration saved in database");

    // Test 3: Save HubSpot CRM (OAuth App scaffolding)
    console.log("\n3. Testing HubSpot CRM OAuth App integration save...");
    const hubspotIntegration = await prisma.userIntegration.upsert({
      where: {
        userId_type: {
          userId: user.id,
          type: 'hubspot',
        },
      },
      update: {
        name: 'HubSpot CRM',
        config: JSON.stringify({ clientId: 'hb_client_id_998877', redirectUri: 'https://app.claritiyvoice.com/oauth/hubspot' }),
        enabled: true,
      },
      create: {
        userId: user.id,
        type: 'hubspot',
        name: 'HubSpot CRM',
        config: JSON.stringify({ clientId: 'hb_client_id_998877', redirectUri: 'https://app.claritiyvoice.com/oauth/hubspot' }),
        enabled: true,
      },
    });

    assert(hubspotIntegration.type === 'hubspot', "HubSpot CRM integration saved in database");

    // Test 4: Query all user integrations and verify new types present
    console.log("\n4. Verifying integrations query...");
    const allIntegrations = await prisma.userIntegration.findMany({
      where: { userId: user.id },
    });

    const types = allIntegrations.map((i) => i.type);
    assert(types.includes('calcom'), "List contains calcom integration");
    assert(types.includes('make'), "List contains make integration");
    assert(types.includes('hubspot'), "List contains hubspot integration");

    // Clean up test integrations created by test script
    console.log("\nCleaning up test integration records...");
    await prisma.userIntegration.deleteMany({
      where: {
        userId: user.id,
        type: { in: ['calcom', 'make', 'hubspot'] },
      },
    });
    console.log("Cleaned up.");

    console.log("\n==========================================");
    console.log(`Summary: ${passed} Passed, ${failed} Failed`);
    console.log("==========================================");

    if (failed > 0) process.exit(1);

  } catch (err) {
    console.error("❌ Verification failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
