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
      if (!name || !agentId || !fileBase64) {
        res.status(400).json({ success: false, error: 'name, agentId, and fileBase64 are required' });
        return;
      }

      // Check agent exists and belongs to user
      const agent = await prisma.agent.findFirst({
        where: { id: agentId, userId }
      });
      if (!agent) {
        res.status(404).json({ success: false, error: 'Agent not found in your workspace' });
        return;
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
          agentId,
          userId,
        }
      });

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
          agentId: kb.agentId,
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
      if (!url || !agentId) {
        res.status(400).json({ success: false, error: 'url and agentId are required' });
        return;
      }

      // Check agent exists and belongs to user
      const agent = await prisma.agent.findFirst({
        where: { id: agentId, userId }
      });
      if (!agent) {
        res.status(404).json({ success: false, error: 'Agent not found in your workspace' });
        return;
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
          agentId,
          userId,
        }
      });

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
          agentId: kb.agentId,
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
          agentId: true,
          createdAt: true,
          contentText: true,
        }
      });

      const formatted = list.map(item => ({
        id: item.id,
        name: item.name,
        agentId: item.agentId,
        createdAt: item.createdAt,
        sizeChars: item.contentText.length,
      }));

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
}
