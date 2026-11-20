import { prisma } from '../lib/prisma';
import { scrubCarrierNames } from '../utils/whiteLabel';
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
  /** True for a company-wide announcement shared by every workspace. */
  isAnnouncement?: boolean;
}

/**
 * Type of the only rows that every customer sees: company-wide announcements posted by the founder.
 * Any other row with userId = null is an internal operations alert (for example a failed number
 * assignment) and is visible in the admin console only, never in a customer's bell.
 */
export const ANNOUNCEMENT_TYPE = 'ANNOUNCEMENT';

/** How many notifications a customer's bell shows. */
export const NOTIFICATION_LIST_LIMIT = 50;

export type NotificationActionResult = 'ok' | 'not_found';

type AlertRow = {
  id: string;
  userId: string | null;
  type: string;
  title: string;
  message: string;
  severity: string;
  isResolved: boolean;
  metadata: string | null;
  createdAt: Date;
};

function toNotification(a: AlertRow, isRead: boolean): InAppNotification {
  let meta: Record<string, any> = {};
  try { meta = JSON.parse(a.metadata || '{}'); } catch { /* keep empty metadata */ }
  return {
    id: a.id,
    userId: a.userId,
    type: a.type,
    title: a.title,
    message: a.message,
    severity: a.severity,
    isRead,
    metadata: meta,
    createdAt: a.createdAt.toISOString(),
    isImportant: a.severity === 'critical' || a.severity === 'error',
    isAnnouncement: a.userId === null && a.type === ANNOUNCEMENT_TYPE,
  };
}

/** Where-clause for the announcements a workspace can still see (not dismissed by it). */
function visibleAnnouncementsWhere(ownerId: string) {
  return {
    userId: null,
    type: ANNOUNCEMENT_TYPE,
    receipts: { none: { userId: ownerId, dismissedAt: { not: null } } },
  };
}

export class NotificationService {
  /** Every alert, newest first (admin use only). */
  public static async getAll(): Promise<InAppNotification[]> {
    try {
      const alerts = await prisma.systemAlert.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      return alerts.map((a) => toNotification(a, a.isResolved));
    } catch (e) {
      logger.error('NotificationService: Failed to read notifications from DB', { error: String(e) });
      return [];
    }
  }

  /**
   * The bell for one workspace: its own notifications plus company announcements it has not
   * deleted, newest first. Internal operations alerts are never included.
   */
  public static async getForUser(ownerId?: string): Promise<InAppNotification[]> {
    if (!ownerId) return [];
    let own: AlertRow[] = [];
    try {
      own = await prisma.systemAlert.findMany({
        where: { userId: ownerId },
        orderBy: { createdAt: 'desc' },
        take: NOTIFICATION_LIST_LIMIT,
      });
    } catch (e) {
      logger.error('NotificationService: Failed to get user notifications from DB', { error: String(e) });
      return [];
    }

    // Announcements are read separately so a problem there never hides a customer's own alerts.
    let announcements: InAppNotification[] = [];
    try {
      const rows = await prisma.systemAlert.findMany({
        where: visibleAnnouncementsWhere(ownerId),
        include: { receipts: { where: { userId: ownerId }, select: { readAt: true } } },
        orderBy: { createdAt: 'desc' },
        take: NOTIFICATION_LIST_LIMIT,
      });
      announcements = rows.map((a) => toNotification(a, Boolean(a.receipts[0]?.readAt)));
    } catch (e) {
      logger.error('NotificationService: Failed to read announcements', { error: String(e) });
    }

    return [...own.map((a) => toNotification(a, a.isResolved)), ...announcements]
      .sort((x, y) => (x.createdAt < y.createdAt ? 1 : x.createdAt > y.createdAt ? -1 : 0))
      .slice(0, NOTIFICATION_LIST_LIMIT);
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
          // Customers never see carrier names (audit #95); staff-only alerts (no owner) keep them.
          title: params.userId ? scrubCarrierNames(params.title) : params.title,
          message: params.userId ? scrubCarrierNames(params.message) : params.message,
          severity: params.severity || 'info',
          metadata: JSON.stringify(params.metadata || {}),
          isResolved: false,
        },
      });
    } catch (e) {
      logger.error('NotificationService: Failed to create alert', { error: String(e) });
      return null;
    }
  }

  /** Marks one notification read for this workspace. Only its own rows or an announcement qualify. */
  public static async markAsRead(id: string, ownerId: string): Promise<NotificationActionResult> {
    const own = await prisma.systemAlert.updateMany({ where: { id, userId: ownerId }, data: { isResolved: true } });
    if (own.count > 0) return 'ok';

    const announcement = await prisma.systemAlert.findFirst({ where: { id, ...visibleAnnouncementsWhere(ownerId) }, select: { id: true } });
    if (!announcement) return 'not_found';

    const now = new Date();
    await prisma.notificationReceipt.upsert({
      where: { alertId_userId: { alertId: id, userId: ownerId } },
      create: { alertId: id, userId: ownerId, readAt: now },
      update: { readAt: now },
    });
    return 'ok';
  }

  /**
   * Deletes one notification for this workspace. The workspace's own rows are deleted; an
   * announcement is hidden for this workspace only (other customers still see it).
   */
  public static async deleteOne(id: string, ownerId: string): Promise<NotificationActionResult> {
    const own = await prisma.systemAlert.deleteMany({ where: { id, userId: ownerId } });
    if (own.count > 0) return 'ok';

    const announcement = await prisma.systemAlert.findFirst({ where: { id, ...visibleAnnouncementsWhere(ownerId) }, select: { id: true } });
    if (!announcement) return 'not_found';

    const now = new Date();
    await prisma.notificationReceipt.upsert({
      where: { alertId_userId: { alertId: id, userId: ownerId } },
      create: { alertId: id, userId: ownerId, readAt: now, dismissedAt: now },
      update: { dismissedAt: now },
    });
    return 'ok';
  }

  public static async markAllAsRead(ownerId: string): Promise<void> {
    await prisma.systemAlert.updateMany({ where: { userId: ownerId, isResolved: false }, data: { isResolved: true } });

    const unreadAnnouncements = await prisma.systemAlert.findMany({
      where: {
        ...visibleAnnouncementsWhere(ownerId),
        NOT: { receipts: { some: { userId: ownerId, readAt: { not: null } } } },
      },
      select: { id: true },
    });
    if (unreadAnnouncements.length === 0) return;

    const ids = unreadAnnouncements.map((a) => a.id);
    const now = new Date();
    await prisma.$transaction([
      prisma.notificationReceipt.createMany({
        data: ids.map((alertId) => ({ alertId, userId: ownerId, readAt: now })),
        skipDuplicates: true,
      }),
      prisma.notificationReceipt.updateMany({
        where: { userId: ownerId, alertId: { in: ids }, readAt: null },
        data: { readAt: now },
      }),
    ]);
  }

  /** Deletes every read notification for this workspace (announcements are hidden for it only). */
  public static async clearAll(ownerId: string): Promise<void> {
    await prisma.systemAlert.deleteMany({ where: { userId: ownerId, isResolved: true } });
    await prisma.notificationReceipt.updateMany({
      where: { userId: ownerId, readAt: { not: null }, dismissedAt: null },
      data: { dismissedAt: new Date() },
    });
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
