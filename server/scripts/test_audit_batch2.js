require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
process.env.TZ = 'UTC'; // production (Render) runs in UTC; the IST tests must hold there
/**
 * Audit batch 2 (docs/AUDIT_FINDINGS.md) — real routers behind the real requireAuth (Supabase stubbed).
 *  #43 GET /agents/playbooks reachable (was shadowed by GET /agents/:agentId)
 *  #44 reports cursor pagination returns every report exactly once
 *  #45 verify-gemini-key uses the standard envelope and only the customer's own key
 *  #76/#91 call list returns agentId / numbers / duration; inbound rows show the caller as contact
 *  #92 "Today" starts at 00:00 IST
 *  #51 day bounds are right at month ends
 *  #78/#141 transfer answers 501 instead of a fake "initiated"
 * Run: npm run test:audit-batch2   (part of npm run test:security)
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
  console.log('\n--- AUDIT BATCH 2 ---');
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
    const email = `b2-${id.slice(0, 8)}@claritiy-test.co.in`;
    emails.set(id, email);
    await prisma.user.create({ data: { id, email, fullName: 'Batch Two', passwordHash: 'x', accountType, callingBalanceMinutes: 50, minutesRemainingSeconds: 3000 } });
    return id;
  };
  const app = express();
  app.use(express.json());
  app.use('/api/v2/agents', require('../dist/routes/agents').default);
  app.use('/api/v2/calls', requireAuth, require('../dist/routes/calls').default);
  app.use('/api/v2/reports', requireAuth, require('../dist/routes/reports').default);
  app.use('/api/v2/user', requireAuth, require('../dist/routes/user').default);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (method, url, token, body) => fetch(base + url, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

  try {
    await test('#43 GET /agents/playbooks returns the playbooks (no longer shadowed by /:agentId)', async () => {
      const u = await newUser();
      const r = await call('GET', '/api/v2/agents/playbooks', u);
      assert.strictEqual(r.status, 200, JSON.stringify(r.body));
      assert.ok(Array.isArray(r.body.data) && r.body.data.length > 0);
    });

    await test('#44 report pages return every report exactly once', async () => {
      const u = await newUser();
      const agent = await prisma.agent.create({ data: { userId: u, name: 'Rep' } });
      const ids = [];
      for (let i = 0; i < 25; i++) {
        const c = await prisma.call.create({ data: { userId: u, agentId: agent.id, recipientPhoneNumber: `+9198123${String(10000 + i)}`, status: 'completed', durationSeconds: 60 } });
        await prisma.callResult.create({ data: { callId: c.id, workspaceId: u, agentId: agent.id, resultLabel: 'Interested', confidence: 0.9, createdAt: new Date(Date.now() - i * 1000) } });
        ids.push(c.id);
      }
      const seen = [];
      let cursor = null;
      for (let page = 0; page < 10; page++) {
        const r = await call('GET', `/api/v2/reports?limit=10${cursor ? `&cursor=${cursor}` : ''}`, u);
        assert.strictEqual(r.status, 200, JSON.stringify(r.body));
        const items = r.body.data.items || r.body.data;
        seen.push(...items.map((x) => x.callId || x.call?.id || x.id));
        cursor = r.body.data.nextCursor ?? r.body.nextCursor ?? null;
        if (!cursor) break;
      }
      assert.strictEqual(seen.length, 25, `saw ${seen.length} rows`);
      assert.strictEqual(new Set(seen).size, 25, 'no duplicates');
    });

    await test('#45 verify-gemini-key: standard envelope; no saved key -> valid:false, never the platform key', async () => {
      const u = await newUser();
      const origFetch = global.fetch;
      let called = 0;
      global.fetch = async (url, opts) => {
        if (String(url).includes('generativelanguage') || String(url).includes('/v1alpha/models')) {
          called++;
          assert.ok(!String(url).includes('key='), 'key must not be in the URL');
          assert.strictEqual(opts.headers['x-goog-api-key'], 'AIza-test-customer-key');
          return new Response(JSON.stringify({ models: [{ name: 'm1' }, { name: 'm2' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        return origFetch(url, opts);
      };
      try {
        const none = await call('POST', '/api/v2/user/verify-gemini-key', u, {});
        assert.strictEqual(none.body.success, true);
        assert.strictEqual(none.body.data.valid, false);
        assert.strictEqual(called, 0, 'the platform key is never tested');
        const ok = await call('POST', '/api/v2/user/verify-gemini-key', u, { geminiApiKey: 'AIza-test-customer-key' });
        assert.strictEqual(ok.body.success, true, JSON.stringify(ok.body));
        assert.deepStrictEqual({ valid: ok.body.data.valid, n: ok.body.data.availableModelsCount }, { valid: true, n: 2 });
      } finally {
        global.fetch = origFetch;
      }
    });

    await test('#76/#91 call list returns agentId, numbers and duration; inbound contact is the caller', async () => {
      const u = await newUser();
      const agent = await prisma.agent.create({ data: { userId: u, name: 'Lister' } });
      await prisma.call.create({ data: { userId: u, agentId: agent.id, recipientPhoneNumber: '+919812345678', fromPhoneNumber: '+918045670000', status: 'completed', durationSeconds: 65, callDirection: 'outbound' } });
      await prisma.call.create({ data: { userId: u, agentId: agent.id, recipientPhoneNumber: '+918045670000', fromPhoneNumber: '+919700000001', status: 'completed', durationSeconds: 5, callDirection: 'inbound' } });
      const r = await call('GET', '/api/v2/calls?limit=10', u);
      assert.strictEqual(r.status, 200);
      const out = r.body.data.find((c) => c.direction === 'outbound');
      const inn = r.body.data.find((c) => c.direction === 'inbound');
      assert.strictEqual(out.agentId, agent.id);
      assert.strictEqual(out.agent.name, 'Lister');
      assert.strictEqual(out.duration, 65);
      assert.strictEqual(out.billedMinutes, 2, '65 s = 2 started minutes');
      assert.strictEqual(inn.billedMinutes, 1, 'any connected call bills at least 1 minute');
      assert.strictEqual(out.contactNumber, '+919812345678');
      assert.strictEqual(inn.contactNumber, '+919700000001', 'inbound contact is the caller');
      assert.strictEqual(inn.businessNumber, '+918045670000');
      assert.strictEqual(inn.recipientPhoneNumber, '+918045670000');
    });

    await test('#92 "Today" starts at 00:00 IST', async () => {
      const u = await newUser();
      const agent = await prisma.agent.create({ data: { userId: u, name: 'T' } });
      const istDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
      const { getWorkspaceDayBounds } = require('../dist/lib/calendar/timezone');
      const { startUtc } = getWorkspaceDayBounds(istDate, 'Asia/Kolkata');
      const justAfterIstMidnight = new Date(startUtc.getTime() + 60 * 1000);
      const yesterdayIst = new Date(startUtc.getTime() - 60 * 1000);
      await prisma.call.create({ data: { userId: u, agentId: agent.id, recipientPhoneNumber: '+919811111111', status: 'completed', createdAt: justAfterIstMidnight } });
      await prisma.call.create({ data: { userId: u, agentId: agent.id, recipientPhoneNumber: '+919822222222', status: 'completed', createdAt: yesterdayIst } });
      const r = await call('GET', '/api/v2/calls?dateRange=today&limit=50', u);
      const nums = r.body.data.map((c) => c.contactNumber);
      assert.ok(nums.includes('+919811111111'), 'a call at 00:01 IST today is in Today');
      assert.ok(!nums.includes('+919822222222'), 'a call at 23:59 IST yesterday is not');
    });

    await test('#51 day bounds are exact at month ends (IST)', async () => {
      const { getWorkspaceDayBounds } = require('../dist/lib/calendar/timezone');
      for (const [d, start, end] of [
        ['2026-10-31', '2026-10-30T18:30:00.000Z', '2026-10-31T18:29:59.999Z'],
        ['2026-01-31', '2026-01-30T18:30:00.000Z', '2026-01-31T18:29:59.999Z'],
        ['2026-12-31', '2026-12-30T18:30:00.000Z', '2026-12-31T18:29:59.999Z'],
        ['2028-02-29', '2028-02-28T18:30:00.000Z', '2028-02-29T18:29:59.999Z'],
      ]) {
        const b = getWorkspaceDayBounds(d, 'Asia/Kolkata');
        assert.deepStrictEqual([b.startUtc.toISOString(), b.endUtc.toISOString()], [start, end], d);
      }
    });

    await test('#78/#141 transfer never fakes success: no carrier call id -> refused, nothing written', async () => {
      const u = await newUser();
      const agent = await prisma.agent.create({ data: { userId: u, name: 'X' } });
      const c = await prisma.call.create({ data: { userId: u, agentId: agent.id, recipientPhoneNumber: '+919833333333', status: 'in_progress', userData: '{}' } });
      const r = await call('POST', `/api/v2/calls/${c.id}/transfer`, u, { targetNumber: '+919844444444' });
      // Live transfer is built now (test_call_transfer covers success); without a carrier call it cannot happen.
      assert.ok([403, 409].includes(r.status), `status ${r.status}`);
      assert.notStrictEqual(r.body.success, true);
      const after = await prisma.call.findUnique({ where: { id: c.id } });
      assert.strictEqual(after.userData, '{}', 'nothing written');
      const bad = await call('POST', `/api/v2/calls/${c.id}/transfer`, u, { targetNumber: '+911900123456' });
      assert.strictEqual(bad.status, 400, 'premium-rate number refused');
    });
  } finally {
    server.close();
    supabaseClient.auth.getUser = origGetUser;
  }

  console.log(`\nAUDIT BATCH 2: ${passed === total ? 'PASS' : 'FAIL'} — ${passed}/${total} tests passed\n`);
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}
main().catch((err) => { console.error('Fatal error in audit batch 2 tests:', err); process.exit(1); });
