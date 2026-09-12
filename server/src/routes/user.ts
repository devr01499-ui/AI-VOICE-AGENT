import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { logAuditEvent } from '../utils/auditLogger';
import { CallOrchestrator } from '../core/orchestrator/CallOrchestrator';

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

/**
 * GET /api/v2/user/retention
 * Fetches workspace data retention setting.
 */
router.get('/retention', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const ownerId = req.effectiveWorkspaceId || req.userId;
    if (!ownerId) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }

    const user = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { dataRetentionDays: true },
    });

    res.json({ success: true, dataRetentionDays: user?.dataRetentionDays ?? null });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch retention settings' });
  }
});

/**
 * POST /api/v2/user/retention
 * Updates workspace data retention setting (Admin-only).
 */
router.post('/retention', requireAuth, requireRole(['admin']), async (req: AuthenticatedRequest, res) => {
  try {
    const ownerId = req.effectiveWorkspaceId || req.userId;
    if (!ownerId) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }

    const { dataRetentionDays } = req.body;
    let safeDays: number | null = null;

    if (dataRetentionDays !== null && dataRetentionDays !== undefined) {
      const parsed = parseInt(String(dataRetentionDays), 10);
      if (isNaN(parsed) || parsed <= 0) {
        res.status(400).json({ success: false, error: 'dataRetentionDays must be a positive integer or null' });
        return;
      }
      safeDays = parsed;
    }

    await prisma.user.update({
      where: { id: ownerId },
      data: { dataRetentionDays: safeDays },
    });

    logAuditEvent({
      workspaceOwnerId: ownerId,
      actorUserId: req.userId!,
      action: 'data.retention.configured',
      metadata: { dataRetentionDays: safeDays },
    });

    res.json({
      success: true,
      message: safeDays ? `Data retention policy set to ${safeDays} days.` : 'Data retention set to keep forever.',
      dataRetentionDays: safeDays,
    });
  } catch (err) {
    logger.error('Failed to update retention policy', { error: String(err) });
    res.status(500).json({ success: false, error: 'Failed to update retention settings' });
  }
});

/**
 * GET /api/v2/user/ip-allowlist
 * Returns the current workspace allowed IP CIDR ranges.
 */
router.get('/ip-allowlist', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const ownerId = req.effectiveWorkspaceId || req.userId;
    if (!ownerId) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }

    const user = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { allowedIpRanges: true },
    });

    res.json({ success: true, allowedIpRanges: user?.allowedIpRanges ?? [] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch IP allowlist' });
  }
});

/**
 * POST /api/v2/user/ip-allowlist
 * Updates workspace allowed IP CIDR ranges (Admin-only).
 */
router.post('/ip-allowlist', requireAuth, requireRole(['admin']), async (req: AuthenticatedRequest, res) => {
  try {
    const ownerId = req.effectiveWorkspaceId || req.userId;
    if (!ownerId) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }

    const { allowedIpRanges } = req.body;
    let cleanRanges: string[] = [];

    if (Array.isArray(allowedIpRanges)) {
      cleanRanges = allowedIpRanges
        .map((r: any) => String(r).trim())
        .filter((r: string) => r.length > 0);
    }

    await prisma.user.update({
      where: { id: ownerId },
      data: { allowedIpRanges: cleanRanges },
    });

    logAuditEvent({
      workspaceOwnerId: ownerId,
      actorUserId: req.userId!,
      action: 'workspace.ip_allowlist.configured',
      metadata: { allowedIpRanges: cleanRanges },
    });

    res.json({
      success: true,
      message: cleanRanges.length > 0
        ? `IP allowlist configured with ${cleanRanges.length} allowed rule(s).`
        : 'IP allowlist cleared. Access allowed from all IPs.',
      allowedIpRanges: cleanRanges,
    });
  } catch (err) {
    logger.error('Failed to update IP allowlist', { error: String(err) });
    res.status(500).json({ success: false, error: 'Failed to update IP allowlist' });
  }
});

/**
 * GET /api/v2/user/concurrency
 * Returns active concurrent call count and configured soft limit for workspace.
 */
router.get('/concurrency', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const ownerId = req.effectiveWorkspaceId || req.userId;
    if (!ownerId) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }

    const user = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { maxConcurrentCalls: true },
    });

    const inMemoryCount = CallOrchestrator.instance.getActiveCallCountForUser(ownerId);
    const dbCount = await prisma.callSession.count({
      where: {
        userId: ownerId,
        status: { in: ['IN_PROGRESS', 'initiated', 'queued', 'active'] },
      },
    });

    const activeCallCount = Math.max(inMemoryCount, dbCount);
    const softLimit = user?.maxConcurrentCalls ?? 10;

    res.json({
      success: true,
      activeCallCount,
      softLimit,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch concurrency telemetry' });
  }
});

/**
 * POST /api/v2/user/concurrency
 * Updates workspace configurable soft limit (Admin-only).
 */
router.post('/concurrency', requireAuth, requireRole(['admin']), async (req: AuthenticatedRequest, res) => {
  try {
    const ownerId = req.effectiveWorkspaceId || req.userId;
    if (!ownerId) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }

    const { maxConcurrentCalls } = req.body;
    const parsedLimit = parseInt(String(maxConcurrentCalls), 10);

    if (isNaN(parsedLimit) || parsedLimit <= 0) {
      res.status(400).json({ success: false, error: 'maxConcurrentCalls must be a positive integer' });
      return;
    }

    await prisma.user.update({
      where: { id: ownerId },
      data: { maxConcurrentCalls: parsedLimit },
    });

    logAuditEvent({
      workspaceOwnerId: ownerId,
      actorUserId: req.userId!,
      action: 'workspace.concurrency.configured',
      metadata: { maxConcurrentCalls: parsedLimit },
    });

    res.json({
      success: true,
      softLimit: parsedLimit,
      message: `Soft concurrency limit updated to ${parsedLimit} active call(s).`,
    });
  } catch (err) {
    logger.error('Failed to update concurrency limit', { error: String(err) });
    res.status(500).json({ success: false, error: 'Failed to update concurrency settings' });
  }
});

export default router;

