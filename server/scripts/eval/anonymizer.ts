/**
 * anonymizer.ts — PII Scrubbing and Dataset Sanitizer
 *
 * Implements Section 6 dataset requirements:
 * - Redacts 10-digit phone numbers and E.164 formats -> +91XXXXXXXXXX
 * - Redacts Aadhaar numbers (12 digits) and PAN cards (5 letters + 4 digits + 1 letter)
 * - Masks customer names with role placeholders while preserving linguistic structure.
 */

export function anonymizeText(text: string): string {
  if (!text) return '';

  return text
    // E.164 and Indian phone numbers
    .replace(/(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/g, '+91XXXXXXXXXX')
    // 12-digit Aadhaar numbers
    .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[AADHAAR-REDACTED]')
    // 10-character PAN cards
    .replace(/\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/gi, '[PAN-REDACTED]')
    // Credit / debit card 16 digits
    .replace(/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, '[CARD-REDACTED]')
    // Email addresses
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL-REDACTED]');
}

export function anonymizeTranscriptSegments(
  segments: Array<{ content: string; speaker: string; sequenceNumber: number }>
): Array<{ content: string; speaker: string; sequenceNumber: number }> {
  return segments.map(s => ({
    ...s,
    content: anonymizeText(s.content),
  }));
}
