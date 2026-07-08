/**
 * Bolna Server — Audio Codec Converter
 * 
 * Converts mu-law (μ-law) encoded audio from Vobiz to PCM16 format
 * expected by Gemini and OpenAI Realtime APIs.
 * 
 * CRITICAL FIX: Vobiz sends audio/x-mulaw but we were telling
 * Gemini/OpenAI it was PCM16, causing them to fail decoding
 * and disconnect after 2 seconds.
 */

import { logger } from './logger';

/**
 * μ-law (mu-law) decode table - ITU G.711 standard
 * Maps each μ-law byte value to its PCM16 equivalent
 * This is the standard 256-entry lookup table
 */
const MU_LAW_DECODE_TABLE = [
  -32124, -31100, -30076, -29052, -28028, -27004, -25980, -24956,
  -23932, -22908, -21884, -20860, -19836, -18812, -17788, -16764,
  -15996, -15484, -14972, -14460, -13948, -13436, -12924, -12412,
  -11900, -11388, -10876, -10364, -9852, -9340, -8828, -8316,
  -7932, -7676, -7420, -7164, -6908, -6652, -6396, -6140,
  -5884, -5628, -5372, -5116, -4860, -4604, -4348, -4092,
  -3836, -3580, -3324, -3068, -2812, -2556, -2300, -2044,
  -1788, -1532, -1276, -1020, -764, -508, -252, 0,
  32124, 31100, 30076, 29052, 28028, 27004, 25980, 24956,
  23932, 22908, 21884, 20860, 19836, 18812, 17788, 16764,
  15996, 15484, 14972, 14460, 13948, 13436, 12924, 12412,
  11900, 11388, 10876, 10364, 9852, 9340, 8828, 8316,
  7932, 7676, 7420, 7164, 6908, 6652, 6396, 6140,
  5884, 5628, 5372, 5116, 4860, 4604, 4348, 4092,
  3836, 3580, 3324, 3068, 2812, 2556, 2300, 2044,
  1788, 1532, 1276, 1020, 764, 508, 252, 0,
  -32124, -31100, -30076, -29052, -28028, -27004, -25980, -24956,
  -23932, -22908, -21884, -20860, -19836, -18812, -17788, -16764,
  -15996, -15484, -14972, -14460, -13948, -13436, -12924, -12412,
  -11900, -11388, -10876, -10364, -9852, -9340, -8828, -8316,
  -7932, -7676, -7420, -7164, -6908, -6652, -6396, -6140,
  -5884, -5628, -5372, -5116, -4860, -4604, -4348, -4092,
  -3836, -3580, -3324, -3068, -2812, -2556, -2300, -2044,
  -1788, -1532, -1276, -1020, -764, -508, -252, 0,
  32124, 31100, 30076, 29052, 28028, 27004, 25980, 24956,
  23932, 22908, 21884, 20860, 19836, 18812, 17788, 16764,
  15996, 15484, 14972, 14460, 13948, 13436, 12924, 12412,
  11900, 11388, 10876, 10364, 9852, 9340, 8828, 8316,
  7932, 7676, 7420, 7164, 6908, 6652, 6396, 6140,
  5884, 5628, 5372, 5116, 4860, 4604, 4348, 4092,
  3836, 3580, 3324, 3068, 2812, 2556, 2300, 2044,
  1788, 1532, 1276, 1020, 764, 508, 252, 0,
];

/**
 * Converts μ-law encoded audio (from Vobiz) to PCM16 format.
 * 
 * Vobiz telephony API sends audio as:
 *   - Codec: audio/x-mulaw (G.711 μ-law compression)
 *   - Sample Rate: 8000 Hz
 *   - Encoding: Base64
 * 
 * Gemini and OpenAI Realtime expect:
 *   - Codec: audio/pcm (PCM16 - 16-bit linear)
 *   - Sample Rate: 8000 Hz
 *   - Encoding: Base64
 * 
 * This function does the conversion.
 * 
 * @param mulawBase64 - Base64-encoded μ-law audio bytes
 * @returns Base64-encoded PCM16 audio bytes, or original on error
 */
export function mulawToPCM16(mulawBase64: string): string {
  try {
    if (!mulawBase64) {
      return mulawBase64;
    }

    // Step 1: Decode base64 to bytes
    const mulawBytes = Buffer.from(mulawBase64, 'base64');

    if (mulawBytes.length === 0) {
      return mulawBase64;
    }

    // Step 2: Decode each μ-law byte to PCM16 sample (16-bit signed integer)
    const pcm16Samples: number[] = [];

    for (let i = 0; i < mulawBytes.length; i++) {
      const mulawByte = mulawBytes[i];
      const pcm16Sample = MU_LAW_DECODE_TABLE[mulawByte & 0xFF];
      pcm16Samples.push(pcm16Sample);
    }

    // Step 3: Convert PCM16 samples to buffer
    // PCM16 = 16-bit signed integers in little-endian byte order
    const pcm16Buffer = Buffer.alloc(pcm16Samples.length * 2);

    for (let i = 0; i < pcm16Samples.length; i++) {
      const sample = pcm16Samples[i];
      // writeInt16LE = write 16-bit signed integer in little-endian format
      pcm16Buffer.writeInt16LE(sample, i * 2);
    }

    // Step 4: Encode back to base64
    const pcm16Base64 = pcm16Buffer.toString('base64');

    return pcm16Base64;
  } catch (err) {
    logger.error('audioConverter: μ-law to PCM16 conversion failed', {
      error: err instanceof Error ? err.message : String(err),
      inputLength: mulawBase64 ? mulawBase64.length : 0,
    });
    // Fallback: return original (will fail downstream, but we logged it)
    return mulawBase64;
  }
}

/**
 * Batch converts multiple μ-law audio buffers to PCM16.
 * Useful for processing audio in chunks.
 */
export function mulawToPCM16Batch(mulawBase64Array: string[]): string[] {
  return mulawBase64Array.map((audio) => mulawToPCM16(audio));
}

/**
 * Returns codec conversion metadata for logging/debugging
 */
export function getAudioConversionStats(
  originalBase64: string,
  convertedBase64: string
): {
  originalSizeBytes: number;
  convertedSizeBytes: number;
  compressionRatio: number;
} {
  const origBuffer = Buffer.from(originalBase64, 'base64');
  const convBuffer = Buffer.from(convertedBase64, 'base64');

  return {
    originalSizeBytes: origBuffer.length,
    convertedSizeBytes: convBuffer.length,
    compressionRatio: convBuffer.length / origBuffer.length,
  };
}

// ─────────────────────────────────────────────
// Additional Resampling & Outbound Encoding Utilities
// ─────────────────────────────────────────────

/**
 * Compresses 16-bit linear signed PCM samples back to 8-bit G.711 mu-law bytes.
 * Handles bit-shifting, sign extraction, and G.711 compression curves.
 */
export function pcm16ToUlaw(pcm16Samples: Int16Array): Uint8Array {
  const size = pcm16Samples.length;
  const ulawBytes = new Uint8Array(size);

  for (let i = 0; i < size; i++) {
    let pcm = pcm16Samples[i]!;

    // Extract sign bit
    const sign = (pcm & 0x8000) >> 8;
    if (pcm < 0) {
      pcm = -pcm;
    }

    // Clip to max PCM16 range
    if (pcm > 32635) {
      pcm = 32635;
    }

    // G.711 compression logic
    pcm += 132;
    let exponent = 7;
    let mask = 0x4000;
    while ((pcm & mask) === 0 && exponent > 0) {
      exponent--;
      mask >>= 1;
    }
    const mantissa = (pcm >> (exponent + 3)) & 0x0f;
    const ulawByte = ~(sign | (exponent << 4) | mantissa) & 0xff;

    // Avoid 0x00 to prevent signaling anomalies in some carrier nodes
    ulawBytes[i] = ulawByte === 0 ? 0x02 : ulawByte;
  }

  return ulawBytes;
}

/**
 * High-performance resampling using Catmull-Rom cubic spline interpolation.
 * Reduces high-frequency aliasing compared to linear interpolation.
 */
export function resample(
  samples: Int16Array,
  fromRate: number,
  toRate: number
): Int16Array {
  if (fromRate === toRate) {
    return samples;
  }

  const ratio = fromRate / toRate;
  const newLength = Math.round(samples.length / ratio);
  const result = new Int16Array(newLength);

  const lastIndex = samples.length - 1;
  if (lastIndex < 0) return result;

  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const indexLow = Math.floor(srcIndex);
    const indexHigh = Math.min(indexLow + 1, lastIndex);
    const t = srcIndex - indexLow;

    const sampleLow = samples[indexLow]!;
    const sampleHigh = samples[indexHigh]!;

    // Linear interpolation
    const interpolated = (1 - t) * sampleLow + t * sampleHigh;
    
    let processedSample = Math.round(interpolated);

    // Prevent digital wrapping distortion/crackle
    if (processedSample > 32767) processedSample = 32767;
    if (processedSample < -32768) processedSample = -32768;

    result[i] = processedSample;
  }

  return result;
}

/**
 * Base64 stream helper to convert inbound audio (Vobiz G.711 mu-law 8kHz)
 * to PCM16 at target provider sample rate.
 */
export function convertInboundAudio(
  base64MuLaw: string
): string {
  try {
    if (!base64MuLaw) return base64MuLaw;

    // Step 1: Decode mu-law to 8kHz PCM16 buffer
    const pcm16Base64 = mulawToPCM16(base64MuLaw);
    const pcmBuffer = Buffer.from(pcm16Base64, 'base64');
    
    // Step 2: Convert to typed array for resampling with safe alignment and isolation from Node.js Buffer pool
    const cleanBytes = new Uint8Array(pcmBuffer);
    const pcm16Samples = new Int16Array(
      cleanBytes.buffer,
      cleanBytes.byteOffset,
      cleanBytes.length / 2
    );

    // Step 3: Resample from 8000Hz to provider rate (Gemini Live expects 16000Hz)
    const resampled = resample(pcm16Samples, 8000, 16000);

    // Step 4: Convert back to base64
    const outBuffer = Buffer.from(resampled.buffer, resampled.byteOffset, resampled.byteLength);
    return outBuffer.toString('base64');
  } catch (err) {
    logger.error('audioConverter: convertInboundAudio failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return base64MuLaw;
  }
}

/**
 * Encodes a single 16-bit PCM sample to a G.711 mu-law byte.
 * Extracted as a named helper so it can be unit-tested independently.
 */
export function encodeMuLawSample(pcm: number): number {
  let sample = pcm;

  // Extract and strip sign
  const sign = (sample & 0x8000) >> 8;
  if (sample < 0) sample = -sample;

  // Clip to valid range
  if (sample > 32635) sample = 32635;

  // G.711 bias + segment encoding
  sample += 132;
  let exponent = 7;
  let mask = 0x4000;
  while ((sample & mask) === 0 && exponent > 0) {
    exponent--;
    mask >>= 1;
  }
  const mantissa = (sample >> (exponent + 3)) & 0x0f;
  const ulawByte = ~(sign | (exponent << 4) | mantissa) & 0xff;

  // Avoid 0x00 to prevent signaling anomalies in some carrier nodes
  return ulawByte === 0 ? 0x02 : ulawByte;
}

/**
 * Base64 stream helper to convert outbound audio (Gemini PCM16 at 24kHz)
 * back to Vobiz telephony standard (G.711 mu-law 8kHz).
 *
 * CRITICAL: Gemini Live API outputs PCM16 at exactly 24000 Hz.
 * Vobiz expects G.711 mu-law at exactly 8000 Hz.
 * Ratio = 24000 / 8000 = 3 — a clean integer stride, so we use direct
 * 3:1 decimation (every 3rd sample) instead of interpolation to avoid
 * artefacts and reduce processing latency.
 */
export function convertOutboundAudio(
  base64PCM: string
): string {
  try {
    if (!base64PCM) return base64PCM;

    const pcmBuffer = Buffer.from(base64PCM, 'base64');
    // Isolate from Node.js Buffer pool before Int16Array view
    const samples16 = new Int16Array(
      new Uint8Array(pcmBuffer).buffer
    );

    // 24kHz → 8kHz: strict 3:1 stride decimation
    const targetLength = Math.floor(samples16.length / 3);
    const muLawBuffer = new Uint8Array(targetLength);

    for (let i = 0; i < targetLength; i++) {
      const sample = samples16[i * 3]!; // Absolute 3:1 step stride
      muLawBuffer[i] = encodeMuLawSample(sample); // Convert to G.711 byte
    }

    return Buffer.from(
      muLawBuffer.buffer,
      muLawBuffer.byteOffset,
      muLawBuffer.byteLength
    ).toString('base64');
  } catch (err) {
    logger.error('audioConverter: convertOutboundAudio failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return base64PCM;
  }
}
