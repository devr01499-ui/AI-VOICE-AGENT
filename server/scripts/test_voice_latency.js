require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Phase 11 (issue B15): reply latency — what this platform controls, measured.
 *
 *  - Audio work per 20 ms frame (caller audio in, AI audio out with resampling) is benchmarked on
 *    this machine; it must stay a small fraction of the 1 s reply budget.
 *  - Every call's measured reply latency (caller stops speaking -> first agent audio to the carrier)
 *    is summarised (p50/p95/max, turns over 1 s) and saved as a call event at call end, and the
 *    per-turn records are freed (they used to accumulate in memory forever).
 *  - New agents wait 300 ms of silence before answering (was 600 ms, most of the budget).
 *  - No hard-coded Google key literal in the voice provider.
 *
 * NOT measured here (needs live keys + carrier): the model's own time to first audio and network
 * hops. Production numbers come from the saved latency summaries (owner step 19).
 * Run: npm run test:voice-latency   (part of npm run test:security)
 */
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { prisma } = require('../dist/lib/prisma');
const audio = require('../dist/utils/audioConverter');
const { callTimingTracker } = require('../dist/utils/CallTimingTracker');
const { CallOrchestrator } = require('../dist/core/orchestrator/CallOrchestrator');

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
const median = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
const p95 = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length * 0.95)];

async function main() {
  console.log('\n--- VOICE LATENCY (B15) ---');

  await test('audio processing per 20 ms frame is far below the reply budget (benchmark)', async () => {
    // Caller audio: 20 ms of 16 kHz 16-bit mono = 640 bytes (carrier L16 stream).
    const inbound = crypto.randomBytes(640).toString('base64');
    // AI audio: 20 ms of 24 kHz 16-bit mono = 960 bytes.
    const outbound = crypto.randomBytes(960);
    const resampler = new audio.StreamingResampler24to16();
    for (let i = 0; i < 500; i++) { audio.convertInboundAudio(inbound, 'audio/x-l16;rate=16000'); audio.convertOutboundAudioStateful(resampler, outbound); }
    const inTimes = []; const outTimes = [];
    for (let i = 0; i < 3000; i++) {
      let t = process.hrtime.bigint();
      audio.convertInboundAudio(inbound, 'audio/x-l16;rate=16000');
      inTimes.push(Number(process.hrtime.bigint() - t) / 1e6);
      t = process.hrtime.bigint();
      audio.convertOutboundAudioStateful(resampler, outbound);
      outTimes.push(Number(process.hrtime.bigint() - t) / 1e6);
    }
    const report = { inbound_p50_ms: +median(inTimes).toFixed(4), inbound_p95_ms: +p95(inTimes).toFixed(4), outbound_p50_ms: +median(outTimes).toFixed(4), outbound_p95_ms: +p95(outTimes).toFixed(4) };
    console.log('    measured:', JSON.stringify(report));
    // A reply's first audio passes one outbound frame; budget it at < 5 ms (0.5% of 1 s) at p95.
    assert.ok(report.outbound_p95_ms < 5 && report.inbound_p95_ms < 5, JSON.stringify(report));
  });

  await test('each call\'s reply latency is summarised, saved, and freed from memory', async () => {
    const userId = crypto.randomUUID();
    await prisma.user.create({ data: { id: userId, email: `${userId}@example.org`, fullName: 'Latency Test', passwordHash: 'x', accountType: 'starter' } });
    const agent = await prisma.agent.create({ data: { userId, name: 'Fast agent' } });
    const call = await prisma.call.create({ data: { userId, agentId: agent.id, recipientPhoneNumber: '+919812345678', status: 'in_progress' } });
    const replies = [620, 700, 880, 1240];
    replies.forEach((ms, turn) => {
      const rec = callTimingTracker.startTurn(call.id, turn, agent.id, 1000, 'plain');
      rec.user_speech_end = 1000;
      rec.ttft_ms = ms - 150;
      rec.reply_latency_ms = ms;
    });
    assert.strictEqual(callTimingTracker.getTurnRecords(call.id).length, 4);
    CallOrchestrator.instance.recordLatencySummary(call.id);
    assert.strictEqual(callTimingTracker.getTurnRecords(call.id).length, 0, 'turn records must be freed');
    let ev = null;
    for (let i = 0; i < 20 && !ev; i++) {
      ev = await prisma.callEvent.findFirst({ where: { callId: call.id, eventType: 'latency_summary' } });
      if (!ev) await new Promise((r) => setTimeout(r, 50));
    }
    assert.ok(ev, 'summary saved as a call event');
    const s = JSON.parse(ev.payload);
    assert.deepStrictEqual({ turns: s.turns, p50: s.reply_p50_ms, max: s.reply_max_ms, over: s.over_1000ms }, { turns: 4, p50: 880, max: 1240, over: 1 });
  });

  await test('new agents answer after 300 ms of silence (was 600 ms)', async () => {
    const studio = fs.readFileSync(path.join(__dirname, '../../Frontend/src/app/components/agents/SinglePromptStudio.tsx'), 'utf8');
    assert.ok(studio.includes('export const DEFAULT_RESPONSIVENESS_MS = 300;'));
    assert.ok(studio.includes('initialSpeech.responsivenessMs ?? DEFAULT_RESPONSIVENESS_MS'));
    const flow = fs.readFileSync(path.join(__dirname, '../../Frontend/src/app/components/agents/VisualFlowCanvas.tsx'), 'utf8');
    assert.ok(flow.includes("savedSpeech.responsivenessMs : 300)"));
    const { resolveTurnTakingConfig } = require('../dist/providers/gemini/GeminiLiveProvider');
    assert.strictEqual(resolveTurnTakingConfig({ responsivenessMs: 300 }).responsivenessMs, 300);
  });

  await test('no Google API key literal in the server source', async () => {
    const offenders = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.ts$/.test(e.name) && /AIza[0-9A-Za-z_-]{20,}/.test(fs.readFileSync(p, 'utf8'))) offenders.push(path.relative(path.join(__dirname, '..'), p));
      }
    };
    walk(path.join(__dirname, '../src'));
    assert.deepStrictEqual(offenders, []);
  });

  await test('marketing pages make no unmeasured latency or WebRTC claims', async () => {
    const root = path.join(__dirname, '../../Frontend');
    const files = [path.join(root, 'scripts/prerender-seo.js'), path.join(root, 'index.html')];
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(tsx?|jsx?)$/.test(e.name) && !p.includes('flowCompiler')) files.push(p);
      }
    };
    walk(path.join(root, 'src'));
    const claim = /sub-?\d{3}\s?ms|(?:<|&lt;)\s?\d{3}\s?ms|\b1\d{2}\s?ms\b|webrtc|\d{3}\s?milliseconds/i;
    const offenders = files.filter((f) => fs.existsSync(f) && claim.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(root, f));
    assert.deepStrictEqual(offenders, [], 'publish numbers only once measured (owner step 19)');
  });

  console.log(`\nVOICE LATENCY: ${passed === total ? 'PASS' : 'FAIL'} — ${passed}/${total} tests passed\n`);
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error in voice latency tests:', err);
  process.exit(1);
});
