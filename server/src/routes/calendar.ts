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
 * List user's batch calling campaigns with accurate, row-computed counters.
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

    const { BatchService } = await import('../services/BatchService');

    const formatted = await Promise.all(batches.map(async b => {
      const counters = await BatchService.computeBatchCounters(b.id);
      return {
        id: b.id,
        name: b.name,
        agentId: b.agentId,
        agentName: b.agent?.name || 'Default Agent',
        fromPhoneNumberId: b.fromPhoneNumberId,
        fromPhoneNumber: b.fromPhoneNumber?.phoneNumber || null,
        status: b.status,
        statusReason: b.statusReason,
        dialMode: b.dialMode,
        interCallDelaySeconds: b.interCallDelaySeconds,
        nextDispatchAt: b.nextDispatchAt?.toISOString() || null,
        total: counters.total,
        totalContacts: counters.total,
        attempted: counters.attempted,
        called: counters.attempted,
        answered: counters.answered,
        connected: counters.answered,
        notAnswered: counters.notAnswered,
        busy: counters.busy,
        failed: counters.failed,
        skipped: counters.skipped,
        cancelled: counters.cancelled,
        remaining: counters.remaining,
        progressPercent: counters.progressPercent,
        totalDurationSeconds: counters.totalDurationSeconds,
        totalBilledMinutes: counters.totalBilledMinutes,
        created: b.createdAt.toISOString().slice(0, 10),
        createdAt: b.createdAt.toISOString()
      };
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    logger.error('Failed to get batches', { error: String(error) });
    res.status(500).json({ success: false, error: 'Failed to get batches' });
  }
});

/**
 * GET /api/v2/calendar/batches/:id
 * Get single batch with recipient summary, true outcome derivations, and caller ID.
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
          orderBy: { position: 'asc' },
          include: {
            call: {
              select: {
                id: true,
                fromPhoneNumber: true,
                durationSeconds: true,
                callDirection: true,
                status: true,
                startTime: true
              }
            }
          }
        }
      }
    });

    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found.' });
    }

    const { BatchService } = await import('../services/BatchService');
    const counters = await BatchService.computeBatchCounters(batch.id);

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
        dialMode: batch.dialMode,
        interCallDelaySeconds: batch.interCallDelaySeconds,
        nextDispatchAt: batch.nextDispatchAt?.toISOString() || null,
        idempotencyKey: batch.idempotencyKey,
        consentConfirmed: batch.consentConfirmed,
        consentConfirmedBy: batch.consentConfirmedBy,
        consentConfirmedAt: batch.consentConfirmedAt?.toISOString() || null,
        consentListHash: batch.consentListHash,
        estimatedMinutes: batch.estimatedMinutes,
        total: counters.total,
        totalContacts: counters.total,
        attempted: counters.attempted,
        called: counters.attempted,
        answered: counters.answered,
        connected: counters.answered,
        notAnswered: counters.notAnswered,
        busy: counters.busy,
        failed: counters.failed,
        skipped: counters.skipped,
        cancelled: counters.cancelled,
        remaining: counters.remaining,
        progressPercent: counters.progressPercent,
        totalDurationSeconds: counters.totalDurationSeconds,
        totalBilledMinutes: counters.totalBilledMinutes,
        created: batch.createdAt.toISOString().slice(0, 10),
        recipients: batch.recipients.map((r, index) => ({
          id: r.id,
          position: r.position ?? index,
          rowOrder: (r.position ?? index) + 1,
          phoneNumber: r.phoneNumber,
          callerPhoneNumber: r.callerPhoneNumber || r.call?.fromPhoneNumber || batch.fromPhoneNumber?.phoneNumber || '—',
          status: r.status,
          attempts: r.attempts,
          lastAttemptAt: r.lastAttemptAt?.toISOString() || null,
          lastError: r.lastError,
          lastErrorCode: r.lastErrorCode,
          callId: r.callId || r.call?.id || null,
          direction: r.call?.callDirection || 'outbound',
          durationSeconds: r.call?.durationSeconds != null ? r.call.durationSeconds : null
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
 * Create a new batch campaign with recipient list, idempotency, caller ID truth, and explicit consent.
 */
router.post('/batches', requireAuth, sensitiveOperationsLimiter, requireCallingMinutes, async (req, res) => {
  try {
    const userId = (req as any).effectiveWorkspaceId || getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const {
      name,
      agentId,
      numberId,
      recipients,
      scheduleNow,
      scheduleConfig,
      dialMode = 'sequential',
      interCallDelaySeconds = 10,
      idempotencyKey: bodyIdempotencyKey,
      consentConfirmed,
      consentConfirmedBy,
      estimatedMinutes
    } = req.body;

    const idempotencyKey = bodyIdempotencyKey || (req.headers['idempotency-key'] as string) || (req.headers['x-idempotency-key'] as string);
    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Idempotency key is required to create a batch campaign.'
      });
      return;
    }

    // Double-submit protection: check for existing batch with this idempotency key
    const existingBatch = await prisma.batch.findFirst({
      where: { idempotencyKey }
    });
    if (existingBatch) {
      res.status(409).json({
        success: false,
        error: 'Duplicate submission: A batch campaign with this idempotency key already exists.',
        existingBatchId: existingBatch.id,
        data: {
          id: existingBatch.id,
          name: existingBatch.name,
          status: existingBatch.status
        }
      });
      return;
    }

    if (!name || !agentId || !Array.isArray(recipients) || recipients.length === 0) {
      res.status(400).json({ success: false, error: 'Name, agentId, and non-empty recipients array are required.' });
      return;
    }

    // Consent confirmation check (Item 18)
    if (!consentConfirmed) {
      res.status(400).json({
        success: false,
        error: 'Explicit consent confirmation required: "I confirm these contacts have agreed to receive this call."'
      });
      return;
    }

    // Caller ID Truth (Item 16): numberId is strictly required for ALL users, including admin accounts
    if (!numberId) {
      res.status(400).json({
        success: false,
        error: 'Caller ID (numberId) is required for all batch campaigns. Please select a verified outbound number.'
      });
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

    let validatedNumberRecord: any = null;
    let validatedFromNumber: string | null = null;
    try {
      // Pass isAdmin = false to enforce that admins must use their real verified numbers
      const valRes = await CallService.validateCallerNumber(userId, numberId, false);
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

    // Check if the same user has an identical recipient list already running (Item 14)
    const incomingNormalized = eligibleRecipients
      .map((r: any) => String(typeof r === 'string' ? r : (r.phoneNumber || r.phone || '')).replace(/\D/g, ''))
      .filter(Boolean)
      .sort();

    const runningBatches = await prisma.batch.findMany({
      where: { userId, status: 'running' },
      include: { recipients: { select: { phoneNumber: true } } }
    });

    let duplicateRunningWarning: string | null = null;
    for (const rb of runningBatches) {
      const runningNormalized = rb.recipients
        .map(r => r.phoneNumber.replace(/\D/g, ''))
        .filter(Boolean)
        .sort();

      if (
        incomingNormalized.length > 0 &&
        incomingNormalized.length === runningNormalized.length &&
        incomingNormalized.every((val, idx) => val === runningNormalized[idx])
      ) {
        duplicateRunningWarning = `Warning: An identical recipient list (${incomingNormalized.length} contacts) is currently running in active batch '${rb.name}' (${rb.id}).`;
        logger.warn('Calendar batches: Duplicate running recipient list detected', {
          userId,
          activeBatchId: rb.id,
          activeBatchName: rb.name
        });
        break;
      }
    }

    const calculatedEstimatedMinutes = Number(estimatedMinutes) || Math.ceil(eligibleRecipients.length * 2);
    const delaySecs = Math.max(5, Math.min(300, Number(interCallDelaySeconds) || 10));

    // Immutable consent list hash (who, when, list hash)
    const consentListHash = crypto.createHash('sha256').update(JSON.stringify(eligibleRecipients)).digest('hex');

    const batch = await prisma.batch.create({
      data: {
        userId,
        agentId,
        fromPhoneNumberId: validatedNumberRecord?.id || null,
        name: name.trim(),
        status: initialStatus,
        idempotencyKey,
        consentConfirmed: true,
        consentConfirmedBy: consentConfirmedBy || user.email || user.id,
        consentConfirmedAt: new Date(),
        consentListHash,
        dialMode: dialMode === 'parallel' ? 'parallel' : 'sequential',
        interCallDelaySeconds: delaySecs,
        estimatedMinutes: calculatedEstimatedMinutes,
        scheduleConfig: JSON.stringify(scheduleConfig || {}),
        totalRecipients: eligibleRecipients.length,
        startedAt: initialStatus === 'running' ? new Date() : null,
        recipients: {
          create: eligibleRecipients.map((r: any, index: number) => ({
            position: index,
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

    // Record audit log
    await prisma.auditLog.create({
      data: {
        workspaceOwnerId: userId,
        actorUserId: userId,
        action: 'batch.started',
        targetId: batch.id,
        metadata: JSON.stringify({
          batchName: batch.name,
          totalContacts: batch.totalRecipients,
          dialMode: batch.dialMode,
          interCallDelaySeconds: batch.interCallDelaySeconds,
          consentListHash
        })
      }
    }).catch(err => logger.warn('Failed to record batch.started audit log', { error: String(err) }));

    if (initialStatus === 'running') {
      // Trigger background batch processing
      const { BatchService } = await import('../services/BatchService');
      BatchService.processBatch(batch.id, userId).catch(err => {
        logger.error('BatchService execution error', { batchId: batch.id, error: String(err) });
      });
    }

    logger.info(`Batch created successfully`, {
      batchId: batch.id,
      userId,
      totalRecipients: recipients.length,
      idempotencyKey,
      consentConfirmed: true
    });

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
        dialMode: batch.dialMode,
        interCallDelaySeconds: batch.interCallDelaySeconds,
        total: batch.totalRecipients,
        totalContacts: batch.totalRecipients,
        called: 0,
        connected: 0,
        estimatedMinutes: batch.estimatedMinutes,
        warning: duplicateRunningWarning || undefined,
        created: batch.createdAt.toISOString().slice(0, 10),
        createdAt: batch.createdAt.toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to create batch campaign', { error: String(error) });
    res.status(500).json({ success: false, error: 'Failed to create batch campaign' });
  }
});

/**
 * POST /api/v2/calendar/batches/:id/pause
 * Pause an active batch campaign. Finishes current call, dials nothing new.
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

    if (existing.status !== 'running' && existing.status !== 'scheduled') {
      return res.status(400).json({
        success: false,
        error: `Cannot pause batch in '${existing.status}' status.`
      });
    }

    await prisma.batch.updateMany({
      where: { id: batchId, userId },
      data: { status: 'paused', statusReason: 'User paused' }
    });

    // Record audit log
    await prisma.auditLog.create({
      data: {
        workspaceOwnerId: userId,
        actorUserId: userId,
        action: 'batch.paused',
        targetId: batchId,
        metadata: JSON.stringify({ batchName: existing.name })
      }
    }).catch(() => {});

    res.json({ success: true, message: 'Batch campaign paused.' });
  } catch (error) {
    logger.error('Failed to pause batch campaign', { error: String(error) });
    res.status(500).json({ success: false, error: 'Failed to pause batch campaign' });
  }
});

/**
 * POST /api/v2/calendar/batches/:id/resume
 * Resume a paused batch campaign. Allowed only from paused; cancelled is final.
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

    if (existing.status !== 'paused') {
      return res.status(400).json({
        success: false,
        error: `Cannot resume batch with status '${existing.status}'. Resuming is only permitted from paused state.`
      });
    }

    // One worker per batch check:
    if (existing.lockedBy && existing.lockedAt && (Date.now() - existing.lockedAt.getTime() < 60000)) {
      return res.json({ success: true, message: 'Batch campaign is already running.' });
    }

    await prisma.batch.updateMany({
      where: { id: batchId, userId },
      data: { status: 'running', statusReason: null }
    });

    // Record audit log
    await prisma.auditLog.create({
      data: {
        workspaceOwnerId: userId,
        actorUserId: userId,
        action: 'batch.resumed',
        targetId: batchId,
        metadata: JSON.stringify({ batchName: existing.name })
      }
    }).catch(() => {});

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
 * Cancel/stop a batch campaign. Marks all pending recipients as cancelled.
 * Optionally ends current live call via provider if endCurrentCall is true.
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

    const { endCurrentCall = false } = req.body || {};

    // 1. Mark batch as cancelled
    await prisma.batch.updateMany({
      where: { id: batchId, userId },
      data: { status: 'cancelled', completedAt: new Date() }
    });

    // 2. Mark not-yet-dialed pending recipients as cancelled
    await prisma.batchRecipient.updateMany({
      where: { batchId, status: 'pending' },
      data: {
        status: 'cancelled',
        lastError: 'Batch cancelled by user',
        lastErrorCode: 'CANCELLED'
      }
    });

    // 3. If requested, terminate any active call for this batch
    if (endCurrentCall) {
      const activeCalls = await prisma.call.findMany({
        where: {
          batchId,
          userId,
          status: { in: ['queued', 'ringing', 'in_progress', 'connected'] }
        }
      });

      const { callOrchestrator } = await import('../core/orchestrator/CallOrchestrator');
      for (const call of activeCalls) {
        try {
          await callOrchestrator.endCallSession(call.id, 'user_cancelled');
        } catch (termErr) {
          logger.warn('Failed to terminate active call on batch cancel', { callId: call.id, error: String(termErr) });
        }
        await prisma.batchRecipient.updateMany({
          where: { callId: call.id },
          data: {
            status: 'cancelled',
            lastError: 'Call terminated on batch cancellation',
            lastErrorCode: 'CANCELLED'
          }
        });
      }
    }

    // Record audit log
    await prisma.auditLog.create({
      data: {
        workspaceOwnerId: userId,
        actorUserId: userId,
        action: 'batch.cancelled',
        targetId: batchId,
        metadata: JSON.stringify({ batchName: existing.name, endCurrentCall })
      }
    }).catch(() => {});

    res.json({ success: true, message: 'Batch campaign cancelled.' });
  } catch (error) {
    logger.error('Failed to cancel batch campaign', { error: String(error) });
    res.status(500).json({ success: false, error: 'Failed to cancel batch campaign' });
  }
});

export default router;
