import { Router, type RequestHandler } from 'express';
import { prisma } from '../lib/prisma';
import { normalizePhoneNumber } from '../utils/phoneValidator';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { logAuditEvent } from '../utils/auditLogger';
import { CallOrchestrator } from '../core/orchestrator/CallOrchestrator';
import { normalizeEmail, isDisposableEmail, isValidEmail } from '../utils/emailNormalizer';
import { signupLimiter, authIpThrottleDelay, sensitiveOperationsLimiter, notificationActionLimiter } from '../middleware/rateLimiter';
import { ADMIN_EMAIL } from '../config/constants';
import { EncryptionService } from '../utils/EncryptionService';
import { getPlanConcurrency } from '../config/plans';
import { supabaseClient } from '../utils/supabase';
import { getTrustedClientIp } from '../utils/ipChecker';

/**
 * Signed-in user id from an optional Bearer token, or null. Used by the public consent route so that
 * consent is linked to an existing account only when that account's own session sends it.
 */
async function optionalVerifiedUserId(req: any): Promise<string | null> {
  const header = req.headers?.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  if (!token || token === 'undefined' || token === 'null' || token.startsWith('{')) return null;
  try {
    const { data, error } = await supabaseClient.auth.getUser(token);
    return !error && data?.user?.id ? data.user.id : null;
  } catch {
    return null;
  }
}

/** Signup-time consent is sent before the account row exists; 5 minutes of tolerance covers slow sign-ups. */
export const SIGNUP_CONSENT_WINDOW_MS = 5 * 60 * 1000;

const router = Router();

/**
 * Routes a visitor must reach BEFORE they have an account (sign-up pre-check and
 * consent logging). They are mounted without `requireAuth`; each one carries its own
 * rate limiter, IP throttle and honeypot check.
 */
export const publicUserRouter = Router();

/**
 * Mounts the user API. Public pre-signup routes first, then everything else behind auth.
 * index.ts and the tests both use this function, so the mount order cannot drift.
 */
export function mountUserRoutes(app: { use: (...args: any[]) => unknown }, authMiddleware: RequestHandler): void {
  app.use('/api/v2/user', publicUserRouter);
  app.use('/api/v2/user', authMiddleware, router);
}

/**
 * POST /api/v2/user/billing-config
 * 
 * Saves the user's custom Gemini Live API key (BYOK mode) in the User table.
 */
router.post('/billing-config', requireAuth, requireRole(['admin']), sensitiveOperationsLimiter, async (req: AuthenticatedRequest, res, next) => {
  try {
    // The key belongs to the WORKSPACE, which is where calls look for it (audit #61: a member's key
    // was saved on their own row and never used). Workspace owners and admins only.
    const userId = req.effectiveWorkspaceId || req.userId;
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

    const encryptedKey = apiKeyVal ? EncryptionService.encrypt(apiKeyVal) : null;

    await prisma.user.update({
      where: { id: userId },
      data: {
        geminiApiKey: encryptedKey
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

/**
 * POST /api/v2/user/verify-gemini-key
 * Validates a Gemini API key against Google's Generative Language API.
 */
router.post('/verify-gemini-key', requireAuth, sensitiveOperationsLimiter, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.effectiveWorkspaceId || req.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { geminiApiKey } = req.body;
    let keyToTest = (geminiApiKey && typeof geminiApiKey === 'string' && geminiApiKey.trim())
      ? geminiApiKey.trim()
      : null;

    if (!keyToTest) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { geminiApiKey: true }
      });
      if (user?.geminiApiKey) {
        keyToTest = EncryptionService.decryptIfEncrypted(user.geminiApiKey.trim());
      }
    }

    // Only the customer's own key is tested (the platform key used to be tested instead, so the
    // answer said nothing about the customer's key). Envelope fixed: audit #45.
    if (!keyToTest) {
      res.json({ success: true, data: { valid: false, error: 'No Gemini API key to test. Enter a key or save one in Settings first.' } });
      return;
    }

    const httpBase = (process.env.GEMINI_HTTP_BASE || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
    // Key in a header, not the URL (URLs end up in proxy and server logs).
    const checkRes = await fetch(`${httpBase}/v1alpha/models`, { headers: { 'x-goog-api-key': keyToTest }, signal: AbortSignal.timeout(8000) });

    if (!checkRes.ok) {
      const errorData = await checkRes.json().catch(() => ({})) as any;
      const errorMsg = errorData?.error?.message || `HTTP ${checkRes.status}: ${checkRes.statusText}`;
      res.json({ success: true, data: { valid: false, error: errorMsg } });
      return;
    }

    const data = await checkRes.json().catch(() => ({})) as any;
    const models = Array.isArray(data?.models) ? data.models.map((m: any) => m.name) : [];

    res.json({ success: true, data: { valid: true, message: 'Gemini API key is verified and active.', availableModelsCount: models.length } });
  } catch (err: any) {
    logger.error('User verify-gemini-key error', { error: err.message || String(err) });
    res.status(502).json({ success: false, error: 'Could not reach Google to check the key. Please try again.' });
  }
});

import { NotificationService, ANNOUNCEMENT_TYPE } from '../services/NotificationService';

/**
 * GET /api/v2/user/notifications
 * Returns list of in-app notifications for the logged-in user and company announcements.
 */
router.get('/notifications', async (req: AuthenticatedRequest, res) => {
  try {
    const ownerId = (req as any).effectiveWorkspaceId || req.userId;
    const notifications = await NotificationService.getForUser(ownerId);
    res.json({ success: true, data: notifications });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
});

// Notification ids are UUIDs; anything else is rejected before touching the database.
const NOTIFICATION_ID = /^[A-Za-z0-9-]{1,64}$/;

/**
 * POST /api/v2/user/notifications/mark-all-read
 * (Registered before the "/:id" routes so the literal path always wins.)
 */
router.post('/notifications/mark-all-read', notificationActionLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const ownerId = (req as any).effectiveWorkspaceId || req.userId;
    await NotificationService.markAllAsRead(ownerId);
    res.json({ success: true, data: { markedAllRead: true } });
  } catch (err) {
    logger.error('Failed to mark all notifications read', { error: String(err) });
    res.status(500).json({ success: false, error: 'Failed to mark all as read' });
  }
});

/**
 * DELETE /api/v2/user/notifications/clear-all — deletes every READ notification.
 */
router.delete('/notifications/clear-all', notificationActionLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const ownerId = (req as any).effectiveWorkspaceId || req.userId;
    await NotificationService.clearAll(ownerId);
    res.json({ success: true, data: { cleared: true } });
  } catch (err) {
    logger.error('Failed to clear notifications', { error: String(err) });
    res.status(500).json({ success: false, error: 'Failed to clear notifications' });
  }
});

/**
 * POST /api/v2/user/notifications/:id/read — marks one notification read.
 * 404 when the id does not belong to this workspace (no hint whether it exists elsewhere).
 */
router.post('/notifications/:id/read', notificationActionLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const id = String(req.params.id);
    if (!NOTIFICATION_ID.test(id)) {
      res.status(400).json({ success: false, error: 'Invalid notification id' });
      return;
    }
    const ownerId = (req as any).effectiveWorkspaceId || req.userId;
    const result = await NotificationService.markAsRead(id, ownerId);
    if (result === 'not_found') {
      res.status(404).json({ success: false, error: 'Notification not found' });
      return;
    }
    res.json({ success: true, data: { id, isRead: true } });
  } catch (err) {
    logger.error('Failed to mark notification read', { error: String(err) });
    res.status(500).json({ success: false, error: 'Failed to mark notification as read' });
  }
});

/**
 * DELETE /api/v2/user/notifications/:id — deletes one notification for this workspace.
 */
router.delete('/notifications/:id', notificationActionLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const id = String(req.params.id);
    if (!NOTIFICATION_ID.test(id)) {
      res.status(400).json({ success: false, error: 'Invalid notification id' });
      return;
    }
    const ownerId = (req as any).effectiveWorkspaceId || req.userId;
    const result = await NotificationService.deleteOne(id, ownerId);
    if (result === 'not_found') {
      res.status(404).json({ success: false, error: 'Notification not found' });
      return;
    }
    res.json({ success: true, data: { id, deleted: true } });
  } catch (err) {
    logger.error('Failed to delete notification', { error: String(err) });
    res.status(500).json({ success: false, error: 'Failed to delete notification' });
  }
});

/**
 * POST /api/v2/user/notifications
 * Allows posting a new company-wide notification (Founder/Admin feature).
 */
router.post('/notifications', requireAuth, sensitiveOperationsLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const adminUserId = req.userId;
    const adminUser = await prisma.user.findUnique({ where: { id: adminUserId } });
    if (!adminUser || (adminUser.accountType !== 'admin' && adminUser.email !== ADMIN_EMAIL)) {
      res.status(403).json({ success: false, error: 'Access Denied: Founder admin privilege required to post system notifications.' });
      return;
    }

    const { message, isImportant } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ success: false, error: 'Message is required' });
      return;
    }

    // Company-wide announcement: the only kind of owner-less notification customers can see.
    const newNotif = await NotificationService.createInAppNotification({
      type: ANNOUNCEMENT_TYPE,
      title: 'Announcement',
      message: message.trim().slice(0, 2000),
      isImportant: !!isImportant,
    });

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
router.post('/retention', requireAuth, requireRole(['admin']), sensitiveOperationsLimiter, async (req: AuthenticatedRequest, res) => {
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
router.post('/ip-allowlist', requireAuth, requireRole(['admin']), sensitiveOperationsLimiter, async (req: AuthenticatedRequest, res) => {
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
      select: { maxConcurrentCalls: true, accountType: true },
    });

    const inMemoryCount = CallOrchestrator.instance.getActiveCallCountForUser(ownerId);
    const dbCount = await prisma.callSession.count({
      where: {
        userId: ownerId,
        status: { in: ['IN_PROGRESS', 'initiated', 'queued', 'active'] },
      },
    });

    const activeCallCount = Math.max(inMemoryCount, dbCount);
    // The plan sets the ceiling; the stored value can only lower it (audit #6).
    const planLimit = getPlanConcurrency(user?.accountType);
    const softLimit = getPlanConcurrency(user?.accountType, user?.maxConcurrentCalls);

    res.json({
      success: true,
      activeCallCount,
      softLimit,
      planLimit,
      data: { activeCallCount, softLimit, planLimit },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch concurrency telemetry' });
  }
});

/**
 * POST /api/v2/user/concurrency
 * Updates workspace configurable soft limit (Admin-only).
 */
router.post('/concurrency', requireAuth, requireRole(['admin']), sensitiveOperationsLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const ownerId = req.effectiveWorkspaceId || req.userId;
    if (!ownerId) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }

    const { maxConcurrentCalls } = req.body;
    const parsedLimit = parseInt(String(maxConcurrentCalls), 10);

    if (isNaN(parsedLimit) || parsedLimit <= 0) {
      res.status(400).json({ success: false, error: 'maxConcurrentCalls must be a positive integer' });
      return;
    }
    const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { accountType: true } });
    const planLimit = getPlanConcurrency(owner?.accountType);
    if (parsedLimit > planLimit) {
      res.status(400).json({ success: false, error: `Your plan allows up to ${planLimit} simultaneous call(s). Upgrade your plan for more.`, code: 'ABOVE_PLAN_LIMIT', planLimit });
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

/**
 * POST /api/v2/user/validate-signup
 * Pre-registration gate enforcing email normalization, disposable domain filtering,
 * bot honeypot detection, and duplicate email prevention.
 */
publicUserRouter.post('/validate-signup', signupLimiter, authIpThrottleDelay, async (req, res) => {
  try {
    const { email, honeypot, contactNumber } = req.body || {};

    // 1. Honeypot check: If the hidden honeypot input contains any text, drop silently
    if (honeypot && String(honeypot).trim() !== '') {
      logger.warn('[validate-signup] Automated bot caught by honeypot trigger', {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      res.status(400).json({ success: false, error: 'Signup validation rejected.' });
      return;
    }

    if (!email || typeof email !== 'string') {
      res.status(400).json({ success: false, error: 'Email address is required.' });
      return;
    }

    if (!isValidEmail(email)) {
      res.status(400).json({ success: false, error: 'Invalid email address syntax.' });
      return;
    }

    // 2. Disposable Email Blocking
    if (isDisposableEmail(email)) {
      res.status(403).json({
        success: false,
        error: 'DISPOSABLE_EMAIL_PROHIBITED',
        message: 'Registration from temporary or disposable email domains is not allowed. Please use your permanent email.',
      });
      return;
    }

    // 2b. Contact number: validated and normalised server-side (never trust the client format)
    const phone = normalizePhoneNumber(contactNumber);
    if (!phone.ok) {
      res.status(400).json({ success: false, error: phone.error, code: 'INVALID_CONTACT_NUMBER' });
      return;
    }

    // 3. Email Normalization
    const canonicalEmail = normalizeEmail(email);

    // 4. Duplicate Account Check in database
    const existingUser = await prisma.user.findUnique({
      where: { email: canonicalEmail },
      select: { id: true },
    });

    if (existingUser) {
      res.status(409).json({
        success: false,
        error: 'DUPLICATE_EMAIL',
        message: 'An account with this email address already exists. Please sign in instead.',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        normalizedEmail: canonicalEmail,
        normalizedContactNumber: phone.e164,
        valid: true,
      },
    });
  } catch (err: any) {
    logger.error('validate-signup error', { error: String(err?.message || err) });
    res.status(500).json({ success: false, error: 'Failed to validate signup request.' });
  }
});

/**
 * POST /api/v2/user/consent
 * Stores user legal consent for Terms and Conditions, Terms of Use, and Acceptable Calling policies.
 * Can be invoked during initial signup or by logged-in users.
 */
publicUserRouter.post('/consent', signupLimiter, authIpThrottleDelay, async (req, res) => {
  try {
    const { email, fullName, termsAndConditions, termsOfUse, privacyPolicy, consentVersion, honeypot } = req.body || {};

    // Honeypot bot protection
    if (honeypot && String(honeypot).trim() !== '') {
      logger.warn('[user/consent] Bot rejected via honeypot', { ip: req.ip });
      res.status(400).json({ success: false, error: 'Registration failed.' });
      return;
    }

    if (!email || typeof email !== 'string') {
      res.status(400).json({ success: false, error: 'Email is required to record legal consent.' });
      return;
    }

    if (!termsAndConditions || !termsOfUse) {
      res.status(400).json({
        success: false,
        error: 'Explicit consent to Terms and Conditions and Terms of Use is required.',
      });
      return;
    }

    // Disposable email check
    if (isDisposableEmail(email)) {
      res.status(403).json({
        success: false,
        error: 'DISPOSABLE_EMAIL_PROHIBITED',
        message: 'Disposable email domains are not permitted.',
      });
      return;
    }

    let cleanEmail: string;
    try {
      cleanEmail = normalizeEmail(email);
    } catch {
      cleanEmail = email.trim().toLowerCase();
    }

    const userAgent = (req.headers['user-agent'] as string) || null;
    // Proxy-validated client IP (the raw X-Forwarded-For first hop is client-controlled).
    const ipAddress = getTrustedClientIp(req) || null;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
      select: { id: true },
    });

    // Tenant/legal integrity: an existing account's consent is recorded only when that account's own
    // session sends it. Anyone else posting this email gets the same answer (no account enumeration),
    // but the record stays unlinked and does not mark the account as consented.
    const verifiedUserId = existingUser ? await optionalVerifiedUserId(req) : null;
    const linkToUser = Boolean(existingUser && verifiedUserId === existingUser.id);

    const consentRecord = await prisma.userConsent.create({
      data: {
        email: cleanEmail,
        fullName: fullName?.trim() || null,
        userId: linkToUser ? existingUser!.id : null,
        termsAndConditions: true,
        termsOfUse: true,
        privacyPolicy: privacyPolicy !== false,
        consentVersion: consentVersion || 'v1.0',
        ipAddress,
        userAgent,
      },
    });

    if (existingUser && linkToUser) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { hasConsentedTerms: true },
      });
    }

    logger.info('User Consent: Successfully recorded Terms & Conditions and Terms of Use consent', {
      email: cleanEmail,
      consentId: consentRecord.id,
      userId: existingUser?.id,
    });

    res.json({
      success: true,
      data: {
        consentId: consentRecord.id,
        consentedAt: consentRecord.consentedAt,
      },
      message: 'Consent recorded successfully.',
    });
  } catch (err: any) {
    logger.error('User Consent: Failed to record consent', { error: String(err?.message || err) });
    res.status(500).json({ success: false, error: 'Failed to record consent record.' });
  }
});

/**
 * GET /api/v2/user/consent-status
 * Checks if current authenticated user has provided legal consent to Terms and Conditions.
 */
router.get('/consent-status', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, hasConsentedTerms: true, createdAt: true },
    });

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    let hasConsented = user.hasConsentedTerms;
    if (!hasConsented) {
      const consentRecord = await prisma.userConsent.findFirst({
        where: {
          // Own linked consent, or unlinked consent given at signup (before/just after the account was
          // created). A later unlinked record by email could have been posted by someone else.
          OR: [
            { userId },
            { userId: null, email: user.email, consentedAt: { lte: new Date(user.createdAt.getTime() + SIGNUP_CONSENT_WINDOW_MS) } },
          ],
        },
      });
      if (consentRecord) {
        hasConsented = true;
        // Self-heal user flag
        await prisma.user.update({
          where: { id: userId },
          data: { hasConsentedTerms: true },
        });
      }
    }

    res.json({
      success: true,
      data: {
        hasConsented,
      },
    });
  } catch (err: any) {
    logger.error('User Consent: Failed to check consent status', { error: String(err?.message || err) });
    res.status(500).json({ success: false, error: 'Failed to verify consent status.' });
  }
});

export default router;


