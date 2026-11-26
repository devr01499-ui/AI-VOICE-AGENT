require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Call reports (owner 2026-11-26: "the AI agent is an employee; its reports must be accurate").
 * Production code only; the AI model is replaced through the shared helper's test transport.
 *  A. the report is built from the COMPLETE transcript (last turns saved before it is queued).
 *  B. the analysis engine: verified outcomes, full AI report, JSON + retries, right template.
 */
const assert = require('assert');
const crypto = require('crypto');

let total = 0;
let passed = 0;
async function test(name, fn) {
  total++;
  try { await fn(); passed++; console.log(`  ✓ ${name}`); } catch (err) { console.error(`  ✗ FAIL: ${name}\n    ${err.stack || err.message}`); }
}

async function main() {
  const { prisma } = require('../dist/lib/prisma');
  const { TurnAggregator } = require('../dist/runtime/TurnAggregator');
  const { CallFinalizer, REPORT_SETTLE_SECONDS } = require('../dist/services/CallFinalizer');
  console.log('\n--- CALL REPORTS ---');
  const users = [];
  const newUser = async () => {
    const id = crypto.randomUUID();
    users.push(id);
    await prisma.user.create({ data: { id, email: `cr-${id.slice(0, 8)}@claritiy-test.co.in`, fullName: 'Report Test', passwordHash: 'x', accountType: 'developer' } });
    const agent = await prisma.agent.create({ data: { userId: id, name: 'Lotus Dental Receptionist', status: 'active', systemPrompt: 'You are the receptionist of a dental clinic.' } });
    const general = await prisma.agent.create({ data: { userId: id, name: 'My Assistant', status: 'active', systemPrompt: 'Help callers politely.' } });
    return { id, agentId: agent.id, generalAgentId: general.id };
  };

  try {
    await test('A1 call end waits until the last transcript turns are saved', async () => {
      const saved = [];
      const agg = new TurnAggregator('call-test', Date.now(), 1500, {
        publish: () => {},
        transcriptManager: { addUtterance: async (_c, speaker, text) => { await new Promise((r) => setTimeout(r, 300)); saved.push(`${speaker}:${text}`); } },
      });
      agg.handleFragment('user', 'Please do not call me again', false);
      const done = agg.destroy();
      assert.ok(done && typeof done.then === 'function', 'destroy() returns a promise');
      await done;
      assert.deepStrictEqual(saved, ['user:Please do not call me again'], 'the final caller words are saved before the call is finalized');
    });

    await test(`A2 the report job waits ${REPORT_SETTLE_SECONDS} s after the call ends (carrier webhook can arrive before the stream closes)`, async () => {
      const u = await newUser();
      const call = await prisma.call.create({ data: { userId: u.id, agentId: u.agentId, recipientPhoneNumber: '+919812345678', status: 'completed' } });
      const before = Date.now();
      await CallFinalizer.onCallFinalized(call.id);
      const job = await prisma.analysisJob.findUnique({ where: { callId: call.id } });
      assert.ok(job, 'job queued');
      const waitMs = job.nextRunAt.getTime() - before;
      assert.ok(waitMs >= (REPORT_SETTLE_SECONDS - 2) * 1000, `job runs after the settle time (waits ${waitMs} ms)`);
      assert.ok(REPORT_SETTLE_SECONDS >= 10 && REPORT_SETTLE_SECONDS <= 60);
      await CallFinalizer.onCallFinalized(call.id);
      assert.strictEqual(await prisma.analysisJob.count({ where: { callId: call.id } }), 1, 'still one job (idempotent)');
    });

    // ── B. The analysis engine (production AnalysisService; only the model's network call is faked) ──
    const { AnalysisService, AGENT_TEMPLATE_RULES } = require('../dist/services/AnalysisService');
    const { REPORT_BLUEPRINTS } = require('../dist/config/reportBlueprints');
    const { setTextModelTransportForTests } = require('../dist/services/ai/textModel');
    const { verifyEvidenceGrounding } = require('../dist/utils/evidenceValidator');
    const { ANALYSIS_FAILED_SUMMARY } = require('../dist/workers/AnalysisWorker');
    process.env.GEMINI_API_KEY = 'test-only-platform-key';
    let modelCalls = [];
    let modelReply = null;
    setTextModelTransportForTests({ generate: async (req) => { modelCalls.push(req); return typeof modelReply === 'function' ? modelReply(req) : modelReply; } });

    // A general agent (tpl-0: Resolved / Follow-up Required / Not Interested / Unclear).
    const callWith = async (u, lines, events = []) => {
      const call = await prisma.call.create({ data: { userId: u.id, agentId: u.generalAgentId, recipientPhoneNumber: '+919812345678', status: 'completed', durationSeconds: 95, startTime: new Date(Date.now() - 95000), endReason: 'completed' } });
      for (let i = 0; i < lines.length; i++) {
        await prisma.transcriptSegment.create({ data: { callId: call.id, speaker: lines[i][0], content: lines[i][1], sequenceNumber: i + 1, startTime: i * 5 } });
      }
      for (const [eventType, payload] of events) await prisma.callEvent.create({ data: { callId: call.id, eventType, payload: JSON.stringify(payload) } });
      return call.id;
    };
    const conversation = [
      ['agent', 'Hello, this is Asha from Kesar Naturals. Am I speaking with the customer?'],
      ['user', 'Yes, Ramesh Kumar here.'],
      ['agent', 'Thank you. You asked about your order.'],
      ['user', 'Please connect me to a person, I want to discuss the bulk price.'],
    ];
    const aiReport = (label, extra = {}) => JSON.stringify({
      resultLabel: label, confidence: 0.9, sentiment: 'Positive',
      summary: 'Ramesh Kumar asked about bulk pricing for his order and wanted to speak to a person.',
      fields: { callerName: 'Ramesh Kumar', primaryTopic: 'bulk pricing' },
      evidence: { callerName: { quote: 'Yes Ramesh Kumar here', segmentIndex: 1 }, primaryTopic: { quote: 'discuss the bulk price', segmentIndex: 3 } },
      ...extra,
    });
    const result = (callId) => prisma.callResult.findUnique({ where: { callId } });

    await test('B1 a transfer is recognised from the event the runtime writes (transfer_to_human), and the call still gets a full AI report', async () => {
      const u = await newUser();
      modelReply = aiReport('Follow-up Required');
      const id = await callWith(u, conversation, [['transfer_to_human', { transferId: 't1', destination: 'Sales desk' }]]);
      await AnalysisService.processCall(id);
      const r = await result(id);
      assert.strictEqual(r.resultLabel, 'Transferred', 'verified event decides the label');
      assert.strictEqual(r.confidence, 1);
      assert.ok(/bulk pricing/.test(r.summary), `the AI summary is kept, not a fixed sentence: "${r.summary}"`);
      assert.strictEqual(r.fields.callerName, 'Ramesh Kumar', 'extracted fields are kept');
      assert.strictEqual(r.fields.transferred, true);
    });

    await test('B2 an opt-out is recorded as an event by the runtime and read by the report (the end reason is stored as "completed")', async () => {
      const src = require('fs').readFileSync(require('path').join(__dirname, '../src/core/orchestrator/CallOrchestrator.ts'), 'utf8');
      assert.ok(src.includes("eventType: 'opt_out'"), 'the orchestrator writes an opt_out event');
      const u = await newUser();
      modelReply = aiReport('Not Interested');
      const id = await callWith(u, conversation, [['opt_out', { reason: 'opt_out' }]]);
      await AnalysisService.processCall(id);
      const r = await result(id);
      assert.deepStrictEqual([r.resultLabel, r.fields.optOut, r.confidence], ['Opted Out', true, 1]);
      assert.ok(/Ramesh/.test(r.summary));
    });

    await test('B3 a booking made by the calendar tool gives the booked label AND the conversation details', async () => {
      const u = await newUser();
      modelReply = aiReport('Resolved');
      const id = await callWith(u, conversation, [['tool_call', { toolName: 'schedule_event', success: true, startTime: new Date().toISOString() }]]);
      await AnalysisService.processCall(id);
      const r = await result(id);
      assert.strictEqual(r.fields.bookingConfirmed, true);
      assert.strictEqual(r.fields.callerName, 'Ramesh Kumar');
      assert.strictEqual(r.resultLabel, 'Booked', 'verified booking label (General template has no booking label of its own)');
      assert.ok(typeof r.score === 'number' && r.score >= 0 && r.score <= 100, 'score computed by the template rubric from the captured fields (no longer a fixed 100)');
      assert.ok(/bulk pricing/.test(r.summary));
    });

    await test('B4 an "Unclear" (or off-list) label never throws away the AI summary', async () => {
      const u = await newUser();
      for (const label of ['Unclear', 'Something Invented']) {
        modelReply = aiReport(label);
        const id = await callWith(u, conversation);
        await AnalysisService.processCall(id);
        const r = await result(id);
        assert.ok(/bulk pricing/.test(r.summary), `${label}: summary kept ("${r.summary}")`);
        assert.strictEqual(r.resultLabel, 'Unclear');
        assert.strictEqual(r.status, 'needs_review', 'an unclear outcome is sent for review');
      }
    });

    await test('B5 the model is asked for JSON, with the report model list (fallback included), via the shared helper', async () => {
      const u = await newUser();
      modelCalls = [];
      modelReply = aiReport('Resolved');
      const id = await callWith(u, conversation);
      await AnalysisService.processCall(id);
      assert.ok(modelCalls.length >= 1);
      assert.strictEqual(modelCalls[0].json, true, 'JSON output mode');
      assert.strictEqual(modelCalls[0].temperature, 0);
      const r = await result(id);
      assert.deepStrictEqual([r.resultLabel, r.status], ['Resolved', 'completed']);
      assert.ok(r.model && r.model === modelCalls[0].model, `the model that answered is recorded (${r.model})`);
    });

    await test('B6 an unreadable model answer is retried by the worker, never saved as a garbage report', async () => {
      const u = await newUser();
      modelReply = 'Sure! Here is the report: label is Resolved';
      const id = await callWith(u, conversation);
      let err = null;
      try { await AnalysisService.processCall(id); } catch (e) { err = e; }
      assert.ok(err && /unreadable/i.test(err.message), 'thrown so the worker retries with backoff');
      assert.strictEqual(await result(id), null, 'nothing saved');
    });

    await test('B7 a report that fails for good shows a plain message, never the internal error', async () => {
      assert.ok(!/timed out|gemini|model|stack/i.test(ANALYSIS_FAILED_SUMMARY), ANALYSIS_FAILED_SUMMARY);
      const src = require('fs').readFileSync(require('path').join(__dirname, '../src/workers/AnalysisWorker.ts'), 'utf8');
      assert.ok(!src.includes('summary: err.message'), 'the error text is not used as the summary');
      const routes = require('fs').readFileSync(require('path').join(__dirname, '../src/routes/reports.ts'), 'utf8');
      assert.ok(!routes.includes('lastError: job.lastError,'), 'the report API does not send the raw job error');
    });

    await test('B8 every template is chosen by its own role, and common prompt words do not pick the wrong one', async () => {
      const names = {
        'tpl-15': 'Loan EMI Collections Agent', 'tpl-14': 'Banking KYC Reminder', 'tpl-13': 'Insurance Policy Renewal Desk',
        'tpl-12': 'Recruitment Pre-screening Bot', 'tpl-5': 'Dental Clinic Scheduler', 'tpl-2': 'Medical Clinic Receptionist',
        'tpl-11': 'Car Dealership Test Drive Booking', 'tpl-7': 'Real Estate Inbound Qualifier', 'tpl-10': 'Restaurant Reservation & Takeout',
        'tpl-9': 'E-commerce Order Status & Returns', 'tpl-8': 'SaaS Free Trial Onboarding', 'tpl-6': 'Home Services Booking (AC repair, plumbing)',
        'tpl-4': 'Win-back & Churn Reactivation', 'tpl-3': 'B2B Sales Lead Qualifier', 'tpl-1': 'Front Desk Receptionist', 'tpl-0': 'My Assistant',
      };
      assert.deepStrictEqual(Object.keys(names).sort(), Object.keys(REPORT_BLUEPRINTS).sort(), 'every template is covered');
      for (const [id] of AGENT_TEMPLATE_RULES) assert.ok(REPORT_BLUEPRINTS[id], `${id} exists`);
      for (const [want, name] of Object.entries(names)) {
        const got = AnalysisService.resolveBlueprint({ name, systemPrompt: '' }, []).templateId;
        assert.strictEqual(got, want, `"${name}" -> ${got} (${REPORT_BLUEPRINTS[got].templateName}), expected ${want} (${REPORT_BLUEPRINTS[want].templateName})`);
      }
      const clinic = { name: 'Lotus Dental Receptionist', systemPrompt: 'We are open 24 hr. In order to help, in the event of pain, offer our premium service and review your appointment.' };
      const pricingCall = [{ content: 'What is the pricing for a cleaning?' }, { content: 'Can I schedule a demo?' }];
      assert.strictEqual(AnalysisService.resolveBlueprint(clinic, pricingCall).templateId, 'tpl-5', 'the agent decides, not words spoken in one call');
    });

    await test('B9 evidence ignores punctuation/spacing but still needs the same words (Hindi included)', async () => {
      const segs = [{ speaker: 'user', content: 'Yes, Ramesh Kumar here.' }, { speaker: 'user', content: 'मेरा नाम रमेश है।' }];
      assert.ok(verifyEvidenceGrounding('yes ramesh kumar here', segs).isValid, 'comma/full stop differences');
      assert.ok(verifyEvidenceGrounding('मेरा नाम रमेश', segs).isValid, 'Hindi with vowel signs');
      assert.ok(!verifyEvidenceGrounding('yes suresh kumar here', segs).isValid, 'different words are still rejected');
    });

    setTextModelTransportForTests(null);
  } finally {
    await prisma.analysisJob.deleteMany({ where: { workspaceId: { in: users } } }).catch(() => {});
    await prisma.callResult.deleteMany({ where: { workspaceId: { in: users } } }).catch(() => {});
    await prisma.callEvent.deleteMany({ where: { call: { userId: { in: users } } } }).catch(() => {});
    await prisma.transcriptSegment.deleteMany({ where: { call: { userId: { in: users } } } }).catch(() => {});
    await prisma.call.deleteMany({ where: { userId: { in: users } } }).catch(() => {});
    await prisma.agent.deleteMany({ where: { userId: { in: users } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: users } } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  }
  console.log(`CALL REPORTS: ${passed === total ? 'PASS' : 'FAIL'} — ${passed}/${total} tests passed`);
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
