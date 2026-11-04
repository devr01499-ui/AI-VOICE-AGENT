#!/usr/bin/env node
/**
 * Claritiy Voice — Voice Personas & Natural Speech Verification Suite (Task T6)
 *
 * Verifies:
 *  1. Personas: 'professional', 'conversational', 'urgent' definitions and properties
 *  2. Natural speech prompt block:
 *     - Filler words ('hmm', 'I see', 'let me check')
 *     - Short turns (1-2 sentences maximum)
 *     - Spoken numbers ('twenty-five' not '25')
 *     - Hinglish colloquial mirroring
 *  3. Dynamic assembly with language modes
 */

const {
  VOICE_PERSONAS,
  buildNaturalSpeechPromptBlock,
} = require('../dist/config/voicePersonas.js');

let failures = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failures++;
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

console.log('================================================================');
console.log('TASK T6: VOICE PERSONAS & NATURAL SPEECH PROMPT VERIFICATION');
console.log('================================================================');

// ── Test 1: Validate 3 Personas ─────────────────────────────────────────────
console.log('\n--- Test 1: Standard Persona Definitions ---');
const requiredPersonas = ['professional', 'conversational', 'urgent'];
for (const p of requiredPersonas) {
  const persona = VOICE_PERSONAS[p];
  assert(Boolean(persona), `Persona '${p}' must be defined`);
  assert(typeof persona.description === 'string' && persona.description.length > 0, `'${p}' must have non-empty description`);
  assert(typeof persona.pacing === 'string' && persona.pacing.length > 0, `'${p}' must have non-empty pacing`);
  assert(Array.isArray(persona.mannerisms) && persona.mannerisms.length > 0, `'${p}' must have mannerisms array`);
}

// ── Test 2: Natural Speech Prompt Guidelines ────────────────────────────────
console.log('\n--- Test 2: Conversational Prompt Block Content ---');
const convPrompt = buildNaturalSpeechPromptBlock('conversational', 'en');
console.log('Prompt sample preview:\n' + convPrompt.slice(0, 300) + '...\n');

assert(convPrompt.includes('Short turns:'), 'Must enforce short turns (1-2 sentences max)');
assert(convPrompt.includes('Natural fillers:'), 'Must include natural fillers directive');
assert(convPrompt.includes('Hmm') || convPrompt.includes('hmm'), 'Must cite filler words like Hmm/I see');
assert(convPrompt.includes('Spoken numbers:'), 'Must include spoken numbers directive');
assert(convPrompt.includes('twenty-five'), 'Must cite spoken number examples (e.g. twenty-five)');

// ── Test 3: Hinglish Colloquial Rules ────────────────────────────────────────
console.log('\n--- Test 3: Hinglish Phrasing Adaptation ---');
const hinglishPrompt = buildNaturalSpeechPromptBlock('conversational', 'hinglish');
assert(hinglishPrompt.includes('HINGLISH COLLOQUIAL ADAPTATION'), 'Must include Hinglish section when language is hinglish');
assert(hinglishPrompt.includes('Mirror the caller\'s language balance'), 'Must instruct mirroring caller language balance');
assert(hinglishPrompt.includes('Do NOT arbitrarily mix English grammar rules with Hindi vocabulary'), 'Must prevent artificial grammar mixing');

// Verify pure English mode omits Hinglish section
const englishPrompt = buildNaturalSpeechPromptBlock('professional', 'en');
assert(!englishPrompt.includes('HINGLISH COLLOQUIAL ADAPTATION'), 'Must omit Hinglish section when language is english');

console.log('\n================================================================');
if (failures === 0) {
  console.log('🎉 ALL VOICE PERSONA TESTS PASSED WITH ZERO FAILURES');
  console.log('================================================================\n');
  process.exit(0);
} else {
  console.error(`💥 ${failures} VOICE PERSONA TEST(S) FAILED`);
  console.log('================================================================\n');
  process.exit(1);
}
