require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
// One connection: the in-memory test database serialises connections (concurrency is proven
// separately by test_kb_limits_race.js on a real Postgres).
process.env.DB_POOL_MAX = process.env.DB_POOL_MAX || '1';
/**
 * Phase 5 (issue B8): knowledge base + RAG v2 Retrieval Inspector.
 *  - Plan limits (file size, documents, storage, chunks, documents per agent) are enforced, before
 *    any expensive work, and hold under parallel uploads.
 *  - Unsupported/renamed binary files are refused instead of being indexed as gibberish.
 *  - Indexing runs through a bounded queue (global and per-workspace caps), survives restarts.
 *  - The inspector returns the chunks a call would get, with scores and sources, plus near-misses.
 *  - Every search path is limited to the caller's workspace; searches have a time budget; a failed
 *    lookup on a live call tells the agent not to guess.
 *  - Embeddings fail closed outside tests (no fake vectors in production).
 *  - URL crawling re-checks every redirect hop against internal addresses.
 *  - KB routes are rate limited.
 *
 * Production controller/services against the local TEST database (PGlite with pgvector); no API
 * key, so embeddings use the test-only deterministic vectors. Outbound HTTP stubbed.
 * Run: npm run test:kb-rag   (part of npm run test:security)
 */
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { prisma } = require('../dist/lib/prisma');
const { KnowledgeBaseController, KB_PLATFORM_MAX_FILE_MB, effectiveKbLimits, base64DecodedBytes } = require('../dist/controllers/KnowledgeBaseController');
const { KnowledgeBaseService, GLOBAL_CONCURRENCY } = require('../dist/services/KnowledgeBaseService');
const { HybridSearchService, KbSearchTimeoutError } = require('../dist/services/HybridSearchService');
const embedding = require('../dist/utils/embedding');
const kbRouter = require('../dist/routes/knowledgeBase');
const limiters = require('../dist/middleware/rateLimiter');

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

/** Minimal Express req/res doubles that run the real controller methods. */
function call(method, userId, { body = {}, params = {} } = {}) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      status(code) { this.statusCode = code; return this; },
      json(payload) { resolve({ status: this.statusCode, body: payload }); return this; },
    };
    const req = { userId, body, params, headers: {} };
    Promise.resolve(KnowledgeBaseController[method](req, res, (err) => reject(err || new Error('next() called')))).catch(reject);
  });
}
const b64 = (text) => Buffer.from(text, 'utf8').toString('base64');
const para = (topic, n) => Array.from({ length: n }, (_, i) => `## ${topic} section ${i}\n` + `The ${topic} detail number ${i} explains pricing, timing and policies for customers in Pune. `.repeat(12)).join('\n\n');

async function makeUser(accountType) {
  const id = crypto.randomUUID();
  await prisma.user.create({ data: { id, email: `${id}@example.org`, fullName: 'KB Test', passwordHash: 'x', accountType } });
  return id;
}

async function main() {
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  assert.strictEqual(process.env.NODE_ENV, 'test');
  const realFetch = globalThis.fetch;

  console.log('\n--- KNOWLEDGE BASE / RAG (B8) ---');

  await test('effective file limit = plan limit capped by the server maximum; limits endpoint shows usage', async () => {
    assert.strictEqual(effectiveKbLimits('trial').maxFileSizeMb, 2);
    assert.strictEqual(effectiveKbLimits('enterprise').maxFileSizeMb, KB_PLATFORM_MAX_FILE_MB);
    assert.strictEqual(base64DecodedBytes(b64('hello world')), 11);
    const u = await makeUser('trial');
    const r = await call('limits', u);
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.data.limits.maxDocuments, 2);
    assert.deepStrictEqual(r.body.data.usage, { documents: 0, storageMb: 0, chunks: 0 });
    assert.ok(r.body.data.supportedFileTypes.includes('.pdf'));
    assert.ok(!r.body.data.supportedFileTypes.includes('.docx'));
  });

  await test('an over-size file is refused before it is decoded or parsed', async () => {
    const u = await makeUser('trial'); // 2 MB per file
    const big = 'A'.repeat(Math.ceil((3 * 1024 * 1024 * 4) / 3)); // ~3 MB decoded
    const r = await call('upload', u, { body: { name: 'big.pdf', fileBase64: big } });
    assert.strictEqual(r.status, 413);
    assert.strictEqual(r.body.code, 'KB_FILE_TOO_LARGE');
    assert.strictEqual(await prisma.knowledgeBase.count({ where: { userId: u } }), 0);
  });

  await test('unsupported or renamed binary files are refused with a clear message', async () => {
    const u = await makeUser('professional');
    const docx = await call('upload', u, { body: { name: 'notes.docx', fileBase64: b64('PK\u0003\u0004 zip') } });
    assert.strictEqual(docx.status, 415);
    const renamed = await call('upload', u, { body: { name: 'notes.txt', fileBase64: Buffer.from([80, 75, 3, 4, 0, 0, 1]).toString('base64') } });
    assert.strictEqual(renamed.status, 415);
    const fakePdf = await call('upload', u, { body: { name: 'a.pdf', fileBase64: b64('not a pdf at all') } });
    assert.strictEqual(fakePdf.status, 415);
    assert.strictEqual(await prisma.knowledgeBase.count({ where: { userId: u } }), 0);
  });

  await test('the document limit holds under parallel uploads (no slipping past the last slot)', async () => {
    const u = await makeUser('trial'); // 2 documents
    const results = await Promise.all([1, 2, 3, 4].map((i) => call('upload', u, { body: { name: `doc${i}.txt`, fileBase64: b64(`Document ${i}. ` + para('clinic', 1)) } })));
    assert.strictEqual(results.filter((r) => r.status === 202).length, 2, JSON.stringify(results.map((r) => r.status)));
    assert.ok(results.filter((r) => r.status === 403).every((r) => r.body.code === 'KB_DOCUMENT_LIMIT'));
    assert.strictEqual(await prisma.knowledgeBase.count({ where: { userId: u } }), 2);
    await KnowledgeBaseService.whenIdle();
  });

  await test('the storage limit is enforced', async () => {
    const u = await makeUser('trial'); // 5 MB of text
    await prisma.knowledgeBase.create({ data: { userId: u, name: 'existing.txt', contentText: 'x', sizeChars: 5 * 1024 * 1024 - 10, status: 'ready' } });
    const r = await call('upload', u, { body: { name: 'more.txt', fileBase64: b64('This adds more than ten characters of text.') } });
    assert.strictEqual(r.status, 403);
    assert.strictEqual(r.body.code, 'KB_STORAGE_LIMIT');
  });

  await test('documents per agent are limited by plan (upload, assign, update-agents)', async () => {
    const u = await makeUser('trial'); // 1 per agent
    const agent = await prisma.agent.create({ data: { userId: u, name: 'Agent' } });
    const first = await call('upload', u, { body: { name: 'one.txt', agentId: agent.id, fileBase64: b64('First doc. ' + para('fees', 1)) } });
    assert.strictEqual(first.status, 202);
    const second = await call('upload', u, { body: { name: 'two.txt', agentId: agent.id, fileBase64: b64('Second doc. ' + para('hours', 1)) } });
    assert.strictEqual(second.status, 403);
    assert.strictEqual(second.body.code, 'KB_AGENT_ATTACH_LIMIT');
    const lib = await prisma.knowledgeBase.create({ data: { userId: u, name: 'lib.txt', contentText: 'Library doc', sizeChars: 11, status: 'ready' } });
    const assign = await call('assignToAgent', u, { params: { id: lib.id }, body: { agentId: agent.id } });
    assert.strictEqual(assign.status, 403);
    const update = await call('updateAgentAssignments', u, { params: { id: lib.id }, body: { agentIds: [agent.id] } });
    assert.strictEqual(update.status, 403);
    // Re-saving the document that is already attached is fine.
    const same = await call('updateAgentAssignments', u, { params: { id: first.body.data.id }, body: { agentIds: [agent.id] } });
    assert.strictEqual(same.status, 200);
    await KnowledgeBaseService.whenIdle();
  });

  await test('indexing is queued: never more than the global cap, one per workspace; all end ready', async () => {
    const users = [await makeUser('professional'), await makeUser('professional'), await makeUser('professional')];
    const docs0 = [];
    for (const u of users) {
      for (let i = 0; i < 3; i++) {
        const kb = await prisma.knowledgeBase.create({ data: { userId: u, name: `q${i}.txt`, contentText: `Queue doc ${i}. ` + para('queue', 2), sizeChars: 100, status: 'queued', progress: 0 } });
        docs0.push({ id: kb.id, userId: u });
      }
    }
    const ids = docs0.map((d) => d.id);
    // Measure real concurrency by wrapping the production job function.
    const realIngest = KnowledgeBaseService.ingestDocument;
    let running = 0; let maxRunning = 0; const perWs = new Map(); let maxPerWs = 0;
    KnowledgeBaseService.ingestDocument = async function (kbId, userId) {
      running++; maxRunning = Math.max(maxRunning, running);
      perWs.set(userId, (perWs.get(userId) || 0) + 1); maxPerWs = Math.max(maxPerWs, perWs.get(userId));
      try { await new Promise((r) => setTimeout(r, 30)); return await realIngest.call(KnowledgeBaseService, kbId, userId); }
      finally { running--; perWs.set(userId, perWs.get(userId) - 1); }
    };
    try {
      await Promise.all(docs0.map((d) => KnowledgeBaseService.enqueueIngestion(d.id, d.userId)));
      await KnowledgeBaseService.whenIdle();
    } finally {
      KnowledgeBaseService.ingestDocument = realIngest;
    }
    assert.ok(maxRunning <= GLOBAL_CONCURRENCY, `ran ${maxRunning} at once`);
    assert.strictEqual(maxRunning, GLOBAL_CONCURRENCY, 'the queue should use its full capacity');
    assert.strictEqual(maxPerWs, 1, `a workspace ran ${maxPerWs} documents at once`);
    const docs = await prisma.knowledgeBase.findMany({ where: { id: { in: ids } } });
    assert.ok(docs.every((d) => d.status === 'ready' && d.progress === 100), JSON.stringify(docs.map((d) => [d.status, d.errorMessage])));
    const chunks = await prisma.$queryRawUnsafe('SELECT COUNT(*)::int AS n FROM "kb_chunks" WHERE "kb_id" = ANY($1::text[])', ids);
    assert.ok(chunks[0].n >= ids.length);
  });

  await test('the per-workspace chunk limit fails the document clearly and leaves no partial chunks', async () => {
    const u = await makeUser('trial'); // 200 chunks
    const kb = await prisma.knowledgeBase.create({ data: { userId: u, name: 'huge.txt', contentText: para('catalogue', 260), sizeChars: 1000, status: 'queued' } });
    await KnowledgeBaseService.enqueueIngestion(kb.id, u);
    await KnowledgeBaseService.whenIdle();
    const after = await prisma.knowledgeBase.findUnique({ where: { id: kb.id } });
    assert.strictEqual(after.status, 'failed');
    assert.ok(/your plan allows 200/.test(after.errorMessage), after.errorMessage);
    const n = await prisma.$queryRawUnsafe('SELECT COUNT(*)::int AS n FROM "kb_chunks" WHERE "kb_id" = $1', kb.id);
    assert.strictEqual(n[0].n, 0);
  });

  await test('documents left queued/processing by a restart are indexed again', async () => {
    const u = await makeUser('starter');
    const kb = await prisma.knowledgeBase.create({ data: { userId: u, name: 'stuck.txt', contentText: 'Stuck doc. ' + para('refund', 1), sizeChars: 100, status: 'processing', progress: 40 } });
    const n = await KnowledgeBaseService.resumePendingIngestions();
    assert.ok(n >= 1);
    await KnowledgeBaseService.whenIdle();
    assert.strictEqual((await prisma.knowledgeBase.findUnique({ where: { id: kb.id } })).status, 'ready');
  });

  // Shared fixture for search tests.
  const A = await makeUser('professional');
  const B = await makeUser('professional');
  const FACT = 'The consultation fee at Lotus Dental Pune is 800 rupees and includes an X-ray.';
  const agentA = await prisma.agent.create({ data: { userId: A, name: 'Lotus' } });
  const upA = await call('upload', A, { body: { name: 'fees.txt', agentId: agentA.id, fileBase64: b64(FACT) } });
  const upB = await call('upload', B, { body: { name: 'secret.txt', fileBase64: b64('Workspace B private pricing: 999 rupees for consultation fee.') } });
  await KnowledgeBaseService.whenIdle();

  await test('inspector: a question returns the chunk a call would use, with score and source', async () => {
    assert.strictEqual(upA.status, 202);
    const r = await call('testQuery', A, { body: { kbId: upA.body.data.id, query: 'consultation fee' } });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    const top = r.body.data.chunks[0];
    assert.ok(top, 'no chunk returned');
    assert.ok(top.content.includes('800 rupees'));
    assert.strictEqual(top.usedOnCalls, true);
    assert.ok(typeof top.score === 'number' && top.score > 0);
    assert.ok(top.source && top.matchType);
    assert.ok(Array.isArray(r.body.data.nearMisses));
    const byAgent = await call('testQuery', A, { body: { agentId: agentA.id, query: 'consultation fee' } });
    assert.ok(byAgent.body.data.chunks.some((c) => c.content.includes('800 rupees')));
  });

  await test('inspector and search never cross workspaces', async () => {
    const other = await call('testQuery', A, { body: { kbId: upB.body.data.id, query: 'consultation fee' } });
    assert.strictEqual(other.status, 404);
    const ws = await call('testQuery', A, { body: { query: 'consultation fee' } });
    assert.ok(ws.body.data.chunks.length > 0 && ws.body.data.chunks.every((c) => !c.content.includes('999')));
    // Defence in depth: even a direct service call with B's document id but A as owner finds nothing.
    const direct = await HybridSearchService.search({ kbId: upB.body.data.id, workspaceId: A, query: 'consultation fee', includeRejected: true });
    assert.strictEqual(direct.results.length + direct.rejected.length, 0);
  });

  await test('inspector: question length, unindexed documents and empty workspaces get clear answers', async () => {
    const tooLong = await call('testQuery', A, { body: { query: 'x'.repeat(501) } });
    assert.strictEqual(tooLong.status, 400);
    const pending = await prisma.knowledgeBase.create({ data: { userId: A, name: 'pending.txt', contentText: 'p', sizeChars: 1, status: 'queued' } });
    const notReady = await call('testQuery', A, { body: { kbId: pending.id, query: 'fee' } });
    assert.strictEqual(notReady.status, 409);
    await prisma.knowledgeBase.delete({ where: { id: pending.id } });
    const empty = await call('testQuery', await makeUser('starter'), { body: { query: 'fee' } });
    assert.strictEqual(empty.status, 200);
    assert.ok(/No documents/.test(empty.body.data.message));
  });

  await test('search has a time budget', async () => {
    const realQuery = prisma.$queryRawUnsafe;
    prisma.$queryRawUnsafe = (...args) => new Promise((r) => setTimeout(() => r(realQuery.apply(prisma, args)), 400));
    try {
      await assert.rejects(HybridSearchService.search({ workspaceId: A, query: 'slow fee question', timeoutMs: 50 }), KbSearchTimeoutError);
    } finally {
      prisma.$queryRawUnsafe = realQuery;
    }
  });

  await test('a failed or slow lookup on a live call tells the agent not to guess', async () => {
    const live = fs.readFileSync(path.join(__dirname, '../src/providers/gemini/GeminiLiveProvider.ts'), 'utf8');
    const failBranch = live.slice(live.indexOf("logger.error('GeminiLiveProvider: Failed hybrid search'"));
    assert.ok(/NO_RELEVANT_FACTS_FOUND/.test(failBranch.slice(0, 600)), 'error path must send NO_RELEVANT_FACTS_FOUND');
    assert.ok(live.includes('workspaceId: userId') && live.includes('timeoutMs: LIVE_CALL_SEARCH_TIMEOUT_MS'));
    const orch = fs.readFileSync(path.join(__dirname, '../src/core/orchestrator/CallOrchestrator.ts'), 'utf8');
    assert.ok(orch.includes("status: 'NO_RELEVANT_FACTS_FOUND'") && orch.includes('timeoutMs: LIVE_CALL_SEARCH_TIMEOUT_MS'));
  });

  await test('embeddings fail closed outside tests (no fake vectors in production)', async () => {
    process.env.NODE_ENV = 'production';
    try {
      embedding.clearEmbeddingCache();
      await assert.rejects(embedding.getEmbedding('anything at all', 'RETRIEVAL_QUERY'), embedding.EmbeddingUnavailableError);
    } finally {
      process.env.NODE_ENV = 'test';
    }
  });

  await test('the embedding key is sent in a header, never in the URL, with a request timeout', async () => {
    const seen = [];
    process.env.GEMINI_API_KEY = 'test-key-not-real';
    globalThis.fetch = async (url, init) => { seen.push({ url: String(url), init }); return new Response(JSON.stringify({ embedding: { values: [0.1, 0.2] } }), { status: 200 }); };
    try {
      embedding.clearEmbeddingCache();
      await embedding.getEmbedding('header check', 'RETRIEVAL_QUERY');
    } finally {
      globalThis.fetch = realFetch;
      delete process.env.GEMINI_API_KEY;
    }
    assert.ok(!seen[0].url.includes('test-key-not-real') && !seen[0].url.includes('key='));
    assert.strictEqual(seen[0].init.headers['x-goog-api-key'], 'test-key-not-real');
    assert.ok(seen[0].init.signal, 'request must have a timeout signal');
  });

  await test('URL crawl: a redirect to an internal address is refused; size and type are capped', async () => {
    const u = await makeUser('professional');
    const hops = [];
    globalThis.fetch = async (url, init) => {
      hops.push({ url: String(url), redirect: init.redirect });
      return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1:8080/admin' } });
    };
    let r;
    try { r = await call('scrape', u, { body: { url: 'https://93.184.216.34/help' } }); } finally { globalThis.fetch = realFetch; }
    assert.strictEqual(r.status, 400);
    assert.strictEqual(r.body.code, 'KB_URL_BLOCKED');
    assert.strictEqual(hops.length, 1, 'the internal address must never be fetched');
    assert.strictEqual(hops[0].redirect, 'manual');

    globalThis.fetch = async () => new Response('%PDF-1.4 binary', { status: 200, headers: { 'content-type': 'application/pdf' } });
    try { r = await call('scrape', u, { body: { url: 'https://93.184.216.34/file.pdf' } }); } finally { globalThis.fetch = realFetch; }
    assert.strictEqual(r.status, 415);

    globalThis.fetch = async () => new Response('<html><body><nav>menu</nav><p>Clinic opens at 9 am.</p></body></html>', { status: 200, headers: { 'content-type': 'text/html' } });
    try { r = await call('scrape', u, { body: { url: 'https://93.184.216.34/hours' } }); } finally { globalThis.fetch = realFetch; }
    assert.strictEqual(r.status, 202, JSON.stringify(r.body));
    const doc = await prisma.knowledgeBase.findUnique({ where: { id: r.body.data.id } });
    assert.strictEqual(doc.contentText, 'Clinic opens at 9 am.');
    await KnowledgeBaseService.whenIdle();
  });

  await test('delete removes the document, its chunks and links, and only for its owner', async () => {
    const notMine = await call('delete', B, { params: { id: upA.body.data.id } });
    assert.strictEqual(notMine.status, 404);
    const r = await call('delete', A, { params: { id: upA.body.data.id } });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(await prisma.knowledgeBase.count({ where: { id: upA.body.data.id } }), 0);
    assert.strictEqual(await prisma.agentKnowledgeBase.count({ where: { kbId: upA.body.data.id } }), 0);
    const n = await prisma.$queryRawUnsafe('SELECT COUNT(*)::int AS n FROM "kb_chunks" WHERE "kb_id" = $1', upA.body.data.id);
    assert.strictEqual(n[0].n, 0);
  });

  await test('every knowledge-base write and the inspector are rate limited', async () => {
    const stack = kbRouter.default.stack.filter((l) => l.route);
    const find = (method, p) => stack.find((l) => l.route.path === p && l.route.methods[method]).route.stack.map((s) => s.handle);
    const expect = [
      ['post', '/upload', limiters.kbIngestLimiter], ['post', '/scrape', limiters.kbIngestLimiter], ['post', '/:id/reindex', limiters.kbIngestLimiter],
      ['delete', '/:id', limiters.kbWriteLimiter], ['post', '/:id/assign', limiters.kbWriteLimiter], ['post', '/:id/unassign', limiters.kbWriteLimiter],
      ['post', '/:id/update-agents', limiters.kbWriteLimiter], ['post', '/test-query', limiters.kbQueryLimiter],
    ];
    for (const [m, p, limiter] of expect) assert.ok(find(m, p).includes(limiter), `${m.toUpperCase()} ${p} has no limiter`);
    assert.ok(find('post', '/upload').includes(kbRouter.uploadGate), 'upload backpressure gate missing');
  });

  await test('upload backpressure: extra concurrent uploads get a clear "busy" answer', async () => {
    const pending = [];
    const mkRes = () => ({ statusCode: 200, headers: {}, handlers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; }, on(ev, fn) { this.handlers[ev] = fn; } });
    let nexts = 0;
    for (let i = 0; i < kbRouter.MAX_UPLOADS_IN_FLIGHT; i++) { const res = mkRes(); kbRouter.uploadGate({}, res, () => nexts++); pending.push(res); }
    const extra = mkRes();
    kbRouter.uploadGate({}, extra, () => nexts++);
    assert.strictEqual(nexts, kbRouter.MAX_UPLOADS_IN_FLIGHT);
    assert.strictEqual(extra.statusCode, 503);
    assert.strictEqual(extra.body.code, 'KB_UPLOAD_BUSY');
    pending.forEach((res) => res.handlers.finish());
    const after = mkRes();
    kbRouter.uploadGate({}, after, () => nexts++);
    assert.strictEqual(nexts, kbRouter.MAX_UPLOADS_IN_FLIGHT + 1, 'slots must be released when uploads finish');
    after.handlers.close();
  });

  console.log(`\nKB RAG: ${passed === total ? 'PASS' : 'FAIL'} — ${passed}/${total} tests passed\n`);
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error in KB tests:', err);
  process.exit(1);
});
