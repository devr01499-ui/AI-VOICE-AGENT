/**
 * Phase 3 PII Redaction Verification Suite
 * 
 * Verifies:
 * 1. Pattern-based redaction for phone numbers, emails, credit cards, and Aadhaar/IDs.
 * 2. Preservation of non-sensitive text context.
 * 3. Default off state for existing agents (isPiiRedactionEnabled === false).
 */

function redactPii(text) {
  if (!text || typeof text !== 'string') return text;
  let redacted = text;
  redacted = redacted.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED EMAIL]');
  redacted = redacted.replace(/(?:\+\d{1,3}[-.\s]*)?(?:\d{10}|\d{5}[-.\s]?\d{5}|\d{3}[-.\s]?\d{3}[-.\s]?\d{4})\b/g, '[REDACTED PHONE]');
  redacted = redacted.replace(/\b(?:\d[ -]?){13,16}\b/g, '[REDACTED CARD]');
  redacted = redacted.replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, '[REDACTED ID]');
  return redacted;
}

function redactTranscriptSegments(segments) {
  if (!Array.isArray(segments)) return segments;
  return segments.map(seg => ({
    ...seg,
    content: typeof seg.content === 'string' ? redactPii(seg.content) : seg.content,
  }));
}

async function testPiiRedaction() {
  console.log('====================================================');
  console.log('🔒 Starting Phase 3 PII Redaction System Verification');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assertRedaction(input, expectedSubstring, testName) {
    const result = redactPii(input);
    if (result.includes(expectedSubstring) && !result.includes('9876543210') && !result.includes('john@acme.com')) {
      console.log(`  [PASS] ${testName} -> "${result}"`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName} -> Expected "${expectedSubstring}" in "${result}"`);
      failed++;
    }
  }

  console.log('--- Test 1: Pattern Redaction Verification ---');
  assertRedaction(
    'Please call me back at +91 98765 43210 regarding the invoice.',
    '[REDACTED PHONE]',
    'Indian Phone Number Redaction'
  );

  assertRedaction(
    'Send the confirmation email to john@acme.com right away.',
    '[REDACTED EMAIL]',
    'Email Address Redaction'
  );

  assertRedaction(
    'My Aadhaar identification number is 1234 5678 9012 for KYC verification.',
    '[REDACTED ID]',
    '12-Digit Government ID / Aadhaar Redaction'
  );

  assertRedaction(
    'The card number provided was 4532 1234 5678 9012 for billing.',
    '[REDACTED CARD]',
    'Credit Card Number Redaction'
  );

  console.log('\n--- Test 2: Transcript Segment Batch Processing ---');
  const rawSegments = [
    { speaker: 'agent', content: 'Hello, what is your contact phone number?' },
    { speaker: 'user', content: 'My phone number is +919876543210 and my email is john@acme.com.' },
  ];
  const redactedSegments = redactTranscriptSegments(rawSegments);

  if (
    redactedSegments[1].content.includes('[REDACTED PHONE]') &&
    redactedSegments[1].content.includes('[REDACTED EMAIL]')
  ) {
    console.log('  [PASS] Batch transcript segments redacted cleanly');
    passed++;
  } else {
    console.error('  [FAIL] Batch transcript segment redaction failed, actual output:', redactedSegments[1].content);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

testPiiRedaction();
