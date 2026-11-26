require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Audit batch 1 (docs/AUDIT_FINDINGS.md): confirmed high-severity defects, production code paths.
 *  #6  concurrency comes from the plan (trial 1 … enterprise 15); customers can only lower it
 *  #3  the ₹1 trial is once per account
 *  #2/#17 KYC: status normalised, never downgraded, kycCallsBlocked kept in step (+ one-time repair)
 *  #32 the carrier is never asked to record at call-request level (recording = answer XML + notice)
 *  #79 the inbound switch no longer blocks outbound; inbound-off numbers refuse inbound calls
 *  #90 "None (Unassigned)" stores null
 * Run: npm run test:audit-batch1   (part of npm run test:security)
 */
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
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
const newUser = async (accountType, extra = {}) => {
  const id = crypto.randomUUID();
  await prisma.user.create({ data: { id, email: `${id}@claritiy-test.co.in`, fullName: 'Audit', passwordHash: 'x', accountType, callingBalanceMinutes: 100, minutesRemainingSeconds: 6000, ...extra } });
  return id;
};
const src = (f) => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8');

async function main() {
  console.log('\n--- AUDIT BATCH 1 ---');

  await test('#6 concurrency limit comes from the plan; the stored value can only lower it', async () => {
    const { getPlanConcurrency, PLAN_CONFIG } = require('../dist/config/plans');
    assert.strictEqual(getPlanConcurrency('trial'), 1);
    assert.strictEqual(getPlanConcurrency('starter'), 1);
    assert.strictEqual(getPlanConcurrency('developer'), PLAN_CONFIG.startup.maxConcurrentCalls);
    assert.strictEqual(getPlanConcurrency('professional'), PLAN_CONFIG.growth.maxConcurrentCalls);
    assert.strictEqual(getPlanConcurrency('enterprise'), 15);
    assert.strictEqual(getPlanConcurrency('free'), 1, 'no plan -> 1');
    assert.strictEqual(getPlanConcurrency('trial', 10), 1, 'the old column default of 10 no longer applies');
    assert.strictEqual(getPlanConcurrency('enterprise', 3), 3, 'customer may lower');
    assert.ok(getPlanConcurrency('admin') > 1000);
  });

  await test('#6 a trial account cannot start a second simultaneous call', async () => {
    const { CallService } = require('../dist/services/CallService');
    const { callOrchestrator } = require('../dist/core/orchestrator/CallOrchestrator');
    const original = callOrchestrator.initiateOutboundCall;
    const dialed = [];
    callOrchestrator.initiateOutboundCall = async (...a) => { dialed.push(a); return crypto.randomUUID(); };
    try {
      const u = await newUser('trial', { maxConcurrentCalls: 10 });
      await prisma.vobizSubAccount.create({ data: { userId: u, authId: `SA_${u.slice(0, 8)}`, authToken: 't', kycStatus: 'verified', kycCallsBlocked: false, walletFundedAt: new Date() } });
      const agent = await prisma.agent.create({ data: { userId: u, name: 'A', status: 'active' } });
      const num = `+9198${Math.floor(10000000 + Math.random() * 89999999)}`;
      await prisma.phoneNumber.create({ data: { userId: u, phoneNumber: num, status: 'active', kycStatus: 'verified', countryCode: 'IN', type: 'local', telephonyProvider: 'vobiz', monthlyCost: 0, setupFee: 0, currency: 'INR' } });
      await prisma.call.create({ data: { userId: u, agentId: agent.id, recipientPhoneNumber: '+919812345678', status: 'in_progress' } });
      let err = null;
      try { await CallService.createCall({ phoneNumber: '+919812345679', agentId: agent.id, userId: u, fromPhoneNumber: num }); } catch (e) { err = e; }
      assert.ok(err && /Concurrency limit/i.test(err.message), `expected concurrency refusal, got ${err && err.message}`);
      assert.strictEqual(dialed.length, 0);
    } finally {
      callOrchestrator.initiateOutboundCall = original;
    }
  });

  await test('#3 the ₹1 trial can be bought once per account', async () => {
    const { BillingService } = require('../dist/services/BillingService');
    const created = [];
    BillingService.setRazorpayClientForTests({ orders: { create: async (o) => { created.push(o); return { id: `order_${created.length}`, amount: o.amount, currency: 'INR', notes: o.notes }; } } });
    const u = await newUser('free');
    const svc = new BillingService();
    const first = await svc.createPlanPurchaseOrder('trial', u);
    assert.ok(first && created.length === 1, 'first trial order is created');
    await prisma.paymentTransaction.create({ data: { userId: u, orderId: `order_t1_${u.slice(0, 8)}`, paymentId: `pay_t1_${u.slice(0, 8)}`, amount: 1, planName: 'Trial', status: 'completed' } }).catch(async (e) => {
      // Minimal row if the schema requires fewer/more fields.
      throw e;
    });
    let err = null;
    try { await svc.createPlanPurchaseOrder('trial', u); } catch (e) { err = e; }
    assert.ok(err && err.code === 'TRIAL_ALREADY_USED' && err.status === 409, `got ${err && (err.code || err.message)}`);
    assert.strictEqual(created.length, 1, 'no second trial order');
    await svc.createPlanPurchaseOrder('startup', u); // other plans still allowed
    assert.strictEqual(created.length, 2);
    BillingService.setRazorpayClientForTests(null);
  });

  await test('#2/#17 KYC state: normalised; calls unblocked only when verified (the carrier is the truth, see test:carrier-accuracy)', async () => {
    const { vobizKycVerdict, normalizeKycStatus } = require('../dist/utils/kycStatus');
    assert.strictEqual(normalizeKycStatus('APPROVED'), 'verified');
    assert.strictEqual(normalizeKycStatus('rejected'), 'failed');
    assert.strictEqual(normalizeKycStatus('not_started'), 'pending');
    assert.strictEqual(vobizKycVerdict({ kyc_mode: 'customer_use', overall_status: 'approved', kyc_calls_blocked: false }).kycCallsBlocked, false);
    assert.strictEqual(vobizKycVerdict({ kyc_mode: 'customer_use', overall_status: 'pending', kyc_calls_blocked: true }).kycCallsBlocked, true);
    assert.strictEqual(vobizKycVerdict({ kyc_mode: 'customer_use', overall_status: 'verified', kyc_calls_blocked: true }).kycCallsBlocked, true, 'an explicit carrier block is honoured');
    assert.ok(/kycCallsBlocked: v\.kycCallsBlocked/.test(src('services/VobizSubAccountService.ts')), 'the single KYC writer stores kycCallsBlocked');
    // Documents never approve the account by themselves (fix/kyc-doc-approval-carrier).
    assert.ok(!/vobizSubAccount\.update/.test(src('services/KycVerificationService.ts')), 'KycVerificationService must not write the account KYC');
    const kyc = src('routes/kyc.ts');
    // The KYC webhook no longer trusts its body: it reads the state back from Vobiz (refreshKyc),
    // which stores kycCallsBlocked (behaviour proven in test:carrier-accuracy).
    const webhook = kyc.slice(kyc.indexOf("router.post('/webhook/vobiz'"), kyc.indexOf('GET /api/v2/kyc/status'));
    assert.ok(/refreshKyc\(/.test(webhook) && !/kycStatus: normalizedStatus/.test(webhook), 'webhook confirms with Vobiz instead of trusting the body');
  });

  await test('#2 one-time repair unblocks already-verified accounts, once', async () => {
    const { repairVerifiedCallBlocks } = require('../dist/utils/kycStatus');
    await prisma.auditLog.deleteMany({ where: { action: 'maintenance.kyc_calls_unblocked_v1' } });
    const v = await newUser('starter');
    const p = await newUser('starter');
    await prisma.vobizSubAccount.create({ data: { userId: v, authId: `SA_v_${v.slice(0, 6)}`, authToken: 't', kycStatus: 'verified', kycCallsBlocked: true } });
    await prisma.vobizSubAccount.create({ data: { userId: p, authId: `SA_p_${p.slice(0, 6)}`, authToken: 't', kycStatus: 'pending', kycCallsBlocked: true } });
    const n = await repairVerifiedCallBlocks();
    assert.ok(n >= 1);
    assert.strictEqual((await prisma.vobizSubAccount.findUnique({ where: { userId: v } })).kycCallsBlocked, false);
    assert.strictEqual((await prisma.vobizSubAccount.findUnique({ where: { userId: p } })).kycCallsBlocked, true, 'pending stays blocked');
    await prisma.vobizSubAccount.update({ where: { userId: v }, data: { kycCallsBlocked: true } });
    assert.strictEqual(await repairVerifiedCallBlocks(), 0, 'runs once');
  });

  await test('#32 outbound calls never ask the carrier to record; recording only via the answer XML notice', async () => {
    const { callOrchestrator } = require('../dist/core/orchestrator/CallOrchestrator');
    const { ProviderManager } = require('../dist/providers/ProviderManager');
    const { env } = require('../dist/config/env');
    const seen = [];
    const fake = { initiateCall: async (p) => { seen.push(p); return { callUuid: 'cu', requestUuid: 'ru' }; } };
    const pm = ProviderManager.instance;
    const origGet = pm.getProvider.bind(pm);
    const origUrl = env.PUBLIC_URL;
    pm.getProvider = () => fake;
    env.PUBLIC_URL = 'https://api.example-test.in';
    try {
      const u = await newUser('starter');
      for (const cfg of [{ callSettings: { recordingEnabled: false } }, { isRecordingEnabled: true }, {}]) {
        const agent = await prisma.agent.create({ data: { userId: u, name: 'R', status: 'active', agentConfig: JSON.stringify(cfg) } });
        await callOrchestrator.initiateOutboundCall('+919812345678', agent.id, u, '+918000000001', 600, true).catch(() => {});
      }
      assert.ok(seen.length >= 3, `provider called ${seen.length} times`);
      assert.ok(seen.every((p) => p.record === false), `record flags: ${seen.map((p) => p.record).join(',')}`);
    } finally {
      pm.getProvider = origGet;
      env.PUBLIC_URL = origUrl;
    }
    assert.ok(/record: params\.record === true/.test(src('providers/vobiz/VobizProvider.ts')), 'carrier default is off');
  });

  await test('#79/#90 inbound switch leaves outbound working; inbound-off numbers refuse inbound; unassign stores null', async () => {
    const { InboundCallService } = require('../dist/services/InboundCallService');
    const u = await newUser('starter');
    const agent = await prisma.agent.create({ data: { userId: u, name: 'In', status: 'active' } });
    const num = `+9180${Math.floor(10000000 + Math.random() * 89999999)}`;
    const pn = await prisma.phoneNumber.create({ data: { userId: u, phoneNumber: num, status: 'active', kycStatus: 'verified', countryCode: 'IN', type: 'local', telephonyProvider: 'vobiz', monthlyCost: 0, setupFee: 0, currency: 'INR', assignedAgentId: agent.id } });
    await InboundCallService.updateCallingConfig({ userId: u, phoneNumberId: pn.id, inboundEnabled: false, assignedAgentId: '' });
    const after = await prisma.phoneNumber.findUnique({ where: { id: pn.id } });
    assert.strictEqual(after.status, 'active', 'outbound status untouched');
    assert.strictEqual(after.inboundEnabled, false);
    assert.strictEqual(after.assignedAgentId, null, 'unassigned stores null');
    const res = await InboundCallService.handleInboundCall({ To: num, From: '+919812345678', CallUUID: crypto.randomUUID() });
    assert.strictEqual(res.success, false);
    assert.ok(/switched off/i.test(res.errorMessage || ''), res.errorMessage);
  });

  await test('#79 repair: numbers left "inactive" by the old switch become active with inbound off', async () => {
    const { repairInactiveInboundNumbers } = require('../dist/utils/kycStatus');
    const u = await newUser('starter');
    const pn = await prisma.phoneNumber.create({ data: { userId: u, phoneNumber: `+9170${Math.floor(10000000 + Math.random() * 89999999)}`, status: 'inactive', kycStatus: 'verified', countryCode: 'IN', type: 'local', telephonyProvider: 'vobiz', monthlyCost: 0, setupFee: 0, currency: 'INR' } });
    assert.ok((await repairInactiveInboundNumbers()) >= 1);
    const after = await prisma.phoneNumber.findUnique({ where: { id: pn.id } });
    assert.deepStrictEqual({ status: after.status, inbound: after.inboundEnabled }, { status: 'active', inbound: false });
  });

  console.log(`\nAUDIT BATCH 1: ${passed === total ? 'PASS' : 'FAIL'} — ${passed}/${total} tests passed\n`);
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error in audit batch 1 tests:', err);
  process.exit(1);
});
