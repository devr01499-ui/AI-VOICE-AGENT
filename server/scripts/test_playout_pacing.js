#!/usr/bin/env node
/**
 * Claritiy Voice — Playout Pacing & Jitter Buffer Verification Suite (Task T2)
 *
 * Verifies PlayoutPacer against:
 *  1. Cadence: 200 chunks under simulated event-loop jitter (0-50ms) leave on a smooth 20ms cadence (variance < 5ms)
 *  2. Jitter buffer lead: Carrier lead never exceeds PLAYOUT_LEAD_MS + 20ms
 *  3. Barge-in / clearAudio: Queue and timer purge immediately with 0 leaked frames into next turn
 *  4. Remainder handling: Partial bytes are carried across chunks without dropped samples
 */

const { PlayoutPacer } = require('../dist/utils/playoutPacer.js');

let failures = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failures++;
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPlayoutCadenceTest() {
  console.log('================================================================');
  console.log('TASK T2: PLAYOUT PACING & JITTER BUFFER VERIFICATION');
  console.log('================================================================');

  console.log('\n--- Test 1: Cadence Stability & Lead Bound Under Event Loop Jitter ---');
  const targetLeadMs = 80;
  const transmittedFrames = [];
  const leadSamples = [];

  const pacer = new PlayoutPacer({
    leadMs: targetLeadMs,
    onSendFrame: (frameBase64, bytes) => {
      const now = performance.now();
      transmittedFrames.push({ timestamp: now, bytes });
      const currentCarrierLead = pacer.getCarrierLeadMs();
      leadSamples.push(currentCarrierLead);
    },
  });

  // Feed 200 chunks of variable sizes with simulated event loop jitter (0-50ms)
  const totalChunks = 200;
  console.log(`Feeding ${totalChunks} chunks with simulated event-loop jitter (0-50ms)...`);

  for (let i = 0; i < totalChunks; i++) {
    // Chunks between 320 bytes (10ms) and 1280 bytes (40ms)
    const chunkSize = 320 + (i % 4) * 320;
    const fakeAudio = Buffer.alloc(chunkSize).toString('base64');
    pacer.enqueueAudio(fakeAudio);

    // Simulate event-loop delay / jitter between pushes
    const jitterMs = Math.floor(Math.random() * 50);
    if (i % 5 === 0 && jitterMs > 0) {
      await sleep(jitterMs);
    }
  }

  // Allow remaining queue to play out
  console.log('Waiting for remaining playout queue to drain...');
  while (pacer.getRemainingMs() > 0) {
    await sleep(50);
  }

  console.log(`Total frames transmitted: ${transmittedFrames.length}`);
  assert(transmittedFrames.length > 0, `Pacer must transmit frames (got ${transmittedFrames.length})`);

  // Calculate gaps between consecutive frame transmissions after initial burst
  // (First burst sends frames immediately to fill lead, then steady cadence kicks in)
  const burstFrameCount = Math.ceil(targetLeadMs / 20);
  const steadyFrames = transmittedFrames.slice(burstFrameCount);
  const intervals = [];

  for (let i = 1; i < steadyFrames.length; i++) {
    intervals.push(steadyFrames[i].timestamp - steadyFrames[i - 1].timestamp);
  }

  if (intervals.length > 0) {
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((acc, val) => acc + Math.pow(val - 20, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);

    console.log(`  Average frame interval: ${avgInterval.toFixed(2)} ms (expected ~20 ms)`);
    console.log(`  Interval standard deviation: ${stdDev.toFixed(2)} ms (variance tolerance < 5 ms)`);

    assert(Math.abs(avgInterval - 20) <= 2.5, `Average interval must be close to 20ms (got ${avgInterval.toFixed(2)} ms)`);
    assert(stdDev < 5.0, `Cadence variance standard deviation must be < 5ms (got ${stdDev.toFixed(2)} ms)`);
  }

  // Check lead bounds: carrier lead should not exceed targetLeadMs + 20ms
  const maxAllowedLead = targetLeadMs + 20;
  const maxObservedLead = Math.max(...leadSamples, 0);
  console.log(`  Max observed carrier lead: ${maxObservedLead} ms (max allowed: ${maxAllowedLead} ms)`);
  assert(maxObservedLead <= maxAllowedLead, `Carrier lead must never exceed PLAYOUT_LEAD_MS + 20ms (got ${maxObservedLead} ms)`);

  pacer.destroy();

  // ── Test 2: Barge-in / clearAudio Leaked Frames ──────────────────────────
  console.log('\n--- Test 2: Barge-in Instant Purge & Zero Leaked Frames ---');
  let postBargeInFrames = 0;
  let bargeInTriggered = false;

  const bargeInPacer = new PlayoutPacer({
    leadMs: 80,
    onSendFrame: () => {
      if (bargeInTriggered) {
        postBargeInFrames++;
      }
    },
  });

  // Enqueue a large 2-second sentence (64000 bytes)
  const longSentence = Buffer.alloc(64000).toString('base64');
  bargeInPacer.enqueueAudio(longSentence);

  // Allow first burst to transmit
  await sleep(10);

  // User speaks: barge-in clears queue immediately
  bargeInTriggered = true;
  bargeInPacer.clear();

  // Wait to observe if any timer or queue item leaked
  await sleep(100);

  console.log(`  Frames transmitted after barge-in clear(): ${postBargeInFrames}`);
  assert(postBargeInFrames === 0, `Barge-in must purge queue immediately with 0 leaked frames (got ${postBargeInFrames})`);
  assert(bargeInPacer.getRemainingMs() === 0, `Barge-in must reset remaining queue to 0 ms (got ${bargeInPacer.getRemainingMs()})`);

  bargeInPacer.destroy();

  // ── Test 3: Remainder Handling Across Consecutive Chunks ────────────────
  console.log('\n--- Test 3: Remainder Handling (Odd & Non-640 Byte Chunks) ---');
  let totalBytesTransmitted = 0;
  const remainderPacer = new PlayoutPacer({
    leadMs: 80,
    onSendFrame: (_frame, bytes) => {
      totalBytesTransmitted += bytes;
    },
  });

  // Push 3 chunks of 500 bytes each = 1500 bytes (two 640-byte frames = 1280 bytes, 220 bytes remainder)
  remainderPacer.enqueueAudio(Buffer.alloc(500).toString('base64'));
  remainderPacer.enqueueAudio(Buffer.alloc(500).toString('base64'));
  remainderPacer.enqueueAudio(Buffer.alloc(500).toString('base64'));

  // Should have framed exactly 2 frames = 1280 bytes
  assert(totalBytesTransmitted === 1280, `Remainder must be preserved: expected 1280 bytes framed, got ${totalBytesTransmitted}`);

  // Push 420 more bytes -> total 1920 bytes = exactly 3 * 640 bytes
  remainderPacer.enqueueAudio(Buffer.alloc(420).toString('base64'));
  assert(totalBytesTransmitted === 1920, `Remainder must complete next frame: expected 1920 bytes framed, got ${totalBytesTransmitted}`);

  remainderPacer.destroy();

  console.log('\n================================================================');
  if (failures === 0) {
    console.log('🎉 ALL PLAYOUT PACING TESTS PASSED WITH ZERO FAILURES');
    console.log('================================================================\n');
    process.exit(0);
  } else {
    console.error(`💥 ${failures} PLAYOUT PACING TEST(S) FAILED`);
    console.log('================================================================\n');
    process.exit(1);
  }
}

runPlayoutCadenceTest().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
