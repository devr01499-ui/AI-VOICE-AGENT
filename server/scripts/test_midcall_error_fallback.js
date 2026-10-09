const assert = require('assert');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { AudioStreamHandler } = require('../dist/websockets/AudioStreamHandler');
const { eventBus, PROVIDER_EVENTS } = require('../dist/core/provider-sdk/provider.events');
const { callOrchestrator } = require('../dist/core/orchestrator/CallOrchestrator');

async function run() {
  console.log('--- Testing Ticket 6: Mid-Call Error Fallback in AudioStreamHandler ---');

  const testCallId = `test_call_fallback_${Date.now()}`;
  const sentMessages = [];
  let connectionClosed = false;

  const mockWs = {
    readyState: 1, // OPEN
    send: (msg) => {
      sentMessages.push(JSON.parse(msg));
    },
    close: (code, reason) => {
      connectionClosed = true;
      console.log(`✓ WebSocket closed with code ${code}, reason: "${reason}"`);
    },
  };

  const handler = new AudioStreamHandler();

  // Populate an active connection
  handler.connections.set(testCallId, {
    ws: mockWs,
    callId: testCallId,
    streamId: 'mock-stream',
    createdAt: Date.now(),
    audioStats: { packetsReceived: 0, bytesReceived: 0, bytesConverted: 0, conversionErrors: 0 },
    playbackQueue: [],
    isPlayoutActive: false,
    sessionReady: true,
    inboundAudioBuffer: [],
  });

  // Track call orchestrator endCallSession
  let sessionEndedWith = null;
  const originalEndCallSession = callOrchestrator.endCallSession.bind(callOrchestrator);
  callOrchestrator.endCallSession = async (callId, reason) => {
    sessionEndedWith = { callId, reason };
    return originalEndCallSession(callId, reason).catch(() => {});
  };

  try {
    // 1. Manually register listener as AudioStreamHandler does on startSession
    eventBus.subscribe(PROVIDER_EVENTS.AI_STOPPED_SPEAKING, (payload) => {
      if (payload.callId === testCallId && payload.error) {
        handler.playFallbackAndEndCall(testCallId);
      }
    });

    console.log('[Step 1] Emitting PROVIDER_EVENTS.AI_STOPPED_SPEAKING with payload.error...');
    eventBus.emit(PROVIDER_EVENTS.AI_STOPPED_SPEAKING, {
      callId: testCallId,
      error: 'Simulated LLM pipeline disconnection mid-call',
    });

    // 2. Verify clearAudio was sent
    const clearAudioMsg = sentMessages.find((m) => m.event === 'clearAudio');
    assert.ok(clearAudioMsg, 'clearAudio message must be sent immediately to cancel dead-air / corrupted buffer');
    console.log('✓ clearAudio event dispatched to Vobiz stream');

    // 3. Verify playAudio was queued with fallback chime audio
    const playAudioMsg = sentMessages.find((m) => m.event === 'playAudio');
    assert.ok(playAudioMsg, 'Fallback audio tone must be sent to Vobiz stream');
    assert.strictEqual(playAudioMsg.media.contentType, 'audio/x-l16');
    assert.strictEqual(playAudioMsg.media.sampleRate, 16000);
    assert.ok(playAudioMsg.media.payload.length > 0, 'Audio payload must contain non-empty PCM chime tone');
    console.log(`✓ playAudio event dispatched with ${playAudioMsg.media.payload.length} bytes of audio payload`);

    // 4. Wait for fallback playout timeout (1800ms + buffer)
    console.log('[Step 2] Waiting for fallback playout and graceful session termination...');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    assert.strictEqual(connectionClosed, true, 'WebSocket must be closed after chime completes');
    assert.ok(sessionEndedWith, 'Call orchestrator endCallSession must be called');
    assert.strictEqual(sessionEndedWith.callId, testCallId);
    assert.strictEqual(sessionEndedWith.reason, 'fallback_completed');
    console.log('✓ CallOrchestrator.endCallSession called with reason: fallback_completed');

    console.log('\n✅ All Ticket 6 Mid-Call Error Fallback tests passed successfully!');
  } finally {
    callOrchestrator.endCallSession = originalEndCallSession;
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
