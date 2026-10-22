/**
 * Claritiy Voice — Audio Stream Authentication & Tenant Isolation Test Suite (Batch A2 / P0-2)
 *
 * Verifies:
 * 1. Removal of Case 1 DB-existence bypass: connections without a valid HMAC token are closed with 1008.
 * 2. Case 1 HMAC-authenticated stream: valid token + timestamp connects.
 * 3. Case 2 (extra_headers): HMAC token in extra_headers is required and validated.
 * 4. Fallback C elimination: unmatched streams never cross-bridge to recent DB calls.
 * 5. Stream uniqueness: second concurrent stream for the same callId is rejected with 1008.
 * 6. Ended call gate: stream connection to a completed/canceled call is rejected with 1008.
 *
 * Run via: node server/scripts/test_audiostream_isolation.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const assert = require('assert');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { AudioStreamHandler } = require('../dist/websockets/AudioStreamHandler');
const { getWebhookSigningSecret } = require('../dist/utils/security');
const { prisma } = require('../dist/lib/prisma');

let totalTests = 0;
let passedTests = 0;

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

async function waitFor(conditionFn, timeoutMs = 3000, intervalMs = 25) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (conditionFn()) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return conditionFn();
}

// Mock WebSocket harness
class MockWebSocket extends EventEmitter {
  constructor() {
    super();
    this.closeCode = null;
    this.closeReason = null;
    this.sentMessages = [];
  }

  close(code, reason) {
    this.closeCode = code;
    this.closeReason = reason;
    this.emit('close', code, Buffer.from(reason || ''));
  }

  send(data) {
    this.sentMessages.push(data);
  }
}

async function main() {
  console.log('================================================================================');
  console.log('🛡️  CLARITIY VOICE — AUDIO STREAM ISOLATION & HMAC DEFENSE SUITE');
  console.log('================================================================================\n');

  const secret = getWebhookSigningSecret();
  const testTenantUserId = `stream_test_user_${Date.now()}`;
  const testAgentId = `stream_test_agent_${Date.now()}`;

  // Unique call IDs for isolated test cases
  const callForCase1Unsigned = `call_c1_unsig_${Date.now()}`;
  const callForCase1Valid = `call_c1_valid_${Date.now()}`;
  const callForCase2Valid = `call_c2_valid_${Date.now()}`;
  const callForConcurrency = `call_concur_${Date.now()}`;
  const callForEnded = `call_ended_${Date.now()}`;

  // Seed fixture user, agent, and calls
  await prisma.user.create({
    data: {
      id: testTenantUserId,
      email: `${testTenantUserId}@claritiy.test`,
      fullName: 'Audio Stream Tenant',
      passwordHash: 'dummy',
      accountType: 'admin',
      callingBalanceMinutes: 1000,
    },
  });

  await prisma.agent.create({
    data: {
      id: testAgentId,
      userId: testTenantUserId,
      name: 'Stream Test Agent',
      status: 'active',
    },
  });

  await prisma.call.createMany({
    data: [
      { id: callForCase1Unsigned, userId: testTenantUserId, agentId: testAgentId, recipientPhoneNumber: '+919876543210', status: 'in_progress' },
      { id: callForCase1Valid, userId: testTenantUserId, agentId: testAgentId, recipientPhoneNumber: '+919876543210', status: 'in_progress' },
      { id: callForCase2Valid, userId: testTenantUserId, agentId: testAgentId, recipientPhoneNumber: '+919876543210', status: 'in_progress' },
      { id: callForConcurrency, userId: testTenantUserId, agentId: testAgentId, recipientPhoneNumber: '+919876543210', status: 'in_progress' },
      { id: callForEnded, userId: testTenantUserId, agentId: testAgentId, recipientPhoneNumber: '+919876543210', status: 'completed', endTime: new Date() },
    ],
  });

  const handler = new AudioStreamHandler();
  const mockWss = new EventEmitter();
  handler.initialize(mockWss);

  // ─── 1. CASE 1: URL QUERY PARAMETER AUTHENTICATION ──────────────────────────────────
  console.log('--- 1. URL QUERY PARAMETER AUTHENTICATION (CASE 1) ---');

  await runAsyncTest('Unsigned query string connection (attacker knowing callId) is closed with 1008', async () => {
    const ws = new MockWebSocket();
    const req = {
      url: `/audio-stream?callId=${callForCase1Unsigned}`,
      headers: { host: 'localhost:3001' },
    };

    mockWss.emit('connection', ws, req);
    await waitFor(() => ws.closeCode !== null);

    assert.strictEqual(ws.closeCode, 1008, 'Must be closed with code 1008 Policy Violation');
  });

  await runAsyncTest('Expired timestamp (>15 min) in query string is closed with 1008', async () => {
    const ws = new MockWebSocket();
    const expiredTs = Date.now() - (20 * 60 * 1000); // 20 minutes ago
    const token = crypto.createHmac('sha256', secret).update(`${callForCase1Valid}:${expiredTs}`).digest('hex');
    const req = {
      url: `/audio-stream?callId=${callForCase1Valid}&token=${token}&ts=${expiredTs}`,
      headers: { host: 'localhost:3001' },
    };

    mockWss.emit('connection', ws, req);
    await waitFor(() => ws.closeCode !== null);

    assert.strictEqual(ws.closeCode, 1008, 'Expired token must close with 1008');
  });

  await runAsyncTest('Valid signed HMAC token with fresh timestamp authorizes stream connection', async () => {
    const ws = new MockWebSocket();
    const freshTs = Date.now();
    const token = crypto.createHmac('sha256', secret).update(`${callForCase1Valid}:${freshTs}`).digest('hex');
    const req = {
      url: `/audio-stream?callId=${callForCase1Valid}&token=${token}&ts=${freshTs}`,
      headers: { host: 'localhost:3001' },
    };

    mockWss.emit('connection', ws, req);
    const registered = await waitFor(() => handler.connections.has(callForCase1Valid));

    assert.strictEqual(registered, true, 'Valid stream must be registered in connections map');
    assert.strictEqual(ws.closeCode, null, 'Valid HMAC stream must not be closed');

    // Clean up
    await handler.closeAll();
  });

  // ─── 2. CASE 2: EXTRA_HEADERS & HANDSHAKE AUTHENTICATION ─────────────────────────────
  console.log('\n--- 2. EXTRA_HEADERS & HANDSHAKE AUTHENTICATION (CASE 2) ---');

  await runAsyncTest('Handshake without valid HMAC in extra_headers is rejected with 1008', async () => {
    const ws = new MockWebSocket();
    const req = {
      url: '/audio-stream',
      headers: { host: 'localhost:3001' },
    };

    mockWss.emit('connection', ws, req);

    ws.emit('message', Buffer.from(JSON.stringify({
      event: 'start',
      start: { callId: callForCase2Valid },
    })));

    await waitFor(() => ws.closeCode !== null);

    assert.strictEqual(ws.closeCode, 1008, 'Stream without valid HMAC in extra_headers must close with 1008');
  });

  await runAsyncTest('Handshake with valid HMAC in extraHeaders authorizes connection', async () => {
    const ws = new MockWebSocket();
    const freshTs = Date.now();
    const token = crypto.createHmac('sha256', secret).update(`${callForCase2Valid}:${freshTs}`).digest('hex');
    const req = {
      url: '/audio-stream',
      headers: { host: 'localhost:3001' },
    };

    mockWss.emit('connection', ws, req);

    ws.emit('message', Buffer.from(JSON.stringify({
      event: 'start',
      extra_headers: `callId=${callForCase2Valid};token=${token};ts=${freshTs}`,
      start: { streamId: 'stream_test_1', callId: callForCase2Valid },
    })));

    const registered = await waitFor(() => handler.connections.has(callForCase2Valid));

    assert.strictEqual(registered, true, 'Stream must be registered in connections map');
    assert.strictEqual(ws.closeCode, null, 'Verified extra_headers must connect successfully');

    await handler.closeAll();
  });

  // ─── 3. FALLBACK C ELIMINATION (ANTI-CROSS-TENANT HIJACK) ───────────────────────────
  console.log('\n--- 3. FALLBACK C ELIMINATION (ANTI-CROSS-TENANT HIJACK) ---');

  await runAsyncTest('Unmatched stream never attaches to a recent call in DB (Fallback C removed)', async () => {
    const ws = new MockWebSocket();
    const req = {
      url: '/audio-stream',
      headers: { host: 'localhost:3001' },
    };

    mockWss.emit('connection', ws, req);

    ws.emit('message', Buffer.from(JSON.stringify({
      event: 'start',
      start: { callId: 'random-unauthenticated-foreign-call-id' },
    })));

    await waitFor(() => ws.closeCode !== null);

    assert.strictEqual(ws.closeCode, 1008, 'Unauthenticated stream must fail with 1008, not bind to recent call');
    assert.strictEqual(handler.getActiveConnectionCount(), 0, 'No stream may be registered');
  });

  // ─── 4. CONCURRENCY & TERMINAL STATE GATES ──────────────────────────────────────────
  console.log('\n--- 4. CONCURRENCY & TERMINAL STATE GATES ---');

  await runAsyncTest('Second stream for an already-connected callId is rejected with 1008', async () => {
    const freshTs = Date.now();
    const token = crypto.createHmac('sha256', secret).update(`${callForConcurrency}:${freshTs}`).digest('hex');

    // First stream connects
    const ws1 = new MockWebSocket();
    const req1 = {
      url: `/audio-stream?callId=${callForConcurrency}&token=${token}&ts=${freshTs}`,
      headers: { host: 'localhost:3001' },
    };
    mockWss.emit('connection', ws1, req1);
    await waitFor(() => handler.connections.has(callForConcurrency));
    assert.strictEqual(ws1.closeCode, null, 'First stream connects');

    // Second stream for same callId attempts connection
    const ws2 = new MockWebSocket();
    const req2 = {
      url: `/audio-stream?callId=${callForConcurrency}&token=${token}&ts=${freshTs}`,
      headers: { host: 'localhost:3001' },
    };
    mockWss.emit('connection', ws2, req2);
    await waitFor(() => ws2.closeCode !== null);

    assert.strictEqual(ws2.closeCode, 1008, 'Second stream must be rejected with 1008');
    assert.strictEqual(ws2.closeReason, 'Stream already active for this call');

    await handler.closeAll();
  });

  await runAsyncTest('Stream connection for an already-ended call is rejected with 1008', async () => {
    const freshTs = Date.now();
    const token = crypto.createHmac('sha256', secret).update(`${callForEnded}:${freshTs}`).digest('hex');

    const ws = new MockWebSocket();
    const req = {
      url: `/audio-stream?callId=${callForEnded}&token=${token}&ts=${freshTs}`,
      headers: { host: 'localhost:3001' },
    };

    mockWss.emit('connection', ws, req);
    await waitFor(() => ws.closeCode !== null);

    assert.strictEqual(ws.closeCode, 1008, 'Ended call stream must be closed with 1008');
    assert.strictEqual(ws.closeReason, 'Call already ended');
  });

  // ─── CLEANUP TRANSIENT FIXTURES ──────────────────────────────────────────────────────
  console.log('\n--- CLEANUP FIXTURES ---');
  await runAsyncTest('Clean up transient test records', async () => {
    await prisma.call.deleteMany({ where: { userId: testTenantUserId } }).catch(() => {});
    await prisma.agent.deleteMany({ where: { userId: testTenantUserId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: testTenantUserId } }).catch(() => {});
  });

  console.log('================================================================================');
  console.log(`🎉 AUDIO STREAM ISOLATION SUITE: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('================================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
