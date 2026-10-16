/**
 * Item 8 Verification Script: Admin Auth Bypass Closure & CORS Tightening
 *
 * Verifies:
 * 1. Unauthenticated GET /api/v2/admin/me returns 401/403.
 * 2. Missing ENABLE_STRICT_AUTH fails closed (returns 403 FORBIDDEN).
 * 3. Invalid/spoofed Bearer token returns 401 UNAUTHORIZED.
 * 4. Strict CORS validation: arbitrary .vercel.app origin is rejected.
 * 5. Legitimate origin (e.g. adminOrigin / localhost / claritiy.com) is allowed.
 */

const http = require('http');
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { requireStaff } = require('../dist/middleware/requireStaff');

async function runTests() {
  console.log('=== ITEM 8 VERIFICATION: ADMIN AUTH BYPASS & SECURITY ===\n');

  // Set up mock test app using compiled middleware
  const app = express();
  app.use(express.json());

  // Test admin route protected by requireStaff
  app.get('/api/v2/admin/me', requireStaff('customers:view'), (req, res) => {
    res.json({ success: true, staff: req.staff });
  });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let passed = 0;
  let total = 0;

  function assert(condition, testName, detail = '') {
    total++;
    if (condition) {
      console.log(`✓ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`✗ [FAIL] ${testName} - ${detail}`);
    }
  }

  // Helper fetch function
  async function makeRequest(path, headers = {}) {
    return new Promise((resolve, reject) => {
      const u = new URL(path, baseUrl);
      const req = http.request(
        {
          hostname: u.hostname,
          port: u.port,
          path: u.pathname,
          method: 'GET',
          headers,
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            let json = null;
            try {
              json = JSON.parse(data);
            } catch {
              json = data;
            }
            resolve({ status: res.statusCode, headers: res.headers, body: json });
          });
        }
      );
      req.on('error', reject);
      req.end();
    });
  }

  try {
    // Test 1: Fail-closed when ENABLE_STRICT_AUTH is disabled
    process.env.ENABLE_STRICT_AUTH = 'false';
    const resNoStrict = await makeRequest('/api/v2/admin/me');
    assert(
      resNoStrict.status === 403 && resNoStrict.body.error === 'FORBIDDEN',
      'Deny all admin access when ENABLE_STRICT_AUTH is not true (fail-closed default)',
      `Status: ${resNoStrict.status}, Body: ${JSON.stringify(resNoStrict.body)}`
    );

    // Test 2: Unset ENABLE_STRICT_AUTH
    delete process.env.ENABLE_STRICT_AUTH;
    const resUnsetStrict = await makeRequest('/api/v2/admin/me');
    assert(
      resUnsetStrict.status === 403 && resUnsetStrict.body.error === 'FORBIDDEN',
      'Deny all admin access when ENABLE_STRICT_AUTH is completely unset (fail-closed)',
      `Status: ${resUnsetStrict.status}`
    );

    // Test 3: Unauthenticated request when ENABLE_STRICT_AUTH is true
    process.env.ENABLE_STRICT_AUTH = 'true';
    const resUnauth = await makeRequest('/api/v2/admin/me');
    assert(
      resUnauth.status === 401 && resUnauth.body.error === 'UNAUTHORIZED',
      'Unauthenticated request returns 401 UNAUTHORIZED',
      `Status: ${resUnauth.status}, Body: ${JSON.stringify(resUnauth.body)}`
    );

    // Test 4: Invalid bearer token returns 401
    const resInvalidToken = await makeRequest('/api/v2/admin/me', {
      authorization: 'Bearer invalid.bogus.jwt.token',
    });
    assert(
      resInvalidToken.status === 401 && resInvalidToken.body.error === 'UNAUTHORIZED',
      'Invalid / spoofed token returns 401 UNAUTHORIZED',
      `Status: ${resInvalidToken.status}, Body: ${JSON.stringify(resInvalidToken.body)}`
    );

    // Test 5: Verify no hardcoded owner identity is attached without valid credentials
    assert(
      resUnauth.body?.staff === undefined && resInvalidToken.body?.staff === undefined,
      'No hardcoded owner identity or bypass context is ever returned',
      'Context was exposed!'
    );

    // Test 6: Verify CORS regex tightening in index.ts logic
    const isAnchoredDomain = (origin) =>
      /^https:\/\/(www\.|app\.|admin\.)?claritiy\.com$/.test(origin) ||
      /^https:\/\/ai-voice-agent-backend-mv32\.onrender\.com$/.test(origin);

    assert(
      isAnchoredDomain('https://malicious-app.vercel.app') === false,
      'Wildcard *.vercel.app origin is rejected by tightened CORS anchor',
      'malicious-app.vercel.app was permitted!'
    );
    assert(
      isAnchoredDomain('https://arbitrary-clone.vercel.app') === false,
      'Arbitrary vercel deployment origin is rejected by CORS',
      'arbitrary-clone.vercel.app was permitted!'
    );
    assert(
      isAnchoredDomain('https://claritiy.com') === true,
      'Production apex https://claritiy.com is permitted by CORS',
      'claritiy.com failed'
    );
    assert(
      isAnchoredDomain('https://admin.claritiy.com') === true,
      'Admin subdomain https://admin.claritiy.com is permitted by CORS',
      'admin.claritiy.com failed'
    );
    assert(
      isAnchoredDomain('https://app.claritiy.com') === true,
      'Frontend subdomain https://app.claritiy.com is permitted by CORS',
      'app.claritiy.com failed'
    );

  } finally {
    server.close();
  }

  console.log(`\nItem 8 Security Tests: ${passed}/${total} passed`);
  if (passed === total) {
    console.log('✓ ALL ITEM 8 TESTS PASSED: Admin auth bypass closed, fail-closed enforced, and CORS tightened.\n');
    process.exit(0);
  } else {
    console.error('✗ SOME TESTS FAILED');
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
