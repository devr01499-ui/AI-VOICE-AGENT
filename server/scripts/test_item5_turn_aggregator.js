/**
 * End-to-end verification test for ITEM 5:
 * Turn Aggregator, Live WS events, and Database Segment Persistence
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const assert = require('assert');
const { TurnAggregator } = require('../dist/runtime/TurnAggregator');
const { eventBus, PROVIDER_EVENTS } = require('../dist/core/provider-sdk/provider.events');
const { prisma } = require('../dist/lib/prisma');

async function run() {
  console.log('=== [ITEM 5 TEST START: Turn Aggregator E2E Persistence] ===');

  const agent = await prisma.agent.findFirst();
  if (!agent) throw new Error('No agent found in database');

  // 1. Create a real temporary Call row in Postgres
  const testCall = await prisma.call.create({
    data: {
      callDirection: 'inbound',
      fromPhoneNumber: '+18005550199',
      recipientPhoneNumber: '+919876543210',
      status: 'in_progress',
      userId: agent.userId,
      agentId: agent.id,
    }
  });
  console.log('Created real DB test call:', testCall.id);

  const events = [];
  const onTranscript = (evt) => {
    if (evt.callId === testCall.id) {
      events.push(evt);
    }
  };
  eventBus.subscribe(PROVIDER_EVENTS.TRANSCRIPT_UPDATED, onTranscript);

  const aggregator = new TurnAggregator(testCall.id, Date.now(), 300);

  // Turn 1: Agent streams 3 fragments
  aggregator.handleFragment('agent', 'Hello, ', false);
  aggregator.handleFragment('agent', 'how can I help ', false);
  aggregator.handleFragment('agent', 'you today?', false);

  // Turn 2: Caller responds (flushes turn 1)
  aggregator.handleFragment('caller', 'I want to track ', false);
  aggregator.handleFragment('caller', 'my recent order.', false);
  // Provider signals turnComplete for caller
  aggregator.handleFragment('caller', '', true);

  // Turn 3: Agent answers
  aggregator.handleFragment('agent', 'Sure thing, please provide your order ID.', false);
  // Provider signals turnComplete
  aggregator.handleFragment('agent', '', true);

  // Wait for all async DB writes to settle
  await aggregator.waitForPersistence();

  aggregator.destroy();
  eventBus.unsubscribe(PROVIDER_EVENTS.TRANSCRIPT_UPDATED, onTranscript);

  // Verify in PostgreSQL DB
  const dbSegments = await prisma.transcriptSegment.findMany({
    where: { callId: testCall.id },
    orderBy: { sequenceNumber: 'asc' }
  });

  console.log(`\nPersisted DB Segments for ${testCall.id}:`, dbSegments.length);
  dbSegments.forEach(s => {
    console.log(`  [Seq ${s.sequenceNumber}] ${s.speaker.toUpperCase()}: "${s.content}" (${s.startTime}s - ${s.endTime}s)`);
  });

  // Assertions: Exactly 3 segments created, NOT 7 shredded fragments!
  assert.strictEqual(dbSegments.length, 3, `Expected 3 consolidated turn segments in DB, got ${dbSegments.length}`);
  assert.strictEqual(dbSegments[0].speaker, 'agent');
  assert.strictEqual(dbSegments[0].content, 'Hello, how can I help you today?');
  assert.strictEqual(dbSegments[1].speaker, 'user');
  assert.strictEqual(dbSegments[1].content, 'I want to track my recent order.');
  assert.strictEqual(dbSegments[2].speaker, 'agent');
  assert.strictEqual(dbSegments[2].content, 'Sure thing, please provide your order ID.');

  // Clean up test call
  await prisma.transcriptSegment.deleteMany({ where: { callId: testCall.id } });
  await prisma.call.delete({ where: { id: testCall.id } });
  console.log('\n✅ Cleaned up temporary test call from DB.');

  console.log('\n=== [ITEM 5 E2E VERIFICATION COMPLETED SUCCESSFULLY] ===');
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
