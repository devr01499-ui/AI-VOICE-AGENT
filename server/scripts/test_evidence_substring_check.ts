/**
 * test_evidence_substring_check.ts — Verbatim Evidence Grounding Verification Suite
 *
 * Implements Section 5.5:
 * - Checks verbatim substring matching (normalizing whitespace only).
 * - Verifies quote found in specific turn, across turns, or fails cleanly.
 * - Confirms ungrounded fields are set to null and audit finding attached.
 * - Asserts 100% evidence validity rate requirement after enforcement.
 */

import {
  verifyEvidenceGrounding,
  enforceEvidenceGrounding,
} from '../src/utils/evidenceValidator';

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
  console.log('CLARITIY VOICE — EVIDENCE SUBSTRING GROUNDING SUITE');
  console.log('===============================================================\n');

  const transcript = [
    { content: "Hello! Thank you for calling Claritiy Voice.", sequenceNumber: 0 },
    { content: "Hi, I am calling from Infosys Bangalore. My name is Vikram.", sequenceNumber: 1 },
    { content: "Great to connect Vikram! How many calls does your team make monthly?", sequenceNumber: 2 },
    { content: "We do approximately 50,000 calls per month across our support desk.", sequenceNumber: 3 },
    { content: "Can we schedule a demo for this Friday at 4 PM?", sequenceNumber: 4 },
    { content: "Yes, Friday 4 PM works perfectly for me. Send the invite.", sequenceNumber: 5 },
  ];

  // Test 1: Exact verbatim substring in claimed segment
  const check1 = verifyEvidenceGrounding("50,000 calls per month", transcript, 3);
  assert(check1.isValid && check1.matchedSegmentIndex === 3, "Exact verbatim quote matches claimed segment index 3");

  // Test 2: Whitespace tolerance (newlines, extra spaces)
  const check2 = verifyEvidenceGrounding("50,000   calls\nper   month", transcript, 3);
  assert(check2.isValid && check2.matchedSegmentIndex === 3, "Quote with arbitrary whitespace/newlines matches successfully");

  // Test 3: Segment index omission (scans full transcript)
  const check3 = verifyEvidenceGrounding("calling from Infosys Bangalore", transcript);
  assert(check3.isValid && check3.matchedSegmentIndex === 1, "Quote without claimed index correctly discovers segment index 1");

  // Test 4: Hallucinated / fabricated quote
  const check4 = verifyEvidenceGrounding("we have two hundred employees", transcript);
  assert(!check4.isValid && check4.failureReason === 'QUOTE_NOT_FOUND_IN_TRANSCRIPT', "Fabricated quote is rejected with QUOTE_NOT_FOUND_IN_TRANSCRIPT");

  // Test 5: Full enforcement audit
  const fields = {
    companyName: 'Infosys',
    monthlyVolume: 50000,
    teamSize: 200, // Fabricated!
  };
  const evidence = {
    companyName: { quote: 'from Infosys Bangalore', segmentIndex: 1 },
    monthlyVolume: { quote: '50,000 calls per month', segmentIndex: 3 },
    teamSize: { quote: 'we have two hundred employees', segmentIndex: 0 }, // Fake quote!
  };

  const enforcement = enforceEvidenceGrounding(fields, evidence, transcript);

  assert(enforcement.groundedFields.companyName === 'Infosys', "Valid field 'companyName' retained");
  assert(enforcement.groundedFields.monthlyVolume === 50000, "Valid field 'monthlyVolume' retained");
  assert(enforcement.groundedFields.teamSize === null, "Fabricated field 'teamSize' nullified by grounding engine");
  assert(enforcement.evidenceFindings.length === 1 && enforcement.evidenceFindings[0].field === 'teamSize', "Audit finding recorded for unverified field");
  assert(enforcement.evidenceValidityRate === 2 / 3, "Evidence validity rate calculated accurately (66.7%)");

  console.log('\n===============================================================');
  console.log(`EVIDENCE TESTS: ${passed}/${passed + failed} PASSED (${((passed / (passed + failed)) * 100).toFixed(1)}%)`);
  console.log('===============================================================\n');

  process.exit(failed === 0 ? 0 : 1);
}

runTests();
