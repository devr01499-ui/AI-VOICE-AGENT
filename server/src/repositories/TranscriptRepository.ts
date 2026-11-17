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
  sequenceNumber?: number;
}

/** Redaction categories an agent can choose (Security & Fallback). `ssn` kept for older agents. */
export const PII_CATEGORIES = ['phone', 'email', 'aadhaar', 'pan', 'credit_card', 'ssn'] as const;

export function applyPiiRedaction(text: string, categories: string[] = []): string {
  if (!text || !categories || categories.length === 0) return text;
  let redacted = text;
  // Order matters: longer digit runs first so a card or Aadhaar number is not half-matched as a phone.
  if (categories.includes('credit_card')) {
    redacted = redacted.replace(/\b(?:\d[ -]?){12,15}\d\b/g, (m) => (m.replace(/\D/g, '').length >= 13 ? '[REDACTED CARD]' : m));
  }
  if (categories.includes('aadhaar')) {
    redacted = redacted.replace(/\b\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, '[REDACTED AADHAAR]');
  }
  if (categories.includes('pan')) {
    redacted = redacted.replace(/\b[A-Za-z]{5}\d{4}[A-Za-z]\b/g, '[REDACTED PAN]');
  }
  if (categories.includes('ssn')) {
    redacted = redacted.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED SSN]');
  }
  if (categories.includes('email')) {
    redacted = redacted.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED EMAIL]');
  }
  if (categories.includes('phone')) {
    // Indian mobiles (+91 / 0 / plain, spaced or not) and common international formats.
    redacted = redacted.replace(/(?:\+?\d{1,3}[-.\s]?)?(?:\b[6-9]\d{4}[-.\s]?\d{5}\b|\(?\b\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b)/g, '[REDACTED PHONE]');
  }
  return redacted;
}

/** The redaction categories chosen for the agent handling a call (cached briefly per call). */
const callCategoryCache = new Map<string, { at: number; categories: string[] }>();
export async function piiCategoriesForCall(callId: string): Promise<string[]> {
  const hit = callCategoryCache.get(callId);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.categories;
  let categories: string[] = [];
  try {
    const call = await prisma.call.findUnique({
      where: { id: callId },
      select: { agent: { select: { agentConfig: true, isPiiRedactionEnabled: true } } },
    });
    const raw = call?.agent?.agentConfig;
    const cfg = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const chosen = Array.isArray(cfg?.securityFallback?.piiRedaction) ? cfg.securityFallback.piiRedaction : [];
    categories = chosen.filter((c: unknown) => typeof c === 'string' && (PII_CATEGORIES as readonly string[]).includes(c));
    // Older agents only had the on/off switch: redact everything.
    if (categories.length === 0 && call?.agent?.isPiiRedactionEnabled) categories = ['phone', 'email', 'aadhaar', 'pan', 'credit_card'];
  } catch (err) {
    logger.warn('TranscriptRepository: could not read PII settings for call', { callId, error: String(err) });
  }
  if (callCategoryCache.size > 5_000) callCategoryCache.clear();
  callCategoryCache.set(callId, { at: Date.now(), categories });
  return categories;
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
   * segments for the same call and incrementing by one unless explicitly supplied.
   *
   * @param data - Segment payload (callId, speaker, content, timing, etc.).
   * @param piiCategories - Optional list of PII categories to redact before saving.
   * @returns The created TranscriptSegment record.
   */
  static async addSegment(data: AddSegmentData, piiCategories?: string[]) {
    try {
      const sequenceNumber = data.sequenceNumber ?? await TranscriptRepository.getNextSequenceNumber(
        data.callId
      );

      // Redact BEFORE storing, using the categories the agent chose (unless the caller passed them).
      const categories = piiCategories ?? await piiCategoriesForCall(data.callId);
      const sanitizedContent = categories.length > 0
        ? applyPiiRedaction(data.content, categories)
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
