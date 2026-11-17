require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Issue B4 — "Review QA" and industry "Auto-detect" were removed from the product.
 *
 * Checks, on the production code:
 *  - the Review QA endpoint no longer exists; Prompt Coach generate still does
 *  - "auto" (and junk) is never accepted as a new industry value
 *  - agents saved earlier with "auto" keep resolving exactly as before at call time
 *  - the BFSI compliance safety gate still wins over any chosen industry
 * No database is needed.
 *
 * Run: npm run test:agent-rules   (part of npm run test:security)
 */
const assert = require('assert');
const agentsRouter = require('../dist/routes/agents').default;
const { normalizeIndustryInput, resolveEffectiveIndustry, detectIndustry, SELECTABLE_INDUSTRIES } = require('../dist/utils/systemInstructionBuilder');

let total = 0;
let passed = 0;
function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}\n    ${err.message}`);
  }
}

const routes = agentsRouter.stack
  .filter((layer) => layer.route)
  .map((layer) => `${Object.keys(layer.route.methods).join(',').toUpperCase()} ${layer.route.path}`);

console.log('\n--- AGENT INDUSTRY RULES AND REMOVED FEATURES (B4) ---');

test('the Review QA endpoint is gone', () => {
  assert.strictEqual(routes.some((r) => r.includes('/prompt-coach/review')), false, 'POST /prompt-coach/review must not be registered');
});

test('Prompt Coach generate and playbooks are still registered', () => {
  assert.ok(routes.includes('POST /prompt-coach/generate'), 'generate route missing');
  assert.ok(routes.includes('GET /playbooks'), 'playbooks route missing');
});

test('"auto" and unknown values are not accepted as a new industry', () => {
  for (const bad of ['auto', 'AUTO', ' auto ', '', 'banking', 'drop table', null, undefined, 42, {}, []]) {
    assert.strictEqual(normalizeIndustryInput(bad), null, `${JSON.stringify(bad)} must be rejected`);
  }
});

test('every selectable industry is accepted, case- and space-insensitively', () => {
  assert.deepStrictEqual([...SELECTABLE_INDUSTRIES], ['sales', 'support', 'bfsi', 'healthcare', 'real_estate', 'recruitment', 'other']);
  for (const good of SELECTABLE_INDUSTRIES) {
    assert.strictEqual(normalizeIndustryInput(good), good);
    assert.strictEqual(normalizeIndustryInput(`  ${good.toUpperCase()} `), good);
  }
});

test('agents saved earlier with "auto" (or nothing) still resolve from their prompt at call time', () => {
  const clinic = detectIndustry('You book appointments for patients at a dental clinic.', 'Clinic Receptionist', null);
  assert.strictEqual(clinic, 'healthcare');
  assert.strictEqual(resolveEffectiveIndustry('auto', clinic), 'healthcare');
  assert.strictEqual(resolveEffectiveIndustry(null, clinic), 'healthcare');
  assert.strictEqual(resolveEffectiveIndustry(undefined, 'other'), 'other');
});

test('a chosen industry is used as chosen', () => {
  assert.strictEqual(resolveEffectiveIndustry('sales', 'healthcare'), 'sales');
  assert.strictEqual(resolveEffectiveIndustry('other', 'support'), 'other');
});

test('the BFSI compliance safety gate still overrides any chosen industry', () => {
  const loan = detectIndustry('Remind the customer about the overdue EMI on their personal loan.', 'Collections Agent', null);
  assert.strictEqual(loan, 'bfsi');
  assert.strictEqual(resolveEffectiveIndustry('sales', loan), 'bfsi');
  assert.strictEqual(resolveEffectiveIndustry('other', loan), 'bfsi');
  assert.strictEqual(resolveEffectiveIndustry('auto', loan), 'bfsi');
});

console.log(`\nAGENT INDUSTRY RULES: ${passed === total ? 'PASS' : 'FAIL'} — ${passed}/${total} tests passed\n`);
process.exit(passed === total ? 0 : 1);
