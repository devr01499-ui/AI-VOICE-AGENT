import { ssrfSafeDispatcher } from '../utils/ssrfValidator';
import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { KnowledgeBaseService } from '../services/KnowledgeBaseService';
import { HybridSearchService, KbSearchTimeoutError } from '../services/HybridSearchService';
import { EmbeddingUnavailableError } from '../utils/embedding';
import { getKbPlanLimits, KbPlanLimits } from '../config/plans';

/**
 * Largest file this server accepts in one upload, whatever the plan says (uploads arrive as
 * base64 JSON and are held in memory while parsed). The effective per-file limit is
 * min(plan limit, this) and is shown to the user by GET /knowledge-base/limits.
 */
export const KB_PLATFORM_MAX_FILE_MB = 20;
/** Hard ceiling on extracted text per document (~500 pages). */
export const KB_MAX_DOCUMENT_CHARS = 2_000_000;
export const KB_MAX_QUERY_CHARS = 500;
const SCRAPE_MAX_BYTES = 5 * 1024 * 1024;
const SCRAPE_TIMEOUT_MS = 15_000;
const SCRAPE_MAX_REDIRECTS = 3;
const PDF_PARSE_TIMEOUT_MS = 30_000;

/** Supported uploads. DOCX and other office files are not parsed and are refused clearly. */
const TEXT_EXTENSIONS = ['.txt', '.csv', '.md'];
const SUPPORTED_EXTENSIONS = ['.pdf', ...TEXT_EXTENSIONS];

class KbRequestError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

function ownerOf(req: AuthenticatedRequest): string | undefined {
  return (req as any).effectiveWorkspaceId || req.userId;
}

function sendError(res: Response, err: any, fallback: string): void {
  if (err instanceof KbRequestError) {
    res.status(err.status).json({ success: false, error: err.message, ...(err.code ? { code: err.code } : {}) });
    return;
  }
  res.status(500).json({ success: false, error: fallback });
}

export function effectiveKbLimits(accountType?: string | null): KbPlanLimits {
  const plan = getKbPlanLimits(accountType);
  return { ...plan, maxFileSizeMb: Math.min(plan.maxFileSizeMb, KB_PLATFORM_MAX_FILE_MB) };
}

async function limitsFor(userId: string): Promise<KbPlanLimits> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { accountType: true } });
  return effectiveKbLimits(user?.accountType);
}

/** Bytes a base64 string decodes to, without decoding it. */
export function base64DecodedBytes(b64: string): number {
  const clean = b64.replace(/\s/g, '');
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

async function workspaceUsage(userId: string, client: any = prisma): Promise<{ documents: number; storageChars: number }> {
  const agg = await client.knowledgeBase.aggregate({ where: { userId }, _count: { _all: true }, _sum: { sizeChars: true } });
  return { documents: agg._count._all, storageChars: agg._sum.sizeChars || 0 };
}

function checkRoom(limits: KbPlanLimits, usage: { documents: number; storageChars: number }, newChars: number): void {
  if (usage.documents >= limits.maxDocuments) {
    throw new KbRequestError(403, `Document limit reached for your plan (${limits.maxDocuments} documents). Remove a document or upgrade your plan.`, 'KB_DOCUMENT_LIMIT');
  }
  const maxChars = limits.maxStorageMb * 1024 * 1024;
  if (usage.storageChars + newChars > maxChars) {
    throw new KbRequestError(403, `Knowledge base storage limit reached for your plan (${limits.maxStorageMb} MB of text). Remove a document or upgrade your plan.`, 'KB_STORAGE_LIMIT');
  }
}

async function checkAgentAttachRoom(agentId: string, limits: KbPlanLimits, client: any = prisma, exceptKbId?: string): Promise<void> {
  const attached = await client.agentKnowledgeBase.count({ where: { agentId, ...(exceptKbId ? { kbId: { not: exceptKbId } } : {}) } });
  if (attached >= limits.maxKbAttachedPerAgent) {
    throw new KbRequestError(403, `This agent already has ${attached} knowledge base documents, the most your plan allows (${limits.maxKbAttachedPerAgent}). Detach one or upgrade your plan.`, 'KB_AGENT_ATTACH_LIMIT');
  }
}

/**
 * Creates the document row (and optional agent link) under a per-workspace lock, re-checking the
 * plan limits inside it so two parallel uploads cannot both slip past the last free slot.
 */
async function createDocument(userId: string, name: string, rawText: string, agentId: string | undefined, limits: KbPlanLimits) {
  // Postgres cannot store NUL characters in text; PDF and web-page extraction can produce them
  // (audit #162: the upload then failed with a database error).
  const contentText = rawText.replace(/\u0000/g, '');
  name = name.replace(/\u0000/g, '');
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `kb:${userId}`);
    checkRoom(limits, await workspaceUsage(userId, tx), contentText.length);
    if (agentId) await checkAgentAttachRoom(agentId, limits, tx);
    const kb = await tx.knowledgeBase.create({
      data: { name, contentText, sizeChars: contentText.length, status: 'queued', progress: 0, userId },
    });
    if (agentId) await tx.agentKnowledgeBase.create({ data: { agentId, kbId: kb.id } });
    return kb;
  });
}

async function assertAgentOwned(agentId: unknown, userId: string): Promise<string | undefined> {
  if (agentId === undefined || agentId === null || agentId === '') return undefined;
  if (typeof agentId !== 'string') throw new KbRequestError(400, 'Invalid agent.');
  const agent = await prisma.agent.findFirst({ where: { id: agentId, userId }, select: { id: true } });
  if (!agent) throw new KbRequestError(404, 'Agent not found in your workspace');
  return agentId;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new KbRequestError(422, message)), ms); }),
  ]).finally(() => timer && clearTimeout(timer));
}

/** Reads at most maxBytes of a response body; stops (and fails) beyond that. */
async function readCapped(response: globalThis.Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new KbRequestError(413, `This page is larger than ${Math.round(maxBytes / (1024 * 1024))} MB and cannot be added.`);
    }
    parts.push(value);
  }
  return Buffer.concat(parts.map((p) => Buffer.from(p))).toString('utf8');
}

/**
 * Fetches a public web page. Every hop (including redirects) is checked against private/internal
 * addresses; at most SCRAPE_MAX_REDIRECTS redirects; HTML or plain text only; size and time capped.
 */
async function fetchPublicPage(rawUrl: string): Promise<{ finalUrl: string; body: string; contentType: string }> {
  const { assertSafeUrl } = await import('../utils/ssrfValidator');
  let current = rawUrl;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);
  try {
    for (let hop = 0; hop <= SCRAPE_MAX_REDIRECTS; hop++) {
      let safe: URL;
      try {
        safe = await assertSafeUrl(current);
      } catch {
        throw new KbRequestError(400, 'This address cannot be added (only public websites are allowed).', 'KB_URL_BLOCKED');
      }
      let response: globalThis.Response;
      try {
        response = await fetch(safe.toString(), {
          ...({ dispatcher: ssrfSafeDispatcher } as object), // connect-time SSRF check (DNS rebinding)
          signal: controller.signal,
          redirect: 'manual',
          headers: { 'User-Agent': 'ClaritiyVoiceBot/1.0', Accept: 'text/html,text/plain;q=0.9' },
        });
      } catch (err: any) {
        if (err?.name === 'AbortError') throw new KbRequestError(504, 'The website took too long to respond (15 seconds).');
        throw new KbRequestError(502, 'The website could not be reached.');
      }
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) throw new KbRequestError(502, 'The website sent an invalid redirect.');
        current = new URL(location, safe).toString();
        continue;
      }
      if (!response.ok) throw new KbRequestError(502, `The website returned an error (HTTP ${response.status}).`);
      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (contentType && !contentType.includes('text/html') && !contentType.includes('text/plain') && !contentType.includes('application/xhtml')) {
        throw new KbRequestError(415, 'Only web pages (HTML or plain text) can be added from a URL.');
      }
      return { finalUrl: safe.toString(), body: await readCapped(response, SCRAPE_MAX_BYTES), contentType };
    }
    throw new KbRequestError(502, 'The website redirected too many times.');
  } finally {
    clearTimeout(timer);
  }
}

export class KnowledgeBaseController {
  /** GET /api/v2/knowledge-base/limits — plan limits (effective) and current usage. */
  static async limits(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = ownerOf(req);
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
      const [limits, usage, chunkRows] = await Promise.all([
        limitsFor(userId),
        workspaceUsage(userId),
        prisma.$queryRawUnsafe<Array<{ n: bigint | number }>>(
          'SELECT COUNT(*)::bigint AS n FROM "kb_chunks" c JOIN "knowledge_bases" kb ON c."kb_id" = kb."id" WHERE kb."user_id" = $1',
          userId
        ),
      ]);
      res.json({
        success: true,
        data: {
          limits,
          usage: {
            documents: usage.documents,
            storageMb: Number((usage.storageChars / (1024 * 1024)).toFixed(2)),
            chunks: Number(chunkRows[0]?.n || 0),
          },
          supportedFileTypes: SUPPORTED_EXTENSIONS,
        },
      });
    } catch (err) {
      logger.error('KBController: failed to load limits', { error: String(err) });
      next(err);
    }
  }

  /** POST /api/v2/knowledge-base/upload — base64 file → queued for indexing. */
  static async upload(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = ownerOf(req);
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }

      const { name, agentId: rawAgentId, fileBase64 } = req.body || {};
      if (typeof name !== 'string' || !name.trim() || typeof fileBase64 !== 'string' || !fileBase64) {
        throw new KbRequestError(400, 'name and fileBase64 are required');
      }
      const docName = name.trim().slice(0, 200);
      const ext = extensionOf(docName);
      if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        throw new KbRequestError(415, `This file type is not supported. Upload ${SUPPORTED_EXTENSIONS.join(', ')} files.`, 'KB_UNSUPPORTED_TYPE');
      }
      const agentId = await assertAgentOwned(rawAgentId, userId);

      // Cheap checks first: no decoding or parsing for uploads that cannot be accepted anyway.
      const limits = await limitsFor(userId);
      const bytes = base64DecodedBytes(fileBase64);
      if (bytes > limits.maxFileSizeMb * 1024 * 1024) {
        throw new KbRequestError(413, `File size (${(bytes / (1024 * 1024)).toFixed(1)} MB) exceeds your limit of ${limits.maxFileSizeMb} MB per file.`, 'KB_FILE_TOO_LARGE');
      }
      checkRoom(limits, await workspaceUsage(userId), 0);
      if (agentId) await checkAgentAttachRoom(agentId, limits);

      const buffer = Buffer.from(fileBase64, 'base64');
      let contentText: string;
      if (ext === '.pdf') {
        if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
          throw new KbRequestError(415, 'This file is not a valid PDF.', 'KB_UNSUPPORTED_TYPE');
        }
        const { extractTextFromPdf } = await import('../utils/pdfParser');
        try {
          contentText = await withTimeout(extractTextFromPdf(buffer), PDF_PARSE_TIMEOUT_MS, 'This PDF took too long to read. Try a smaller file.');
        } catch (pdfErr: any) {
          if (pdfErr instanceof KbRequestError) throw pdfErr;
          const scanned = /scanned|image-only/i.test(String(pdfErr?.message));
          throw new KbRequestError(422, scanned
            ? 'This PDF looks scanned or image-only. Text in images cannot be read yet; upload a text PDF.'
            : 'This PDF could not be read. It may be damaged or password-protected.');
        }
      } else {
        if (buffer.includes(0)) {
          // A renamed binary file (e.g. a .docx saved as .txt) would index as gibberish.
          throw new KbRequestError(415, 'This file is not plain text. Upload a .txt, .csv, .md or .pdf file.', 'KB_UNSUPPORTED_TYPE');
        }
        contentText = buffer.toString('utf8');
      }

      if (!contentText.trim()) throw new KbRequestError(400, 'Document does not contain any readable text.');
      if (contentText.length > KB_MAX_DOCUMENT_CHARS) {
        throw new KbRequestError(413, `Document has too much text (${contentText.length.toLocaleString()} characters; the maximum is ${KB_MAX_DOCUMENT_CHARS.toLocaleString()}). Please split it into smaller documents.`);
      }

      const kb = await createDocument(userId, docName, contentText, agentId, limits);
      await KnowledgeBaseService.enqueueIngestion(kb.id, userId);

      res.status(202).json({
        success: true,
        data: {
          id: kb.id,
          name: kb.name,
          agentId: agentId || '',
          agentIds: agentId ? [agentId] : [],
          createdAt: kb.createdAt,
          sizeChars: kb.sizeChars,
          status: 'queued',
          progress: 0,
        },
      });
    } catch (err: any) {
      if (!(err instanceof KbRequestError)) logger.error('KBController: failed to upload document', { error: String(err) });
      sendError(res, err, 'The document could not be added. Please try again.');
    }
  }

  /** POST /api/v2/knowledge-base/scrape — public web page → queued for indexing. */
  static async scrape(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = ownerOf(req);
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }

      const { url, agentId: rawAgentId } = req.body || {};
      if (typeof url !== 'string' || !url.trim() || url.length > 2000) {
        throw new KbRequestError(400, 'A valid url is required');
      }
      const agentId = await assertAgentOwned(rawAgentId, userId);
      const limits = await limitsFor(userId);
      checkRoom(limits, await workspaceUsage(userId), 0);
      if (agentId) await checkAgentAttachRoom(agentId, limits);

      const page = await fetchPublicPage(url.trim());
      let cleanText = page.body;
      if (!page.contentType.includes('text/plain')) {
        const { JSDOM } = await import('jsdom');
        const doc = new JSDOM(page.body).window.document;
        ['nav', 'footer', 'header', 'script', 'style', 'noscript', 'iframe', 'aside', '.nav', '.footer', '.header', '.sidebar', '.menu', '.ads', '#nav', '#footer', '#sidebar']
          .forEach((sel) => doc.querySelectorAll(sel).forEach((el) => el.remove()));
        cleanText = doc.body?.textContent || '';
      }
      cleanText = cleanText.replace(/\s+/g, ' ').trim();
      if (!cleanText) throw new KbRequestError(400, 'Website does not contain any readable text.');
      if (cleanText.length > KB_MAX_DOCUMENT_CHARS) cleanText = cleanText.slice(0, KB_MAX_DOCUMENT_CHARS);

      const kb = await createDocument(userId, page.finalUrl.slice(0, 500), cleanText, agentId, limits);
      await KnowledgeBaseService.enqueueIngestion(kb.id, userId);

      res.status(202).json({
        success: true,
        data: {
          id: kb.id,
          name: kb.name,
          agentId: agentId || '',
          agentIds: agentId ? [agentId] : [],
          createdAt: kb.createdAt,
          sizeChars: kb.sizeChars,
          status: 'queued',
          progress: 0,
        },
      });
    } catch (err: any) {
      if (!(err instanceof KbRequestError)) logger.error('KBController: failed to scrape URL', { error: String(err) });
      sendError(res, err, 'The web page could not be added. Please try again.');
    }
  }

  /** GET /api/v2/knowledge-base — documents with status, progress and errors (newest first). */
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = ownerOf(req);
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }

      const list = await prisma.knowledgeBase.findMany({
        where: { userId },
        select: {
          id: true, name: true, createdAt: true, sizeChars: true, status: true, progress: true, errorMessage: true,
          agentLinks: { select: { agentId: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 1000, // the largest plan allows 1,000 documents
      });

      res.json({
        success: true,
        data: list.map((item) => {
          const agentIds = item.agentLinks.map((link) => link.agentId);
          return {
            id: item.id,
            name: item.name,
            agentId: agentIds[0] || '',
            agentIds,
            createdAt: item.createdAt,
            sizeChars: item.sizeChars,
            status: item.status || 'ready',
            progress: item.progress ?? 100,
            errorMessage: item.errorMessage,
          };
        }),
      });
    } catch (err) {
      logger.error('KBController: failed to list documents', { error: String(err) });
      next(err);
    }
  }

  /** POST /api/v2/knowledge-base/:id/reindex */
  static async reindex(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = ownerOf(req);
      const id = req.params.id as string;
      if (!userId || !id) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
      const kb = await prisma.knowledgeBase.findFirst({ where: { id, userId }, select: { id: true } });
      if (!kb) throw new KbRequestError(404, 'Document not found');
      await KnowledgeBaseService.enqueueIngestion(id, userId);
      res.json({ success: true, message: 'Re-indexing queued.', id });
    } catch (err: any) {
      if (!(err instanceof KbRequestError)) logger.error('KBController: re-indexing failed', { error: String(err) });
      sendError(res, err, 'Re-indexing could not be started. Please try again.');
    }
  }

  /**
   * POST /api/v2/knowledge-base/test-query — Retrieval Inspector. Runs the same search live calls
   * use and returns the chunks a call would get (with scores and sources), plus the best near-misses
   * the relevance gate keeps away from calls.
   */
  static async testQuery(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = ownerOf(req);
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
      const { agentId, kbId, query } = req.body || {};
      if (typeof query !== 'string' || !query.trim()) throw new KbRequestError(400, 'Query text is required');
      if (query.length > KB_MAX_QUERY_CHARS) throw new KbRequestError(400, `Keep the test question under ${KB_MAX_QUERY_CHARS} characters.`);
      if (agentId !== undefined && agentId !== null && typeof agentId !== 'string') throw new KbRequestError(400, 'Invalid agent.');
      if (kbId !== undefined && kbId !== null && typeof kbId !== 'string') throw new KbRequestError(400, 'Invalid document.');

      const docCount = await prisma.knowledgeBase.count({ where: { userId } });
      if (docCount === 0) {
        res.json({
          success: true,
          data: {
            query, queryRewritten: query, chunksCount: 0, latencyMs: 0, embeddingMs: 0, dbQueryMs: 0, chunks: [], nearMisses: [],
            message: 'No documents uploaded or indexed yet in your workspace. Please upload a document to enable AI retrieval.',
          },
        });
        return;
      }
      if (agentId) await assertAgentOwned(agentId, userId);
      if (kbId) {
        const kb = await prisma.knowledgeBase.findFirst({ where: { id: kbId, userId }, select: { status: true } });
        if (!kb) throw new KbRequestError(404, 'Knowledge base document not found in your workspace');
        if (kb.status && kb.status !== 'ready') {
          throw new KbRequestError(409, kb.status === 'failed'
            ? 'This document failed to index. Re-index it, then test again.'
            : 'This document is still being indexed. Test again when it shows Ready.', 'KB_NOT_READY');
        }
      }

      const searchResult = await HybridSearchService.search({
        agentId: kbId ? undefined : agentId || undefined,
        kbId: kbId || undefined,
        workspaceId: userId,
        query: query.trim(),
        topK: 5,
        includeRejected: true,
      });

      const shape = (r: any) => ({
        id: r.id,
        source: r.source,
        section: r.section,
        page: r.page,
        score: Number(r.score.toFixed(4)),
        similarity: r.similarity != null ? Number(r.similarity.toFixed(3)) : undefined,
        matchType: r.matchType,
        usedOnCalls: r.usedOnCalls !== false,
        content: r.content,
      });

      res.json({
        success: true,
        data: {
          query,
          queryRewritten: searchResult.queryRewritten,
          chunksCount: searchResult.results.length,
          latencyMs: searchResult.latencyMs,
          embeddingMs: searchResult.embeddingMs,
          dbQueryMs: searchResult.dbQueryMs,
          chunks: searchResult.results.map(shape),
          nearMisses: (searchResult.rejected || []).map(shape),
        },
      });
    } catch (err: any) {
      if (err instanceof KbSearchTimeoutError) {
        res.status(504).json({ success: false, error: 'The search took too long. Please try again.', code: 'KB_SEARCH_TIMEOUT' });
        return;
      }
      if (err instanceof EmbeddingUnavailableError) {
        res.status(503).json({ success: false, error: err.message, code: 'KB_SEARCH_UNAVAILABLE' });
        return;
      }
      if (!(err instanceof KbRequestError)) logger.error('KBController: testQuery failed', { error: String(err?.message || err) });
      sendError(res, err, 'The search could not be run. Please try again.');
    }
  }

  /** DELETE /api/v2/knowledge-base/:id — document, its chunks and agent links, in one transaction. */
  static async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = ownerOf(req);
      const id = req.params.id as string;
      if (!userId || !id) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }

      const deleted = await prisma.$transaction(async (tx) => {
        const kb = await tx.knowledgeBase.findFirst({ where: { id, userId }, select: { id: true } });
        if (!kb) return false;
        await tx.agentKnowledgeBase.deleteMany({ where: { kbId: id } });
        await tx.$executeRawUnsafe('DELETE FROM "kb_chunks" WHERE "kb_id" = $1', id);
        await tx.knowledgeBase.deleteMany({ where: { id, userId } });
        return true;
      });
      if (!deleted) { res.status(404).json({ success: false, error: 'Document not found' }); return; }
      res.json({ success: true });
    } catch (err) {
      logger.error('KBController: failed to delete document', { error: String(err) });
      next(err);
    }
  }

  /** POST /api/v2/knowledge-base/:id/assign */
  static async assignToAgent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = ownerOf(req);
      const kbId = req.params.id as string;
      const { agentId } = req.body || {};
      if (!userId || !kbId || typeof agentId !== 'string' || !agentId) {
        res.status(400).json({ success: false, error: 'Unauthorized or missing required parameters' });
        return;
      }
      const kb = await prisma.knowledgeBase.findFirst({ where: { id: kbId, userId }, select: { id: true } });
      if (!kb) { res.status(404).json({ success: false, error: 'Document not found' }); return; }
      const agent = await prisma.agent.findFirst({ where: { id: agentId, userId }, select: { id: true } });
      if (!agent) { res.status(404).json({ success: false, error: 'Agent not found' }); return; }

      const limits = await limitsFor(userId);
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `kb:${userId}`);
        const already = await tx.agentKnowledgeBase.findUnique({ where: { agentId_kbId: { agentId, kbId } } });
        if (already) return;
        await checkAgentAttachRoom(agentId, limits, tx);
        await tx.agentKnowledgeBase.create({ data: { agentId, kbId } });
      });
      res.json({ success: true });
    } catch (err: any) {
      if (err instanceof KbRequestError) { sendError(res, err, ''); return; }
      logger.error('KBController: failed to assign to agent', { error: String(err) });
      next(err);
    }
  }

  /** POST /api/v2/knowledge-base/:id/unassign */
  static async unassignFromAgent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = ownerOf(req);
      const kbId = req.params.id as string;
      const { agentId } = req.body || {};
      if (!userId || !kbId || typeof agentId !== 'string' || !agentId) {
        res.status(400).json({ success: false, error: 'Unauthorized or missing required parameters' });
        return;
      }
      const kb = await prisma.knowledgeBase.findFirst({ where: { id: kbId, userId }, select: { id: true } });
      if (!kb) { res.status(404).json({ success: false, error: 'Document not found' }); return; }
      await prisma.agentKnowledgeBase.deleteMany({ where: { kbId, agentId } });
      res.json({ success: true });
    } catch (err) {
      logger.error('KBController: failed to unassign from agent', { error: String(err) });
      next(err);
    }
  }

  /** POST /api/v2/knowledge-base/:id/update-agents */
  static async updateAgentAssignments(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = ownerOf(req);
      const kbId = req.params.id as string;
      const { agentIds } = req.body || {};
      if (!userId || !kbId || !Array.isArray(agentIds) || agentIds.length > 200 || agentIds.some((a: unknown) => typeof a !== 'string')) {
        res.status(400).json({ success: false, error: 'Unauthorized or missing agentIds array' });
        return;
      }
      const uniqueIds = Array.from(new Set(agentIds as string[]));
      const kb = await prisma.knowledgeBase.findFirst({ where: { id: kbId, userId }, select: { id: true } });
      if (!kb) { res.status(404).json({ success: false, error: 'Document not found' }); return; }
      const validAgents = await prisma.agent.findMany({ where: { id: { in: uniqueIds }, userId, status: { not: 'archived' } }, select: { id: true } });
      if (validAgents.length !== uniqueIds.length) {
        res.status(400).json({ success: false, error: 'One or more agent IDs are invalid or unauthorized' });
        return;
      }
      const limits = await limitsFor(userId);
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `kb:${userId}`);
        for (const agentId of uniqueIds) await checkAgentAttachRoom(agentId, limits, tx, kbId);
        await tx.agentKnowledgeBase.deleteMany({ where: { kbId } });
        if (uniqueIds.length > 0) {
          await tx.agentKnowledgeBase.createMany({ data: uniqueIds.map((agentId) => ({ agentId, kbId })) });
        }
      });
      res.json({ success: true });
    } catch (err: any) {
      if (err instanceof KbRequestError) { sendError(res, err, ''); return; }
      logger.error('KBController: failed to update agent assignments', { error: String(err) });
      next(err);
    }
  }
}
