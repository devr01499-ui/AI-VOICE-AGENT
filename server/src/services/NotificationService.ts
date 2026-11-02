import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

export interface InAppNotification {
  id: string;
  userId?: string | null;
  type: string;
  title: string;
  message: string;
  severity: string;
  isRead: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
  isImportant?: boolean;
}

export class NotificationService {
  public static async getAll(): Promise<InAppNotification[]> {
    try {
      const alerts = await prisma.systemAlert.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return alerts.map(a => {
        let meta = {};
        try { meta = JSON.parse(a.metadata || '{}'); } catch {}
        return {
          id: a.id,
          userId: a.userId,
          type: a.type,
          title: a.title,
          message: a.message,
          severity: a.severity,
          isRead: a.isResolved,
          metadata: meta,
          createdAt: a.createdAt.toISOString(),
          isImportant: a.severity === 'critical' || a.severity === 'error',
        };
      });
    } catch (e) {
      logger.error('NotificationService: Failed to read notifications from DB', { error: String(e) });
      return [];
    }
  }

  public static async getForUser(userId?: string): Promise<InAppNotification[]> {
    try {
      const alerts = await prisma.systemAlert.findMany({
        where: userId ? { OR: [{ userId: null }, { userId }] } : { userId: null },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return alerts.map(a => {
        let meta = {};
        try { meta = JSON.parse(a.metadata || '{}'); } catch {}
        return {
          id: a.id,
          userId: a.userId,
          type: a.type,
          title: a.title,
          message: a.message,
          severity: a.severity,
          isRead: a.isResolved,
          metadata: meta,
          createdAt: a.createdAt.toISOString(),
          isImportant: a.severity === 'critical' || a.severity === 'error',
        };
      });
    } catch (e) {
      logger.error('NotificationService: Failed to get user notifications from DB', { error: String(e) });
      return [];
    }
  }

  public static async createNotification(params: {
    userId?: string | null;
    type: 'CALL_FAILED' | 'BALANCE_LOW' | 'KYC_STATUS' | 'BATCH_COMPLETED' | 'SYSTEM' | string;
    title: string;
    message: string;
    severity?: 'info' | 'warning' | 'error' | 'critical';
    metadata?: Record<string, any>;
  }) {
    try {
      return await prisma.systemAlert.create({
        data: {
          userId: params.userId || null,
          type: params.type,
          title: params.title,
          message: params.message,
          severity: params.severity || 'info',
          metadata: JSON.stringify(params.metadata || {}),
          isResolved: false,
        }
      });
    } catch (e) {
      logger.error('NotificationService: Failed to create alert', { error: String(e) });
      return null;
    }
  }

  public static async markAsRead(id: string, userId: string) {
    try {
      await prisma.systemAlert.updateMany({
        where: { id, OR: [{ userId }, { userId: null }] },
        data: { isResolved: true }
      });
      return true;
    } catch (e) {
      logger.error('NotificationService: markAsRead error', { error: String(e) });
      return false;
    }
  }

  public static async markAllAsRead(userId: string) {
    try {
      await prisma.systemAlert.updateMany({
        where: { OR: [{ userId }, { userId: null }] },
        data: { isResolved: true }
      });
      return true;
    } catch (e) {
      logger.error('NotificationService: markAllAsRead error', { error: String(e) });
      return false;
    }
  }

  public static async clearAll(userId: string) {
    try {
      await prisma.systemAlert.deleteMany({
        where: { userId, isResolved: true }
      });
      return true;
    } catch (e) {
      logger.error('NotificationService: clearAll error', { error: String(e) });
      return false;
    }
  }

  public static async createInAppNotification(params: {
    userId?: string | null;
    type?: string;
    title?: string;
    message: string;
    severity?: 'info' | 'warning' | 'error' | 'critical';
    metadata?: Record<string, any>;
    isImportant?: boolean;
  }) {
    return this.createNotification({
      userId: params.userId || null,
      type: params.type || 'SYSTEM',
      title: params.title || 'Notification',
      message: params.message,
      severity: params.severity || (params.isImportant ? 'warning' : 'info'),
      metadata: params.metadata,
    });
  }
}
