/**
 * Verification test for Item 1: Rate Limiting & Trust Proxy
 * Per GOVERNANCE_RULES §6: Directly invokes compiled production code
 * Run with: node scripts/test_rate_limiting.js
 */

const http = require('http');
const express = require('express');
const { generalApiLimiter, sensitiveOperationsLimiter, getRateLimitKey, isWebhookExempt } = require('../dist/middleware/rateLimiter');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName} - ${details}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING RATE LIMITING & TRUST PROXY VERIFICATION');
  console.log('================================================================\n');

  // Build a test Express app mimicking server/src/index.ts
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());

  // Middleware mimicking auth populating req.userId or reading x-user-id header
  app.use((req, res, next) => {
    const customUser = req.headers['x-user-id'];
    if (customUser) {
      req.userId = customUser;
    }
    next();
  });

  // Echo endpoint to inspect req.ip
  app.get('/test/ip', (req, res) => {
    res.json({ ip: req.ip, key: getRateLimitKey(req) });
  });

  // General rate limited endpoint (read)
  app.get('/api/v2/calls', generalApiLimiter, (req, res) => {
    res.json({ success: true, message: 'Calls list read OK' });
  });

  // Sensitive rate limited endpoint (mutating)
  app.post('/api/v2/calls/outbound', sensitiveOperationsLimiter, (req, res) => {
    res.json({ success: true, message: 'Call initiated' });
  });

  // Webhook endpoint
  app.post('/api/v2/kyc/webhook/vobiz', generalApiLimiter, sensitiveOperationsLimiter, (req, res) => {
    res.json({ success: true, message: 'Webhook received' });
  });

  const server = http.createServer(app);
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // ── Test 1: Trust proxy and req.ip from X-Forwarded-For ──
    console.log('--- Test 1: Trust Proxy IP Resolution ---');
    const ipRes = await fetch(`${baseUrl}/test/ip`, {
      headers: { 'X-Forwarded-For': '203.0.113.195' }
    });
    const ipData = await ipRes.json();
    assert(ipData.ip === '203.0.113.195', 'req.ip resolves real client IP behind proxy (first hop)', `Got ${ipData.ip}`);
    assert(ipData.key === '203.0.113.195', 'Unauthenticated key is client IP', `Got ${ipData.key}`);

    // ── Test 2: Authenticated user keying by userId ──
    console.log('\n--- Test 2: Authenticated Keying by User ID ---');
    const authIpRes = await fetch(`${baseUrl}/test/ip`, {
      headers: { 
        'X-Forwarded-For': '203.0.113.195',
        'x-user-id': 'user-alpha-123'
      }
    });
    const authIpData = await authIpRes.json();
    assert(authIpData.key === 'user:user-alpha-123', 'Authenticated key is user:<userId>', `Got ${authIpData.key}`);

    // ── Test 3: Exhaust User 1 limit and confirm User 2 is unaffected ──
    console.log('\n--- Test 3: User-scoped Isolation (Exhaust User 1, User 2 Unaffected) ---');
    const user1 = 'test-user-isolated-1';
    const user2 = 'test-user-isolated-2';

    let user1Blocked = false;
    let user1BlockedAt = 0;

    // Send 35 requests for User 1 (limit is 30/15min)
    for (let i = 1; i <= 35; i++) {
      const res = await fetch(`${baseUrl}/api/v2/calls/outbound`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': user1,
          'X-Forwarded-For': '203.0.113.195' // Same shared IP
        },
        body: JSON.stringify({ to: '+1234567890' })
      });

      if (res.status === 429) {
        user1Blocked = true;
        user1BlockedAt = i;
        break;
      }
    }

    assert(user1Blocked && user1BlockedAt === 31, `User 1 was 429 blocked at request 31 (max 30)`, `Blocked at: ${user1BlockedAt}`);

    // Now User 2 makes a request from the EXACT SAME IP
    const user2Res = await fetch(`${baseUrl}/api/v2/calls/outbound`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': user2,
        'X-Forwarded-For': '203.0.113.195' // Same shared Render IP
      },
      body: JSON.stringify({ to: '+1234567890' })
    });

    assert(user2Res.status === 200, 'User 2 is completely unaffected on the same shared IP (status 200)', `User 2 status: ${user2Res.status}`);

    // ── Test 4: Webhook exemption ──
    console.log('\n--- Test 4: Vobiz KYC Webhook Exemption ---');
    let webhookAllPassed = true;
    for (let i = 1; i <= 35; i++) {
      const res = await fetch(`${baseUrl}/api/v2/kyc/webhook/vobiz`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '203.0.113.195'
        },
        body: JSON.stringify({ status: 'verified' })
      });
      if (res.status !== 200) {
        webhookAllPassed = false;
        break;
      }
    }
    assert(webhookAllPassed, 'Vobiz KYC webhook processed 35 requests with 0 rate limit blocks (exempted)');

    // ── Test 5: Reads do not consume sensitiveOperationsLimiter ──
    console.log('\n--- Test 5: Read Routes (GET /api/v2/calls) Do Not Trigger 429 Under High Volume ---');
    let readsPassed = true;
    for (let i = 1; i <= 35; i++) {
      const res = await fetch(`${baseUrl}/api/v2/calls`, {
        headers: { 'x-user-id': 'read-user-test' }
      });
      if (res.status !== 200) {
        readsPassed = false;
        break;
      }
    }
    assert(readsPassed, 'GET /api/v2/calls is not subject to sensitive 30-req limit (35 requests succeeded)');

  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log(`Rate Limiting Tests Complete: ${passedTests} passed, ${failedTests} failed`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
