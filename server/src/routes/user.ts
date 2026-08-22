import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/v2/user/billing-config
 * 
 * Saves the user's custom Gemini Live API key (BYOK mode) in the User table.
 */
router.post('/billing-config', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { geminiApiKey } = req.body;
    // We allow setting to empty string/null to clear it and fall back to platform account balances
    const apiKeyVal = (geminiApiKey && typeof geminiApiKey === 'string' && geminiApiKey.trim() !== '')
      ? geminiApiKey.trim()
      : null;

    logger.info('User billing-config: updating custom Gemini API key', { userId, hasKey: !!apiKeyVal });

    await prisma.user.update({
      where: { id: userId },
      data: {
        geminiApiKey: apiKeyVal
      }
    });

    res.json({
      success: true,
      message: 'Gemini Live API Custom Key updated successfully.'
    });
  } catch (err) {
    logger.error('User billing-config: failed to update settings', { error: String(err) });
    next(err);
  }
});

// Company-wide notifications store
const fs = require('fs');
const path = require('path');
const notificationsFilePath = path.join(__dirname, '../../data/company_notifications.json');

function getCompanyNotifications() {
  try {
    if (fs.existsSync(notificationsFilePath)) {
      const data = fs.readFileSync(notificationsFilePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {}
  return [
    {
      id: 'notif-default-1',
      message: '📢 Claritiy Voice System Announcement: Outbound telephony engine operational across all channels.',
      createdAt: new Date().toISOString(),
      isImportant: true,
    }
  ];
}

function saveCompanyNotifications(notifs: any[]) {
  try {
    const dir = path.dirname(notificationsFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(notificationsFilePath, JSON.stringify(notifs, null, 2), 'utf8');
  } catch (e) {
    logger.error('Failed to save company notifications', { error: String(e) });
  }
}

/**
 * GET /api/v2/user/notifications
 * Returns list of company-wide notifications for all logged-in users.
 */
router.get('/notifications', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const notifications = getCompanyNotifications();
    res.json({ success: true, data: notifications });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
});

/**
 * POST /api/v2/user/notifications
 * Allows posting a new company-wide notification (Founder/Admin feature).
 */
router.post('/notifications', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { message, isImportant } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ success: false, error: 'Message is required' });
      return;
    }

    const current = getCompanyNotifications();
    const newNotif = {
      id: `notif_${Date.now()}`,
      message: message.trim(),
      createdAt: new Date().toISOString(),
      isImportant: !!isImportant,
    };

    const updated = [newNotif, ...current].slice(0, 10);
    saveCompanyNotifications(updated);

    logger.info('Company notification posted', { userId: req.userId, message: newNotif.message });
    res.json({ success: true, data: newNotif });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to post notification' });
  }
});

export default router;

