import { TranscriptRepository } from '../../repositories/TranscriptRepository';
import { Speaker } from '../provider-sdk/provider.types';
import { logger } from '../../utils/logger';

export class TranscriptRecorder {
  /**
   * Records a transcript segment during the call conversation.
   */
  static async recordSegment(callId: string, speaker: Speaker, text: string): Promise<void> {
    if (!text.trim()) return;

    try {
      await TranscriptRepository.addSegment({
        callId,
        speaker,
        content: text.trim(),
        startTime: 0, // In simple model, timestamp relative to call start is optional/calculated
      });
      logger.debug('TranscriptRecorder: segment saved', { callId, speaker, text });
    } catch (err) {
      logger.error('TranscriptRecorder: failed to save segment', {
        callId,
        speaker,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
