import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

export interface InAppNotification {
  id: string;
  userId?: string | null;
  message: string;
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
      return alerts.map(a => ({
        id: a.id,
        userId: a.userId,
        message: a.message,
        createdAt: a.createdAt.toISOString(),
        isImportant: a.severity === 'critical' || a.severity === 'error',
      }));
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
      return alerts.map(a => ({
        id: a.id,
        userId: a.userId,
        message: a.message,
        createdAt: a.createdAt.toISOString(),
        isImportant: a.severity === 'critical' || a.severity === 'error',
      }));
    } catch (e) {
      logger.error('NotificationService: Failed to get user notifications from DB', { error: String(e) });
      return [];
    }
  }

  public static async createInAppNotification(data: {
    userId?: string | null;
    message: string;
    isImportant?: boolean;
    type?: string;
    title?: string;
    severity?: string;
    metadata?: any;
  }): Promise<InAppNotification> {
    try {
      const alert = await prisma.systemAlert.create({
        data: {
          userId: data.userId || null,
          title: data.title || (data.isImportant ? 'Important Alert' : 'System Notification'),
          message: data.message,
          type: data.type || 'SYSTEM',
          severity: data.severity || (data.isImportant ? 'error' : 'info'),
          metadata: data.metadata ? (typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata)) : '{}',
        }
      });

      logger.info('NotificationService: In-app notification created in DB', {
        userId: alert.userId,
        message: alert.message,
        id: alert.id
      });

      return {
        id: alert.id,
        userId: alert.userId,
        message: alert.message,
        createdAt: alert.createdAt.toISOString(),
        isImportant: alert.severity === 'critical' || alert.severity === 'error',
      };
    } catch (e: any) {
      logger.error('NotificationService: Failed to save notification to DB', { error: e?.message || String(e) });
      return {
        id: `fallback_${Date.now()}`,
        userId: data.userId || null,
        message: data.message,
        createdAt: new Date().toISOString(),
        isImportant: !!data.isImportant,
      };
    }
  }
}
