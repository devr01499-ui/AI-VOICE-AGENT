require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Phase 4 (audit A13): MCP servers configured on an agent work on LIVE calls (they used to work
 * only in browser test calls), with the stored (encrypted) API key, SSRF check and no redirects.
 *
 * Production McpService; outbound HTTP stubbed by replacing global fetch. The live-call wiring in
 * CallOrchestrator is checked at source level (a real call needs the voice AI service).
 * Run: npm run test:mcp-live   (part of npm run test:security)
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { McpService } = require('../dist/services/McpService');
const { EncryptionService } = require('../dist/utils/EncryptionService');

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

const SERVER = { id: 'm1', name: 'CRM', url: 'https://93.184.216.34/mcp', transport: 'http', apiKey: EncryptionService.encrypt('mcp_live_key') };

async function main() {
  const realFetch = globalThis.fetch;
  console.log('\n--- MCP ON LIVE CALLS (A13) ---');

  await test('discovery lists the server\'s tools using the decrypted key, no redirects', async () => {
    const seen = [];
    globalThis.fetch = async (url, init) => {
      seen.push(init);
      return new Response(JSON.stringify({ result: { tools: [{ name: 'find_customer', description: 'Find a customer', inputSchema: { type: 'OBJECT', properties: { phone: { type: 'STRING' } } } }] } }), { status: 200 });
    };
    let d;
    try { d = await McpService.fetchMcpTools([SERVER]); } finally { globalThis.fetch = realFetch; }
    assert.deepStrictEqual(d.functionDeclarations.map((x) => x.name), ['mcp_crm_find_customer']);
    assert.strictEqual(seen[0].headers.Authorization, 'Bearer mcp_live_key');
    assert.strictEqual(seen[0].redirect, 'error');
  });

  await test('a discovered tool executes against the MCP server', async () => {
    let body;
    globalThis.fetch = async (url, init) => { body = JSON.parse(init.body); return new Response(JSON.stringify({ result: { content: [{ type: 'text', text: 'Asha, Gold tier' }] } }), { status: 200 }); };
    let out;
    try {
      out = await McpService.executeMcpTool({ name: 'find_customer', description: '', serverUrl: SERVER.url, transport: 'http', apiKey: SERVER.apiKey }, { phone: '+919876543210' });
    } finally { globalThis.fetch = realFetch; }
    assert.strictEqual(body.method, 'tools/call');
    assert.strictEqual(body.params.name, 'find_customer');
    assert.ok(JSON.stringify(out).includes('Gold tier'));
  });

  await test('internal MCP URLs are refused', async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return new Response('{}'); };
    try {
      const d = await McpService.fetchMcpTools([{ ...SERVER, url: 'http://127.0.0.1:9000/mcp' }]);
      assert.strictEqual(d.functionDeclarations.length, 0);
    } finally { globalThis.fetch = realFetch; }
    assert.strictEqual(calls, 0);
  });

  await test('live calls discover MCP tools (capped) and route MCP calls to the server', async () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/core/orchestrator/CallOrchestrator.ts'), 'utf8');
    assert.ok(src.includes('McpService.fetchMcpTools(rawConfig.mcpServers.slice(0, 5))'), 'discovery on live calls');
    assert.ok(/setTimeout\(\(\) => resolve\(null\), 6_000\)/.test(src), 'discovery must be capped');
    assert.ok(src.includes('McpService.executeMcpTool(mcpTool, parsedArgs)'), 'MCP tool execution on live calls');
    assert.ok(src.includes('isReservedToolName(decl.name)'), 'MCP tools may not shadow built-in tools');
  });

  console.log(`\nMCP LIVE: ${passed === total ? 'PASS' : 'FAIL'} — ${passed}/${total} tests passed\n`);
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error in MCP tests:', err);
  process.exit(1);
});
