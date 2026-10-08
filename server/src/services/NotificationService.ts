import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

const notificationsFilePath = path.join(__dirname, '../../data/company_notifications.json');

export interface InAppNotification {
  id: string;
  userId?: string | null;
  message: string;
  createdAt: string;
  isImportant?: boolean;
}

export class NotificationService {
  public static getAll(): InAppNotification[] {
    try {
      if (fs.existsSync(notificationsFilePath)) {
        const data = fs.readFileSync(notificationsFilePath, 'utf8');
        return JSON.parse(data);
      }
    } catch (e) {
      logger.error('NotificationService: Failed to read notifications', { error: String(e) });
    }
    return [
      {
        id: 'notif-default-1',
        userId: null,
        message: '📢 Claritiy Voice System Announcement: Outbound telephony engine operational across all channels.',
        createdAt: new Date().toISOString(),
        isImportant: true,
      }
    ];
  }

  public static getForUser(userId?: string): InAppNotification[] {
    const all = this.getAll();
    if (!userId) {
      return all.filter(n => !n.userId);
    }
    return all.filter(n => !n.userId || n.userId === userId);
  }

  public static saveAll(notifs: InAppNotification[]): void {
    try {
      const dir = path.dirname(notificationsFilePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(notificationsFilePath, JSON.stringify(notifs, null, 2), 'utf8');
    } catch (e) {
      logger.error('NotificationService: Failed to save notifications', { error: String(e) });
    }
  }

  public static createInAppNotification(data: { userId?: string | null; message: string; isImportant?: boolean }): InAppNotification {
    const current = this.getAll();
    const newNotif: InAppNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: data.userId || null,
      message: data.message,
      createdAt: new Date().toISOString(),
      isImportant: !!data.isImportant,
    };

    const updated = [newNotif, ...current].slice(0, 50);
    this.saveAll(updated);
    logger.info('NotificationService: In-app notification created', {
      userId: newNotif.userId,
      message: newNotif.message,
      id: newNotif.id
    });
    return newNotif;
  }
}
