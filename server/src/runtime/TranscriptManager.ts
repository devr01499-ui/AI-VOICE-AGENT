/**
 * Bolna Server — Transcript Manager
 *
 * Real-time transcript persistence layer. Receives utterance events from
 * the RealtimeSessionManager, assigns sequence numbers, and writes to
 * the database immediately via TranscriptRepository. Also provides
 * search, export, and summary capabilities.
 */

import { logger } from '../utils/logger';
import { TranscriptRepository } from '../repositories/TranscriptRepository';
import type { Speaker, TranscriptSegmentResponse } from '../types';
import { TranscriptSegment } from '@prisma/client';

/** Format options for transcript export. */
export type TranscriptExportFormat = 'json' | 'text';

/**
 * Manages real-time transcript capture and retrieval for active calls.
 * Each utterance is persisted immediately — no in-memory buffering.
 */
export class TranscriptManager {
  /**
   * Adds a single utterance to the transcript.
   * Automatically assigns the next sequence number for the call.
   *
   * @param callId - The call this utterance belongs to
   * @param speaker - Who spoke: 'agent' or 'user'
   * @param text - The transcribed text content
   * @param startTime - Seconds from call start when speech began
   * @param endTime - Seconds from call start when speech ended (optional)
   * @param confidence - ASR confidence score 0-1 (optional)
   */
  async addUtterance(
    callId: string,
    speaker: Speaker,
    text: string,
    startTime: number,
    endTime?: number,
    confidence?: number
  ): Promise<void> {
    if (!text.trim()) {
      logger.debug('TranscriptManager: skipping empty utterance', { callId, speaker });
      return;
    }

    try {
      await TranscriptRepository.addSegment({
        callId,
        speaker,
        content: text.trim(),
        startTime,
        endTime,
        confidence,
      });

      logger.debug('TranscriptManager: utterance saved', {
        callId,
        speaker,
        contentLength: text.trim().length,
        startTime,
      });
    } catch (err) {
      // Log but don't throw — transcript failures should not crash the call
      logger.error('TranscriptManager: failed to save utterance', {
        callId,
        speaker,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Returns the full transcript for a call, ordered by sequence number.
   */
  async getFullTranscript(callId: string): Promise<TranscriptSegmentResponse[]> {
    const segments = await TranscriptRepository.findByCallId(callId);

    return segments.map((seg: TranscriptSegment) => ({
      id: seg.id,
      speaker: seg.speaker as Speaker,
      content: seg.content,
      startTime: seg.startTime,
      endTime: seg.endTime,
      sequenceNumber: seg.sequenceNumber,
    }));
  }

  /**
   * Searches transcript segments for a keyword (case-insensitive).
   */
  async searchTranscript(
    callId: string,
    keyword: string
  ): Promise<TranscriptSegmentResponse[]> {
    const segments = await TranscriptRepository.searchByContent(callId, keyword);

    return segments.map((seg: TranscriptSegment) => ({
      id: seg.id,
      speaker: seg.speaker as Speaker,
      content: seg.content,
      startTime: seg.startTime,
      endTime: seg.endTime,
      sequenceNumber: seg.sequenceNumber,
    }));
  }

  /**
   * Exports the transcript in the requested format.
   *
   * @param callId - The call to export
   * @param format - 'json' returns structured array, 'text' returns readable string
   */
  async exportTranscript(
    callId: string,
    format: TranscriptExportFormat = 'json'
  ): Promise<string> {
    const segments = await this.getFullTranscript(callId);

    if (format === 'text') {
      return segments
        .map(
          (seg) =>
            `[${this.formatTimestamp(seg.startTime)}] ${seg.speaker.toUpperCase()}: ${seg.content}`
        )
        .join('\n');
    }

    return JSON.stringify(segments, null, 2);
  }

  /**
   * Generates a basic summary of the transcript.
   * Returns turn count, total duration, and speaker breakdown.
   */
  async generateSummary(
    callId: string
  ): Promise<{
    totalSegments: number;
    agentSegments: number;
    userSegments: number;
    estimatedDurationSeconds: number;
  }> {
    const segments = await TranscriptRepository.findByCallId(callId);

    const agentSegments = segments.filter((s: TranscriptSegment) => s.speaker === 'agent').length;
    const userSegments = segments.filter((s: TranscriptSegment) => s.speaker === 'user').length;

    let estimatedDurationSeconds = 0;
    if (segments.length > 0) {
      const lastSegment = segments[segments.length - 1];
      const firstSegment = segments[0];
      estimatedDurationSeconds = (lastSegment.endTime ?? lastSegment.startTime) - firstSegment.startTime;
    }

    return {
      totalSegments: segments.length,
      agentSegments,
      userSegments,
      estimatedDurationSeconds,
    };
  }

  /** Formats seconds into MM:SS display. */
  private formatTimestamp(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
}
