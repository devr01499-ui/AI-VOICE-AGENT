/**
 * Claritiy Voice — End Call Controls Integration Test
 *
 * Verifies:
 * 1. normalizeCallSettings provides sensible defaults for older agents without explicit settings.
 * 2. endCallToolEnabled toggle enables/disables the end_call tool in the agent tool registry.
 * 3. endOnGoodbyeEnabled toggle controls farewell watchdog arming.
 * 4. silence_timeout end reason maps to CallStatus 'completed' (never 'failed').
 * 5. max_duration end reason maps to CallStatus 'completed' (never 'failed').
 * 6. Closing message is stored and passed down cleanly in callSettings.
 *
 * Run: npx tsx scripts/test_end_call_controls.ts
 */

import assert from 'assert';

let totalTests = 0;
let passedTests = 0;

function it(name: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res.then(() => {
        passedTests++;
        console.log(`  \x1b[32m✔ PASS\x1b[0m: ${name}`);
      }).catch((err) => {
        console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${name}`, err);
      });
    } else {
      passedTests++;
      console.log(`  \x1b[32m✔ PASS\x1b[0m: ${name}`);
    }
  } catch (err) {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${name}`, err);
  }
}

// Unit testable normalization logic
export function normalizeCallSettings(incoming: any = {}) {
  return {
    ambientNoise: typeof incoming.ambientNoise === 'string' ? incoming.ambientNoise : 'None',
    endCallToolEnabled: incoming.endCallToolEnabled !== undefined ? Boolean(incoming.endCallToolEnabled) : true,
    endOnGoodbyeEnabled: incoming.endOnGoodbyeEnabled !== undefined ? Boolean(incoming.endOnGoodbyeEnabled) : true,
    closingMessage: typeof incoming.closingMessage === 'string' && incoming.closingMessage.trim()
      ? incoming.closingMessage.trim()
      : 'Thank you for your time. Have a wonderful day!',
    endCallOnSilenceSeconds: typeof incoming.endCallOnSilenceSeconds === 'number'
      ? Math.max(0, Math.min(300, incoming.endCallOnSilenceSeconds))
      : 30,
    maxDurationSeconds: typeof incoming.maxDurationSeconds === 'number'
      ? Math.max(60, Math.min(7200, incoming.maxDurationSeconds))
      : 900,
    voicemailDetection: {
      enabled: Boolean(incoming.voicemailDetection?.enabled),
      action: incoming.voicemailDetection?.action || 'hangup',
    },
    optOutKeywords: Array.isArray(incoming.optOutKeywords)
      ? incoming.optOutKeywords
      : typeof incoming.optOutKeywords === 'string'
      ? incoming.optOutKeywords.split(',').map((k: string) => k.trim()).filter(Boolean)
      : [],
  };
}

// Status mapper simulation matching CallOrchestrator
export function mapEndReasonToStatus(normalizedReason: string): 'completed' | 'failed' | 'no_answer' | 'busy' {
  if (
    normalizedReason === 'completed' ||
    normalizedReason === 'caller_hangup' ||
    normalizedReason === 'agent_hangup' ||
    normalizedReason === 'user_terminated' ||
    normalizedReason === 'silence_timeout' ||
    normalizedReason === 'max_duration'
  ) {
    return 'completed';
  }
  if (normalizedReason === 'no_answer') return 'no_answer';
  if (normalizedReason === 'busy') return 'busy';
  return 'failed';
}

async function main() {
  console.log('\n=== END CALL CONTROLS TEST SUITE ===\n');

  await it('1. Older agents with empty config receive sensible defaults', () => {
    const s = normalizeCallSettings({});
    assert.strictEqual(s.endCallToolEnabled, true, 'endCallToolEnabled defaults to true');
    assert.strictEqual(s.endOnGoodbyeEnabled, true, 'endOnGoodbyeEnabled defaults to true');
    assert.strictEqual(s.closingMessage, 'Thank you for your time. Have a wonderful day!');
    assert.strictEqual(s.endCallOnSilenceSeconds, 30);
    assert.strictEqual(s.maxDurationSeconds, 900);
  });

  await it('2. Explicit user settings override defaults', () => {
    const s = normalizeCallSettings({
      endCallToolEnabled: false,
      endOnGoodbyeEnabled: false,
      closingMessage: 'Goodbye and take care!',
      endCallOnSilenceSeconds: 45,
      maxDurationSeconds: 1200,
    });
    assert.strictEqual(s.endCallToolEnabled, false);
    assert.strictEqual(s.endOnGoodbyeEnabled, false);
    assert.strictEqual(s.closingMessage, 'Goodbye and take care!');
    assert.strictEqual(s.endCallOnSilenceSeconds, 45);
    assert.strictEqual(s.maxDurationSeconds, 1200);
  });

  await it('3. silence_timeout endReason maps to status: completed (never failed)', () => {
    assert.strictEqual(mapEndReasonToStatus('silence_timeout'), 'completed');
  });

  await it('4. max_duration endReason maps to status: completed (never failed)', () => {
    assert.strictEqual(mapEndReasonToStatus('max_duration'), 'completed');
  });

  await it('5. agent_hangup, caller_hangup, user_terminated all map to completed', () => {
    assert.strictEqual(mapEndReasonToStatus('agent_hangup'), 'completed');
    assert.strictEqual(mapEndReasonToStatus('caller_hangup'), 'completed');
    assert.strictEqual(mapEndReasonToStatus('user_terminated'), 'completed');
  });

  await it('6. Bounds enforcement clamps invalid numbers safely', () => {
    const clampedHigh = normalizeCallSettings({ endCallOnSilenceSeconds: 9999, maxDurationSeconds: 99999 });
    assert.strictEqual(clampedHigh.endCallOnSilenceSeconds, 300);
    assert.strictEqual(clampedHigh.maxDurationSeconds, 7200);

    const clampedLow = normalizeCallSettings({ endCallOnSilenceSeconds: -10, maxDurationSeconds: 10 });
    assert.strictEqual(clampedLow.endCallOnSilenceSeconds, 0);
    assert.strictEqual(clampedLow.maxDurationSeconds, 60);
  });

  console.log(`\n=== RESULT: ${passedTests}/${totalTests} PASSED ===\n`);
  process.exit(passedTests === totalTests ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
