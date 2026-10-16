/**
 * Verification Test Script: Item 2 - Voice Feel, Accent & Pronunciation Directives
 * 
 * Verifies:
 * 1. Persona & Pronunciation directive content and versioning.
 * 2. Idempotent injection into agent system instructions.
 * 3. Grouped number instruction, natural cadence, and anti-robotic formatting rules.
 * 4. Curation of top recommended voices per language.
 * 5. Presence and accessibility of audio preview samples on disk.
 * 6. Absence of unsupported speechConfig.languageCode flags.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Compile-time checks & unit verification
const personaModule = require('../dist/utils/personaPrompt');
const {
  VOICE_PERSONA_VERSION,
  INDIAN_ENGLISH_PRONUNCIATION_DIRECTIVE,
  RECOMMENDED_VOICES_BY_LANGUAGE,
  injectVoicePersonaDirective,
} = personaModule;

console.log('=== TEST 1: Directive Structure & Versioning ===');
assert.strictEqual(VOICE_PERSONA_VERSION, '1.0.0', 'Persona directive must be versioned');
console.log(`✓ Directive version: ${VOICE_PERSONA_VERSION}`);

assert(INDIAN_ENGLISH_PRONUNCIATION_DIRECTIVE.includes('Indian-English or Hinglish'), 'Must steer Indian-English or Hinglish register');
assert(INDIAN_ENGLISH_PRONUNCIATION_DIRECTIVE.includes('group digits with natural micro-pauses'), 'Must include grouped number instruction');
assert(INDIAN_ENGLISH_PRONUNCIATION_DIRECTIVE.includes('Never monologue'), 'Must mandate concise utterances and natural pacing');
assert(INDIAN_ENGLISH_PRONUNCIATION_DIRECTIVE.includes('Never recite bullet points'), 'Must prohibit robotic lists and markdown');
console.log('✓ All 5 mandatory pronunciation & persona constraints present in directive');

console.log('\n=== TEST 2: Idempotent Injection Engine ===');
const basePrompt = 'You are a healthcare assistant for Apollo Clinics.';
const injectedOnce = injectVoicePersonaDirective(basePrompt);
assert(injectedOnce.includes(basePrompt), 'Must retain base prompt');
assert(injectedOnce.includes('[PERSONA & PRONUNCIATION GUIDELINES'), 'Must append persona directive');

const injectedTwice = injectVoicePersonaDirective(injectedOnce);
assert.strictEqual(injectedOnce, injectedTwice, 'Injection must be strictly idempotent');
console.log('✓ Idempotency verified: re-evaluating prompt produces identical string with zero duplication');

console.log('\n=== TEST 3: Curated Voice Recommendations per Language ===');
const languages = ['en', 'hi', 'bn', 'kn', 'ml', 'gu', 'ta', 'zh', 'ar'];
for (const lang of languages) {
  const recs = RECOMMENDED_VOICES_BY_LANGUAGE[lang];
  assert(recs, `Language ${lang} must have voice recommendations`);
  assert(recs.male.length >= 1, `Language ${lang} must have at least 1 top male voice`);
  assert(recs.female.length >= 1, `Language ${lang} must have at least 1 top female voice`);
  console.log(`✓ ${lang.toUpperCase()}: Male -> [${recs.male.join(', ')}], Female -> [${recs.female.join(', ')}]`);
}

console.log('\n=== TEST 4: Audio Preview Files on Disk ===');
const previewsDir = path.resolve(__dirname, '..', '..', 'Frontend', 'public', 'previews');
assert(fs.existsSync(previewsDir), `Previews directory must exist: ${previewsDir}`);

const requiredWavs = [
  'puck.wav', 'kore.wav', 'aoede.wav', 'charon.wav',
  'puck_hi.wav', 'kore_hi.wav', 'aoede_hi.wav', 'charon_hi.wav',
  'puck_en.wav', 'kore_en.wav', 'aoede_en.wav', 'charon_en.wav',
  'puck_bn.wav', 'kore_bn.wav',
];

for (const wav of requiredWavs) {
  const wavPath = path.join(previewsDir, wav);
  assert(fs.existsSync(wavPath), `Preview audio file must exist: ${wav}`);
  const stat = fs.statSync(wavPath);
  assert(stat.size > 50000, `Audio file ${wav} must be a real audio recording (>50KB, actual: ${stat.size}B)`);
  console.log(`✓ Preview file verified: ${wav} (${(stat.size / 1024).toFixed(1)} KB)`);
}

console.log('\n=== TEST 5: Zero-Regression API & Model Check ===');
const geminiProviderPath = path.resolve(__dirname, '..', 'src', 'providers', 'gemini', 'GeminiLiveProvider.ts');
const geminiProviderContent = fs.readFileSync(geminiProviderPath, 'utf8');

// Gemini native audio models do NOT support speechConfig.languageCode; confirm we didn't add it
assert(!geminiProviderContent.includes('speechConfig.languageCode'), 'MUST NOT invent speechConfig.languageCode');
assert(!geminiProviderContent.includes('languageCode:'), 'MUST NOT invent languageCode in speechConfig');
console.log('✓ Verified: No unsupported speechConfig.languageCode parameter added to GeminiLiveProvider');

console.log('\n🎉 ALL ITEM 2 TESTS PASSED SUCCESSFULLY!');
