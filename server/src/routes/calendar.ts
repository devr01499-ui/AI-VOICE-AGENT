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
import { EncryptionService } from '../utils/EncryptionService';
import { CalendarService } from '../core/orchestrator/CalendarService';

const router = Router();

const getOauth2Client = () => {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || env.GOOGLE_REDIRECT_URI || `${env.FRONTEND_URL}/api/v2/calendar/callback`
  );
};

// Least-privilege OAuth scopes: free/busy read and appointment event creation only
const LEAST_PRIVILEGE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.freebusy',
  'https://www.googleapis.com/auth/calendar.events',
];

// In-memory single-use state nonce registry (15-minute TTL)
const activeStateNonces = new Map<string, { userId?: string; workspaceId?: string; expiresAt: number }>();
const consumedStateSignatures = new Set<string>();

function registerStateNonce(userId?: string, workspaceId?: string): string {
  const nonce = crypto.randomBytes(24).toString('hex');
  activeStateNonces.set(nonce, {
    userId,
    workspaceId,
    expiresAt: Date.now() + 15 * 60 * 1000,
  });
  return nonce;
}

function validateAndConsumeState(stateBase64: string): {
  valid: boolean;
  reason?: string;
  userId?: string;
  workspaceId?: string;
} {
  try {
    const raw = Buffer.from(stateBase64, 'base64').toString('utf-8');
    const { payload, signature } = JSON.parse(raw);
    const secret = getWebhookSigningSecret();
    const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    if (signature !== expectedSignature) {
      return { valid: false, reason: 'invalid_signature' };
    }

    // Replay protection: check signature / state hash
    if (consumedStateSignatures.has(signature)) {
      return { valid: false, reason: 'state_replayed' };
    }

    const parsedPayload = JSON.parse(payload);
    const { userId, workspaceId, nonce, timestamp } = parsedPayload;

    if (!timestamp || Date.now() - timestamp > 15 * 60 * 1000) {
      return { valid: false, reason: 'state_expired' };
    }

    // If nonce was issued by us, ensure it exists in activeStateNonces and consume it
    if (nonce) {
      if (!activeStateNonces.has(nonce)) {
        return { valid: false, reason: 'state_replayed' };
      }
      activeStateNonces.delete(nonce);
    }

    // Mark signature as consumed so crafted states cannot be replayed either
    consumedStateSignatures.add(signature);

    return { valid: true, userId, workspaceId };
  } catch (err: any) {
    return { valid: false, reason: 'malformed_state' };
  }
}

/**
 * POST /api/v2/calendar/connect-url
 * Returns a signed, single-use Google OAuth URL with least-privilege scopes.
 * Restricted to workspace owners and administrators.
 */
router.post('/connect-url', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId || getUserIdFromRequest(req);
    const workspaceId = (req as any).effectiveWorkspaceId || userId;
    const role = (req as any).workspaceRole || 'admin';

    if (role === 'viewer' || role === 'analyst') {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to connect calendar.' });
    }

    const nonce = registerStateNonce(userId, workspaceId);
    const payload = JSON.stringify({ userId, workspaceId, nonce, timestamp: Date.now() });
    const secret = getWebhookSigningSecret();
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const state = Buffer.from(JSON.stringify({ payload, signature })).toString('base64');

    const oauth2Client = getOauth2Client();
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: LEAST_PRIVILEGE_CALENDAR_SCOPES,
      state,
      include_granted_scopes: true,
    });

    res.json({ success: true, url });
  } catch (error: any) {
    logger.error('Failed to generate Google Calendar connect URL', { error: error.message });
    res.status(500).json({ error: 'Failed to generate connect URL' });
  }
});

/**
 * GET /api/v2/calendar/auth
 * Generates an OAuth URL and redirects to Google (302).
 * Supports browser direct navigations and tests without dropping unauthenticated sessions.
 */
router.get('/auth', (req, res) => {
  try {
    const userId = (req as any).userId || getUserIdFromRequest(req) || undefined;
    const workspaceId = (req as any).effectiveWorkspaceId || userId || undefined;

    const nonce = registerStateNonce(userId, workspaceId);
    const payload = JSON.stringify({ userId, workspaceId, nonce, timestamp: Date.now() });
    const secret = getWebhookSigningSecret();
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const state = Buffer.from(JSON.stringify({ payload, signature })).toString('base64');

    const oauth2Client = getOauth2Client();
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: LEAST_PRIVILEGE_CALENDAR_SCOPES,
      state,
      include_granted_scopes: true,
    });

    res.redirect(url);
  } catch (error: any) {
    logger.error('Failed to generate Google Calendar auth URL', { error: error.message });
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

/**
 * GET /api/v2/calendar/callback
 * Handles the OAuth callback from Google.
 * Verifies single-use state signature, stores encrypted tokens at rest, and redirects to frontend app URL.
 */
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    logger.error('Google Calendar OAuth error received from Google', { error });
    return res.redirect(`${env.FRONTEND_URL}/dashboard?calendar=error&reason=${encodeURIComponent(String(error))}`);
  }

  if (!code || !state) {
    return res.status(400).send('Missing code or state parameter');
  }

  try {
    const stateValidation = validateAndConsumeState(state as string);
    if (!stateValidation.valid) {
      logger.warn('Google Calendar OAuth callback: rejected state', { reason: stateValidation.reason });
      return res.redirect(
        `${env.FRONTEND_URL}/dashboard?calendar=error&reason=${encodeURIComponent(stateValidation.reason || 'invalid_state')}`
      );
    }

    const oauth2Client = getOauth2Client();
    const { tokens } = await oauth2Client.getToken(code as string);

    if (!tokens || (!tokens.access_token && !tokens.refresh_token)) {
      return res.redirect(`${env.FRONTEND_URL}/dashboard?calendar=error&reason=no_tokens_received`);
    }

    let targetUserId = stateValidation.userId;
    if (!targetUserId) {
      // If direct GET /auth without pre-authenticated session was used, identify user via Google tokeninfo
      try {
        oauth2Client.setCredentials(tokens);
        const tokenInfo = await oauth2Client.getTokenInfo(tokens.access_token as string);
        if (tokenInfo.email) {
          const matchedUser = await prisma.user.findFirst({
            where: { email: { equals: tokenInfo.email, mode: 'insensitive' } },
            select: { id: true },
          });
          targetUserId = matchedUser?.id;
        }
      } catch (err: any) {
        logger.warn('Could not derive user from token info', { error: err.message });
      }
    }

    if (!targetUserId) {
      return res.redirect(`${env.FRONTEND_URL}/dashboard?calendar=error&reason=user_not_identified`);
    }

    // Encrypt tokens at rest using AES-256-GCM
    const encryptedTokens = EncryptionService.encrypt(JSON.stringify(tokens));

    // Update user record with encrypted tokens
    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        googleCalendarTokens: encryptedTokens,
      },
    });

    // Invalidate free/busy cache
    CalendarService.clearCache();
    logger.info('Successfully connected Google Calendar with encrypted tokens', { userId: targetUserId });

    // Absolute redirect back to the application dashboard
    res.redirect(`${env.FRONTEND_URL}/dashboard?calendar=connected`);
  } catch (error: any) {
    logger.error('Failed to handle Google Calendar callback', { error: error.message });
    res.redirect(`${env.FRONTEND_URL}/dashboard?calendar=error&reason=${encodeURIComponent(error.message || 'callback_failed')}`);
  }
});

/**
 * GET /api/v2/calendar/status
 * Returns health status of the connected Google Calendar for the effective workspace.
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    const workspaceId = (req as any).effectiveWorkspaceId || (req as any).userId || getUserIdFromRequest(req);
    if (!workspaceId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const isConnected = await CalendarService.hasConnectedCalendar(workspaceId);
    if (!isConnected) {
      const user = await prisma.user.findUnique({
        where: { id: workspaceId },
        select: { googleCalendarTokens: true },
      });
      const hasTokens = !!user?.googleCalendarTokens;

      return res.json({
        connected: false,
        status: hasTokens ? 'needs_reauth' : 'disconnected',
        message: hasTokens
          ? 'Google Calendar credentials are invalid or revoked. Please reconnect.'
          : 'Google Calendar is not connected.',
      });
    }

    res.json({
      connected: true,
      status: 'healthy',
      lastCheckedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Failed to get Google Calendar status', { error: error.message });
    res.status(500).json({ error: 'Failed to get status' });
  }
});

/**
 * DELETE /api/v2/calendar/disconnect
 * Disconnects the Google Calendar: revokes token at Google (best effort) and purges database records.
 */
router.delete('/disconnect', requireAuth, async (req, res) => {
  try {
    const workspaceId = (req as any).effectiveWorkspaceId || (req as any).userId || getUserIdFromRequest(req);
    const role = (req as any).workspaceRole || 'admin';

    if (role === 'viewer' || role === 'analyst') {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to disconnect calendar.' });
    }

    if (!workspaceId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: workspaceId },
      select: { googleCalendarTokens: true },
    });

    if (user?.googleCalendarTokens) {
      const tokens = CalendarService.getDecryptedTokens(user.googleCalendarTokens);
      const tokenToRevoke = tokens?.refresh_token || tokens?.access_token;
      if (tokenToRevoke && tokenToRevoke !== 'revoked') {
        try {
          const oauth2Client = getOauth2Client();
          await oauth2Client.revokeToken(tokenToRevoke);
          logger.info('Successfully revoked Google Calendar token at Google', { workspaceId });
        } catch (revokeErr: any) {
          logger.warn('Best-effort Google token revoke returned error (continuing with local removal)', {
            error: revokeErr.message,
            workspaceId,
          });
        }
      }
    }

    await prisma.user.update({
      where: { id: workspaceId },
      data: { googleCalendarTokens: null },
    });

    CalendarService.clearCache();
    logger.info('Google Calendar disconnected cleanly', { workspaceId });
    res.json({ success: true, message: 'Google Calendar disconnected and access revoked.' });
  } catch (error: any) {
    logger.error('Failed to disconnect Google Calendar', { error: error.message });
    res.status(500).json({ error: 'Failed to disconnect calendar' });
  }
});

/**
 * DELETE /api/v2/calendar
 * Root path alias for disconnect.
 */
router.delete('/', requireAuth, async (req, res) => {
  try {
    const workspaceId = (req as any).effectiveWorkspaceId || (req as any).userId || getUserIdFromRequest(req);
    const role = (req as any).workspaceRole || 'admin';

    if (role === 'viewer' || role === 'analyst') {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to disconnect calendar.' });
    }

    if (!workspaceId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: workspaceId },
      select: { googleCalendarTokens: true },
    });

    if (user?.googleCalendarTokens) {
      const tokens = CalendarService.getDecryptedTokens(user.googleCalendarTokens);
      const tokenToRevoke = tokens?.refresh_token || tokens?.access_token;
      if (tokenToRevoke && tokenToRevoke !== 'revoked') {
        try {
          const oauth2Client = getOauth2Client();
          await oauth2Client.revokeToken(tokenToRevoke);
        } catch (revokeErr: any) {
          logger.warn('Best-effort Google token revoke failed', { error: revokeErr.message });
        }
      }
    }

    await prisma.user.update({
      where: { id: workspaceId },
      data: { googleCalendarTokens: null },
    });

    CalendarService.clearCache();
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to disconnect Google Calendar', { error: error.message });
    res.status(500).json({ error: 'Failed to disconnect calendar' });
  }
});

/**
 * GET /api/v2/calendar/bookings
 * Returns real scheduled bookings from ScheduledCall (does NOT fabricate from generic calls).
 */
router.get('/bookings', requireAuth, async (req, res) => {
  try {
    const workspaceId = (req as any).effectiveWorkspaceId || (req as any).userId || getUserIdFromRequest(req);
    if (!workspaceId) return res.status(401).json({ error: 'Unauthorized' });

    // Fetch workspace agent IDs
    const workspaceAgents = await prisma.agent.findMany({
      where: { userId: workspaceId },
      select: { id: true, name: true },
    });
    const agentIds = workspaceAgents.map((a) => a.id);
    const agentMap = new Map(workspaceAgents.map((a) => [a.id, a.name]));

    const scheduledCalls = await prisma.scheduledCall.findMany({
      where: {
        agentId: { in: agentIds },
        source: { in: ['ai_booked', 'manual', 'batch'] },
      },
      take: 50,
      orderBy: { scheduledAtUtc: 'desc' },
    });

    const bookings = scheduledCalls.map((sc) => ({
      id: sc.id,
      source: sc.source,
      agentId: sc.agentId,
      agentName: agentMap.get(sc.agentId) || 'AI Agent',
      phoneNumber: sc.phoneNumber,
      scheduledAtUtc: sc.scheduledAtUtc.toISOString(),
      timezone: sc.timezone,
      status: sc.status,
      notes: sc.notes || `Call via agent ${agentMap.get(sc.agentId) || sc.agentId.slice(0, 8)}`,
      createdAt: sc.createdAt.toISOString(),
    }));

    res.json(bookings);
  } catch (error: any) {
    logger.error('Failed to get calendar bookings', { error: error.message });
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
        completedCount: counters.attempted,
        completed: counters.attempted,
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
        completedCount: counters.attempted,
        completed: counters.attempted,
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
