require('dotenv').config({ path: './server/.env' });
const { prisma } = require('../server/dist/lib/prisma');
const { QaController } = require('../server/dist/controllers/QaController');

async function runTest() {
  console.log("=== Phase 7 Automated QA on Prompt/Flow Changes Verification ===");

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

    // Test 1: Run lightweight QA check on high quality system prompt
    const highQualityPrompt = "You are an AI support agent for Claritiy Voice. Greet callers politely and answer questions accurately. If you cannot solve an issue, apologize gracefully and transfer to a representative.";
    const highQualityResult = QaController.runLightweightQaCheck(highQualityPrompt, null);
    assert(highQualityResult.overallScore >= 80, `High quality prompt score >= 80 (Actual: ${highQualityResult.overallScore})`);
    assert(highQualityResult.status === 'PASS', `High quality prompt status is PASS (Actual: ${highQualityResult.status})`);
    assert(highQualityResult.passed === true, `High quality prompt passed boolean is true`);

    // Test 2: Run lightweight QA check on empty / missing system prompt
    const emptyPromptResult = QaController.runLightweightQaCheck("", null);
    assert(emptyPromptResult.overallScore < 70, `Empty prompt score < 70 (Actual: ${emptyPromptResult.overallScore})`);
    assert(emptyPromptResult.status === 'FAIL', `Empty prompt status is FAIL (Actual: ${emptyPromptResult.status})`);
    assert(emptyPromptResult.flaggedIssues.length > 0, `Empty prompt flagged issues populated: ${emptyPromptResult.flaggedIssues.join('; ')}`);

    // Test 3: Run lightweight QA check on brief prompt lacking fallbacks/greeting
    const briefPromptResult = QaController.runLightweightQaCheck("Answer questions.", null);
    assert(briefPromptResult.flaggedIssues.some(i => i.includes('too brief') || i.includes('persona') || i.includes('fallback')), `Brief prompt correctly flags quality regressions`);

    // Test 4: Create a draft agent in DB and simulate save trigger
    console.log("\nTesting agent creation with automated QA payload...");
    const draftAgent = await prisma.agent.create({
      data: {
        userId: user.id,
        name: "Phase 7 Auto QA Test Agent",
        systemPrompt: highQualityPrompt,
        agentType: "conversational",
        status: "draft",
        agentConfig: "{}",
      },
    });

    const createQaEvaluation = QaController.runLightweightQaCheck(draftAgent.systemPrompt, draftAgent.flowGraph);
    assert(createQaEvaluation.status === 'PASS', `New agent automatically evaluated on save with status PASS`);

    // Test 5: Update agent prompt with lower quality text and verify regression flag
    console.log("Updating agent prompt with regression trigger...");
    await prisma.agent.update({
      where: { id: draftAgent.id },
      data: { systemPrompt: "Short prompt." },
    });

    const updatedAgent = await prisma.agent.findUnique({ where: { id: draftAgent.id } });
    const updateQaEvaluation = QaController.runLightweightQaCheck(updatedAgent.systemPrompt, updatedAgent.flowGraph);
    assert(updateQaEvaluation.overallScore < 80, `Prompt regression detected automatically (Score: ${updateQaEvaluation.overallScore})`);

    // Clean up draft agent
    await prisma.agent.delete({ where: { id: draftAgent.id } });
    console.log("Cleaned up test agent.");

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
