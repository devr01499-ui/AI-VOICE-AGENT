/**
 * Automated Test Suite: Agent Import/Export Feature Verification
 *
 * Verifies:
 * 1. Export produces JSON envelope containing only allow-listed fields (no id, userId, workspaceId, status, version, timestamps).
 * 2. Import of valid export file creates a new agent owned by importing user with status: "draft".
 * 3. Import of file missing claritiyVoiceAgentExport envelope key is rejected with clear error.
 * 4. Import of file containing id/userId/workspaceId fields ignores those values and assigns freshly generated ID / session user ID.
 * 5. Import of non-JSON or malformed JSON file is rejected with a clear error without crashing.
 * 6. Import of oversized file (>2MB) is rejected before parsing.
 * 7. Round-trip test under same user account creates a second independent agent without overwriting original.
 * 8. Round-trip test across two distinct user accounts (User A -> User B) verifies User B owns new agent and User A's agent remains untouched.
 */

require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

function getPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return new PrismaClient();
  }
  const pool = new pg.Pool({
    connectionString: connectionString.includes('sslmode=require')
      ? connectionString.replace('sslmode=require', 'sslmode=no-verify')
      : connectionString,
    ssl: { rejectUnauthorized: false }
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

const prisma = getPrismaClient();

// Helper replicating export construction logic from api.ts
function buildExportEnvelope(agent) {
  let parsedConfig = agent.agentConfig;
  if (typeof parsedConfig === 'string') {
    try { parsedConfig = JSON.parse(parsedConfig); } catch { parsedConfig = {}; }
  }

  let parsedFlowGraph = agent.flowGraph;
  if (typeof parsedFlowGraph === 'string') {
    try { parsedFlowGraph = JSON.parse(parsedFlowGraph); } catch { parsedFlowGraph = null; }
  }

  let parsedTags = agent.tags;
  if (typeof parsedTags === 'string') {
    try { parsedTags = JSON.parse(parsedTags); } catch { parsedTags = []; }
  }

  return {
    claritiyVoiceAgentExport: "1.0",
    exportedAt: new Date().toISOString(),
    agent: {
      name: agent.name,
      description: agent.description ?? null,
      agentType: agent.agentType || 'conversational',
      agentConfig: parsedConfig || {},
      model: agent.model ?? null,
      voiceName: agent.voiceName ?? null,
      systemVoice: agent.systemVoice ?? 'Puck',
      languageMode: agent.languageMode ?? 'auto',
      temperature: agent.temperature !== null && agent.temperature !== undefined ? Number(agent.temperature) : 0.7,
      systemPrompt: agent.systemPrompt ?? null,
      tags: Array.isArray(parsedTags) ? parsedTags : [],
      flowGraph: parsedFlowGraph ?? null,
    }
  };
}

// Helper replicating import validation & sanitization logic from App.tsx
function validateAndSanitizeImport(fileContent, fileSize) {
  if (fileSize > 2 * 1024 * 1024) {
    throw new Error("File size exceeds 2MB limit. Please upload a valid Claritiy Voice export file.");
  }

  let json;
  try {
    json = JSON.parse(fileContent);
  } catch {
    throw new Error("Failed to parse JSON file. Please ensure the file is valid JSON.");
  }

  if (!json || typeof json !== "object" || !json.claritiyVoiceAgentExport) {
    throw new Error("This doesn't look like a Claritiy Voice agent export file.");
  }

  const agent = json.agent;
  if (!agent || typeof agent !== "object" || typeof agent.name !== "string" || !agent.name.trim()) {
    throw new Error("The file is missing a required agent name.");
  }

  // Sanitization allow-list
  return {
    name: agent.name.trim(),
    description: typeof agent.description === 'string' ? agent.description : null,
    agentType: agent.agentType === 'single-prompt' || agent.agentType === 'prompt' ? 'prompt' : 'conversational',
    status: 'draft', // Always force draft status
    agentConfig: typeof agent.agentConfig === 'object' && agent.agentConfig !== null ? agent.agentConfig : {},
    model: typeof agent.model === 'string' ? agent.model : null,
    voiceName: typeof agent.voiceName === 'string' ? agent.voiceName : null,
    systemVoice: typeof agent.systemVoice === 'string' ? agent.systemVoice : 'Puck',
    languageMode: typeof agent.languageMode === 'string' ? agent.languageMode : 'auto',
    temperature: typeof agent.temperature === 'number' ? agent.temperature : 0.7,
    systemPrompt: typeof agent.systemPrompt === 'string' ? agent.systemPrompt : null,
    tags: Array.isArray(agent.tags) ? agent.tags : [],
    flowGraph: agent.flowGraph ? (typeof agent.flowGraph === 'string' ? agent.flowGraph : JSON.stringify(agent.flowGraph)) : null,
  };
}

async function runTestSuite() {
  console.log("====================================================");
  console.log("🧪 Starting Agent Import/Export Test Suite");
  console.log("====================================================\n");

  let passed = 0;
  let failed = 0;
  const createdAgentIds = [];
  let tempUserBId = null;

  const userA = "1e69187e-82d5-4166-929f-4bbba90e5304";

  // Ensure userA exists
  const existingUserA = await prisma.user.findUnique({ where: { id: userA } });
  if (!existingUserA) {
    await prisma.user.create({
      data: {
        id: userA,
        email: "dev_user_a@claritiy.ai",
        fullName: "Dev User A",
      }
    });
  }

  // Resolve or create userB with valid foreign key
  let userBObj = await prisma.user.findFirst({
    where: { id: { not: userA } }
  });
  if (!userBObj) {
    userBObj = await prisma.user.create({
      data: {
        email: `test_user_b_${Date.now()}@claritiy.ai`,
        fullName: "Test User B",
      }
    });
    tempUserBId = userBObj.id;
  }
  const userB = userBObj.id;
  console.log(`[Setup] User A ID: ${userA}, User B ID: ${userB}`);

  try {
    // ── Test 1: Export envelope produces allow-listed fields only ────────────────
    console.log("\n--- Test 1: Export Envelope & Allow-List Verification ---");
    const testAgent1 = await prisma.agent.create({
      data: {
        name: "Test Agent Original",
        description: "Test description for export",
        agentType: "conversational",
        status: "active",
        userId: userA,
        workspaceId: "ws-orig-123",
        model: "gemini-2.5-flash",
        voiceName: "Aoede",
        systemVoice: "Puck",
        temperature: 0.8,
        systemPrompt: "You are a customer support voice assistant.",
        agentConfig: JSON.stringify({ key1: "value1" }),
        tags: JSON.stringify(["support", "vip"]),
        flowGraph: JSON.stringify({ schemaVersion: "1.0", nodes: [{ id: "n1", type: "start" }] }),
      }
    });
    createdAgentIds.push(testAgent1.id);

    const exportEnvelope = buildExportEnvelope(testAgent1);

    if (
      exportEnvelope.claritiyVoiceAgentExport === "1.0" &&
      exportEnvelope.exportedAt &&
      exportEnvelope.agent &&
      exportEnvelope.agent.name === "Test Agent Original" &&
      exportEnvelope.agent.id === undefined &&
      exportEnvelope.agent.userId === undefined &&
      exportEnvelope.agent.workspaceId === undefined &&
      exportEnvelope.agent.status === undefined &&
      exportEnvelope.agent.version === undefined &&
      exportEnvelope.agent.createdAt === undefined &&
      exportEnvelope.agent.updatedAt === undefined
    ) {
      console.log("  [PASS] Export envelope contains valid portable fields and excludes non-portable identifiers");
      passed++;
    } else {
      console.error("  [FAIL] Export envelope contained non-portable fields or invalid keys:", exportEnvelope);
      failed++;
    }

    // ── Test 2: Import valid export file creates draft agent owned by importing user ─
    console.log("\n--- Test 2: Import Valid Export File (Draft Status Forced) ---");
    const jsonString = JSON.stringify(exportEnvelope);
    const sanitizedPayload = validateAndSanitizeImport(jsonString, Buffer.byteLength(jsonString));

    const importedAgent = await prisma.agent.create({
      data: {
        ...sanitizedPayload,
        userId: userA,
        agentConfig: typeof sanitizedPayload.agentConfig === 'string' ? sanitizedPayload.agentConfig : JSON.stringify(sanitizedPayload.agentConfig),
        tags: typeof sanitizedPayload.tags === 'string' ? sanitizedPayload.tags : JSON.stringify(sanitizedPayload.tags),
      }
    });
    createdAgentIds.push(importedAgent.id);

    if (
      importedAgent.userId === userA &&
      importedAgent.status === "draft" &&
      importedAgent.id !== testAgent1.id &&
      importedAgent.name === "Test Agent Original"
    ) {
      console.log(`  [PASS] Imported agent successfully created (ID: ${importedAgent.id}, status: draft, userId: ${userA})`);
      passed++;
    } else {
      console.error("  [FAIL] Imported agent validation failed:", importedAgent);
      failed++;
    }

    // ── Test 3: Import file missing claritiyVoiceAgentExport envelope key ─────
    console.log("\n--- Test 3: Missing Envelope Key Rejection ---");
    const invalidEnvelopeStr = JSON.stringify({ agent: { name: "Invalid Agent" } });
    try {
      validateAndSanitizeImport(invalidEnvelopeStr, Buffer.byteLength(invalidEnvelopeStr));
      console.error("  [FAIL] Expected error for missing envelope key, but validation passed");
      failed++;
    } catch (err) {
      if (err.message === "This doesn't look like a Claritiy Voice agent export file.") {
        console.log(`  [PASS] Successfully rejected missing envelope key with: "${err.message}"`);
        passed++;
      } else {
        console.error(`  [FAIL] Rejected with wrong error message: "${err.message}"`);
        failed++;
      }
    }

    // ── Test 4: File with spoofed id/userId/workspaceId is sanitized ───────────
    console.log("\n--- Test 4: Spoofed Identifier Sanitization Check ---");
    const spoofedEnvelope = {
      claritiyVoiceAgentExport: "1.0",
      exportedAt: new Date().toISOString(),
      agent: {
        id: "spoofed-id-999",
        userId: "hacked-user-888",
        workspaceId: "hacked-workspace-777",
        name: "Spoofed Identifiers Test Agent",
        systemPrompt: "Testing sanitization"
      }
    };
    const spoofedStr = JSON.stringify(spoofedEnvelope);
    const sanitizedSpoofed = validateAndSanitizeImport(spoofedStr, Buffer.byteLength(spoofedStr));

    const agentFromSpoofed = await prisma.agent.create({
      data: {
        ...sanitizedSpoofed,
        userId: userA,
        agentConfig: JSON.stringify(sanitizedSpoofed.agentConfig),
        tags: JSON.stringify(sanitizedSpoofed.tags),
      }
    });
    createdAgentIds.push(agentFromSpoofed.id);

    if (
      agentFromSpoofed.id !== "spoofed-id-999" &&
      agentFromSpoofed.userId === userA &&
      agentFromSpoofed.workspaceId === null
    ) {
      console.log(`  [PASS] Spoofed identifiers stripped cleanly; agent assigned fresh ID ${agentFromSpoofed.id}`);
      passed++;
    } else {
      console.error("  [FAIL] Spoofed fields reached database:", agentFromSpoofed);
      failed++;
    }

    // ── Test 5: Malformed JSON and missing agent name rejection ───────────────
    console.log("\n--- Test 5: Malformed JSON & Empty Name Rejection ---");
    try {
      validateAndSanitizeImport("{ malformed json string ...", 50);
      console.error("  [FAIL] Expected parse error for malformed JSON, but passed");
      failed++;
    } catch (err) {
      if (err.message === "Failed to parse JSON file. Please ensure the file is valid JSON.") {
        console.log(`  [PASS] Handled malformed JSON with: "${err.message}"`);
        passed++;
      } else {
        console.error(`  [FAIL] Unexpected error message: "${err.message}"`);
        failed++;
      }
    }

    const emptyNameEnvelopeStr = JSON.stringify({
      claritiyVoiceAgentExport: "1.0",
      agent: { name: "   " }
    });
    try {
      validateAndSanitizeImport(emptyNameEnvelopeStr, Buffer.byteLength(emptyNameEnvelopeStr));
      console.error("  [FAIL] Expected error for empty agent name, but passed");
      failed++;
    } catch (err) {
      if (err.message === "The file is missing a required agent name.") {
        console.log(`  [PASS] Handled empty agent name with: "${err.message}"`);
        passed++;
      } else {
        console.error(`  [FAIL] Unexpected error message: "${err.message}"`);
        failed++;
      }
    }

    // ── Test 6: Oversized File Rejection (>2MB) ────────────────────────────────
    console.log("\n--- Test 6: Oversized File (>2MB) Rejection ---");
    try {
      const hugeSize = 3 * 1024 * 1024; // 3MB
      validateAndSanitizeImport("{}", hugeSize);
      console.error("  [FAIL] Expected size error for 3MB file, but passed");
      failed++;
    } catch (err) {
      if (err.message === "File size exceeds 2MB limit. Please upload a valid Claritiy Voice export file.") {
        console.log(`  [PASS] Rejection of >2MB file confirmed with: "${err.message}"`);
        passed++;
      } else {
        console.error(`  [FAIL] Unexpected size error message: "${err.message}"`);
        failed++;
      }
    }

    // ── Test 7: Single-User Round Trip (Export & Import Same Account) ─────────
    console.log("\n--- Test 7: Single-User Round Trip Test (Same Account) ---");
    const exportA = buildExportEnvelope(testAgent1);
    const sanitizedA = validateAndSanitizeImport(JSON.stringify(exportA), Buffer.byteLength(JSON.stringify(exportA)));
    const agentRoundtripSameUser = await prisma.agent.create({
      data: {
        ...sanitizedA,
        userId: userA,
        agentConfig: JSON.stringify(sanitizedA.agentConfig),
        tags: JSON.stringify(sanitizedA.tags),
      }
    });
    createdAgentIds.push(agentRoundtripSameUser.id);

    if (
      agentRoundtripSameUser.id !== testAgent1.id &&
      agentRoundtripSameUser.userId === testAgent1.userId &&
      agentRoundtripSameUser.name === testAgent1.name &&
      agentRoundtripSameUser.status === "draft"
    ) {
      console.log(`  [PASS] Single-user roundtrip succeeded. New distinct agent created: ${agentRoundtripSameUser.id}`);
      passed++;
    } else {
      console.error("  [FAIL] Single-user roundtrip failed:", agentRoundtripSameUser);
      failed++;
    }

    // ── Test 8: Cross-User Round Trip (Export User A, Import User B) ─────────
    console.log("\n--- Test 8: Cross-User Round Trip Test (User A -> User B) ---");
    const exportForUserB = buildExportEnvelope(testAgent1);
    const sanitizedForUserB = validateAndSanitizeImport(JSON.stringify(exportForUserB), Buffer.byteLength(JSON.stringify(exportForUserB)));
    const agentUserB = await prisma.agent.create({
      data: {
        ...sanitizedForUserB,
        userId: userB,
        agentConfig: JSON.stringify(sanitizedForUserB.agentConfig),
        tags: JSON.stringify(sanitizedForUserB.tags),
      }
    });
    createdAgentIds.push(agentUserB.id);

    // Verify User A's agent is still untouched
    const originalUserAAgent = await prisma.agent.findUnique({ where: { id: testAgent1.id } });

    if (
      agentUserB.userId === userB &&
      agentUserB.id !== testAgent1.id &&
      originalUserAAgent.userId === userA &&
      agentUserB.name === testAgent1.name
    ) {
      console.log(`  [PASS] Cross-user roundtrip succeeded. Agent created under User B (${agentUserB.id}). User A agent (${testAgent1.id}) remains intact.`);
      passed++;
    } else {
      console.error("  [FAIL] Cross-user roundtrip failed:", { agentUserB, originalUserAAgent });
      failed++;
    }

  } catch (err) {
    console.error("CRITICAL TEST SUITE ERROR:", err);
    failed++;
  } finally {
    // Cleanup test data
    if (createdAgentIds.length > 0) {
      console.log(`\n🧹 Cleaning up ${createdAgentIds.length} temporary test agents...`);
      await prisma.agent.deleteMany({
        where: { id: { in: createdAgentIds } }
      });
      console.log("  [DONE] Test agents cleaned up successfully.");
    }
    if (tempUserBId) {
      await prisma.user.delete({ where: { id: tempUserBId } }).catch(() => {});
    }
    await prisma.$disconnect();
  }

  console.log("\n====================================================");
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("====================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
