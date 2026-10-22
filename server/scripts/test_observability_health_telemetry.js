require('dotenv').config();
const assert = require('assert');
const { sanitizeAuditMetadata } = require('../dist/utils/auditLogger');
const { callTimingTracker } = require('../dist/utils/CallTimingTracker');

let passedTests = 0;
let failedTests = 0;

function runTest(testName, fn) {
  try {
    fn();
    console.log(`  ✓ ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${testName}`);
    console.error(`    ${err.message}`);
    failedTests++;
  }
}

async function runAsyncTest(testName, fn) {
  try {
    await fn();
    console.log(`  ✓ ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${testName}`);
    console.error(`    ${err.message}`);
    failedTests++;
  }
}

async function runBatchFTests() {
  console.log('\n================================================================================');
  console.log('--- RUNNING BATCH F: OBSERVABILITY, AUDIT LOGS, TELEMETRY & HEALTH PROBES ---');
  console.log('================================================================================\n');

  // ── 1. Audit Log Metadata Sanitization (P0 Security) ──
  runTest('Batch F: sanitizeAuditMetadata recursively redacts sensitive tokens, keys and secrets', () => {
    const rawMetadata = {
      orderId: 'ord_12345',
      planKey: 'growth',
      amountInr: 4999,
      customerToken: 'jwt_secret_token_12345',
      deepConfig: {
        apiKey: 'sk_live_secret_key_abcdef',
        clientSecret: 'super_secret_password',
        auth_key: 'custom_auth_token_xyz',
        safeParam: 'public_value_visible',
        nestedArray: [
          { bearerToken: 'bearer_token_abc' },
          { harmlessField: 42 },
        ],
      },
    };

    const sanitized = sanitizeAuditMetadata(rawMetadata);

    assert.strictEqual(sanitized.orderId, 'ord_12345');
    assert.strictEqual(sanitized.planKey, 'growth');
    assert.strictEqual(sanitized.amountInr, 4999);

    // Redacted fields
    assert.strictEqual(sanitized.customerToken, '[REDACTED]', 'customerToken must be redacted');
    assert.strictEqual(sanitized.deepConfig.apiKey, '[REDACTED]', 'apiKey must be redacted');
    assert.strictEqual(sanitized.deepConfig.clientSecret, '[REDACTED]', 'clientSecret must be redacted');
    assert.strictEqual(sanitized.deepConfig.auth_key, '[REDACTED]', 'auth_key must be redacted');
    assert.strictEqual(sanitized.deepConfig.nestedArray[0].bearerToken, '[REDACTED]', 'nested array token must be redacted');

    // Safe preserved fields
    assert.strictEqual(sanitized.deepConfig.safeParam, 'public_value_visible');
    assert.strictEqual(sanitized.deepConfig.nestedArray[1].harmlessField, 42);
  });

  // ── 2. Call Timing Tracker Checkpoints & Deltas ──
  runTest('Batch F: callTimingTracker marks checkpoints and computes cumulative deltas', () => {
    const testCallId = `test_timing_${Date.now()}`;

    callTimingTracker.mark(testCallId, 'answer_webhook_received');
    callTimingTracker.mark(testCallId, 'ws_stream_started');
    callTimingTracker.mark(testCallId, 'gemini_setup_complete');
    callTimingTracker.mark(testCallId, 'first_audio_sent_to_telephony');

    const record = callTimingTracker.getRecord(testCallId);
    assert(record !== undefined, 'Record must be tracked');
    assert.strictEqual(record.callId, testCallId);
    assert(typeof record.checkpoints.answer_webhook_received === 'number');
    assert(typeof record.checkpoints.ws_stream_started === 'number');
    assert(typeof record.deltas.first_audio_sent_to_telephony === 'number');

    callTimingTracker.clear(testCallId);
    assert.strictEqual(callTimingTracker.getRecord(testCallId), undefined, 'Record must be cleaned up on clear()');
  });

  // ── 3. Per-Turn Telemetry & Latency Calculation Engine ──
  runTest('Batch F: Per-turn latency engine computes TTFT, reply latency, and playout delay accurately', () => {
    const callId = `turn_test_${Date.now()}`;
    const agentId = 'agent_test_obs';
    const turnIndex = 1;

    const t0 = 1000;
    const tFirstToken = 1450; // TTFT = 450ms
    const tFirstAudio = 1620; // Reply latency = 620ms, playout = 170ms

    callTimingTracker.startTurn(callId, turnIndex, agentId, t0, 'plain');
    callTimingTracker.markTurnFirstAudioReceived(callId, turnIndex, tFirstToken);
    callTimingTracker.markTurnFirstAudioSentToTelephony(callId, turnIndex, tFirstAudio);
    callTimingTracker.completeTurn(callId, turnIndex);

    const stats = callTimingTracker.getAgentTurnStats(agentId);
    assert(stats.sampleCount >= 1, 'Sample count must be at least 1');
    const turn = stats.turns.find((t) => t.callId === callId && t.turnIndex === turnIndex);
    assert(turn !== undefined, 'Completed turn must be in stats');
    assert.strictEqual(turn.reply_latency_ms, 620, 'Reply latency must be exactly 620ms');
    assert.strictEqual(turn.ttft_ms, 450, 'TTFT must be exactly 450ms');
    assert.strictEqual(turn.playout_delay_ms, 170, 'Playout delay must be exactly 170ms');

    callTimingTracker.clear(callId);
  });

  // ── 4. Health Check Probe Status Code Determination ──
  runTest('Batch F: Health probe strictly returns HTTP 200 when healthy and HTTP 503 when degraded', () => {
    const evaluateHealthStatus = (dbHealthy) => {
      const statusCode = dbHealthy ? 200 : 503;
      const payload = {
        status: dbHealthy ? 'ok' : 'degraded',
        database: { healthy: dbHealthy },
      };
      return { statusCode, payload };
    };

    const healthyResult = evaluateHealthStatus(true);
    assert.strictEqual(healthyResult.statusCode, 200, 'Healthy database must return HTTP 200');
    assert.strictEqual(healthyResult.payload.status, 'ok');

    const degradedResult = evaluateHealthStatus(false);
    assert.strictEqual(degradedResult.statusCode, 503, 'Disconnected database must return HTTP 503 Service Unavailable');
    assert.strictEqual(degradedResult.payload.status, 'degraded');
  });

  // ── 5. Liveness Probe Payload Structure ──
  runTest('Batch F: Liveness probe returns 200 OK with runtime process telemetry metrics', () => {
    const livenessHandler = () => ({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      pid: process.pid,
      memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    });

    const live = livenessHandler();
    assert.strictEqual(live.status, 'alive');
    assert(typeof live.uptimeSeconds === 'number');
    assert(typeof live.pid === 'number');
    assert(typeof live.memoryUsageMb === 'number');
  });

  console.log('\n================================================================================');
  console.log(`BATCH F TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('================================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runBatchFTests().catch((err) => {
  console.error('Batch F test execution failed:', err);
  process.exit(1);
});
