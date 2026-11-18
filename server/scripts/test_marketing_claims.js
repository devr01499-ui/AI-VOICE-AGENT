require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Phase 14 (CLAUDE.md §8 launch gate: "marketing claims accurate"): the public site and SEO pages
 * must not advertise capabilities the product does not have. Each pattern below was a claim the
 * code proved false and was corrected; this test keeps it from coming back.
 * Not checked here (owner / lawyer decisions, see docs/COMPLIANCE_NOTES.md): business-outcome
 * percentages, customer counts, MSME/DPDP statements, and the legal pages (Terms, Privacy).
 * Run: npm run test:marketing-claims   (part of npm run test:security)
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../../Frontend');
const EXCLUDED = new Set(['Terms.tsx', 'Privacy.tsx', 'voiceAiTopics.ts']); // legal text; educational topic titles
const files = [path.join(root, 'scripts/prerender-seo.js'), path.join(root, 'index.html')];
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
];

let failures = 0;
console.log('\n--- MARKETING CLAIMS (Phase 14) ---');
for (const [label, re] of FALSE_CLAIMS) {
  const offenders = files.filter((f) => fs.existsSync(f) && re.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(root, f));
  try {
    assert.deepStrictEqual(offenders, []);
    console.log(`  ✓ no claim: ${label}`);
  } catch {
    failures++;
    console.error(`  ✗ FAIL: ${label}\n    found in: ${offenders.join(', ')}`);
  }
}
const total = FALSE_CLAIMS.length;
console.log(`\nMARKETING CLAIMS: ${failures === 0 ? 'PASS' : 'FAIL'} — ${total - failures}/${total} tests passed\n`);
process.exit(failures === 0 ? 0 : 1);
