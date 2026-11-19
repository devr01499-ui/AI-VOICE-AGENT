require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
process.env.TZ = 'UTC'; // production (Render) runs in UTC
/**
 * Audit batch 3 (docs/AUDIT_FINDINGS.md) — real routers behind the real requireAuth (Supabase stubbed).
 *  #46/#47/#54/#57 viewers are read-only: contacts, alert rules, campaigns, bookings, calendar link
 *  #57 evaluate-now only evaluates the caller's own rules
 *  #48 a contact without a consent date is stored with none (not "now") and flagged for re-consent
 *  #63/#64 numeric phones in imports work; updates normalise the number and refuse duplicates (409)
 *  #80 "schedule for later" campaigns store their time and start when it comes
 * Run: npm run test:audit-batch3   (part of npm run test:security)
 */
const assert = require('assert');
const crypto = require('crypto');
const http = require('http');
const express = require('express');
const { prisma } = require('../dist/lib/prisma');

let total = 0;
let passed = 0;
async function test(name, fn) {
  total++;
  try { await fn(); passed++; console.log(`  ✓ ${name}`); } catch (err) { console.error(`  ✗ FAIL: ${name}\n    ${err.stack || err.message}`); }
}

async function main() {
  console.log('\n--- AUDIT BATCH 3 ---');
  const { supabaseClient } = require('../dist/utils/supabase');
  const { requireAuth } = require('../dist/middleware/auth');
  const emails = new Map();
  const origGetUser = supabaseClient.auth.getUser;
  supabaseClient.auth.getUser = async (token) => {
    if (!emails.has(token)) return { data: { user: null }, error: { message: 'invalid' } };
    const now = new Date().toISOString();
    return { data: { user: { id: token, email: emails.get(token), email_confirmed_at: now, user_metadata: { email_confirmed_at: now } } }, error: null };
  };
  const newUser = async (accountType = 'starter') => {
    const id = crypto.randomUUID();
    const email = `b3-${id.slice(0, 8)}@claritiy-test.co.in`;
    emails.set(id, email);
    await prisma.user.create({ data: { id, email, fullName: 'Batch Three', passwordHash: 'x', accountType, callingBalanceMinutes: 100, minutesRemainingSeconds: 6000 } });
    return id;
  };
  const app = express();
  app.use(express.json());
  app.use('/api/v2/contacts', require('../dist/routes/contacts').default);
  app.use('/api/v2/alerting', require('../dist/routes/alerting').default);
  app.use('/api/v2/calendar', require('../dist/routes/calendar').default);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (method, url, token, body) => fetch(base + url, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

  try {
    const owner = await newUser('starter');
    const viewer = await newUser('free');
    await prisma.teamMember.create({ data: { ownerId: owner, memberId: viewer, role: 'viewer' } });
    const agent = await prisma.agent.create({ data: { userId: owner, name: 'Camp', status: 'active' } });
    const contact = await prisma.contact.create({ data: { userId: owner, phoneNumber: '+919812300001', optedOutAt: new Date(), optOutReason: 'asked' } });

    await test('#46/#47/#54/#57 a viewer cannot change contacts, alert rules, campaigns, bookings or the calendar link', async () => {
      const attempts = [
        ['POST', '/api/v2/contacts', { phoneNumber: '+919812300002' }],
        ['PUT', `/api/v2/contacts/${contact.id}`, { optedOut: false }],
        ['DELETE', `/api/v2/contacts/${contact.id}`],
        ['POST', '/api/v2/contacts/import', { contacts: [{ phoneNumber: '+919812300003' }] }],
        ['POST', '/api/v2/alerting/rules', { name: 'x', metric: 'call_volume', comparator: 'greater_than', thresholdValue: 1 }],
        ['POST', '/api/v2/alerting/evaluate-now'],
        ['POST', '/api/v2/calendar/batches', { name: 'Viewer campaign', agentId: agent.id, recipients: ['+919812300004'] }],
        ['POST', `/api/v2/calendar/bookings/${crypto.randomUUID()}/cancel`, {}],
        ['POST', '/api/v2/calendar/link-from-signin', {}],
      ];
      for (const [m, u, b] of attempts) {
        const r = await call(m, u, viewer, b);
        assert.strictEqual(r.status, 403, `${m} ${u} -> ${r.status} ${JSON.stringify(r.body)}`);
      }
      const still = await prisma.contact.findUnique({ where: { id: contact.id } });
      assert.ok(still && still.optedOutAt, 'the opt-out is untouched');
    });

    await test('#57 evaluate-now evaluates only the caller\'s own rules', async () => {
      const other = await newUser('starter');
      const mine = await prisma.alertRule.create({ data: { userId: owner, name: 'mine', metric: 'call_volume', comparator: 'greater_than', thresholdValue: 1000, evaluationWindowMins: 60, checkFrequencyMins: 5, enabled: true } });
      const theirs = await prisma.alertRule.create({ data: { userId: other, name: 'theirs', metric: 'call_volume', comparator: 'greater_than', thresholdValue: 1000, evaluationWindowMins: 60, checkFrequencyMins: 5, enabled: true } });
      const r = await call('POST', '/api/v2/alerting/evaluate-now', owner);
      assert.ok(r.status === 200 || r.status === 201, JSON.stringify(r.body));
      assert.ok((await prisma.alertRule.findUnique({ where: { id: mine.id } })).lastEvaluatedAt, 'own rule evaluated');
      assert.strictEqual((await prisma.alertRule.findUnique({ where: { id: theirs.id } })).lastEvaluatedAt, null, 'another tenant\'s rule untouched');
    });

    await test('#48/#63 import: numeric phones work; no consent date stays empty and is flagged', async () => {
      const r = await call('POST', '/api/v2/contacts/import', owner, { contacts: [
        { phoneNumber: 9812300010, name: 'Numeric' },
        { phoneNumber: '+91 98123 00011', name: 'Dated', consentDate: new Date().toISOString() },
        { phoneNumber: '98123 00012', name: 'No consent' },
      ] });
      assert.ok(r.status === 200 || r.status === 201, JSON.stringify(r.body));
      const numeric = await prisma.contact.findFirst({ where: { userId: owner, phoneNumber: '+919812300010' } });
      assert.ok(numeric, 'numeric phone imported and normalised');
      const none = await prisma.contact.findFirst({ where: { userId: owner, phoneNumber: '+919812300012' } });
      assert.strictEqual(none.consentDate, null, 'no consent date recorded');
      const dated = await prisma.contact.findFirst({ where: { userId: owner, phoneNumber: '+919812300011' } });
      assert.ok(dated.consentDate);
      const list = await call('GET', '/api/v2/contacts?limit=100', owner);
      const rows = list.body.data.items || list.body.data;
      assert.strictEqual(rows.find((c) => c.phoneNumber === '+919812300012').requiresReconsent, true);
    });

    await test('#64 update normalises the number and refuses a duplicate with 409', async () => {
      const a = await prisma.contact.create({ data: { userId: owner, phoneNumber: '+919812300020' } });
      await prisma.contact.create({ data: { userId: owner, phoneNumber: '+919812300021' } });
      const ok = await call('PUT', `/api/v2/contacts/${a.id}`, owner, { phoneNumber: '98123 00022' });
      assert.strictEqual(ok.status, 200, JSON.stringify(ok.body));
      assert.strictEqual((await prisma.contact.findUnique({ where: { id: a.id } })).phoneNumber, '+919812300022');
      const dup = await call('PUT', `/api/v2/contacts/${a.id}`, owner, { phoneNumber: '+91 98123 00021' });
      assert.strictEqual(dup.status, 409);
    });

    await test('#80 a scheduled campaign stores its time, rejects a bad time, and starts when due', async () => {
      const { BatchService } = require('../dist/services/BatchService');
      const num = `+9180${Math.floor(10000000 + Math.random() * 89999999)}`;
      const pn = await prisma.phoneNumber.create({ data: { userId: owner, phoneNumber: num, status: 'active', kycStatus: 'verified', countryCode: 'IN', type: 'local', telephonyProvider: 'vobiz', monthlyCost: 0, setupFee: 0, currency: 'INR' } });
      const when = new Date(Date.now() + 2 * 3600_000);
      const body = { name: 'Later', agentId: agent.id, numberId: pn.id, recipients: ['+919812300031'], scheduleNow: false, scheduledAt: when.toISOString(), consentConfirmed: true, idempotencyKey: crypto.randomUUID() };
      const r = await call('POST', '/api/v2/calendar/batches', owner, body);
      assert.ok(r.status === 200 || r.status === 201, JSON.stringify(r.body));
      const batch = await prisma.batch.findFirst({ where: { userId: owner, name: 'Later' } });
      assert.strictEqual(batch.status, 'scheduled');
      assert.strictEqual(batch.scheduledAt.toISOString(), when.toISOString());
      const bad = await call('POST', '/api/v2/calendar/batches', owner, { ...body, name: 'Past', scheduledAt: new Date(Date.now() - 60_000).toISOString(), idempotencyKey: crypto.randomUUID() });
      assert.strictEqual(bad.status, 400);
      assert.strictEqual(bad.body.code, 'INVALID_SCHEDULE_TIME');
      assert.strictEqual(await BatchService.startDueScheduledBatches({ now: new Date(), dispatch: false }), 0, 'not yet due');
      assert.ok((await BatchService.startDueScheduledBatches({ now: new Date(when.getTime() + 1000), dispatch: false })) >= 1, 'starts when due');
      assert.strictEqual((await prisma.batch.findUnique({ where: { id: batch.id } })).status, 'running');
      assert.strictEqual(await BatchService.startDueScheduledBatches({ now: new Date(when.getTime() + 2000), dispatch: false }), 0, 'started once');
    });
  } finally {
    server.close();
    supabaseClient.auth.getUser = origGetUser;
  }

  console.log(`\nAUDIT BATCH 3: ${passed === total ? 'PASS' : 'FAIL'} — ${passed}/${total} tests passed\n`);
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}
main().catch((err) => { console.error('Fatal error in audit batch 3 tests:', err); process.exit(1); });
