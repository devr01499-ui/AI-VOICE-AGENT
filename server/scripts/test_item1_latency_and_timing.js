const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { buildGreetingText, formatGreetingTurnPrompt, getGreetingTextForLanguage } = require('../dist/utils/greetingUtils');
const { callTimingTracker } = require('../dist/utils/CallTimingTracker');
const { prisma } = require('../dist/lib/prisma');

async function runTests() {
  console.log('=== TEST 1: Greeting Quality & First Message Formatting ===');

  // Test 1a: Outbound default greeting with agent name
  const outboundGreeting = buildGreetingText({
    languageMode: 'en',
    direction: 'outbound',
    agentName: 'Sarah',
    businessName: 'Claritiy Voice',
    isRecordingEnabled: false,
  });
  console.log('1a. Outbound greeting:', outboundGreeting);
  if (!outboundGreeting.includes('Hello, this is Sarah calling from Claritiy Voice')) {
    throw new Error('1a failed: outbound greeting missing agent/business');
  }

  // Test 1b: Inbound default greeting with agent name
  const inboundGreeting = buildGreetingText({
    languageMode: 'en',
    direction: 'inbound',
    agentName: 'Alex',
    businessName: 'Acme Corp',
    isRecordingEnabled: false,
  });
  console.log('1b. Inbound greeting:', inboundGreeting);
  if (!inboundGreeting.includes('Thank you for calling Acme Corp. My name is Alex')) {
    throw new Error('1b failed: inbound greeting template mismatch');
  }

  // Test 1c: Explicit agent-level firstMessage takes precedence verbatim
  const customFirstMsg = 'Welcome to dental care. Please have your patient ID ready.';
  const customGreeting = buildGreetingText({
    languageMode: 'en',
    direction: 'inbound',
    agentName: 'Alex',
    firstMessage: customFirstMsg,
    isRecordingEnabled: false,
  });
  console.log('1c. Custom verbatim firstMessage:', customGreeting);
  if (customGreeting !== customFirstMsg) {
    throw new Error('1c failed: custom firstMessage was overridden');
  }

  // Test 1d: Recording disclosure appended AFTER greeting, never blocking/prepending
  const recordingGreeting = buildGreetingText({
    languageMode: 'en',
    direction: 'outbound',
    agentName: 'Sarah',
    firstMessage: customFirstMsg,
    isRecordingEnabled: true,
  });
  console.log('1d. Recording disclosure position:', recordingGreeting);
  if (!recordingGreeting.startsWith(customFirstMsg)) {
    throw new Error('1d failed: recording notice was prepended instead of appended');
  }
  if (!recordingGreeting.includes('Please note this call is recorded for quality and compliance.')) {
    throw new Error('1d failed: recording notice missing');
  }

  // Test 1e: Verbatim model turn prompt steering
  const steeredPrompt = formatGreetingTurnPrompt(customFirstMsg);
  console.log('1e. Model steering prompt:', steeredPrompt);
  if (!steeredPrompt.includes('Say verbatim:') || !steeredPrompt.includes(customFirstMsg)) {
    throw new Error('1e failed: steering prompt incorrect');
  }

  console.log('\n=== TEST 2: CallTimingTracker 7 Checkpoints & Delta Calculation ===');
  const testCallId = `test-call-${Date.now()}`;

  // Mark all 7 checkpoints in sequence
  callTimingTracker.mark(testCallId, 'answer_webhook_received');
  await new Promise((r) => setTimeout(r, 40));
  callTimingTracker.mark(testCallId, 'gemini_ws_open');
  await new Promise((r) => setTimeout(r, 60));
  callTimingTracker.mark(testCallId, 'gemini_setup_complete');
  await new Promise((r) => setTimeout(r, 50));
  callTimingTracker.mark(testCallId, 'ws_stream_started');
  await new Promise((r) => setTimeout(r, 10));
  callTimingTracker.mark(testCallId, 'greeting_requested');
  await new Promise((r) => setTimeout(r, 80));
  callTimingTracker.mark(testCallId, 'first_audio_chunk_from_gemini');
  await new Promise((r) => setTimeout(r, 15));
  const finalDelta = callTimingTracker.mark(testCallId, 'first_audio_sent_to_telephony');

  const record = callTimingTracker.getRecord(testCallId);
  console.log('2a. Timing record checkpoints:', Object.keys(record.checkpoints));
  console.log('2b. Total latency delta from answer:', finalDelta, 'ms');

  const requiredCheckpoints = [
    'answer_webhook_received',
    'ws_stream_started',
    'gemini_ws_open',
    'gemini_setup_complete',
    'greeting_requested',
    'first_audio_chunk_from_gemini',
    'first_audio_sent_to_telephony',
  ];

  for (const cp of requiredCheckpoints) {
    if (typeof record.checkpoints[cp] !== 'number') {
      throw new Error(`Missing checkpoint: ${cp}`);
    }
    if (typeof record.deltas[cp] !== 'number') {
      throw new Error(`Missing delta: ${cp}`);
    }
  }
  callTimingTracker.clear(testCallId);

  console.log('\n=== TEST 3: Database first_message Column Persistence ===');
  let agentRecord = await prisma.agent.findFirst({
    select: { id: true, name: true, firstMessage: true },
  });

  if (!agentRecord) {
    const user = await prisma.user.findFirst();
    agentRecord = await prisma.agent.create({
      data: {
        name: 'Test Voice Agent',
        userId: user ? user.id : '1e69187e-82d5-4166-929f-4bbba90e5304',
        status: 'active',
        systemPrompt: 'You are a test voice agent.',
      },
      select: { id: true, name: true, firstMessage: true },
    });
  }

  console.log('3a. Agent query before update:', agentRecord);

  const testFirstMsg = 'Hello! Welcome to Claritiy Voice automated assistance.';
  const updatedAgent = await prisma.agent.update({
    where: { id: agentRecord.id },
    data: { firstMessage: testFirstMsg },
    select: { id: true, name: true, firstMessage: true },
  });
  console.log('3b. Agent query after update with firstMessage:', updatedAgent);
  if (updatedAgent.firstMessage !== testFirstMsg) {
    throw new Error('3b failed: firstMessage not persisted');
  }

  console.log('\n=== ALL ITEM 1 TESTS PASSED SUCCESSFULLY! ===');
  await prisma.$disconnect();
}

runTests().catch(async (err) => {
  console.error('TEST ERROR:', err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
