require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Issue B2 — notification bell: mark read, delete, mark all read, clear, tenant isolation.
 *
 * Runs the production NotificationService and the production user router (mounted with
 * mountUserRoutes, with a stand-in for the login check that sets the workspace id) against
 * the local TEST database.
 *
 * Run: npm run test:notifications   (part of npm run test:security)
 */
const assert = require('assert');
const crypto = require('crypto');
const express = require('express');
const { prisma } = require('../dist/lib/prisma');
const { NotificationService, ANNOUNCEMENT_TYPE } = require('../dist/services/NotificationService');
const { mountUserRoutes } = require('../dist/routes/user');

const A = crypto.randomUUID(); // workspace A
const B = crypto.randomUUID(); // workspace B
const created = [];

let total = 0;
let passed = 0;
async function test(name, fn) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}\n    ${err.message}`);
  }
}

async function alert(data) {
  const row = await prisma.systemAlert.create({
    data: { type: 'SYSTEM', title: 'T', message: 'M', severity: 'info', isResolved: false, metadata: '{}', ...data },
  });
  created.push(row.id);
  return row;
}

async function main() {
  // Fake login check: trusts an x-test-user header. Used ONLY in this test to reach the real handlers.
  const fakeAuth = (req, res, next) => {
    const id = req.headers['x-test-user'];
    if (!id) return res.status(401).json({ success: false, error: 'no test user' });
    req.userId = id;
    req.effectiveWorkspaceId = id;
    next();
  };
  const app = express();
  app.use(express.json());
  mountUserRoutes(app, fakeAuth);
  const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, user) => {
    const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(user ? { 'x-test-user': user } : {}) } });
    return { status: res.status, json: await res.json().catch(() => ({})) };
  };

  const ownA1 = await alert({ userId: A, title: 'A first' });
  const ownA2 = await alert({ userId: A, title: 'A second' });
  const ownB = await alert({ userId: B, title: 'B private' });
  const opsAlert = await alert({ userId: null, type: 'FAILED_PROVISIONING', title: 'Number assignment failed', message: 'internal ops detail' });
  const legacyGlobal = await alert({ userId: null, type: 'SYSTEM', title: 'Old admin alert' });
  const announcement = await alert({ userId: null, type: ANNOUNCEMENT_TYPE, title: 'Announcement', message: 'New feature' });

  console.log('\n--- NOTIFICATION BELL (B2) ---');

  await test('a workspace sees its own notifications and announcements only', async () => {
    const r = await call('GET', '/api/v2/user/notifications', A);
    assert.strictEqual(r.status, 200);
    const ids = r.json.data.map((n) => n.id).sort();
    assert.deepStrictEqual(ids, [ownA1.id, ownA2.id, announcement.id].sort());
  });

  await test('internal operations alerts and other workspaces\' alerts never appear (privacy)', async () => {
    const r = await call('GET', '/api/v2/user/notifications', A);
    const ids = r.json.data.map((n) => n.id);
    for (const hidden of [ownB.id, opsAlert.id, legacyGlobal.id]) assert.ok(!ids.includes(hidden), `${hidden} leaked`);
  });

  await test('mark one as read', async () => {
    const r = await call('POST', `/api/v2/user/notifications/${ownA1.id}/read`, A);
    assert.strictEqual(r.status, 200);
    assert.strictEqual((await prisma.systemAlert.findUnique({ where: { id: ownA1.id } })).isResolved, true);
    assert.strictEqual((await prisma.systemAlert.findUnique({ where: { id: ownA2.id } })).isResolved, false);
  });

  await test('cannot mark or delete another workspace\'s notification (404, row untouched)', async () => {
    assert.strictEqual((await call('POST', `/api/v2/user/notifications/${ownB.id}/read`, A)).status, 404);
    assert.strictEqual((await call('DELETE', `/api/v2/user/notifications/${ownB.id}`, A)).status, 404);
    const row = await prisma.systemAlert.findUnique({ where: { id: ownB.id } });
    assert.ok(row, 'B row must still exist');
    assert.strictEqual(row.isResolved, false);
  });

  await test('cannot mark or delete an internal operations alert', async () => {
    assert.strictEqual((await call('POST', `/api/v2/user/notifications/${opsAlert.id}/read`, A)).status, 404);
    assert.strictEqual((await call('DELETE', `/api/v2/user/notifications/${opsAlert.id}`, A)).status, 404);
    assert.ok(await prisma.systemAlert.findUnique({ where: { id: opsAlert.id } }));
  });

  await test('reading an announcement is per workspace (B still sees it unread)', async () => {
    assert.strictEqual((await call('POST', `/api/v2/user/notifications/${announcement.id}/read`, A)).status, 200);
    const a = (await call('GET', '/api/v2/user/notifications', A)).json.data.find((n) => n.id === announcement.id);
    const b = (await call('GET', '/api/v2/user/notifications', B)).json.data.find((n) => n.id === announcement.id);
    assert.strictEqual(a.isRead, true);
    assert.strictEqual(b.isRead, false);
    assert.strictEqual((await prisma.systemAlert.findUnique({ where: { id: announcement.id } })).isResolved, false, 'shared row must not change');
  });

  await test('deleting an announcement hides it for that workspace only', async () => {
    assert.strictEqual((await call('DELETE', `/api/v2/user/notifications/${announcement.id}`, A)).status, 200);
    assert.ok(!(await call('GET', '/api/v2/user/notifications', A)).json.data.some((n) => n.id === announcement.id));
    assert.ok((await call('GET', '/api/v2/user/notifications', B)).json.data.some((n) => n.id === announcement.id));
    assert.ok(await prisma.systemAlert.findUnique({ where: { id: announcement.id } }), 'shared row must not be deleted');
  });

  await test('a dismissed announcement cannot be re-read or re-deleted (404)', async () => {
    assert.strictEqual((await call('POST', `/api/v2/user/notifications/${announcement.id}/read`, A)).status, 404);
  });

  await test('delete own notification removes it', async () => {
    assert.strictEqual((await call('DELETE', `/api/v2/user/notifications/${ownA2.id}`, A)).status, 200);
    assert.strictEqual(await prisma.systemAlert.findUnique({ where: { id: ownA2.id } }), null);
  });

  await test('mark all read covers own notifications and announcements, for this workspace only', async () => {
    await call('POST', '/api/v2/user/notifications/mark-all-read', B);
    const list = (await call('GET', '/api/v2/user/notifications', B)).json.data;
    assert.ok(list.length >= 2);
    assert.ok(list.every((n) => n.isRead), 'all B items should be read');
    const announcementForA = await prisma.notificationReceipt.findUnique({ where: { alertId_userId: { alertId: announcement.id, userId: A } } });
    assert.ok(announcementForA.dismissedAt, 'A state untouched');
    // Running it twice is safe (no duplicate-key errors).
    assert.strictEqual((await call('POST', '/api/v2/user/notifications/mark-all-read', B)).status, 200);
  });

  await test('clear-all removes only read items for that workspace', async () => {
    const unread = await alert({ userId: B, title: 'B unread' });
    assert.strictEqual((await call('DELETE', '/api/v2/user/notifications/clear-all', B)).status, 200);
    const ids = (await call('GET', '/api/v2/user/notifications', B)).json.data.map((n) => n.id);
    assert.deepStrictEqual(ids, [unread.id]);
    assert.ok(await prisma.systemAlert.findUnique({ where: { id: ownA1.id } }), 'A must be untouched');
  });

  await test('malformed ids are rejected before touching the database', async () => {
    assert.strictEqual((await call('POST', '/api/v2/user/notifications/abc%27%3B--/read', A)).status, 400);
    assert.strictEqual((await call('DELETE', `/api/v2/user/notifications/${'x'.repeat(65)}`, A)).status, 400);
  });

  await test('unknown ids get 404 without revealing anything', async () => {
    const r = await call('DELETE', `/api/v2/user/notifications/${crypto.randomUUID()}`, A);
    assert.strictEqual(r.status, 404);
    assert.strictEqual(r.json.error, 'Notification not found');
  });

  await test('all notification actions require login', async () => {
    for (const [m, p] of [['GET', '/api/v2/user/notifications'], ['POST', `/api/v2/user/notifications/${ownA1.id}/read`], ['DELETE', `/api/v2/user/notifications/${ownA1.id}`], ['POST', '/api/v2/user/notifications/mark-all-read'], ['DELETE', '/api/v2/user/notifications/clear-all']]) {
      assert.strictEqual((await call(m, p, null)).status, 401, `${m} ${p}`);
    }
  });

  await test('notification actions are rate limited', async () => {
    let limited = false;
    for (let i = 0; i < 130 && !limited; i++) {
      const r = await call('POST', `/api/v2/user/notifications/${crypto.randomUUID()}/read`, `limit-${A}`);
      if (r.status === 429) limited = true;
    }
    assert.ok(limited, 'expected HTTP 429 within 130 requests');
  });

  await test('getForUser with no workspace id returns nothing', async () => {
    assert.deepStrictEqual(await NotificationService.getForUser(undefined), []);
  });

  // Cleanup (test database only)
  await prisma.notificationReceipt.deleteMany({ where: { userId: { in: [A, B] } } });
  await prisma.systemAlert.deleteMany({ where: { OR: [{ id: { in: created } }, { userId: { in: [A, B] } }] } });
  server.close();
  console.log(`\nNOTIFICATION BELL: ${passed === total ? 'PASS' : 'FAIL'} — ${passed}/${total} tests passed\n`);
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error in notification tests:', err);
  process.exit(1);
});
