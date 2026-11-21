import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { CallController } from '../controllers/CallController';
import { validateBody, validateParams } from '../middleware/validation';
import { getUserIdFromRequest } from '../utils/auth';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { sensitiveOperationsLimiter, callActionLimiter } from '../middleware/rateLimiter';
import { requireAuth, requireEditor } from '../middleware/auth';
import { requireCallingMinutes } from '../middleware/planValidation';
import { getWebhookSigningSecret } from '../utils/security';
import { ADMIN_EMAIL } from '../config/constants';
import { isAllowedRecordingUrl } from '../services/RecordingService';
import { getWorkspaceDayBounds } from '../lib/calendar/timezone';

const router = Router();

/** Calls belong to the workspace, so team members see and act on its calls (audit #88). */
const workspaceOf = (req: any): string | null => req.effectiveWorkspaceId || getUserIdFromRequest(req);

// ─── Validation Schemas ──────────────────────────

const initiateCallSchema = z.object({
  phoneNumber: z
    .string()
    .min(7, 'Phone number too short')
    .max(16, 'Phone number too long'),
  agentId: z.string().uuid('agentId must be a valid UUID'),
  userId: z.string().optional(),
  fromPhoneNumber: z.string().optional(),
  record: z.boolean().optional(),
  isRecordingEnabled: z.boolean().optional(),
  userData: z.record(z.unknown()).optional(),
  maxDuration: z.number().int().min(30).max(7200).optional(),
});

const callIdParamSchema = z.object({
  callId: z.string().uuid('callId must be a valid UUID'),
});

// ─── Routes ──────────────────────────────────────



/** GET /api/v2/calls — List all calls (isolated to the authenticated userId). */
router.get(
  '/',
  async (req, res, next) => {
    try {
      const userId = (req as any).effectiveWorkspaceId || (req as any).userId || ((req as any).user && (req as any).user.id);
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { status, direction, search, agentId, batchId, dateRange, startDate, endDate } = req.query as {
        status?: string;
        direction?: string;
        search?: string;
        agentId?: string;
        batchId?: string;
        dateRange?: string;
        startDate?: string;
        endDate?: string;
      };

      const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const safeLimit = Math.min(isNaN(limitParam) ? 50 : Math.max(1, limitParam), 500);

      const offsetParam = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
      const safeOffset = isNaN(offsetParam) ? 0 : Math.max(0, offsetParam);

      const where: any = {
        userId: userId,
      };

      if (batchId && batchId !== 'all') {
        where.batchId = batchId;
      }

      if (direction === 'inbound' || direction === 'outbound') {
        where.callDirection = direction;
      }

      if (status && status !== 'all') {
        where.status = status;
      }

      if (agentId && agentId !== 'all') {
        where.agentId = agentId;
      }

      if (search && search.trim()) {
        const q = search.trim();
        where.OR = [
          { recipientPhoneNumber: { contains: q } },
          { fromPhoneNumber: { contains: q } },
          { summary: { contains: q } },
        ];
      }

      if (dateRange && dateRange !== 'all') {
        const now = new Date();
        const start = new Date();
        if (dateRange === 'today') {
          // Start of today in India, not in the server's UTC clock (audit #92: calls between 00:00 and
          // 05:30 IST were missing from Today).
          const istDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
          start.setTime(getWorkspaceDayBounds(istDate, 'Asia/Kolkata').startUtc.getTime());
        } else if (dateRange === '7d') {
          start.setDate(now.getDate() - 7);
        } else if (dateRange === '30d') {
          start.setDate(now.getDate() - 30);
        }
        where.createdAt = { gte: start };
      } else if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      const [totalCount, calls] = await Promise.all([
        prisma.call.count({ where }),
        prisma.call.findMany({
          where,
          include: {
            agent: {
              select: {
                name: true,
              },
            },
            batch: {
              select: {
                id: true,
                name: true,
              },
            },
            batchRecipients: {
              select: {
                lastError: true,
                lastErrorCode: true,
              },
              take: 1,
            },
            transcriptSegments: {
              select: { id: true },
              take: 1,
            },
            execution: {
              select: { transcript: true, recordingUrl: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: safeLimit,
          skip: safeOffset,
        }),
      ]);

      const normalizedCalls = calls.map((c) => {
        const durationSec = c.durationSeconds ?? 0;
        // Billing rule: every started minute of a connected call, at least 1 (0 when it never connected).
        const billedMins = durationSec > 0 ? Math.max(1, Math.ceil(durationSec / 60)) : 0;
        const inbound = c.callDirection === 'inbound';
        // Inbound rows store the caller in fromPhoneNumber and our number in recipientPhoneNumber.
        const contact = (inbound ? c.fromPhoneNumber : c.recipientPhoneNumber) || null;
        const business = (inbound ? c.recipientPhoneNumber : c.fromPhoneNumber) || null;
        const hasTrans = (c.transcriptSegments && c.transcriptSegments.length > 0) ||
          Boolean(c.execution && c.execution.transcript && c.execution.transcript !== '[]' && c.execution.transcript !== '');
        const recUrl = c.recordingUrl || c.execution?.recordingUrl || null;
        const recipientRecord = c.batchRecipients?.[0];

        return {
          id: c.id,
          batchId: c.batchId || null,
          batchName: c.batch?.name || null,
          direction: (inbound ? 'inbound' : 'outbound') as 'inbound' | 'outbound',
          callDirection: inbound ? 'inbound' : 'outbound',
          contactNumber: contact || '—',
          businessNumber: business || '—',
          // Fields the dashboard filters on (audit #76: agent call counts, contact history and the
          // inbound test-call radar read these, and the list never sent them).
          agentId: c.agentId,
          agent: { name: c.agent?.name || 'Voice Agent' },
          phoneNumber: contact,
          recipientPhoneNumber: c.recipientPhoneNumber || null,
          fromPhoneNumber: c.fromPhoneNumber || null,
          agentName: c.agent?.name || 'Voice Agent',
          status: c.status,
          startedAt: c.startTime ? c.startTime.toISOString() : (c.createdAt ? c.createdAt.toISOString() : null),
          endedAt: c.endTime ? c.endTime.toISOString() : null,
          durationSeconds: durationSec,
          duration: durationSec,
          billedMinutes: billedMins,
          hasTranscript: hasTrans,
          // The carrier link never leaves the server: play via GET /calls/:id/recording-link.
          hasRecording: isAllowedRecordingUrl(recUrl),
          recordingUrl: null,
          summary: c.summary || null,
          sentiment: c.sentiment || null,
          lastError: recipientRecord?.lastError || null,
          lastErrorCode: recipientRecord?.lastErrorCode || null,
          endReason: c.endReason || null,
          endDetail: c.endDetail || null,
          endedBy: c.endedBy || null,
          createdAt: c.createdAt.toISOString(),
        };
      });

      res.status(200).json({
        success: true,
        data: normalizedCalls,
        pagination: {
          total: totalCount,
          limit: safeLimit,
          offset: safeOffset,
          hasMore: safeOffset + normalizedCalls.length < totalCount,
        },
      });
    } catch (err: any) {
      logger.error('calls route: GET / failure', { error: err?.message || String(err) });
      res.status(500).json({
        success: false,
        // Never the raw database error (audit #156).
        error: 'Could not load your call history. Please refresh the page.',
      });
    }
  }
);

/** GET /api/v2/calls/live — Calls that are really live right now (Live Monitoring source of truth). */
/**
 * GET /api/v2/calls/:id/recording-link — owner only. Returns a 5-minute signed link to our stream
 * endpoint; the carrier's own link is never sent to the browser.
 */
router.get('/:id/recording-link', requireAuth, async (req, res) => {
  const userId = (req as any).effectiveWorkspaceId || getUserIdFromRequest(req);
  if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
  try {
    const { createPlaybackLink } = await import('../services/RecordingService');
    const link = await createPlaybackLink(String(userId), String(req.params.id));
    if (!link) { res.status(404).json({ success: false, error: 'No recording for this call.' }); return; }
    res.json({ success: true, data: link });
  } catch (err) {
    logger.error('Calls: recording link failed', { error: String(err) });
    res.status(500).json({ success: false, error: 'Could not open the recording.' });
  }
});

router.get('/live', async (req, res) => {
  try {
    const userId = (req as any).effectiveWorkspaceId || (req as any).userId || ((req as any).user && (req as any).user.id);
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const { getLiveCalls } = await import('../utils/concurrency');
    const batchId = typeof req.query.batchId === 'string' && req.query.batchId && req.query.batchId !== 'all' ? req.query.batchId : null;
    const rows = await getLiveCalls(userId, Date.now(), batchId);
    const data = rows.map((c: any) => ({
      id: c.id,
      direction: String(c.callDirection || '').toLowerCase() === 'inbound' ? 'inbound' : 'outbound',
      contactNumber: String(c.callDirection || '').toLowerCase() === 'inbound' ? c.fromPhoneNumber : c.recipientPhoneNumber,
      businessNumber: String(c.callDirection || '').toLowerCase() === 'inbound' ? c.recipientPhoneNumber : c.fromPhoneNumber,
      agentId: c.agentId || null,
      batchId: c.batchId || null,
      status: c.status,
      startedAt: (c.startTime || c.createdAt).toISOString(),
      createdAt: c.createdAt.toISOString(),
    }));
    res.status(200).json({ success: true, data, count: data.length });
  } catch (err: any) {
    logger.error('calls route: GET /live failure', { error: err?.message || String(err) });
    res.status(500).json({ success: false, error: 'Failed to load live calls' });
  }
});

/** POST /api/v2/calls — Initiate a new outbound call. */
router.post(
  '/',
  requireEditor,
  sensitiveOperationsLimiter,
  validateBody(initiateCallSchema),
  async (req, res, next) => {
    const userId = workspaceOf(req);
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    // Force set the authenticated userId in auth namespace to prevent body spoofing
    if (req && typeof req === 'object') {
      (req as any).auth = { userId };
    }
    next();
  },
  requireCallingMinutes,
  CallController.initiateCall
);

/** GET /api/v2/calls/:callId — Get call status and details. */
router.get(
  '/:callId',
  validateParams(callIdParamSchema),
  async (req, res, next) => {
    const userId = workspaceOf(req);
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const callId = req.params.callId as string;
    const exists = await prisma.call.findFirst({
      where: { id: callId, userId }
    });
    if (!exists) {
      res.status(404).json({ success: false, error: 'Call record not found or inaccessible' });
      return;
    }
    next();
  },
  CallController.getCallStatus
);

/** POST /api/v2/calls/:callId/terminate — End an active call. */
router.post(
  '/:callId/terminate',
  requireEditor,
  callActionLimiter,
  validateParams(callIdParamSchema),
  async (req, res, next) => {
    const userId = workspaceOf(req);
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const callId = req.params.callId as string;
    const exists = await prisma.call.findFirst({
      where: { id: callId, userId }
    });
    if (!exists) {
      res.status(404).json({ success: false, error: 'Call record not found or inaccessible' });
      return;
    }
    next();
  },
  CallController.terminateCall
);

/** GET /api/v2/calls/:callId/transcript — Get call transcript. */
router.get(
  '/:callId/transcript',
  validateParams(callIdParamSchema),
  async (req, res, next) => {
    const userId = workspaceOf(req);
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const callId = req.params.callId as string;
    const exists = await prisma.call.findFirst({
      where: { id: callId, userId }
    });
    if (!exists) {
      res.status(404).json({ success: false, error: 'Call record not found or inaccessible' });
      return;
    }
    next();
  },
  CallController.getCallTranscript
);

/** POST /api/v2/calls/:callId/transcript-ticket — Issue a short-lived ticket to connect to the live transcript WebSocket stream. */
router.post(
  '/:callId/transcript-ticket',
  callActionLimiter,
  validateParams(callIdParamSchema),
  async (req, res) => {
    try {
      const authenticatedUserId = (req as any).effectiveWorkspaceId || (req as any).auth?.userId || (req as any).userId || (req as any).user?.id || getUserIdFromRequest(req);
      if (!authenticatedUserId) {
        res.status(401).json({ success: false, error: 'Unauthorized: Authentication required' });
        return;
      }

      const callId = req.params.callId as string;
      const isAdmin = (req as any).user?.accountType === 'admin' || (req as any).user?.email === ADMIN_EMAIL;

      // Compound tenant filtering: caller must own the call or be an administrative operator
      const call = await prisma.call.findFirst({
        where: isAdmin ? { id: callId } : { id: callId, userId: authenticatedUserId },
        select: { id: true, userId: true },
      });

      if (!call) {
        res.status(404).json({ success: false, error: 'Call not found or inaccessible' });
        return;
      }

      const secret = getWebhookSigningSecret();
      const exp = Date.now() + 60 * 1000; // 60 seconds TTL
      const nonce = crypto.randomBytes(8).toString('hex');
      const payloadObj = { callId: call.id, userId: authenticatedUserId, exp, nonce };
      const payloadBase64 = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
      const sig = crypto.createHmac('sha256', secret).update(payloadBase64).digest('base64url');
      const ticket = `${payloadBase64}.${sig}`;

      res.status(200).json({
        success: true,
        data: {
          ticket,
          callId: call.id,
          expiresAt: exp,
        },
      });
    } catch (err: any) {
      logger.error('Error generating transcript ticket', { error: err.message });
      res.status(500).json({ success: false, error: 'Failed to generate transcript ticket' });
    }
  }
);

/** DELETE /api/v2/calls/:callId — Permanently delete a call log and its child executions. */
router.delete(
  '/:callId',
  requireEditor,
  callActionLimiter,
  validateParams(callIdParamSchema),
  async (req, res, next) => {
    try {
      const userId = workspaceOf(req);
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }
      const callId = req.params.callId as string;
      const exists = await prisma.call.findFirst({
        where: { id: callId, userId }
      });
      if (!exists) {
        res.status(404).json({ success: false, error: 'Call record not found' });
        return;
      }

      await prisma.execution.deleteMany({ where: { callId } }).catch(() => {});
      await prisma.transcriptSegment.deleteMany({ where: { callId } }).catch(() => {});
      await prisma.callEvent.deleteMany({ where: { callId } }).catch(() => {});
      await prisma.call.deleteMany({ where: { id: callId, userId } });

      res.json({ success: true, message: 'Call log deleted permanently from Supabase' });
    } catch (err) {
      next(err);
    }
  }
);

/** POST /api/v2/calls/:id/end — Supervisor intervention: Terminate live active call. */
router.post('/:id/end', requireAuth, requireEditor, sensitiveOperationsLimiter, CallController.endActiveCall);

/** POST /api/v2/calls/:id/transfer — Supervisor intervention: Force call transfer. */
router.post('/:id/transfer', requireAuth, requireEditor, sensitiveOperationsLimiter, CallController.transferActiveCall);

export default router;
