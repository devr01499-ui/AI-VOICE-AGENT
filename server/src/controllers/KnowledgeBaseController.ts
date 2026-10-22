import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { KnowledgeBaseService } from '../services/KnowledgeBaseService';
import { HybridSearchService } from '../services/HybridSearchService';

export class KnowledgeBaseController {
  
  /**
   * POST /api/v2/knowledge-base/upload
   * 
   * Uploads base64-encoded document, parses PDF or text, and triggers asynchronous background ingestion.
   */
  static async upload(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).effectiveWorkspaceId || req.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { name, agentId, fileBase64 } = req.body;
      if (!name || !fileBase64) {
        res.status(400).json({ success: false, error: 'name and fileBase64 are required' });
        return;
      }

      // Check agent exists and belongs to user if agentId is provided
      if (agentId) {
        const agent = await prisma.agent.findFirst({
          where: { id: agentId, userId }
        });
        if (!agent) {
          res.status(404).json({ success: false, error: 'Agent not found in your workspace' });
          return;
        }
      }

      const buffer = Buffer.from(fileBase64, 'base64');
      let contentText = '';

      if (name.toLowerCase().endsWith('.pdf')) {
        const { extractTextFromPdf } = await import('../utils/pdfParser');
        contentText = await extractTextFromPdf(buffer);
      } else {
        contentText = buffer.toString('utf8');
      }

      if (!contentText.trim()) {
        res.status(400).json({ success: false, error: 'Document does not contain any readable text.' });
        return;
      }

      // Hard ceiling: 2,000,000 characters (~500 pages). Warn if above 500,000 chars.
      const MAX_DOCUMENT_CHARS = 2000000;
      if (contentText.length > MAX_DOCUMENT_CHARS) {
        res.status(400).json({
          success: false,
          error: `Document exceeds maximum allowable size of ${MAX_DOCUMENT_CHARS.toLocaleString()} characters (uploaded: ${contentText.length.toLocaleString()} characters). Please split into smaller documents.`
        });
        return;
      }

      if (contentText.length > 500000) {
        logger.warn('KBController: Large document upload initiated (>500K chars)', {
          docName: name,
          sizeChars: contentText.length,
          userId,
        });
      }

      // 1. Create KnowledgeBase in 'processing' status
      const kb = await prisma.knowledgeBase.create({
        data: {
          name,
          contentText,
          sizeChars: contentText.length,
          status: 'processing',
          progress: 0,
          userId,
        }
      });

      // 2. Assign to agent if agentId provided
      if (agentId) {
        await prisma.agentKnowledgeBase.create({
          data: {
            agentId,
            kbId: kb.id,
          }
        });
      }

      // 3. Kick off async ingestion in background (non-blocking)
      KnowledgeBaseService.ingestDocumentAsync(kb.id, contentText, name, userId).catch(err => {
        logger.error('KBController: Background ingestion error', { kbId: kb.id, error: err.message });
      });

      res.status(202).json({
        success: true,
        data: {
          id: kb.id,
          name: kb.name,
          agentId: agentId || '',
          agentIds: agentId ? [agentId] : [],
          createdAt: kb.createdAt,
          sizeChars: kb.contentText.length,
          status: 'processing',
          progress: 0,
          warning: contentText.length > 500000 ? 'Large document: ingestion is processing in background.' : undefined,
        }
      });
    } catch (err: any) {
      logger.error('KBController: failed to upload document', { error: String(err) });
      res.status(400).json({ success: false, error: err.message || 'Failed to process document upload' });
    }
  }

  /**
   * POST /api/v2/knowledge-base/scrape
   * 
   * Fetches URL, strips headers/footers/menus, and triggers asynchronous background ingestion.
   */
  static async scrape(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).effectiveWorkspaceId || req.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { url, agentId } = req.body;
      if (!url) {
        res.status(400).json({ success: false, error: 'url is required' });
        return;
      }

      // OWASP A10: Server-Side Request Forgery (SSRF) Defense
      const { assertSafeUrl } = await import('../utils/ssrfValidator');
      let safeTargetUrl: URL;
      try {
        safeTargetUrl = await assertSafeUrl(url);
      } catch (ssrfErr: any) {
        logger.warn('KBController: Blocked SSRF attempt during scrape', { url, error: ssrfErr.message });
        res.status(400).json({ success: false, error: `Invalid target URL: ${ssrfErr.message}` });
        return;
      }

      if (agentId) {
        const agent = await prisma.agent.findFirst({
          where: { id: agentId, userId }
        });
        if (!agent) {
          res.status(404).json({ success: false, error: 'Agent not found in your workspace' });
          return;
        }
      }

      logger.info('KBController: scraping URL target', { url: safeTargetUrl.toString(), agentId });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
      
      let response;
      try {
        response = await fetch(safeTargetUrl.toString(), {
          signal: controller.signal,
          headers: {
            'User-Agent': 'ClaritiyVoiceBot/1.0',
          }
        });
      } catch (fetchErr: any) {
        if (fetchErr.name === 'AbortError') {
          res.status(504).json({ success: false, error: 'Scraping target request timed out after 15 seconds' });
        } else {
          res.status(502).json({ success: false, error: `Failed to fetch target URL: ${fetchErr.message}` });
        }
        return;
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        res.status(502).json({ success: false, error: `Failed to scrape target: HTTP ${response.status}` });
        return;
      }

      const html = await response.text();
      
      const { JSDOM } = await import('jsdom');
      const dom = new JSDOM(html);
      const doc = dom.window.document;
      
      const selectorsToRemove = [
        'nav', 'footer', 'header', 'script', 'style', 'noscript', 'iframe', 
        'aside', '.nav', '.footer', '.header', '.sidebar', '.menu', '.ads', 
        '#nav', '#footer', '#sidebar'
      ];
      selectorsToRemove.forEach(sel => {
        doc.querySelectorAll(sel).forEach(el => el.remove());
      });
      
      const cleanText = doc.body.textContent?.replace(/\s+/g, ' ').trim() || '';
      
      if (!cleanText.trim()) {
        res.status(400).json({ success: false, error: 'Website does not contain any readable text.' });
        return;
      }

      const kb = await prisma.knowledgeBase.create({
        data: {
          name: url,
          contentText: cleanText,
          sizeChars: cleanText.length,
          status: 'processing',
          progress: 0,
          userId,
        }
      });

      if (agentId) {
        await prisma.agentKnowledgeBase.create({
          data: {
            agentId,
            kbId: kb.id,
          }
        });
      }

      KnowledgeBaseService.ingestDocumentAsync(kb.id, cleanText, url, userId).catch(err => {
        logger.error('KBController: Background scrape ingestion error', { kbId: kb.id, error: err.message });
      });

      res.status(202).json({
        success: true,
        data: {
          id: kb.id,
          name: kb.name,
          agentId: agentId || '',
          agentIds: agentId ? [agentId] : [],
          createdAt: kb.createdAt,
          sizeChars: kb.contentText.length,
          status: 'processing',
          progress: 0,
        }
      });
    } catch (err: any) {
      logger.error('KBController: failed to scrape URL', { error: String(err) });
      res.status(400).json({ success: false, error: err.message || 'Failed to scrape target URL' });
    }
  }

  /**
   * GET /api/v2/knowledge-base
   * 
   * List all knowledge base documents for user with status, progress, and error details.
   */
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).effectiveWorkspaceId || req.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const list = await prisma.knowledgeBase.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          createdAt: true,
          sizeChars: true,
          status: true,
          progress: true,
          errorMessage: true,
          agentLinks: {
            select: {
              agentId: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const formatted = list.map(item => {
        const agentIds = item.agentLinks.map(link => link.agentId);
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
      });

      res.json({
        success: true,
        data: formatted,
      });
    } catch (err) {
      logger.error('KBController: failed to list documents', { error: String(err) });
      next(err);
    }
  }

  /**
   * POST /api/v2/knowledge-base/:id/reindex
   * 
   * Re-indexes an existing document using structure-aware chunking and batch embeddings.
   */
  static async reindex(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).effectiveWorkspaceId || req.userId;
      const id = req.params.id as string;
      if (!userId || !id) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      await KnowledgeBaseService.reindexDocument(id, userId);

      res.json({
        success: true,
        message: 'Re-indexing job initiated in background.',
        id,
      });
    } catch (err: any) {
      logger.error('KBController: re-indexing failed', { error: err.message });
      res.status(400).json({ success: false, error: err.message || 'Failed to re-index document' });
    }
  }

  /**
   * POST /api/v2/knowledge-base/test-query
   * 
   * Dashboard testing tool: allows running a query against an agent or KB to inspect retrieved chunks and latency.
   */
  static async testQuery(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).effectiveWorkspaceId || req.userId;
      const { agentId, kbId, query } = req.body;

      if (!userId || (!agentId && !kbId) || !query) {
        res.status(400).json({ success: false, error: 'query and either agentId or kbId are required' });
        return;
      }

      if (agentId) {
        // Verify agent belongs to user
        const agent = await prisma.agent.findFirst({
          where: { id: agentId, userId }
        });
        if (!agent) {
          res.status(404).json({ success: false, error: 'Agent not found in your workspace' });
          return;
        }
      }

      if (kbId) {
        // Verify kb belongs to user
        const kb = await prisma.knowledgeBase.findFirst({
          where: { id: kbId, userId }
        });
        if (!kb) {
          res.status(404).json({ success: false, error: 'Knowledge base document not found in your workspace' });
          return;
        }
      }

      const searchResult = await HybridSearchService.search({
        agentId: agentId || undefined,
        kbId: kbId || undefined,
        query,
        topK: 5,
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
          chunks: searchResult.results.map(r => ({
            id: r.id,
            source: r.source,
            section: r.section,
            page: r.page,
            score: Number(r.score.toFixed(4)),
            matchType: r.matchType,
            content: r.content,
          }))
        }
      });
    } catch (err: any) {
      logger.error('KBController: testQuery failed', { error: err.message });
      res.status(400).json({ success: false, error: err.message || 'Search execution failed' });
    }
  }

  /**
   * DELETE /api/v2/knowledge-base/:id
   */
  static async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).effectiveWorkspaceId || req.userId;
      const id = req.params.id as string;
      if (!userId || !id) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const kb = await prisma.knowledgeBase.findFirst({
        where: { id, userId }
      });

      if (!kb) {
        res.status(404).json({ success: false, error: 'Document not found' });
        return;
      }

      await prisma.agentKnowledgeBase.deleteMany({
        where: { kbId: id }
      });

      try {
        await prisma.$executeRaw`DELETE FROM "kb_chunks" WHERE "kb_id" = ${id}`;
      } catch (chunkErr) {
        logger.warn('KBController: delete chunks warning', { error: String(chunkErr) });
      }

      await prisma.knowledgeBase.delete({
        where: { id }
      });

      res.json({ success: true });
    } catch (err) {
      logger.error('KBController: failed to delete document', { error: String(err) });
      next(err);
    }
  }

  /**
   * POST /api/v2/knowledge-base/:id/assign
   */
  static async assignToAgent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).effectiveWorkspaceId || req.userId;
      const kbId = req.params.id as string;
      const { agentId } = req.body;

      if (!userId || !kbId || !agentId) {
        res.status(400).json({ success: false, error: 'Unauthorized or missing required parameters' });
        return;
      }

      const kb = await prisma.knowledgeBase.findFirst({
        where: { id: kbId, userId }
      });
      if (!kb) {
        res.status(404).json({ success: false, error: 'Document not found' });
        return;
      }

      const agent = await prisma.agent.findFirst({
        where: { id: agentId, userId }
      });
      if (!agent) {
        res.status(404).json({ success: false, error: 'Agent not found' });
        return;
      }

      await prisma.agentKnowledgeBase.upsert({
        where: {
          agentId_kbId: {
            agentId,
            kbId
          }
        },
        create: {
          agentId,
          kbId
        },
        update: {}
      });

      res.json({ success: true });
    } catch (err) {
      logger.error('KBController: failed to assign to agent', { error: String(err) });
      next(err);
    }
  }

  /**
   * POST /api/v2/knowledge-base/:id/unassign
   */
  static async unassignFromAgent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).effectiveWorkspaceId || req.userId;
      const kbId = req.params.id as string;
      const { agentId } = req.body;

      if (!userId || !kbId || !agentId) {
        res.status(400).json({ success: false, error: 'Unauthorized or missing required parameters' });
        return;
      }

      const kb = await prisma.knowledgeBase.findFirst({
        where: { id: kbId, userId }
      });
      if (!kb) {
        res.status(404).json({ success: false, error: 'Document not found' });
        return;
      }

      await prisma.agentKnowledgeBase.deleteMany({
        where: {
          kbId,
          agentId
        }
      });

      res.json({ success: true });
    } catch (err) {
      logger.error('KBController: failed to unassign from agent', { error: String(err) });
      next(err);
    }
  }

  /**
   * POST /api/v2/knowledge-base/:id/update-agents
   */
  static async updateAgentAssignments(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).effectiveWorkspaceId || req.userId;
      const kbId = req.params.id as string;
      const { agentIds } = req.body;

      if (!userId || !kbId || !Array.isArray(agentIds)) {
        res.status(400).json({ success: false, error: 'Unauthorized or missing agentIds array' });
        return;
      }

      const kb = await prisma.knowledgeBase.findFirst({
        where: { id: kbId, userId }
      });
      if (!kb) {
        res.status(404).json({ success: false, error: 'Document not found' });
        return;
      }

      const validAgents = await prisma.agent.findMany({
        where: {
          id: { in: agentIds },
          userId
        },
        select: { id: true }
      });

      if (validAgents.length !== agentIds.length) {
        res.status(400).json({ success: false, error: 'One or more agent IDs are invalid or unauthorized' });
        return;
      }

      await prisma.$transaction(async (tx) => {
        await tx.agentKnowledgeBase.deleteMany({
          where: { kbId }
        });
        for (const agentId of agentIds) {
          await tx.agentKnowledgeBase.create({
            data: { agentId, kbId }
          });
        }
      });

      res.json({ success: true });
    } catch (err) {
      logger.error('KBController: failed to update agent assignments', { error: String(err) });
      next(err);
    }
  }
}
