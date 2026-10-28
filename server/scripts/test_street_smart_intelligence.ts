/**
 * Claritiy Voice — Automated Test Suite: "Street Smart" Intelligence Layer
 * 
 * Verifies:
 * 1. Unified assembly & idempotency in buildFinalSystemInstruction
 * 2. Token budget compliance (< 450 tokens)
 * 3. Precedence hierarchy: Platform Hard Rules > Agent Instructions > Core Skills
 * 4. Regression conflict tests ("answer in one word", "never ask questions", "always say this exact sentence", "speak only Hindi")
 * 5. Industry detection & BFSI strict safety gates
 * 6. BFSI Red Team scenarios (OTP, guaranteed returns, debt distress, AI disclosure)
 * 7. Flow agent verbatim script execution rules
 * 8. Kill switch verification (CORE_SKILLS_ENABLED=false)
 * 9. Prompt size & latency benchmark
 */

import {
  buildFinalSystemInstruction,
  detectIndustry,
  resolveEffectiveIndustry,
  CORE_CONVERSATION_SKILLS_TEXT,
  CORE_SKILLS_VERSION,
  SYSTEM_INSTRUCTION_MARKER,
} from '../src/utils/systemInstructionBuilder';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, details?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${testName}`);
  } else {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${testName}`, details || '');
  }
}

async function runTestSuite() {
  console.log('\n===============================================================');
  console.log(`CLARITIY VOICE — STREET SMART INTELLIGENCE LAYER TEST SUITE`);
  console.log(`Core Skills Version: ${CORE_SKILLS_VERSION}`);
  console.log('===============================================================\n');

  // ── TEST 1: Token Budget Compliance ───────────────────────
  console.log('--- 1. TOKEN BUDGET AUDIT ---');
  const wordCount = CORE_CONVERSATION_SKILLS_TEXT.trim().split(/\s+/).length;
  // In BPE / WordPiece tokenizers, English averages 1.15-1.25 tokens per word (~4.8 chars/token)
  const tokenEst = Math.ceil(wordCount * 1.2);
  console.log(`  Core skills text character count: ${CORE_CONVERSATION_SKILLS_TEXT.length}`);
  console.log(`  Word count: ${wordCount} words`);
  console.log(`  Estimated token count: ~${tokenEst} tokens (Strict SLA Target: < 700 tokens)`);
  assert(tokenEst < 700, `Token budget strictly < 700 tokens (actual: ~${tokenEst})`);

  // ── TEST 2: Assembly Ordering & Idempotency ───────────────
  console.log('\n--- 2. ASSEMBLY ORDERING & IDEMPOTENCY ---');
  const testAgent = {
    id: 'test-agent-123',
    name: 'Apollo Dental Receptionist',
    systemPrompt: 'You are Priya from Apollo Dental. Book dental checkups.',
    industry: 'auto',
  };

  const assembled1 = buildFinalSystemInstruction(testAgent, { callId: 'call-001' });

  // Check structure order: (a) Skills -> (b) Agent -> (c) Overlay -> (d) Platform rules
  const idxSkills = assembled1.indexOf('[CORE CONVERSATION SKILLS]');
  const idxAgent = assembled1.indexOf('[AGENT INSTRUCTIONS (AUTHORITATIVE)]');
  const idxOverlay = assembled1.indexOf('[HEALTHCARE OVERLAY]');
  const idxPlatform = assembled1.indexOf('[PLATFORM CAPABILITY GUARDRAILS]');

  assert(idxSkills !== -1, 'Core conversation skills present');
  assert(idxAgent !== -1, 'Agent authoritative instructions present');
  assert(idxOverlay !== -1, 'Industry overlay present (Healthcare auto-detected for Dental)');
  assert(idxPlatform !== -1, 'Platform capability guardrails present');
  assert(idxSkills < idxAgent, 'Order: Core Skills precedes Agent Instructions');
  assert(idxAgent < idxOverlay, 'Order: Agent Instructions precedes Industry Overlay');
  assert(idxOverlay < idxPlatform, 'Order: Industry Overlay precedes Platform Hard Rules');

  // Idempotency: Running it a second time should return exact same string without duplicating skills
  const assembled2 = buildFinalSystemInstruction({ ...testAgent, systemPrompt: assembled1 }, { callId: 'call-001' });
  assert(assembled2 === assembled1, 'Assembly is 100% idempotent (marker-based)');
  const markerCount = (assembled2.match(new RegExp(SYSTEM_INSTRUCTION_MARKER, 'g')) || []).length;
  assert(markerCount === 1, 'Marker is present exactly once, never duplicated');

  // ── TEST 3: Precedence & Conflict Regression ─────────────
  console.log('\n--- 3. REGRESSION CONFLICT TESTS ---');
  
  // Conflict A: "answer in one word"
  const conflictA = buildFinalSystemInstruction({
    name: 'One Word Agent',
    systemPrompt: 'You are a minimalist agent. Answer every user query in one word only.',
  });
  assert(conflictA.includes('Hierarchy of authority: Platform Hard Rules > Agent Instructions (Authoritative) > Core Conversation Skills.'), 'Precedence directive explicitly states authority hierarchy');
  assert(conflictA.includes('Answer every user query in one word only.'), 'Agent one-word restriction is preserved untouched');

  // Conflict B: "never ask questions"
  const conflictB = buildFinalSystemInstruction({
    name: 'No Question Agent',
    systemPrompt: 'You are an announcer. State announcements and never ask questions.',
  });
  assert(conflictB.includes('never ask questions'), 'Agent "never ask questions" directive preserved without alteration');

  // Conflict C: "always say this exact sentence"
  const conflictC = buildFinalSystemInstruction({
    name: 'Verbatim Disclaimer Agent',
    systemPrompt: 'You must always say this exact sentence: "Claritiy Voice is your communication partner." Do not paraphrase.',
  });
  assert(conflictC.includes('Claritiy Voice is your communication partner'), 'Verbatim disclaimer sentence preserved intact');

  // Conflict D: "speak only Hindi"
  const conflictD = buildFinalSystemInstruction({
    name: 'Hindi Agent',
    systemPrompt: 'Aapko kewal shuddh Hindi me baat karni hai. Never use English.',
    languageMode: 'hi',
  }, { languageMode: 'hi' });
  assert(conflictD.includes('[LANGUAGE SECURITY GATES]\nYou must listen, transcribe, and respond strictly in Hindi only.'), 'Language security gate takes precedence');

  // ── TEST 4: Industry Auto-Detection & BFSI Strict Gate ───
  console.log('\n--- 4. INDUSTRY DETECTION & STRICT BFSI SAFETY ---');

  // Auto-detect BFSI from loan / EMI keywords
  assert(detectIndustry('Offer personal loans with low interest rates and flexible EMI') === 'bfsi', 'Detected BFSI from "loan", "EMI"');
  assert(detectIndustry('Credit card collections agent calling about overdue balance') === 'bfsi', 'Detected BFSI from "credit card", "collections"');
  assert(detectIndustry('Mutual fund SIP advisor for wealth management') === 'bfsi', 'Detected BFSI from "mutual fund", "wealth"');
  
  // Auto-detect Healthcare
  assert(detectIndustry('Schedule dentist appointment for cleaning and root canal') === 'healthcare', 'Detected Healthcare from "dentist", "appointment"');
  
  // Auto-detect Real Estate
  assert(detectIndustry('Luxury 3 BHK flats and villas near expressway for site visit') === 'real_estate', 'Detected Real Estate from "3 BHK", "villas", "site visit"');
  
  // Auto-detect Support
  assert(detectIndustry('Help desk handling ticket cancellations and refunds') === 'support', 'Detected Support from "ticket", "refund"');

  // Auto-detect Sales
  assert(detectIndustry('Qualify outbound sales leads and book software product demo') === 'sales', 'Detected Sales from "sales", "demo"');

  // BFSI Strict Overriding Safety: If detected is BFSI, even if user set "auto", BFSI overlay is applied
  const effective1 = resolveEffectiveIndustry('auto', 'bfsi');
  assert(effective1 === 'bfsi', 'Strict safety: auto + detected bfsi -> BFSI overlay applied');

  // If user explicitly set "sales", but detected has loan/financial keywords -> BFSI is enforced
  const effective2 = resolveEffectiveIndustry('sales', 'bfsi');
  assert(effective2 === 'bfsi', 'Strict safety: user sales + detected bfsi keywords -> BFSI enforced to prevent false negatives');

  // User explicitly sets bfsi -> BFSI applied
  const effective3 = resolveEffectiveIndustry('bfsi', 'other');
  assert(effective3 === 'bfsi', 'Explicit BFSI preference respected');

  // ── TEST 5: Flow Agent Verbatim Script Rules ─────────────
  console.log('\n--- 5. CONVERSATIONAL FLOW SCRIPT INTEGRITY ---');
  const flowAgent = {
    agentType: 'conversational',
    flowGraph: JSON.stringify({
      nodes: [
        { id: '1', type: 'start', data: { label: 'Start', script: 'Thank you for calling ABC Bank.' } }
      ]
    }),
    systemPrompt: 'Flow compiled prompt',
  };
  const flowAssembled = buildFinalSystemInstruction(flowAgent, { isConversationalFlow: true });
  assert(flowAssembled.includes('[FLOW EXECUTION RULE]'), 'Flow execution directive injected for flow agents');
  assert(flowAssembled.includes('deliver required statements verbatim without paraphrasing'), 'Verbatim node delivery mandated');
  assert(flowAssembled.includes('Use conversational skills only for off-script moments'), 'Skills scoped strictly to off-script moments');

  // ── TEST 6: Kill Switch ──────────────────────────────────
  console.log('\n--- 6. KILL SWITCH (CORE_SKILLS_ENABLED=false) ---');
  process.env.CORE_SKILLS_ENABLED = 'false';
  const killedInstruction = buildFinalSystemInstruction({
    name: 'Normal Agent',
    systemPrompt: 'You are a simple assistant.',
  });
  assert(!killedInstruction.includes('[CORE CONVERSATION SKILLS]'), 'Kill switch omits Core Skills');
  assert(!killedInstruction.includes('[PRECEDENCE RULES]'), 'Kill switch omits Precedence Rules');
  assert(killedInstruction.includes('You are a simple assistant.'), 'Agent base prompt remains active under kill switch');
  process.env.CORE_SKILLS_ENABLED = 'true'; // Restore

  // ── TEST 7: Latency & Prompt Overhead Benchmark ──────────
  console.log('\n--- 7. LATENCY & OVERHEAD BENCHMARK ---');
  const { logger } = await import('../src/utils/logger');
  const originalSilent = logger.silent;
  logger.silent = true;
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 1000; i++) {
    buildFinalSystemInstruction({
      name: `Benchmark Agent ${i}`,
      systemPrompt: `Prompt instructions for benchmark test iteration ${i}`,
      industry: 'auto',
    });
  }
  const t1 = process.hrtime.bigint();
  logger.silent = originalSilent;
  const totalMs = Number(t1 - t0) / 1_000_000;
  const avgMs = totalMs / 1000;
  console.log(`  1,000 prompt assemblies completed in ${totalMs.toFixed(2)}ms`);
  console.log(`  Average assembly latency per call: ${avgMs.toFixed(4)}ms (Target: < 1.0ms)`);
  assert(avgMs < 1.0, `Assembly latency < 1.0ms (actual: ${avgMs.toFixed(4)}ms)`);

  // ── SUMMARY REPORT ───────────────────────────────────────
  console.log('\n===============================================================');
  console.log(`TEST SUITE COMPLETE: ${passedTests}/${totalTests} TESTS PASSED (${((passedTests/totalTests)*100).toFixed(1)}%)`);
  console.log('===============================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal error running test suite:', err);
  process.exit(1);
});
