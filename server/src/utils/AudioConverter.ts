/**
 * Bolna Server — Audio Converter Utility
 *
 * Implements:
 *   1. G.711 mu-law decoding to PCM16
 *   2. PCM16 encoding to G.711 mu-law
 *   3. Linear interpolation resampling
 *   4. Base64 wrappers for stream integration
 */

import { logger } from './logger';

const BIAS = 0x84;
const CLIP = 32635;
const EXP_LUT = [0, 132, 396, 924, 1980, 4092, 8316, 16764];

/**
 * Converts a buffer of 8-bit G.711 mu-law samples to a 16-bit linear PCM Int16Array.
 */
export function ulawToPcm16(ulawBuffer: Buffer): Int16Array {
  const len = ulawBuffer.length;
  const pcm16 = new Int16Array(len);
  for (let i = 0; i < len; i++) {
    // G.711 standard specifies that u-law bits are inverted in transmission
    const ulawbyte = (~ulawBuffer[i]) & 0xFF;
    const sign = (ulawbyte & 0x80);
    const exponent = (ulawbyte >> 4) & 0x07;
    const mantissa = ulawbyte & 0x0F;
    const sample = EXP_LUT[exponent] + (mantissa << (exponent + 3));
    pcm16[i] = sign ? -sample : sample;
  }
  return pcm16;
}

/**
 * Converts an Int16Array of PCM16 samples to an 8-bit G.711 mu-law Buffer.
 */
export function pcm16ToUlaw(pcm16: Int16Array): Buffer {
  const len = pcm16.length;
  const ulaw = Buffer.alloc(len);
  for (let i = 0; i < len; i++) {
    let sample = pcm16[i];
    const sign = (sample < 0) ? 0x80 : 0;
    if (sample < 0) {
      sample = -sample;
    }
    if (sample > CLIP) {
      sample = CLIP;
    }
    sample += BIAS;

    let exponent = 7;
    for (let mask = 0x4000; (sample & mask) === 0 && exponent > 0; mask >>= 1) {
      exponent--;
    }
    const mantissa = (sample >> (exponent + 3)) & 0x0F;
    const ulawbyte = ~(sign | (exponent << 4) | mantissa);
    ulaw[i] = ulawbyte & 0xFF;
  }
  return ulaw;
}

/**
 * Converts a raw binary Buffer containing PCM16 little-endian samples to an Int16Array.
 */
export function bufferToInt16Array(buffer: Buffer): Int16Array {
  const len = Math.floor(buffer.length / 2);
  const pcm16 = new Int16Array(len);
  for (let i = 0; i < len; i++) {
    pcm16[i] = buffer.readInt16LE(i * 2);
  }
  return pcm16;
}

/**
 * Converts an Int16Array of PCM16 samples to a raw binary Buffer of little-endian samples.
 */
export function int16ArrayToBuffer(pcm16: Int16Array): Buffer {
  const buffer = Buffer.alloc(pcm16.length * 2);
  for (let i = 0; i < pcm16.length; i++) {
    buffer.writeInt16LE(pcm16[i], i * 2);
  }
  return buffer;
}

/**
 * Resamples PCM16 samples from an input sample rate to an output sample rate using linear interpolation.
 */
export function resample(samples: Int16Array, fromRate: number, toRate: number): Int16Array {
  if (fromRate === toRate) return samples;
  const ratio = fromRate / toRate;
  const outputLength = Math.floor(samples.length / ratio);
  const output = new Int16Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const pos = i * ratio;
    const index = Math.floor(pos);
    const fraction = pos - index;
    if (index >= samples.length) {
      break;
    }
    const current = samples[index];
    const next = (index + 1 < samples.length) ? samples[index + 1] : current;
    output[i] = Math.round(current + fraction * (next - current));
  }

  return output;
}

/**
 * Decodes inbound base64 mu-law 8000Hz audio, resamples it to targetRate, and encodes it as base64 PCM16.
 */
export function convertInboundAudio(audioBase64: string, targetRate: number): string {
  try {
    const ulawBuffer = Buffer.from(audioBase64, 'base64');
    const pcm16_8k = ulawToPcm16(ulawBuffer);
    const pcm16_target = resample(pcm16_8k, 8000, targetRate);
    const pcmBuffer = int16ArrayToBuffer(pcm16_target);
    return pcmBuffer.toString('base64');
  } catch (err) {
    logger.error('AudioConverter: failed to convert inbound audio', {
      error: err instanceof Error ? err.message : String(err),
    });
    return audioBase64;
  }
}

/**
 * Decodes outbound base64 PCM16 audio at sourceRate, resamples it to 8000Hz, and encodes it as base64 mu-law.
 */
export function convertOutboundAudio(audioBase64: string, sourceRate: number): string {
  try {
    const pcmBuffer = Buffer.from(audioBase64, 'base64');
    const pcm16_source = bufferToInt16Array(pcmBuffer);
    const pcm16_8k = resample(pcm16_source, sourceRate, 8000);
    const ulawBuffer = pcm16ToUlaw(pcm16_8k);
    return ulawBuffer.toString('base64');
  } catch (err) {
    logger.error('AudioConverter: failed to convert outbound audio', {
      error: err instanceof Error ? err.message : String(err),
    });
    return audioBase64;
  }
}
