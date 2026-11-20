require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Phase 4 (audit A9): conversational-flow agents get the instructions the user built.
 *  - The flow builder's saved prompt (global prompt + flow + direction/handbook) is what runs on
 *    live calls, test calls and Test Lab. It used to be thrown away and the bare graph recompiled,
 *    which dropped the global prompt, the handbook and the call direction.
 *  - Old saves that nested a new copy of the prompt on every save collapse to one copy.
 *  - Agents with a graph but no builder-compiled prompt (templates, API) compile with their own
 *    direction and keep their global prompt; the old input hint never reaches a call.
 *  - Extract Variable keys and branch conditions reach the instructions.
 *
 * Production FlowCompiler + buildFinalSystemInstruction; no database or network needed.
 * Run: npm run test:flow-agent   (part of npm run test:security)
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { resolveFlowAgentInstructions, compile, FLOW_PROMPT_HEADER } = require('../dist/core/orchestrator/FlowCompiler');
const { buildFinalSystemInstruction } = require('../dist/utils/systemInstructionBuilder');

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
const count = (text, needle) => text.split(needle).length - 1;

const GLOBAL = 'You work for Lotus Dental Clinic in Pune. Always confirm the patient name.';
const GRAPH = JSON.stringify({
  schemaVersion: 1,
  nodes: [
    { id: 'n1', type: 'conversation', data: { label: 'Welcome', text: 'Namaste, Lotus Dental here.' } },
    { id: 'n2', type: 'logicSplit', data: { label: 'Intent', variable: 'user_intent' } },
    { id: 'n3', type: 'extractVariable', data: { label: 'DOB', variableKey: 'customer_date_of_birth' } },
    { id: 'n4', type: 'ending', data: { label: 'Bye', text: 'Thank you!' } },
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'n2' },
    { id: 'e2', source: 'n2', target: 'n3', label: 'wants to book an appointment' },
    { id: 'e3', source: 'n2', target: 'n4', label: 'only has a billing question' },
  ],
});
// What the flow builder saves: global prompt, its compiled flow, then direction + handbook blocks.
const BUILDER_FLOW = `${FLOW_PROMPT_HEADER}Lotus Bot) for Claritiy Voice operating under a visual multi-step conversational flow graph.\n\n# CONVERSATIONAL EXECUTION INSTRUCTIONS\n## STEP 1: Welcome [Type: Say Message]\n- ACTION: Speak the following message:\n  "Namaste, Lotus Dental here."`;
const TAIL = `\n\n[CALL DIRECTION INSTRUCTION]\nThis is an inbound call — the caller reached out to you.\n\n[AGENT HANDBOOK INSTRUCTIONS]\n- Disclose that you are an AI assistant if asked.`;
const SAVED = `${GLOBAL}\n\n${BUILDER_FLOW}${TAIL}`;

console.log('\n--- FLOW AGENT INSTRUCTIONS (A9) ---');

test('the builder\'s saved prompt runs as is: global prompt, flow, direction and handbook', () => {
  const out = resolveFlowAgentInstructions({ name: 'Lotus Bot', systemPrompt: SAVED, flowGraph: GRAPH, direction: 'inbound' });
  assert.strictEqual(out, SAVED);
});

test('the final instructions for a flow agent keep the global prompt and handbook', () => {
  const agent = { name: 'Lotus Bot', agentType: 'conversational', systemPrompt: SAVED, flowGraph: GRAPH, direction: 'inbound', agentConfig: '{}' };
  const out = buildFinalSystemInstruction(agent, { direction: 'inbound' });
  assert.ok(out.includes(GLOBAL), 'global prompt missing');
  assert.ok(out.includes('[AGENT HANDBOOK INSTRUCTIONS]'), 'handbook missing');
  assert.ok(out.includes('This is an inbound call'), 'direction missing');
  assert.strictEqual(count(out, FLOW_PROMPT_HEADER), 1);
});

test('old saves that nested copies collapse to the user text plus the current flow', () => {
  const OLDER_FLOW = BUILDER_FLOW.replace('Namaste, Lotus Dental here.', 'Hello (old greeting).');
  const nested = `${GLOBAL}\n\n${OLDER_FLOW}\n\n${OLDER_FLOW}\n\n${BUILDER_FLOW}${TAIL}`;
  const out = resolveFlowAgentInstructions({ name: 'Lotus Bot', systemPrompt: nested, flowGraph: GRAPH });
  assert.strictEqual(count(out, FLOW_PROMPT_HEADER), 1);
  assert.strictEqual(count(out, GLOBAL), 1);
  assert.ok(out.includes('Namaste, Lotus Dental here.'));
  assert.ok(!out.includes('old greeting'));
});

test('template/API flow agents compile with their own direction and keep their global prompt', () => {
  const out = resolveFlowAgentInstructions({ name: 'Lotus Bot', systemPrompt: GLOBAL, flowGraph: GRAPH, direction: 'inbound' });
  assert.ok(out.startsWith(GLOBAL));
  assert.ok(out.includes('CALL DIRECTION RULES (INBOUND)'), 'direction ignored');
  assert.ok(!out.includes('(OUTBOUND)'));
});

test('saved flow settings are used: global prompt and flexibility', () => {
  const out = resolveFlowAgentInstructions({
    name: 'Lotus Bot', systemPrompt: '', flowGraph: GRAPH, direction: 'outbound',
    agentConfig: JSON.stringify({ flowSettings: { globalPrompt: 'Speak Marathi first.', flexibilityMode: 'flex' } }),
  });
  assert.ok(out.startsWith('Speak Marathi first.'));
  assert.ok(/flexible guide/i.test(out), 'flex mode ignored');
});

test('the old input hint never reaches a call', () => {
  const hint = 'Enter your global prompt here. Type {{ to add dynamic variables.';
  const out = resolveFlowAgentInstructions({ name: 'X', systemPrompt: `${hint}\n\n${BUILDER_FLOW}`, flowGraph: GRAPH });
  assert.ok(!out.includes(hint));
  const out2 = resolveFlowAgentInstructions({ name: 'X', systemPrompt: hint, flowGraph: GRAPH });
  assert.ok(!out2.includes(hint));
});

test('Extract Variable keys and branch conditions reach the instructions', () => {
  const out = compile(GRAPH, 'Lotus Bot', 'rigid', 'outbound');
  assert.ok(out.includes("'customer_date_of_birth'"), 'variableKey ignored');
  assert.ok(out.includes('"wants to book an appointment"'));
  assert.ok(out.includes('"only has a billing question"'));
});

test('live calls and test calls use the same resolver', () => {
  // Live calls: the Gemini provider builds the instruction with buildFinalSystemInstruction, which
  // compiles flow agents with the same resolver. (CallOrchestrator used to compute a copy that was
  // never used; it was removed in dead-code sweep 3, audit #142.)
  const builder = fs.readFileSync(path.join(__dirname, '../src/utils/systemInstructionBuilder.ts'), 'utf8');
  const provider = fs.readFileSync(path.join(__dirname, '../src/providers/gemini/GeminiLiveProvider.ts'), 'utf8');
  const sandbox = fs.readFileSync(path.join(__dirname, '../src/websockets/SandboxStreamHandler.ts'), 'utf8');
  assert.ok(builder.includes('FlowCompiler.resolveFlowAgentInstructions(') && provider.includes('buildFinalSystemInstruction('), 'live call');
  assert.ok(sandbox.includes('FlowCompiler.resolveFlowAgentInstructions(agent)'), 'test call');
});

console.log(`\nFLOW AGENT: ${passed === total ? 'PASS' : 'FAIL'} — ${passed}/${total} tests passed\n`);
process.exit(passed === total ? 0 : 1);
