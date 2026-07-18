import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { JSDOM } from 'jsdom';
import { extractTextFromPdf } from '../utils/pdfParser';
import { getEmbedding } from '../utils/embedding';

function chunkText(text: string, chunkSize = 1000, overlap = 150): string[] {
  const chunks: string[] = [];
  let index = 0;
  while (index < text.length) {
    const chunk = text.slice(index, index + chunkSize);
    chunks.push(chunk);
    index += chunkSize - overlap;
    if (chunkSize <= overlap) break;
  }
  return chunks;
}

export class KnowledgeBaseController {
  
  /**
   * POST /api/v2/knowledge-base/upload
   * 
   * Uploads base64-encoded document, parses PDF or text, chunks/embeds, and stores in KnowledgeBase.
   */
  static async upload(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
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
        contentText = await extractTextFromPdf(buffer);
      } else {
        contentText = buffer.toString('utf8');
      }

      if (!contentText.trim()) {
        res.status(400).json({ success: false, error: 'Document does not contain any readable text.' });
        return;
      }

      const truncatedContent = contentText.slice(0, 500000); // Truncate at 500K chars

      const kb = await prisma.knowledgeBase.create({
        data: {
          name,
          contentText: truncatedContent,
          userId,
        }
      });

      // Assign to agent if agentId is provided
      if (agentId) {
        await prisma.agentKnowledgeBase.create({
          data: {
            agentId,
            kbId: kb.id,
          }
        });
      }

      // Split text into chunks, generate embeddings, and insert into pgvector table
      const chunks = chunkText(truncatedContent);
      logger.info('KBController: Chunking uploaded document', {
        docName: name,
        chunksCount: chunks.length
      });

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await getEmbedding(chunk);
        const chunkId = uuidv4();
        
        await prisma.$executeRawUnsafe(
          `INSERT INTO "kb_chunks" ("id", "kb_id", "content", "embedding", "metadata", "created_at") VALUES ($1, $2, $3, cast($4 as vector), $5, NOW())`,
          chunkId,
          kb.id,
          chunk,
          `[${embedding.join(',')}]`,
          JSON.stringify({ source: name, index: i })
        );
      }

      res.status(201).json({
        success: true,
        data: {
          id: kb.id,
          name: kb.name,
          agentId: agentId || '',
          agentIds: agentId ? [agentId] : [],
          createdAt: kb.createdAt,
          sizeChars: kb.contentText.length,
          chunksCount: chunks.length,
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
   * Fetches URL, strips headers/footers/menus, chunks/embeds, and stores in KnowledgeBase.
   */
  static async scrape(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { url, agentId } = req.body;
      if (!url) {
        res.status(400).json({ success: false, error: 'url is required' });
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

      logger.info('KBController: scraping URL target', { url, agentId });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
      
      let response;
      try {
        response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'ClarityVoiceBot/1.0',
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
      
      // Boilerplate-free DOM extraction using JSDOM
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

      const truncatedContent = cleanText.slice(0, 500000); // Truncate at 500K chars

      const kb = await prisma.knowledgeBase.create({
        data: {
          name: url,
          contentText: truncatedContent,
          userId,
        }
      });

      // Assign to agent if agentId is provided
      if (agentId) {
        await prisma.agentKnowledgeBase.create({
          data: {
            agentId,
            kbId: kb.id,
          }
        });
      }

      // Split text into chunks, generate embeddings, and insert into pgvector table
      const chunks = chunkText(truncatedContent);
      logger.info('KBController: Chunking scraped website', {
        url,
        chunksCount: chunks.length
      });

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await getEmbedding(chunk);
        const chunkId = uuidv4();
        
        await prisma.$executeRawUnsafe(
          `INSERT INTO "kb_chunks" ("id", "kb_id", "content", "embedding", "metadata", "created_at") VALUES ($1, $2, $3, cast($4 as vector), $5, NOW())`,
          chunkId,
          kb.id,
          chunk,
          `[${embedding.join(',')}]`,
          JSON.stringify({ source: url, index: i })
        );
      }

      res.status(201).json({
        success: true,
        data: {
          id: kb.id,
          name: kb.name,
          agentId: agentId || '',
          agentIds: agentId ? [agentId] : [],
          createdAt: kb.createdAt,
          sizeChars: kb.contentText.length,
          chunksCount: chunks.length,
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
   * List all knowledge base documents for user
   */
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
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
          contentText: true,
          agentLinks: {
            select: {
              agentId: true
            }
          }
        }
      });

      const formatted = list.map(item => {
        const agentIds = item.agentLinks.map(link => link.agentId);
        return {
          id: item.id,
          name: item.name,
          agentId: agentIds[0] || '', // legacy single fallback
          agentIds,
          createdAt: item.createdAt,
          sizeChars: item.contentText.length,
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
   * DELETE /api/v2/knowledge-base/:id
   */
  static async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
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
   * 
   * Assigns a document to an agent.
   */
  static async assignToAgent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      const kbId = req.params.id as string;
      const { agentId } = req.body;

      if (!userId || !kbId || !agentId) {
        res.status(400).json({ success: false, error: 'Unauthorized or missing required parameters' });
        return;
      }

      // Verify document belongs to user
      const kb = await prisma.knowledgeBase.findFirst({
        where: { id: kbId, userId }
      });
      if (!kb) {
        res.status(404).json({ success: false, error: 'Document not found' });
        return;
      }

      // Verify agent belongs to user
      const agent = await prisma.agent.findFirst({
        where: { id: agentId, userId }
      });
      if (!agent) {
        res.status(404).json({ success: false, error: 'Agent not found' });
        return;
      }

      // Create relation link using upsert to avoid duplicate key violations
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
        update: {} // No-op if link already exists
      });

      res.json({ success: true });
    } catch (err) {
      logger.error('KBController: failed to assign to agent', { error: String(err) });
      next(err);
    }
  }

  /**
   * POST /api/v2/knowledge-base/:id/unassign
   * 
   * Removes assignment from a specific agent.
   */
  static async unassignFromAgent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      const kbId = req.params.id as string;
      const { agentId } = req.body;

      if (!userId || !kbId || !agentId) {
        res.status(400).json({ success: false, error: 'Unauthorized or missing required parameters' });
        return;
      }

      // Verify document belongs to user
      const kb = await prisma.knowledgeBase.findFirst({
        where: { id: kbId, userId }
      });
      if (!kb) {
        res.status(404).json({ success: false, error: 'Document not found' });
        return;
      }

      // Delete join-table link row
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
   * 
   * Replaces the set of assigned agents for a document.
   */
  static async updateAgentAssignments(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      const kbId = req.params.id as string;
      const { agentIds } = req.body;

      if (!userId || !kbId || !Array.isArray(agentIds)) {
        res.status(400).json({ success: false, error: 'Unauthorized or missing agentIds array' });
        return;
      }

      // Verify document belongs to user
      const kb = await prisma.knowledgeBase.findFirst({
        where: { id: kbId, userId }
      });
      if (!kb) {
        res.status(404).json({ success: false, error: 'Document not found' });
        return;
      }

      // Verify all specified agents belong to user
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

      // Atomically rebuild links in a transaction
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
