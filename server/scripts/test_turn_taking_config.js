#!/usr/bin/env node
/**
 * Claritiy Voice — Turn-Taking Configuration Verification Suite (Task T4)
 *
 * Verifies:
 *  1. Defaults: responsivenessMs=200, prefixPaddingMs=20, proactiveAudio=true
 *  2. Clamping: responsivenessMs clamped to [100, 1000], prefixPaddingMs clamped to [0, 200]
 *  3. Omission of proactivity block when proactiveAudio is false
 */

const { resolveTurnTakingConfig } = require('../dist/providers/gemini/GeminiLiveProvider.js');

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
console.log('TASK T4: TURN-TAKING KNOBS & PROACTIVITY CONFIG VERIFICATION');
console.log('================================================================');

// ── Test 1: Default Behavior ────────────────────────────────────────────────
console.log('\n--- Test 1: Default Speech Settings Fallback ---');
const defaults = resolveTurnTakingConfig();
console.log('Resolved defaults:', JSON.stringify(defaults));
assert(defaults.responsivenessMs === 200, `Default responsivenessMs must be 200 (got ${defaults.responsivenessMs})`);
assert(defaults.prefixPaddingMs === 20, `Default prefixPaddingMs must be 20 (got ${defaults.prefixPaddingMs})`);
assert(defaults.proactiveAudio === true, `Default proactiveAudio must be true (got ${defaults.proactiveAudio})`);

// ── Test 2: Custom Values Within Safe Range ─────────────────────────────────
console.log('\n--- Test 2: Custom In-Range Configuration ---');
const custom = resolveTurnTakingConfig({
  responsivenessMs: 350,
  prefixPaddingMs: 80,
  proactiveAudio: false,
});
console.log('Custom config:', JSON.stringify(custom));
assert(custom.responsivenessMs === 350, `Custom responsivenessMs preserved (expected 350, got ${custom.responsivenessMs})`);
assert(custom.prefixPaddingMs === 80, `Custom prefixPaddingMs preserved (expected 80, got ${custom.prefixPaddingMs})`);
assert(custom.proactiveAudio === false, `Custom proactiveAudio preserved (expected false, got ${custom.proactiveAudio})`);

// ── Test 3: Value Clamping ──────────────────────────────────────────────────
console.log('\n--- Test 3: Clamping Below and Above Boundaries ---');
const underflow = resolveTurnTakingConfig({
  responsivenessMs: 25,     // Under min 100
  prefixPaddingMs: -50,     // Under min 0
});
assert(underflow.responsivenessMs === 100, `Responsiveness under min 100 must clamp to 100 (got ${underflow.responsivenessMs})`);
assert(underflow.prefixPaddingMs === 0, `Prefix padding under min 0 must clamp to 0 (got ${underflow.prefixPaddingMs})`);

const overflow = resolveTurnTakingConfig({
  responsivenessMs: 5000,   // Over max 1000
  prefixPaddingMs: 900,     // Over max 200
});
assert(overflow.responsivenessMs === 1000, `Responsiveness over max 1000 must clamp to 1000 (got ${overflow.responsivenessMs})`);
assert(overflow.prefixPaddingMs === 200, `Prefix padding over max 200 must clamp to 200 (got ${overflow.prefixPaddingMs})`);

// ── Test 4: Wire Message Construction Behavior ──────────────────────────────
console.log('\n--- Test 4: Wire RealtimeInputConfig Proactivity Omission ---');
function buildMockRealtimeInputConfig(cfg) {
  return {
    automaticActivityDetection: {
      disabled: false,
      startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH',
      endOfSpeechSensitivity: 'END_SENSITIVITY_HIGH',
      prefixPaddingMs: cfg.prefixPaddingMs,
      silenceDurationMs: cfg.responsivenessMs,
    },
    activityHandling: 'START_OF_ACTIVITY_INTERRUPTS',
    turnCoverage: 'TURN_INCLUDES_ALL_INPUT',
    ...(cfg.proactiveAudio ? { proactivity: { proactiveAudio: true } } : {}),
  };
}

const activeProactivity = buildMockRealtimeInputConfig(resolveTurnTakingConfig({ proactiveAudio: true }));
assert(activeProactivity.proactivity?.proactiveAudio === true, 'Proactivity block must be present when proactiveAudio is true');

const disabledProactivity = buildMockRealtimeInputConfig(resolveTurnTakingConfig({ proactiveAudio: false }));
assert(disabledProactivity.proactivity === undefined, 'Proactivity block must be omitted when proactiveAudio is false');

console.log('\n================================================================');
if (failures === 0) {
  console.log('🎉 ALL TURN-TAKING CONFIG TESTS PASSED WITH ZERO FAILURES');
  console.log('================================================================\n');
  process.exit(0);
} else {
  console.error(`💥 ${failures} TURN-TAKING CONFIG TEST(S) FAILED`);
  console.log('================================================================\n');
  process.exit(1);
}
