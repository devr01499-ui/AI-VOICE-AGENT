import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { CallController } from '../controllers/CallController';
import { validateBody, validateParams } from '../middleware/validation';
import { getUserIdFromRequest } from '../utils/auth';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { EncryptionService } from '../utils/EncryptionService';
import { sensitiveOperationsLimiter } from '../middleware/rateLimiter';
import { requireAuth } from '../middleware/auth';
import { requireCallingMinutes, requireActivePlan } from '../middleware/planValidation';
import { getWebhookSigningSecret } from '../utils/security';
import { ADMIN_EMAIL } from '../config/constants';

const router = Router();

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
          start.setHours(0, 0, 0, 0);
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
        const billedMins = Math.ceil(durationSec / 60);
        const hasTrans = (c.transcriptSegments && c.transcriptSegments.length > 0) ||
          Boolean(c.execution && c.execution.transcript && c.execution.transcript !== '[]' && c.execution.transcript !== '');
        const recUrl = c.recordingUrl || c.execution?.recordingUrl || null;
        const recipientRecord = c.batchRecipients?.[0];

        return {
          id: c.id,
          batchId: c.batchId || null,
          batchName: c.batch?.name || null,
          direction: (c.callDirection === 'inbound' ? 'inbound' : 'outbound') as 'inbound' | 'outbound',
          contactNumber: c.recipientPhoneNumber || '—',
          businessNumber: c.fromPhoneNumber || '—',
          agentName: c.agent?.name || 'Voice Agent',
          status: c.status,
          startedAt: c.startTime ? c.startTime.toISOString() : (c.createdAt ? c.createdAt.toISOString() : null),
          endedAt: c.endTime ? c.endTime.toISOString() : null,
          durationSeconds: durationSec,
          billedMinutes: billedMins,
          hasTranscript: hasTrans,
          hasRecording: Boolean(recUrl),
          recordingUrl: recUrl,
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
        error: err?.message || 'Failed to fetch call history records',
      });
    }
  }
);

/** POST /api/v2/calls — Initiate a new outbound call. */
router.post(
  '/',
  sensitiveOperationsLimiter,
  validateBody(initiateCallSchema),
  async (req, res, next) => {
    const userId = getUserIdFromRequest(req);
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

/** GET /api/v2/calls/debug/gemini — Diagnostic endpoint for Gemini Live WebSocket connection. */
router.get(
  '/debug/gemini',
  async (req, res) => {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { prisma } = await import('../lib/prisma');
    const { ADMIN_EMAIL } = await import('../config/constants');
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || (user.accountType !== 'admin' && user.email !== ADMIN_EMAIL)) {
      return res.status(403).json({ success: false, error: 'Access Denied: Admin privileges required for diagnostic endpoint.' });
    }

    let geo: any = {};
    try {
      // Query server public IP geo-location
      const geoRes = await fetch('http://ip-api.com/json/');
      if (geoRes.ok) {
        geo = await geoRes.json();
      }
    } catch (e) {
      geo = { error: 'Failed to fetch geo-ip' };
    }

    try {
      const { GeminiLiveProvider } = await import('../providers/gemini/GeminiLiveProvider');
      const { env } = await import('../config/env');
      
      const apiVersion = (req.query.version as string) || env.GEMINI_API_VERSION || 'v1beta';
      const modelName = (req.query.model as string) || env.GEMINI_REALTIME_MODEL || 'gemini-2.0-flash';

      const provider = new GeminiLiveProvider();
      const apiKey = provider.getApiKey();

      // Early REST API key validation check
      const keyError = await provider.verifyApiKey(apiKey);
      if (keyError) {
        return res.status(400).json({
          success: false,
          error: `API key validation failed: ${keyError}`,
          geminiKeyPrefix: apiKey ? apiKey.substring(0, 6) : 'missing',
          geminiKeyLength: apiKey ? apiKey.length : 0,
          geo,
        });
      }

      const config = {
        callId: 'sandbox-0000-0000-0000-000000000000',
        userId: userId,
        model: modelName,
        voice: 'alloy',
        instructions: 'Test.',
        apiVersion,
      } as any;
      const callbacks = {};
      const result = await provider.createSession(config, callbacks);
      await provider.closeSession(result.sessionId);
      res.json({ success: true, apiVersion, model: modelName, sessionId: result.sessionId, geo });
    } catch (err: any) {
      const refCode = `CALLS-DEBUG-500-${Date.now()}`;
      const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
      const openaiKey = process.env.OPENAI_API_KEY || '';

      logger.error(`Calls debug/gemini Exception [${refCode}]`, {
        error: err.message || String(err),
        stack: err.stack,
        refCode,
      });

      if (env.NODE_ENV === 'production') {
        res.status(500).json({
          success: false,
          error: `An unexpected error occurred during debug execution (Reference: ${refCode})`,
        });
      } else {
        res.status(500).json({
          success: false,
          error: err.message || String(err),
          geminiKeyPrefix: geminiKey ? geminiKey.substring(0, 6) : 'missing',
          geminiKeyLength: geminiKey ? geminiKey.length : 0,
          openaiKeyPrefix: openaiKey ? openaiKey.substring(0, 6) : 'missing',
          openaiKeyLength: openaiKey ? openaiKey.length : 0,
          geo,
          stack: err.stack,
        });
      }
    }
  }
);

/** GET /api/v2/calls/:callId — Get call status and details. */
router.get(
  '/:callId',
  validateParams(callIdParamSchema),
  async (req, res, next) => {
    const userId = getUserIdFromRequest(req);
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
  validateParams(callIdParamSchema),
  async (req, res, next) => {
    const userId = getUserIdFromRequest(req);
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
    const userId = getUserIdFromRequest(req);
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

/** POST /api/v2/calls/sip-trunks — Register a new SIP Trunk. */
router.post(
  '/sip-trunks',
  requireAuth,
  sensitiveOperationsLimiter,
  requireActivePlan,
  async (req, res, next) => {
    try {
      const { name, sipUri, username, password, outboundProxy } = req.body;
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }
      
      const trunk = await prisma.sipTrunk.create({
        data: {
          userId,
          name: name || 'Primary SIP Trunk',
          sipUri,
          username,
          password: password ? EncryptionService.encrypt(password) : undefined,
          outboundProxy,
          codecs: '["PCMU","PCMA"]',
          dtmfMode: 'rfc2833',
          status: 'active'
        }
      });
      
      res.status(201).json({ success: true, data: trunk });
    } catch (err) {
      next(err);
    }
  }
);

/** DELETE /api/v2/calls/:callId — Permanently delete a call log and its child executions. */
router.delete(
  '/:callId',
  validateParams(callIdParamSchema),
  async (req, res, next) => {
    try {
      const userId = getUserIdFromRequest(req);
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
router.post('/:id/end', requireAuth, sensitiveOperationsLimiter, CallController.endActiveCall);

/** POST /api/v2/calls/:id/transfer — Supervisor intervention: Force call transfer. */
router.post('/:id/transfer', requireAuth, sensitiveOperationsLimiter, CallController.transferActiveCall);

export default router;
