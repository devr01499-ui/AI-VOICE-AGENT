require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Live transfers: to a person (transfer_call, supervisor) and to another AI agent (agent_transfer).
 * Production code on the local TEST database; the carrier is a local fake Plivo API (PLIVO_API_BASE).
 *  - routes: only saved targets, numbers checked by the toll-fraud policy, agents of the same account
 *  - the caller's leg is moved with the documented "transfer a call" request to signed XML that dials
 *    the person with OUR number as caller ID and a time limit from the call's time and minutes left
 *  - while the caller is with the person, a stream end does NOT end, bill or hang up the call; the
 *    carrier's final hangup bills the WHOLE call (owner decision 2026-11-22)
 *  - nobody answers: the caller hears a message and the customer gets a call-back notification
 *  - limits, tenant isolation, save-time checks, Call History endpoint
 * Run: npm run test:call-transfer   (part of npm run test:security)
 */
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');

let total = 0;
let passed = 0;
async function test(name, fn) {
  total++;
  try { await fn(); passed++; console.log(`  ✓ ${name}`); } catch (err) { console.error(`  ✗ FAIL: ${name}\n    ${err.stack || err.message}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MAIN = 'MAPLIVOXFER01';
const seen = [];
let transferStatus = 202;
const fake = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8');
    seen.push({ method: req.method, url: req.url, raw });
    res.writeHead(req.method === 'POST' ? transferStatus : 404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(req.method === 'POST' ? { message: 'call transferred' } : { error: 'not found' }));
  });
});

(async () => {
  await new Promise((r) => fake.listen(0, '127.0.0.1', r));
  process.env.PLIVO_API_BASE = `http://127.0.0.1:${fake.address().port}/v1`;
  process.env.PLIVO_AUTH_ID = MAIN;
  process.env.PLIVO_AUTH_TOKEN = 'test_only_plivo_token';
  process.env.PUBLIC_URL = 'https://voice.claritiy-test.co.in';
  const { prisma } = require('../dist/lib/prisma');
  const { buildApp, installAuthStub } = require('./lib/demoApp.cjs');
  const routing = require('../dist/runtime/callRouting');
  const { routeKey } = require('../dist/runtime/routeKey');
  const { buildCapabilitiesBlock, filterActiveTools, TELEPHONY_CAPABILITIES } = require('../dist/utils/capabilities');
  const { CallTransferService, transferSignature, MAX_HANDOFFS_PER_CALL } = require('../dist/services/CallTransferService');
  const { callOrchestrator, buildHandoffPrompt } = require('../dist/core/orchestrator/CallOrchestrator');

  const users = new Map();
  installAuthStub(async (token) => users.get(token) || null);
  const server = http.createServer(buildApp());
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const api = (method, p, token, body) => fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
    .then(async (r) => { const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch {} return { status: r.status, text, body: json, type: r.headers.get('content-type') || '' }; });
  const created = [];
  const newUser = async (opts = {}) => {
    const id = crypto.randomUUID();
    const email = `xf-${id.slice(0, 8)}@claritiy-test.co.in`;
    users.set(id, { id, email });
    await prisma.user.create({ data: { id, email, fullName: 'Acme Clinic', passwordHash: 'x', accountType: opts.free ? 'free' : 'developer', callingBalanceMinutes: opts.minutes ?? 100, minutesRemainingSeconds: (opts.minutes ?? 100) * 60, planExpiresAt: opts.free ? null : new Date(Date.now() + 20 * 86400000) } });
    created.push(id);
    return id;
  };
  console.log('\n--- LIVE CALL TRANSFERS ---');

  await test('transfer numbers: Indian mobile/landline accepted; premium-rate, other countries, junk refused', async () => {
    const ok = (x) => routing.normalizeTransferNumber(x);
    assert.deepStrictEqual(ok('+91 98765 43210'), { ok: true, e164: '+919876543210' });
    assert.strictEqual(ok('9876543210').e164, '+919876543210');
    assert.strictEqual(ok('080-2345-6789').e164, '+918023456789');
    assert.strictEqual(ok('+911900123456').ok, false);
    assert.strictEqual(ok('+14155550123').ok, false);
    assert.strictEqual(ok('+91 12345').ok, false);
    assert.strictEqual(ok('call me').ok, false);
  });

  await test('route keys are the same on the server, the server flow compiler and the frontend flow compiler', async () => {
    const src = fs.readFileSync(path.join(__dirname, '../../Frontend/src/app/components/agents/flowCompiler.ts'), 'utf8');
    const m = src.match(/export function routeKey\(raw: unknown\): string \{([\s\S]*?)\n\}/);
    assert.ok(m, 'frontend routeKey() exists');
    const ts = require('typescript');
    const js = ts.transpileModule(`function routeKey(raw: unknown): string {${m[1]}\n}`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
    const frontendKey = new Function(`${js}; return routeKey;`)();
    for (const x of ['transfer-tier2', 'Billing Team!', '123', '', 'node_1732000000000', 'A'.repeat(80), '  __x__  ']) assert.strictEqual(frontendKey(x), routeKey(x), x);
    const { compile } = require('../dist/core/orchestrator/FlowCompiler');
    const prompt = compile({ nodes: [{ id: 'start', type: 'start', data: { label: 'Hi' } }, { id: 'transfer-tier2', type: 'transferCall', data: { label: 'Support', targetNumber: '+918000050199' } }], edges: [{ source: 'start', target: 'transfer-tier2' }] }, 'A', 'rigid');
    assert.match(prompt, /transfer_call with destination "transfer_tier2"/);
    assert.ok(!/transfer is currently unavailable|being scheduled/.test(prompt));
  });

  await test('routes come only from saved functions and flow nodes; invalid numbers are skipped', async () => {
    const r = routing.extractCallRouting(
      [{ type: 'transfer_call', name: 'billing_team', description: 'Billing questions', targetNumber: '+919811112222' },
        { type: 'transfer_call', name: 'bad', description: 'x', targetNumber: '+911900111111' },
        { type: 'agent_transfer', name: 'sales_specialist', description: 'Wants to buy', targetAgentId: 'a-1' },
        { type: 'send_whatsapp', name: 'brochure', description: 'Asks for brochure', whatsappTemplate: 'brochure', whatsappVariables: [] },
        { type: 'custom_api', name: 'crm', url: 'https://x.example' }],
      { nodes: [{ id: 'transfer-tier2', type: 'transferCall', data: { label: 'Tier 2', targetNumber: '+918000050199' } }, { id: 'esc', type: 'agentTransfer', data: { label: 'Escalate', subagentName: 'Hardship Specialist' } }] });
    assert.deepStrictEqual(r.human.map((h) => [h.key, h.number]), [['billing_team', '+919811112222'], ['transfer_tier2', '+918000050199']]);
    assert.deepStrictEqual(r.agents.map((a) => a.key), ['sales_specialist', 'esc']);
    assert.deepStrictEqual(r.whatsapp.map((w) => w.key), ['brochure']);
  });

  const owner = await newUser();
  const other = await newUser();
  const main = await prisma.agent.create({ data: { userId: owner, name: 'Front Desk', status: 'active', agentConfig: JSON.stringify({ functions: [
    { type: 'transfer_call', name: 'reception', description: 'Caller asks for a person', targetNumber: '+919811112222' },
    { type: 'agent_transfer', name: 'billing_ai', description: 'Billing questions', targetAgentId: 'PLACEHOLDER' },
    { type: 'agent_transfer', name: 'foreign_ai', description: 'x', targetAgentId: 'FOREIGN' },
  ] }) } });
  const billingAgent = await prisma.agent.create({ data: { userId: owner, name: 'Billing Specialist', status: 'active' } });
  const foreignAgent = await prisma.agent.create({ data: { userId: other, name: 'Other account agent', status: 'active' } });
  await prisma.agent.update({ where: { id: main.id }, data: { agentConfig: JSON.stringify({ functions: [
    { type: 'transfer_call', name: 'reception', description: 'Caller asks for a person', targetNumber: '+919811112222' },
    { type: 'agent_transfer', name: 'billing_ai', description: 'Billing questions', targetAgentId: billingAgent.id },
    { type: 'agent_transfer', name: 'foreign_ai', description: 'x', targetAgentId: foreignAgent.id },
    { type: 'agent_transfer', name: 'myself', description: 'x', targetAgentId: main.id },
  ] }) } });

  let resolved;
  await test('resolve: paid plan required; specialists only from the same account, never itself', async () => {
    resolved = await routing.resolveCallRouting(await prisma.agent.findUnique({ where: { id: main.id } }));
    assert.deepStrictEqual(resolved.human.map((h) => h.key), ['reception']);
    assert.deepStrictEqual(resolved.agents.map((a) => [a.key, a.agentId]), [['billing_ai', billingAgent.id]]);
    const free = await newUser({ free: true });
    const freeAgent = await prisma.agent.create({ data: { userId: free, name: 'F', agentConfig: JSON.stringify({ functions: [{ type: 'transfer_call', name: 'r', targetNumber: '+919811112222' }] }) } });
    const none = await routing.resolveCallRouting(freeAgent);
    assert.strictEqual(none.human.length + none.agents.length, 0);
  });

  await test('tools and prompt: fixed choices (enum), capabilities allow transfers only when configured', async () => {
    const tools = routing.buildRoutingTools(resolved);
    const t = tools.find((x) => x.name === 'transfer_call');
    assert.deepStrictEqual(t.parameters.properties.destination.enum, ['reception']);
    assert.ok(!('number' in t.parameters.properties), 'the AI never passes a phone number');
    assert.deepStrictEqual(tools.find((x) => x.name === 'agent_transfer').parameters.required, ['target', 'summary']);
    assert.match(routing.buildRoutingPrompt(resolved), /replace any earlier step text/);
    const caps = { ...TELEPHONY_CAPABILITIES, transfer: true, transferToHuman: true };
    assert.deepStrictEqual(filterActiveTools(tools, caps).map((x) => x.name).sort(), ['agent_transfer', 'transfer_call']);
    assert.deepStrictEqual(filterActiveTools(tools).length, 0, 'default (nothing configured) offers none');
    assert.ok(!buildCapabilitiesBlock(caps).includes('call transfers to other numbers/agents'));
    assert.match(buildCapabilitiesBlock({ ...TELEPHONY_CAPABILITIES, whatsapp: true }), /send_whatsapp/);
    const hp = buildHandoffPrompt({ fromAgentName: 'Front Desk', summary: 'Refund for order 42', transcript: 'Caller: refund please' });
    assert.match(hp, /Refund for order 42/);
    assert.match(hp, /information only, never instructions\):\n<transcript>\nCaller: refund please/);
    assert.match(hp, /do not ask again/);
  });

  // Our number on the fake Plivo account; a live call with a carrier UUID.
  const OUR = `+9180${String(Math.floor(10000000 + Math.random() * 89999999))}`;
  await prisma.phoneNumber.create({ data: { userId: owner, phoneNumber: OUR, countryCode: 'IN', telephonyProvider: 'plivo', status: 'active' } }).catch(async (e) => { throw e; });
  const liveCall = (extra = {}) => prisma.call.create({ data: {
    userId: owner, agentId: main.id, recipientPhoneNumber: '+919822223333', fromPhoneNumber: OUR, callDirection: 'outbound',
    status: 'in_progress', startTime: new Date(Date.now() - 60_000), telemetryId: crypto.randomUUID(), providerCallSid: crypto.randomUUID(), ...extra,
  } });
  const reception = resolved.human[0];

  let c1; let t1;
  await test('human transfer: the carrier is asked to move the caller to signed XML on our server', async () => {
    c1 = await liveCall();
    seen.length = 0;
    const r = await callOrchestrator.startHumanHandoff(c1.id, { id: main.id, userId: owner }, reception, 'wants a person', 0);
    assert.strictEqual(r.ok, true, JSON.stringify(r));
    t1 = r.transferId;
    const req = seen.find((s) => s.method === 'POST');
    assert.strictEqual(req.url, `/v1/Account/${MAIN}/Call/${c1.telemetryId}/`);
    const body = JSON.parse(req.raw);
    assert.strictEqual(body.legs, 'aleg'); assert.strictEqual(body.aleg_method, 'POST');
    assert.strictEqual(body.aleg_url, `https://voice.claritiy-test.co.in/api/v2/webhooks/transfer/${t1}/xml?sig=${transferSignature(t1)}`);
    assert.strictEqual((await prisma.callTransfer.findUnique({ where: { id: t1 } })).status, 'dialing');
    assert.strictEqual(callOrchestrator.isWithHuman(c1.id), true);
  });

  await test('dial XML: signature required; dials the person with OUR caller ID and the remaining time as limit', async () => {
    const bad = await api('POST', `/api/v2/webhooks/transfer/${t1}/xml?sig=${'0'.repeat(64)}`);
    assert.strictEqual(bad.status, 403); assert.match(bad.type, /xml/);
    const r = await api('POST', `/api/v2/webhooks/transfer/${t1}/xml?sig=${transferSignature(t1)}`);
    assert.strictEqual(r.status, 200); assert.match(r.type, /application\/xml/);
    assert.match(r.text, new RegExp(`<Dial callerId="\\${OUR}"`));
    assert.match(r.text, /<Number>\+919811112222<\/Number>/);
    const limit = Number(r.text.match(/timeLimit="(\d+)"/)[1]);
    assert.ok(limit > 1500 && limit <= 1800 - 55, `timeLimit ${limit} = 30 min max minus ~60 s elapsed`);
    assert.match(r.text, /action="https:\/\/voice\.claritiy-test\.co\.in\/api\/v2\/webhooks\/transfer\/[^"]+\/dial-result\?sig=/);
  });

  await test('while with the person: the stream ending does not end, bill or hang up the call', async () => {
    seen.length = 0;
    await callOrchestrator.endCallSession(c1.id, 'stream_stopped');
    await sleep(300);
    const row = await prisma.call.findUnique({ where: { id: c1.id } });
    assert.strictEqual(row.status, 'in_progress');
    assert.strictEqual(seen.filter((s) => s.method === 'DELETE').length, 0, 'no carrier hangup');
    assert.strictEqual(await prisma.minutesLedger.count({ where: { userId: owner } }), 0, 'not billed yet');
  });

  await test('person answers, then the call ends: the carrier hangup bills the WHOLE call once', async () => {
    await api('POST', `/api/v2/webhooks/transfer/${t1}/dial-event?sig=${transferSignature(t1)}`, null, { Event: 'DialAnswer' });
    assert.strictEqual((await prisma.callTransfer.findUnique({ where: { id: t1 } })).status, 'connected');
    const done = await api('POST', `/api/v2/webhooks/transfer/${t1}/dial-result?sig=${transferSignature(t1)}`, null, { DialStatus: 'completed' });
    assert.match(done.text, /<Hangup\/>/); assert.ok(!/<Speak>/.test(done.text));
    const { CallController } = require('../dist/controllers/CallController');
    await CallController.recordCarrierDuration(c1.id, 185);
    await callOrchestrator.endCallSession(c1.id, 'caller_hangup', 'Plivo: NORMAL_CLEARING', 'caller', { carrierFinal: true });
    let ledger = [];
    for (let i = 0; i < 30 && !ledger.length; i++) { await sleep(100); ledger = await prisma.minutesLedger.findMany({ where: { userId: owner } }); }
    const row = await prisma.call.findUnique({ where: { id: c1.id } });
    assert.strictEqual(row.status, 'completed'); assert.strictEqual(row.durationSeconds, 185);
    assert.strictEqual(ledger.length, 1); assert.strictEqual(ledger[0].deltaSeconds, -240, '185 s = 4 started minutes');
    assert.strictEqual(callOrchestrator.isWithHuman(c1.id), false);
    assert.strictEqual((await prisma.callTransfer.findUnique({ where: { id: t1 } })).status, 'completed');
  });

  await test('nobody answers: the caller hears the message and the customer gets a call-back notification', async () => {
    const c2 = await liveCall();
    const r = await CallTransferService.startHumanTransfer({ callId: c2.id, userId: owner, agentId: main.id, route: reception });
    assert.strictEqual(r.ok, true);
    const x = await api('POST', `/api/v2/webhooks/transfer/${r.transferId}/dial-result?sig=${transferSignature(r.transferId)}`, null, { DialStatus: 'no-answer' });
    assert.match(x.text, /<Speak>Sorry, nobody from our team could take your call right now/); assert.match(x.text, /<Hangup\/>/);
    assert.strictEqual((await prisma.callTransfer.findUnique({ where: { id: r.transferId } })).status, 'no_answer');
    const alert = await prisma.systemAlert.findFirst({ where: { userId: owner, type: 'TRANSFER_MISSED' } });
    assert.ok(alert && /\+919822223333/.test(alert.message), 'notification names the caller');
  });

  await test('refusals: same number (loop), call not live, no minutes left, carrier refusal, too many hand-offs', async () => {
    const c3 = await liveCall();
    const loop = await CallTransferService.startHumanTransfer({ callId: c3.id, userId: owner, agentId: main.id, route: { ...reception, number: '+919822223333' } });
    assert.strictEqual(loop.code, 'LOOP');
    const ended = await liveCall({ status: 'completed' });
    assert.strictEqual((await CallTransferService.startHumanTransfer({ callId: ended.id, userId: owner, agentId: main.id, route: reception })).code, 'CALL_NOT_LIVE');
    const poor = await newUser({ minutes: 0 });
    const pa = await prisma.agent.create({ data: { userId: poor, name: 'P' } });
    const pc = await prisma.call.create({ data: { userId: poor, agentId: pa.id, recipientPhoneNumber: '+919822223333', fromPhoneNumber: OUR, status: 'in_progress', startTime: new Date(), telemetryId: crypto.randomUUID() } });
    assert.strictEqual((await CallTransferService.startHumanTransfer({ callId: pc.id, userId: poor, agentId: pa.id, route: reception })).code, 'NO_TIME_LEFT');
    transferStatus = 500;
    const fail = await callOrchestrator.startHumanHandoff(c3.id, { id: main.id, userId: owner }, reception, undefined, 0);
    transferStatus = 202;
    assert.strictEqual(fail.code, 'CARRIER_FAILED');
    assert.strictEqual(callOrchestrator.isWithHuman(c3.id), false, 'a failed transfer leaves the call with the AI');
    const c4 = await liveCall();
    for (let i = 0; i < MAX_HANDOFFS_PER_CALL; i++) await prisma.callTransfer.create({ data: { userId: owner, callId: c4.id, kind: 'agent', status: 'completed' } });
    assert.strictEqual((await CallTransferService.startHumanTransfer({ callId: c4.id, userId: owner, agentId: main.id, route: reception })).code, 'LIMIT');
  });

  await test('agent hand-off: same account only, never itself, limited per call', async () => {
    const c5 = await liveCall();
    const ok = await CallTransferService.recordAgentHandoff({ callId: c5.id, userId: owner, fromAgentId: main.id, route: resolved.agents[0], summary: 'Refund for order 42' });
    assert.strictEqual(ok.ok, true);
    const foreign = await CallTransferService.recordAgentHandoff({ callId: c5.id, userId: owner, fromAgentId: main.id, route: { key: 'f', label: 'f', agentId: foreignAgent.id, whenToUse: '' }, summary: 'x' });
    assert.strictEqual(foreign.code, 'INVALID_TARGET');
    const self = await CallTransferService.recordAgentHandoff({ callId: c5.id, userId: owner, fromAgentId: main.id, route: { key: 's', label: 's', agentId: main.id, whenToUse: '' }, summary: 'x' });
    assert.strictEqual(self.code, 'INVALID_TARGET');
    const unknown = await callOrchestrator.handleAgentTransfer(c5.id, resolved, { target: 'nope' }, { id: main.id, userId: owner });
    assert.strictEqual(unknown.success, false);
  });

  await test('supervisor transfer (Live Monitoring): moves a live call; another account gets 404; bad number 400', async () => {
    const c6 = await liveCall();
    seen.length = 0;
    const r = await api('POST', `/api/v2/calls/${c6.id}/transfer`, owner, { targetNumber: '98111 22233' });
    assert.strictEqual(r.status, 200, r.text); assert.strictEqual(r.body.data.status, 'dialing');
    assert.strictEqual((await prisma.callTransfer.findUnique({ where: { id: r.body.data.transferId } })).destinationNumber, '+919811122233');
    assert.strictEqual((await api('POST', `/api/v2/calls/${c6.id}/transfer`, other, { targetNumber: '+919811122233' })).status, 404);
    const c7 = await liveCall();
    assert.strictEqual((await api('POST', `/api/v2/calls/${c7.id}/transfer`, owner, { targetNumber: '+911860123456' })).status, 400);
    const live = await api('GET', '/api/v2/calls/live', owner);
    const flag = live.body.data.find((x) => x.id === c6.id);
    assert.deepStrictEqual(flag.handoff && flag.handoff.kind, 'human');
    await callOrchestrator.endCallSession(c6.id, 'caller_hangup', 'test', 'caller', { carrierFinal: true });
  });

  await test('Call History: transfers of a call are listed for its owner only', async () => {
    const h = await api('GET', `/api/v2/calls/${c1.id}/handoffs`, owner);
    assert.strictEqual(h.status, 200);
    assert.strictEqual(h.body.data.transfers[0].destinationLabel, 'reception');
    assert.strictEqual((await api('GET', `/api/v2/calls/${c1.id}/handoffs`, other)).status, 404);
  });

  await test('save checks: a new transfer with a bad number is refused; an unchanged old one never blocks saving', async () => {
    const bad = await api('POST', '/api/v2/agents', owner, { name: 'T', agentConfig: { functions: [{ id: 'f1', type: 'transfer_call', name: 'x', description: 'x', targetNumber: '+911900111111' }] } });
    assert.strictEqual(bad.status, 400); assert.match(bad.text, /Premium-rate/);
    const good = await api('POST', '/api/v2/agents', owner, { name: 'T', agentConfig: { functions: [{ id: 'f1', type: 'transfer_call', name: 'x', description: 'x', targetNumber: '+919811112222' }] } });
    assert.strictEqual(good.status, 201, good.text);
    const legacyFn = { id: 'old', type: 'transfer_call', name: 'old', description: 'x', targetNumber: '' };
    const legacy = await prisma.agent.create({ data: { userId: owner, name: 'Legacy', agentConfig: JSON.stringify({ functions: [legacyFn] }) } });
    const upd = await api('PUT', `/api/v2/agents/${legacy.id}`, owner, { name: 'Legacy renamed', agentConfig: { functions: [legacyFn] } });
    assert.strictEqual(upd.status, 200, upd.text);
    const changed = await api('PUT', `/api/v2/agents/${legacy.id}`, owner, { agentConfig: { functions: [{ ...legacyFn, targetNumber: '12' }] } });
    assert.strictEqual(changed.status, 400);
  });

  server.close();
  fake.close();
  for (const id of created) await prisma.user.delete({ where: { id } }).catch(() => {});
  console.log(`\nCALL TRANSFERS: ${passed === total ? 'PASS' : 'FAIL'} — ${passed}/${total} tests passed\n`);
  await prisma.$disconnect();
  process.exit(passed === total ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
