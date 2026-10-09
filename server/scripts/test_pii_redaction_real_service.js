const assert = require('assert');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { prisma } = require('../dist/lib/prisma');
const { CallService } = require('../dist/services/CallService');

async function run() {
  console.log('--- Testing Real PII Redaction in CallService.getCallTranscript against Database ---');

  const testUserId = `test-pii-user-${Date.now()}`;
  const testAgentId = `test-pii-agent-${Date.now()}`;
  const testCallId = `test-pii-call-${Date.now()}`;

  const sensitivePhone = '+91 98765 43210';
  const sensitiveEmail = 'customer.vip@enterprise.com';
  const sensitiveAadhaar = '1234 5678 9012';

  try {
    // 1. Create real User, Agent (isPiiRedactionEnabled: false initially), and Call
    await prisma.user.create({
      data: {
        id: testUserId,
        email: `pii-${Date.now()}@example.com`,
        passwordHash: 'dummy',
        fullName: 'PII Test User',
      },
    });

    await prisma.agent.create({
      data: {
        id: testAgentId,
        userId: testUserId,
        name: 'PII Sensitive Agent',
        isPiiRedactionEnabled: false,
      },
    });

    await prisma.call.create({
      data: {
        id: testCallId,
        userId: testUserId,
        agentId: testAgentId,
        recipientPhoneNumber: '+919876543210',
        status: 'completed',
        callDirection: 'outbound',
      },
    });

    // 2. Create raw transcript segments containing sensitive customer details
    await prisma.transcriptSegment.createMany({
      data: [
        {
          callId: testCallId,
          speaker: 'agent',
          content: 'Hello, please confirm your contact details for verification.',
          sequenceNumber: 1,
          startTime: 0.0,
          endTime: 2.5,
        },
        {
          callId: testCallId,
          speaker: 'user',
          content: `My phone is ${sensitivePhone}, my email is ${sensitiveEmail}, and my Aadhaar ID is ${sensitiveAadhaar}.`,
          sequenceNumber: 2,
          startTime: 3.0,
          endTime: 7.2,
        },
      ],
    });

    // Sub-test 1: With isPiiRedactionEnabled = false, raw content is returned
    console.log('\n[Sub-test 1] Calling CallService.getCallTranscript with isPiiRedactionEnabled = false...');
    const unredactedSegments = await CallService.getCallTranscript(testCallId);
    assert.strictEqual(unredactedSegments.length, 2);
    assert.ok(
      unredactedSegments[1].content.includes('98765 43210'),
      'Raw transcript must retain sensitive info when redaction is disabled'
    );
    assert.ok(
      unredactedSegments[1].content.includes(sensitiveEmail),
      'Raw email must be visible when disabled'
    );
    console.log('✓ Transcript returned unmasked when agent PII redaction is disabled');

    // Sub-test 2: Enable isPiiRedactionEnabled on Agent in database
    console.log('\n[Sub-test 2] Updating Agent.isPiiRedactionEnabled = true in PostgreSQL...');
    await prisma.agent.update({
      where: { id: testAgentId },
      data: { isPiiRedactionEnabled: true },
    });

    const redactedSegments = await CallService.getCallTranscript(testCallId);
    assert.strictEqual(redactedSegments.length, 2);
    assert.ok(
      redactedSegments[1].content.includes('[REDACTED PHONE]'),
      'Phone must be masked with [REDACTED PHONE]'
    );
    assert.ok(
      redactedSegments[1].content.includes('[REDACTED EMAIL]'),
      'Email must be masked with [REDACTED EMAIL]'
    );
    assert.ok(
      redactedSegments[1].content.includes('[REDACTED ID]'),
      'Aadhaar ID must be masked with [REDACTED ID]'
    );
    assert.strictEqual(
      redactedSegments[1].content.includes('98765 43210'),
      false,
      'Raw phone must not appear in redacted output'
    );
    assert.strictEqual(
      redactedSegments[1].content.includes(sensitiveEmail),
      false,
      'Raw email must not appear in redacted output'
    );
    console.log('✓ CallService.getCallTranscript masked phone, email, and ID cleanly:', redactedSegments[1].content);

    // Sub-test 3: Non-destructive verification (database record remains uncorrupted)
    console.log('\n[Sub-test 3] Verifying database integrity (non-destructive delivery-time masking)...');
    const rawDbSegment = await prisma.transcriptSegment.findFirst({
      where: { callId: testCallId, sequenceNumber: 2 },
    });
    assert.ok(
      rawDbSegment.content.includes(sensitiveEmail),
      'Underlying database record must remain untouched for audit & compliance retention'
    );
    console.log('✓ Underlying PostgreSQL transcriptSegment row preserved unmodified in database');

    console.log('\n✅ All Real PII Redaction tests passed successfully against real application service & database!');
  } finally {
    await prisma.transcriptSegment.deleteMany({ where: { callId: testCallId } });
    await prisma.call.deleteMany({ where: { id: testCallId } });
    await prisma.agent.deleteMany({ where: { id: testAgentId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
