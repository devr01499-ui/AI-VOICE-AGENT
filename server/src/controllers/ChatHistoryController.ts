/**
 * Chat History Controller
 *
 * Provides paginated, filtered access to text-based conversations (SMS logs & web chat)
 * scoped by user ID.
 */

import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

export class ChatHistoryController {
  static async listChatMessages(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { agentId, phoneNumber, startDate, endDate, page = '1', limit = '20' } = req.query;

      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
      const skip = (pageNum - 1) * limitNum;

      const whereClause: any = { userId };

      if (agentId && typeof agentId === 'string') {
        whereClause.agentId = agentId;
      }

      if (phoneNumber && typeof phoneNumber === 'string') {
        whereClause.phoneNumber = { contains: phoneNumber };
      }

      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate && typeof startDate === 'string') {
          whereClause.createdAt.gte = new Date(startDate);
        }
        if (endDate && typeof endDate === 'string') {
          whereClause.createdAt.lte = new Date(endDate);
        }
      }

      const [messages, total] = await Promise.all([
        prisma.chatMessage.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum,
          include: {
            agent: {
              select: { id: true, name: true },
            },
          },
        }),
        prisma.chatMessage.count({ where: whereClause }),
      ]);

      res.json({
        success: true,
        data: messages,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      });
    } catch (err: any) {
      logger.error('ChatHistoryController: Error fetching chat history', { error: err.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  static async logMessage(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { agentId, callId, phoneNumber, direction = 'outbound', body, status = 'delivered', metadata } = req.body;

      if (!phoneNumber || !body) {
        res.status(400).json({ success: false, error: 'phoneNumber and body are required' });
        return;
      }

      const message = await prisma.chatMessage.create({
        data: {
          userId,
          agentId: agentId || null,
          callId: callId || null,
          phoneNumber,
          direction,
          body,
          status,
          metadata: metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : '{}',
        },
      });

      res.status(201).json({ success: true, data: message });
    } catch (err: any) {
      logger.error('ChatHistoryController: Error logging chat message', { error: err.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}
