require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Phase 12 (CLAUDE.md §7): security / traffic hardening — production code paths only.
 *
 *  - Rate limits cannot be dodged by sending a new `x-user-id` header per request (P5).
 *  - Outbound fetches to user-supplied URLs re-check the resolved IP when connecting, so a DNS
 *    name that resolves to a private/loopback address is refused (DNS rebinding, P10).
 *  - Production boot reports missing ENCRYPTION_KEY / carrier webhook secret (P9/P12).
 *  - CORS: localhost origins are refused in production; product domains allowed.
 *  - Toll fraud: only Indian numbers (no 1900/1860 premium-rate) unless a country is enabled.
 *  - Tenant isolation: a user cannot place a call with another customer's agent.
 * Run: npm run test:security-hardening   (part of npm run test:security)
 */
const assert = require('assert');
const http = require('http');
const crypto = require('crypto');
const { prisma } = require('../dist/lib/prisma');

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

async function main() {
  console.log('\n--- SECURITY HARDENING (Phase 12) ---');

  await test('rate-limit key ignores a client-sent x-user-id header', async () => {
    const { getRateLimitKey } = require('../dist/middleware/rateLimiter');
    const anon = { ip: '203.0.113.9', headers: { 'x-user-id': 'spoofed-1' } };
    assert.strictEqual(getRateLimitKey(anon), '203.0.113.9');
    assert.strictEqual(getRateLimitKey({ ...anon, headers: { 'x-user-id': 'spoofed-2' } }), '203.0.113.9');
    assert.strictEqual(getRateLimitKey({ ip: '203.0.113.9', userId: 'u-1', headers: {} }), 'user:u-1');
    assert.strictEqual(getRateLimitKey({ ip: '203.0.113.9', auth: { userId: 'u-2' }, headers: {} }), 'user:u-2');
  });

  await test('outbound fetch refuses a host that resolves to loopback at connect time (DNS rebinding)', async () => {
    const { ssrfSafeDispatcher } = require('../dist/utils/ssrfValidator');
    const server = http.createServer((_req, res) => res.end('internal-secret'));
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    try {
      // Without the dispatcher the request reaches the local service (proves the test is meaningful).
      const plain = await fetch(`http://localhost:${port}/`);
      assert.strictEqual(await plain.text(), 'internal-secret');
      let blocked = null;
      try {
        await fetch(`http://localhost:${port}/`, { dispatcher: ssrfSafeDispatcher });
      } catch (err) {
        blocked = err;
      }
      assert.ok(blocked, 'fetch through the SSRF dispatcher must fail');
      const code = blocked.cause?.code || blocked.code;
      assert.strictEqual(code, 'SSRF_BLOCKED', `expected SSRF_BLOCKED, got ${code}`);
    } finally {
      server.close();
    }
  });

  await test('every user-URL fetch (webhooks, MCP, tools, KB pages) uses the SSRF dispatcher', async () => {
    const fs = require('fs');
    const path = require('path');
    const files = ['utils/WebhookDispatcher.ts', 'services/McpService.ts', 'runtime/ToolExecutor.ts', 'controllers/KnowledgeBaseController.ts'];
    for (const f of files) {
      const src = fs.readFileSync(path.join(__dirname, '../src', f), 'utf8');
      const fetches = (src.match(/await fetch\(/g) || []).length;
      const guarded = (src.match(/dispatcher: ssrfSafeDispatcher/g) || []).length;
      assert.ok(fetches > 0 && guarded >= fetches, `${f}: ${guarded}/${fetches} fetches guarded`);
    }
  });

  await test('production boot reports missing encryption key and carrier webhook secret', async () => {
    const { auditSecretConfiguration } = require('../dist/config/env');
    const none = auditSecretConfiguration({});
    assert.strictEqual(none.length, 2);
    assert.ok(/LEGACY key/.test(none[0]) && /VOBIZ_WEBHOOK_SECRET/.test(none[1]));
    const onlyWebhook = auditSecretConfiguration({ VOBIZ_WEBHOOK_SECRET: 'w' });
    assert.strictEqual(onlyWebhook.length, 1);
    assert.ok(/derived from the carrier webhook secret/.test(onlyWebhook[0]));
    assert.deepStrictEqual(auditSecretConfiguration({ ENCRYPTION_KEY: 'k', VOBIZ_WEBHOOK_SECRET: 'w' }), []);
    assert.deepStrictEqual(auditSecretConfiguration({ ENCRYPTION_KEY: '  ', SIP_ENCRYPTION_KEY: 's' }).length, 1);
  });

  await test('CORS: product domains allowed; localhost refused in production, allowed in development', async () => {
    const { isAllowedCorsOrigin } = require('../dist/config/cors');
    const prod = { nodeEnv: 'production', frontendUrl: 'https://app.example-frontend.com/dashboard' };
    assert.ok(isAllowedCorsOrigin('https://claritiy.com', prod));
    assert.ok(isAllowedCorsOrigin('https://www.claritiy.com', prod));
    assert.ok(isAllowedCorsOrigin('https://admin.claritiy.com', prod));
    assert.ok(isAllowedCorsOrigin('https://app.example-frontend.com', prod), 'FRONTEND_URL origin');
    assert.ok(!isAllowedCorsOrigin('http://localhost:5173', prod));
    assert.ok(!isAllowedCorsOrigin('https://claritiy.com.evil.io', prod));
    assert.ok(!isAllowedCorsOrigin('https://evilclaritiy.com', prod));
    assert.ok(!isAllowedCorsOrigin('http://claritiy.com', prod), 'plain http refused');
    assert.ok(isAllowedCorsOrigin('http://localhost:5173', { nodeEnv: 'development' }));
  });

  await test('CORS: ADMIN_ORIGIN lists several exact console origins; never a wildcard; PATCH allowed', async () => {
    const { isAllowedCorsOrigin, adminOriginsFrom } = require('../dist/config/cors');
    const cfg = { nodeEnv: 'production', adminOrigin: 'https://claritiy-admin-abc123.vercel.app/ , https://admin.claritiy.com, *.vercel.app, not a url' };
    assert.deepStrictEqual(adminOriginsFrom(cfg.adminOrigin), ['https://claritiy-admin-abc123.vercel.app', 'https://admin.claritiy.com']);
    assert.ok(isAllowedCorsOrigin('https://claritiy-admin-abc123.vercel.app', cfg), 'the console on its Vercel address');
    assert.ok(!isAllowedCorsOrigin('https://someone-else.vercel.app', cfg), 'any other Vercel site refused');
    assert.deepStrictEqual(adminOriginsFrom(''), ['https://admin.claritiy.com'], 'default when unset');
    const src = require('fs').readFileSync(require('path').join(__dirname, '../src/index.ts'), 'utf8');
    assert.ok(/methods: \[[^\]]*'PATCH'/.test(src), 'PATCH in the CORS methods (admin console uses it)');
    assert.ok(src.includes('isAdminOrigin(origin, process.env.ADMIN_ORIGIN)'), 'admin route gate uses the same rule as CORS');
    // Deployment-address pattern for ONE Vercel project (every deploy gets a new address).
    const { isAdminOrigin, adminOriginPatternsFrom } = require('../dist/config/cors');
    const pat = 'https://ai-voice-agent-i23g-*-rohits-projects-50816922.vercel.app, https://ai-voice-agent-i23g.vercel.app';
    assert.ok(isAdminOrigin('https://ai-voice-agent-i23g-m0r1jash8-rohits-projects-50816922.vercel.app', pat), 'any deployment of that project');
    assert.ok(isAdminOrigin('https://ai-voice-agent-i23g.vercel.app', pat), 'its production address');
    assert.ok(isAllowedCorsOrigin('https://ai-voice-agent-i23g-56fnd9dim-rohits-projects-50816922.vercel.app', { nodeEnv: 'production', adminOrigin: pat }));
    assert.ok(!isAdminOrigin('https://ai-voice-agent-i23g-x-attacker-team.vercel.app', pat), 'another team refused');
    assert.ok(!isAdminOrigin('https://ai-voice-agent-i23g-a.b-rohits-projects-50816922.vercel.app', pat), 'star never spans a dot');
    assert.ok(!isAdminOrigin('https://evil.com/ai-voice-agent-i23g-x-rohits-projects-50816922.vercel.app', pat));
    assert.strictEqual(adminOriginPatternsFrom('*.vercel.app, https://*, https://ab*cd.vercel.app, http://abc*def.vercel.app').length, 0, 'no broad patterns, no plain http');
  });

  await test('toll fraud: Indian numbers allowed, premium-rate and foreign numbers refused by default', async () => {
    const { checkOutboundDestination: chk } = require('../dist/utils/destinationPolicy');
    for (const n of ['+919812345678', '919812345678', '09812345678', '9812345678', '+911123456789', '+918045678901']) {
      assert.ok(chk(n, '').allowed, `${n} should be allowed`);
    }
    for (const n of ['+911900123456', '+911860123456', '01900123456']) {
      const r = chk(n, '');
      assert.ok(!r.allowed && /Premium-rate/.test(r.reason), `${n} premium-rate`);
    }
    for (const n of ['+14155550100', '+442079460958', '+882345678901', '14155550100']) {
      assert.ok(!chk(n, '').allowed, `${n} should be refused`);
    }
    assert.ok(chk('+971501234567', '971').allowed, 'enabled country allowed');
    assert.ok(!chk('+14155550100', '971').allowed, 'other countries still refused');
  });

  await test('a user cannot place a call with another customer\'s agent (tenant isolation)', async () => {
    const { CallService } = require('../dist/services/CallService');
    const { callOrchestrator } = require('../dist/core/orchestrator/CallOrchestrator');
    const original = callOrchestrator.initiateOutboundCall;
    const dialed = [];
    callOrchestrator.initiateOutboundCall = async (phone, agentId, userId) => {
      dialed.push({ phone, agentId, userId });
      return crypto.randomUUID();
    };
    const owner = crypto.randomUUID();
    const attacker = crypto.randomUUID();
    try {
      for (const id of [owner, attacker]) {
        await prisma.user.create({ data: { id, email: `${id}@example.org`, fullName: 'Tenant', passwordHash: 'x', accountType: 'starter', callingBalanceMinutes: 100 } });
        await prisma.vobizSubAccount.create({ data: { userId: id, authId: `SA_${id.slice(0, 8)}`, authToken: 't', kycStatus: 'verified', kycCallsBlocked: false, walletFundedAt: new Date() } });
      }
      const agent = await prisma.agent.create({ data: { userId: owner, name: 'Owner agent', status: 'active', systemPrompt: 'private prompt' } });
      // The attacker is a fully set-up paying customer with their own verified caller ID.
      const attackerNumber = `+9198${Math.floor(10000000 + Math.random() * 89999999)}`;
      await prisma.phoneNumber.create({ data: { userId: attacker, phoneNumber: attackerNumber, status: 'active', kycStatus: 'verified', countryCode: 'IN', type: 'local', telephonyProvider: 'vobiz', monthlyCost: 500, setupFee: 0, currency: 'INR' } });
      let refused = null;
      try {
        await CallService.createCall({ phoneNumber: '+919812345678', agentId: agent.id, userId: attacker, fromPhoneNumber: attackerNumber });
      } catch (err) {
        refused = err;
      }
      assert.ok(refused, 'call with another tenant\'s agent must be refused');
      assert.strictEqual(refused.statusCode, 404, `${refused.statusCode} ${refused.message} ${JSON.stringify(refused.details || '')}`);
      assert.strictEqual(dialed.length, 0, 'nothing may be dialed');
      // Foreign destination is refused before anything else happens.
      let foreign = null;
      try {
        await CallService.createCall({ phoneNumber: '+14155550100', agentId: agent.id, userId: owner });
      } catch (err) {
        foreign = err;
      }
      assert.ok(foreign && /country/.test(JSON.stringify(foreign.details || foreign.message)));
      assert.strictEqual(dialed.length, 0);
    } finally {
      callOrchestrator.initiateOutboundCall = original;
    }
  });

  // ── Route-level tenant isolation (real routers, Supabase auth stubbed: token = user id) ──
  const express = require('express');
  const { supabaseClient } = require('../dist/utils/supabase');
  const originalGetUser = supabaseClient.auth.getUser;
  const emails = new Map();
  supabaseClient.auth.getUser = async (token) => {
    if (!emails.has(token)) return { data: { user: null }, error: { message: 'invalid' } };
    const now = new Date().toISOString();
    return { data: { user: { id: token, email: emails.get(token), email_confirmed_at: now, user_metadata: { email_confirmed_at: now } } }, error: null };
  };
  const newUser = async (accountType = 'starter') => {
    const id = crypto.randomUUID();
    const email = `sec-${id.slice(0, 8)}@claritiy-test.co.in`;
    emails.set(id, email);
    await prisma.user.create({ data: { id, email, fullName: 'Tenant', passwordHash: 'x', accountType, callingBalanceMinutes: 50 } });
    return { id, email };
  };
  const serve = async (mount) => {
    const app = express();
    app.use(express.json());
    mount(app);
    const server = http.createServer(app);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const call = (method, url, token, body) => fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
    return { server, call };
  };

  await test('calendar scheduling rules: another customer\'s agent can be neither read nor overwritten', async () => {
    const calendarRouter = require('../dist/routes/calendar').default;
    const owner = await newUser();
    const attacker = await newUser();
    const agent = await prisma.agent.create({ data: { userId: owner.id, name: 'Booking agent', status: 'active' } });
    const { server, call } = await serve((app) => app.use('/api/v2/calendar', calendarRouter));
    try {
      const saved = await call('POST', `/api/v2/calendar/rules/${agent.id}`, owner.id, { instructions: 'Only weekday mornings', maxBookingsPerDay: 4 });
      assert.strictEqual(saved.status, 200, JSON.stringify(saved.body));
      const read = await call('GET', `/api/v2/calendar/rules/${agent.id}`, owner.id);
      assert.strictEqual(read.status, 200);
      assert.strictEqual(read.body.rule.instructions, 'Only weekday mornings');

      const peek = await call('GET', `/api/v2/calendar/rules/${agent.id}`, attacker.id);
      assert.strictEqual(peek.status, 404, 'attacker must not read the rule');
      const overwrite = await call('POST', `/api/v2/calendar/rules/${agent.id}`, attacker.id, { instructions: 'Book everyone at 3am', maxBookingsPerDay: 99 });
      assert.strictEqual(overwrite.status, 404, 'attacker must not overwrite the rule');
      const slots = await call('POST', '/api/v2/calendar/slots', attacker.id, { agentId: agent.id });
      assert.strictEqual(slots.status, 404, 'attacker must not use the rule for slots');
      const rule = await prisma.agentSchedulingRule.findUnique({ where: { agentId: agent.id } });
      assert.strictEqual(rule.instructions, 'Only weekday mornings');
      assert.strictEqual(rule.maxBookingsPerDay, 4);
    } finally {
      server.close();
    }
  });

  await test('numbers: an agent id from another customer is never attached to a purchased number', async () => {
    const { ownedAgentIdOrNull } = require('../dist/utils/agentOwnership');
    const owner = await newUser();
    const other = await newUser();
    const agent = await prisma.agent.create({ data: { userId: owner.id, name: 'Inbound agent', status: 'active' } });
    assert.strictEqual(await ownedAgentIdOrNull(owner.id, agent.id), agent.id);
    assert.strictEqual(await ownedAgentIdOrNull(other.id, agent.id), null);
    assert.strictEqual(await ownedAgentIdOrNull(owner.id, ''), null);
    assert.strictEqual(await ownedAgentIdOrNull(owner.id, crypto.randomUUID()), null);
    const fs = require('fs');
    const path = require('path');
    for (const f of ['services/VobizPhoneNumberService.ts', 'core/telephony/PlivoService.ts']) {
      const src = fs.readFileSync(path.join(__dirname, '../src', f), 'utf8');
      assert.ok(/assignedAgentId: await ownedAgentIdOrNull\(/.test(src), `${f} must check agent ownership`);
      assert.ok(!/assignedAgentId: (params\.)?agentId \|\| null/.test(src), `${f} still trusts the request agent id`);
    }
    const inbound = fs.readFileSync(path.join(__dirname, '../src/services/InboundCallService.ts'), 'utf8');
    assert.ok(!/prisma\.agent\.findFirst\(\)/.test(inbound), 'no unscoped "any agent" fallback');
  });

  await test('legal consent: posting someone else\'s email does not mark their account as consented', async () => {
    const userRoutes = require('../dist/routes/user');
    const victim = await newUser();
    const { server, call } = await serve((app) => {
      app.use('/api/v2/user', userRoutes.publicUserRouter);
      app.use('/api/v2/user', userRoutes.default);
    });
    try {
      // Pretend the account was created an hour ago, so a new unlinked record is not signup consent.
      await prisma.user.update({ where: { id: victim.id }, data: { createdAt: new Date(Date.now() - 60 * 60 * 1000), hasConsentedTerms: false } });
      const forged = await call('POST', '/api/v2/user/consent', null, { email: victim.email, termsAndConditions: true, termsOfUse: true });
      assert.strictEqual(forged.status, 200, 'same answer as for anyone (no account enumeration)');
      let u = await prisma.user.findUnique({ where: { id: victim.id } });
      assert.strictEqual(u.hasConsentedTerms, false, 'forged consent must not mark the account');
      const rec = await prisma.userConsent.findFirst({ where: { email: victim.email }, orderBy: { consentedAt: 'desc' } });
      assert.strictEqual(rec.userId, null, 'forged consent stays unlinked');
      const status = await call('GET', '/api/v2/user/consent-status', victim.id);
      assert.strictEqual(status.status, 200);
      assert.strictEqual(status.body.data.hasConsented, false, 'a later unlinked record does not self-heal the flag');

      await new Promise((r) => setTimeout(r, 1600)); // the route paces requests from one IP
      const own = await call('POST', '/api/v2/user/consent', victim.id, { email: victim.email, termsAndConditions: true, termsOfUse: true });
      assert.strictEqual(own.status, 200, JSON.stringify(own.body));
      u = await prisma.user.findUnique({ where: { id: victim.id } });
      assert.strictEqual(u.hasConsentedTerms, true, 'the account holder\'s own consent is recorded');
    } finally {
      server.close();
    }
  });

  await test('alert evaluation aggregates in the database and computes the same metrics', async () => {
    const { AlertEvaluator } = require('../dist/services/AlertEvaluator');
    const u = await newUser();
    const agent = await prisma.agent.create({ data: { userId: u.id, name: 'Alert agent' } });
    const rows = [['completed', 'Positive', 120], ['completed', 'neutral', 60], ['failed', null, 0], ['canceled', null, 0]];
    for (const [status, sentiment, durationSeconds] of rows) {
      await prisma.call.create({ data: { userId: u.id, agentId: agent.id, recipientPhoneNumber: '+919812345678', status, sentiment, durationSeconds } });
    }
    const base = { userId: u.id, name: 'r', evaluationWindowMins: 60, comparator: 'greater_than', thresholdValue: 0 };
    const metric = async (m) => (await AlertEvaluator.evaluateSingleRule({ ...base, metric: m })).metricValue;
    assert.strictEqual(await metric('call_volume'), 4);
    assert.strictEqual(await metric('error_rate'), 50);
    assert.strictEqual(await metric('success_rate'), 50);
    assert.strictEqual(await metric('sentiment_score'), 25);
    // "cost" = billed minutes by the billing rule (audit #149): 120 s = 2 min, 60 s = 1 min, unanswered = 0.
    assert.strictEqual(await metric('cost'), 3);
  });

  supabaseClient.auth.getUser = originalGetUser;

  await test('logs: secrets removed, phone numbers and emails masked, ids kept', async () => {
    const { logger } = require('../dist/utils/logger');
    const lines = [];
    const orig = console.warn;
    console.warn = (line) => lines.push(line);
    try {
      const circular = { a: 1 };
      circular.self = circular;
      logger.warn('test', {
        callId: 'c-123', userId: 'u-1', authorization: 'Bearer abc.def', apiKey: 'AIzaSecret', webhookSecret: 'whsec_x',
        hasSignature: true, recipientPhoneNumber: '+919812345678', from: '+91 98123 45679', to: '2026-11-18',
        email: 'asha.k@example.org', nested: { password: 'p@ss', phone: '9812345670' }, err: new Error('boom'),
      });
      logger.warn('circular', { circular });
    } finally {
      console.warn = orig;
    }
    const out = JSON.parse(lines[0]);
    assert.strictEqual(out.callId, 'c-123');
    assert.strictEqual(out.userId, 'u-1');
    assert.strictEqual(out.authorization, '[REDACTED]');
    assert.strictEqual(out.apiKey, '[REDACTED]');
    assert.strictEqual(out.webhookSecret, '[REDACTED]');
    assert.strictEqual(out.hasSignature, true);
    assert.strictEqual(out.recipientPhoneNumber, '***5678');
    assert.strictEqual(out.from, '***5679');
    assert.strictEqual(out.to, '2026-11-18', 'dates are not phone numbers');
    assert.strictEqual(out.email, 'a***@example.org');
    assert.deepStrictEqual(out.nested, { password: '[REDACTED]', phone: '***5670' });
    assert.strictEqual(out.err.message, 'boom', 'errors are logged with their message (was {})');
    assert.ok(!lines[0].includes('9812345678') && !lines[0].includes('AIzaSecret') && !lines[0].includes('asha.k'));
    assert.ok(lines[1] && lines[1].includes('circular'), 'circular metadata does not throw');
  });

  await test('WebSocket servers cap message size (default would be 100 MB)', async () => {
    const fs = require('fs');
    const path = require('path');
    const limits = require('../dist/config/limits');
    assert.strictEqual(limits.WS_MAX_AUDIO_MESSAGE_BYTES, 1024 * 1024);
    assert.strictEqual(limits.WS_MAX_TRANSCRIPT_MESSAGE_BYTES, 64 * 1024);
    const src = require('fs').readFileSync(require('path').join(__dirname, '../src/index.ts'), 'utf8');
    const servers = src.match(/new WebSocketServer\(\{[\s\S]*?\}\)/g) || [];
    assert.strictEqual(servers.length, 3);
    for (const s of servers) assert.ok(/maxPayload: WS_MAX_/.test(s), s);
    // The cap is enforced by the ws library: an oversized message closes the socket with 1009.
    const { WebSocketServer, WebSocket } = require('ws');
    const wss = new WebSocketServer({ port: 0, host: '127.0.0.1', maxPayload: limits.WS_MAX_AUDIO_MESSAGE_BYTES });
    await new Promise((r) => wss.on('listening', r));
    // Like the production handlers (AudioStreamHandler, SandboxStreamHandler, transcript socket),
    // listen for the per-socket error so an oversized message closes only that socket.
    wss.on('connection', (s) => s.on('error', () => {}));
    try {
      const ws = new WebSocket(`ws://127.0.0.1:${wss.address().port}`);
      await new Promise((r) => ws.on('open', r));
      const code = await new Promise((resolve) => {
        ws.on('close', (c) => resolve(c));
        ws.send(Buffer.alloc(limits.WS_MAX_AUDIO_MESSAGE_BYTES + 1));
      });
      assert.strictEqual(code, 1009);
    } finally {
      wss.close();
    }
  });

  console.log(`\nSECURITY HARDENING: ${passed === total ? 'PASS' : 'FAIL'} — ${passed}/${total} tests passed\n`);
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error in security hardening tests:', err);
  process.exit(1);
});
