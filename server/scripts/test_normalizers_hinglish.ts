/**
 * test_normalizers_hinglish.ts — Comprehensive Test Table for Deterministic Normalizers
 *
 * Verifies Section 5.6:
 * - Currency and Numbers: Lakh, Crore, Devanagari (०-९), and Hinglish words.
 * - Dates: Relative expressions ('kal', 'parson', 'next Monday') in Asia/Kolkata; past dates rejected.
 * - Durations: 'ek mahina', 'two weeks', 'immediate' -> normalized to days.
 * - Identifiers: Phone numbers, emails, Indian 6-digit postal PIN codes.
 * - Enums: Allowed list enforcement.
 */

import {
  normalizeDevanagariDigits,
  normalizeMoneyOrNumber,
  normalizeDate,
  normalizeDurationDays,
  validatePhoneNumber,
  validateEmail,
  validatePostalPinCode,
  validateEnum,
} from '../src/utils/reportNormalizers';

let passed = 0;
let failed = 0;

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`  ✔ PASS: ${desc}`);
    passed++;
  } else {
    console.error(`  ✖ FAIL: ${desc}`);
    failed++;
  }
}

function runTests() {
  console.log('===============================================================');
  console.log('CLARITIY VOICE — HINGLISH NORMALIZERS & VALIDATORS SUITE');
  console.log('===============================================================\n');

  console.log('--- GROUP 1: CURRENCY & NUMBERS (Lakh, Crore, Hinglish, Devanagari) ---');
  assert(normalizeDevanagariDigits('१२३४५') === '12345', 'Devanagari digits १२३४५ converted to 12345');
  assert(normalizeMoneyOrNumber('5 lakh').value === 500000, "'5 lakh' normalizes to 500,000 INR");
  assert(normalizeMoneyOrNumber('1.5 crore').value === 15000000, "'1.5 crore' normalizes to 15,000,000 INR");
  assert(normalizeMoneyOrNumber('₹ 25,000').value === 25000, "'₹ 25,000' normalizes to 25,000 INR");
  assert(normalizeMoneyOrNumber('paanch lakh').value === 500000, "'paanch lakh' normalizes to 500,000 INR");
  assert(normalizeMoneyOrNumber('do crore').value === 20000000, "'do crore' normalizes to 20,000,000 INR");
  assert(normalizeMoneyOrNumber('pachaas hazaar').value === 50000, "'pachaas hazaar' normalizes to 50,000 INR");
  assert(normalizeMoneyOrNumber('१० lakh').value === 1000000, "'१० lakh' (Devanagari 10) normalizes to 1,000,000 INR");
  assert(normalizeMoneyOrNumber('invalid string').value === null, 'Non-numeric string returns null');

  console.log('\n--- GROUP 2: RELATIVE DATES & ASIA/KOLKATA RESOLUTION ---');
  // Fixed reference date: Wednesday, 2026-10-28 12:00:00 UTC
  const refDate = new Date('2026-10-28T12:00:00Z');

  const kal = normalizeDate('kal', refDate);
  assert(kal.date === '2026-10-29', "'kal' resolves to tomorrow's date (2026-10-29)");

  const parson = normalizeDate('parson', refDate);
  assert(parson.date === '2026-10-30', "'parson' resolves to day after tomorrow (2026-10-30)");

  const nextMon = normalizeDate('next monday', refDate);
  assert(nextMon.date === '2026-11-02', "'next monday' resolves to 2026-11-02");

  const pastDate = normalizeDate('2025-01-01', refDate);
  assert(pastDate.date === null && pastDate.error === 'PROMISED_DATE_IN_PAST', 'Promised date in the past is rejected');

  console.log('\n--- GROUP 3: DURATIONS TO DAYS ---');
  assert(normalizeDurationDays('immediate').days === 0, "'immediate' normalizes to 0 days");
  assert(normalizeDurationDays('turant').days === 0, "'turant' normalizes to 0 days");
  assert(normalizeDurationDays('two weeks').days === 14, "'two weeks' normalizes to 14 days");
  assert(normalizeDurationDays('ek mahina').days === 30, "'ek mahina' normalizes to 30 days");
  assert(normalizeDurationDays('teen mahine').days === 90, "'teen mahine' normalizes to 90 days");
  assert(normalizeDurationDays('1 saal').days === 365, "'1 saal' normalizes to 365 days");

  console.log('\n--- GROUP 4: IDENTIFIERS (Phone, Email, Indian PIN Code) ---');
  assert(validatePhoneNumber('9876543210').phone === '+919876543210', '10-digit mobile normalizes to +919876543210');
  assert(validatePhoneNumber('+91 98765 43210').phone === '+919876543210', 'Formatted +91 number normalizes cleanly');
  assert(validatePhoneNumber('09876543210').phone === '+919876543210', 'Leading 0 number normalizes to +919876543210');
  assert(validatePhoneNumber('12345').phone === null, 'Short invalid phone number returns null');

  assert(validateEmail('test.lead@claritiy.com').email === 'test.lead@claritiy.com', 'Valid email passes');
  assert(validateEmail('invalid-email-address').email === null, 'Invalid email returns null');

  assert(validatePostalPinCode('560038').pinCode === '560038', 'Valid Bangalore PIN code 560038 passes');
  assert(validatePostalPinCode('011234').pinCode === null, 'PIN code starting with 0 is rejected');
  assert(validatePostalPinCode('5600').pinCode === null, 'Short 4-digit PIN is rejected');

  console.log('\n--- GROUP 5: ENUMS VALIDATION ---');
  const allowed = ['Sales', 'Technical Support', 'Billing', 'General'];
  assert(validateEnum('sales', allowed).value === 'Sales', "Case-insensitive 'sales' normalizes to 'Sales'");
  assert(validateEnum('billing', allowed).value === 'Billing', "Case-insensitive 'billing' normalizes to 'Billing'");
  assert(validateEnum('UnknownDept', allowed).value === null, "Out-of-range value returns null with error flag");

  console.log('\n===============================================================');
  console.log(`NORMALIZER TESTS: ${passed}/${passed + failed} PASSED (${((passed / (passed + failed)) * 100).toFixed(1)}%)`);
  console.log('===============================================================\n');

  process.exit(failed === 0 ? 0 : 1);
}

runTests();
