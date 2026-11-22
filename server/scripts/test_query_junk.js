require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Audit #161: junk in a query string must never crash a read endpoint. Every customer GET route
 * is called with bad numbers, bad dates, odd characters and huge values, and must answer below
 * 500 (a 400 for bad input is fine). A mistyped ?startDate= used to answer 500 on Call History,
 * chat history and audit logs. Audit #163 adds every write route with wrong-shaped JSON bodies (never
 * a 500; DELETE /numbers/:id for a number the customer does not own used to answer 500, now 404).
 * Production routers (scripts/lib/demoApp.cjs mirrors src/index.ts), local TEST database.
 * Run: npm run test:query-junk   (part of npm run test:security)
 */
const crypto = require('crypto');
const http = require('http');
const { prisma } = require('../dist/lib/prisma');
const { buildApp, installAuthStub } = require('./lib/demoApp.cjs');
const { buildRouteTable } = require('./lib/routeTable.cjs');

const JUNK = [
  'limit=abc&offset=-5&page=0&pageSize=-1',
  'days=xyz&range=999999&dateRange=forever',
  'from=notadate&to=notadate&startDate=x&endDate=y',
  'startDate=2026-12-01&endDate=2026-01-01',
  'status=%27%22%3C&direction=sideways&agentId=not-a-uuid&batchId=%00',
  'search=' + 'a'.repeat(3000),
  'limit=99999999&offset=99999999',
  'limit[]=1&startDate[]=a',
];
// Needs a live carrier, which tests never have: a clean 502 is the correct answer there.
const CARRIER = /\/numbers\/(plivo\/)?search$/;
const MOUNTED = /^\/api\/v2\/(calls|agents|numbers|knowledge-base|user|team|apikeys|calendar|kyc|billing|chat-history|contacts|analytics|qa|alerting|audit-logs|reports|whatsapp)\b/;

(async () => {
  const userId = crypto.randomUUID();
  await prisma.user.create({ data: { id: userId, email: `junk-${userId.slice(0, 8)}@claritiy-test.co.in`, fullName: 'Junk Query', passwordHash: 'x', accountType: 'professional', callingBalanceMinutes: 100, planExpiresAt: new Date(Date.now() + 86400000) } });
  installAuthStub(async (token) => (token === 'junk-token' ? { id: userId, email: `junk@claritiy-test.co.in` } : null));
  const server = http.createServer(buildApp());
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const routes = buildRouteTable().filter((r) => r.method === 'GET' && MOUNTED.test(r.path) && !/recording|stream|download|export|oauth|callback|transcript-ticket/i.test(r.path));
  const problems = [];
  for (const r of routes) {
    const p = r.path.replace(/:\w+/g, '00000000-0000-4000-8000-0000000000aa');
    for (const q of JUNK) {
      const res = await fetch(`${base}${p}?${q}`, { headers: { authorization: 'Bearer junk-token' }, redirect: 'manual' }); // OAuth routes redirect away
      const ok = res.status < 500 || (CARRIER.test(r.path) && res.status === 502);
      if (!ok) { problems.push(`${res.status} GET ${p}?${q.slice(0, 50)} -> ${(await res.text()).slice(0, 120)}`); break; }
    }
  }
  // Wrong-shaped JSON bodies on every write route (audit #163): a clean 4xx, or a 502/503 where a
  // carrier or AI key is needed, but never a 500. Payment and carrier-purchase routes are skipped.
  const agent = await prisma.agent.create({ data: { userId, name: 'Junk agent', systemPrompt: 'x' } });
  const BODIES = [{}, { name: 123, phoneNumber: {}, email: [], agentId: 5, tags: { a: 1 }, systemPrompt: 42 }, { name: null, phoneNumber: null, recipients: 'x', days: 'abc', limit: 'x' }, [1, 2, 3], { recipients: [{}, null, 7], numberId: [], consentConfirmed: 'yes' }];
  const writes = buildRouteTable().filter((r) => r.method !== 'GET' && MOUNTED.test(r.path) && !/webhook|outbound|create-plan-order|create-order|verify|purchase|claim|digilocker|initiate|razorpay/i.test(r.path));
  for (const r of writes) {
    const p = r.path.replace(/:agentId|:id/g, agent.id).replace(/:\w+/g, '00000000-0000-4000-8000-0000000000aa');
    for (const b of BODIES) {
      const res = await fetch(base + p, { method: r.method, redirect: 'manual', headers: { authorization: 'Bearer junk-token', 'content-type': 'application/json' }, body: JSON.stringify(b) });
      if (res.status === 500) { problems.push(`500 ${r.method} ${r.path} body=${JSON.stringify(b).slice(0, 60)} -> ${(await res.text()).slice(0, 120)}`); break; }
    }
  }
  console.log(`  ${writes.length} write routes x ${BODIES.length} malformed bodies`);

  // A NUL character in a JSON body (audit #162) is refused before it reaches the database.
  const post = await fetch(`${base}/api/v2/contacts`, { method: 'POST', headers: { authorization: 'Bearer junk-token', 'content-type': 'application/json' }, body: JSON.stringify({ phoneNumber: '+919000012345', name: 'a\u0000b' }) });
  if (post.status !== 400) problems.push(`POST /api/v2/contacts with a NUL in the name answered ${post.status}, expected 400`);
  server.close();
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  console.log('\n--- JUNK QUERY STRINGS ---');
  console.log(`  ${routes.length} GET routes x ${JUNK.length} junk queries`);
  for (const p of problems) console.error('  ✗ ' + p);
  console.log(problems.length ? `\nJUNK QUERIES: FAIL — ${problems.length} route(s) answer 5xx` : '\nJUNK QUERIES: PASS — no read or write endpoint crashes on bad input');
  await prisma.$disconnect();
  process.exit(problems.length ? 1 : 0);
})().catch(async (e) => { console.error(e); await prisma.$disconnect().catch(() => {}); process.exit(1); });
