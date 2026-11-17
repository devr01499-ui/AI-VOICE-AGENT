require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Phase 4 (audit A2–A5): agent Functions on live calls.
 *  - Custom API functions and flow function nodes become EXECUTABLE http tools (they used to be
 *    declared to the model without a URL, so every call to them failed).
 *  - Built-in / invalid / duplicate names are skipped instead of aborting the call.
 *  - Tools are per call (the registry used to be shared by all concurrent calls).
 *  - HTTP tools: timeout, no redirects, GET params in the query string, custom headers, SSRF guard.
 *  - A call whose agent cannot be loaded is refused (it used to run as a hard-coded account).
 *
 * Production code throughout. Outbound HTTP is stubbed by replacing global fetch (no network).
 * Run: npm run test:agent-tools   (part of npm run test:security)
 */
const assert = require('assert');
const crypto = require('crypto');
const { buildAgentTools, toolNameProblem, parseToolHeaders, RESERVED_TOOL_NAMES } = require('../dist/runtime/agentTools');
const { ToolExecutor, TOOL_HTTP_TIMEOUT_MS } = require('../dist/runtime/ToolExecutor');

let total = 0;
let passed = 0;
async function test(name, fn) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}\n    ${err.message}`);
  }
}

const PUBLIC_URL = 'https://93.184.216.34/api/orders'; // public IP literal: passes the SSRF check without DNS

function withFetch(impl, fn) {
  const real = globalThis.fetch;
  globalThis.fetch = impl;
  return fn().finally(() => { globalThis.fetch = real; });
}

async function main() {
  console.log('\n--- AGENT TOOLS ---');

  await test('a Custom API function becomes an executable http tool with URL, method and headers', async () => {
    const tools = buildAgentTools([{ type: 'custom_api', name: 'lookup_order', description: 'Find an order', url: PUBLIC_URL, method: 'get', headers: '{"X-Api-Key":"k1","Host":"evil"}', parameters: { type: 'OBJECT', properties: { orderId: { type: 'STRING' } } } }], null);
    assert.strictEqual(tools.length, 1);
    assert.strictEqual(tools[0].executionType, 'http');
    assert.deepStrictEqual(tools[0].config, { url: PUBLIC_URL, method: 'GET', headers: { 'X-Api-Key': 'k1' } });
  });

  await test('built-in, invalid and duplicate names are skipped, not fatal', async () => {
    const tools = buildAgentTools([
      { name: 'end_call', url: PUBLIC_URL },
      { name: 'lookup_knowledge_base', url: PUBLIC_URL },
      { name: 'code_runner', url: PUBLIC_URL },
      { name: 'bad name!', url: PUBLIC_URL },
      { name: 'get_price', url: PUBLIC_URL },
      { name: 'get_price', url: PUBLIC_URL },
      { name: 'no_url' },
    ], null);
    assert.deepStrictEqual(tools.map((t) => t.name), ['get_price']);
    assert.ok(RESERVED_TOOL_NAMES.has('book_appointment'));
    assert.match(toolNameProblem('end_call'), /built-in/);
    assert.strictEqual(toolNameProblem('get_price'), null);
  });

  await test('platform function types (end call, calendar, transfer, SMS) are not declared twice', async () => {
    const tools = buildAgentTools([{ type: 'end_call', name: 'finish' }, { type: 'check_calendar', name: 'cal' }, { type: 'send_sms', name: 'sms' }], null);
    assert.strictEqual(tools.length, 0);
  });

  await test('flow function nodes with a URL become executable tools', async () => {
    const graph = { nodes: [{ type: 'function', data: { toolName: 'Check Stock', url: PUBLIC_URL, method: 'POST' } }, { type: 'function', data: { toolName: 'no url' } }] };
    const tools = buildAgentTools([], JSON.stringify(graph));
    assert.deepStrictEqual(tools.map((t) => t.name), ['check_stock']);
  });

  await test('header parser drops unsafe headers and header injection', async () => {
    assert.deepStrictEqual(parseToolHeaders('{"A":"1","Cookie":"x","B":"line\\r\\nInjected: y","C ":"2"}'), { A: '1', C: '2' }); // "C " is trimmed to a valid name
    assert.deepStrictEqual(parseToolHeaders('not json'), {});
  });

  console.log('\n--- TOOL EXECUTOR ---');
  const [tool] = buildAgentTools([{ name: 'lookup_order', url: PUBLIC_URL, method: 'GET', headers: '{"X-Api-Key":"k1"}' }], null);
  const [postTool] = buildAgentTools([{ name: 'create_lead', url: PUBLIC_URL, method: 'POST' }], null);

  await test('GET sends parameters in the query string with no body, plus custom headers', async () => {
    let seen;
    await withFetch(async (url, init) => { seen = { url, init }; return new Response('{"status":"shipped"}', { status: 200 }); }, async () => {
      const ex = new ToolExecutor();
      ex.registerTools([tool]);
      const r = await ex.executeTool('lookup_order', { orderId: 'A-17' });
      assert.strictEqual(r.success, true);
      assert.deepStrictEqual(r.result, { status: 'shipped' });
    });
    assert.strictEqual(new URL(seen.url).searchParams.get('orderId'), 'A-17');
    assert.strictEqual(seen.init.body, undefined);
    assert.strictEqual(seen.init.headers['X-Api-Key'], 'k1');
    assert.strictEqual(seen.init.redirect, 'error', 'redirects must not be followed');
    assert.ok(seen.init.signal, 'a timeout signal must be set');
  });

  await test('POST sends a JSON body; a non-JSON reply is returned as text', async () => {
    let seen;
    await withFetch(async (url, init) => { seen = init; return new Response('OK, lead created', { status: 200 }); }, async () => {
      const ex = new ToolExecutor();
      ex.registerTools([postTool]);
      const r = await ex.executeTool('create_lead', { name: 'Asha' });
      assert.strictEqual(r.success, true);
      assert.deepStrictEqual(r.result, { text: 'OK, lead created' });
    });
    assert.strictEqual(seen.body, '{"name":"Asha"}');
  });

  await test('a hung endpoint fails within the timeout instead of hanging the call', async () => {
    assert.ok(TOOL_HTTP_TIMEOUT_MS <= 15000);
    await withFetch((url, init) => new Promise((_, reject) => {
      init.signal.addEventListener('abort', () => reject(Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' })));
      setTimeout(() => {}, 0);
      // simulate the timeout firing immediately
      queueMicrotask(() => init.signal.dispatchEvent?.(new Event('abort')));
    }), async () => {
      const ex = new ToolExecutor();
      ex.registerTools([postTool]);
      const r = await Promise.race([ex.executeTool('create_lead', {}), new Promise((res) => setTimeout(() => res('HUNG'), 3000))]);
      assert.notStrictEqual(r, 'HUNG');
      assert.strictEqual(r.success, false);
    });
  });

  await test('internal addresses are refused (SSRF), before any request is sent', async () => {
    let called = false;
    await withFetch(async () => { called = true; return new Response('{}'); }, async () => {
      const ex = new ToolExecutor();
      ex.registerTools([{ ...postTool, name: 'internal', config: { url: 'http://127.0.0.1:5432/', method: 'POST', headers: {} } }, { ...postTool, name: 'metadata', config: { url: 'http://169.254.169.254/latest', method: 'GET', headers: {} } }]);
      assert.strictEqual((await ex.executeTool('internal', {})).success, false);
      assert.strictEqual((await ex.executeTool('metadata', {})).success, false);
    });
    assert.strictEqual(called, false);
  });

  await test('a duplicate tool name in one call is skipped, not fatal', async () => {
    const ex = new ToolExecutor();
    ex.registerTools([postTool, postTool]);
    assert.strictEqual((await ex.executeTool('missing', {})).success, false);
  });

  await test('browser test calls use the same hardened executor (no raw fetch of customer URLs)', async () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '../src/websockets/SandboxStreamHandler.ts'), 'utf8');
    assert.ok(src.includes('buildAgentTools([functionDef]'), 'sandbox must build tools with buildAgentTools');
    assert.ok(!/fetch\(fetchUrl/.test(src), 'sandbox must not fetch customer URLs directly');
    const mcp = fs.readFileSync(path.join(__dirname, '../src/services/McpService.ts'), 'utf8');
    assert.strictEqual((mcp.match(/redirect: 'error'/g) || []).length, 2, 'both MCP requests must refuse redirects');
  });

  console.log('\n--- CALL ORCHESTRATOR ---');
  const { CallOrchestrator } = require('../dist/core/orchestrator/CallOrchestrator');
  const orchestrator = CallOrchestrator.getInstance ? CallOrchestrator.getInstance() : new CallOrchestrator();

  await test('there is no tool registry shared between calls', async () => {
    assert.strictEqual(Object.prototype.hasOwnProperty.call(orchestrator, 'toolExecutor'), false);
  });

  await test('a call whose agent cannot be loaded is refused (no hard-coded fallback account)', async () => {
    const missingAgent = crypto.randomUUID();
    await assert.rejects(orchestrator.startVoiceSession(crypto.randomUUID(), missingAgent, '+919876543210'), /Agent not found/);
  });

  console.log(`\nAGENT TOOLS: ${passed === total ? 'PASS' : 'FAIL'} — ${passed}/${total} tests passed\n`);
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error in agent tool tests:', err);
  process.exit(1);
});
