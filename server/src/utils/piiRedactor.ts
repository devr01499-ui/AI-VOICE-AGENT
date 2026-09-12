/**
 * piiRedactor.ts — Pattern-based PII Redaction Engine
 * 
 * Safely redacts phone numbers, email addresses, credit cards, and government ID numbers
 * from call transcripts and export payloads.
 */

export function redactPii(text: string): string {
  if (!text || typeof text !== 'string') return text;

  let redacted = text;

  // 1. Email Addresses
  redacted = redacted.replace(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    '[REDACTED EMAIL]'
  );

  // 2. Phone Numbers (Indian 10-digit / 5-5 / +91 and standard formats)
  redacted = redacted.replace(
    /(?:\+\d{1,3}[-.\s]*)?(?:\d{10}|\d{5}[-.\s]?\d{5}|\d{3}[-.\s]?\d{3}[-.\s]?\d{4})\b/g,
    '[REDACTED PHONE]'
  );

  // 3. Credit Card Numbers (13 to 16 digits with optional spaces/dashes)
  redacted = redacted.replace(
    /\b(?:\d[ -]?){13,16}\b/g,
    '[REDACTED CARD]'
  );

  // 4. Indian Aadhaar / 12-digit government IDs (4-4-4 format or 12 digits)
  redacted = redacted.replace(
    /\b\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
    '[REDACTED ID]'
  );

  return redacted;
}

export function redactTranscriptSegments(segments: Array<{ speaker: string; content: string; [key: string]: any }>): Array<any> {
  if (!Array.isArray(segments)) return segments;
  return segments.map(seg => ({
    ...seg,
    content: typeof seg.content === 'string' ? redactPii(seg.content) : seg.content,
  }));
}
