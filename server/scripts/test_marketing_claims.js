require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Marketing accuracy (CLAUDE.md §8 launch gate). The public site, SEO pages and llms.txt must not
 * advertise capabilities or prices the product does not have. Each pattern below was a claim the
 * code proved false and was corrected; this test keeps it from coming back.
 *  - Phase 14: transport, retention, DND, HIPAA, SIP/BYO carrier, fictional endpoints…
 *  - Audit #133 #137 #138 (batch 11): no free sandbox (live calls need a plan), no zero-lag/zero-latency,
 *    no SIP claims, no bi-directional CRM sync, no internal model ids, no certification-sounding
 *    Voice AI Index titles; the index article and page titles come from shared JSON files.
 *  - Audit #111-#113, #115, #119: prices are the Billing-page plans only (lib/plans.ts must equal the
 *    server's PLAN_CONFIG); no per-minute/pay-as-you-go/overage/monthly pricing; 7 languages, not 70+.
 * Not checked here (owner / lawyer decisions, see docs/COMPLIANCE_NOTES.md): business-outcome
 * percentages, customer counts, MSME/DPDP statements, and the legal pages (Terms, Privacy).
 * Run: npm run test:marketing-claims   (part of npm run test:security)
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../../Frontend');
const EXCLUDED = new Set(['Terms.tsx', 'Privacy.tsx', 'voiceAiTopics.ts']); // legal text; educational topic titles
const files = [path.join(root, 'scripts/prerender-seo.js'), path.join(root, 'index.html'), path.join(root, 'public/llms.txt')];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx?|jsx?)$/.test(e.name) && !EXCLUDED.has(e.name)) files.push(p);
  }
})(path.join(root, 'src'));

const FALSE_CLAIMS = [
  ['SRTP / zero-copy audio transport (audio runs over a TLS WebSocket)', /\bSRTP\b|zero-copy/i],
  ['zero audio retention (calls can be recorded and are kept until the retention period ends)', /zero[- ]audio[- ]retention|zero-retention|zero-persistence/i],
  ['national DND/NCPR registry checks (not implemented; customers must scrub lists)', /(DNC|NDNC|Do Not Call)\)?\s+regist(er|ry) filters|against National Do Not Call|honors National Do Not Call/i],
  ['10,000+ concurrent calls (plan and platform caps apply)', /10,000\+\s+concurrent/i],
  ['HIPAA compliance (no HIPAA programme or BAA)', /HIPAA[- ](compliant|aligned)/i],
  ['FHIR / HNSW (not implemented)', /\bFHIR\b|\bHNSW\b/],
  ['bring-your-own SIP trunk / Twilio / Exotel (not supported)', /bring your (existing )?(SIP|Twilio)|route your existing SIP|connect existing enterprise SIP/i],
  ['TLS 1.3 everywhere (TLS version depends on each hop; PSTN leg is not ours)', /TLS 1\.3/],
  ['fictional API endpoints on the Solutions page', /\/api\/v2\/(crm|edu|finance|insurance|integrations\/shopify)\//],
  ['unmeasured timings in API samples', /"(execution_ms|latency_ms)"\s*:/],
  ['native bi-directional CRM sync (webhooks and custom tools only)', /Bi-directional sync with Salesforce/i],
  // Pricing: only one-time minute plans are sold.
  ['a ₹3.99/min (or any flat per-minute) price', /₹\s?3\.99|Flat Rate Pricing|Pay-As-You-Go from|rate_per_minute/i],
  ['plan prices that never existed (₹1,799 / 2,999 / 9,999 / 29,999)', /₹\s?(1,799|2,999|9,999|29,999)\b/],
  ['overage rates (no overage billing exists)', /min overage|\/min after\)/i],
  ['plans sold per month (they are one-time packs)', /₹(3,799|10,799|30,799)\s*\/\s*mo|> \/ month<\/span>/],
  // Languages: the editor offers 7 languages + automatic detection.
  ['70+ / 60+ languages or dialects', /\b[67]0\+\s*(regional |Indian |global )?(languages|dialects)/i],
  ['unmeasured latency', /Sub-?180\s?ms/i],
  // Audit batch 11
  ['a free sandbox / free live test calls (the sandbox needs a plan, minutes or the customer\'s own AI key)', /free (interactive )?sandbox|Start Free in Sandbox|Launch Free Sandbox/i],
  ['zero lag / zero latency (not measured, not true)', /zero[- ](human |conversational )?lag|zero-latency/i],
  ['SIP signalling / SIP streaming / SIP schemas (audio runs over a carrier media stream, no SIP)', /encrypted SIP|SIP streaming|SIP telephony schemas/i],
  ['bi-directional CRM integration (webhooks and custom tools only)', /bi-directional CRM/i],
  ['internal model ids on public pages', /gemini_\d|"llm":\s*"gemini/i],
  // SEO / content pass (2026-11-22): claims the code or the owner cannot back up.
  ['invented customer testimonials', /Commodities are hot|RTO dropped from 28%|Replaced 6 manual calling agents|Up 20k since Yesterday/i],
  ['invented author bylines', /Elena Rostova/],
  ['warm transfer / live human handoff (not built: the transfer endpoint answers 501)', /warm (call |SIP |human )?(transfer|escalation)|Live agent transfer|initiates senior human transfer|transferring you directly|live-transfer to/i],
  ['10,000+ / unlimited simultaneous calls (plans allow 5 or 15)', /10,000\+ simultaneous|10K\+|∞/],
  ['unmeasured millisecond figures', /\b\d{1,3} ?ms (Barge|barge|VAD|Speech Interception|first-token)|latency=\d+ms|barge-in latency under|sub-20ms|Sub-3-?s(econd)?\b/i],
  ['unverified outcome percentages and multipliers', /\d{1,3}(\.\d)?% (RTO|No-Show|no-show|Recovery Lift|recovery lift|contact rate|Contact rate|first-call booking|completed verification|promise to pay|first-attempt|Hold Time|On-Time Payment|Win-Back|Renewal Rate|Lift in)|\d(\.\d)?× (Debt|faster|Pipeline|Site Visits|More Site|Trial|FNOL)/],
  ['MSME registration (unverified: re-add only with the Udyam number, owner decision)', /MSME (REGISTERED|Registered|Certified|Certification)|Ministry Registered/],
  ['human-parity / accuracy percentages', /99\.[89]%|Human (Voice )?Parity|Fact-Checked RAG|[Zz]ero [Hh]allucination|100% (accurate|fact|PCI|RBI)/],
  ['RBI-compliant claims (the product supports good practice; compliance is the lender\'s)', /RBI[- ]compliant|RBI Compliant|RBI Audit Compliance/],
  ['native Shopify / Shiprocket / WooCommerce order updates (webhooks only)', /(Shopify|WooCommerce|Shiprocket)[^.\n]{0,30}(tag updates|status automatically|order status|Sync\b)/i],
  ['the agent sending SMS / WhatsApp itself (not a platform feature)', /(sent|send|texted|dispatch(es)?)[^."\n]{0,40}(via|on|to your) (SMS|WhatsApp)|Tracking SMS bhej|WhatsApp par send/i],
  ['white-label offering', /White-Label API|white-label ready/i],
  ['old voice count', /26\+ (HD )?Voice/],
];

/** Every plan figure shown on the site must equal what the server charges and credits. */
function planFactProblems() {
  const { PLAN_CONFIG } = require('../dist/config/plans');
  const libSrc = fs.readFileSync(path.join(root, 'src/app/lib/plans.ts'), 'utf8');
  const re = /key: '(\w+)', name: '(\w+)', price: (\d+), minutes: (\d+), maxConcurrentCalls: (\d+),\s*kbDocuments: (\d+), calendars: (\d+), bookingsPerMonth: (\d+)/g;
  const rows = [...libSrc.matchAll(re)];
  const problems = [];
  if (rows.length !== 3) problems.push(`expected 3 public plans in lib/plans.ts, found ${rows.length}`);
  for (const m of rows) {
    const [, key, name, price, minutes, conc, kb, cals, bookings] = m;
    const sv = PLAN_CONFIG[key];
    if (!sv) { problems.push(`${key}: not a server plan`); continue; }
    const want = { name: sv.name, price: sv.price, minutes: sv.minutes, conc: sv.maxConcurrentCalls, kb: sv.kbLimits.maxDocuments, cals: sv.calendarLimits.maxCalendarsPerWorkspace, bookings: sv.calendarLimits.maxBookingsPerMonth };
    const got = { name, price: +price, minutes: +minutes, conc: +conc, kb: +kb, cals: +cals, bookings: +bookings };
    if (JSON.stringify(want) !== JSON.stringify(got)) problems.push(`${key}: site ${JSON.stringify(got)} vs server ${JSON.stringify(want)}`);
  }
  const llms = fs.readFileSync(path.join(root, 'public/llms.txt'), 'utf8');
  const seo = fs.readFileSync(path.join(root, 'scripts/prerender-seo.js'), 'utf8');
  for (const k of ['startup', 'growth', 'enterprise']) {
    const p = PLAN_CONFIG[k];
    const fact = `${p.name} ₹${p.price.toLocaleString('en-IN')} for ${p.minutes.toLocaleString('en-IN')} minutes`;
    if (!llms.includes(fact)) problems.push(`llms.txt is missing "${fact}"`);
  }
  // The crawler HTML takes its plan figures from lib/plans.ts (checked above) instead of typing them,
  // and refuses to build if it cannot read them; any rupee figure still typed there must be a real price.
  if (!seo.includes("'../src/app/lib/plans.ts'")) problems.push('prerender-seo.js must read the plan facts from lib/plans.ts');
  const prices = new Set(['startup', 'growth', 'enterprise'].map((k) => `₹${PLAN_CONFIG[k].price.toLocaleString('en-IN')}`));
  for (const m of seo.matchAll(/₹\s?[\d,]{3,}/g)) if (!prices.has(m[0].replace(/\s/g, ''))) problems.push(`prerender-seo.js types a price that is not a plan: ${m[0]}`);
  return problems;
}

let failures = 0;
let total = 0;
console.log('\n--- MARKETING CLAIMS ---');
// Voice AI Index topic titles may name a standard, never imply that we hold it (audit #138).
total++;
{
  const topicsSrc = fs.readFileSync(path.join(root, 'src/app/data/voiceAiTopics.ts'), 'utf8');
  const titles = [...topicsSrc.matchAll(/title: "([^"]+)"/g)].map((m) => m[1]);
  const bad = titles.filter((t) => /\b(compliant|certified|audited)\b/i.test(t) && /\b(PCI|HIPAA|SOC ?2|GDPR|ISO ?27001|privacy)\b/i.test(t));
  if (bad.length === 0 && titles.length > 50) console.log('  ✓ Voice AI Index titles do not imply certifications');
  else { failures++; console.error(`  ✗ FAIL: certification-sounding Voice AI Index titles\n    ${bad.join('\n    ')}`); }
}

// Users and crawlers read the same words: the index article and page titles each come from one file.
total++;
{
  const vai = fs.readFileSync(path.join(root, 'src/app/pages/VoiceAIIndex.tsx'), 'utf8');
  const pre = fs.readFileSync(path.join(root, 'scripts/prerender-seo.js'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'src/app/App.tsx'), 'utf8');
  const ok = vai.includes('voiceAiArticle.json') && pre.includes('voiceAiArticle.json') && pre.includes('seoPages.json') && app.includes('seoPages.json');
  if (ok) console.log('  ✓ Voice AI Index article and page titles come from shared files (app + pre-render)');
  else { failures++; console.error('  ✗ FAIL: app and pre-render no longer share voiceAiArticle.json / seoPages.json'); }
}

for (const [label, re] of FALSE_CLAIMS) {
  total++;
  const offenders = files.filter((f) => fs.existsSync(f) && re.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(root, f));
  try {
    assert.deepStrictEqual(offenders, []);
    console.log(`  ✓ no claim: ${label}`);
  } catch {
    failures++;
    console.error(`  ✗ FAIL: ${label}\n    found in: ${offenders.join(', ')}`);
  }
}
total++;
const problems = planFactProblems();
if (problems.length === 0) console.log('  ✓ site plan facts (lib/plans.ts, llms.txt, SEO pricing) equal the server PLAN_CONFIG');
else { failures++; console.error(`  ✗ FAIL: site plan facts differ from the server\n    ${problems.join('\n    ')}`); }

console.log(`\nMARKETING CLAIMS: ${failures === 0 ? 'PASS' : 'FAIL'} — ${total - failures}/${total} tests passed\n`);
process.exit(failures === 0 ? 0 : 1);
