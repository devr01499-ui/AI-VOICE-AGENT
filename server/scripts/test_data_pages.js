require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Phase 9 (issue B12): data pages — analytics numbers and exports.
 *  - Analytics days are Indian days (a call at 01:30 IST belongs to that IST date, not the UTC day before).
 *  - Billed minutes follow the billing rule (answered calls, per started minute, min 1); no made-up ₹ rate.
 *  - Bad or huge date ranges get a clear 400; other accounts' calls never count.
 *  - CSV exports (call history, reports, admin) are formula-safe.
 *
 * Production AnalyticsController and CSV helpers against the local TEST database.
 * Run: npm run test:data-pages   (part of npm run test:security)
 */
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { prisma } = require('../dist/lib/prisma');
const { AnalyticsController } = require('../dist/controllers/AnalyticsController');
const { sanitizeCsvCell, csvLine } = require('../dist/utils/csv');

let total = 0;
let passed = 0;
async function test(name, fn) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}\n    ${err.stack || err.message}`);
  }
}
function summary(userId, query) {
  return new Promise((resolve) => {
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { resolve({ status: this.statusCode, body: b }); return this; } };
    AnalyticsController.getAnalyticsSummary({ userId, query, headers: {} }, res);
  });
}

async function main() {
  console.log('\n--- DATA PAGES (B12) ---');
  const mkUser = async () => {
    const id = crypto.randomUUID();
    await prisma.user.create({ data: { id, email: `${id}@example.org`, fullName: 'Data Test', passwordHash: 'x', accountType: 'starter' } });
    return id;
  };
  const A = await mkUser();
  const B = await mkUser();
  const agentA = await prisma.agent.create({ data: { userId: A, name: 'A1' } });
  const agentA2 = await prisma.agent.create({ data: { userId: A, name: 'A2' } });
  const agentB = await prisma.agent.create({ data: { userId: B, name: 'B1' } });
  const call = (userId, agentId, at, status, dur, extra = {}) => prisma.call.create({ data: { userId, agentId, recipientPhoneNumber: '+919812345678', status, durationSeconds: dur, createdAt: new Date(at), ...extra } });
  // 2026-11-17 20:00 UTC = 2026-11-18 01:30 IST
  await call(A, agentA.id, '2026-11-17T20:00:00Z', 'completed', 61, { sentiment: 'Positive', callDirection: 'inbound' });
  await call(A, agentA.id, '2026-11-18T06:00:00Z', 'completed', 30, { sentiment: 'negative' });
  await call(A, agentA2.id, '2026-11-18T07:00:00Z', 'no_answer', 0);
  await call(A, agentA.id, '2026-11-17T10:00:00Z', 'failed', 0);
  await call(B, agentB.id, '2026-11-18T06:00:00Z', 'completed', 600);
  const range = { startDate: '2026-11-16T00:00:00Z', endDate: '2026-11-19T00:00:00Z' };

  await test('days are Indian days (01:30 IST counts on its own date)', async () => {
    const r = await summary(A, range);
    assert.strictEqual(r.status, 200);
    const days = Object.fromEntries(r.body.summary.volumeTrend.map((d) => [d.date, d.total]));
    assert.deepStrictEqual(days, { '2026-11-17': 1, '2026-11-18': 3 });
    assert.strictEqual(r.body.summary.timeZone, 'Asia/Kolkata');
  });

  await test('totals, billed minutes (per started minute) and splits match the database', async () => {
    const s = (await summary(A, range)).body.summary;
    assert.strictEqual(s.totalCalls, 4, 'other accounts never count');
    assert.deepStrictEqual(s.statusBreakdown, { completed: 2, failed: 1, noAnswer: 1, busy: 0, inProgress: 0 });
    assert.strictEqual(s.billedMinutes, 3, '61 s = 2 min, 30 s = 1 min, unanswered = 0');
    assert.strictEqual(s.averageDurationSeconds, 46);
    assert.strictEqual(s.directionSplit.inbound, 1);
    assert.strictEqual(s.sentimentBreakdown.positive, 1);
    assert.strictEqual(s.sentimentBreakdown.negative, 1);
    assert.ok(!('estimatedCostInr' in s) && !('estimatedCostUsd' in s), 'no made-up cost estimates');
    const byAgent = (await summary(A, { ...range, agentId: agentA2.id })).body.summary;
    assert.strictEqual(byAgent.totalCalls, 1);
  });

  await test('bad or huge date ranges get a clear 400', async () => {
    assert.strictEqual((await summary(A, { startDate: 'yesterday-ish' })).status, 400);
    assert.strictEqual((await summary(A, { startDate: '2020-01-01T00:00:00Z', endDate: '2026-11-18T00:00:00Z' })).status, 400);
    assert.strictEqual((await summary(A, { startDate: '2026-11-19T00:00:00Z', endDate: '2026-11-18T00:00:00Z' })).status, 400);
  });

  await test('CSV cells are formula-safe and quoted', async () => {
    assert.strictEqual(sanitizeCsvCell('=HYPERLINK("http://x","click")'), `"'=HYPERLINK(""http://x"",""click"")"`);
    assert.strictEqual(sanitizeCsvCell('+91 98123'), `"'+91 98123"`);
    assert.strictEqual(sanitizeCsvCell('@SUM(A1)'), `"'@SUM(A1)"`);
    assert.strictEqual(sanitizeCsvCell('Asha "the" caller'), '"Asha ""the"" caller"');
    assert.strictEqual(csvLine([1, null, 'x']), '"1","","x"');
  });

  await test('every CSV export uses the safe cell (call history page, reports, admin)', async () => {
    const admin = fs.readFileSync(path.join(__dirname, '../src/routes/adminRoutes.ts'), 'utf8');
    assert.ok((admin.match(/csvLine\(\[/g) || []).length >= 3, 'admin exports');
    const reports = fs.readFileSync(path.join(__dirname, '../src/routes/reports.ts'), 'utf8');
    assert.ok(reports.includes("from '../utils/csv'"));
    const app = fs.readFileSync(path.join(__dirname, '../../Frontend/src/app/App.tsx'), 'utf8');
    const exp = app.slice(app.indexOf('function handleExportCsv()'), app.indexOf('function handleExportCsv()') + 1500);
    assert.ok(exp.includes('csvRow(') && !exp.includes('.replace(/"/g'), 'call history export');
    const csvLib = fs.readFileSync(path.join(__dirname, '../../Frontend/src/app/lib/csv.ts'), 'utf8');
    assert.ok(csvLib.includes("/^[=+\\-@\\t\\r]/"), 'browser helper uses the same rule');
  });

  console.log(`\nDATA PAGES: ${passed === total ? 'PASS' : 'FAIL'} — ${passed}/${total} tests passed\n`);
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error in data page tests:', err);
  process.exit(1);
});
