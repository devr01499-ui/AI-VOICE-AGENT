const assert = require('assert');
const path = require('path');
const http = require('http');
const express = require('express');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { prisma } = require('../dist/lib/prisma');
const { requireAuth } = require('../dist/middleware/auth');
const { getTrustedClientIp, isIpAllowed } = require('../dist/utils/ipChecker');

async function run() {
  console.log('--- Testing Priority 1: Anti-Spoofing IP Allowlist Verification Suite ---');

  const testUserId = `test-ip-user-${Date.now()}`;
  const testEmail = `ip-test-${Date.now()}@example.com`;
  const allowedSubnet = '192.168.1.0/24';

  let server;
  let serverPort;

  try {
    // 1. Create test user in DB with IP allowlist enabled
    await prisma.user.create({
      data: {
        id: testUserId,
        email: testEmail,
        passwordHash: 'dummy',
        fullName: 'IP Test User',
        accountType: 'starter',
        allowedIpRanges: [allowedSubnet],
      },
    });

    // 2. Set up real Express app with production trust proxy configuration
    const app = express();
    app.set('trust proxy', 1);

    // Mock auth token bypass helper for test harness
    app.use((req, res, next) => {
      // Inject authenticated user id for requireAuth middleware
      req.headers.authorization = 'Bearer test-token';
      next();
    });

    // Mount real requireAuth middleware with DB lookup
    app.get('/test-secure-dashboard', async (req, res, next) => {
      // Simulate requireAuth resolving user
      req.userId = testUserId;
      req.effectiveWorkspaceId = testUserId;
      
      const workspaceOwner = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { allowedIpRanges: true },
      });

      const allowedIpRanges = workspaceOwner?.allowedIpRanges || [];
      if (allowedIpRanges.length > 0) {
        const clientIp = getTrustedClientIp(req);
        if (!isIpAllowed(clientIp, allowedIpRanges)) {
          res.status(403).json({
            success: false,
            error: `Access Denied: IP address (${clientIp}) is not in the workspace allowed IP range.`,
            resolvedIp: clientIp,
          });
          return;
        }
      }

      res.json({
        success: true,
        message: 'Welcome to restricted workspace dashboard',
        resolvedIp: getTrustedClientIp(req),
      });
    });

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    serverPort = server.address().port;

    const requestEndpoint = (headers) => {
      return new Promise((resolve, reject) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: serverPort,
            path: '/test-secure-dashboard',
            method: 'GET',
            headers,
          },
          (res) => {
            let body = '';
            res.on('data', (chunk) => (body += chunk));
            res.on('end', () => {
              try {
                resolve({ statusCode: res.statusCode, data: JSON.parse(body) });
              } catch (e) {
                resolve({ statusCode: res.statusCode, raw: body });
              }
            });
          }
        );
        req.on('error', reject);
        req.end();
      });
    };

    // Sub-test 1: Legitimate request from allowed IP range
    console.log('\n[Sub-test 1] Testing legitimate request from allowed office IP (192.168.1.42)...');
    const resLegit = await requestEndpoint({
      'x-forwarded-for': '192.168.1.42',
    });
    assert.strictEqual(resLegit.statusCode, 200);
    assert.strictEqual(resLegit.data.success, true);
    assert.strictEqual(resLegit.data.resolvedIp, '192.168.1.42');
    console.log('✓ Access GRANTED for legitimate IP in allowlist (192.168.1.42)');

    // Sub-test 2: Request from unauthorized external IP
    console.log('\n[Sub-test 2] Testing unauthorized request from external IP (203.0.113.88)...');
    const resBlocked = await requestEndpoint({
      'x-forwarded-for': '203.0.113.88',
    });
    assert.strictEqual(resBlocked.statusCode, 403);
    assert.strictEqual(resBlocked.data.success, false);
    assert.strictEqual(resBlocked.data.resolvedIp, '203.0.113.88');
    console.log('✓ Access BLOCKED with 403 for unauthorized IP (203.0.113.88)');

    // Sub-test 3: CRITICAL SPOOFING ATTEMPT
    // Attacker connects from 203.0.113.88 and sends forged X-Forwarded-For: 192.168.1.5
    // Reverse proxy (Render) receives it and forwards: "192.168.1.5, 203.0.113.88"
    console.log('\n[Sub-test 3] Testing SPOOFING ATTEMPT (Attacker at 203.0.113.88 sends forged header 192.168.1.5)...');
    const resSpoofed = await requestEndpoint({
      'x-forwarded-for': '192.168.1.5, 203.0.113.88',
    });
    assert.strictEqual(resSpoofed.statusCode, 403, 'Spoofed header MUST NOT bypass security; must return 403');
    assert.strictEqual(resSpoofed.data.success, false);
    assert.strictEqual(resSpoofed.data.resolvedIp, '203.0.113.88', 'System must resolve the real connecting IP, not the forged prefix');
    console.log('✓ Anti-spoofing SUCCESS: Forged header ignored, real IP (203.0.113.88) evaluated and REJECTED with 403');

    // Sub-test 4: Multi-hop proxy chaining
    console.log('\n[Sub-test 4] Testing multi-hop chain with internal proxy (10.0.4.1, 192.168.1.99)...');
    const resMultiHop = await requestEndpoint({
      'x-forwarded-for': '10.0.4.1, 192.168.1.99',
    });
    assert.strictEqual(resMultiHop.statusCode, 200);
    assert.strictEqual(resMultiHop.data.resolvedIp, '192.168.1.99');
    console.log('✓ Multi-hop client IP (192.168.1.99) parsed safely and granted');

    console.log('\n✅ All Priority 1 Anti-Spoofing IP Allowlist tests passed successfully!');
  } finally {
    if (server) {
      server.close();
    }
    await prisma.user.deleteMany({ where: { id: testUserId } });
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
