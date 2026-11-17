require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Phase 4 (audit A6): the agent's Post-Call Data Extraction fields and summary prompt are used by
 * the live-call analysis (AnalysisService), so they are extracted after every call and shown in
 * Call Reports. Before, live calls never extracted them.
 *
 * Production AnalysisService.resolveBlueprint / withAgentPostCallConfig. No database needed.
 * Run: npm run test:post-call-fields   (part of npm run test:security)
 */
const assert = require('assert');
const { AnalysisService, withAgentPostCallConfig } = require('../dist/services/AnalysisService');
const { REPORT_BLUEPRINTS } = require('../dist/config/reportBlueprints');

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

const agent = {
  name: 'Clinic Receptionist',
  systemPrompt: 'You book appointments at a dental clinic.',
  agentConfig: JSON.stringify({
    postCallAnalysis: {
      summaryPrompt: 'Summarise in Hindi and mention the preferred appointment day.',
      fields: [
        { id: 'f1', name: 'Preferred Day', type: 'enum', description: 'Day the patient prefers', options: ['Monday', 'Tuesday'] },
        { id: 'f2', name: 'insurance_provider', type: 'string', description: 'Insurance company name' },
        { id: 'f3', name: 'is_new_patient', type: 'boolean', description: 'First visit?' },
        { id: 'f4', name: '', type: 'string', description: 'nameless is ignored' },
      ],
    },
  }),
};

console.log('\n--- POST-CALL DATA EXTRACTION (A6) ---');

test('the live-call template includes the agent\'s own fields', () => {
  const bp = AnalysisService.resolveBlueprint(agent, []);
  const names = bp.fields.map((f) => f.name);
  for (const n of ['preferred_day', 'insurance_provider', 'is_new_patient']) assert.ok(names.includes(n), `${n} missing`);
  const day = bp.fields.find((f) => f.name === 'preferred_day');
  assert.strictEqual(day.type, 'enum');
  assert.deepStrictEqual(day.options, ['Monday', 'Tuesday']);
  assert.strictEqual(day.notStatedValue, null);
});

test('the agent\'s summary prompt is carried into the analysis', () => {
  const bp = AnalysisService.resolveBlueprint(agent, []);
  assert.match(bp.summaryInstruction, /preferred appointment day/);
});

test('shared report templates are never modified', () => {
  const before = JSON.stringify(Object.values(REPORT_BLUEPRINTS).map((b) => b.fields.map((f) => f.name)));
  AnalysisService.resolveBlueprint(agent, []);
  AnalysisService.resolveBlueprint(agent, []);
  const after = JSON.stringify(Object.values(REPORT_BLUEPRINTS).map((b) => b.fields.map((f) => f.name)));
  assert.strictEqual(after, before);
});

test('a custom field with the same name as a template field replaces it (no duplicate)', () => {
  const base = REPORT_BLUEPRINTS['tpl-0'];
  const existing = base.fields[0].name;
  const bp = withAgentPostCallConfig(base, { agentConfig: { postCallAnalysis: { fields: [{ name: existing, type: 'number', description: 'mine' }] } } });
  assert.strictEqual(bp.fields.filter((f) => f.name === existing).length, 1);
  assert.strictEqual(bp.fields.find((f) => f.name === existing).description, 'mine');
});

test('agents without post-call settings get the template unchanged; bad JSON is safe', () => {
  const base = REPORT_BLUEPRINTS['tpl-0'];
  assert.deepStrictEqual(withAgentPostCallConfig(base, { agentConfig: '{}' }).fields, base.fields);
  assert.deepStrictEqual(withAgentPostCallConfig(base, { agentConfig: 'not json' }).fields, base.fields);
  assert.strictEqual(withAgentPostCallConfig(base, null).summaryInstruction, undefined);
});

test('limits: at most 25 custom fields, long text trimmed', () => {
  const many = Array.from({ length: 40 }, (_, i) => ({ name: `f_${i}`, type: 'string', description: 'x'.repeat(1000) }));
  const bp = withAgentPostCallConfig(REPORT_BLUEPRINTS['tpl-0'], { agentConfig: { postCallAnalysis: { fields: many, summaryPrompt: 'y'.repeat(5000) } } });
  assert.strictEqual(bp.fields.length - REPORT_BLUEPRINTS['tpl-0'].fields.length, 25);
  assert.ok(bp.fields.every((f) => f.description.length <= 400));
  assert.strictEqual(bp.summaryInstruction.length, 1000);
});

console.log(`\nPOST-CALL FIELDS: ${passed === total ? 'PASS' : 'FAIL'} — ${passed}/${total} tests passed\n`);
process.exit(passed === total ? 0 : 1);
