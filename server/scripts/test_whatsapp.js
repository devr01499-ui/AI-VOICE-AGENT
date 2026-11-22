require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * WhatsApp from voice agents (customer's own Meta WhatsApp Business account, Cloud API).
 * Production code (routes, WhatsAppService, webhook) on the local TEST database; only the Graph API
 * network call is replaced (setWhatsAppTransportForTests). Checks Meta's rules:
 *  - connect needs a paid plan and is verified with Meta; tokens are stored encrypted, never returned
 *  - only approved, sendable templates are offered (no OTP, media headers, variable buttons)
 *  - nothing is sent without the caller's consent; consent is stored before the message
 *  - each template once per call, at most 3 per call, variables cleaned the way Meta requires
 *  - webhooks are fail-closed (X-Hub-Signature-256), statuses never go backwards, STOP opts out
 *  - tenant isolation
 * Run: npm run test:whatsapp   (part of npm run test:security)
 */
const assert = require('assert');
const crypto = require('crypto');
const http = require('http');

process.env.PUBLIC_URL = process.env.PUBLIC_URL || 'https://voice.claritiy-test.co.in';
const { prisma } = require('../dist/lib/prisma');
const { buildApp, installAuthStub } = require('./lib/demoApp.cjs');
const { setWhatsAppTransportForTests } = require('../dist/services/whatsapp/WhatsAppCloudClient');
const { WhatsAppService, analyseTemplate, cleanTemplateVariable } = require('../dist/services/whatsapp/WhatsAppService');

let total = 0;
let passed = 0;
async function test(name, fn) {
  total++;
  try { await fn(); passed++; console.log(`  ✓ ${name}`); } catch (err) { console.error(`  ✗ FAIL: ${name}\n    ${err.stack || err.message}`); }
}

const TOKEN = 'EAAG' + 'x'.repeat(60);
const SECRET = crypto.randomBytes(16).toString('hex');
const TEMPLATES = [
  { name: 'order_update', language: 'en', status: 'APPROVED', category: 'UTILITY', components: [{ type: 'BODY', text: 'Hi {{1}}, your booking {{2}} is confirmed.' }] },
  { name: 'brochure', language: 'en', status: 'APPROVED', category: 'MARKETING', components: [{ type: 'BODY', text: 'Here is the brochure you asked for.' }, { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Open', url: 'https://acme.example/brochure' }] }] },
  { name: 'otp_code', language: 'en', status: 'APPROVED', category: 'AUTHENTICATION', components: [{ type: 'BODY', text: '{{1}} is your code.' }] },
  { name: 'pending_one', language: 'en', status: 'PENDING', category: 'UTILITY', components: [{ type: 'BODY', text: 'Pending' }] },
  { name: 'with_image', language: 'en', status: 'APPROVED', category: 'MARKETING', components: [{ type: 'HEADER', format: 'IMAGE' }, { type: 'BODY', text: 'Look' }] },
  { name: 'named_vars', language: 'hi', status: 'APPROVED', category: 'UTILITY', components: [{ type: 'BODY', text: 'Namaste {{customer_name}}' }] },
];
const sent = [];
let failNextSend = false;
setWhatsAppTransportForTests(async (url, init) => {
  const u = new URL(url);
  if (init.headers.Authorization !== `Bearer ${TOKEN}`) return { status: 401, json: { error: { code: 190, message: 'bad token' } } };
  if (init.method === 'GET' && /\/v27\.0\/\d+$/.test(u.pathname)) return { status: 200, json: { display_phone_number: '+91 98765 00000', verified_name: 'Acme Dental', quality_rating: 'GREEN' } };
  if (init.method === 'GET' && u.pathname.endsWith('/message_templates')) return { status: 200, json: { data: TEMPLATES } };
  if (init.method === 'POST' && u.pathname.endsWith('/subscribed_apps')) return { status: 200, json: { success: true } };
  if (init.method === 'POST' && u.pathname.endsWith('/messages')) {
    if (failNextSend) { failNextSend = false; return { status: 400, json: { error: { code: 131026, message: 'undeliverable' } } }; }
    const body = JSON.parse(init.body);
    sent.push({ url, body });
    return { status: 200, json: { messages: [{ id: `wamid.${crypto.randomBytes(6).toString('hex')}` }] } };
  }
  return { status: 404, json: { error: { code: 100, message: 'unknown' } } };
});

(async () => {
  const users = new Map();
  installAuthStub(async (token) => users.get(token) || null);
  const server = http.createServer(buildApp());
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (method, path, token, body, headers = {}) => fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) })
    .then(async (r) => ({ status: r.status, text: await r.text() })).then((r) => { let json = null; try { json = JSON.parse(r.text); } catch {} return { ...r, body: json }; });
  const newUser = async (accountType = 'developer') => {
    const id = crypto.randomUUID();
    const email = `wa-${id.slice(0, 8)}@claritiy-test.co.in`;
    users.set(id, { id, email });
    await prisma.user.create({ data: { id, email, fullName: 'Acme Dental', passwordHash: 'x', accountType, callingBalanceMinutes: 100, minutesRemainingSeconds: 6000, planExpiresAt: accountType === 'free' ? null : new Date(Date.now() + 20 * 86400000) } });
    return id;
  };
  const created = [];
  console.log('\n--- WHATSAPP (META CLOUD API) ---');

  const u = await newUser(); created.push(u);
  const PHONE_ID = String(100000000000000 + Math.floor(Math.random() * 1e9));
  const connectBody = { phoneNumberId: PHONE_ID, wabaId: '200000000000001', accessToken: TOKEN, appSecret: SECRET };

  await test('connect: bad input 400, free plan 403, wrong token 400 with a plain reason', async () => {
    assert.strictEqual((await call('POST', '/api/v2/whatsapp/account', u, { phoneNumberId: 'abc' })).status, 400);
    const free = await newUser('free'); created.push(free);
    const f = await call('POST', '/api/v2/whatsapp/account', free, connectBody);
    assert.strictEqual(f.status, 403); assert.strictEqual(f.body.error.code, 'PAID_PLAN_REQUIRED');
    const w = await call('POST', '/api/v2/whatsapp/account', u, { ...connectBody, accessToken: 'EAAG' + 'y'.repeat(60) });
    assert.strictEqual(w.status, 400); assert.match(JSON.stringify(w.body), /access token is invalid/);
    assert.ok(!/EAAG/.test(w.text), 'token never echoed');
  });

  let account;
  await test('connect: verified with Meta, secrets encrypted at rest and never returned', async () => {
    const r = await call('POST', '/api/v2/whatsapp/account', u, connectBody);
    assert.strictEqual(r.status, 200, r.text);
    account = r.body.data.account;
    assert.strictEqual(account.verifiedName, 'Acme Dental');
    assert.ok(account.webhookUrl.endsWith(`/api/v2/webhooks/whatsapp/${account.id}`));
    assert.ok(/^[a-f0-9]{48}$/.test(account.verifyToken));
    assert.ok(!r.text.includes(TOKEN) && !r.text.includes(SECRET), 'no secrets in the response');
    const row = await prisma.whatsAppAccount.findUnique({ where: { userId: u } });
    assert.notStrictEqual(row.accessToken, TOKEN); assert.notStrictEqual(row.appSecret, SECRET);
    const g = await call('GET', '/api/v2/whatsapp/account', u);
    assert.ok(!g.text.includes(TOKEN) && !g.text.includes(SECRET) && g.body.data.connected === true);
  });

  await test('the same WhatsApp number cannot be connected to a second Claritiy account', async () => {
    const other = await newUser(); created.push(other);
    const r = await call('POST', '/api/v2/whatsapp/account', other, connectBody);
    assert.strictEqual(r.status, 409);
  });

  await test('only sendable templates are offered (approved; no OTP, media header, variable button, pending)', async () => {
    const r = await call('GET', '/api/v2/whatsapp/templates', u);
    const names = r.body.data.templates.map((t) => t.name).sort();
    assert.deepStrictEqual(names, ['brochure', 'named_vars', 'order_update']);
    assert.strictEqual(analyseTemplate(TEMPLATES[2]).usable, false);
    assert.match(analyseTemplate(TEMPLATES[4]).unusableReason, /image/);
    assert.deepStrictEqual(analyseTemplate(TEMPLATES[0]).variables.map((v) => v.key), ['1', '2']);
    assert.strictEqual(analyseTemplate({ ...TEMPLATES[0], components: [{ type: 'BODY', text: 'x' }, { type: 'BUTTONS', buttons: [{ type: 'URL', url: 'https://a.example/{{1}}' }] }] }).usable, false);
    assert.strictEqual(cleanTemplateVariable('Line one\nline\ttwo     end'), 'Line one line two end');
  });

  const agent = await prisma.agent.create({ data: { userId: u, name: 'Reception' } });
  const newCall = () => prisma.call.create({ data: { userId: u, agentId: agent.id, recipientPhoneNumber: '+919812345678', fromPhoneNumber: '+918045670000', callDirection: 'outbound', status: 'in_progress', startTime: new Date() } });
  const route = { key: 'booking_confirmation', label: 'Booking confirmation', templateName: 'order_update', language: 'en', variables: [{ description: 'caller first name' }, { description: 'booking id' }], whenToUse: 'after booking' };

  const c1 = await newCall();
  await test('no consent: nothing is sent and nothing is stored', async () => {
    const r = await WhatsAppService.sendFromCall({ userId: u, callId: c1.id, agentId: agent.id, recipient: '+919812345678', route, variables: ['Asha', 'B-42'], consentConfirmed: false });
    assert.strictEqual(r.ok, false); assert.strictEqual(r.code, 'CONSENT_REQUIRED');
    assert.strictEqual(sent.length, 0);
    assert.strictEqual(await prisma.whatsAppConsent.count({ where: { userId: u } }), 0);
  });

  await test('missing variables are asked for, not invented', async () => {
    const r = await WhatsAppService.sendFromCall({ userId: u, callId: c1.id, recipient: '+919812345678', route, variables: ['Asha'], consentConfirmed: true });
    assert.strictEqual(r.code, 'MISSING_VARIABLES'); assert.match(r.message, /booking id/);
    assert.strictEqual(sent.length, 0);
  });

  await test('with consent: consent stored first, approved template sent to the caller, logged as sent', async () => {
    const r = await WhatsAppService.sendFromCall({ userId: u, callId: c1.id, agentId: agent.id, recipient: '+91 98123 45678', route, variables: ['Asha\n', 'B-42'], consentConfirmed: true, consentEvidence: 'Agent: Can Acme Dental send this on WhatsApp?\nCaller: Haan, bhej do.' });
    assert.deepStrictEqual(r, { ok: true, status: 'sent' });
    assert.strictEqual(sent.length, 1);
    const b = sent[0].body;
    assert.strictEqual(b.messaging_product, 'whatsapp'); assert.strictEqual(b.to, '919812345678'); assert.strictEqual(b.type, 'template');
    assert.strictEqual(b.template.name, 'order_update'); assert.strictEqual(b.template.language.code, 'en');
    assert.deepStrictEqual(b.template.components[0].parameters.map((p) => p.text), ['Asha', 'B-42']);
    assert.ok(sent[0].url.includes(`/${PHONE_ID}/messages`));
    const consent = await prisma.whatsAppConsent.findUnique({ where: { userId_phoneNumber: { userId: u, phoneNumber: '+919812345678' } } });
    assert.strictEqual(consent.status, 'opted_in'); assert.strictEqual(consent.callId, c1.id); assert.match(consent.evidence, /Haan/);
    const msg = await prisma.whatsAppMessage.findFirst({ where: { userId: u, callId: c1.id } });
    assert.strictEqual(msg.status, 'sent'); assert.ok(msg.metaMessageId.startsWith('wamid.')); assert.match(msg.body, /Hi Asha, your booking B-42/);
  });

  await test('the same template twice on one call is sent once', async () => {
    const r = await WhatsAppService.sendFromCall({ userId: u, callId: c1.id, recipient: '+919812345678', route, variables: ['Asha', 'B-42'], consentConfirmed: true });
    assert.deepStrictEqual(r, { ok: true, status: 'already_sent' });
    assert.strictEqual(sent.length, 1);
  });

  await test('named-variable templates send parameter_name; a Meta refusal is logged as failed', async () => {
    const named = { key: 'hello_hi', label: 'Hello', templateName: 'named_vars', language: 'hi', variables: [{ description: 'name' }], whenToUse: '' };
    const r = await WhatsAppService.sendFromCall({ userId: u, callId: c1.id, recipient: '+919812345678', route: named, variables: ['Ravi'], consentConfirmed: true });
    assert.strictEqual(r.ok, true);
    assert.deepStrictEqual(sent[sent.length - 1].body.template.components[0].parameters, [{ type: 'text', parameter_name: 'customer_name', text: 'Ravi' }]);
    failNextSend = true;
    const c2 = await newCall();
    const f = await WhatsAppService.sendFromCall({ userId: u, callId: c2.id, recipient: '+919812345678', route, variables: ['A', 'B'], consentConfirmed: true });
    assert.strictEqual(f.ok, false); assert.strictEqual(f.code, 'SEND_FAILED');
    const row = await prisma.whatsAppMessage.findFirst({ where: { userId: u, callId: c2.id } });
    assert.strictEqual(row.status, 'failed'); assert.match(row.errorMessage, /cannot receive WhatsApp/);
  });

  await test('webhook verification: wrong token 403, right token echoes the challenge', async () => {
    const bad = await call('GET', `/api/v2/webhooks/whatsapp/${account.id}?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=12345`);
    assert.strictEqual(bad.status, 403);
    const ok = await call('GET', `/api/v2/webhooks/whatsapp/${account.id}?hub.mode=subscribe&hub.verify_token=${account.verifyToken}&hub.challenge=12345`);
    assert.strictEqual(ok.status, 200); assert.strictEqual(ok.text, '12345');
  });

  const msg = await prisma.whatsAppMessage.findFirst({ where: { userId: u, callId: c1.id, templateName: 'order_update' } });
  const payload = (value) => JSON.stringify({ object: 'whatsapp_business_account', entry: [{ id: '200000000000001', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: { phone_number_id: PHONE_ID, display_phone_number: '919876500000' }, ...value } }] }] });
  const sign = (raw, secret = SECRET) => 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');

  await test('webhook POST is fail-closed: no or wrong signature 401, nothing changes', async () => {
    const raw = payload({ statuses: [{ id: msg.metaMessageId, status: 'delivered', timestamp: '1', recipient_id: '919812345678' }] });
    assert.strictEqual((await call('POST', `/api/v2/webhooks/whatsapp/${account.id}`, null, raw)).status, 401);
    assert.strictEqual((await call('POST', `/api/v2/webhooks/whatsapp/${account.id}`, null, raw, { 'X-Hub-Signature-256': sign(raw, crypto.randomBytes(16).toString('hex')) })).status, 401);
    assert.strictEqual((await prisma.whatsAppMessage.findUnique({ where: { id: msg.id } })).status, 'sent');
  });

  await test('delivery statuses move forward only (sent -> delivered -> read; a late "sent" is ignored)', async () => {
    const send = async (status) => { const raw = payload({ statuses: [{ id: msg.metaMessageId, status, timestamp: '1', recipient_id: '919812345678' }] }); return call('POST', `/api/v2/webhooks/whatsapp/${account.id}`, null, raw, { 'X-Hub-Signature-256': sign(raw) }); };
    assert.strictEqual((await send('delivered')).status, 200);
    assert.strictEqual((await prisma.whatsAppMessage.findUnique({ where: { id: msg.id } })).status, 'delivered');
    await send('read');
    await send('sent');
    assert.strictEqual((await prisma.whatsAppMessage.findUnique({ where: { id: msg.id } })).status, 'read');
  });

  await test('a reply "STOP" opts the person out; later sends are refused; other numbers of the app are ignored', async () => {
    const raw = payload({ contacts: [{ wa_id: '919812345678' }], messages: [{ from: '919812345678', id: `wamid.in.${crypto.randomBytes(4).toString('hex')}`, timestamp: '1', type: 'text', text: { body: 'STOP' } }] });
    assert.strictEqual((await call('POST', `/api/v2/webhooks/whatsapp/${account.id}`, null, raw, { 'X-Hub-Signature-256': sign(raw) })).status, 200);
    // Re-delivery of the same message is stored once.
    await call('POST', `/api/v2/webhooks/whatsapp/${account.id}`, null, raw, { 'X-Hub-Signature-256': sign(raw) });
    assert.strictEqual(await prisma.whatsAppMessage.count({ where: { userId: u, direction: 'inbound' } }), 1);
    const consent = await prisma.whatsAppConsent.findUnique({ where: { userId_phoneNumber: { userId: u, phoneNumber: '+919812345678' } } });
    assert.strictEqual(consent.status, 'opted_out');
    const c3 = await newCall();
    const r = await WhatsAppService.sendFromCall({ userId: u, callId: c3.id, recipient: '+919812345678', route, variables: ['A', 'B'], consentConfirmed: true });
    assert.strictEqual(r.code, 'OPTED_OUT');
    const foreign = JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: '999' }, messages: [{ from: '919800000001', id: 'wamid.foreign', type: 'text', text: { body: 'hi' } }] } }] }] });
    await call('POST', `/api/v2/webhooks/whatsapp/${account.id}`, null, foreign, { 'X-Hub-Signature-256': sign(foreign) });
    assert.strictEqual(await prisma.whatsAppMessage.count({ where: { metaMessageId: 'wamid.foreign' } }), 0);
  });

  await test('at most 3 WhatsApp messages per call', async () => {
    const c4 = await newCall();
    const to = '+919811100022';
    const results = [];
    for (const t of ['order_update', 'brochure', 'named_vars', 'order_update']) {
      const key = `k_${results.length}`;
      results.push(await WhatsAppService.sendFromCall({ userId: u, callId: c4.id, recipient: to, route: { key, label: key, templateName: t, variables: [], whenToUse: '' }, variables: ['X', 'Y'], consentConfirmed: true }));
    }
    assert.deepStrictEqual(results.map((r) => r.ok), [true, true, true, false]);
    assert.strictEqual(results[3].code, 'CALL_LIMIT');
  });

  await test('tenant isolation: another account sees none of these messages; not connected = refused', async () => {
    const b = await newUser(); created.push(b);
    const list = await call('GET', '/api/v2/whatsapp/messages', b);
    assert.strictEqual(list.status, 200); assert.strictEqual(list.body.data.messages.length, 0);
    const mine = await call('GET', `/api/v2/whatsapp/messages?callId=${c1.id}`, u);
    assert.ok(mine.body.data.messages.length >= 1);
    const agentB = await prisma.agent.create({ data: { userId: b, name: 'B' } });
    const cb = await prisma.call.create({ data: { userId: b, agentId: agentB.id, recipientPhoneNumber: '+919812345678', status: 'in_progress' } });
    const r = await WhatsAppService.sendFromCall({ userId: b, callId: cb.id, recipient: '+919812345678', route, variables: ['A', 'B'], consentConfirmed: true });
    assert.strictEqual(r.code, 'NOT_CONNECTED');
  });

  await test('disconnect (owner only) removes the credentials', async () => {
    const r = await call('DELETE', '/api/v2/whatsapp/account', u);
    assert.strictEqual(r.status, 200);
    assert.strictEqual(await prisma.whatsAppAccount.count({ where: { userId: u } }), 0);
    assert.strictEqual((await call('DELETE', '/api/v2/whatsapp/account', u)).status, 404);
  });

  server.close();
  setWhatsAppTransportForTests(null);
  for (const id of created) await prisma.user.delete({ where: { id } }).catch(() => {});
  console.log(`\nWHATSAPP: ${passed === total ? 'PASS' : 'FAIL'} — ${passed}/${total} tests passed\n`);
  await prisma.$disconnect();
  process.exit(passed === total ? 0 : 1);
})().catch(async (e) => { console.error(e); await prisma.$disconnect().catch(() => {}); process.exit(1); });
