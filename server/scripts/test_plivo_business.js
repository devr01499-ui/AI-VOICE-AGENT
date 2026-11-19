require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Plivo business numbers against the documented Regulatory Compliance flow (docs checked
 * 2026-11-19). Production code talks to a local fake Plivo (PLIVO_API_BASE); nothing real is called.
 *  - documents are checked by their bytes (PDF/PNG/JPEG, <= 3 MB)
 *  - the business application is filed for the customer's OWN subaccount with both documents
 *  - a business number cannot be claimed until Plivo accepts the application; the purchase then
 *    passes compliance_application_id + subaccount
 *  - subaccount onboarding needs a paid plan
 * Run: npm run test:plivo-business   (part of npm run test:security)
 */
const assert = require('assert');
const crypto = require('crypto');
const http = require('http');
const express = require('express');

let total = 0;
let passed = 0;
async function test(name, fn) {
  total++;
  try { await fn(); passed++; console.log(`  ✓ ${name}`); } catch (err) { console.error(`  ✗ FAIL: ${name}\n    ${err.stack || err.message}`); }
}

const MAIN = 'MAPLIVOTESTMAIN';
const RUN = crypto.randomBytes(3).toString('hex').toUpperCase();
const seen = [];
let reviewStatus = 'submitted';
let seq = 0;
const fake = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const raw = Buffer.concat(chunks).toString('latin1');
    const url = req.url;
    seen.push({ method: req.method, url, raw, type: req.headers['content-type'] || '' });
    const send = (status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
    let m;
    if (req.method === 'GET' && url.startsWith(`/v1/Account/${MAIN}/Subaccount/`)) return send(200, { objects: [] });
    if (req.method === 'POST' && url === `/v1/Account/${MAIN}/Subaccount/`) return send(201, { message: 'created', auth_id: `SAPL${RUN}${++seq}`, auth_token: 'tok' });
    if (req.method === 'GET' && url.startsWith(`/v1/Account/${MAIN}/PhoneNumber/Compliance/Requirements?`)) {
      return send(200, { requirement_id: 'req-1', document_types: [
        { document_type_id: 'dt-reg', name: 'Registration Certificate', proof_required: true, required_fields: [{ field_name: 'business_name', field_type: 'string' }] },
        { document_type_id: 'dt-gst', name: 'GST Registration Certificate', proof_required: true, required_fields: [] },
      ] });
    }
    if (req.method === 'POST' && url === `/v1/Account/${MAIN}/PhoneNumber/Compliance/`) return send(201, { api_id: 'a', compliance_id: `cmp-${RUN}-${++seq}`, message: 'created' });
    if (req.method === 'GET' && (m = url.match(new RegExp(`^/v1/Account/${MAIN}/PhoneNumber/Compliance/([^/?]+)`)))) {
      return send(200, { api_id: 'a', compliance: { compliance_id: m[1], status: reviewStatus, rejection_reason: reviewStatus === 'rejected' ? 'Name mismatch' : null } });
    }
    if (req.method === 'POST' && (m = url.match(new RegExp(`^/v1/Account/${MAIN}/PhoneNumber/(\\d+)/$`)))) {
      return send(201, { api_id: 'a', message: 'created', status: 'fulfilled', numbers: [{ number: m[1], status: 'Success' }] });
    }
    return send(404, { error: `unhandled ${req.method} ${url}` });
  });
});

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('png-body')]);

async function main() {
  await new Promise((r) => fake.listen(0, '127.0.0.1', r));
  process.env.PLIVO_API_BASE = `http://127.0.0.1:${fake.address().port}/v1`;
  process.env.PLIVO_AUTH_ID = MAIN;
  process.env.PLIVO_AUTH_TOKEN = 'test_only_plivo_token';
  const { prisma } = require('../dist/lib/prisma');
  const { readComplianceDocument } = require('../dist/services/PlivoComplianceService');
  const { supabaseClient } = require('../dist/utils/supabase');
  const emails = new Map();
  supabaseClient.auth.getUser = async (token) => {
    if (!emails.has(token)) return { data: { user: null }, error: { message: 'invalid' } };
    const now = new Date().toISOString();
    return { data: { user: { id: token, email: emails.get(token), email_confirmed_at: now, user_metadata: { email_confirmed_at: now } } }, error: null };
  };
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/v2/numbers', require('../dist/routes/numbers').default);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/api/v2/numbers`;
  const call = (method, path, token, body) => fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined })
    .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
  const newUser = async (accountType = 'developer') => {
    const id = crypto.randomUUID();
    const email = `pb-${id.slice(0, 8)}@claritiy-test.co.in`;
    emails.set(id, email);
    await prisma.user.create({ data: { id, email, fullName: 'Acme Traders', passwordHash: 'x', accountType, callingBalanceMinutes: 100, minutesRemainingSeconds: 6000, planExpiresAt: new Date(Date.now() + 20 * 86400000) } });
    return id;
  };
  console.log('\n--- PLIVO BUSINESS NUMBERS ---');

  await test('documents are checked by their bytes (PDF/PNG/JPEG, max 3 MB)', async () => {
    assert.strictEqual(readComplianceDocument({ name: 'gst.pdf', contentBase64: PDF.toString('base64') }, 'GST').mimeType, 'application/pdf');
    assert.strictEqual(readComplianceDocument({ name: 'coi', contentBase64: PNG.toString('base64') }, 'COI').mimeType, 'image/png');
    assert.throws(() => readComplianceDocument({ name: 'x.pdf', contentBase64: Buffer.from('hello').toString('base64') }, 'GST'), /PDF, PNG or JPEG/);
    assert.throws(() => readComplianceDocument({ name: 'big.pdf', contentBase64: Buffer.concat([PDF, Buffer.alloc(3 * 1024 * 1024)]).toString('base64') }, 'GST'), /3 MB/);
    assert.throws(() => readComplianceDocument({}, 'GST'), /required/);
  });

  await test('onboarding a carrier subaccount needs a paid plan', async () => {
    const free = await newUser('free');
    await prisma.user.update({ where: { id: free }, data: { planExpiresAt: null } });
    assert.strictEqual((await call('POST', '/plivo/onboard', free)).status, 403);
  });

  const u = await newUser();
  await test('the business application is filed for the customer\'s own subaccount with both documents', async () => {
    const bad = await call('POST', '/plivo/compliance', u, { businessName: 'Acme Traders Pvt Ltd', addressLine1: '1 MG Road', city: 'Bengaluru', state: 'Karnataka', postalCode: '56', registrationCertificate: { name: 'coi.pdf', contentBase64: PDF.toString('base64') }, gstCertificate: { name: 'gst.png', contentBase64: PNG.toString('base64') } });
    assert.strictEqual(bad.status, 400, 'invalid PIN refused');
    const r = await call('POST', '/plivo/compliance', u, { businessName: 'Acme Traders Pvt Ltd', registrationNumber: 'U72900KA2024PTC123456', addressLine1: '1 MG Road', city: 'Bengaluru', state: 'Karnataka', postalCode: '560001', registrationCertificate: { name: 'coi.pdf', contentBase64: PDF.toString('base64') }, gstCertificate: { name: 'gst.png', contentBase64: PNG.toString('base64') } });
    assert.strictEqual(r.status, 201, JSON.stringify(r.body));
    const sub = await prisma.plivoSubAccount.findUnique({ where: { userId: u } });
    const submit = seen.filter((s) => s.method === 'POST' && s.url.endsWith('/PhoneNumber/Compliance/')).pop();
    assert.ok(/multipart\/form-data/.test(submit.type), 'multipart upload');
    const dataJson = JSON.parse(submit.raw.match(/name="data"\r\n\r\n([\s\S]*?)\r\n--/)[1]);
    assert.strictEqual(dataJson.subaccount, sub.authId, 'filed for the customer subaccount');
    assert.strictEqual(dataJson.end_user.type, 'business');
    assert.deepStrictEqual(dataJson.documents, [{ document_type_id: 'dt-reg', data_fields: { business_name: 'Acme Traders Pvt Ltd' } }, { document_type_id: 'dt-gst' }]);
    assert.ok(submit.raw.includes('name="documents[0].file"') && submit.raw.includes('name="documents[1].file"'), 'both files attached');
    const row = await prisma.plivoComplianceApplication.findUnique({ where: { userId: u } });
    assert.strictEqual(row.status, 'submitted');
  });

  await test('no business number until Plivo accepts; then the purchase carries compliance_application_id', async () => {
    reviewStatus = 'submitted';
    const number = `9180${Math.floor(10000000 + Math.random() * 89999999)}`;
    const early = await call('POST', '/plivo/claim', u, { number, region: 'Bengaluru' });
    assert.strictEqual(early.status, 403);
    assert.strictEqual(early.body.code, 'BUSINESS_VERIFICATION_REQUIRED');
    assert.ok(!seen.some((s) => s.method === 'POST' && s.url.endsWith(`/PhoneNumber/${number}/`)), 'nothing rented before acceptance');

    reviewStatus = 'accepted';
    const status = await call('GET', '/plivo/compliance', u);
    assert.strictEqual(status.body.data.status, 'accepted');
    const ok = await call('POST', '/plivo/claim', u, { number, region: 'Bengaluru' });
    assert.strictEqual(ok.status, 200, JSON.stringify(ok.body));
    const buy = seen.filter((s) => s.method === 'POST' && s.url.endsWith(`/PhoneNumber/${number}/`)).pop();
    const body = JSON.parse(buy.raw);
    const appRow = await prisma.plivoComplianceApplication.findUnique({ where: { userId: u } });
    assert.strictEqual(body.compliance_application_id, appRow.complianceId);
    assert.strictEqual(body.subaccount, appRow.subaccountAuthId);
  });

  await test('a rejected application shows the reason and can be submitted again', async () => {
    const v = await newUser();
    reviewStatus = 'submitted';
    const docs = { registrationCertificate: { name: 'coi.pdf', contentBase64: PDF.toString('base64') }, gstCertificate: { name: 'gst.png', contentBase64: PNG.toString('base64') } };
    const form = { businessName: 'Beta Foods LLP', addressLine1: '2 Park St', city: 'Kolkata', state: 'West Bengal', postalCode: '700016', ...docs };
    assert.strictEqual((await call('POST', '/plivo/compliance', v, form)).status, 201);
    assert.strictEqual((await call('POST', '/plivo/compliance', v, form)).status, 400, 'no duplicate while under review');
    reviewStatus = 'rejected';
    const s = await call('GET', '/plivo/compliance', v);
    assert.strictEqual(s.body.data.status, 'rejected');
    assert.strictEqual(s.body.data.rejectionReason, 'Name mismatch');
    reviewStatus = 'submitted';
    assert.strictEqual((await call('POST', '/plivo/compliance', v, form)).status, 201, 'resubmitted');
  });

  console.log(`\nPlivo business numbers: ${passed}/${total} passed`);
  server.close();
  fake.close();
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
