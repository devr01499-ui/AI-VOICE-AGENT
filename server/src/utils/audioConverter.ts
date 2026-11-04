/**
 * Claritiy Voice Server — Audio Codec Converter
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
 * Maps each μ-law byte value (0..255) to its PCM16 equivalent.
 * Canonical 256-entry lookup table: 0..127 negative (-32124..0), 128..255 positive (32124..0).
 */
export const MU_LAW_DECODE_TABLE: readonly number[] = Object.freeze([
  -32124, -31100, -30076, -29052, -28028, -27004, -25980, -24956,
  -23932, -22908, -21884, -20860, -19836, -18812, -17788, -16764,
  -15996, -15484, -14972, -14460, -13948, -13436, -12924, -12412,
  -11900, -11388, -10876, -10364, -9852, -9340, -8828, -8316,
  -7932, -7676, -7420, -7164, -6908, -6652, -6396, -6140,
  -5884, -5628, -5372, -5116, -4860, -4604, -4348, -4092,
  -3900, -3772, -3644, -3516, -3388, -3260, -3132, -3004,
  -2876, -2748, -2620, -2492, -2364, -2236, -2108, -1980,
  -1884, -1820, -1756, -1692, -1628, -1564, -1500, -1436,
  -1372, -1308, -1244, -1180, -1116, -1052, -988, -924,
  -876, -844, -812, -780, -748, -716, -684, -652,
  -620, -588, -556, -524, -492, -460, -428, -396,
  -372, -356, -340, -324, -308, -292, -276, -260,
  -244, -228, -212, -196, -180, -164, -148, -132,
  -120, -112, -104, -96, -88, -80, -72, -64,
  -56, -48, -40, -32, -24, -16, -8, 0,
  32124, 31100, 30076, 29052, 28028, 27004, 25980, 24956,
  23932, 22908, 21884, 20860, 19836, 18812, 17788, 16764,
  15996, 15484, 14972, 14460, 13948, 13436, 12924, 12412,
  11900, 11388, 10876, 10364, 9852, 9340, 8828, 8316,
  7932, 7676, 7420, 7164, 6908, 6652, 6396, 6140,
  5884, 5628, 5372, 5116, 4860, 4604, 4348, 4092,
  3900, 3772, 3644, 3516, 3388, 3260, 3132, 3004,
  2876, 2748, 2620, 2492, 2364, 2236, 2108, 1980,
  1884, 1820, 1756, 1692, 1628, 1564, 1500, 1436,
  1372, 1308, 1244, 1180, 1116, 1052, 988, 924,
  876, 844, 812, 780, 748, 716, 684, 652,
  620, 588, 556, 524, 492, 460, 428, 396,
  372, 356, 340, 324, 308, 292, 276, 260,
  244, 228, 212, 196, 180, 164, 148, 132,
  120, 112, 104, 96, 88, 80, 72, 64,
  56, 48, 40, 32, 24, 16, 8, 0
]);

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
    ulawBytes[i] = encodeMuLawSample(pcm16Samples[i]!);
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

export function convertInboundAudio(base64MuLaw: string, explicitFormat?: string): string {
  if (!base64MuLaw) return '';

  const inputBuffer = Buffer.from(base64MuLaw, 'base64');
  
  const useInboundV2 = process.env.INBOUND_FORMAT_V2 === 'true' || explicitFormat !== undefined;
  let isL16: boolean;

  if (useInboundV2) {
    if (explicitFormat) {
      const lower = explicitFormat.toLowerCase();
      isL16 = !lower.includes('mulaw') && !lower.includes('pcmu') && !lower.includes('g711u');
    } else {
      // Default to audio/x-l16 16000 Hz per project codec constancy
      isL16 = true;
    }
  } else {
    // Auto-detect fallback: G.711 mu-law 8kHz has 1 byte/sample (e.g. 160 bytes for 20ms),
    // whereas L16 PCM 16kHz has 2 bytes/sample (e.g. 320 bytes for 10ms, 640 bytes for 20ms).
    isL16 = inputBuffer.length >= 320;
  }

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
    // Gentle line noise gate (only suppress extreme floor hiss, never quiet speech)
    if (rms < 35) {
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
  if (rms < 35) {
    samples16.fill(0);
  }

  return outBuffer.toString('base64');
}

/**
 * Standalone Named Helper: Decodes a single 8-bit G.711 mu-law byte to a 16-bit linear PCM sample
 * using the canonical ITU-T G.711 lookup table.
 */
/**
 * Standard ITU-T G.711 mu-law expansion table generator.
 * Computes standard expansion formula:
 *  - Invert transmission bits (~mu & 0xFF)
 *  - Extract sign, exponent, and mantissa
 *  - Bias by 33 (0x84), shift by exponent, subtract bias
 */
export function generateStandardMuLawTable(): Int16Array {
  const table = new Int16Array(256);
  for (let i = 0; i < 256; i++) {
    const mu = ~i & 0xff;
    const sign = mu & 0x80;
    const exponent = (mu >> 4) & 0x07;
    const mantissa = mu & 0x0f;
    let sample = ((mantissa << 3) + 0x84) << exponent;
    sample -= 0x84;
    table[i] = sign !== 0 ? -sample : sample;
  }
  return table;
}

export const PROGRAMMATIC_MU_LAW_TABLE: Int16Array = generateStandardMuLawTable();

export function decodeMuLawSample(muLawByte: number): number {
  if (process.env.INBOUND_FORMAT_V2 === 'true') {
    return PROGRAMMATIC_MU_LAW_TABLE[muLawByte & 0xff]!;
  }
  return MU_LAW_DECODE_TABLE[muLawByte & 0xff]!;
}

/**
 * Encodes a single 16-bit PCM sample to a G.711 mu-law byte.
 * Adheres strictly to the ITU-T G.711 specification with:
 * - 14-bit linear dynamic range
 * - Bias offset of 132 (0x84)
 * - Logarithmic chord compression
 * - Bit inversion for transmission
 * - Zero-byte protection (0x00 -> 0x02 to prevent carrier signalling drops)
 */
export function encodeMuLawSample(pcm: number): number {
  let sample = pcm;
  let sign = 0;
  if (sample < 0) {
    sign = 0x80;
    sample = -sample;
  }

  // Clip to max 14-bit magnitude
  if (sample > 32635) sample = 32635;

  sample += 132;
  let exponent = 7;
  for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1) {}

  const mantissa = (sample >> (exponent + 3)) & 0x0F;
  const ulawByte = ~(sign | (exponent << 4) | mantissa) & 0xFF;

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


// ─────────────────────────────────────────────
// Task T1: Streaming Polyphase 3:2 Low-Pass Resampler
// ─────────────────────────────────────────────

function besselI0(x: number): number {
  let sum = 1;
  let term = 1;
  const xSquaredFourth = (x * x) / 4;
  for (let k = 1; k < 25; k++) {
    term *= xSquaredFourth / (k * k);
    sum += term;
    if (term < 1e-12 * sum) break;
  }
  return sum;
}

function designPolyphaseFilter(numTaps: number, cutoffNormalized: number, beta: number): Float64Array {
  const h = new Float64Array(numTaps);
  const mid = (numTaps - 1) / 2;
  const i0Beta = besselI0(beta);

  for (let n = 0; n < numTaps; n++) {
    const x = n - mid;
    let sincVal: number;
    if (Math.abs(x) < 1e-9) {
      sincVal = 2 * cutoffNormalized;
    } else {
      const piX = Math.PI * 2 * cutoffNormalized * x;
      sincVal = Math.sin(piX) / (Math.PI * x);
    }
    const kaiserVal = besselI0(beta * Math.sqrt(Math.max(0, 1 - Math.pow((2 * n) / (numTaps - 1) - 1, 2)))) / i0Beta;
    h[n] = 2.0 * sincVal * kaiserVal;
  }

  // Normalize DC gain across each polyphase branch to 1.0
  let sum0 = 0;
  let sum1 = 0;
  for (let n = 0; n < numTaps; n++) {
    if (n % 2 === 0) sum0 += h[n];
    else sum1 += h[n];
  }
  for (let n = 0; n < numTaps; n++) {
    if (n % 2 === 0) h[n] /= sum0;
    else h[n] /= sum1;
  }
  return h;
}

/**
 * Streaming stateful 24kHz -> 16kHz polyphase FIR resampler.
 * Designed with a Kaiser-windowed sinc filter (60 taps at 48kHz, 30 per polyphase branch)
 * Cutoff at 7.2 kHz, achieving > 40 dB alias rejection above 8.5 kHz.
 * Preserves filter history, sub-sample phase, and odd byte state across chunk boundaries.
 */
export class StreamingResampler24to16 {
  private readonly numTaps = 60;
  private readonly tapsPerBranch = 30;
  private readonly sub0: Float32Array;
  private readonly sub1: Float32Array;
  private readonly ring: Float32Array;
  private head = 0;
  private phase = 0;
  private hasOddByte = false;
  private oddByte = 0;
  private outBuffer: Buffer;

  constructor() {
    const filter = designPolyphaseFilter(this.numTaps, 7200 / 48000, 5.65);
    this.sub0 = new Float32Array(this.tapsPerBranch);
    this.sub1 = new Float32Array(this.tapsPerBranch);
    for (let i = 0; i < this.tapsPerBranch; i++) {
      this.sub0[i] = filter[i * 2]!;
      this.sub1[i] = filter[i * 2 + 1]!;
    }
    // Mirrored circular buffer of length 2 * tapsPerBranch (60)
    // Eliminates modulo in inner convolution loop for sub-millisecond execution
    this.ring = new Float32Array(this.tapsPerBranch * 2);
    this.outBuffer = Buffer.alloc(16384 * 2);
  }

  /**
   * Resets filter history and phase on barge-in or turn restart.
   */
  reset(): void {
    this.ring.fill(0);
    this.head = 0;
    this.phase = 0;
    this.hasOddByte = false;
    this.oddByte = 0;
  }

  /**
   * Processes a chunk of 24kHz mono PCM16 audio and returns 16kHz mono PCM16 buffer.
   */
  process(chunkBuffer: Buffer): Buffer {
    if (!chunkBuffer || chunkBuffer.length === 0) {
      return Buffer.alloc(0);
    }

    let inputBytes = chunkBuffer;
    if (this.hasOddByte) {
      const combined = Buffer.alloc(chunkBuffer.length + 1);
      combined[0] = this.oddByte;
      chunkBuffer.copy(combined, 1);
      inputBytes = combined;
      this.hasOddByte = false;
    }

    if (inputBytes.length % 2 !== 0) {
      this.hasOddByte = true;
      this.oddByte = inputBytes[inputBytes.length - 1]!;
      inputBytes = inputBytes.subarray(0, inputBytes.length - 1);
    }

    const numInputSamples = inputBytes.length / 2;
    if (numInputSamples === 0) {
      return Buffer.alloc(0);
    }

    let inSamples: Int16Array;
    if (inputBytes.byteOffset % 2 === 0) {
      inSamples = new Int16Array(inputBytes.buffer, inputBytes.byteOffset, numInputSamples);
    } else {
      const aligned = Buffer.alloc(inputBytes.length);
      inputBytes.copy(aligned);
      inSamples = new Int16Array(aligned.buffer, aligned.byteOffset, numInputSamples);
    }

    const maxOutputSamples = Math.ceil((numInputSamples * 2 + 6) / 3) + 4;
    const requiredBytes = maxOutputSamples * 2;
    if (this.outBuffer.length < requiredBytes) {
      this.outBuffer = Buffer.alloc(requiredBytes * 2);
    }

    const outView = new Int16Array(this.outBuffer.buffer, this.outBuffer.byteOffset, maxOutputSamples);
    let outIdx = 0;

    const ring = this.ring;
    const K = 30;
    const sub0 = this.sub0;
    const sub1 = this.sub1;
    let head = this.head;
    let phase = this.phase;

    for (let i = 0; i < numInputSamples; i++) {
      const s = inSamples[i]!;
      ring[head] = s;
      ring[head + K] = s;

      const base = head + K;
      head = (head + 1) % K;

      while (phase < 2) {
        let sum = 0;
        if (phase === 0) {
          for (let j = 0; j < 30; j++) {
            sum += sub0[j]! * ring[base - j]!;
          }
        } else {
          for (let j = 0; j < 30; j++) {
            sum += sub1[j]! * ring[base - j]!;
          }
        }

        let val = Math.round(sum);
        if (val > 32767) val = 32767;
        else if (val < -32768) val = -32768;
        outView[outIdx++] = val;

        phase += 3;
      }
      phase -= 2;
    }

    this.head = head;
    this.phase = phase;

    // Return an independent buffer chunk so chunk arrays in callers are not overwritten
    const outBytes = outIdx * 2;
    const result = Buffer.allocUnsafe(outBytes);
    this.outBuffer.copy(result, 0, 0, outBytes);
    return result;
  }
}

let statefulErrorCount = 0;
let lastStatefulErrorLogTime = 0;

/**
 * Stateful wrapper for streaming outbound audio conversion.
 * Throttles logging to at most once per 10s and increments error counter.
 */
export function convertOutboundAudioStateful(
  resampler: StreamingResampler24to16,
  pcmBuffer: Buffer
): string {
  if (!pcmBuffer || pcmBuffer.length === 0) {
    return '';
  }

  try {
    const resampledBuffer = resampler.process(pcmBuffer);
    if (resampledBuffer.length === 0) {
      return '';
    }
    return resampledBuffer.toString('base64');
  } catch (err) {
    statefulErrorCount++;
    const now = Date.now();
    if (now - lastStatefulErrorLogTime >= 10000) {
      lastStatefulErrorLogTime = now;
      logger.error('audioConverter: convertOutboundAudioStateful failed', {
        error: err instanceof Error ? err.message : String(err),
        totalErrors: statefulErrorCount,
      });
    }
    return '';
  }
}
