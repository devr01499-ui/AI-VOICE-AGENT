/**
 * Verification test for ITEM 0: Plivo Inbound Call Routing
 * 
 * Verifies that incoming calls from Plivo to a registered number:
 * 1. Correctly parse normalized payload fields.
 * 2. Invoke InboundCallService.handleInboundCall.
 * 3. Create a Call row with callDirection='inbound', fromPhoneNumber=business number, recipientPhoneNumber=caller.
 * 4. Return valid Plivo Stream XML.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const assert = require('assert');
const { CallController } = require('../dist/controllers/CallController');
const { prisma } = require('../dist/lib/prisma');

async function run() {
  console.log('================================================================================');
  console.log('🧪 ITEM 0 VERIFICATION: PLIVO INBOUND CALL HANDLING');
  console.log('================================================================================');

  const testCallUuid = 'test_plivo_inbound_' + Date.now();
  const callerNumber = '+919876543210';
  const businessNumber = '+918065530386'; // Registered Plivo number in DB

  // 1. Verify normalizer
  const fakeReq = {
    method: 'POST',
    query: {},
    body: {
      CallUUID: testCallUuid,
      From: callerNumber,
      To: businessNumber,
      Direction: 'inbound',
      CallStatus: 'ringing',
    },
    protocol: 'http',
    headers: { host: 'localhost:3001' },
  };

  const normalized = CallController.normalizePlivoPayload(fakeReq);
  assert.strictEqual(normalized.callUuid, testCallUuid, 'callUuid mismatch');
  assert.strictEqual(normalized.from, callerNumber, 'from mismatch');
  assert.strictEqual(normalized.to, businessNumber, 'to mismatch');
  assert.strictEqual(normalized.direction, 'inbound', 'direction must be inbound');
  console.log('✓ Normalizer parsed Plivo payload correctly');

  // 2. Mock Response object
  let statusCode = 200;
  let responseXml = '';
  let responseHeaders = {};

  const fakeRes = {
    set: (k, v) => {
      responseHeaders[k] = v;
      return fakeRes;
    },
    status: (code) => {
      statusCode = code;
      return fakeRes;
    },
    send: (body) => {
      responseXml = body;
      return fakeRes;
    },
  };

  // 3. Execute handlePlivoAnswer
  await CallController.handlePlivoAnswer(fakeReq, fakeRes, (err) => {
    if (err) throw err;
  });

  console.log('✓ handlePlivoAnswer executed successfully');
  console.log('Response XML snippet:', responseXml.substring(0, 200) + '...');

  assert.strictEqual(statusCode, 200, 'Status code must be 200');
  assert(responseXml.includes('<Stream'), 'Response must contain <Stream>');
  assert(responseXml.includes('extraHeaders="callId='), 'Response must have extraHeaders containing callId');

  // 4. Extract callId from XML
  const callIdMatch = responseXml.match(/callId=([a-zA-Z0-9-]+)/);
  assert(callIdMatch && callIdMatch[1], 'Could not extract callId from Stream extraHeaders');
  const createdCallId = decodeURIComponent(callIdMatch[1]);
  console.log(`✓ Call ID extracted: ${createdCallId}`);

  // 5. Query database Call row
  const callRow = await prisma.call.findUnique({
    where: { id: createdCallId },
  });

  assert(callRow, 'Call row must exist in database');
  console.log('Database Call row verified:');
  console.log('  id:', callRow.id);
  console.log('  callDirection:', callRow.callDirection);
  console.log('  fromPhoneNumber (Business):', callRow.fromPhoneNumber);
  console.log('  recipientPhoneNumber (Caller):', callRow.recipientPhoneNumber);
  console.log('  telemetryId:', callRow.telemetryId);
  console.log('  status:', callRow.status);

  assert.strictEqual(callRow.callDirection, 'inbound', 'callDirection must be inbound');
  assert.strictEqual(callRow.fromPhoneNumber, businessNumber, 'fromPhoneNumber must be business number');
  assert.strictEqual(callRow.recipientPhoneNumber, callerNumber, 'recipientPhoneNumber must be caller number');
  assert.strictEqual(callRow.telemetryId, testCallUuid, 'telemetryId must match Plivo CallUUID');

  // Cleanup test call record
  await prisma.call.delete({ where: { id: createdCallId } });
  console.log('✓ Cleaned up test call row');

  console.log('================================================================================');
  console.log('🎉 ITEM 0 TEST PASSED: Plivo inbound routing verified successfully');
  console.log('================================================================================');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ ITEM 0 TEST FAILED:', err);
  process.exit(1);
});
