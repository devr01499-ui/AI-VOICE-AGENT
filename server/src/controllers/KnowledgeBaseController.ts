import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

export class KnowledgeBaseController {
  
  /**
   * POST /api/v2/knowledge-base/upload
   * 
   * Uploads base64-encoded document, decodes it, and stores it in KnowledgeBase table.
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

      // Decode and restrict storage size to prevent database bloat (limit to 500KB)
      const rawText = Buffer.from(fileBase64, 'base64').toString('utf8');
      const contentText = rawText.slice(0, 500000); // Truncate at 500K chars

      const kb = await prisma.knowledgeBase.create({
        data: {
          name,
          contentText,
          agentId,
          userId,
        }
      });

      res.status(201).json({
        success: true,
        data: {
          id: kb.id,
          name: kb.name,
          agentId: kb.agentId,
          createdAt: kb.createdAt,
          sizeChars: kb.contentText.length,
        }
      });
    } catch (err) {
      logger.error('KBController: failed to upload document', { error: String(err) });
      next(err);
    }
  }

  /**
   * POST /api/v2/knowledge-base/scrape
   * 
   * Fetches URL, strips HTML tags down to clean text strings, and stores in KnowledgeBase.
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

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'ClarityVoiceBot/1.0',
        }
      });

      if (!response.ok) {
        res.status(502).json({ success: false, error: `Failed to scrape target: HTTP ${response.status}` });
        return;
      }

      const html = await response.text();
      
      // Simple HTML Tag Stripper
      const cleanText = html
        .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '') // remove script contents
        .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')   // remove style contents
        .replace(/<[^>]*>/g, ' ')                           // strip html tags
        .replace(/\s+/g, ' ')                               // normalize whitespace
        .trim();

      const contentText = cleanText.slice(0, 500000); // Truncate at 500K chars to prevent bloat

      const kb = await prisma.knowledgeBase.create({
        data: {
          name: url,
          contentText,
          agentId,
          userId,
        }
      });

      res.status(201).json({
        success: true,
        data: {
          id: kb.id,
          name: kb.name,
          agentId: kb.agentId,
          createdAt: kb.createdAt,
          sizeChars: kb.contentText.length,
        }
      });
    } catch (err) {
      logger.error('KBController: failed to scrape URL', { error: String(err) });
      next(err);
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
