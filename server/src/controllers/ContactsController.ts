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
      const userId = (req as any).effectiveWorkspaceId || (req as any).user?.id || (req as any).user?.userId || (req as any).userId;
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

      const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      const enrichedContacts = contacts.map((c) => {
        const consentAgeMs = c.consentDate ? now - new Date(c.consentDate).getTime() : null;
        const isConsentExpired = consentAgeMs !== null && consentAgeMs > SIX_MONTHS_MS;
        const requiresReconsent = !c.consentDate || isConsentExpired;
        return {
          ...c,
          isOptedOut: Boolean(c.optedOutAt),
          isConsentExpired,
          requiresReconsent,
        };
      });

      res.json({
        success: true,
        data: enrichedContacts,
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
      const userId = (req as any).effectiveWorkspaceId || (req as any).user?.id || (req as any).user?.userId || (req as any).userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const {
        phoneNumber,
        name,
        tags,
        notes,
        consentDate,
        consentChannel,
        consentWording,
        optedOut,
        optOutReason
      } = req.body;

      if (!phoneNumber) {
        res.status(400).json({ success: false, error: 'phoneNumber is required' });
        return;
      }

      const formattedTags = Array.isArray(tags) ? JSON.stringify(tags) : (typeof tags === 'string' ? tags : '[]');
      const parsedConsentDate = consentDate ? new Date(consentDate) : new Date();

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
          consentDate: parsedConsentDate,
          consentChannel: consentChannel || undefined,
          consentWording: consentWording || undefined,
          ...(optedOut ? { optedOutAt: new Date(), optOutReason: optOutReason || 'User Request' } : {}),
        },
        create: {
          userId,
          phoneNumber,
          name: name || null,
          tags: formattedTags,
          notes: notes || null,
          consentDate: parsedConsentDate,
          consentChannel: consentChannel || 'web_form',
          consentWording: consentWording || 'User accepted terms and consented to communication.',
          optedOutAt: optedOut ? new Date() : null,
          optOutReason: optedOut ? (optOutReason || 'User Request') : null,
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
      const userId = (req as any).effectiveWorkspaceId || (req as any).user?.id || (req as any).user?.userId || (req as any).userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const contactId = String(req.params.id);
      const userIdStr = String(userId);
      const {
        name,
        tags,
        notes,
        phoneNumber,
        consentDate,
        consentChannel,
        consentWording,
        optedOut,
        optOutReason
      } = req.body;

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
          ...(consentDate !== undefined && { consentDate: consentDate ? new Date(consentDate) : null }),
          ...(consentChannel !== undefined && { consentChannel: String(consentChannel) }),
          ...(consentWording !== undefined && { consentWording: String(consentWording) }),
          ...(optedOut !== undefined && {
            optedOutAt: optedOut ? (existing.optedOutAt || new Date()) : null,
            optOutReason: optedOut ? (optOutReason || 'Manual Update') : null,
          }),
        },
      });

      res.json({ success: true, data: updated });
    } catch (err: any) {
      logger.error('ContactsController: Error updating contact', { error: err.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  static async bulkImportContacts(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).effectiveWorkspaceId || (req as any).user?.id || (req as any).user?.userId || (req as any).userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { contacts } = req.body;
      if (!Array.isArray(contacts) || contacts.length === 0) {
        res.status(400).json({ success: false, error: 'contacts array is required and must not be empty' });
        return;
      }

      let imported = 0;
      let flaggedForReconsent = 0;
      const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;
      const now = Date.now();

      for (const item of contacts) {
        const phone = (item.phoneNumber || item.phone || '').trim();
        if (!phone) continue;

        const consentDate = item.consentDate ? new Date(item.consentDate) : new Date();
        const isExpired = !item.consentDate || (now - consentDate.getTime() > SIX_MONTHS_MS);
        if (isExpired) {
          flaggedForReconsent++;
        }

        const tags = Array.isArray(item.tags)
          ? JSON.stringify(item.tags)
          : (typeof item.tags === 'string' ? item.tags : '[]');

        await prisma.contact.upsert({
          where: { userId_phoneNumber: { userId, phoneNumber: phone } },
          update: {
            name: item.name || undefined,
            tags,
            notes: item.notes || undefined,
            consentDate,
            consentChannel: item.consentChannel || undefined,
            consentWording: item.consentWording || undefined,
            ...(item.optedOut ? { optedOutAt: new Date(), optOutReason: item.optOutReason || 'CSV Import' } : {}),
          },
          create: {
            userId,
            phoneNumber: phone,
            name: item.name || null,
            tags,
            notes: item.notes || null,
            consentDate,
            consentChannel: item.consentChannel || 'web_form',
            consentWording: item.consentWording || 'User accepted communication terms via bulk import.',
            optedOutAt: item.optedOut ? new Date() : null,
            optOutReason: item.optedOut ? (item.optOutReason || 'CSV Import') : null,
          },
        });
        imported++;
      }

      res.status(201).json({
        success: true,
        message: `Successfully imported ${imported} contacts (${flaggedForReconsent} flagged for re-consent past 6 months).`,
        data: { imported, flaggedForReconsent },
      });
    } catch (err: any) {
      logger.error('ContactsController: Error importing contacts', { error: err.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  static async deleteContact(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).effectiveWorkspaceId || (req as any).user?.id || (req as any).user?.userId || (req as any).userId;
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
