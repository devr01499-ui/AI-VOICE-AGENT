import { convertInboundAudio, convertOutboundAudio } from '../../../utils/audioConverter';

export class GeminiAudioBridge {
  /**
   * Translates incoming Vobiz audio (8kHz G.711 mu-law) to Gemini format (16kHz PCM16).
   */
  static toGeminiAudio(audioBase64: string): string {
    return convertInboundAudio(audioBase64, 16000);
  }

  /**
   * Translates outgoing Gemini audio (24kHz PCM16) back to Vobiz standard (8kHz G.711 mu-law).
   */
  static toVobizAudio(audioBase64: string): string {
    return convertOutboundAudio(audioBase64, 24000);
  }
}
