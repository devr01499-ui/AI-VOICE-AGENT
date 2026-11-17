import { test, expect, type Page } from '@playwright/test';
import { loginAsTestUser, stubBackend, ok, json } from './helpers/dashboard';

/**
 * Issue B8 — Knowledge base page and the RAG v2 Retrieval Inspector:
 *  - plan usage and the per-file limit are shown; failed documents show why;
 *  - unsupported files and files over the limit are refused before upload;
 *  - documents waiting/indexing refresh on their own until ready;
 *  - a test question shows the chunks a call would use (score, similarity, source) and the
 *    near-misses that calls do not use; there is no fake "synthesized answer".
 */

const now = new Date().toISOString();
const LIMITS = {
  limits: { maxDocuments: 10, maxStorageMb: 25, maxFileSizeMb: 10, maxChunksPerWorkspace: 1500, maxKbAttachedPerAgent: 3 },
  usage: { documents: 3, storageMb: 0.42, chunks: 37 },
  supportedFileTypes: ['.pdf', '.txt', '.csv', '.md'],
};
const DOCS = [
  { id: 'kb-ready', name: 'fees.pdf', agentIds: [], createdAt: now, sizeChars: 4200, status: 'ready', progress: 100 },
  { id: 'kb-failed', name: 'catalogue.pdf', agentIds: [], createdAt: now, sizeChars: 900000, status: 'failed', progress: 0, errorMessage: 'This document needs 2400 sections but your plan allows 1500 in total (37 used). Remove documents or upgrade your plan.' },
];
const QUERY_RESULT = {
  query: 'consultation fee', queryRewritten: 'consultation fee', chunksCount: 1, latencyMs: 210, embeddingMs: 150, dbQueryMs: 40,
  chunks: [{ id: 'c1', source: 'fees.pdf', section: 'Fees', score: 0.0325, similarity: 0.88, matchType: 'hybrid', usedOnCalls: true, content: 'The consultation fee at Lotus Dental Pune is 800 rupees and includes an X-ray.' }],
  nearMisses: [{ id: 'c2', source: 'fees.pdf', section: 'Insurance', score: 0.0161, similarity: 0.71, matchType: 'dense', usedOnCalls: false, content: 'We accept most health insurance cards for procedures.' }],
};

async function openKnowledge(page: Page, docs: unknown[] | ((n: number) => unknown[]) = DOCS) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  let listCalls = 0;
  const seen = await stubBackend(page, {
    '/api/v2/knowledge-base/limits': (route) => ok(route, LIMITS),
    '/api/v2/knowledge-base/test-query': (route) => ok(route, QUERY_RESULT),
    '/api/v2/knowledge-base': (route) => {
      listCalls++;
      return ok(route, typeof docs === 'function' ? docs(listCalls) : docs);
    },
  });
  await page.goto('/dashboard/knowledge');
  await expect(page.getByText('Knowledge Base & RAG v2')).toBeVisible({ timeout: 30_000 });
  return { seen, listCount: () => listCalls };
}

test('plan usage, per-file limit and the reason a document failed are shown', async ({ page }) => {
  await openKnowledge(page);
  const usage = page.getByTestId('kb-usage');
  await expect(usage).toContainText('3 / 10');
  await expect(usage).toContainText('0.42 / 25 MB');
  await expect(usage).toContainText('10 MB');
  await expect(page.getByTestId('kb-error-kb-failed')).toContainText('your plan allows 1500');
  await expect(page.getByText('v2 Hybrid HNSW')).toHaveCount(0);
});

test('unsupported and over-size files are refused before upload', async ({ page }) => {
  const { seen } = await openKnowledge(page);
  await page.getByRole('button', { name: 'Add document' }).click();
  const input = page.getByTestId('kb-file-input');
  await input.setInputFiles({ name: 'notes.docx', mimeType: 'application/octet-stream', buffer: Buffer.from('PK zip') });
  await expect(page.getByTestId('kb-add-error')).toContainText('not supported');
  await input.setInputFiles({ name: 'big.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(11 * 1024 * 1024, 65) });
  await expect(page.getByTestId('kb-add-error')).toContainText('exceeds your limit of 10 MB');
  expect(seen.filter((r) => r.url.includes('/knowledge-base/upload'))).toHaveLength(0);
});

test('a document waiting to be indexed refreshes on its own until ready', async ({ page }) => {
  const queued = [{ ...DOCS[0], id: 'kb-new', name: 'menu.txt', status: 'queued', progress: 0 }];
  const ready = [{ ...queued[0], status: 'ready', progress: 100 }];
  const { listCount } = await openKnowledge(page, (n) => (n < 2 ? queued : ready));
  await expect(page.getByText('Waiting to index')).toBeVisible();
  await expect(page.getByText('Ready (RAG v2)')).toBeVisible({ timeout: 15_000 });
  expect(listCount()).toBeGreaterThanOrEqual(2);
});

test('the inspector shows what a call would use, with score and similarity, plus near-misses', async ({ page }) => {
  const { seen } = await openKnowledge(page);
  await page.getByPlaceholder('e.g. What is the property price and area in Gurgaon?').fill('consultation fee');
  await page.getByRole('button', { name: 'Test', exact: true }).click();
  await expect(page.getByTestId('kb-top-match')).toContainText('800 rupees');
  await expect(page.getByTestId('kb-top-match')).toContainText('Top match the agent would read on a call');
  await expect(page.getByText('Synthesized Agent Answer')).toHaveCount(0);
  await expect(page.getByText(/Score: 0.0325 · Similarity 88%/)).toBeVisible();
  await expect(page.getByTestId('kb-near-misses')).toContainText('Similarity 71%');
  await expect(page.getByTestId('kb-near-misses')).toContainText('not used on calls');
  const q = seen.find((r) => r.url.includes('/test-query'));
  expect(q?.body).toMatchObject({ query: 'consultation fee', kbId: 'kb-ready' });
});

test('a failed or not-yet-indexed document cannot be picked as the test target', async ({ page }) => {
  await openKnowledge(page);
  const option = page.locator('option', { hasText: 'catalogue.pdf' });
  await expect(option).toBeDisabled();
  await expect(option).toContainText('(failed)');
});

test('the knowledge page fits a phone screen without sideways page scroll', async ({ page }) => {
  await openKnowledge(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('kb-usage')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: 'test-results/kb-390.png', fullPage: false });
});
