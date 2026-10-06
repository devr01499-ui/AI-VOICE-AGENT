/**
 * Unit tests for resolveLiveModel — server/src/utils/modelResolver.ts
 * Per GOVERNANCE_RULES §6: imports from compiled production code only.
 * Run with: node scripts/test_model_resolver.js (after tsc build)
 */

const path = require('path');
const distPath = path.join(__dirname, '..', 'dist', 'utils', 'modelResolver.js');
let resolveLiveModel, DEFAULT_LIVE_MODEL;
try {
  const m = require(distPath);
  resolveLiveModel = m.resolveLiveModel;
  DEFAULT_LIVE_MODEL = m.DEFAULT_LIVE_MODEL;
} catch (e) {
  console.error('ERROR: Cannot load compiled module. Run tsc first.', e.message);
  process.exit(1);
}

const EXPECTED_DEFAULT = 'models/gemini-2.5-flash-native-audio-latest';

const cases = [
  // [input, expectedOutput, description]
  [null,                                        EXPECTED_DEFAULT, 'null → default'],
  [undefined,                                   EXPECTED_DEFAULT, 'undefined → default'],
  ['',                                          EXPECTED_DEFAULT, 'empty string → default'],
  ['  ',                                        EXPECTED_DEFAULT, 'whitespace → default'],
  ['gemini-2.5-flash',                          EXPECTED_DEFAULT, 'legacy text model → default'],
  ['models/gemini-2.5-flash',                   EXPECTED_DEFAULT, 'prefixed text model → default'],
  ['gpt-4o',                                    EXPECTED_DEFAULT, 'openai text model → default'],
  ['gpt-4o-realtime-preview',                   EXPECTED_DEFAULT, 'openai realtime model → default'],
  ['gemini-2.5-flash-native-audio-latest',      EXPECTED_DEFAULT, 'native-audio without prefix → add models/ prefix'],
  ['models/gemini-2.5-flash-native-audio-latest', EXPECTED_DEFAULT, 'already correct → unchanged'],
  ['gemini-2.0-flash-native-audio-latest',      'models/gemini-2.0-flash-native-audio-latest', 'different native-audio model → add prefix'],
  ['models/gemini-2.0-flash-native-audio-latest', 'models/gemini-2.0-flash-native-audio-latest', 'prefixed different native-audio → unchanged'],
];

let passed = 0;
let failed = 0;

for (const [input, expected, desc] of cases) {
  const result = resolveLiveModel(input);
  if (result === expected) {
    console.log(`  ✅ PASS: ${desc}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${desc}`);
    console.error(`     input:    ${JSON.stringify(input)}`);
    console.error(`     expected: ${expected}`);
    console.error(`     got:      ${result}`);
    failed++;
  }
}

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
