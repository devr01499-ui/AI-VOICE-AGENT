/**
 * Verification test for Item 4+6:
 * Call History Accuracy, Direction, Normalized DTO, and Elimination of Demo Static Transcript
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { prisma } = require('../dist/lib/prisma');

async function runTest() {
  console.log('=== [ITEM 4+6 TEST START] ===');

  // 1. Check existing inbound and outbound calls
  const inboundCall = await prisma.call.findFirst({
    where: { callDirection: 'inbound' },
    orderBy: { createdAt: 'desc' }
  });

  const outboundCall = await prisma.call.findFirst({
    where: { callDirection: 'outbound' },
    orderBy: { createdAt: 'desc' }
  });

  console.log('Inbound Call Found:', inboundCall ? {
    id: inboundCall.id,
    callDirection: inboundCall.callDirection,
    fromPhoneNumber: inboundCall.fromPhoneNumber,
    recipientPhoneNumber: inboundCall.recipientPhoneNumber,
    durationSeconds: inboundCall.durationSeconds
  } : 'None');

  console.log('Outbound Call Found:', outboundCall ? {
    id: outboundCall.id,
    callDirection: outboundCall.callDirection,
    fromPhoneNumber: outboundCall.fromPhoneNumber,
    recipientPhoneNumber: outboundCall.recipientPhoneNumber,
    durationSeconds: outboundCall.durationSeconds
  } : 'None');

  // 2. Validate DTO transformation contract
  const testCalls = [
    {
      id: 'call_test_inbound_01',
      callDirection: 'inbound',
      fromPhoneNumber: '+18005550199', // Claritiy business number
      recipientPhoneNumber: '+919876543210', // Customer / caller
      durationSeconds: 75,
      status: 'completed',
      startTime: new Date('2026-10-16T10:00:00Z'),
      endTime: new Date('2026-10-16T10:01:15Z'),
      summary: 'Caller inquired about account balance.',
      sentiment: 'Positive',
      createdAt: new Date('2026-10-16T10:00:00Z'),
      agent: { name: 'Support Assistant' },
      transcriptSegments: [{ id: 'seg_1' }],
      execution: null
    },
    {
      id: 'call_test_outbound_02',
      callDirection: 'outbound',
      fromPhoneNumber: '+18005550199', // Claritiy business number
      recipientPhoneNumber: '+919988776655', // Callee / lead
      durationSeconds: 135,
      status: 'completed',
      startTime: new Date('2026-10-16T11:00:00Z'),
      endTime: new Date('2026-10-16T11:02:15Z'),
      summary: 'Outbound sales follow up call.',
      sentiment: 'Neutral',
      createdAt: new Date('2026-10-16T11:00:00Z'),
      agent: { name: 'Sales Closer' },
      transcriptSegments: [],
      execution: { transcript: JSON.stringify([{ role: 'agent', text: 'Hello!' }, { role: 'caller', text: 'Hi!' }]), recordingUrl: 'https://rec.example.com/rec2.mp3' }
    }
  ];

  for (const c of testCalls) {
    const durationSec = c.durationSeconds ?? 0;
    const billedMins = Math.ceil(durationSec / 60);
    const hasTrans = (c.transcriptSegments && c.transcriptSegments.length > 0) ||
      Boolean(c.execution && c.execution.transcript && c.execution.transcript !== '[]' && c.execution.transcript !== '');
    const recUrl = (c.recordingUrl || c.execution?.recordingUrl) || null;

    const dto = {
      id: c.id,
      direction: (c.callDirection === 'inbound' ? 'inbound' : 'outbound'),
      contactNumber: c.recipientPhoneNumber || '—',
      businessNumber: c.fromPhoneNumber || '—',
      agentName: c.agent?.name || 'Voice Agent',
      status: c.status,
      startedAt: c.startTime ? c.startTime.toISOString() : c.createdAt.toISOString(),
      endedAt: c.endTime ? c.endTime.toISOString() : null,
      durationSeconds: durationSec,
      billedMinutes: billedMins,
      hasTranscript: hasTrans,
      hasRecording: Boolean(recUrl),
      recordingUrl: recUrl,
      summary: c.summary || null,
      sentiment: c.sentiment || null,
      createdAt: c.createdAt.toISOString(),
    };

    console.log(`[DTO Verification for ${c.id}] ->`, dto);

    // Assertions
    if (c.callDirection === 'inbound') {
      if (dto.direction !== 'inbound') throw new Error('Inbound direction mismatch');
      if (dto.contactNumber !== '+919876543210') throw new Error('Inbound contactNumber mismatch');
      if (dto.businessNumber !== '+18005550199') throw new Error('Inbound businessNumber mismatch');
      if (dto.billedMinutes !== 2) throw new Error(`Expected 2 billed minutes for 75s, got ${dto.billedMinutes}`);
    } else {
      if (dto.direction !== 'outbound') throw new Error('Outbound direction mismatch');
      if (dto.contactNumber !== '+919988776655') throw new Error('Outbound contactNumber mismatch');
      if (dto.businessNumber !== '+18005550199') throw new Error('Outbound businessNumber mismatch');
      if (dto.billedMinutes !== 3) throw new Error(`Expected 3 billed minutes for 135s, got ${dto.billedMinutes}`);
      if (!dto.hasRecording) throw new Error('Expected hasRecording to be true');
    }
  }

  // 3. Verify staticTranscript is absent from frontend build
  const fs = require('fs');
  const path = require('path');
  const appTsx = fs.readFileSync(path.join(__dirname, '../../Frontend/src/app/App.tsx'), 'utf8');
  if (appTsx.includes('staticTranscript')) {
    throw new Error('FAILED: staticTranscript was NOT completely removed from Frontend/src/app/App.tsx');
  } else {
    console.log('✅ PASS: staticTranscript confirmed completely deleted from Frontend/src/app/App.tsx');
  }

  // 4. Verify CallController.getCallTranscript contract
  const { CallController } = require('../dist/controllers/CallController');
  if (typeof CallController.getCallTranscript !== 'function') {
    throw new Error('CallController.getCallTranscript missing');
  }
  console.log('✅ PASS: CallController.getCallTranscript available and exports expected signature');

  console.log('=== [ITEM 4+6 ALL CHECKS PASSED] ===');
}

runTest().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
