const assert = require('assert');
const path = require('path');
const http = require('http');
const express = require('express');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { prisma } = require('../dist/lib/prisma');
const { requireRole } = require('../dist/middleware/auth');

async function run() {
  console.log('--- Testing Real RBAC Middleware & Routes against Database ---');

  const ownerId = `owner-rbac-${Date.now()}`;
  const memberId = `member-rbac-${Date.now()}`;

  let server;
  let port;

  try {
    // 1. Create real database records
    await prisma.user.create({
      data: {
        id: ownerId,
        email: `owner-${Date.now()}@example.com`,
        passwordHash: 'dummy',
        fullName: 'Workspace Owner',
        accountType: 'starter',
      },
    });

    await prisma.user.create({
      data: {
        id: memberId,
        email: `member-${Date.now()}@example.com`,
        passwordHash: 'dummy',
        fullName: 'Team Member',
        accountType: 'free',
      },
    });

    const teamEntry = await prisma.teamMember.create({
      data: {
        ownerId: ownerId,
        memberId: memberId,
        role: 'viewer',
      },
    });

    // 2. Setup real Express app with real requireRole middleware
    const app = express();

    // Middleware simulating authentication session resolution
    app.use(async (req, res, next) => {
      const activeUserId = req.headers['x-test-user-id'];
      if (!activeUserId) {
        res.status(401).json({ error: 'No test user header' });
        return;
      }

      req.userId = activeUserId;
      const member = await prisma.teamMember.findFirst({ where: { memberId: activeUserId } });
      if (member) {
        req.effectiveWorkspaceId = member.ownerId;
        req.workspaceRole = member.role;
      } else {
        req.effectiveWorkspaceId = activeUserId;
        req.workspaceRole = 'admin'; // Owner is permanent admin
      }
      next();
    });

    // Admin-only route
    app.post('/api/v2/team/billing-settings', requireRole(['admin']), (req, res) => {
      res.json({ success: true, message: 'Admin action permitted' });
    });

    // Developer-level route
    app.post('/api/v2/agents/create', requireRole(['admin', 'developer']), (req, res) => {
      res.json({ success: true, message: 'Agent creation permitted' });
    });

    // Viewer-level route
    app.get('/api/v2/analytics/view', requireRole(['admin', 'developer', 'analyst', 'viewer']), (req, res) => {
      res.json({ success: true, message: 'Analytics read permitted' });
    });

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    port = server.address().port;

    const testRequest = (userId, path, method = 'GET') => {
      return new Promise((resolve, reject) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port,
            path,
            method,
            headers: { 'x-test-user-id': userId },
          },
          (res) => {
            let body = '';
            res.on('data', (c) => (body += c));
            res.on('end', () => resolve({ statusCode: res.statusCode, body }));
          }
        );
        req.on('error', reject);
        req.end();
      });
    };

    // Sub-test 1: Viewer accessing viewer route -> 200 OK
    console.log('\n[Sub-test 1] Testing viewer access to read-only route...');
    const resViewerRead = await testRequest(memberId, '/api/v2/analytics/view', 'GET');
    assert.strictEqual(resViewerRead.statusCode, 200);
    console.log('✓ Viewer access to analytics GRANTED (200)');

    // Sub-test 2: Viewer accessing admin route -> 403 Forbidden
    console.log('\n[Sub-test 2] Testing viewer access to admin billing route...');
    const resViewerAdmin = await testRequest(memberId, '/api/v2/team/billing-settings', 'POST');
    assert.strictEqual(resViewerAdmin.statusCode, 403);
    console.log('✓ Viewer access to admin billing BLOCKED (403)');

    // Sub-test 3: Promote viewer to developer in real DB
    console.log('\n[Sub-test 3] Promoting member to developer in PostgreSQL...');
    await prisma.teamMember.update({
      where: { id: teamEntry.id },
      data: { role: 'developer' },
    });
    const resDevAgent = await testRequest(memberId, '/api/v2/agents/create', 'POST');
    assert.strictEqual(resDevAgent.statusCode, 200);
    console.log('✓ Developer access to agent creation GRANTED (200)');
    const resDevAdmin = await testRequest(memberId, '/api/v2/team/billing-settings', 'POST');
    assert.strictEqual(resDevAdmin.statusCode, 403);
    console.log('✓ Developer access to admin billing still BLOCKED (403)');

    // Sub-test 4: Workspace Owner has permanent admin immunity
    console.log('\n[Sub-test 4] Testing workspace owner permanent admin immunity...');
    const resOwnerAdmin = await testRequest(ownerId, '/api/v2/team/billing-settings', 'POST');
    assert.strictEqual(resOwnerAdmin.statusCode, 200);
    console.log('✓ Workspace owner access to admin route GRANTED (200)');

    console.log('\n✅ All Real RBAC route tests passed successfully!');
  } finally {
    if (server) server.close();
    await prisma.teamMember.deleteMany({ where: { ownerId } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, memberId] } } });
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
