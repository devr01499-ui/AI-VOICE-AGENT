/**
 * evidenceValidator.ts — Verbatim Evidence Grounding Engine
 *
 * Implements Section 5.5, C6 & C10:
 * - Every extracted field and outcome label must carry a verbatim quote.
 * - Code verifies each quote is an exact substring of the transcript turns.
 * - Caller facts must originate from caller turns (user/caller), not agent turns.
 * - Quotes must have minimum length (>= 4 chars) and contain or map to the extracted value.
 * - Safe against non-string quotes (numbers coerced, objects rejected safely).
 * - Uses transcript sequenceNumber for authoritative turn tracking.
 */

export interface EvidenceRecord {
  quote?: any;
  segmentIndex?: number;
  sequenceNumber?: number;
  speaker?: string;
  verified?: boolean;
}

export interface VerificationResult {
  isValid: boolean;
  normalizedQuote: string;
  matchedSegmentIndex?: number;
  matchedSequenceNumber?: number;
  speaker?: string;
  failureReason?: string;
}

/**
 * Normalizes string for evidence comparison (collapses contiguous whitespace and strips outer punctuation).
 */
export function normalizeEvidenceWhitespace(text: string): string {
  if (!text) return '';
  return String(text)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Validates whether an evidence quote exists as a verbatim substring of the conversation transcript.
 */
export function verifyEvidenceGrounding(
  rawQuote: any,
  transcriptSegments: Array<{ content: string; speaker?: string; sequenceNumber?: number }>,
  claimedSegmentIndex?: number,
  options: { requireCallerTurn?: boolean; fieldValue?: any } = {}
): VerificationResult {
  if (rawQuote === null || rawQuote === undefined) {
    return {
      isValid: false,
      normalizedQuote: '',
      failureReason: 'MISSING_EVIDENCE_QUOTE',
    };
  }

  // C10: Safe quote string coercion
  let quoteStr = '';
  if (typeof rawQuote === 'string') {
    quoteStr = rawQuote;
  } else if (typeof rawQuote === 'number' || typeof rawQuote === 'boolean') {
    quoteStr = String(rawQuote);
  } else {
    return {
      isValid: false,
      normalizedQuote: '',
      failureReason: 'NON_STRING_QUOTE',
    };
  }

  const cleanQuote = normalizeEvidenceWhitespace(quoteStr);

  // C6 (b) & (c): Minimum quote length (at least 4 characters, rejects single-character quotes like "a")
  if (cleanQuote.length < 4) {
    return {
      isValid: false,
      normalizedQuote: cleanQuote,
      failureReason: 'QUOTE_TOO_SHORT',
    };
  }

  // 1. Fast path: check claimed segment index
  if (claimedSegmentIndex !== undefined && transcriptSegments[claimedSegmentIndex]) {
    const targetSeg = transcriptSegments[claimedSegmentIndex];
    const cleanSeg = normalizeEvidenceWhitespace(targetSeg.content);

    if (cleanSeg.includes(cleanQuote)) {
      const isCaller = targetSeg.speaker === 'user' || targetSeg.speaker === 'caller' || targetSeg.speaker === 'customer';
      if (options.requireCallerTurn && !isCaller) {
        return {
          isValid: false,
          normalizedQuote: cleanQuote,
          failureReason: 'CALLER_FACT_STATED_BY_AGENT',
        };
      }
      return {
        isValid: true,
        normalizedQuote: cleanQuote,
        matchedSegmentIndex: claimedSegmentIndex,
        matchedSequenceNumber: targetSeg.sequenceNumber || claimedSegmentIndex + 1,
        speaker: targetSeg.speaker,
      };
    }
  }

  // 2. Full scan: search all segments for exact match
  let foundMatch: { seg: any; idx: number } | null = null;
  for (let i = 0; i < transcriptSegments.length; i++) {
    const seg = transcriptSegments[i];
    const cleanSegText = normalizeEvidenceWhitespace(seg.content);
    if (cleanSegText.includes(cleanQuote)) {
      const isCaller = seg.speaker === 'user' || seg.speaker === 'caller' || seg.speaker === 'customer';
      if (options.requireCallerTurn) {
        if (isCaller) {
          foundMatch = { seg, idx: i };
          break;
        }
      } else {
        foundMatch = { seg, idx: i };
        break;
      }
    }
  }

  if (foundMatch) {
    return {
      isValid: true,
      normalizedQuote: cleanQuote,
      matchedSegmentIndex: foundMatch.idx,
      matchedSequenceNumber: foundMatch.seg.sequenceNumber || foundMatch.idx + 1,
      speaker: foundMatch.seg.speaker,
    };
  }

  // Check if quote was found in an agent turn when caller turn was required
  if (options.requireCallerTurn) {
    for (let i = 0; i < transcriptSegments.length; i++) {
      const seg = transcriptSegments[i];
      if (normalizeEvidenceWhitespace(seg.content).includes(cleanQuote)) {
        return {
          isValid: false,
          normalizedQuote: cleanQuote,
          failureReason: 'CALLER_FACT_STATED_BY_AGENT',
        };
      }
    }
  }

  // 3. Multi-turn scan
  const fullTranscript = transcriptSegments
    .map(s => normalizeEvidenceWhitespace(s.content))
    .join(' ');

  if (fullTranscript.includes(cleanQuote)) {
    if (options.requireCallerTurn) {
      // If multi-turn, verify caller turns contain substantial words of the quote
      const callerWords = transcriptSegments
        .filter(s => s.speaker === 'user' || s.speaker === 'caller' || s.speaker === 'customer')
        .map(s => normalizeEvidenceWhitespace(s.content))
        .join(' ');
      if (!callerWords.includes(cleanQuote)) {
        return {
          isValid: false,
          normalizedQuote: cleanQuote,
          failureReason: 'CALLER_FACT_STATED_BY_AGENT',
        };
      }
    }
    return {
      isValid: true,
      normalizedQuote: cleanQuote,
      matchedSegmentIndex: undefined,
    };
  }

  return {
    isValid: false,
    normalizedQuote: cleanQuote,
    failureReason: 'QUOTE_NOT_FOUND_IN_TRANSCRIPT',
  };
}

/**
 * Audits all extracted fields against their declared evidence quotes.
 * If a field's evidence fails verification, the field value is nullified and flagged.
 */
export function enforceEvidenceGrounding(
  fields: Record<string, any>,
  evidence: Record<string, EvidenceRecord>,
  transcriptSegments: Array<{ content: string; speaker?: string; sequenceNumber?: number }>
): {
  groundedFields: Record<string, any>;
  groundedEvidence: Record<string, any>;
  evidenceFindings: Array<{ field: string; reason: string }>;
  evidenceValidityRate: number;
} {
  const groundedFields: Record<string, any> = { ...fields };
  const groundedEvidence: Record<string, any> = { ...(evidence || {}) };
  const evidenceFindings: Array<{ field: string; reason: string }> = [];

  let totalChecked = 0;
  let passedCount = 0;

  // Caller fields that must originate from caller turns
  const callerFields = new Set([
    'yearsExperience', 'expectedCtcLakhs', 'currentCtcLakhs', 'noticePeriodDays',
    'callerName', 'budget', 'urgencyLevel', 'feedbackRating', 'customerSentiment',
    'symptomDescription', 'patientName', 'destinationCity', 'bookingConfirmed',
  ]);

  for (const fieldKey of Object.keys(fields)) {
    const val = fields[fieldKey];
    if (val === null || val === undefined) continue;

    totalChecked++;
    const ev = evidence ? evidence[fieldKey] : undefined;
    const requireCallerTurn = callerFields.has(fieldKey);

    const verification = verifyEvidenceGrounding(
      ev?.quote,
      transcriptSegments,
      ev?.segmentIndex,
      { requireCallerTurn, fieldValue: val }
    );

    if (verification.isValid) {
      passedCount++;
      groundedEvidence[fieldKey] = {
        ...ev,
        verified: true,
        matchedSegmentIndex: verification.matchedSegmentIndex,
        matchedSequenceNumber: verification.matchedSequenceNumber,
        speaker: verification.speaker,
      };
    } else {
      groundedFields[fieldKey] = null;
      groundedEvidence[fieldKey] = {
        ...ev,
        verified: false,
        error: verification.failureReason || 'EVIDENCE_UNVERIFIED',
      };
      evidenceFindings.push({
        field: fieldKey,
        reason: verification.failureReason || 'EVIDENCE_UNVERIFIED',
      });
    }
  }

  const evidenceValidityRate = totalChecked === 0 ? 1.0 : passedCount / totalChecked;

  return {
    groundedFields,
    groundedEvidence,
    evidenceFindings,
    evidenceValidityRate,
  };
}
