/**
 * Contacts Controller (CRM-Lite)
 *
 * Provides CRUD access for contacts and automatic contact creation on call events.
 */

import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

export class ContactsController {
  /**
   * Helper utility to auto-upsert contacts whenever a call starts or ends.
   */
  static async upsertContactOnCall(userId: string, phoneNumber: string, name?: string): Promise<void> {
    if (!userId || !phoneNumber) return;
    try {
      await prisma.contact.upsert({
        where: {
          userId_phoneNumber: {
            userId,
            phoneNumber,
          },
        },
        update: {
          lastContactedAt: new Date(),
          ...(name ? { name } : {}),
        },
        create: {
          userId,
          phoneNumber,
          name: name || null,
          lastContactedAt: new Date(),
        },
      });
    } catch (err: any) {
      logger.warn('ContactsController: Failed to auto-upsert contact on call', { error: err.message, userId, phoneNumber });
    }
  }

  static async listContacts(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { search, page = '1', limit = '50' } = req.query;
      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 50));
      const skip = (pageNum - 1) * limitNum;

      const whereClause: any = { userId };

      if (search && typeof search === 'string' && search.trim().length > 0) {
        const query = search.trim();
        whereClause.OR = [
          { phoneNumber: { contains: query } },
          { name: { contains: query } },
          { notes: { contains: query } },
        ];
      }

      const [contacts, total] = await Promise.all([
        prisma.contact.findMany({
          where: whereClause,
          orderBy: { lastContactedAt: 'desc' },
          skip,
          take: limitNum,
        }),
        prisma.contact.count({ where: whereClause }),
      ]);

      res.json({
        success: true,
        data: contacts,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      });
    } catch (err: any) {
      logger.error('ContactsController: Error listing contacts', { error: err.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  static async createContact(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { phoneNumber, name, tags, notes } = req.body;
      if (!phoneNumber) {
        res.status(400).json({ success: false, error: 'phoneNumber is required' });
        return;
      }

      const formattedTags = Array.isArray(tags) ? JSON.stringify(tags) : (typeof tags === 'string' ? tags : '[]');

      const contact = await prisma.contact.upsert({
        where: {
          userId_phoneNumber: {
            userId,
            phoneNumber,
          },
        },
        update: {
          name: name || undefined,
          tags: formattedTags,
          notes: notes || undefined,
        },
        create: {
          userId,
          phoneNumber,
          name: name || null,
          tags: formattedTags,
          notes: notes || null,
        },
      });

      res.status(201).json({ success: true, data: contact });
    } catch (err: any) {
      logger.error('ContactsController: Error creating contact', { error: err.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  static async updateContact(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const contactId = String(req.params.id);
      const userIdStr = String(userId);
      const { name, tags, notes, phoneNumber } = req.body;

      const existing = await prisma.contact.findFirst({
        where: { id: contactId, userId: userIdStr },
      });

      if (!existing) {
        res.status(404).json({ success: false, error: 'Contact not found' });
        return;
      }

      const formattedTags = tags !== undefined
        ? (Array.isArray(tags) ? JSON.stringify(tags) : (typeof tags === 'string' ? tags : '[]'))
        : undefined;

      const updated = await prisma.contact.update({
        where: { id: contactId },
        data: {
          ...(name !== undefined && { name: String(name) }),
          ...(phoneNumber !== undefined && { phoneNumber: String(phoneNumber) }),
          ...(formattedTags !== undefined && { tags: formattedTags }),
          ...(notes !== undefined && { notes: String(notes) }),
        },
      });

      res.json({ success: true, data: updated });
    } catch (err: any) {
      logger.error('ContactsController: Error updating contact', { error: err.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  static async deleteContact(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const contactId = String(req.params.id);
      const userIdStr = String(userId);

      const existing = await prisma.contact.findFirst({
        where: { id: contactId, userId: userIdStr },
      });

      if (!existing) {
        res.status(404).json({ success: false, error: 'Contact not found' });
        return;
      }

      await prisma.contact.delete({
        where: { id: contactId },
      });

      res.json({ success: true, message: 'Contact deleted successfully' });
    } catch (err: any) {
      logger.error('ContactsController: Error deleting contact', { error: err.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}
