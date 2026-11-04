#!/usr/bin/env node
/**
 * Claritiy Voice — Audio Codec & G.711 μ-law Verification Suite (Task T3)
 *
 * Verifies:
 *  (a) Programmatic G.711 mu-law table matches ITU-T standard across all 256 byte entries
 *  (b) convertInboundAudio with 320-byte L16 frame is NOT decoded as mu-law when format is L16
 *  (c) Mu-law 8kHz input produces expected upsampled 16kHz PCM16 output
 */

const {
  MU_LAW_DECODE_TABLE,
  PROGRAMMATIC_MU_LAW_TABLE,
  convertInboundAudio,
  decodeMuLawSample,
} = require('../dist/utils/audioConverter.js');

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
console.log('TASK T3: AUDIO CODEC & G.711 INBOUND FORMAT VERIFICATION');
console.log('================================================================');

// ── Test (a): Table Match Against Canonical ITU-T G.711 Standard ────────────
console.log('\n--- Criterion (a): Table Match Against Canonical G.711 (256 Entries) ---');
let exactMatches = 0;
for (let i = 0; i < 256; i++) {
  const mu = ~i & 0xff;
  const sign = mu & 0x80;
  const exponent = (mu >> 4) & 0x07;
  const mantissa = mu & 0x0f;
  let sample = ((mantissa << 3) + 0x84) << exponent;
  sample -= 0x84;
  const standardSample = sign !== 0 ? -sample : sample;

  const progSample = PROGRAMMATIC_MU_LAW_TABLE[i];
  const legacySample = MU_LAW_DECODE_TABLE[i];

  if (progSample === standardSample && progSample === legacySample) {
    exactMatches++;
  }
}

console.log(`  Exact table matches: ${exactMatches} / 256`);
assert(exactMatches === 256, `Programmatic table must match ITU-T G.711 on all 256 entries (got ${exactMatches}/256)`);

// ── Test (b): 320-byte L16 Frame Is NOT Misdecoded As Mu-law ────────────────
console.log('\n--- Criterion (b): Inbound Format Classification Independence ---');
// A 10ms L16 frame at 16kHz = 160 samples = 320 bytes
const l16Payload = Buffer.alloc(320);
for (let i = 0; i < 160; i++) {
  l16Payload.writeInt16LE(1234, i * 2);
}
const l16Base64 = l16Payload.toString('base64');

// When explicitFormat is 'audio/x-l16'
process.env.INBOUND_FORMAT_V2 = 'true';
const convertedL16 = convertInboundAudio(l16Base64, 'audio/x-l16');
const convertedBuf = Buffer.from(convertedL16, 'base64');

// In L16 pass-through mode, sample count remains 160 samples (320 bytes)
// If it were misread as mu-law 8kHz, it would have upsampled 320 bytes -> 640 samples (1280 bytes)
console.log(`  Input L16 bytes: ${l16Payload.length} | Output bytes: ${convertedBuf.length}`);
assert(convertedBuf.length === 320, `L16 frame must NOT be upsampled or decoded as mu-law (expected 320 bytes, got ${convertedBuf.length})`);

// Verify sample values preserved (first sample should be 1234)
const firstSample = convertedBuf.readInt16LE(0);
assert(firstSample === 1234, `L16 sample value must be preserved without distortion (expected 1234, got ${firstSample})`);

// ── Test (c): Mu-law 8kHz Decoding & Upsampling to 16kHz ────────────────────
console.log('\n--- Criterion (c): Mu-law 8kHz Decoded & Upsampled to 16kHz PCM16 ---');
// 20ms mu-law @ 8kHz = 160 bytes
const muLawPayload = Buffer.alloc(160);
for (let i = 0; i < 160; i++) {
  muLawPayload[i] = 0xff; // 0xFF in mu-law is zero (silence)
}
const muLawBase64 = muLawPayload.toString('base64');

const convertedMuLaw = convertInboundAudio(muLawBase64, 'audio/x-mulaw');
const muLawOutBuf = Buffer.from(convertedMuLaw, 'base64');

// 160 mu-law samples upsampled 2x to 16kHz = 320 samples = 640 bytes
console.log(`  Input mu-law bytes: ${muLawPayload.length} | Output 16kHz PCM bytes: ${muLawOutBuf.length}`);
assert(muLawOutBuf.length === 640, `Mu-law 8kHz must upsample 2x to 16kHz PCM16 (expected 640 bytes, got ${muLawOutBuf.length})`);

console.log('\n================================================================');
if (failures === 0) {
  console.log('🎉 ALL AUDIO CODEC TESTS PASSED WITH ZERO FAILURES');
  console.log('================================================================\n');
  process.exit(0);
} else {
  console.error(`💥 ${failures} AUDIO CODEC TEST(S) FAILED`);
  console.log('================================================================\n');
  process.exit(1);
}
