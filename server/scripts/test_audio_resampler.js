#!/usr/bin/env node
/**
 * Claritiy Voice — Audio Resampler Verification Suite (Task T1)
 * 
 * Verifies StreamingResampler24to16 against the 5 criteria:
 *  (a) Aliasing: 8.5 kHz - 11.5 kHz attenuation >= 40 dB (compared against legacy Catmull-Rom)
 *  (b) Passband: 100 Hz - 6 kHz within ±0.5 dB
 *  (c) Boundary continuity: random chunk slicing matches single-shot within 2 LSB
 *  (d) Sample conservation: total samples == floor(input * 2/3) ± 1
 *  (e) Throughput: 1 second of 24kHz audio processes in < 2.0 ms
 */

const { StreamingResampler24to16, resample } = require('../dist/utils/audioConverter.js');

let failures = 0;
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failures++;
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

function generateSineBuffer(freqHz, durationSec, sampleRate = 24000, amplitude = 16000) {
  const numSamples = Math.floor(sampleRate * durationSec);
  const buf = Buffer.alloc(numSamples * 2);
  for (let i = 0; i < numSamples; i++) {
    const val = Math.round(amplitude * Math.sin((2 * Math.PI * freqHz * i) / sampleRate));
    buf.writeInt16LE(val, i * 2);
  }
  return buf;
}

function calculateRms(pcm16Buffer, discardFraction = 0.2) {
  const samples = new Int16Array(pcm16Buffer.buffer, pcm16Buffer.byteOffset, pcm16Buffer.length / 2);
  const start = Math.floor(samples.length * discardFraction);
  if (samples.length <= start) return 0;
  let sumSq = 0;
  for (let i = start; i < samples.length; i++) {
    sumSq += samples[i] * samples[i];
  }
  return Math.sqrt(sumSq / (samples.length - start));
}

console.log('================================================================');
console.log('TASK T1: STREAMING RESAMPLER 24kHz -> 16kHz VERIFICATION');
console.log('================================================================\n');

// ── Test (e): CPU Throughput (< 2.0 ms per 1 s of audio) ─────────────────────
console.log('--- Criterion (e): Throughput Benchmark ---');
const oneSec24k = generateSineBuffer(1000, 1.0, 24000);
const benchResampler = new StreamingResampler24to16();
// Warm up JIT
for (let i = 0; i < 5; i++) {
  benchResampler.reset();
  benchResampler.process(oneSec24k);
}
const tStart = performance.now();
const ITERATIONS = 20;
for (let i = 0; i < ITERATIONS; i++) {
  benchResampler.reset();
  benchResampler.process(oneSec24k);
}
const avgMs = (performance.now() - tStart) / ITERATIONS;
console.log(`Average conversion time per 1.0s audio: ${avgMs.toFixed(3)} ms`);
assert(avgMs < 2.0, `Throughput must be under 2.0 ms per 1.0s audio (got ${avgMs.toFixed(3)} ms)`);

// ── Test (b): Passband Flatness (100 Hz – 6 kHz within ±0.5 dB) ──────────────
console.log('\n--- Criterion (b): Passband Flatness ---');
const passRefResampler = new StreamingResampler24to16();
const ref1kBuffer = generateSineBuffer(1000, 0.5, 24000);
const refOut = passRefResampler.process(ref1kBuffer);
const refRms = calculateRms(refOut);

const passbandFrequencies = [100, 300, 1000, 2500, 4000, 5000, 6000];
for (const freq of passbandFrequencies) {
  const r = new StreamingResampler24to16();
  const inBuf = generateSineBuffer(freq, 0.5, 24000);
  const outBuf = r.process(inBuf);
  const rms = calculateRms(outBuf);
  const dbDelta = 20 * Math.log10(rms / refRms);
  console.log(`  ${freq} Hz response: ${dbDelta >= 0 ? '+' : ''}${dbDelta.toFixed(2)} dB`);
  assert(Math.abs(dbDelta) <= 0.5, `Passband at ${freq} Hz must be within ±0.5 dB of 1kHz (got ${dbDelta.toFixed(2)} dB)`);
}

// ── Test (a): Stopband / Aliasing Attenuation (>= 40 dB above 8.5 kHz) ────────
console.log('\n--- Criterion (a): Aliasing Attenuation vs. Old Catmull-Rom ---');
const stopbandFrequencies = [8500, 9500, 10500, 11500];
for (const freq of stopbandFrequencies) {
  const rNew = new StreamingResampler24to16();
  const testInput = generateSineBuffer(freq, 0.5, 24000);

  // New Streaming Polyphase filter
  const outNew = rNew.process(testInput);
  const rmsNew = calculateRms(outNew);
  const attenNewDb = -20 * Math.log10((rmsNew || 1e-9) / refRms);

  // Old Catmull-Rom cubic interpolation
  const inSamples = new Int16Array(testInput.buffer, testInput.byteOffset, testInput.length / 2);
  const outOldSamples = resample(inSamples, 24000, 16000);
  const outOldBuf = Buffer.from(outOldSamples.buffer, outOldSamples.byteOffset, outOldSamples.byteLength);
  const rmsOld = calculateRms(outOldBuf);
  const attenOldDb = -20 * Math.log10((rmsOld || 1e-9) / refRms);

  console.log(`  ${freq} Hz: New Polyphase Attenuation = ${attenNewDb.toFixed(1)} dB | Old Catmull-Rom = ${attenOldDb.toFixed(1)} dB`);
  assert(attenNewDb >= 40.0, `Stopband at ${freq} Hz must be attenuated by >= 40.0 dB (got ${attenNewDb.toFixed(1)} dB)`);
}

// ── Test (c): Boundary Continuity Across Arbitrary Chunks ───────────────────
console.log('\n--- Criterion (c): Boundary Continuity & Odd-Byte Robustness ---');
const continuousResampler = new StreamingResampler24to16();
const testTone = generateSineBuffer(440, 0.8, 24000);
const singleShotOut = continuousResampler.process(testTone);

let boundaryFailures = 0;
for (let run = 1; run <= 10; run++) {
  const chunkedResampler = new StreamingResampler24to16();
  const chunks = [];
  let offset = 0;
  while (offset < testTone.length) {
    const remaining = testTone.length - offset;
    // Test odd byte lengths and sizes not divisible by 3 or 2
    const chunkSize = Math.min(remaining, Math.floor(Math.random() * 373) + 1);
    chunks.push(chunkedResampler.process(testTone.subarray(offset, offset + chunkSize)));
    offset += chunkSize;
  }
  const chunkedCombined = Buffer.concat(chunks);
  const sView = new Int16Array(singleShotOut.buffer, singleShotOut.byteOffset, singleShotOut.length / 2);
  const cView = new Int16Array(chunkedCombined.buffer, chunkedCombined.byteOffset, chunkedCombined.length / 2);

  let maxDiff = 0;
  const cmpLen = Math.min(sView.length, cView.length);
  for (let i = 0; i < cmpLen; i++) {
    const diff = Math.abs(sView[i] - cView[i]);
    if (diff > maxDiff) maxDiff = diff;
  }
  if (maxDiff > 2 || Math.abs(sView.length - cView.length) > 1) {
    boundaryFailures++;
    console.error(`  Run ${run}: maxDiff = ${maxDiff} LSB, length delta = ${sView.length - cView.length}`);
  }
}
assert(boundaryFailures === 0, `Boundary continuity: all 10 chunking runs must match single-shot within 2 LSB`);

// ── Test (d): Total Output Sample Count Conservation ─────────────────────────
console.log('\n--- Criterion (d): Sample Conservation ---');
const inputSamplesCount = 24000 * 1.5; // 36000 samples
const expectedOutputSamples = Math.floor(inputSamplesCount * 2 / 3);
const rCount = new StreamingResampler24to16();
const testCountBuf = generateSineBuffer(500, 1.5, 24000);
const countOutBuf = rCount.process(testCountBuf);
const actualOutputSamples = countOutBuf.length / 2;
console.log(`  Input Samples: ${inputSamplesCount} | Expected Output: ${expectedOutputSamples} | Actual Output: ${actualOutputSamples}`);
assert(Math.abs(actualOutputSamples - expectedOutputSamples) <= 1, `Output sample count must equal floor(input * 2/3) ± 1`);

console.log('\n================================================================');
if (failures === 0) {
  console.log('🎉 ALL RESAMPLER TESTS PASSED WITH ZERO FAILURES');
  console.log('================================================================\n');
  process.exit(0);
} else {
  console.error(`💥 ${failures} RESAMPLER TEST(S) FAILED`);
  console.log('================================================================\n');
  process.exit(1);
}
