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
 * Applies a noise gate to PCM16 samples, zeroing out signals below the RMS threshold.
 * This prevents line static/hum from keeping the VAD open and reducing response latency.
 */
export function applyNoiseGate(samples: Int16Array, threshold = 120): void {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i]! * samples[i]!;
  }
  const rms = Math.sqrt(sum / samples.length);
  if (rms < threshold) {
    samples.fill(0);
  }
}

/**
 * Base64 stream helper for inbound audio from Vobiz.
 *
 * IMPORTANT: Vobiz is configured with contentType="audio/x-l16;rate=16000"
 * which means it sends raw Linear 16-bit PCM at 16kHz.
 * However, telephony streams send data in big-endian (network byte order),
 * whereas Gemini expects little-endian PCM16.
 *
 * We decode the base64 payload, swap bytes using native fast swap16,
 * apply a noise gate, and return the clean Buffer directly.
 */

export function convertInboundAudio(base64MuLaw: string): string {
  if (!base64MuLaw) return '';

  const inputBuffer = Buffer.from(base64MuLaw, 'base64');
  
  // Auto-detect: G.711 mu-law 8kHz has 1 byte/sample (e.g. 160 bytes for 20ms),
  // whereas L16 PCM 16kHz has 2 bytes/sample (e.g. 640 bytes for 20ms).
  const isL16 = inputBuffer.length > 320;

  if (isL16) {
    // Process as L16 PCM 16kHz Little-Endian
    const evenLength = inputBuffer.length - (inputBuffer.length % 2);
    const targetBuffer = inputBuffer.length === evenLength ? inputBuffer : inputBuffer.subarray(0, evenLength);
    
    const samples16 = new Int16Array(
      targetBuffer.buffer,
      targetBuffer.byteOffset,
      targetBuffer.length / 2
    );

    const samples = samples16.length;
    let sumSquares = 0;
    for (let i = 0; i < samples; i++) {
      sumSquares += samples16[i] * samples16[i];
    }
    const rms = Math.sqrt(sumSquares / samples);
    if (rms < 120) {
      samples16.fill(0);
    }
    return targetBuffer.toString('base64');
  }

  // Else, process as G.711 mu-law 8kHz (decode and upsample to 16kHz)
  const totalInputSamples = inputBuffer.length;
  const targetSamples = totalInputSamples * 2;
  const outBuffer = Buffer.alloc(targetSamples * 2);
  const samples16 = new Int16Array(outBuffer.buffer, outBuffer.byteOffset, targetSamples);

  let sumSquares = 0;
  for (let i = 0; i < totalInputSamples; i++) {
    const muLawSample = inputBuffer[i];
    const linearSample = decodeMuLawSample(muLawSample); 

    const idx1 = i * 2;
    const idx2 = i * 2 + 1;
    
    samples16[idx1] = linearSample;
    samples16[idx2] = linearSample;

    sumSquares += linearSample * linearSample;
    sumSquares += linearSample * linearSample;
  }

  const rms = Math.sqrt(sumSquares / targetSamples);
  if (rms < 120) {
    samples16.fill(0);
  }

  return outBuffer.toString('base64');
}

/**
 * Standalone Named Helper: Decodes a single 8-bit G.711 mu-law byte to a 16-bit linear PCM sample.
 */
function decodeMuLawSample(muLawByte: number): number {
  // Flip the bits as G.711 mu-law inherently complements data bits
  const sign = (muLawByte & 0x80) === 0 ? -1 : 1;
  const exponent = (muLawByte & 0x70) >> 4;
  const mantissa = muLawByte & 0x0F;
  
  let sample = (mantissa << 3) + 132;
  sample <<= exponent;
  sample -= 132;
  
  return sign * sample;
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
 * to Vobiz L16 format at 16kHz.
 *
 * IMPORTANT: Vobiz stream is configured with contentType="audio/x-l16;rate=16000"
 * so it expects raw L16 PCM at 16kHz back — NOT mu-law.
 *
 * Gemini Live API outputs PCM16 at exactly 24000 Hz.
 * We need to downsample 24kHz → 16kHz (ratio = 1.5) using cubic spline interpolation.
 */
export function convertOutboundAudio(
  pcmBuffer: Buffer
): string {
  try {
    if (!pcmBuffer || pcmBuffer.length === 0) return '';

    // Safe Int16Array view on the buffer slice
    const samples24k = new Int16Array(
      pcmBuffer.buffer,
      pcmBuffer.byteOffset,
      pcmBuffer.length / 2
    );

    // Resample 24kHz → 16kHz using Catmull-Rom cubic spline interpolation
    const resampled = resample(samples24k, 24000, 16000);

    return Buffer.from(
      resampled.buffer,
      resampled.byteOffset,
      resampled.byteLength
    ).toString('base64');
  } catch (err) {
    logger.error('audioConverter: convertOutboundAudio failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return '';
  }
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
    const index1 = Math.floor(srcIndex);
    const t = srcIndex - index1;

    // Get 4 points for cubic interpolation
    const index0 = Math.max(0, index1 - 1);
    const index2 = Math.min(lastIndex, index1 + 1);
    const index3 = Math.min(lastIndex, index1 + 2);

    const y0 = samples[index0]!;
    const y1 = samples[index1]!;
    const y2 = samples[index2]!;
    const y3 = samples[index3]!;

    // Catmull-Rom spline formulation
    const a = -0.5 * y0 + 1.5 * y1 - 1.5 * y2 + 0.5 * y3;
    const b = y0 - 2.5 * y1 + 2.0 * y2 - 0.5 * y3;
    const c = -0.5 * y0 + 0.5 * y2;
    const d = y1;

    const interpolated = a * t * t * t + b * t * t + c * t + d;
    let processedSample = Math.round(interpolated);

    // Prevent digital wrapping distortion/crackle
    if (processedSample > 32767) processedSample = 32767;
    if (processedSample < -32768) processedSample = -32768;

    result[i] = processedSample;
  }

  return result;
}
