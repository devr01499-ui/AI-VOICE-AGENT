/**
 * Claritiy Voice — end-of-call integration test (real DB, fake Plivo API).
 *
 * Proves: carrier hangup is sent to the right account/uuid for outbound AND inbound calls, retried,
 * idempotent, honest about failure; a call that ended normally is recorded as completed (not failed);
 * a late stream_closed never overwrites the real outcome; the farewell watchdog hangs up only after a
 * real goodbye + silence; Live Monitoring counts only calls that are really live.
 *
 * Requires DATABASE_URL pointing at a disposable database. Run: npx tsx scripts/test_call_end_and_hangup.ts
 */
import http from 'http';
import assert from 'assert';

process.env.PLIVO_AUTH_ID = 'MAPARENTTESTAUTH00000';
process.env.PLIVO_AUTH_TOKEN = 'parent-token';
process.env.PLIVO_API_BASE = 'http://127.0.0.1:3911/v1';
process.env.FAREWELL_HANGUP_SILENCE_MS = '2000';

type Hit = { method: string; path: string; auth: string };
const hits: Hit[] = [];
const script = new Map<string, number[]>(); // uuid -> queue of status codes
const server = http.createServer((req, res) => {
  const uuid = (req.url || '').split('/').filter(Boolean).pop() || '';
  hits.push({ method: req.method || '', path: req.url || '', auth: String(req.headers.authorization || '') });
  const q = script.get(uuid);
  const code = q && q.length ? (q.length > 1 ? q.shift()! : q[0]) : 204;
  res.writeHead(code); res.end();
});

let passed = 0; let failed = 0;
async function t(name: string, fn: () => Promise<void>) {
  try { await fn(); passed++; console.log(`  \x1b[32m✔\x1b[0m ${name}`); }
  catch (e: any) { failed++; console.log(`  \x1b[31m✖ ${name}\x1b[0m\n      ${e?.message || e}`); }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const uuidHits = (u: string) => hits.filter((h) => h.path.includes(u));

async function main() {
  await new Promise<void>((r) => server.listen(3911, '127.0.0.1', r));
  const { prisma } = await import('../src/lib/prisma');
  const { hangupCarrierLeg, _resetCarrierHangupStateForTests } = await import('../src/core/telephony/carrierHangup');
  const { callOrchestrator, CallOrchestrator } = await import('../src/core/orchestrator/CallOrchestrator');
  const { CallService } = await import('../src/services/CallService');
  const { getLiveCalls, countActiveCalls } = await import('../src/utils/concurrency');
  const { eventBus, PROVIDER_EVENTS } = await import('../src/core/provider-sdk/provider.events');

  const base: any = await prisma.call.findFirst();
  assert(base, 'test DB needs at least one call row to clone');
  const userId = base.userId;
  const tag = Date.now().toString(36);
  const OUR = `91806${tag.replace(/\D/g, '').padEnd(7, '1').slice(0, 7)}`;   // our DID (plivo)
  const CALLER = `91999${tag.replace(/\D/g, '').padEnd(7, '2').slice(0, 7)}`; // a caller whose number is ALSO in inventory as vobiz (adversarial)
  const created: string[] = [];

  async function mkCall(over: any = {}) {
    const id = `t-${tag}-${created.length}-${Math.random().toString(36).slice(2, 6)}`;
    const { id: _i, billedMinutes: _b, ...rest } = base;
    await prisma.call.create({
      data: {
        ...rest, id, userId, status: 'in_progress', startTime: new Date(Date.now() - 20000), endTime: null,
        endReason: null, endedBy: null, endDetail: null, durationSeconds: null, telemetryId: `uuid-${id}`.slice(0, 40), createdAt: new Date(), ...over,
      },
    });
    created.push(id);
    return id;
  }
  const row = (id: string) => prisma.call.findUnique({ where: { id } }) as Promise<any>;

  await prisma.phoneNumber.create({ data: { id: `pn-our-${tag}`, phoneNumber: OUR, userId, telephonyProvider: 'plivo', plivoSubAuthId: 'DIRECT_PARENT_ACCOUNT', countryCode: 'IN' } as any }).catch(() => {});
  await prisma.phoneNumber.create({ data: { id: `pn-caller-${tag}`, phoneNumber: CALLER, userId, telephonyProvider: 'vobiz', countryCode: 'IN' } as any }).catch(() => {});

  console.log('\nCarrier hangup');
  await t('outbound call: DELETE sent to Plivo with the call uuid', async () => {
    _resetCarrierHangupStateForTests();
    const id = await mkCall({ callDirection: 'outbound', fromPhoneNumber: OUR, recipientPhoneNumber: CALLER });
    const r = await hangupCarrierLeg(id, { reason: 'test' });
    assert.strictEqual(r, 'hung_up');
    const h = uuidHits((await row(id)).telemetryId);
    assert.strictEqual(h.length, 1); assert.strictEqual(h[0].method, 'DELETE');
    assert(h[0].path.includes('/Account/MAPARENTTESTAUTH00000/Call/'), h[0].path);
  });
  await t('INBOUND call resolves OUR number (recipient), not the caller (whose number is a different carrier)', async () => {
    _resetCarrierHangupStateForTests();
    const id = await mkCall({ callDirection: 'inbound', fromPhoneNumber: CALLER, recipientPhoneNumber: OUR });
    const before = hits.length;
    const r = await hangupCarrierLeg(id);
    assert.strictEqual(r, 'hung_up');
    assert(hits.length > before, 'Plivo must receive the hangup (old code looked up the caller and used Vobiz)');
  });
  await t('hangup is idempotent: 2 concurrent + 1 later call = exactly 1 DELETE', async () => {
    _resetCarrierHangupStateForTests();
    const id = await mkCall({ callDirection: 'outbound', fromPhoneNumber: OUR, recipientPhoneNumber: CALLER });
    const u = (await row(id)).telemetryId;
    await Promise.all([hangupCarrierLeg(id), hangupCarrierLeg(id)]);
    await hangupCarrierLeg(id);
    assert.strictEqual(uuidHits(u).length, 1);
  });
  await t('404 from Plivo (call already over) = already_ended, not a failure', async () => {
    _resetCarrierHangupStateForTests();
    const id = await mkCall({ callDirection: 'outbound', fromPhoneNumber: OUR, recipientPhoneNumber: CALLER });
    script.set((await row(id)).telemetryId, [404]);
    assert.strictEqual(await hangupCarrierLeg(id), 'already_ended');
  });
  await t('transient 500, 500 then 204 -> retried and hung_up (3 attempts)', async () => {
    _resetCarrierHangupStateForTests();
    const id = await mkCall({ callDirection: 'outbound', fromPhoneNumber: OUR, recipientPhoneNumber: CALLER });
    const u = (await row(id)).telemetryId; script.set(u, [500, 500, 204]);
    assert.strictEqual(await hangupCarrierLeg(id), 'hung_up');
    assert(uuidHits(u).length >= 3);
  });
  await t('persistent 500 -> reported as failed (never silently "ok")', async () => {
    _resetCarrierHangupStateForTests();
    const id = await mkCall({ callDirection: 'outbound', fromPhoneNumber: OUR, recipientPhoneNumber: CALLER });
    script.set((await row(id)).telemetryId, [500]);
    assert.strictEqual(await hangupCarrierLeg(id), 'failed');
  });
  await t('missing carrier uuid -> no request is sent (never a bulk hangup)', async () => {
    _resetCarrierHangupStateForTests();
    const id = await mkCall({ telemetryId: null, callDirection: 'outbound', fromPhoneNumber: OUR, recipientPhoneNumber: CALLER });
    const before = hits.length;
    assert.strictEqual(await hangupCarrierLeg(id), 'no_carrier_uuid');
    assert.strictEqual(hits.length, before);
  });

  console.log('\nEnd-of-call status');
  await t('caller hangs up mid-conversation (stream_closed) -> completed / caller_hangup, not failed', async () => {
    _resetCarrierHangupStateForTests();
    const id = await mkCall({ callDirection: 'inbound', fromPhoneNumber: CALLER, recipientPhoneNumber: OUR });
    await callOrchestrator.endCallSession(id, 'stream_closed', 'carrier stream stopped');
    const r = await row(id);
    assert.strictEqual(r.status, 'completed'); assert.strictEqual(r.endReason, 'caller_hangup'); assert.strictEqual(r.endedBy, 'caller');
  });
  await t('abnormal socket close (code 1006) is still recorded as a failure', async () => {
    const id = await mkCall({ callDirection: 'inbound', fromPhoneNumber: CALLER, recipientPhoneNumber: OUR });
    await callOrchestrator.endCallSession(id, 'ws_closed', 'ws close code=1006');
    assert.strictEqual((await row(id)).status, 'failed');
  });
  await t('stream ends within 2s of start (never really answered) is not called a completed conversation', async () => {
    const id = await mkCall({ startTime: new Date(), callDirection: 'inbound', fromPhoneNumber: CALLER, recipientPhoneNumber: OUR });
    await callOrchestrator.endCallSession(id, 'stream_closed', 'x');
    assert.notStrictEqual((await row(id)).endReason, 'caller_hangup');
  });
  await t('agent hangup then late stream_closed: outcome is NOT overwritten', async () => {
    _resetCarrierHangupStateForTests();
    const id = await mkCall({ callDirection: 'outbound', fromPhoneNumber: OUR, recipientPhoneNumber: CALLER });
    await callOrchestrator.endCallSession(id, 'agent_hangup', 'AI said goodbye');
    const a = await row(id);
    await callOrchestrator.endCallSession(id, 'stream_closed', 'carrier stream stopped');
    const b = await row(id);
    assert.strictEqual(a.status, 'completed'); assert.strictEqual(b.status, 'completed');
    assert.strictEqual(b.endReason, 'agent_hangup'); assert.strictEqual(String(b.endTime), String(a.endTime));
  });
  await t('5 simultaneous end events -> one finalisation, one carrier hangup', async () => {
    _resetCarrierHangupStateForTests();
    const id = await mkCall({ callDirection: 'outbound', fromPhoneNumber: OUR, recipientPhoneNumber: CALLER });
    const u = (await row(id)).telemetryId;
    await Promise.all(['stream_closed', 'agent_hangup', 'ws_closed', 'end_call', 'stream_stopped'].map((r) => callOrchestrator.endCallSession(id, r, 'race')));
    assert.strictEqual((await row(id)).status, 'completed');
    assert.strictEqual(uuidHits(u).length, 1);
  });
  await t('supervisor "End call" (CallService.terminateCall) -> completed/user_terminated + phone hung up', async () => {
    _resetCarrierHangupStateForTests();
    const id = await mkCall({ callDirection: 'outbound', fromPhoneNumber: OUR, recipientPhoneNumber: CALLER });
    const u = (await row(id)).telemetryId;
    await CallService.terminateCall(id, 'user_terminated', 'Ended by supervisor', 'user');
    const r = await row(id);
    assert.strictEqual(r.status, 'completed'); assert.strictEqual(r.endReason, 'user_terminated'); assert.strictEqual(r.endedBy, 'user');
    assert.strictEqual(uuidHits(u).length, 1);
  });
  await t('terminate on an already-finished call still hangs up a stuck phone leg', async () => {
    _resetCarrierHangupStateForTests();
    const id = await mkCall({ status: 'failed', callDirection: 'outbound', fromPhoneNumber: OUR, recipientPhoneNumber: CALLER });
    const u = (await row(id)).telemetryId;
    await CallService.terminateCall(id, 'user_terminated');
    assert.strictEqual(uuidHits(u).length, 1);
    assert.strictEqual((await row(id)).status, 'failed'); // history not rewritten
  });
  await t('agent end_call path (endCallGracefully) -> completed/end_call + phone hung up', async () => {
    _resetCarrierHangupStateForTests();
    const id = await mkCall({ callDirection: 'inbound', fromPhoneNumber: CALLER, recipientPhoneNumber: OUR });
    const u = (await row(id)).telemetryId;
    await callOrchestrator.endCallGracefully(id, 'end_call', 'AI tool');
    assert.strictEqual((await row(id)).status, 'completed');
    assert.strictEqual(uuidHits(u).length, 1);
  });

  console.log('\nFarewell detection');
  await t('detects real goodbyes, ignores mid-turn mentions', async () => {
    const yes = ['Thanks for your time, have a great day!', 'Okay, bye bye.', 'Alright, take care.', 'Perfect. Thank you for your time.', 'Goodbye!'];
    const no = ['Thank you for your time, so before we go, can I confirm your email address?', 'Have a great day ahead is what many say, but first tell me your budget.', 'I will take care of the booking, which slot works for you?', 'Thank you. What is your experience?'];
    yes.forEach((s) => assert(CallOrchestrator.isFarewell(s), `should detect: ${s}`));
    no.forEach((s) => assert(!CallOrchestrator.isFarewell(s), `should NOT detect: ${s}`));
  });
  const emit = (callId: string, speaker: string, text: string, isFinal = true) =>
    eventBus.publish(PROVIDER_EVENTS.TRANSCRIPT_UPDATED, { callId, turnId: 'x', seq: 1, speaker, text, isFinal });
  await t('watchdog: goodbye + caller silence -> auto hangup (agent_hangup)', async () => {
    _resetCarrierHangupStateForTests();
    const id = await mkCall({ callDirection: 'outbound', fromPhoneNumber: OUR, recipientPhoneNumber: CALLER });
    (callOrchestrator as any).armFarewellWatchdog(id);
    emit(id, 'agent', 'Thanks so much for your time, have a great day!');
    await sleep(1200); assert.strictEqual((await row(id)).status, 'in_progress', 'must not hang up before the silence window');
    await sleep(2600);
    const r = await row(id);
    assert.strictEqual(r.status, 'completed'); assert.strictEqual(r.endReason, 'agent_hangup');
  });
  await t('watchdog: caller speaks after the goodbye -> call stays up', async () => {
    const id = await mkCall({ callDirection: 'outbound', fromPhoneNumber: OUR, recipientPhoneNumber: CALLER });
    (callOrchestrator as any).armFarewellWatchdog(id);
    emit(id, 'agent', 'Okay, take care.');
    await sleep(800); emit(id, 'user', 'Wait, one more question', false);
    await sleep(3200);
    assert.strictEqual((await row(id)).status, 'in_progress');
    (callOrchestrator as any).disposeFarewellWatchdog(id);
  });
  await t('watchdog: agent keeps talking after goodbye -> call stays up', async () => {
    const id = await mkCall({ callDirection: 'outbound', fromPhoneNumber: OUR, recipientPhoneNumber: CALLER });
    (callOrchestrator as any).armFarewellWatchdog(id);
    emit(id, 'agent', 'Alright, goodbye.');
    await sleep(700); eventBus.publish(PROVIDER_EVENTS.AI_STARTED_SPEAKING, { callId: id });
    await sleep(3200);
    assert.strictEqual((await row(id)).status, 'in_progress');
    (callOrchestrator as any).disposeFarewellWatchdog(id);
  });
  await t('watchdog: ordinary agent turn without goodbye never ends the call', async () => {
    const id = await mkCall({ callDirection: 'outbound', fromPhoneNumber: OUR, recipientPhoneNumber: CALLER });
    (callOrchestrator as any).armFarewellWatchdog(id);
    emit(id, 'agent', 'Could you tell me about your experience?');
    await sleep(3000);
    assert.strictEqual((await row(id)).status, 'in_progress');
    (callOrchestrator as any).disposeFarewellWatchdog(id);
  });

  console.log('\nLive Monitoring / concurrency');
  await t('only genuinely live calls are listed ("2.4 sessions" leftovers excluded)', async () => {
    const live = await mkCall({ status: 'in_progress', createdAt: new Date(Date.now() - 60_000) });
    const ringing = await mkCall({ status: 'ringing', createdAt: new Date(Date.now() - 20_000) });
    const staleAnswered = await mkCall({ status: 'in_progress', createdAt: new Date(Date.now() - 40 * 60_000) });
    const staleRinging = await mkCall({ status: 'queued', createdAt: new Date(Date.now() - 10 * 60_000) });
    const done = await mkCall({ status: 'completed', createdAt: new Date(Date.now() - 30_000) });
    const ids = (await getLiveCalls(userId)).map((c: any) => c.id);
    assert(ids.includes(live) && ids.includes(ringing), 'live + ringing must be listed');
    assert(!ids.includes(staleAnswered) && !ids.includes(staleRinging) && !ids.includes(done), 'leftovers/finished must not be listed');
    const n = await countActiveCalls(userId);
    assert(n >= 2, `concurrency count should include the live ones (got ${n})`);
    for (const id of [staleAnswered, staleRinging]) await prisma.call.update({ where: { id }, data: { status: 'timeout' } });
  });

  // cleanup
  await prisma.call.deleteMany({ where: { id: { in: created } } }).catch(() => {});
  await prisma.phoneNumber.deleteMany({ where: { phoneNumber: { in: [OUR, CALLER] } } }).catch(() => {});
  server.close();
  console.log(`\n${passed}/${passed + failed} passed`);
  await prisma.$disconnect().catch(() => {});
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
