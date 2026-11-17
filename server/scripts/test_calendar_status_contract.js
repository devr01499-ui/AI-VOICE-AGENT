require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * GET /api/v2/calendar/status must use the standard { success, data } envelope.
 * Without it the dashboard API client treats the answer as an error, so the Integrations page
 * always showed Google Calendar as "disconnected".
 *
 * Calls the production route handler directly (after its login check) against the local TEST
 * database, for a workspace with no calendar connection.
 *
 * Run: npm run test:calendar-status   (part of npm run test:security)
 */
const assert = require('assert');
const crypto = require('crypto');
const calendarRouter = require('../dist/routes/calendar').default;
const { prisma } = require('../dist/lib/prisma');

function findHandler(method, path) {
  const layer = calendarRouter.stack.find((l) => l.route && l.route.path === path && l.route.methods[method]);
  if (!layer) throw new Error(`route ${method.toUpperCase()} ${path} not found`);
  const stack = layer.route.stack;
  return stack[stack.length - 1].handle; // the handler that runs after requireAuth
}

function fakeRes() {
  const res = { statusCode: 200, body: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
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
  console.log('\n--- CALENDAR STATUS CONTRACT ---');
  const handler = findHandler('get', '/status');

  await test('not connected → { success: true, data: { connected: false, status: "disconnected" } }', async () => {
    const res = fakeRes();
    await handler({ effectiveWorkspaceId: crypto.randomUUID(), headers: {}, query: {} }, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true, 'envelope must carry success: true');
    assert.strictEqual(res.body.data.connected, false);
    assert.strictEqual(res.body.data.status, 'disconnected');
    assert.strictEqual('connected' in res.body, false, 'fields must live inside data, not at the top level');
  });

  await test('no workspace → 401 with success: false', async () => {
    const res = fakeRes();
    await handler({ headers: {}, query: {} }, res);
    assert.strictEqual(res.statusCode, 401);
  });

  console.log(`\nCALENDAR STATUS CONTRACT: ${passed === total ? 'PASS' : 'FAIL'} — ${passed}/${total} tests passed\n`);
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error in calendar status tests:', err);
  process.exit(1);
});
