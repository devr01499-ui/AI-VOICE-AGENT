require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Marketing accuracy (CLAUDE.md §8 launch gate). The public site, SEO pages and llms.txt must not
 * advertise capabilities or prices the product does not have. Each pattern below was a claim the
 * code proved false and was corrected; this test keeps it from coming back.
 *  - Phase 14: transport, retention, DND, HIPAA, SIP/BYO carrier, fictional endpoints…
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
    if (!seo.includes(fact)) problems.push(`prerender pricing summary is missing "${fact}"`);
  }
  return problems;
}

let failures = 0;
let total = 0;
console.log('\n--- MARKETING CLAIMS ---');
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
