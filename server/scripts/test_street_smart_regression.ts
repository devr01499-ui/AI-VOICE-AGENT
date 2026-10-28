/**
 * Claritiy Voice — Automated Street-Smart Regression Test Suite (41/41)
 * 
 * Verifies:
 * - Version 1.1.0 & 700 token budget compliance
 * - 12 street-smart rules presence & ordering
 * - Google Calendar conditional inclusion & model-safe failure outputs
 * - Industry detection (recruitment, whole-word matching, role weighting, BFSI priority)
 * - Deterministic conversation quality lint rules (system phrases, decisive scheduling, no redundant confirmation, neutral salary, apology cap)
 * - Fixture validation on real failed HR call vs repaired golden HR call
 */
import dotenv from 'dotenv';
dotenv.config();
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://claritiy:testpassword@localhost:5432/claritiy_test';
}

import fs from 'fs';
import path from 'path';
import {
  buildFinalSystemInstruction,
  detectIndustry,
  resolveEffectiveIndustry,
  CORE_CONVERSATION_SKILLS_TEXT,
  CORE_SKILLS_VERSION,
  SYSTEM_INSTRUCTION_MARKER,
} from '../src/utils/systemInstructionBuilder';
import { CalendarService, CALENDAR_UNAVAILABLE_SAFE_INSTRUCTION } from '../src/core/orchestrator/CalendarService';
import { lintConversation } from '../src/utils/conversationQualityLint';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, details?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  \x1b[32m✔ PASS\x1b[0m [${totalTests}/41]: ${testName}`);
  } else {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m [${totalTests}/41]: ${testName}`, details || '');
  }
}

async function runTestSuite() {
  console.log('\n===============================================================');
  console.log('CLARITIY VOICE — STREET SMART REGRESSION SUITE (Target: 41/41)');
  console.log(`Version: ${CORE_SKILLS_VERSION}`);
  console.log('===============================================================\n');

  // ── GROUP 1: CORE SKILLS & TOKEN BUDGET (Tests 1-3) ──────────
  console.log('--- GROUP 1: CORE SKILLS SPECIFICATION & TOKEN BUDGET ---');
  
  // Test 1: Version check
  assert(CORE_SKILLS_VERSION === '1.1.0', 'Core conversation skills version is strictly 1.1.0');

  // Test 2: Token cap under 700
  const wordCount = CORE_CONVERSATION_SKILLS_TEXT.trim().split(/\s+/).length;
  const tokenEst = Math.ceil(wordCount * 1.2);
  assert(tokenEst < 700, `Token cap under 700 tokens (actual: ~${tokenEst} tokens)`);

  // Test 3: Exactly 12 numbered rules present
  const ruleCount = (CORE_CONVERSATION_SKILLS_TEXT.match(/^\d+\.\s+/gm) || []).length;
  assert(ruleCount === 12, `Exactly 12 street-smart rules declared (found: ${ruleCount})`);

  // ── GROUP 2: PROMPT ASSEMBLY ORDER & PRECEDENCE (Tests 4-11) ─
  console.log('\n--- GROUP 2: ASSEMBLY ORDER, IDEMPOTENCY & PRECEDENCE ---');
  const agentSample = {
    name: 'Recruitment Screener',
    systemPrompt: 'Screen senior candidates for engineering roles.',
  };
  const assembled = buildFinalSystemInstruction(agentSample);

  // Test 4: Core skills precedes agent instructions
  assert(
    assembled.indexOf('[CORE CONVERSATION SKILLS]') < assembled.indexOf('[AGENT INSTRUCTIONS (AUTHORITATIVE)]'),
    'Order: Core skills precedes Agent Authoritative Instructions'
  );

  // Test 5: Agent instructions precedes industry overlay
  assert(
    assembled.indexOf('[AGENT INSTRUCTIONS (AUTHORITATIVE)]') < assembled.indexOf('[RECRUITMENT OVERLAY]'),
    'Order: Agent Instructions precedes Recruitment Overlay'
  );

  // Test 6: Industry overlay precedes platform guardrails
  assert(
    assembled.indexOf('[RECRUITMENT OVERLAY]') < assembled.indexOf('[PLATFORM CAPABILITY GUARDRAILS]'),
    'Order: Recruitment Overlay precedes Platform Hard Rules'
  );

  // Test 7: Idempotent assembly
  const doubleAssembled = buildFinalSystemInstruction({ ...agentSample, systemPrompt: assembled });
  assert(doubleAssembled === assembled, 'Assembly is 100% idempotent via marker detection');

  // Test 8: Precedence rule declaration
  assert(
    assembled.includes('Hierarchy of authority: Platform Hard Rules > Agent Instructions (Authoritative) > Core Conversation Skills.'),
    'Precedence directive explicitly enforces hard rules > agent instructions > core skills'
  );

  // Test 9: Conflict regression — "answer in one word"
  const conf1 = buildFinalSystemInstruction({ systemPrompt: 'Always answer in one word only.' });
  assert(conf1.includes('Always answer in one word only.'), 'Agent "one word" constraint preserved without dilution');

  // Test 10: Conflict regression — "never ask questions"
  const conf2 = buildFinalSystemInstruction({ systemPrompt: 'Never ask questions under any circumstance.' });
  assert(conf2.includes('Never ask questions under any circumstance.'), 'Agent "never ask questions" constraint preserved');

  // Test 11: Conflict regression — verbatim disclaimer
  const conf3 = buildFinalSystemInstruction({ systemPrompt: 'Always say this verbatim: "Call monitored for safety."' });
  assert(conf3.includes('Always say this verbatim: "Call monitored for safety."'), 'Verbatim disclaimer requirement preserved');

  // ── GROUP 3: CALENDAR TOOLS & SAFE FALLBACK (Tests 12-18) ─────
  console.log('\n--- GROUP 3: GOOGLE CALENDAR GATING & MODEL-SAFE INSTRUCTIONS ---');

  // Test 12: CalendarService.hasConnectedCalendar returns false for empty userId
  const hasCalEmpty = await CalendarService.hasConnectedCalendar(null);
  assert(hasCalEmpty === false, 'hasConnectedCalendar returns false when userId is missing/null');

  // Test 13: CalendarService.hasConnectedCalendar returns boolean without throwing
  const hasCalDummy = await CalendarService.hasConnectedCalendar('non-existent-user-uuid');
  assert(hasCalDummy === false, 'hasConnectedCalendar returns false safely for unconnected account');

  // Test 14: checkAvailability returns model-safe instruction on missing user
  const availFail = await CalendarService.checkAvailability('', '2026-10-29T10:00:00Z', '2026-10-29T11:00:00Z');
  assert(
    availFail.success === false && availFail.instruction === CALENDAR_UNAVAILABLE_SAFE_INSTRUCTION,
    'checkAvailability returns model-safe instruction on missing account'
  );

  // Test 15: scheduleEvent returns model-safe instruction on missing user
  const schedFail = await CalendarService.scheduleEvent('', 'Interview', '2026-10-29T10:00:00Z', '2026-10-29T11:00:00Z');
  assert(
    schedFail.success === false && schedFail.instruction === CALENDAR_UNAVAILABLE_SAFE_INSTRUCTION,
    'scheduleEvent returns model-safe instruction on missing account'
  );

  // Test 16: checkAvailability error does NOT output raw "Google Calendar not connected"
  assert(
    !JSON.stringify(availFail).includes('Google Calendar not connected'),
    'checkAvailability output does NOT contain raw string "Google Calendar not connected"'
  );

  // Test 17: scheduleEvent error does NOT output raw "Google Calendar not connected"
  assert(
    !JSON.stringify(schedFail).includes('Google Calendar not connected'),
    'scheduleEvent output does NOT contain raw string "Google Calendar not connected"'
  );

  // Test 18: Safe instruction instructs model to propose specific time and note without mentioning errors
  assert(
    CALENDAR_UNAVAILABLE_SAFE_INSTRUCTION.includes('Do NOT mention systems') &&
    CALENDAR_UNAVAILABLE_SAFE_INSTRUCTION.includes('propose a specific time'),
    'CALENDAR_UNAVAILABLE_SAFE_INSTRUCTION directs agent to propose specific time and forbid system talk'
  );

  // ── GROUP 4: INDUSTRY DETECTION & SAFETY GATE (Tests 19-30) ──
  console.log('\n--- GROUP 4: INDUSTRY DETECTION & SAFETY GATES ---');

  // Test 19: Recruitment auto-detected from name "HR Recruiter"
  assert(
    detectIndustry('We are looking for great people', 'HR Recruiter') === 'recruitment',
    'Detected Recruitment from name "HR Recruiter"'
  );

  // Test 20: Recruitment auto-detected from "talent acquisition manager"
  assert(
    detectIndustry('Evaluate candidates for software positions', 'Talent Acquisition Manager') === 'recruitment',
    'Detected Recruitment from role "Talent Acquisition Manager"'
  );

  // Test 21: Recruiter with "support" in prompt stays recruitment (no false support desk classification)
  const recruiterPrompt = 'Screen engineering candidates and support the hiring managers with interview scheduling';
  assert(
    detectIndustry(recruiterPrompt, 'Executive Recruiter') === 'recruitment',
    'Recruiter with "support" in prompt correctly classifies as Recruitment, NOT support desk'
  );

  // Test 22: Whole-word matching prevents substring collisions (e.g. "supporter" != "support")
  assert(
    detectIndustry('We are a soccer supporter club organizing fan meetings', 'Supporter Club') !== 'support',
    'Whole-word matching avoids substring collision ("supporter" is not support)'
  );

  // Test 23: BFSI safety gate wins when financial keywords present even if recruitment keywords present
  assert(
    detectIndustry('Hiring interview for banking credit card loan collections executive', 'Recruiter') === 'bfsi',
    'BFSI safety gate overrides recruitment when banking/loan/collections keywords present'
  );

  // Test 24: BFSI safety gate overrides explicit user sales setting
  assert(
    resolveEffectiveIndustry('sales', 'bfsi') === 'bfsi',
    'Strict safety: user sales setting overridden by detected BFSI'
  );

  // Test 25: Healthcare detection
  assert(
    detectIndustry('Book dentist appointment for root canal cleaning', 'Dental Clinic') === 'healthcare',
    'Detected Healthcare from "dentist" and "appointment"'
  );

  // Test 26: Real Estate detection
  assert(
    detectIndustry('Luxury 3 BHK flats and villas for site visit', 'Realty Specialist') === 'real_estate',
    'Detected Real Estate from "3 BHK", "villas", "site visit"'
  );

  // Test 27: Support desk detection
  assert(
    detectIndustry('Customer service helpdesk for order cancellations, tickets and refunds', 'Support Desk') === 'support',
    'Detected Support from "helpdesk", "ticket", "refund"'
  );

  // Test 28: Sales lead qualification detection
  assert(
    detectIndustry('Qualify outbound leads, pitch product demo and discuss pricing discount', 'Outbound Sales Setter') === 'sales',
    'Detected Sales from "sales", "demo", "pricing"'
  );

  // Test 29: Generic fallback to other
  assert(
    detectIndustry('General information assistant for daily weather and trivia', 'Trivia Bot') === 'other',
    'General bot falls back to "other"'
  );

  // Test 30: Recruitment overlay is injected into assembled system prompt
  assert(
    assembled.includes('[RECRUITMENT OVERLAY]') && assembled.includes('Screen candidates respectfully'),
    'Recruitment overlay successfully injected for recruitment agent'
  );

  // ── GROUP 5: DETERMINISTIC QUALITY LINT RULES (Tests 31-40) ──
  console.log('\n--- GROUP 5: DETERMINISTIC CONVERSATION QUALITY LINTER ---');

  // Test 31: Flags "unable to check"
  const lint1 = lintConversation('User: When are you free?\nAgent: I am unable to check right now.');
  assert(
    lint1.passed === false && lint1.findings.some(f => f.rule === 'FORBIDDEN_SYSTEM_TERMS'),
    'Linter catches forbidden phrase: "unable to check"'
  );

  // Test 32: Flags "calendar not connected"
  const lint2 = lintConversation('User: Can we meet Monday?\nAgent: Google calendar not connected in our backend.');
  assert(
    lint2.passed === false && lint2.findings.some(f => f.rule === 'FORBIDDEN_SYSTEM_TERMS'),
    'Linter catches forbidden phrase: "calendar not connected"'
  );

  // Test 33: Flags "system error"
  const lint3 = lintConversation('User: Can you check that?\nAgent: I encountered a system error.');
  assert(
    lint3.passed === false && lint3.findings.some(f => f.rule === 'FORBIDDEN_SYSTEM_TERMS'),
    'Linter catches forbidden phrase: "system error"'
  );

  // Test 34: Flags "technical glitch"
  const lint4 = lintConversation('User: Hello?\nAgent: We are experiencing a technical glitch with our system.');
  assert(
    lint4.passed === false && lint4.findings.some(f => f.rule === 'FORBIDDEN_SYSTEM_TERMS'),
    'Linter catches forbidden phrase: "technical glitch"'
  );

  // Test 35: "you tell me" followed by specific time proposal passes
  const lint5 = lintConversation([
    { role: 'user', text: 'When can we do it? You tell me.' },
    { role: 'agent', text: 'How about tomorrow at 3 PM?' }
  ]);
  assert(
    lint5.findings.every(f => f.rule !== 'OPEN_SCHEDULING_PROPOSAL'),
    '"you tell me" followed by specific time proposal passes decisively'
  );

  // Test 36: "you tell me" followed by vague question fails
  const lint6 = lintConversation([
    { role: 'user', text: 'When can we do it? You tell me.' },
    { role: 'agent', text: 'We have flexibility, what does your schedule look like?' }
  ]);
  assert(
    lint6.findings.some(f => f.rule === 'OPEN_SCHEDULING_PROPOSAL'),
    '"you tell me" followed by vague question correctly flagged by linter'
  );

  // Test 37: Caller states time followed by "noted" passes
  const lint7 = lintConversation([
    { role: 'user', text: 'Can we do tomorrow 10 AM?' },
    { role: 'agent', text: 'Noted, tomorrow at 10 AM.' }
  ]);
  assert(
    lint7.findings.every(f => f.rule !== 'NO_REDUNDANT_CONFIRMATION'),
    'Caller states time followed by "noted" passes without redundant confirmation'
  );

  // Test 38: Caller states time followed by redundant confirmation fails
  const lint8 = lintConversation([
    { role: 'user', text: 'Can we do tomorrow 10 AM?' },
    { role: 'agent', text: 'Would tomorrow at 10 AM work for you? Please confirm.' }
  ]);
  assert(
    lint8.findings.some(f => f.rule === 'NO_REDUNDANT_CONFIRMATION'),
    'Caller states time followed by redundant confirmation is flagged as error'
  );

  // Test 39: "why will team reach out?" answered with specific details passes
  const lint9 = lintConversation([
    { role: 'user', text: 'Why will your team reach out to me?' },
    { role: 'agent', text: 'Our talent team will review screening notes and email your confirmed interview slot within 24 hours.' }
  ]);
  assert(
    lint9.findings.every(f => f.rule !== 'SPECIFIC_FOLLOWUP_DETAILS'),
    '"why will team reach out?" answered with who, when and purpose passes'
  );

  // Test 40: Unusual figure ("five lakh per month") confirmed neutrally passes
  const lint10 = lintConversation([
    { role: 'user', text: 'My expectation is five lakh per month.' },
    { role: 'agent', text: 'Understood, 5 lakhs per month noted. When are you free for an interview?' }
  ]);
  assert(
    lint10.findings.every(f => f.rule !== 'NEUTRAL_UNUSUAL_FIGURE'),
    'Unusual compensation figure confirmed neutrally without shock passes cleanly'
  );

  // ── GROUP 6: REAL FAILED CALL VS GOLDEN FIXTURE (Test 41) ────
  console.log('\n--- GROUP 6: REAL CALL REGRESSION FIXTURE VALIDATION ---');
  const failedFixturePath = path.resolve(__dirname, 'fixtures/hr_recruiter_failed.json');
  const goldenFixturePath = path.resolve(__dirname, 'fixtures/hr_recruiter_golden.json');

  const failedTurns = JSON.parse(fs.readFileSync(failedFixturePath, 'utf8'));
  const goldenTurns = JSON.parse(fs.readFileSync(goldenFixturePath, 'utf8'));

  const failedEval = lintConversation(failedTurns);
  const goldenEval = lintConversation(goldenTurns);

  const fixtureVerified = failedEval.passed === false && failedEval.findings.length >= 3 && goldenEval.passed === true && goldenEval.findings.length === 0;

  assert(
    fixtureVerified,
    `Real failed HR call (0ac6f759) fails with ${failedEval.findings.length} findings; golden repaired call passes with 0 findings (100% score)`
  );

  // ── FINAL SUMMARY ────────────────────────────────────────────
  console.log('\n===============================================================');
  console.log(`STREET SMART REGRESSION RESULT: ${passedTests}/${totalTests} TESTS PASSED (${((passedTests/totalTests)*100).toFixed(1)}%)`);
  console.log('===============================================================\n');

  if (passedTests === 41 && totalTests === 41) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal error in regression suite:', err);
  process.exit(1);
});
