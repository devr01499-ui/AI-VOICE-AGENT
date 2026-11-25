require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Vobiz KYC approval reaches the customer without them having to come back (owner report
 * 2026-11-25: "KYC is taking too much time for approval"). Before fix/vobiz-kyc-status-poll nothing
 * asked Vobiz for a pending customer's KYC result: the state changed only if Vobiz's webhook reached
 * us, or the customer happened to open Calling Config. Plivo already had a 15-minute poll.
 * Production code against a local fake Vobiz (documented paths); no real carrier is contacted.
 *  - an approved customer is marked verified, calls unblocked, their KYC-gated number activated,
 *    and told once (in-app); a second run does not repeat it
 *  - a customer still under review stays pending, is not notified, and is checked again later
 *  - simulated (SA_MOCK_) sub-accounts and the platform admin are never polled
 *  - a carrier error on one account does not stop the others
 * Run: npm run test:vobiz-kyc-poll   (part of npm run test:security)
 */
const assert = require('assert');
const crypto = require('crypto');
const http = require('http');

let total = 0;
let passed = 0;
async function test(name, fn) {
  total++;
  try { await fn(); passed++; console.log(`  ✓ ${name}`); } catch (err) { console.error(`  ✗ FAIL: ${name}\n    ${err.stack || err.message}`); }
}

const MA = 'MA_TESTKYCPOLL';
const RUN = crypto.randomBytes(4).toString('hex').toUpperCase();
const kyc = new Map(); // SA -> { overall_status, kyc_calls_blocked, own, fail }
let saSeq = 0;
const fake = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => { raw += c; });
  req.on('end', () => {
    const body = raw ? JSON.parse(raw) : null;
    const send = (status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
    let m;
    if (req.method === 'POST' && req.url === `/api/v1/accounts/${MA}/sub-accounts/`) {
      const sa = `SA_POLL${RUN}${++saSeq}`;
      kyc.set(sa, { overall_status: 'pending', kyc_calls_blocked: true, own: false, fail: false });
      return send(201, { sub_account: { auth_id: sa }, auth_credentials: { auth_id: sa, auth_token: `tok_${sa}` }, kyc_mode: body?.kyc_mode });
    }
    if (req.method === 'GET' && (m = req.url.match(/^\/api\/v1\/sub-accounts\/([^/]+)\/kyc\/status$/))) {
      const st = kyc.get(decodeURIComponent(m[1]));
      if (!st) return send(404, { error: 'not found' });
      if (st.fail) return send(503, { error: 'carrier busy' });
      const v = st.own ? 'verified' : 'pending';
      return send(200, { kyc_mode: 'customer_use', business_type: 'individual', overall_status: st.overall_status, kyc_calls_blocked: st.kyc_calls_blocked, verifications: { pan: v, aadhaar: v, gst: 'not_started', cin: 'not_started' } });
    }
    return send(404, { error: `unhandled ${req.method} ${req.url}` });
  });
});

async function main() {
  await new Promise((r) => fake.listen(0, '127.0.0.1', r));
  process.env.VOBIZ_API_URL = `http://127.0.0.1:${fake.address().port}`;
  process.env.VOBIZ_AUTH_ID = MA;
  process.env.VOBIZ_AUTH_TOKEN = 'test_only_master_token';
  delete process.env.RESEND_API_KEY; // no email leaves the machine
  const { prisma } = require('../dist/lib/prisma');
  const { VobizSubAccountService } = require('../dist/services/VobizSubAccountService');
  let poll;
  try { poll = require('../dist/services/VobizKycStatusPoll'); } catch { poll = null; }
  console.log('\n--- VOBIZ KYC STATUS POLL ---');

  const users = [];
  const newCustomer = async (extra = {}) => {
    const id = crypto.randomUUID();
    users.push(id);
    await prisma.user.create({ data: { id, email: `kp-${id.slice(0, 8)}@claritiy-test.co.in`, fullName: 'Kyc Poll', passwordHash: 'x', accountType: 'developer', callingBalanceMinutes: 100, ...extra } });
    const sub = await new VobizSubAccountService().getOrCreateSubAccount(id, `kp-${id.slice(0, 8)}@claritiy-test.co.in`);
    return { id, sub: await prisma.vobizSubAccount.findUnique({ where: { userId: id } }), authId: sub.authId };
  };
  const kycNotices = (userId) => prisma.systemAlert.count({ where: { userId, message: { contains: 'KYC Verification Approved' } } });
  const run = () => poll.refreshPendingVobizKyc(new VobizSubAccountService(), { pauseMs: 0, limit: 500 });

  const approved = await newCustomer();
  const number = `+9180${String(Math.floor(10000000 + Math.random() * 89999999))}`;
  await prisma.phoneNumber.create({ data: { phoneNumber: number, userId: approved.id, countryCode: 'IN', telephonyProvider: 'vobiz', status: 'activation_pending', kycStatus: 'pending', aadhaarRequired: true } });
  const waiting = await newCustomer();
  const flaky = await newCustomer();
  const later = await newCustomer();

  try {
    await test('the poll exists (services/VobizKycStatusPoll.refreshPendingVobizKyc)', () => {
      assert.ok(poll && typeof poll.refreshPendingVobizKyc === 'function', 'no Vobiz KYC poll: an approval waits for the webhook or a page visit');
      assert.strictEqual(typeof poll.startVobizKycStatusPoll, 'function');
    });
    if (!poll) throw new Error('stop');

    // Vobiz approves one customer's own KYC; another is still under review; one answers 503.
    Object.assign(kyc.get(approved.authId), { overall_status: 'verified', kyc_calls_blocked: false, own: true });
    kyc.get(flaky.authId).fail = true;
    Object.assign(kyc.get(later.authId), { overall_status: 'verified', kyc_calls_blocked: false, own: true });

    await test('approved at Vobiz: verified, calls unblocked, number activated, told once', async () => {
      await run();
      const sub = await prisma.vobizSubAccount.findUnique({ where: { userId: approved.id } });
      assert.strictEqual(sub.kycStatus, 'verified');
      assert.strictEqual(sub.kycCallsBlocked, false);
      const phone = await prisma.phoneNumber.findUnique({ where: { phoneNumber: number } });
      assert.strictEqual(phone.kycStatus, 'verified');
      assert.strictEqual(phone.status, 'active');
      assert.strictEqual(await kycNotices(approved.id), 1);
      await run();
      assert.strictEqual(await kycNotices(approved.id), 1, 'the approval notice was repeated');
    });

    await test('still under review: stays pending, calls blocked, no notice', async () => {
      const sub = await prisma.vobizSubAccount.findUnique({ where: { userId: waiting.id } });
      assert.strictEqual(sub.kycStatus, 'pending');
      assert.strictEqual(sub.kycCallsBlocked, true);
      assert.strictEqual(await kycNotices(waiting.id), 0);
    });

    await test('a carrier error on one account does not stop the others (they were verified in the same run)', async () => {
      const f = await prisma.vobizSubAccount.findUnique({ where: { userId: flaky.id } });
      assert.strictEqual(f.kycStatus, 'pending', 'an error must fail closed');
      const l = await prisma.vobizSubAccount.findUnique({ where: { userId: later.id } });
      assert.strictEqual(l.kycStatus, 'verified');
    });

    await test('when the carrier recovers, the next run picks the account up', async () => {
      Object.assign(kyc.get(flaky.authId), { fail: false, overall_status: 'verified', kyc_calls_blocked: false, own: true });
      await run();
      const f = await prisma.vobizSubAccount.findUnique({ where: { userId: flaky.id } });
      assert.strictEqual(f.kycStatus, 'verified');
      assert.strictEqual(await kycNotices(flaky.id), 1);
    });

    await test('simulated sub-accounts are skipped; the owner (carrier main account) is set verified without a carrier call', async () => {
      const mockUser = crypto.randomUUID();
      const admin = crypto.randomUUID();
      users.push(mockUser, admin);
      await prisma.user.create({ data: { id: mockUser, email: `kpm-${mockUser.slice(0, 8)}@claritiy-test.co.in`, fullName: 'M', passwordHash: 'x' } });
      await prisma.user.create({ data: { id: admin, email: `kpa-${admin.slice(0, 8)}@claritiy-test.co.in`, fullName: 'A', passwordHash: 'x', accountType: 'admin' } });
      await prisma.vobizSubAccount.create({ data: { userId: mockUser, authId: `SA_MOCK_${RUN}`, authToken: 'x' } });
      await prisma.vobizSubAccount.create({ data: { userId: admin, authId: `SA_ADMIN${RUN}`, authToken: 'x' } });
      const { checked } = await poll.refreshPendingVobizKyc(new VobizSubAccountService(), { pauseMs: 0, limit: 500, userIds: [mockUser, admin] });
      assert.strictEqual(checked, 1, 'only the owner row (the SA_MOCK_ row is skipped)');
      const a = await prisma.vobizSubAccount.findUnique({ where: { userId: admin } });
      assert.deepStrictEqual([a.kycStatus, a.kycCallsBlocked], ['verified', false], 'SA_ADMIN is unknown to the fake carrier: no carrier call was needed');
    });
  } catch (e) {
    if (e.message !== 'stop') throw e;
  } finally {
    await prisma.phoneNumber.deleteMany({ where: { userId: { in: users } } }).catch(() => {});
    await prisma.systemAlert.deleteMany({ where: { userId: { in: users } } }).catch(() => {});
    await prisma.vobizSubAccount.deleteMany({ where: { userId: { in: users } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: users } } }).catch(() => {});
    fake.close();
  }

  console.log(`\nVOBIZ KYC POLL: ${passed}/${total} ${passed === total ? 'PASS' : 'FAIL'}`);
  await prisma.$disconnect();
  process.exit(passed === total ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
