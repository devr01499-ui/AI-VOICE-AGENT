// ─────────────────────────────────────────────
// Voice Runtime Engine — Transcript Repository
// ─────────────────────────────────────────────

import { prisma } from '../lib/prisma';
import { DatabaseError } from '../types/errors';
import { logger } from '../utils/logger';

/**
 * Data required to create a new TranscriptSegment.
 * `sequenceNumber` is calculated automatically per call.
 */
interface AddSegmentData {
  callId: string;
  speaker: string;
  content: string;
  startTime: number;
  endTime?: number;
  confidence?: number;
  metadata?: string;
}

export function applyPiiRedaction(text: string, categories: string[] = []): string {
  if (!text || !categories || categories.length === 0) return text;
  let redacted = text;
  if (categories.includes('credit_card')) {
    redacted = redacted.replace(/\b(?:\d[ -]*?){13,16}\b/g, '[REDACTED CREDIT CARD]');
  }
  if (categories.includes('ssn')) {
    redacted = redacted.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED SSN]');
  }
  if (categories.includes('phone')) {
    redacted = redacted.replace(/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[REDACTED PHONE]');
  }
  if (categories.includes('email')) {
    redacted = redacted.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED EMAIL]');
  }
  return redacted;
}

/**
 * Prisma-based repository for the TranscriptSegment model.
 *
 * Segments are ordered by `sequenceNumber` within a call. The repository
 * auto-increments the sequence number so callers never need to track it.
 */
export class TranscriptRepository {
  // ───────── Create ─────────

  /**
   * Add a new transcript segment to a call.
   *
   * The `sequenceNumber` is determined automatically by counting existing
   * segments for the same call and incrementing by one.
   *
   * @param data - Segment payload (callId, speaker, content, timing, etc.).
   * @param piiCategories - Optional list of PII categories to redact before saving.
   * @returns The created TranscriptSegment record.
   */
  static async addSegment(data: AddSegmentData, piiCategories?: string[]) {
    try {
      const sequenceNumber = await TranscriptRepository.getNextSequenceNumber(
        data.callId
      );

      const sanitizedContent = piiCategories && piiCategories.length > 0
        ? applyPiiRedaction(data.content, piiCategories)
        : data.content;

      const segment = await prisma.transcriptSegment.create({
        data: {
          callId: data.callId,
          speaker: data.speaker,
          content: sanitizedContent,
          startTime: data.startTime,
          endTime: data.endTime,
          sequenceNumber,
          confidence: data.confidence,
          metadata: data.metadata ?? '{}',
        },
      });

      logger.debug('Transcript segment added', {
        callId: data.callId,
        sequenceNumber,
        speaker: data.speaker,
      });

      return segment;
    } catch (error) {
      // Avoid double-wrapping if getNextSequenceNumber already threw
      if (error instanceof DatabaseError) {
        throw error;
      }
      logger.error('Failed to add transcript segment', {
        callId: data.callId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new DatabaseError('Failed to add transcript segment');
    }
  }

  // ───────── Read ─────────

  /**
   * Return all transcript segments for a call, ordered by sequence number.
   *
   * @param callId - UUID of the call.
   * @returns Array of TranscriptSegment records in chronological order.
   */
  static async findByCallId(callId: string) {
    try {
      const segments = await prisma.transcriptSegment.findMany({
        where: { callId },
        orderBy: { sequenceNumber: 'asc' },
      });

      return segments;
    } catch (error) {
      logger.error('Failed to find transcript segments', {
        callId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new DatabaseError('Failed to find transcript segments');
    }
  }

  /**
   * Calculate the next sequence number for a call.
   *
   * @param callId - UUID of the call.
   * @returns The next integer sequence number (1-based).
   */
  static async getNextSequenceNumber(callId: string): Promise<number> {
    try {
      const count = await prisma.transcriptSegment.count({
        where: { callId },
      });

      return count + 1;
    } catch (error) {
      logger.error('Failed to compute next sequence number', {
        callId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new DatabaseError('Failed to compute next sequence number');
    }
  }

  /**
   * Search transcript segments by keyword within a specific call.
   *
   * Uses Prisma `contains` which maps to a `LIKE '%keyword%'` in SQLite,
   * providing case-insensitive matching on most collations.
   *
   * @param callId  - UUID of the call to search within.
   * @param keyword - Substring to match against segment content.
   * @returns Matching TranscriptSegment records ordered by sequence number.
   */
  static async searchByContent(callId: string, keyword: string) {
    try {
      const segments = await prisma.transcriptSegment.findMany({
        where: {
          callId,
          content: {
            contains: keyword,
          },
        },
        orderBy: { sequenceNumber: 'asc' },
      });

      return segments;
    } catch (error) {
      logger.error('Failed to search transcript segments', {
        callId,
        keyword,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new DatabaseError('Failed to search transcript segments');
    }
  }

  // ───────── Delete ─────────

  /**
   * Delete all transcript segments for a given call.
   *
   * @param callId - UUID of the call whose segments should be removed.
   * @returns The count of deleted records.
   */
  static async deleteByCallId(callId: string): Promise<number> {
    try {
      const result = await prisma.transcriptSegment.deleteMany({
        where: { callId },
      });

      logger.info('Transcript segments deleted', {
        callId,
        count: result.count,
      });

      return result.count;
    } catch (error) {
      logger.error('Failed to delete transcript segments', {
        callId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new DatabaseError('Failed to delete transcript segments');
    }
  }
}
