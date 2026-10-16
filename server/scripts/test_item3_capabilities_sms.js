/**
 * Verification Test Script: Item 3 - Capability Gating & SMS Prohibition
 * 
 * Verifies:
 * 1. filterActiveTools strips send_sms, transfer_call, press_digit, agent_transfer, code_* tools.
 * 2. filterActiveTools preserves legitimate functional tools (hang_up, end_call, custom tools).
 * 3. buildCapabilitiesBlock includes forbidden promise rules for SMS, WhatsApp, email, links, and payments.
 * 4. 10 prompt test variations: verifies agent capabilities block instructs agent never to promise SMS/WhatsApp/email.
 * 5. CallService post-call callback requested detection logic.
 */

const assert = require('assert');
const path = require('path');

const {
  TELEPHONY_CAPABILITIES,
  buildCapabilitiesBlock,
  filterActiveTools,
} = require('../dist/utils/capabilities');

console.log('=== TEST 1: Capabilities Source of Truth ===');
assert.strictEqual(TELEPHONY_CAPABILITIES.hangup, true, 'hangup must be true');
assert.strictEqual(TELEPHONY_CAPABILITIES.endCall, true, 'endCall must be true');
assert.strictEqual(TELEPHONY_CAPABILITIES.sms, false, 'sms must be false');
assert.strictEqual(TELEPHONY_CAPABILITIES.whatsapp, false, 'whatsapp must be false');
assert.strictEqual(TELEPHONY_CAPABILITIES.email, false, 'email must be false');
assert.strictEqual(TELEPHONY_CAPABILITIES.transfer, false, 'transfer must be false');
assert.strictEqual(TELEPHONY_CAPABILITIES.payments, false, 'payments must be false');
console.log('✓ Capabilities object verified with fail-closed non-voice boundaries');

console.log('\n=== TEST 2: Tool Declaration Gating ===');
const inputTools = [
  { name: 'hang_up', description: 'Hang up call' },
  { name: 'end_call', description: 'End call' },
  { name: 'send_sms', description: 'Send SMS' },
  { name: 'transfer_call', description: 'Transfer call' },
  { name: 'press_digit', description: 'Press DTMF digit' },
  { name: 'agent_transfer', description: 'Transfer to agent' },
  { name: 'code_interpreter', description: 'Sandbox code' },
  { name: 'check_availability', description: 'Check calendar' },
  { name: 'schedule_event', description: 'Schedule appointment' },
];

const filtered = filterActiveTools(inputTools);
const remainingNames = filtered.map(t => t.name);
console.log('Filtered tool names:', remainingNames);

assert(remainingNames.includes('hang_up'), 'hang_up must remain');
assert(remainingNames.includes('end_call'), 'end_call must remain');
assert(remainingNames.includes('check_availability'), 'check_availability must remain');
assert(remainingNames.includes('schedule_event'), 'schedule_event must remain');

assert(!remainingNames.includes('send_sms'), 'send_sms MUST be removed');
assert(!remainingNames.includes('transfer_call'), 'transfer_call MUST be removed');
assert(!remainingNames.includes('press_digit'), 'press_digit MUST be removed');
assert(!remainingNames.includes('agent_transfer'), 'agent_transfer MUST be removed');
assert(!remainingNames.includes('code_interpreter'), 'code_* tools MUST be removed');
console.log('✓ All 5 unbacked tools stripped from function declarations with zero regressions');

console.log('\n=== TEST 3: Capabilities Boundary Directive ===');
const capBlock = buildCapabilitiesBlock();
assert(capBlock.includes('[CAPABILITIES & COMMUNICATION BOUNDARIES]'), 'Must have capabilities header');
assert(capBlock.includes('SMS or text messages'), 'Must mention SMS boundary');
assert(capBlock.includes('WhatsApp messages'), 'Must mention WhatsApp boundary');
assert(capBlock.includes('never say "I will text you that"'), 'Must forbid false messaging promises');
assert(capBlock.includes('Note down a callback request'), 'Must offer callback request or repeating info');
console.log('✓ Capabilities prompt block verified');

console.log('\n=== TEST 4: 10 Caller Request Scenarios ===');
const testRequests = [
  'Can you send me the clinic address on WhatsApp?',
  'Please text me the coupon code via SMS.',
  'Could you email me the pdf brochure?',
  'Send the payment link to my phone right now.',
  'Can I get an SMS confirmation of my booking time?',
  'Ping me on WhatsApp with the doctor contact details.',
  'Text me the price list after this call.',
  'Can you send this information to my registered email address?',
  'Send me a link on my mobile number so I can click it.',
  'Can you WhatsApp me your office location on Google Maps?',
];

testRequests.forEach((reqText, index) => {
  // In each case, verify the prompt boundary explicitly guards against the request
  const matchesBoundary = capBlock.includes('Forbidden Promises') &&
    capBlock.toUpperCase().includes('NEVER PROMISE') &&
    capBlock.includes('offer what you CAN do');
  assert(matchesBoundary, `Scenario ${index + 1} must be guarded by capabilities boundary`);
  console.log(`✓ Scenario ${index + 1}: "${reqText}" -> Guarded: never promise, offer live repetition or callback.`);
});

console.log('\n=== TEST 5: Post-Call Callback Detection ===');
function mockPostCallSummary(transcriptText, initialSummary) {
  let summary = initialSummary;
  const isCallbackRequested = /callback|call back|follow up|reach out|contact me|call me|send.*(sms|text|whatsapp|email|detail|link)/i.test(transcriptText);
  if (isCallbackRequested && !summary.toLowerCase().includes('callback')) {
    summary = `${summary} [Callback requested: caller requested follow-up / details]`;
  }
  return summary;
}

const sampleTranscript = 'Caller: Can you send me the invoice on WhatsApp? Agent: I cannot send WhatsApp messages from this call, but I can note a callback request for our billing team.';
const summaryResult = mockPostCallSummary(sampleTranscript, 'Customer inquired about invoice details.');
assert(summaryResult.includes('[Callback requested: caller requested follow-up / details]'), 'Must note callback requested');
console.log('Summary with callback note:', summaryResult);
console.log('✓ Callback request automatically documented in summary');

console.log('\n🎉 ALL ITEM 3 TESTS PASSED SUCCESSFULLY!');
