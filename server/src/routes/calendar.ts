import crypto from 'crypto';
import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { getUserIdFromRequest } from '../utils/auth';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { getWebhookSigningSecret } from '../utils/security';
import { scheduleCall, cancelBooking, rescheduleBooking } from '../lib/calendar/scheduler';
import { sensitiveOperationsLimiter } from '../middleware/rateLimiter';
import { requireCallingMinutes } from '../middleware/planValidation';
import { CallService } from '../services/CallService';
import { ADMIN_EMAIL } from '../config/constants';

const router = Router();

const getOauth2Client = () => {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    // Provide a sensible default or environment variable for redirect URI
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5174/api/v2/calendar/callback'
  );
};

/**
 * GET /api/v2/calendar/auth
 * Generates an OAuth URL and redirects the user to Google.
 */
router.get('/auth', requireAuth, (req, res) => {
  try {
    const oauth2Client = getOauth2Client();
    const scopes = [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly'
    ];

    // Use HMAC-signed state with timestamp to pass user ID securely through OAuth flow
    const userId = getUserIdFromRequest(req);
    const secret = getWebhookSigningSecret();
    const payload = JSON.stringify({ userId, timestamp: Date.now() });
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const state = Buffer.from(JSON.stringify({ payload, signature })).toString('base64');

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes,
      state: state
    });

    res.redirect(url);
  } catch (error) {
    logger.error('Failed to generate Google Calendar auth URL', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

/**
 * GET /api/v2/calendar/callback
 * Handles the OAuth callback from Google.
 * Verifies HMAC state signature and timestamp to prevent CSRF.
 */
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    logger.error('Google Calendar OAuth error', { error });
    return res.redirect('/?error=calendar_auth_failed');
  }

  if (!code || !state) {
    return res.status(400).send('Missing code or state parameter');
  }

  try {
    const secret = getWebhookSigningSecret();
    const { payload, signature } = JSON.parse(Buffer.from(state as string, 'base64').toString('utf-8'));
    const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    if (signature !== expectedSignature) {
      logger.warn('Google Calendar OAuth callback: invalid state signature');
      return res.status(403).send('Invalid or tampered OAuth state parameter');
    }

    const { userId, timestamp } = JSON.parse(payload);
    if (!userId || !timestamp || (Date.now() - timestamp > 15 * 60 * 1000)) {
      logger.warn('Google Calendar OAuth callback: expired or invalid state payload');
      return res.status(403).send('OAuth state expired or invalid');
    }

    const oauth2Client = getOauth2Client();
    const { tokens } = await oauth2Client.getToken(code as string);

    // Ensure we actually got tokens
    if (tokens) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          googleCalendarTokens: JSON.stringify(tokens)
        }
      });
      logger.info('Successfully connected Google Calendar', { userId });
      
      // Redirect back to the agents dashboard or a specific settings page
      res.redirect('/?success=calendar_connected');
    } else {
      res.redirect('/?error=calendar_auth_failed_no_tokens');
    }

  } catch (error) {
    logger.error('Failed to handle Google Calendar callback', { error: error instanceof Error ? error.message : String(error) });
    res.redirect('/?error=calendar_auth_failed');
  }
});

/**
 * GET /api/v2/calendar/status
 * Returns whether the current user has linked their Google Calendar.
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { googleCalendarTokens: true }
    });

    res.json({
      connected: !!user?.googleCalendarTokens
    });
  } catch (error) {
    logger.error('Failed to get Google Calendar status', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to get status' });
  }
});

/**
 * DELETE /api/v2/calendar
 * Disconnects the Google Calendar.
 */
router.delete('/', requireAuth, async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await prisma.user.update({
      where: { id: userId },
      data: { googleCalendarTokens: null }
    });
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to disconnect Google Calendar', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to disconnect calendar' });
  }
});

/**
 * GET /api/v2/calendar/bookings
 */
router.get('/bookings', requireAuth, async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const calls = await prisma.call.findMany({
      where: {
        userId,
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    const bookings = calls.map(c => ({
      id: c.id,
      source: 'ai_booked',
      phoneNumber: c.recipientPhoneNumber,
      scheduledAtUtc: c.createdAt.toISOString(),
      timezone: 'Asia/Kolkata',
      status: c.status === 'queued' ? 'scheduled' : c.status,
      notes: `Call via agent ${c.agentId.slice(0, 8)}`,
    }));

    res.json(bookings);
  } catch (error) {
    logger.error('Failed to get bookings', { error: String(error) });
    res.status(500).json({ error: 'Failed to get bookings' });
  }
});

/**
 * GET /api/v2/calendar/batches
/**
 * GET /api/v2/calendar/batches
 * List user's batch calling campaigns.
 */
router.get('/batches', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).effectiveWorkspaceId || getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const batches = await prisma.batch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        agent: { select: { name: true } },
        fromPhoneNumber: { select: { id: true, phoneNumber: true } }
      }
    });

    const formatted = batches.map(b => ({
      id: b.id,
      name: b.name,
      agentId: b.agentId,
      agentName: b.agent?.name || 'Default Agent',
      fromPhoneNumberId: b.fromPhoneNumberId,
      fromPhoneNumber: b.fromPhoneNumber?.phoneNumber || null,
      status: b.status,
      statusReason: b.statusReason,
      total: b.totalRecipients,
      called: b.completedCount + b.failedCount,
      connected: b.completedCount,
      failed: b.failedCount,
      converted: Math.floor(b.completedCount * 0.25),
      created: b.createdAt.toISOString().slice(0, 10),
      totalContacts: b.totalRecipients,
      completedCount: b.completedCount,
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    logger.error('Failed to get batches', { error: String(error) });
    res.status(500).json({ success: false, error: 'Failed to get batches' });
  }
});

/**
 * GET /api/v2/calendar/batches/:id
 * Get single batch with recipient summary, failures, and caller ID.
 */
router.get('/batches/:id', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).effectiveWorkspaceId || getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const batchId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
    const batch = await prisma.batch.findFirst({
      where: { id: batchId, userId },
      include: {
        agent: { select: { name: true } },
        fromPhoneNumber: { select: { id: true, phoneNumber: true } },
        recipients: {
          orderBy: { id: 'asc' }
        }
      }
    });

    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found.' });
    }

    res.json({
      success: true,
      data: {
        id: batch.id,
        name: batch.name,
        agentId: batch.agentId,
        agentName: batch.agent?.name || 'Default Agent',
        fromPhoneNumberId: batch.fromPhoneNumberId,
        fromPhoneNumber: batch.fromPhoneNumber?.phoneNumber || null,
        status: batch.status,
        statusReason: batch.statusReason,
        total: batch.totalRecipients,
        called: batch.completedCount + batch.failedCount,
        connected: batch.completedCount,
        failed: batch.failedCount,
        converted: Math.floor(batch.completedCount * 0.25),
        created: batch.createdAt.toISOString().slice(0, 10),
        recipients: batch.recipients.map(r => ({
          id: r.id,
          phoneNumber: r.phoneNumber,
          status: r.status,
          attempts: r.attempts,
          lastAttemptAt: r.lastAttemptAt?.toISOString() || null,
          lastError: r.lastError,
          lastErrorCode: r.lastErrorCode,
          callId: r.callId
        }))
      }
    });
  } catch (error) {
    logger.error('Failed to get batch detail', { error: String(error) });
    res.status(500).json({ success: false, error: 'Failed to get batch detail' });
  }
});

/**
 * POST /api/v2/calendar/batches
 * Create a new batch campaign with recipient list.
 */
router.post('/batches', requireAuth, sensitiveOperationsLimiter, requireCallingMinutes, async (req, res) => {
  try {
    const userId = (req as any).effectiveWorkspaceId || getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { name, agentId, numberId, recipients, scheduleNow, scheduleConfig } = req.body;
    if (!name || !agentId || !Array.isArray(recipients) || recipients.length === 0) {
      res.status(400).json({ success: false, error: 'Name, agentId, and non-empty recipients array are required.' });
      return;
    }

    // IDOR Protection: Verify agent belongs to the authenticated user/workspace
    const agent = await prisma.agent.findFirst({
      where: { id: agentId, userId }
    });
    if (!agent) {
      res.status(404).json({ success: false, error: 'Agent not found or does not belong to your account.' });
      return;
    }

    // Validate Caller ID (PhoneNumber) ownership, active status, KYC status
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(401).json({ success: false, error: 'User not found' });
    const isAdmin = user.accountType === 'admin' || user.email === ADMIN_EMAIL;

    let validatedNumberRecord: any = null;
    let validatedFromNumber: string | null = null;
    try {
      const valRes = await CallService.validateCallerNumber(userId, numberId, isAdmin);
      validatedFromNumber = valRes.effectiveFromNumber;
      validatedNumberRecord = valRes.numberRecord;
    } catch (err: any) {
      const errMsg = err?.message || 'Invalid caller phone number';
      return res.status(400).json({
        success: false,
        error: errMsg,
        details: err?.details || undefined
      });
    }

    const initialStatus = scheduleNow !== false ? 'running' : 'scheduled';

    // Exclude opted-out (DNC) contacts for this workspace owner
    const optedOutContacts = await prisma.contact.findMany({
      where: {
        userId,
        optedOutAt: { not: null }
      },
      select: { phoneNumber: true }
    });
    const optedOutDigitsSet = new Set(
      optedOutContacts.map(c => c.phoneNumber.replace(/\D/g, '')).filter(Boolean)
    );

    const eligibleRecipients = recipients.filter((r: any) => {
      const raw = typeof r === 'string' ? r : (r.phoneNumber || r.phone || '');
      const digits = String(raw).replace(/\D/g, '');
      return !optedOutDigitsSet.has(digits);
    });

    if (eligibleRecipients.length === 0) {
      res.status(400).json({
        success: false,
        error: 'All recipients in this batch have opted out of communications (Do Not Call list).'
      });
      return;
    }

    const excludedCount = recipients.length - eligibleRecipients.length;
    if (excludedCount > 0) {
      logger.info('Calendar batches: Excluded opted-out contacts from batch', {
        userId,
        totalSubmitted: recipients.length,
        eligible: eligibleRecipients.length,
        excludedCount
      });
    }

    const batch = await prisma.batch.create({
      data: {
        userId,
        agentId,
        fromPhoneNumberId: validatedNumberRecord?.id || null,
        name: name.trim(),
        status: initialStatus,
        scheduleConfig: JSON.stringify(scheduleConfig || {}),
        totalRecipients: eligibleRecipients.length,
        startedAt: initialStatus === 'running' ? new Date() : null,
        recipients: {
          create: eligibleRecipients.map((r: any) => ({
            phoneNumber: typeof r === 'string' ? r.trim() : (r.phoneNumber || r.phone || '').trim(),
            userData: JSON.stringify(typeof r === 'object' ? r : {}),
            status: 'pending'
          }))
        }
      },
      include: {
        fromPhoneNumber: {
          select: { id: true, phoneNumber: true }
        }
      }
    });

    if (initialStatus === 'running') {
      // Trigger background batch processing
      const { BatchService } = await import('../services/BatchService');
      BatchService.processBatch(batch.id, userId).catch(err => {
        logger.error('BatchService execution error', { batchId: batch.id, error: String(err) });
      });
    }

    logger.info(`Batch created successfully`, { batchId: batch.id, userId, totalRecipients: recipients.length });

    res.status(201).json({
      success: true,
      data: {
        id: batch.id,
        name: batch.name,
        agentId: batch.agentId,
        fromPhoneNumberId: batch.fromPhoneNumberId,
        fromPhoneNumber: batch.fromPhoneNumber?.phoneNumber || validatedFromNumber,
        status: batch.status,
        statusReason: batch.statusReason,
        total: batch.totalRecipients,
        called: 0,
        connected: 0,
        converted: 0,
        created: batch.createdAt.toISOString().slice(0, 10)
      }
    });
  } catch (error) {
    logger.error('Failed to create batch campaign', { error: String(error) });
    res.status(500).json({ success: false, error: 'Failed to create batch campaign' });
  }
});

/**
 * POST /api/v2/calendar/batches/:id/pause
 * Pause an active batch campaign.
 */
router.post('/batches/:id/pause', requireAuth, sensitiveOperationsLimiter, async (req, res) => {
  try {
    const userId = (req as any).effectiveWorkspaceId || getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const batchId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
    const existing = await prisma.batch.findFirst({
      where: { id: batchId, userId }
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Batch not found.' });
    }

    await prisma.batch.updateMany({
      where: { id: batchId, userId },
      data: { status: 'paused', statusReason: 'User paused' }
    });

    res.json({ success: true, message: 'Batch campaign paused.' });
  } catch (error) {
    logger.error('Failed to pause batch campaign', { error: String(error) });
    res.status(500).json({ success: false, error: 'Failed to pause batch campaign' });
  }
});

/**
 * POST /api/v2/calendar/batches/:id/resume
 * Resume a paused batch campaign.
 */
router.post('/batches/:id/resume', requireAuth, sensitiveOperationsLimiter, requireCallingMinutes, async (req, res) => {
  try {
    const userId = (req as any).effectiveWorkspaceId || getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const batchId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
    const existing = await prisma.batch.findFirst({
      where: { id: batchId, userId }
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Batch not found.' });
    }

    // One worker per batch check:
    // If already running and locked with fresh lock, resume is a no-op
    if (existing.status === 'running' && existing.lockedBy && existing.lockedAt && (Date.now() - existing.lockedAt.getTime() < 60000)) {
      return res.json({ success: true, message: 'Batch campaign is already running.' });
    }

    await prisma.batch.updateMany({
      where: { id: batchId, userId },
      data: { status: 'running', statusReason: null }
    });

    const { BatchService } = await import('../services/BatchService');
    BatchService.processBatch(batchId, userId).catch(err => {
      logger.error('BatchService resume error', { batchId, error: String(err) });
    });

    res.json({ success: true, message: 'Batch campaign resumed.' });
  } catch (error) {
    logger.error('Failed to resume batch campaign', { error: String(error) });
    res.status(500).json({ success: false, error: 'Failed to resume batch campaign' });
  }
});

/**
 * POST /api/v2/calendar/batches/:id/cancel
 * Cancel/stop a batch campaign.
 */
router.post('/batches/:id/cancel', requireAuth, sensitiveOperationsLimiter, async (req, res) => {
  try {
    const userId = (req as any).effectiveWorkspaceId || getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const batchId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
    const existing = await prisma.batch.findFirst({
      where: { id: batchId, userId }
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Batch not found.' });
    }

    await prisma.batch.updateMany({
      where: { id: batchId, userId },
      data: { status: 'cancelled' }
    });

    res.json({ success: true, message: 'Batch campaign cancelled.' });
  } catch (error) {
    logger.error('Failed to cancel batch campaign', { error: String(error) });
    res.status(500).json({ success: false, error: 'Failed to cancel batch campaign' });
  }
});

export default router;
