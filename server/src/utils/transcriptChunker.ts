/**
 * transcriptChunker.ts — Overlapping Transcript Chunker & Fact Merger for Long Calls
 *
 * Implements Section 5.10:
 * - Respects transcript token cap (e.g., 3,000 tokens / ~12,000 chars per chunk).
 * - For long calls, splits segments into overlapping chunks with 2-turn window overlap.
 * - Merges extracted facts: latest caller-confirmed value wins.
 * - Preserves evidence quote from the chunk it originated from.
 */

import { SanitizedTranscriptTurn } from './promptInjectionGuard';

export interface TranscriptChunk {
  chunkIndex: number;
  totalChunks: number;
  turns: SanitizedTranscriptTurn[];
}

/**
 * Splits transcript turns into overlapping chunks if total character count exceeds chunk limit.
 */
export function chunkTranscriptTurns(
  turns: SanitizedTranscriptTurn[],
  maxCharsPerChunk: number = 8000,
  overlapTurns: number = 2
): TranscriptChunk[] {
  if (turns.length === 0) return [];

  const chunks: TranscriptChunk[] = [];
  let currentTurns: SanitizedTranscriptTurn[] = [];
  let currentLength = 0;
  let startIndex = 0;

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    const turnLength = turn.content.length + 30; // content + turn metadata

    if (currentLength + turnLength > maxCharsPerChunk && currentTurns.length > 0) {
      chunks.push({
        chunkIndex: chunks.length,
        totalChunks: 0, // populated after loop
        turns: [...currentTurns],
      });

      // Retain overlap turns from the end of the current chunk
      const overlapStart = Math.max(0, currentTurns.length - overlapTurns);
      currentTurns = currentTurns.slice(overlapStart);
      currentLength = currentTurns.reduce((sum, t) => sum + t.content.length + 30, 0);
    }

    currentTurns.push(turn);
    currentLength += turnLength;
  }

  if (currentTurns.length > 0) {
    chunks.push({
      chunkIndex: chunks.length,
      totalChunks: 0,
      turns: currentTurns,
    });
  }

  // Set totalChunks across all chunks
  const total = chunks.length;
  for (const c of chunks) {
    c.totalChunks = total;
  }

  return chunks;
}

/**
 * Merges facts extracted across multiple chunks:
 * Rule: The latest caller-confirmed turn value wins, and retains its evidence quote.
 */
export function mergeChunkedFacts(
  chunkResults: Array<{
    fields: Record<string, any>;
    evidence: Record<string, any>;
    lastTurnSequence: number;
  }>
): {
  mergedFields: Record<string, any>;
  mergedEvidence: Record<string, any>;
} {
  const mergedFields: Record<string, any> = {};
  const mergedEvidence: Record<string, any> = {};
  const fieldTurnTimestamps: Record<string, number> = {};

  for (const res of chunkResults) {
    for (const [key, value] of Object.entries(res.fields)) {
      if (value === null || value === undefined) continue;

      const previousTurn = fieldTurnTimestamps[key] ?? -1;
      if (res.lastTurnSequence >= previousTurn) {
        mergedFields[key] = value;
        if (res.evidence[key]) {
          mergedEvidence[key] = res.evidence[key];
        }
        fieldTurnTimestamps[key] = res.lastTurnSequence;
      }
    }
  }

  return { mergedFields, mergedEvidence };
}
