require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Vobiz accuracy against the documented API (docs checked 2026-11-19). Production code talks to a
 * local fake Vobiz that answers like the docs say; no real carrier is contacted.
 *  - sub-accounts are created as customer_use with the customer's email (own KYC, calls blocked)
 *  - "calls not blocked" on a personal_use sub-account (inherited master KYC) never counts as verified;
 *    such accounts are switched to customer_use (PUT) and re-read
 *  - the KYC webhook cannot verify anyone by itself: the state is read back from Vobiz
 *  - purchase sends only documented fields; assignment uses POST /account/{MA}/numbers/%2B.../assign-subaccount
 *  - a bought number is active right away (no manual top-up)
 *  - release deletes the local number only when Vobiz confirms; cool-off keeps it as release_pending
 *  - legacy sub-accounts are marked personal_use once and switched; blocked users are told to do KYC
 * Run: npm run test:carrier-accuracy   (part of npm run test:security)
 */
const assert = require('assert');
const crypto = require('crypto');
const http = require('http');
const express = require('express');
const fs = require('fs');
const path = require('path');

let total = 0;
let passed = 0;
async function test(name, fn) {
  total++;
  try { await fn(); passed++; console.log(`  ✓ ${name}`); } catch (err) { console.error(`  ✗ FAIL: ${name}\n    ${err.stack || err.message}`); }
}

// ── Fake Vobiz (documented paths only) ─────────────────────────────────────────────
const MA = 'MA_TESTCARRIER';
const DID = '+9180' + String(Math.floor(10000000 + Math.random() * 89999999)); // unique per run
const rel = () => '+9180' + String(Math.floor(10000000 + Math.random() * 89999999));
const calls = [];
const kyc = new Map(); // SA -> { kyc_mode, overall_status, kyc_calls_blocked, ownVerified }
const behaviour = { putStatus: 200, unrent: [], unassign: [] };
let saSeq = 0;
const RUN = crypto.randomBytes(4).toString('hex').toUpperCase(); // sub-account ids unique per run
const fake = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => { raw += c; });
  req.on('end', () => {
    const body = raw ? JSON.parse(raw) : null;
    const url = req.url;
    calls.push({ method: req.method, url, body, auth: req.headers['x-auth-id'] });
    const send = (status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(obj === undefined ? '' : JSON.stringify(obj)); };
    let m;
    if (req.method === 'POST' && url === `/api/v1/accounts/${MA}/sub-accounts/`) {
      const sa = `SA_FAKE${RUN}${++saSeq}`;
      kyc.set(sa, { kyc_mode: body.kyc_mode || 'personal_use', overall_status: 'not_started', kyc_calls_blocked: body.kyc_mode === 'customer_use', ownVerified: false });
      return send(201, { message: 'Sub-account created successfully', sub_account: { auth_id: sa }, auth_credentials: { auth_id: sa, auth_token: `tok_${sa}` } });
    }
    if (req.method === 'GET' && /^\/api\/v1\/Account\/SA_[A-Z0-9]+\/Call\/$/.test(url)) return send(200, { objects: [] });
    if (req.method === 'GET' && (m = url.match(/^\/api\/v1\/sub-accounts\/([^/]+)\/kyc\/status$/))) {
      const st = kyc.get(decodeURIComponent(m[1]));
      if (!st) return send(404, { error: 'not found' });
      return send(200, { sub_account_id: m[1], kyc_mode: st.kyc_mode, business_type: 'individual', overall_status: st.overall_status, kyc_calls_blocked: st.kyc_calls_blocked, verifications: { pan: st.ownVerified ? 'verified' : 'not_started', aadhaar: st.ownVerified ? 'verified' : 'not_started', gst: 'not_started', cin: 'not_started' } });
    }
    if (req.method === 'PUT' && (m = url.match(new RegExp(`^/api/v1/accounts/${MA}/sub-accounts/([^/]+)$`)))) {
      if (behaviour.putStatus !== 200) return send(behaviour.putStatus, { error: 'refused' });
      const st = kyc.get(decodeURIComponent(m[1]));
      if (!st) return send(404, { error: 'not found' });
      if (body.kyc_mode === 'customer_use') {
        if (!body.email) return send(400, { error: 'email required' });
        st.kyc_mode = 'customer_use';
        st.overall_status = st.ownVerified ? 'verified' : 'pending';
        st.kyc_calls_blocked = !st.ownVerified;
      }
      return send(200, { message: 'updated' });
    }
    if (req.method === 'GET' && (m = url.match(new RegExp(`^/api/v1/Account/${MA}/inventory/numbers/([^/?]+)$`)))) {
      return send(200, { id: m[1], e164: DID, country: 'IN', region: 'Karnataka', monthly_fee: 500, setup_fee: 0, currency: 'INR', aadhaar_verification_required: false });
    }
    if (req.method === 'POST' && url === `/api/v1/Account/${MA}/numbers/purchase-from-inventory`) return send(200, { message: 'purchased' });
    if (req.method === 'POST' && (m = url.match(new RegExp(`^/api/v1/account/${MA}/numbers/([^/]+)/assign-subaccount$`)))) {
      return decodeURIComponent(m[1]).startsWith('+91') && body?.sub_account_id?.startsWith('SA_') ? send(204) : send(404, { error: 'bad' });
    }
    if (req.method === 'DELETE' && (m = url.match(new RegExp(`^/api/v1/account/${MA}/numbers/([^/]+)/assign-subaccount$`)))) {
      const [status, payload] = behaviour.unassign.shift() || [204];
      return send(status, payload);
    }
    if (req.method === 'DELETE' && (m = url.match(new RegExp(`^/api/v1/Account/${MA}/numbers/([^/]+)$`)))) {
      const [status, payload] = behaviour.unrent.shift() || [204];
      return send(status, payload);
    }
    return send(404, { error: `unhandled ${req.method} ${url}` });
  });
});

async function main() {
  await new Promise((r) => fake.listen(0, '127.0.0.1', r));
  process.env.VOBIZ_API_URL = `http://127.0.0.1:${fake.address().port}`;
  process.env.VOBIZ_AUTH_ID = MA;
  process.env.VOBIZ_AUTH_TOKEN = 'test_only_master_token';
  process.env.VOBIZ_WEBHOOK_SECRET = 'test_only_vobiz_webhook_secret';
  const { prisma } = require('../dist/lib/prisma');
  const { VobizSubAccountService } = require('../dist/services/VobizSubAccountService');
  const { vobizKycVerdict } = require('../dist/utils/kycStatus');
  console.log('\n--- CARRIER ACCURACY (Vobiz) ---');

  const newUser = async (extra = {}) => {
    const id = crypto.randomUUID();
    await prisma.user.create({ data: { id, email: `ca-${id.slice(0, 8)}@claritiy-test.co.in`, fullName: 'Carrier Test', passwordHash: 'x', accountType: 'developer', callingBalanceMinutes: 100, minutesRemainingSeconds: 6000, ...extra } });
    return prisma.user.findUnique({ where: { id } });
  };
  const svc = new VobizSubAccountService();

  await test('a new sub-account is customer_use with the customer email; calls blocked until Vobiz verifies them', async () => {
    const u = await newUser();
    const sub = await svc.getOrCreateSubAccount(u.id, u.email);
    const create = calls.filter((c) => c.method === 'POST' && c.url.endsWith('/sub-accounts/')).pop();
    assert.deepStrictEqual(create.body, { name: u.email, email: u.email, enabled: true, kyc_mode: 'customer_use' });
    assert.strictEqual(create.auth, MA, 'created with master credentials');
    assert.strictEqual(sub.kycMode, 'customer_use');
    assert.strictEqual(sub.kycCallsBlocked, true);
    assert.throws(() => VobizSubAccountService.createBody(''), /email/);
  });

  await test('verdict (Vobiz docs): a customer is verified only by their OWN customer_use KYC', async () => {
    const pick = (d) => { const v = vobizKycVerdict(d); return [v.kycStatus, v.kycCallsBlocked]; };
    assert.deepStrictEqual(pick({ kyc_mode: 'personal_use', overall_status: 'verified', kyc_calls_blocked: false }), ['pending', true], 'a customer on inherited KYC is not verified');
    assert.deepStrictEqual(pick({ overall_status: 'verified', kyc_calls_blocked: false }), ['pending', true], 'no kyc_mode = not proven');
    assert.deepStrictEqual(pick({ kyc_mode: 'customer_use', overall_status: 'verified', kyc_calls_blocked: false }), ['verified', false]);
    assert.deepStrictEqual(pick({ kyc_mode: 'customer_use', overall_status: 'verified', kyc_calls_blocked: true }), ['pending', true], 'still blocked = not done');
    assert.deepStrictEqual(pick({ kyc_mode: 'customer_use', overall_status: 'failed', kyc_calls_blocked: true }), ['failed', true]);
    assert.deepStrictEqual(vobizKycVerdict({ kyc_mode: 'customer_use', verifications: { pan: 'Verified', aadhaar: 'failed' } }).verifications, { pan: 'verified', gst: 'not_started', aadhaar: 'failed', cin: 'not_started' });
  });

  await test('owner account (owner report 2026-11-25): the carrier main account is verified everywhere, never judged by a sub-account', async () => {
    const { kycSummary } = require('../dist/utils/kycStatus');
    const { refreshPendingVobizKyc } = require('../dist/services/VobizKycStatusPoll');
    const stored = (id) => prisma.vobizSubAccount.findUnique({ where: { userId: id } });
    // Exactly the reported state: a leftover personal_use sub-account that Vobiz reports as blocked,
    // stored "pending, calls blocked" by the previous release.
    const owner = await newUser({ accountType: 'admin' });
    const sa = 'SA_PLAT' + crypto.randomBytes(3).toString('hex').toUpperCase();
    kyc.set(sa, { kyc_mode: 'personal_use', overall_status: 'not_started', kyc_calls_blocked: true, ownVerified: false });
    await prisma.vobizSubAccount.create({ data: { userId: owner.id, authId: sa, authToken: 'x', kycMode: 'missing_at_carrier', kycStatus: 'pending', kycCallsBlocked: true } });
    const before = calls.length;
    for (const run of [() => refreshPendingVobizKyc(svc, { pauseMs: 0, userIds: [owner.id] }), () => svc.refreshKyc(owner.id, 'kyc_page'), () => svc.syncKycStatus(owner.id)]) {
      await run();
      const row = await stored(owner.id);
      assert.deepStrictEqual([row.kycStatus, row.kycCallsBlocked], ['verified', false], 'every path stores verified, calls not blocked');
      assert.deepStrictEqual([kycSummary(row, true).status, kycSummary(row, true).callsBlocked, kycSummary(row, true).source], ['verified', false, 'company']);
    }
    assert.strictEqual(calls.length, before, 'no carrier call and no customer_use switch for the main account');
    assert.deepStrictEqual((await svc.syncKycStatus(owner.id)), { kycStatus: 'verified', isVerified: true, changed: false });
    // An owner without any sub-account row is still the verified main account.
    const bare = await newUser({ accountType: 'admin' });
    assert.deepStrictEqual([kycSummary(null, true).status, kycSummary(null, true).source], ['verified', 'company']);
    assert.strictEqual((await svc.syncKycStatus(bare.id)).isVerified, true);
    assert.strictEqual(await prisma.vobizSubAccount.count({ where: { userId: bare.id } }), 0, 'no sub-account is created for the owner');

    // Inbound and outbound gates both treat the owner's account as the main account.
    const read = (p) => fs.readFileSync(path.join(__dirname, '..', 'src', p), 'utf8');
    assert.ok(read('services/InboundCallService.ts').includes('!isPlatformAccount(user)'), 'inbound gate exempts the main account');
    assert.ok(/isAdmin = user\.accountType === 'admin' \|\| user\.email === ADMIN_EMAIL/.test(read('services/CallService.ts')), 'outbound gate exempts the main account');
  });

  await test('one KYC truth for customers: no sticky state, carrier silent = no change, one reader everywhere', async () => {
    const stored = (id) => prisma.vobizSubAccount.findUnique({ where: { userId: id } });
    const u = await newUser();
    const sub = await svc.getOrCreateSubAccount(u.id, u.email);
    Object.assign(kyc.get(sub.authId), { kyc_mode: 'customer_use', overall_status: 'verified', kyc_calls_blocked: false, ownVerified: true });
    assert.strictEqual((await svc.refreshKyc(u.id, 'kyc_poll')).kycStatus, 'verified');
    assert.deepStrictEqual((await stored(u.id)).kycVerifications, { pan: 'verified', gst: 'not_started', aadhaar: 'verified', cin: 'not_started' });
    Object.assign(kyc.get(sub.authId), { overall_status: 'pending', kyc_calls_blocked: true });
    await svc.refreshKyc(u.id, 'kyc_poll');
    const down = await stored(u.id);
    assert.deepStrictEqual([down.kycStatus, down.kycCallsBlocked], ['pending', true], 'a carrier downgrade is shown, never hidden');

    // Carrier silent: nothing stored changes.
    kyc.delete(sub.authId);
    assert.strictEqual(await svc.refreshKyc(u.id, 'kyc_poll'), null);
    assert.strictEqual((await stored(u.id)).kycStatus, 'pending');

    // Every screen reads the one summary; nothing else computes a KYC headline or keeps a sticky state.
    const read = (p) => fs.readFileSync(path.join(__dirname, '..', 'src', p), 'utf8');
    const kycRoutes = read('routes/kyc.ts');
    const docsRoute = kycRoutes.slice(kycRoutes.indexOf("router.get('/documents'"), kycRoutes.indexOf("router.post('/verify-document'"));
    assert.ok(docsRoute.includes('kycSummaryFor(userId)'), '/kyc/documents headline = kycSummary');
    assert.ok(kycRoutes.includes("refreshKyc(userId, 'kyc_page')") && kycRoutes.includes("refreshKyc(subAccount.userId, 'kyc_webhook')"));
    const admin = read('routes/adminRoutes.ts');
    assert.ok((admin.match(/kycSummary\(/g) || []).length >= 3, 'admin list, customer 360 and re-check use kycSummary');
    for (const p of ['routes/kyc.ts', 'routes/adminRoutes.ts', 'services/VobizSubAccountService.ts', 'services/VobizKycStatusPoll.ts', 'utils/kycStatus.ts']) {
      assert.ok(!/nextKycState|applyKycStatus/.test(read(p)), p + ': no second KYC writer / sticky rule');
    }
  });

  await test('sync on a personal_use account switches it to customer_use and keeps an unverified user blocked', async () => {
    const u = await newUser();
    const sub = await svc.getOrCreateSubAccount(u.id, u.email);
    Object.assign(kyc.get(sub.authId), { kyc_mode: 'personal_use', overall_status: 'verified', kyc_calls_blocked: false, ownVerified: false });
    await prisma.vobizSubAccount.update({ where: { id: sub.id }, data: { kycStatus: 'verified', kycCallsBlocked: false, kycMode: 'personal_use' } });
    const r = await svc.syncKycStatus(u.id);
    const put = calls.filter((c) => c.method === 'PUT').pop();
    assert.deepStrictEqual(put.body, { email: u.email, kyc_mode: 'customer_use' });
    assert.strictEqual(r.isVerified, false, 'inherited KYC does not verify the user');
    const after = await prisma.vobizSubAccount.findUnique({ where: { id: sub.id } });
    assert.strictEqual(after.kycMode, 'customer_use');
    assert.strictEqual(after.kycCallsBlocked, true);
    assert.notStrictEqual(after.kycStatus, 'verified');
  });

  await test('a user Vobiz verified keeps calling after the switch; a refused switch still never verifies', async () => {
    const u = await newUser();
    const sub = await svc.getOrCreateSubAccount(u.id, u.email);
    Object.assign(kyc.get(sub.authId), { kyc_mode: 'personal_use', overall_status: 'verified', kyc_calls_blocked: false, ownVerified: true });
    const r = await svc.syncKycStatus(u.id);
    assert.strictEqual(r.isVerified, true, 'own KYC verified at Vobiz');
    const ok = await prisma.vobizSubAccount.findUnique({ where: { id: sub.id } });
    assert.strictEqual(ok.kycCallsBlocked, false);

    const u2 = await newUser();
    const sub2 = await svc.getOrCreateSubAccount(u2.id, u2.email);
    Object.assign(kyc.get(sub2.authId), { kyc_mode: 'personal_use', overall_status: 'verified', kyc_calls_blocked: false, ownVerified: false });
    behaviour.putStatus = 400;
    try {
      const r2 = await svc.syncKycStatus(u2.id);
      assert.strictEqual(r2.isVerified, false);
      const blocked = await prisma.vobizSubAccount.findUnique({ where: { id: sub2.id } });
      assert.strictEqual(blocked.kycCallsBlocked, true, 'fail closed when Vobiz refuses the switch');
    } finally {
      behaviour.putStatus = 200;
    }
  });

  await test('the KYC webhook cannot verify anyone by itself: Vobiz status is read back', async () => {
    const kycRouter = require('../dist/routes/kyc').default;
    const app = express();
    app.use(express.json());
    app.use('/api/v2/kyc', kycRouter);
    const server = http.createServer(app);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    try {
      const u = await newUser();
      const sub = await svc.getOrCreateSubAccount(u.id, u.email);
      Object.assign(kyc.get(sub.authId), { kyc_mode: 'customer_use', overall_status: 'pending', kyc_calls_blocked: true, ownVerified: false });
      const post = (payload) => fetch(`http://127.0.0.1:${server.address().port}/api/v2/kyc/webhook/vobiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Vobiz-Token': process.env.VOBIZ_WEBHOOK_SECRET, 'X-Vobiz-Nonce': crypto.randomUUID() },
        body: JSON.stringify(payload),
      });
      const r = await post({ sub_account_auth_id: sub.authId, status: 'verified' });
      assert.strictEqual(r.status, 200);
      let row = await prisma.vobizSubAccount.findUnique({ where: { id: sub.id } });
      assert.notStrictEqual(row.kycStatus, 'verified', 'a "verified" webhook alone changes nothing');
      assert.strictEqual(row.kycCallsBlocked, true);

      Object.assign(kyc.get(sub.authId), { overall_status: 'verified', kyc_calls_blocked: false, ownVerified: true });
      await post({ sub_account_auth_id: sub.authId, status: 'verified' });
      row = await prisma.vobizSubAccount.findUnique({ where: { id: sub.id } });
      assert.strictEqual(row.kycStatus, 'verified', 'verified once Vobiz confirms');
      assert.strictEqual(row.kycCallsBlocked, false);

      // Documented KYC event: account_auth_id, X-Vobiz-Signature "sha256=<HMAC-SHA256 of the raw body,
      // keyed with the parent account's auth token>".
      const url = `http://127.0.0.1:${server.address().port}/api/v2/kyc/webhook/vobiz`;
      const signed = (payload, key) => {
        const body = JSON.stringify(payload);
        const sig = 'sha256=' + crypto.createHmac('sha256', key).update(body).digest('hex');
        return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Vobiz-Signature': sig }, body });
      };
      Object.assign(kyc.get(sub.authId), { overall_status: 'failed', kyc_calls_blocked: true, ownVerified: false });
      assert.strictEqual((await signed({ event: 'kyc.failed', account_auth_id: sub.authId }, 'wrong_key')).status, 401, 'forged signature refused');
      assert.strictEqual((await prisma.vobizSubAccount.findUnique({ where: { id: sub.id } })).kycStatus, 'verified', 'nothing changed by a forged call');
      assert.strictEqual((await signed({ event: 'kyc.failed', account_auth_id: sub.authId }, process.env.VOBIZ_AUTH_TOKEN)).status, 200);
      row = await prisma.vobizSubAccount.findUnique({ where: { id: sub.id } });
      assert.deepStrictEqual([row.kycStatus, row.kycCallsBlocked], ['failed', true], 'documented event read back from Vobiz');
    } finally {
      server.close();
    }
  });

  await test('purchase uses documented fields, assigns via assign-subaccount, and the number is active at once', async () => {
    const { VobizPhoneNumberService } = require('../dist/services/VobizPhoneNumberService');
    const u = await newUser();
    calls.length = 0;
    const out = await new VobizPhoneNumberService().purchaseAndAssignNumber({ userId: u.id, idempotencyKey: `order_ca_${crypto.randomUUID().slice(0, 8)}`, vobizNumberId: 'inv-1', expectedPrice: 500 });
    const purchase = calls.find((c) => c.url.endsWith('/numbers/purchase-from-inventory'));
    assert.deepStrictEqual(Object.keys(purchase.body).sort(), ['currency', 'e164'], 'only documented purchase fields');
    const assign = calls.find((c) => c.url.includes('/assign-subaccount') && c.method === 'POST');
    assert.ok(assign, 'documented assignment endpoint used');
    assert.ok(assign.url.includes('/api/v1/account/') && assign.url.includes(encodeURIComponent(DID)), `lowercase /account/ and %2B-encoded number (${assign.url})`);
    assert.ok(/^SA_/.test(assign.body.sub_account_id));
    assert.strictEqual(out.phoneNumber.status, 'active', 'no manual top-up step');
  });

  await test('release: deleted only when Vobiz confirms; cool-off keeps it as release_pending', async () => {
    const { UsageSyncService } = require('../dist/services/UsageSyncService');
    const u = await newUser();
    const mk = (n) => prisma.phoneNumber.create({ data: { userId: u.id, phoneNumber: n, countryCode: 'IN', telephonyProvider: 'vobiz', status: 'active' } });
    const a = await mk(rel());
    behaviour.unrent = [[204]];
    assert.deepStrictEqual(await UsageSyncService.releaseNumber(a.id, u.id), { released: true });
    assert.strictEqual(await prisma.phoneNumber.count({ where: { id: a.id } }), 0);

    const b = await mk(rel());
    behaviour.unrent = [[400, { error: 'assigned to sub-account' }]];
    behaviour.unassign = [[409, { error: 'did_cool_off_in_effect', cool_off_until: '2026-12-01T00:00:00Z', cool_off_remaining_seconds: 100 }]];
    const r = await UsageSyncService.releaseNumber(b.id, u.id);
    assert.strictEqual(r.released, false);
    assert.strictEqual(r.retryAfter.toISOString(), '2026-12-01T00:00:00.000Z');
    const kept = await prisma.phoneNumber.findUnique({ where: { id: b.id } });
    assert.strictEqual(kept.status, 'release_pending', 'kept (no calls) until the carrier releases it');

    behaviour.unrent = [[400, {}], [204]];
    behaviour.unassign = [[204]];
    assert.deepStrictEqual(await UsageSyncService.releaseNumber(b.id, u.id), { released: true }, 'unassign then unrent');
    assert.strictEqual(await prisma.phoneNumber.count({ where: { id: b.id } }), 0);
  });

  await test('legacy sub-accounts: marked personal_use once, switched to customer_use, blocked users told to do KYC', async () => {
    const { backfillLegacyKycMode, promoteLegacySubAccounts } = require('../dist/services/VobizKycModeService');
    const u = await newUser();
    const sub = await svc.getOrCreateSubAccount(u.id, u.email);
    Object.assign(kyc.get(sub.authId), { kyc_mode: 'personal_use', overall_status: 'verified', kyc_calls_blocked: false, ownVerified: false });
    await prisma.vobizSubAccount.update({ where: { id: sub.id }, data: { kycMode: 'customer_use', kycStatus: 'verified', kycCallsBlocked: false } });
    await prisma.auditLog.deleteMany({ where: { action: 'maintenance.vobiz_kyc_mode_backfill_v1' } });
    assert.ok((await backfillLegacyKycMode(new Date(Date.now() + 1000))) >= 1);
    assert.strictEqual(await backfillLegacyKycMode(), 0, 'runs once');
    assert.strictEqual((await prisma.vobizSubAccount.findUnique({ where: { id: sub.id } })).kycMode, 'personal_use');
    await promoteLegacySubAccounts(svc, { userIds: [u.id] });
    const after = await prisma.vobizSubAccount.findUnique({ where: { id: sub.id } });
    assert.strictEqual(after.kycMode, 'customer_use');
    assert.strictEqual(after.kycCallsBlocked, true);
    const note = await prisma.systemAlert.findFirst({ where: { userId: u.id, type: 'KYC_REQUIRED' } });
    assert.ok(note, 'user asked to complete KYC');
  });

  await test('legacy switch: a sub-account Vobiz does not have is marked once and never retried; platform admins are skipped', async () => {
    const { promoteLegacySubAccounts } = require('../dist/services/VobizKycModeService');
    const ghost = await newUser();
    const ghostSub = await prisma.vobizSubAccount.create({ data: { userId: ghost.id, authId: `SA_GHOST${crypto.randomBytes(4).toString('hex').toUpperCase()}`, authToken: 'x', kycMode: 'personal_use' } });
    const admin = await newUser({ accountType: 'admin' });
    const adminSub = await prisma.vobizSubAccount.create({ data: { userId: admin.id, authId: `SA_ADMIN${crypto.randomBytes(4).toString('hex').toUpperCase()}`, authToken: 'x', kycMode: 'personal_use' } });
    const putsFor = (authId) => calls.filter((c) => c.method === 'PUT' && c.url.includes(authId)).length;
    await promoteLegacySubAccounts(svc, { userIds: [ghost.id, admin.id] });
    assert.strictEqual(putsFor(ghostSub.authId), 1, 'tried once');
    assert.strictEqual((await prisma.vobizSubAccount.findUnique({ where: { id: ghostSub.id } })).kycMode, 'missing_at_carrier');
    await promoteLegacySubAccounts(svc, { userIds: [ghost.id, admin.id] });
    assert.strictEqual(putsFor(ghostSub.authId), 1, 'not retried');
    assert.strictEqual(putsFor(adminSub.authId), 0, 'platform admin never switched');
  });

  await test('Vobiz provider: requests go to <root>/api/v1 whether VOBIZ_API_URL has the suffix or not; a failed start-up check keeps telephony registered', async () => {
    const { env } = require('../dist/config/env');
    const { VobizProvider } = require('../dist/providers/vobiz/VobizProvider');
    const saved = { url: env.VOBIZ_API_URL, id: env.VOBIZ_AUTH_ID, token: env.VOBIZ_AUTH_TOKEN };
    const origFetch = global.fetch;
    const seen = [];
    global.fetch = async (u) => { seen.push(String(u)); return new Response('{}', { status: 404 }); };
    try {
      env.VOBIZ_AUTH_ID = 'MA_TESTROOT';
      env.VOBIZ_AUTH_TOKEN = 'test-token';
      for (const setting of ['https://api.vobiz.ai', 'https://api.vobiz.ai/', 'https://api.vobiz.ai/api/v1', '']) {
        env.VOBIZ_API_URL = setting;
        seen.length = 0;
        await new VobizProvider().healthCheck();
        assert.strictEqual(seen[0], 'https://api.vobiz.ai/api/v1/Account/MA_TESTROOT/', `setting "${setting}" -> ${seen[0]}`);
      }
      // Carrier answers 404 at boot: the provider is still registered for calls and hang-ups.
      const { initializeProviders } = require('../dist/config/providers');
      const { ProviderManager } = require('../dist/providers/ProviderManager');
      await initializeProviders();
      assert.ok(ProviderManager.instance.getTelephonyProvider(), 'telephony provider registered');
    } finally {
      global.fetch = origFetch;
      env.VOBIZ_API_URL = saved.url;
      env.VOBIZ_AUTH_ID = saved.id;
      env.VOBIZ_AUTH_TOKEN = saved.token;
    }
  });

  console.log(`\nCarrier accuracy: ${passed}/${total} passed`);
  fake.close();
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
