require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Calendar bookings (Phase 4, "Scheduling & Calendar"):
 *  - list, cancel and reschedule answer in the standard { success, data } envelope (without it the
 *    dashboard showed no bookings and reported every successful cancel as a failure);
 *  - another workspace's booking is "not found";
 *  - if Google Calendar cannot delete the event, the booking is left unchanged (not silently
 *    marked cancelled while the event stays in the customer's calendar).
 *
 * Calls the production route handlers (after their login check) and CalendarService against the
 * local TEST database. No Google API call succeeds here (no valid tokens), which is exactly the
 * failure case under test.
 *
 * Run: npm run test:calendar-bookings   (part of npm run test:security)
 */
const assert = require('assert');
const crypto = require('crypto');
const calendarRouter = require('../dist/routes/calendar').default;
const { prisma } = require('../dist/lib/prisma');
const { sensitiveOperationsLimiter } = require('../dist/middleware/rateLimiter');

function handler(method, path) {
  const layer = calendarRouter.stack.find((l) => l.route && l.route.path === path && l.route.methods[method]);
  if (!layer) throw new Error(`route ${method.toUpperCase()} ${path} not found`);
  const stack = layer.route.stack;
  return { fn: stack[stack.length - 1].handle, middleware: stack.map((s) => s.name), handles: stack.map((s) => s.handle) };
}

function call(fn, { workspaceId, params = {}, body = {} }) {
  return new Promise((resolve) => {
    const res = { statusCode: 200 };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; resolve(res); return res; };
    Promise.resolve(fn({ effectiveWorkspaceId: workspaceId, userId: workspaceId, params, body, headers: {}, query: {} }, res)).catch((e) => resolve({ statusCode: 'threw', body: String(e) }));
  });
}

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

async function main() {
  const A = crypto.randomUUID();
  const B = crypto.randomUUID();
  for (const id of [A, B]) {
    await prisma.user.create({ data: { id, email: `${id}@example.org`, fullName: 'Calendar Test', passwordHash: 'x', accountType: 'professional' } });
  }
  const agent = await prisma.agent.create({ data: { userId: A, name: 'Receptionist', systemPrompt: 'You book appointments.' } });
  const start = new Date(Date.now() + 86_400_000);
  const mk = (extra) => prisma.calendarBooking.create({
    data: { workspaceId: A, agentId: agent.id, startUtc: start, endUtc: new Date(start.getTime() + 1_800_000), callerName: 'Asha', callerPhone: '+919876543210', idempotencyKey: crypto.randomUUID(), ...extra },
  });
  const plain = await mk({});
  const withGoogleEvent = await mk({ googleEventId: 'evt-123' });
  // A connection whose tokens cannot be used: Google deletion is guaranteed to fail.
  await prisma.calendarConnection.create({ data: { workspaceId: A, googleEmail: 'owner@example.org', encryptedTokens: 'not-a-valid-token-blob' } });

  console.log('\n--- CALENDAR BOOKINGS ---');
  const list = handler('get', '/bookings');
  const cancel = handler('post', '/bookings/:id/cancel');
  const reschedule = handler('post', '/bookings/:id/reschedule');

  await test('the bookings list uses the { success, data } envelope', async () => {
    const r = await call(list.fn, { workspaceId: A });
    assert.strictEqual(r.statusCode, 200);
    assert.strictEqual(r.body.success, true);
    assert.ok(Array.isArray(r.body.data));
    assert.ok(r.body.data.some((b) => b.id === plain.id));
  });

  await test('another workspace sees none of these bookings', async () => {
    const r = await call(list.fn, { workspaceId: B });
    assert.strictEqual(r.body.success, true);
    assert.ok(!r.body.data.some((b) => b.id === plain.id));
  });

  await test('another workspace cannot cancel the booking (404, unchanged)', async () => {
    const r = await call(cancel.fn, { workspaceId: B, params: { id: plain.id } });
    assert.strictEqual(r.statusCode, 404);
    assert.strictEqual(r.body.success, false);
    assert.strictEqual((await prisma.calendarBooking.findUnique({ where: { id: plain.id } })).status, 'confirmed');
  });

  await test('cancelling a booking without a Google event succeeds with the envelope', async () => {
    const r = await call(cancel.fn, { workspaceId: A, params: { id: plain.id } });
    assert.strictEqual(r.statusCode, 200);
    assert.strictEqual(r.body.success, true);
    assert.strictEqual(r.body.data.status, 'cancelled');
    assert.strictEqual((await prisma.calendarBooking.findUnique({ where: { id: plain.id } })).status, 'cancelled');
  });

  await test('if Google cannot delete the event, the booking is NOT marked cancelled', async () => {
    const r = await call(cancel.fn, { workspaceId: A, params: { id: withGoogleEvent.id } });
    assert.strictEqual(r.body.success, false);
    assert.ok([409, 502].includes(r.statusCode), `got ${r.statusCode}`);
    assert.strictEqual((await prisma.calendarBooking.findUnique({ where: { id: withGoogleEvent.id } })).status, 'confirmed');
  });

  await test('malformed ids and missing slots are rejected', async () => {
    assert.strictEqual((await call(cancel.fn, { workspaceId: A, params: { id: "x'; drop" } })).statusCode, 400);
    assert.strictEqual((await call(reschedule.fn, { workspaceId: A, params: { id: plain.id }, body: {} })).statusCode, 400);
  });

  await test('cancel and reschedule are rate limited and require login', async () => {
    for (const h of [cancel, reschedule]) {
      assert.ok(h.middleware.includes('requireAuth'), 'requireAuth missing');
      assert.ok(h.handles.includes(sensitiveOperationsLimiter), 'sensitiveOperationsLimiter missing');
    }
  });

  await prisma.calendarBooking.deleteMany({ where: { workspaceId: { in: [A, B] } } });
  await prisma.calendarConnection.deleteMany({ where: { workspaceId: { in: [A, B] } } });
  await prisma.agent.deleteMany({ where: { userId: { in: [A, B] } } });
  await prisma.user.deleteMany({ where: { id: { in: [A, B] } } });
  console.log(`\nCALENDAR BOOKINGS: ${passed === total ? 'PASS' : 'FAIL'} — ${passed}/${total} tests passed\n`);
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error in calendar booking tests:', err);
  process.exit(1);
});
