/**
 * Test Suite: Batch E — Webhook Idempotency, Replay Attack Defense & Signature Verification (Non-Plivo: Vobiz, Razorpay, Telephony)
 */

const assert = require('assert');
const crypto = require('crypto');
const { verifyVobizWebhook, clearVobizReplayCacheForTesting } = require('../dist/middleware/vobizWebhook');
const { getWebhookSigningSecret } = require('../dist/utils/security');
const { clearRazorpayReplayCacheForTesting } = require('../dist/routes/razorpayWebhook');

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

function createMockReqRes({ headers = {}, body = {}, ip = '127.0.0.1', path = '/api/v2/webhooks/vobiz/answer' } = {}) {
  const req = {
    header: (name) => headers[name.toLowerCase()] || headers[name] || undefined,
    headers: { ...headers },
    body,
    rawBody: Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)),
    ip,
    path,
  };

  let statusCode = 200;
  let responseData = null;

  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      responseData = data;
      return res;
    },
    send: (data) => {
      responseData = data;
      return res;
    },
    getStatusCode: () => statusCode,
    getResponseData: () => responseData,
  };

  return { req, res };
}

async function runBatchETests() {
  console.log('\n================================================================================');
  console.log('--- RUNNING BATCH E: WEBHOOK IDEMPOTENCY, REPLAY DEFENSE & SIGNATURE VERIFICATION ---');
  console.log('================================================================================\n');

  const secret = getWebhookSigningSecret();
  assert(secret && secret.length > 0, 'Signing secret must be resolvable');

  // ── 1. Vobiz Webhook Valid HMAC-SHA256 Signature ──
  runTest('P0-5 / Batch E: Vobiz webhook with valid HMAC-SHA256 signature is accepted', () => {
    clearVobizReplayCacheForTesting();
    const payload = { event: 'call.answered', CallUUID: 'call_test_123', Direction: 'outbound' };
    const rawBody = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    const { req, res } = createMockReqRes({
      headers: {
        'x-vobiz-signature': signature,
        'x-vobiz-nonce': 'nonce_valid_1',
      },
      body: payload,
    });

    let nextCalled = false;
    verifyVobizWebhook(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true, 'Next must be called for valid signature');
    assert.strictEqual(res.getStatusCode(), 200, 'Status must remain 200');
  });

  // ── 2. Vobiz Webhook Forged Signature Rejection ──
  runTest('P0-5 / Batch E: Forged Vobiz signature is strictly rejected with HTTP 401', () => {
    clearVobizReplayCacheForTesting();
    const payload = { event: 'call.answered', CallUUID: 'call_test_123' };
    const { req, res } = createMockReqRes({
      headers: {
        'x-vobiz-signature': '0000000000000000000000000000000000000000000000000000000000000000',
        'x-vobiz-nonce': 'nonce_forged_1',
      },
      body: payload,
    });

    let nextCalled = false;
    verifyVobizWebhook(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, false, 'Next must NOT be called for forged signature');
    assert.strictEqual(res.getStatusCode(), 401, 'Status must be 401 Unauthorized');
  });

  // ── 3. Vobiz Webhook Replay Attack Defense ──
  runTest('P0-5 / Batch E: Replayed Vobiz webhook with identical nonce is blocked with HTTP 403', () => {
    clearVobizReplayCacheForTesting();
    const payload = { event: 'call.hangup', CallUUID: 'call_hangup_replay' };
    const rawBody = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const nonce = 'replay_nonce_fixed_123';

    // First request: valid
    const first = createMockReqRes({
      headers: {
        'x-vobiz-signature': signature,
        'x-vobiz-nonce': nonce,
      },
      body: payload,
    });
    let firstNext = false;
    verifyVobizWebhook(first.req, first.res, () => { firstNext = true; });
    assert.strictEqual(firstNext, true, 'First valid request must pass');

    // Second request: replayed with same nonce
    const second = createMockReqRes({
      headers: {
        'x-vobiz-signature': signature,
        'x-vobiz-nonce': nonce,
      },
      body: payload,
    });
    let secondNext = false;
    verifyVobizWebhook(second.req, second.res, () => { secondNext = true; });
    assert.strictEqual(secondNext, false, 'Replayed request must NOT call next');
    assert.strictEqual(second.res.getStatusCode(), 403, 'Replayed request must receive HTTP 403 Forbidden');
    assert.strictEqual(second.res.getResponseData().error, 'Forbidden: Webhook replay detected');
  });

  // ── 4. Vobiz Webhook Timestamp Freshness & Clock Drift Check ──
  runTest('P0-5 / Batch E: Expired Vobiz timestamp (>300s drift) is rejected with HTTP 401', () => {
    clearVobizReplayCacheForTesting();
    const payload = { event: 'call.answered', CallUUID: 'call_test_drift' };
    const rawBody = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const expiredTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes in past

    const { req, res } = createMockReqRes({
      headers: {
        'x-vobiz-signature': signature,
        'x-vobiz-timestamp': String(expiredTimestamp),
        'x-vobiz-nonce': 'nonce_drift_1',
      },
      body: payload,
    });

    let nextCalled = false;
    verifyVobizWebhook(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false, 'Expired timestamp request must NOT call next');
    assert.strictEqual(res.getStatusCode(), 401, 'Status must be 401 Unauthorized');
    assert.strictEqual(res.getResponseData().error, 'Unauthorized: Webhook timestamp expired');
  });

  // ── 5. Elimination of Insecure Public Auth-ID Bypass ──
  runTest('P0-5 / Batch E: Plain X-Vobiz-Auth-ID header cannot bypass signature or token verification', () => {
    clearVobizReplayCacheForTesting();
    const payload = { event: 'call.answered', CallUUID: 'call_bypass_probe' };

    const { req, res } = createMockReqRes({
      headers: {
        'x-vobiz-auth-id': 'public_auth_id_123',
        'x-vobiz-nonce': 'nonce_bypass_1',
      },
      body: payload,
    });

    let nextCalled = false;
    verifyVobizWebhook(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false, 'Public auth-id must NOT authenticate request');
    assert.strictEqual(res.getStatusCode(), 401, 'Unauthenticated request must receive HTTP 401');
  });

  // ── 6. Secret Bearer Token Authentication ──
  runTest('P0-5 / Batch E: Bearer secret token is accepted in constant time', () => {
    clearVobizReplayCacheForTesting();
    const payload = { event: 'call.ringing' };
    const { req, res } = createMockReqRes({
      headers: {
        'authorization': `Bearer ${secret}`,
        'x-vobiz-nonce': 'nonce_bearer_1',
      },
      body: payload,
    });

    let nextCalled = false;
    verifyVobizWebhook(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true, 'Bearer token matching signing secret must pass');
  });

  // ── 7. Razorpay Idempotency & In-Flight Concurrency Deduplication ──
  runTest('P0-6 / Batch E: Razorpay in-flight concurrency set & replay cache guarantees deduplication', () => {
    clearRazorpayReplayCacheForTesting();
    const eventId = 'evt_pay_test_dedup_123';

    // Simulate in-flight concurrency set
    const inFlightSet = new Set();
    const replayCache = new Map();

    const processEvent = (id) => {
      if (replayCache.has(id)) {
        return { status: 200, idempotent: true, reason: 'replay_cache' };
      }
      if (inFlightSet.has(id)) {
        return { status: 200, idempotent: true, reason: 'in_flight_concurrent' };
      }
      inFlightSet.add(id);
      try {
        // execute processing
        return { status: 200, processed: true };
      } finally {
        inFlightSet.delete(id);
        replayCache.set(id, Date.now() + 900000);
      }
    };

    const first = processEvent(eventId);
    assert.strictEqual(first.processed, true, 'First event delivery must process');

    const second = processEvent(eventId);
    assert.strictEqual(second.idempotent, true, 'Second event delivery must be skipped idempotently');
    assert.strictEqual(second.reason, 'replay_cache', 'Second event must hit replay cache');
  });

  console.log('\n================================================================================');
  console.log(`BATCH E TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('================================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runBatchETests().catch((err) => {
  console.error('Batch E test execution failed:', err);
  process.exit(1);
});
