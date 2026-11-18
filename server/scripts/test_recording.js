require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Phase 10 (issue B14, P7): call recording and retention.
 *  - Recording happens at the carrier only when the agent has it on, AFTER a spoken notice.
 *  - The carrier's recording callback is accepted only with this call's signed token and a carrier URL.
 *  - Nobody gets the carrier link: owner-only, 5-minute signed playback links to our own stream,
 *    which passes Range (seeking), never follows redirects, and can force a download.
 *  - Lists/details never return the raw link.
 *  - Retention deletes the recording at the carrier first; failures are kept and alerted.
 *  - The data-retention job is actually started; the broken in-process recorder is gone.
 *
 * Production RecordingService / DataRetentionJob against the local TEST database; carrier HTTP stubbed.
 * Run: npm run test:recording   (part of npm run test:security)
 */
process.env.PLIVO_AUTH_ID = 'MATESTAUTHID';
process.env.PLIVO_AUTH_TOKEN = 'test-token-not-real';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { prisma } = require('../dist/lib/prisma');
const Rec = require('../dist/services/RecordingService');
const { DataRetentionJob } = require('../dist/services/DataRetentionJob');

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
function mockRes() {
  const res = {
    statusCode: 200, headers: {}, chunks: [], ended: false, body: undefined,
    status(c) { this.statusCode = c; return this; },
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    json(b) { this.body = b; this.ended = true; return this; },
    write(c) { this.chunks.push(Buffer.from(c)); return true; },
    once() {}, end() { this.ended = true; },
  };
  return res;
}
const qs = (url) => Object.fromEntries(new URL(url, 'https://x').searchParams);

async function main() {
  console.log('\n--- CALL RECORDING (B14) ---');
  const realFetch = globalThis.fetch;
  const A = crypto.randomUUID();
  const B = crypto.randomUUID();
  for (const id of [A, B]) await prisma.user.create({ data: { id, email: `${id}@example.org`, fullName: 'Rec Test', passwordHash: 'x', accountType: 'starter' } });
  const agent = await prisma.agent.create({ data: { userId: A, name: 'Rec agent' } });
  const mkCall = (data = {}) => prisma.call.create({ data: { userId: A, agentId: agent.id, recipientPhoneNumber: '+919812345678', status: 'completed', durationSeconds: 90, ...data } });

  await test('recording XML: nothing when off; when on, the notice is spoken BEFORE recording starts', async () => {
    assert.strictEqual(Rec.recordingXml('c1', 'https://api.example.org', JSON.stringify({})), '');
    const xml = Rec.recordingXml('c1', 'https://api.example.org', JSON.stringify({ settings: { isRecordingEnabled: true } }));
    assert.ok(xml.indexOf('<Speak>') >= 0 && xml.indexOf('<Speak>') < xml.indexOf('<Record'));
    assert.ok(xml.includes('recordSession="true"') && xml.includes('fileFormat="mp3"'));
    assert.ok(xml.includes(Rec.DEFAULT_RECORDING_NOTICE));
    // A custom notice that does not mention recording cannot replace the disclosure.
    const sneaky = Rec.recordingXml('c1', 'https://api.example.org', { isRecordingEnabled: true, recordingNotice: 'Hello there!' });
    assert.ok(sneaky.includes(Rec.DEFAULT_RECORDING_NOTICE));
    const custom = Rec.recordingXml('c1', 'https://api.example.org', { isRecordingEnabled: true, recordingNotice: 'Yeh call record ki ja rahi hai <b>' });
    assert.ok(custom.includes('Yeh call record ki ja rahi hai &lt;b&gt;'), 'notice is XML-escaped');
    // The agent editor's own keys (callSettings) switch recording on.
    assert.ok(Rec.recordingXml('c1', 'https://api.example.org', JSON.stringify({ callSettings: { recordingEnabled: true } })).includes('<Record'));
    assert.strictEqual(Rec.recordingXml('c1', 'https://api.example.org', JSON.stringify({ callSettings: { recordingEnabled: false } })), '');
  });

  await test('both answer handlers put the recording XML before the audio stream', async () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/controllers/CallController.ts'), 'utf8');
    const placements = src.match(/<Response>\r?\n\$\{recXml\}  <Stream/g) || [];
    assert.strictEqual(placements.length, 2);
  });

  await test('recording callback: signed token required, expiry enforced, carrier URLs only', async () => {
    const call = await mkCall();
    const xml = Rec.recordingXml(call.id, 'https://api.example.org', { isRecordingEnabled: true });
    const cb = xml.match(/callbackUrl="([^"]+)"/)[1].replace(/&amp;/g, '&');
    const q = qs(cb);
    let res = mockRes();
    await Rec.handleRecordingCallback({ query: { ...q, s: 'f'.repeat(64) }, body: { RecordUrl: 'https://media.plivo.com/r/abc.mp3' } }, res);
    assert.strictEqual(res.statusCode, 403);
    res = mockRes();
    await Rec.handleRecordingCallback({ query: q, body: { RecordUrl: 'http://169.254.169.254/latest' } }, res);
    assert.strictEqual((await prisma.call.findUnique({ where: { id: call.id } })).recordingUrl, null, 'non-carrier URL ignored');
    res = mockRes();
    await Rec.handleRecordingCallback({ query: q, body: { RecordUrl: 'https://media.plivo.com/v1/Account/MA/Recording/3a2f1b7c-1111-2222-3333-444455556666.mp3' } }, res);
    assert.strictEqual(res.statusCode, 200);
    assert.ok((await prisma.call.findUnique({ where: { id: call.id } })).recordingUrl.includes('media.plivo.com'));
    const expiredXml = Rec.recordingXml(call.id, 'https://api.example.org', { isRecordingEnabled: true }, Date.now() - 4 * 60 * 60 * 1000);
    const eq = qs(expiredXml.match(/callbackUrl="([^"]+)"/)[1].replace(/&amp;/g, '&'));
    res = mockRes();
    await Rec.handleRecordingCallback({ query: eq, body: { RecordUrl: 'https://media.plivo.com/x.mp3' } }, res);
    assert.strictEqual(res.statusCode, 410);
  });

  const recUrl = 'https://media.plivo.com/v1/Account/MA/Recording/7b2f1b7c-1111-2222-3333-444455556666.mp3';
  const recCall = await mkCall({ recordingUrl: recUrl });

  await test('playback link: owner only, expires in 5 minutes, carrier link never included', async () => {
    assert.strictEqual(await Rec.createPlaybackLink(B, recCall.id), null, 'another account gets nothing');
    const link = await Rec.createPlaybackLink(A, recCall.id);
    assert.ok(link.url.startsWith(`/api/v2/recordings/${recCall.id}/stream?`));
    assert.ok(!link.url.includes('plivo') && !link.downloadUrl.includes('plivo'));
    const ms = new Date(link.expiresAt).getTime() - Date.now();
    assert.ok(ms > 4 * 60 * 1000 && ms <= 5 * 60 * 1000);
    const legacy = await mkCall({ recordingUrl: `${A}/legacy.pcm` });
    assert.strictEqual(await Rec.createPlaybackLink(A, legacy.id), null, 'old unplayable .pcm uploads are not offered');
  });

  await test('stream: valid link streams with Range (seek), no redirects; tampered or expired links refused', async () => {
    const link = await Rec.createPlaybackLink(A, recCall.id);
    const q = qs(link.downloadUrl);
    const seen = [];
    globalThis.fetch = async (url, init) => {
      seen.push({ url, init });
      return new Response(Buffer.from('ID3fakeaudio'), { status: 206, headers: { 'content-type': 'audio/mpeg', 'content-range': 'bytes 0-11/5000', 'content-length': '12' } });
    };
    let res = mockRes();
    try {
      await Rec.streamRecording({ params: { callId: recCall.id }, query: q, headers: { range: 'bytes=0-11' } }, res);
    } finally { globalThis.fetch = realFetch; }
    assert.strictEqual(res.statusCode, 206);
    assert.strictEqual(seen[0].url, recUrl);
    assert.strictEqual(seen[0].init.redirect, 'manual');
    assert.strictEqual(seen[0].init.headers.Range, 'bytes=0-11');
    assert.strictEqual(res.headers['content-range'], 'bytes 0-11/5000');
    assert.strictEqual(res.headers['cache-control'], 'private, no-store');
    assert.ok(/attachment/.test(res.headers['content-disposition']));
    assert.strictEqual(Buffer.concat(res.chunks).toString(), 'ID3fakeaudio');

    res = mockRes();
    await Rec.streamRecording({ params: { callId: recCall.id }, query: { ...q, u: B }, headers: {} }, res);
    assert.strictEqual(res.statusCode, 403, 'a link cannot be re-used for another account');
    res = mockRes();
    await Rec.streamRecording({ params: { callId: recCall.id }, query: { ...q, e: String(Number(q.e) + 60000) }, headers: {} }, res);
    assert.strictEqual(res.statusCode, 403, 'expiry cannot be extended');
    const old = await Rec.createPlaybackLink(A, recCall.id, Date.now() - 10 * 60 * 1000);
    res = mockRes();
    await Rec.streamRecording({ params: { callId: recCall.id }, query: qs(old.url), headers: {} }, res);
    assert.strictEqual(res.statusCode, 410);
  });

  await test('lists and call details never return the carrier link', async () => {
    for (const f of ['src/routes/calls.ts', 'src/routes/reports.ts', 'src/services/CallService.ts']) {
      const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
      assert.ok(!/recordingUrl:\s*(recUrl|r\.call\?\.recordingUrl|result\.call\?\.recordingUrl|signedUrl)/.test(src), `${f} still returns the raw link`);
      assert.ok(!src.includes("createSignedUrl"), `${f} still signs storage paths`);
    }
  });

  await test('retention deletes the recording at the carrier first; failures are kept for retry', async () => {
    const old = new Date(Date.now() - 200 * 86400 * 1000);
    const ok = await mkCall({ recordingUrl: 'https://media.plivo.com/v1/Account/MA/Recording/aaaabbbb-1111-2222-3333-444455556666.mp3', createdAt: old });
    const bad = await mkCall({ recordingUrl: 'https://media.plivo.com/v1/Account/MA/Recording/ccccdddd-1111-2222-3333-444455556666.mp3', createdAt: old });
    const deletes = [];
    globalThis.fetch = async (url, init) => {
      deletes.push({ url: String(url), method: init.method });
      return new Response(null, { status: String(url).includes('ccccdddd') ? 500 : 204 });
    };
    try { await DataRetentionJob.purgeExpiredRecordings(); } finally { globalThis.fetch = realFetch; }
    assert.ok(deletes.some((d) => d.method === 'DELETE' && d.url.includes('/Recording/aaaabbbb-1111-2222-3333-444455556666/')));
    assert.strictEqual((await prisma.call.findUnique({ where: { id: ok.id } })).recordingUrl, null);
    assert.ok((await prisma.call.findUnique({ where: { id: bad.id } })).recordingUrl, 'kept when the carrier did not confirm');
  });

  await test('the retention job is started at boot and the in-process recorder is gone', async () => {
    const index = fs.readFileSync(path.join(__dirname, '../src/index.ts'), 'utf8');
    assert.ok(index.includes('DataRetentionJob.startBackgroundWorker()'));
    const runner = fs.readFileSync(path.join(__dirname, '../src/core/pipeline/PipecatRunner.ts'), 'utf8');
    assert.ok(!runner.includes('audioChunks') && !runner.includes("from('call-recordings')"));
  });

  console.log(`\nRECORDING: ${passed === total ? 'PASS' : 'FAIL'} — ${passed}/${total} tests passed\n`);
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error in recording tests:', err);
  process.exit(1);
});
