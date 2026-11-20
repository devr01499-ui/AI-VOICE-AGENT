require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Demo readiness smoke (2026-11-20): every GET endpoint of the customer API, through the real
 * routers and the real login middleware (only the Supabase token check is stubbed), against a
 * realistic workspace on the TEST database.
 *  1. As the owner: no endpoint may answer 5xx or a non-JSON body.
 *  2. As another customer with the owner's ids: no endpoint may answer 200 with the owner's data.
 *  3. Without a token: every customer endpoint refuses (401/403), except the public ones listed.
 * Run: npm run test:demo-smoke   (part of npm run test:security)
 */
const assert = require('assert');
const crypto = require('crypto');
const http = require('http');
const express = require('express');
const { prisma } = require('../dist/lib/prisma');
const { supabaseClient } = require('../dist/utils/supabase');

const d = (p) => require('../dist/' + p);
const emails = new Map();
supabaseClient.auth.getUser = async (token) => {
  if (!emails.has(token)) return { data: { user: null }, error: { message: 'invalid' } };
  const now = new Date().toISOString();
  return { data: { user: { id: token, email: emails.get(token), email_confirmed_at: now, user_metadata: { email_confirmed_at: now } } }, error: null };
};

function buildApp() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(d('middleware/requestId').requestIdMiddleware);
  app.use(d('utils/whiteLabel').whiteLabelResponses);
  const { requireAuth } = d('middleware/auth');
  const { requireAuthOrApiKey } = d('middleware/authWrapper');
  app.use('/api/v2/calls', requireAuthOrApiKey, d('routes/calls').default);
  app.use('/api/v2/agents', requireAuth, d('routes/agents').default);
  app.use('/api/v2/numbers', requireAuth, d('routes/numbers').default);
  app.use('/api/v2/knowledge-base', requireAuth, d('routes/knowledgeBase').default);
  d('routes/user').mountUserRoutes(app, requireAuth);
  app.use('/api/v2/team', requireAuth, d('routes/team').default);
  app.use('/api/v2/apikeys', requireAuth, d('routes/apikeys').default);
  app.use('/api/v2/calendar', d('routes/calendar').default);
  app.use('/api/v2/kyc', d('routes/kyc').default);
  app.use('/api/v2/billing', requireAuth, d('routes/billing').default);
  app.use('/api/v2/chat-history', requireAuth, d('routes/chatHistory').default);
  app.use('/api/v2/contacts', requireAuth, d('routes/contacts').default);
  app.use('/api/v2/analytics', requireAuth, d('routes/analytics').default);
  app.use('/api/v2/qa', requireAuth, d('routes/qa').default);
  app.use('/api/v2/alerting', requireAuth, d('routes/alerting').default);
  app.use('/api/v2/audit-logs', requireAuth, d('routes/auditLog').default);
  app.use('/api/v2/reports', requireAuth, d('routes/reports').default);
  app.use((_req, res) => res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Endpoint not found' } }));
  app.use(d('utils/errorHandler').errorHandler);
  return app;
}

/** Every GET route under the customer API, with its mount prefix. */
function getRoutes() {
  const mounts = [
    ['/api/v2/calls', d('routes/calls').default], ['/api/v2/agents', d('routes/agents').default],
    ['/api/v2/numbers', d('routes/numbers').default], ['/api/v2/knowledge-base', d('routes/knowledgeBase').default],
    ['/api/v2/team', d('routes/team').default], ['/api/v2/apikeys', d('routes/apikeys').default],
    ['/api/v2/calendar', d('routes/calendar').default], ['/api/v2/kyc', d('routes/kyc').default],
    ['/api/v2/billing', d('routes/billing').default], ['/api/v2/chat-history', d('routes/chatHistory').default],
    ['/api/v2/contacts', d('routes/contacts').default], ['/api/v2/analytics', d('routes/analytics').default],
    ['/api/v2/qa', d('routes/qa').default], ['/api/v2/alerting', d('routes/alerting').default],
    ['/api/v2/audit-logs', d('routes/auditLog').default], ['/api/v2/reports', d('routes/reports').default],
  ];
  const out = [];
  const add = (prefix, router) => {
    for (const l of router.stack) if (l.route && l.route.methods.get) {
      for (const p of [].concat(l.route.path)) out.push(prefix + p);
    }
  };
  for (const [p, r] of mounts) add(p, r);
  const fakeApp = { use: (p, ...rs) => { for (const r of rs) if (r && r.stack) add(p, r); } };
  d('routes/user').mountUserRoutes(fakeApp, (q, s, n) => n());
  return [...new Set(out)];
}

/** Every POST/PUT/PATCH/DELETE route of the customer API (webhooks excluded: they use signatures). */
function getMutatingRoutes() {
  const mounts = [
    ['/api/v2/calls', d('routes/calls').default], ['/api/v2/agents', d('routes/agents').default],
    ['/api/v2/numbers', d('routes/numbers').default], ['/api/v2/knowledge-base', d('routes/knowledgeBase').default],
    ['/api/v2/team', d('routes/team').default], ['/api/v2/apikeys', d('routes/apikeys').default],
    ['/api/v2/calendar', d('routes/calendar').default], ['/api/v2/kyc', d('routes/kyc').default],
    ['/api/v2/billing', d('routes/billing').default], ['/api/v2/chat-history', d('routes/chatHistory').default],
    ['/api/v2/contacts', d('routes/contacts').default], ['/api/v2/qa', d('routes/qa').default],
    ['/api/v2/alerting', d('routes/alerting').default], ['/api/v2/reports', d('routes/reports').default],
  ];
  const out = [];
  const add = (prefix, router) => {
    for (const l of router.stack) if (l.route) for (const m of Object.keys(l.route.methods)) {
      if (m === 'get') continue;
      for (const p of [].concat(l.route.path)) out.push({ method: m.toUpperCase(), path: (prefix + p).replace(/\/$/, '') });
    }
  };
  for (const [p, r] of mounts) add(p, r);
  const fakeApp = { use: (p, ...rs) => { for (const r of rs) if (r && r.stack) add(p, r); } };
  d('routes/user').mountUserRoutes(fakeApp, (q, s, n) => n());
  return out.filter((m) => !/\/webhook/.test(m.path));
}

function request(port, method, path, token, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({ host: '127.0.0.1', port, method, path, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}) } }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => { let json = null; try { json = JSON.parse(raw); } catch {} resolve({ status: res.statusCode, type: res.headers['content-type'] || '', raw, json }); });
    });
    req.on('error', (e) => resolve({ status: 0, raw: String(e) }));
    req.setTimeout(20000, () => { req.destroy(); resolve({ status: 'timeout', raw: '' }); });
    if (data) req.write(data);
    req.end();
  });
}

let total = 0; let passed = 0;
async function test(name, fn) {
  total++;
  try { await fn(); passed++; console.log(`  ✓ ${name}`); } catch (err) { console.error(`  ✗ FAIL: ${name}\n    ${err.message}`); }
}

async function newUser(accountType = 'professional') {
  const id = crypto.randomUUID();
  const email = `demo-${id.slice(0, 8)}@claritiy-test.co.in`;
  emails.set(id, email);
  await prisma.user.create({ data: { id, email, fullName: 'Demo Owner', passwordHash: 'x', accountType, callingBalanceMinutes: 500, minutesRemainingSeconds: 30000, hasConsentedTerms: true } });
  return id;
}

async function main() {
  console.log('\n--- DEMO READINESS SMOKE ---');
  const owner = await newUser();
  const other = await newUser();
  // A realistic workspace
  const agent = await prisma.agent.create({ data: { userId: owner, name: 'Clinic Receptionist', status: 'active', systemPrompt: 'You are the receptionist of Lotus Dental.', agentConfig: '{}' } });
  const number = await prisma.phoneNumber.create({ data: { userId: owner, phoneNumber: `+9180${Math.floor(10000000 + Math.random() * 89999999)}`, countryCode: 'IN', telephonyProvider: 'vobiz', status: 'active', assignedAgentId: agent.id } });
  const call = await prisma.call.create({ data: { userId: owner, agentId: agent.id, recipientPhoneNumber: '+919876543210', fromPhoneNumber: number.phoneNumber, status: 'completed', durationSeconds: 95, startTime: new Date(Date.now() - 200000), endTime: new Date(Date.now() - 100000) } });
  await prisma.transcriptSegment.createMany({ data: [
    { callId: call.id, speaker: 'agent', content: 'Hello, Lotus Dental.', startTime: 0, endTime: 2, sequenceNumber: 1 },
    { callId: call.id, speaker: 'user', content: 'I want an appointment.', startTime: 3, endTime: 5, sequenceNumber: 2 },
  ] });
  await prisma.callResult.create({ data: { callId: call.id, workspaceId: owner, agentId: agent.id, resultLabel: 'Interested', confidence: 0.9, status: 'completed', score: 80 } });
  const contact = await prisma.contact.create({ data: { userId: owner, phoneNumber: '+919876543210', name: 'Asha' } });
  const batch = await prisma.batch.create({ data: { userId: owner, agentId: agent.id, name: 'Reminders', status: 'completed', totalRecipients: 1 } });
  const kb = await prisma.knowledgeBase.create({ data: { userId: owner, name: 'Fees', contentText: 'Consultation fee is 800 rupees.' } }).catch(() => null);
  const rule = await prisma.alertRule.create({ data: { userId: owner, name: 'Errors', metric: 'error_rate', comparator: 'greater_than', thresholdValue: 20 } });
  const cohort = await prisma.qaCohort.create({ data: { userId: owner, name: 'Week 1' } });

  const ids = {
    agentId: agent.id, id: agent.id, callId: call.id, numberId: number.id, phoneNumberId: number.id, contactId: contact.id,
    batchId: batch.id, kbId: kb ? kb.id : crypto.randomUUID(), docId: kb ? kb.id : crypto.randomUUID(), ruleId: rule.id, cohortId: cohort.id,
    memberId: crypto.randomUUID(), sessionId: crypto.randomUUID(), jobId: crypto.randomUUID(),
  };
  /** Fill a route's :params with the owner's real ids, by route area. */
  const fill = (route) => route.replace(/:(\w+)/g, (_m, name) => {
    if (name === 'id') {
      if (route.startsWith('/api/v2/calls')) return call.id;
      if (route.startsWith('/api/v2/numbers')) return number.id;
      if (route.startsWith('/api/v2/contacts')) return contact.id;
      if (route.startsWith('/api/v2/calendar/batches')) return batch.id;
      if (route.startsWith('/api/v2/knowledge-base')) return ids.kbId;
      if (route.startsWith('/api/v2/alerting')) return rule.id;
      if (route.startsWith('/api/v2/qa')) return cohort.id;
      return agent.id;
    }
    return ids[name] || crypto.randomUUID();
  });

  const server = http.createServer(buildApp());
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const routes = getRoutes().filter((r) => !/recording|stream|download|export|oauth|callback|transcript-ticket/i.test(r));

  try {
    await test(`every GET endpoint answers the owner without a server error (${routes.length} endpoints)`, async () => {
      const bad = [];
      for (const r of routes) {
        const path = fill(r);
        const res = await request(port, 'GET', path, owner);
        // Number search asks the carrier (no keys in tests): a clean 502 with a plain message is the
        // right answer when the carrier cannot be reached. Anything else 5xx is a server defect.
        const carrierDown = /\/numbers\/(plivo\/)?search$/.test(r) && res.status === 502 && res.json && res.json.success === false && !/carrier|auth|token/i.test(String(res.json.error));
        if (carrierDown) continue;
        if (res.status === 'timeout' || res.status === 0 || res.status >= 500) bad.push(`${res.status} GET ${r} → ${String(res.raw).slice(0, 160)}`);
        else if (!/json/.test(res.type) && res.status !== 204 && res.status !== 302) bad.push(`non-JSON ${res.status} GET ${r} (${res.type})`);
      }
      assert.deepStrictEqual(bad, [], '\n      ' + bad.join('\n      '));
    });

    await test('another customer gets nothing of the owner\'s through any id-based endpoint', async () => {
      const leaks = [];
      for (const r of routes.filter((x) => x.includes(':'))) {
        const path = fill(r);
        const res = await request(port, 'GET', path, other);
        if (res.status === 200) {
          const body = res.raw;
          if ([agent.id, call.id, number.phoneNumber, contact.phoneNumber, batch.id, rule.id, cohort.id, 'Lotus Dental', 'Clinic Receptionist'].some((v) => body.includes(v))) leaks.push(`GET ${r} → 200 with the owner's data`);
        }
      }
      assert.deepStrictEqual(leaks, [], '\n      ' + leaks.join('\n      '));
    });

    const mutating = getMutatingRoutes();

    await test(`another customer cannot change anything of the owner's (${mutating.filter((m) => m.path.includes(':')).length} id-based write endpoints)`, async () => {
      const ok = [];
      for (const m of mutating.filter((x) => x.path.includes(':'))) {
        const res = await request(port, m.method, fill(m.path), other, {});
        if (typeof res.status === 'number' && res.status >= 200 && res.status < 300) ok.push(`${m.method} ${m.path} → ${res.status}`);
      }
      // The owner's records are all still there and unchanged.
      assert.ok((await prisma.agent.findUnique({ where: { id: agent.id } })).status === 'active', 'agent untouched');
      assert.ok(await prisma.call.findUnique({ where: { id: call.id } }), 'call untouched');
      assert.ok(await prisma.contact.findUnique({ where: { id: contact.id } }), 'contact untouched');
      assert.ok(await prisma.alertRule.findUnique({ where: { id: rule.id } }), 'alert rule untouched');
      assert.ok(await prisma.qaCohort.findUnique({ where: { id: cohort.id } }), 'QA cohort untouched');
      assert.strictEqual((await prisma.phoneNumber.findUnique({ where: { id: number.id } })).assignedAgentId, agent.id, 'number untouched');
      assert.deepStrictEqual(ok, [], '\n      ' + ok.join('\n      '));
    });

    await test('a read-only (viewer) team member cannot change the workspace', async () => {
      const viewer = await newUser('free');
      await prisma.teamMember.create({ data: { ownerId: owner, memberId: viewer, role: 'viewer' } });
      // Harmless for a viewer: their own notifications, a transcript ticket to watch a call, read-only
      // knowledge-base search, free slot lookup, and pre-sign-up endpoints.
      const ALLOWED = [/\/user\/notifications/, /transcript-ticket$/, /\/knowledge-base\/test-query$/, /\/calendar\/slots$/, /\/user\/(validate-signup|consent)$/, /\/chat-history\/?$/];
      const changed = [];
      for (const m of mutating) {
        if (ALLOWED.some((a) => a.test(m.path))) continue;
        const res = await request(port, m.method, fill(m.path), viewer, {});
        if (typeof res.status === 'number' && res.status >= 200 && res.status < 300) changed.push(`${m.method} ${m.path} → ${res.status} ${String(res.raw).slice(0, 80)}`);
      }
      assert.ok(await prisma.agent.findUnique({ where: { id: agent.id } }), 'agent still there');
      assert.deepStrictEqual(changed, [], '\n      ' + changed.join('\n      '));
    });

    await test('without a login, customer endpoints refuse', async () => {
      const open = [];
      const PUBLIC = [/^\/api\/v2\/calendar\/oauth/, /^\/api\/v2\/kyc\/webhook/, /^\/api\/v2\/user\/consent-status/];
      for (const r of routes) {
        if (PUBLIC.some((p) => p.test(r))) continue;
        const res = await request(port, 'GET', fill(r), null);
        if (res.status === 200) open.push(`GET ${r} → 200 without a token`);
      }
      assert.deepStrictEqual(open, [], '\n      ' + open.join('\n      '));
    });
  } finally {
    server.close();
    await prisma.analysisJob.deleteMany({ where: { workspaceId: { in: [owner, other] } } }).catch(() => {});
  }

  console.log(`\nDEMO SMOKE: ${passed === total ? 'PASS' : 'FAIL'} — ${passed}/${total} tests passed`);
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}

main().catch(async (err) => { console.error(err); await prisma.$disconnect().catch(() => {}); process.exit(1); });
