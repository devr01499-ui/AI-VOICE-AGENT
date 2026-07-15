import { Router } from 'express';
import { z } from 'zod';
import { CallController } from '../controllers/CallController';
import { validateBody, validateParams } from '../middleware/validation';
import { getUserIdFromRequest } from '../utils/auth';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

const router = Router();

// ─── Validation Schemas ──────────────────────────

const initiateCallSchema = z.object({
  phoneNumber: z
    .string()
    .min(7, 'Phone number too short')
    .max(16, 'Phone number too long'),
  agentId: z.string().uuid('agentId must be a valid UUID'),
  userId: z.string().optional(),
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
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { status, limit, offset } = req.query as {
        status?: string;
        limit?: string;
        offset?: string;
      };

      let calls = [];
      try {
        calls = await prisma.call.findMany({
          where: {
            userId: userId,
            ...(status ? { status } : {}),
          },
          include: {
            agent: {
              select: {
                name: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: limit ? parseInt(limit, 10) : 50,
          skip: offset ? parseInt(offset, 10) : 0,
        });
      } catch (error: any) {
        logger.error("Handled Gracefully - Call Repository Retrieval Exception:", { error: error?.message || String(error) });
        // Instantly return a native, flat fallback JSON array
        res.status(200).json([]);
        return;
      }

      res.json({
        success: true,
        data: calls,
      });
    } catch (err) {
      next(err);
    }
  }
);

/** POST /api/v2/calls — Initiate a new outbound call. */
router.post(
  '/',
  validateBody(initiateCallSchema),
  async (req, res, next) => {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    // Force set the authenticated userId in body to prevent body spoofing
    req.body.userId = userId;
    next();
  },
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
        callId: '00000000-0000-0000-0000-000000000000',
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
      const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
      const openaiKey = process.env.OPENAI_API_KEY || '';
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

/** POST /api/v2/calls/sip-trunks — Register a new SIP Trunk. */
router.post(
  '/sip-trunks',
  async (req, res, next) => {
    try {
      const { name, sipUri, username, password, outboundProxy } = req.body;
      const userId = getUserIdFromRequest(req) || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      
      const trunk = await prisma.sipTrunk.create({
        data: {
          userId,
          name: name || 'Primary SIP Trunk',
          sipUri,
          username,
          password,
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

export default router;
