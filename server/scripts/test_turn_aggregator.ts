/**
 * Claritiy Voice - TurnAggregator v2 tests (interleaved caller/agent transcript streams)
 * Run: npx tsx scripts/test_turn_aggregator.ts   (exit 1 on failure)
 */
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test@127.0.0.1:1/test'; // module load only; no query is made
let TurnAggregator: typeof import('../src/runtime/TurnAggregator').TurnAggregator;
let normalizeTranscriptText: typeof import('../src/runtime/TurnAggregator').normalizeTranscriptText;

let total = 0, passed = 0;
function assert(c: boolean, name: string, d?: unknown) {
  total++;
  if (c) { passed++; console.log(`  \x1b[32m✔ PASS\x1b[0m: ${name}`); }
  else console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${name}`, d ?? '');
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function make() {
  const saved: Array<{ speaker: string; text: string; seq?: number }> = [];
  const live: any[] = [];
  const agg = new TurnAggregator('call-1', Date.now(), 150, {
    userGraceMs: 80, userIdleMs: 250, agentIdleMs: 250,
    transcriptManager: { addUtterance: async (_c: string, speaker: any, text: string, _s: number, _e?: number, _cf?: number, seq?: number) => { saved.push({ speaker, text, seq }); } },
    publish: (p) => live.push(p),
  });
  return { agg, saved, live };
}
const ordered = (saved: any[]) => [...saved].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));

(async () => {
  ({ TurnAggregator, normalizeTranscriptText } = await import('../src/runtime/TurnAggregator'));
  console.log('\n=== TURN AGGREGATOR v2 ===\n');

  console.log('--- Normalisation ---');
  assert(normalizeTranscriptText('  hello   there  ') === 'Hello there', 'trims, collapses spaces, capitalises first letter');
  assert(normalizeTranscriptText('So it \'s five lakh per month .') === "So it 's five lakh per month.", 'no space before punctuation');
  assert(normalizeTranscriptText('Thank you.Have a nice day') === 'Thank you. Have a nice day', 'space after sentence end when missing');
  assert(normalizeTranscriptText('It is 5.5 percent') === 'It is 5.5 percent', 'decimals untouched');
  assert(normalizeTranscriptText('U.S.A office') === 'U.S.A office', 'abbreviations untouched');
  assert(normalizeTranscriptText('यू ऑलरेडी टोन मी') === 'यू ऑलरेडी टोन मी', 'non-Latin text untouched');
  assert(normalizeTranscriptText('') === '', 'empty stays empty');

  console.log('\n--- A. Interleaved streams: caller fragments keep arriving after the agent starts ---');
  {
    const { agg, saved } = make();
    agg.handleFragment('user', 'Can you tell', false);
    agg.handleFragment('user', ' me when', false);
    agg.handleFragment('agent', 'How about tomorrow', false);          // agent starts answering
    agg.handleFragment('user', ' you can do it', false);                 // LATE caller fragment
    agg.handleFragment('agent', ' at eleven?', false);
    agg.handleFragment('agent', '', true);                                 // turnComplete
    await sleep(300); await agg.waitForPersistence();
    const o = ordered(saved);
    assert(o.length === 2, 'exactly 2 segments (v1 produced shredded fragments)', o);
    assert(o[0]?.speaker === 'user' && o[0]?.text === 'Can you tell me when you can do it', 'caller sentence is whole, incl. the late fragment', o[0]);
    assert(o[1]?.speaker === 'agent' && o[1]?.text === 'How about tomorrow at eleven?', 'agent sentence is whole', o[1]);
    assert(o[0].seq! < o[1].seq!, 'caller turn precedes agent turn (order by when each started)');
  }

  console.log('\n--- B. A thinking pause inside the caller\'s sentence does not split it ---');
  {
    const { agg, saved } = make();
    agg.handleFragment('user', 'I have five', false);
    await sleep(120);                                                      // pause longer than old 1.5s-equivalent split risk, shorter than userIdle
    agg.handleFragment('user', ' years of experience', false);
    await sleep(400); await agg.waitForPersistence();
    assert(saved.length === 1 && saved[0].text === 'I have five years of experience', 'one whole sentence', saved);
  }

  console.log('\n--- C. Caller barge-in closes only the agent\'s turn ---');
  {
    const { agg, saved } = make();
    agg.handleFragment('agent', 'We have some flexibility so it', false);
    agg.handleFragment('user', 'Tomorrow', false);
    agg.handleInterruption();
    agg.handleFragment('user', ' 10 works', false);
    await sleep(400); await agg.waitForPersistence();
    const o = ordered(saved);
    assert(o.some((x) => x.speaker === 'agent' && x.text === 'We have some flexibility so it'), 'agent turn closed as spoken', o);
    assert(o.some((x) => x.speaker === 'user' && x.text === 'Tomorrow 10 works'), 'caller turn kept whole across the barge-in', o);
  }

  console.log('\n--- D. Caller starts a new sentence right as the agent finishes ---');
  {
    const { agg, saved } = make();
    agg.handleFragment('agent', 'Have a great day', false);
    agg.handleFragment('user', 'wait one', false);                         // caller starts talking again
    agg.handleFragment('agent', '', true);                                 // turnComplete must NOT cut the caller mid-sentence
    agg.handleFragment('user', ' more thing', false);
    await sleep(500); await agg.waitForPersistence();
    const users = saved.filter((x) => x.speaker === 'user');
    assert(users.length === 1 && users[0].text === 'Wait one more thing', 'caller sentence not split by turnComplete', users);
  }

  console.log('\n--- E. Live events carry stable turn ids and end with isFinal ---');
  {
    const { agg, live } = make();
    agg.handleFragment('user', 'Hello', false);
    agg.handleFragment('user', ' there', false);
    agg.flushTurn(true);
    const ids = new Set(live.map((p) => p.turnId));
    assert(ids.size === 1, 'one turnId for the whole turn');
    assert(live[live.length - 1].isFinal === true && live[live.length - 1].text === 'Hello there', 'final event has the full tidy text', live);
  }

  console.log('\n--- F. destroy() flushes everything open ---');
  {
    const { agg, saved } = make();
    agg.handleFragment('user', 'bye', false);
    agg.handleFragment('agent', 'goodbye', false);
    agg.destroy();
    await agg.waitForPersistence();
    assert(saved.length === 2, 'both open turns persisted on destroy', saved);
    agg.handleFragment('user', 'ignored', false);
    await sleep(50);
    assert(saved.length === 2, 'fragments after destroy are ignored');
  }

  console.log(`\n=== ${passed}/${total} PASSED ===`);
  process.exit(passed === total ? 0 : 1);
})();
