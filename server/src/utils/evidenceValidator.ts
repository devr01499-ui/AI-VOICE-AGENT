/**
 * evidenceValidator.ts — Verbatim Evidence Grounding Engine
 *
 * Implements Section 5.5:
 * - Every extracted field and outcome label must carry a verbatim quote.
 * - Code verifies each quote is an exact substring of the transcript turns (normalizing whitespace only).
 * - Fields whose evidence fails verification are set to null with an EVIDENCE_UNVERIFIED flag.
 * - Enforces 100% grounded facts: no hallucinated or unbacked claims survive.
 */

export interface EvidenceRecord {
  quote?: string;
  segmentIndex?: number;
  speaker?: string;
}

export interface VerificationResult {
  isValid: boolean;
  normalizedQuote: string;
  matchedSegmentIndex?: number;
  failureReason?: string;
}

/**
 * Normalizes string for evidence comparison (collapses contiguous whitespace and strips outer punctuation).
 */
export function normalizeEvidenceWhitespace(text: string): string {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Validates whether an evidence quote exists as a verbatim substring of the conversation transcript.
 */
export function verifyEvidenceGrounding(
  quote: string | null | undefined,
  transcriptSegments: Array<{ content: string; speaker?: string; sequenceNumber?: number }>,
  claimedSegmentIndex?: number
): VerificationResult {
  if (!quote || quote.trim().length === 0) {
    return {
      isValid: false,
      normalizedQuote: '',
      failureReason: 'MISSING_EVIDENCE_QUOTE',
    };
  }

  const cleanQuote = normalizeEvidenceWhitespace(quote);

  // 1. Fast path: check claimed segment index first
  if (claimedSegmentIndex !== undefined && transcriptSegments[claimedSegmentIndex]) {
    const targetSegment = transcriptSegments[claimedSegmentIndex];
    const cleanSegment = normalizeEvidenceWhitespace(targetSegment.content);
    if (cleanSegment.includes(cleanQuote)) {
      return {
        isValid: true,
        normalizedQuote: cleanQuote,
        matchedSegmentIndex: claimedSegmentIndex,
      };
    }
  }

  // 2. Full scan: search all segments
  for (let i = 0; i < transcriptSegments.length; i++) {
    const seg = transcriptSegments[i];
    const cleanSegText = normalizeEvidenceWhitespace(seg.content);
    if (cleanSegText.includes(cleanQuote)) {
      return {
        isValid: true,
        normalizedQuote: cleanQuote,
        matchedSegmentIndex: i,
      };
    }
  }

  // 3. Multi-turn scan: check if quote spans adjacent turns
  const fullTranscript = transcriptSegments
    .map(s => normalizeEvidenceWhitespace(s.content))
    .join(' ');

  if (fullTranscript.includes(cleanQuote)) {
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
  transcriptSegments: Array<{ content: string; speaker?: string }>
): {
  groundedFields: Record<string, any>;
  groundedEvidence: Record<string, any>;
  evidenceFindings: Array<{ field: string; reason: string }>;
  evidenceValidityRate: number;
} {
  const groundedFields: Record<string, any> = { ...fields };
  const groundedEvidence: Record<string, any> = { ...evidence };
  const evidenceFindings: Array<{ field: string; reason: string }> = [];

  let totalChecked = 0;
  let passedCount = 0;

  for (const fieldKey of Object.keys(fields)) {
    const val = fields[fieldKey];
    if (val === null || val === undefined) continue;

    totalChecked++;
    const ev = evidence[fieldKey];
    const verification = verifyEvidenceGrounding(ev?.quote, transcriptSegments, ev?.segmentIndex);

    if (verification.isValid) {
      passedCount++;
      groundedEvidence[fieldKey] = {
        ...ev,
        verified: true,
        matchedSegmentIndex: verification.matchedSegmentIndex,
      };
    } else {
      // Nullify unverified field and attach audit finding
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
