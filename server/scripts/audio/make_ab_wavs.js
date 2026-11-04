#!/usr/bin/env node
/**
 * Claritiy Voice — A/B WAV Generator for Blind Listening Tests (Task T1)
 * 
 * Usage:
 *   node server/scripts/audio/make_ab_wavs.js [path-to-24k-audio.wav-or-pcm]
 * 
 * Generates:
 *   - old.wav (16 kHz using legacy Catmull-Rom interpolation)
 *   - new.wav (16 kHz using StreamingResampler24to16 polyphase low-pass)
 */

const fs = require('fs');
const path = require('path');
const { StreamingResampler24to16, resample } = require('../../dist/utils/audioConverter.js');

function createWavHeader(dataLengthBytes, sampleRate = 16000, numChannels = 1, bitsPerSample = 16) {
  const header = Buffer.alloc(44);
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLengthBytes, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);             // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20);              // AudioFormat (1 for PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataLengthBytes, 40);

  return header;
}

function parsePcmFromInput(inputPath) {
  if (inputPath && fs.existsSync(inputPath)) {
    const raw = fs.readFileSync(inputPath);
    // If input is already a WAV file with RIFF header, skip the header
    if (raw.subarray(0, 4).toString('ascii') === 'RIFF') {
      const dataIdx = raw.indexOf(Buffer.from('data'));
      if (dataIdx !== -1) {
        return raw.subarray(dataIdx + 8);
      }
    }
    return raw;
  }

  // Synthesize acoustic benchmark signal (speech fundamentals 120-300Hz + formants 800-3500Hz + sibilance 6-9kHz)
  console.log('No input audio file provided. Generating synthetic 4-second phonetic test suite (24kHz)...');
  const durSec = 4.0;
  const numSamples = Math.floor(24000 * durSec);
  const buf = Buffer.alloc(numSamples * 2);

  for (let i = 0; i < numSamples; i++) {
    const t = i / 24000;
    // Fundamental pitch with natural micro-vibrato
    const f0 = 140 + 15 * Math.sin(2 * Math.PI * 4 * t);
    const formant1 = 800;
    const formant2 = 2200;
    // Sibilant noise / fricative component (8.5 - 10.5 kHz) to stress-test aliasing
    const sibilant = (t > 1.5 && t < 2.5) ? Math.sin(2 * Math.PI * 9200 * t) * 0.4 : 0;

    const sampleFloat = (
      Math.sin(2 * Math.PI * f0 * t) * 0.4 +
      Math.sin(2 * Math.PI * formant1 * t) * 0.3 +
      Math.sin(2 * Math.PI * formant2 * t) * 0.2 +
      sibilant
    ) * 16000;

    const sampleInt = Math.max(-32768, Math.min(32767, Math.round(sampleFloat)));
    buf.writeInt16LE(sampleInt, i * 2);
  }

  return buf;
}

function main() {
  const inputFile = process.argv[2];
  const inputPcm24k = parsePcmFromInput(inputFile);
  console.log(`Input audio parsed: ${inputPcm24k.length} bytes (${inputPcm24k.length / 2} samples at 24kHz)`);

  // 1. Process with Old Resampler (Catmull-Rom cubic interpolation)
  const inSamples = new Int16Array(inputPcm24k.buffer, inputPcm24k.byteOffset, inputPcm24k.length / 2);
  const oldOutSamples = resample(inSamples, 24000, 16000);
  const oldPcm16 = Buffer.from(oldOutSamples.buffer, oldOutSamples.byteOffset, oldOutSamples.byteLength);
  const oldWav = Buffer.concat([createWavHeader(oldPcm16.length, 16000), oldPcm16]);
  const oldPath = path.resolve('old.wav');
  fs.writeFileSync(oldPath, oldWav);
  console.log(`✅ Generated: ${oldPath} (${oldWav.length} bytes, 16kHz WAV)`);

  // 2. Process with New Resampler (Streaming Polyphase Low-Pass FIR)
  const newResampler = new StreamingResampler24to16();
  // Feed in chunks to simulate live streaming WebSocket frames (~40ms chunks)
  const chunkSize = 24000 * 0.04 * 2; // 1920 bytes
  const newChunks = [];
  let offset = 0;
  while (offset < inputPcm24k.length) {
    const chunk = inputPcm24k.subarray(offset, offset + chunkSize);
    newChunks.push(newResampler.process(chunk));
    offset += chunkSize;
  }
  const newPcm16 = Buffer.concat(newChunks);
  const newWav = Buffer.concat([createWavHeader(newPcm16.length, 16000), newPcm16]);
  const newPath = path.resolve('new.wav');
  fs.writeFileSync(newPath, newWav);
  console.log(`✅ Generated: ${newPath} (${newWav.length} bytes, 16kHz WAV)`);

  console.log('\nReady for blind listening test: compare old.wav vs new.wav');
}

main();
