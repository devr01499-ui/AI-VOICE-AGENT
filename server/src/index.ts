/**
 * Claritiy Voice Server — Express Application Entrypoint
 *
 * Production-grade Express 5 server with:
 *   - Structured JSON request logging
 *   - Request ID tracking (X-Request-ID header)
 *   - CORS + Helmet security middleware
 *   - Health check with provider status
 *   - WebSocket upgrade for audio streaming
 *   - Graceful shutdown handling
 *
 * Starts on PORT from environment (default 3001).
 */

import 'dotenv/config';
import crypto from 'crypto';
import { env } from './config/env';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { isAllowedCorsOrigin } from './config/cors';
import { WS_MAX_AUDIO_MESSAGE_BYTES, WS_MAX_TRANSCRIPT_MESSAGE_BYTES } from './config/limits';
import http from 'http';
import { WebSocketServer } from 'ws';
import { getWebhookSigningSecret } from './utils/security';
import { ADMIN_EMAIL } from './config/constants';

import { logger } from './utils/logger';
import { errorHandler, AppError } from './utils/errorHandler';
import { requestIdMiddleware } from './middleware/requestId';
import { initializeProviders } from './config/providers';
import { ProviderManager } from './providers/ProviderManager';
import { prisma } from './lib/prisma';
import { callOrchestrator } from './core/orchestrator/CallOrchestrator';
import { AudioStreamHandler } from './websockets/AudioStreamHandler';
import { eventBus, PROVIDER_EVENTS } from './core/provider-sdk/provider.events';
import { GLOBAL_TELEPHONY_CAP } from './utils/concurrency';
import { eventLoopMonitor } from './utils/eventLoopMonitor';
import { drainActiveCalls } from './utils/gracefulShutdown';

let isShuttingDown = false;

// ─── Routes ──────────────────────────────────────
import callRoutes from './routes/calls';
import agentRoutes from './routes/agents';
import numbersRoutes from './routes/numbers';
import { verifySupabaseToken } from './utils/auth';
import webhookRoutes, { recordingStreamRouter } from './routes/webhooks';
import { DataRetentionJob } from './services/DataRetentionJob';
import { SandboxStreamHandler } from './websockets/SandboxStreamHandler';
import { requireAuth } from './middleware/auth';
import { WebhookController } from './controllers/WebhookController';
import kbRoutes, { KB_UPLOAD_PATH } from './routes/knowledgeBase';
import { KnowledgeBaseService } from './services/KnowledgeBaseService';
import { startPaymentReconciliation } from './services/PaymentReconciliationService';
import { mountUserRoutes } from './routes/user';
import contactRoutes from './routes/contact';
import teamRoutes from './routes/team';
import apikeysRoutes from './routes/apikeys';
import calendarRoutes from './routes/calendar';
import kycRoutes from './routes/kyc';
import billingRoutes from './routes/billing';
import chatHistoryRoutes from './routes/chatHistory';
import contactsRoutes from './routes/contacts';
import analyticsRoutes from './routes/analytics';
import qaRoutes from './routes/qa';
import alertingRoutes from './routes/alerting';
import auditLogRoutes from './routes/auditLog';
import reportsRoutes from './routes/reports';
import { AlertEvaluator } from './services/AlertEvaluator';
import { AnalysisWorker } from './workers/AnalysisWorker';
import { BatchService } from './services/BatchService';
import { requireAuthOrApiKey } from './middleware/authWrapper';
import { requireCallingMinutes } from './middleware/planValidation';
import { adminRouter } from './routes/adminRoutes';
import { razorpayWebhookRouter } from './routes/razorpayWebhook';
import { reapStuckCalls } from './utils/concurrency';

// ─── Express App ─────────────────────────────────

const app = express();

// Trust reverse proxy (e.g., Render, Cloudflare, load balancers)
// Ensures req.ip reflects real client IP from X-Forwarded-For (1st hop)
app.set('trust proxy', 1);

// Explicitly disable X-Powered-By header to prevent fingerprinting
app.disable('x-powered-by');

// ── Security Headers (OWASP A05 Hardening) ────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        connectSrc: ["'self'", 'wss:', 'ws:', 'https://api.vobiz.ai', 'https://*.supabase.co'],
        imgSrc: ["'self'", 'data:', 'https:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: {
      action: 'deny',
    },
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
    noSniff: true,
    dnsPrefetchControl: {
      allow: false,
    },
    permittedCrossDomainPolicies: {
      permittedPolicies: 'none',
    },
  })
);
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    // Strict allowlist; localhost origins only outside production (src/config/cors.ts).
    if (isAllowedCorsOrigin(origin, { nodeEnv: env.NODE_ENV, frontendUrl: env.FRONTEND_URL, adminOrigin: process.env.ADMIN_ORIGIN })) {
      callback(null, true);
    } else {
      // 403 with a clear code instead of a logged 500 "unexpected error" for every blocked origin.
      callback(new AppError(403, 'CORS_ORIGIN_BLOCKED', 'Cross-Origin Request Blocked by Security Policy'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-request-id', 'x-user-id', 'Idempotency-Key', 'idempotency-key']
}));

// ── Body Parsing ──────────────────────────────────
// Knowledge-base file uploads parse their own (larger, capped and concurrency-gated) body in the
// KB router; every other request keeps the 10 MB limit.
const defaultJsonParser = express.json({
  limit: '10mb',
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
});
app.use((req, res, next) => (req.path === KB_UPLOAD_PATH ? next() : defaultJsonParser(req, res, next)));
app.use(express.urlencoded({ extended: true }));

// ── Request ID ────────────────────────────────────
app.use(requestIdMiddleware);

// ── Request Logging ───────────────────────────────
app.use((req, _res, next) => {
  const requestId = req.headers['x-request-id'] as string;
  logger.info(`${req.method} ${req.path}`, {
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });
  next();
});

// ─── Health, Readiness & Liveness Probes ───────────

// Liveness Probe: lightweight event loop response check (returns 200)
app.get(['/live', '/healthz'], (_req, res) => {
  if (isShuttingDown) {
    res.status(503).json({
      status: 'shutting_down',
      message: 'Server is shutting down and draining active calls',
    });
    return;
  }
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    pid: process.pid,
    memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    eventLoop: eventLoopMonitor.getStats(),
  });
});

// Readiness & Health Probe: comprehensive dependency & database check
app.get(['/health', '/ready'], async (_req, res) => {
  if (isShuttingDown) {
    res.status(503).json({
      status: 'shutting_down',
      message: 'Server is shutting down and draining active calls',
    });
    return;
  }
  const startTime = Date.now();
  try {
    // Check database connectivity
    let dbHealthy = false;
    let dbLatencyMs = 0;
    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - dbStart;
      dbHealthy = true;
    } catch (dbErr) {
      dbHealthy = false;
      logger.error('Health probe: Database connectivity check failed', { error: String(dbErr) });
    }

    // Check provider health
    const providerManager = ProviderManager.instance;
    const providerHealth = await providerManager.healthCheckAll();

    const providers: Record<string, { healthy: boolean; latencyMs: number; details?: string }> = {};
    providerHealth.forEach((result, name) => {
      providers[name] = result;
    });

    // Runtime engine status
    const runtime = {
      activeCalls: callOrchestrator.getActiveCallCount(),
      activeSessions: callOrchestrator.getActiveCallCount(),
      globalTelephonyCap: GLOBAL_TELEPHONY_CAP,
    };

    // Analysis Queue Telemetry (M5)
    let analysisQueue = {
      healthy: true,
      queueDepth: 0,
      processingJobs: 0,
      failedJobs: 0,
      oldestPendingAgeSec: 0,
    };
    try {
      const [queueDepth, processingJobs, failedJobs, oldestPending] = await Promise.all([
        prisma.analysisJob.count({ where: { status: 'pending' } }),
        prisma.analysisJob.count({ where: { status: 'processing' } }),
        prisma.analysisJob.count({ where: { status: 'failed' } }),
        prisma.analysisJob.findFirst({
          where: {
            status: 'pending',
            nextRunAt: { lte: new Date() },
          },
          orderBy: { nextRunAt: 'asc' },
          select: { nextRunAt: true, createdAt: true },
        }),
      ]);
      const oldestPendingAgeSec = oldestPending
        ? Math.max(0, Math.floor((Date.now() - oldestPending.nextRunAt.getTime()) / 1000))
        : 0;
      const isQueueStalled = queueDepth > 200 || oldestPendingAgeSec > 600;
      if (isQueueStalled) {
        logger.warn('Health probe: Analysis queue lag or depth threshold reached', {
          queueDepth,
          oldestPendingAgeSec,
        });
      }
      analysisQueue = {
        healthy: !isQueueStalled,
        queueDepth,
        processingJobs,
        failedJobs,
        oldestPendingAgeSec,
      };
    } catch (qErr) {
      logger.warn('Health probe: Failed to inspect analysis job queue', { error: String(qErr) });
    }

    // Analysis lag must NEVER affect the health status or bring live calls down.
    // Report queue telemetry in payload for observability and alert separately.
    const overallHealthy = dbHealthy;
    const statusCode = overallHealthy ? 200 : 503;

    res.status(statusCode).json({
      status: overallHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      probeDurationMs: Date.now() - startTime,
      uptimeSeconds: Math.floor(process.uptime()),
      database: { healthy: dbHealthy, latencyMs: dbLatencyMs },
      providers,
      runtime,
      analysisQueue,
      eventLoop: eventLoopMonitor.getStats(),
    });
  } catch (err: any) {
    const refCode = `HEALTH-500-${Date.now()}`;
    logger.error(`Health status check failed [${refCode}]`, {
      error: err instanceof Error ? err.message : String(err),
      stack: err.stack,
      refCode,
    });
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: `Internal Server Error (Reference: ${refCode})`,
    });
  }
});

import { CallController } from './controllers/CallController';
import { generalApiLimiter, sensitiveOperationsLimiter } from './middleware/rateLimiter';

// ─── Rate Limiting ───────────────────────────────

app.use('/api/v2/', generalApiLimiter);

// ─── API Routes ──────────────────────────────────

// Reads (GET calls, logs, monitoring) are covered by generalApiLimiter (300/15min).
// Mutating call initiation routes are protected by sensitiveOperationsLimiter.
app.use('/api/v2/calls', requireAuthOrApiKey, callRoutes);
app.post('/api/calls/outbound', requireAuthOrApiKey, sensitiveOperationsLimiter, requireCallingMinutes, CallController.initiateCall);
app.post('/api/v2/calls/outbound', requireAuthOrApiKey, sensitiveOperationsLimiter, requireCallingMinutes, CallController.initiateCall);
app.use('/api/v2/agents', requireAuth, agentRoutes);
app.use('/api/v2/numbers', requireAuth, numbersRoutes);
app.use('/api/v2/knowledge-base', requireAuth, kbRoutes);
// Public pre-signup routes (validate-signup, consent) first, then the authenticated user API.
mountUserRoutes(app, requireAuth as any);
app.use('/api/v2/team', requireAuth, teamRoutes);
app.use('/api/v2/apikeys', requireAuth, apikeysRoutes);
app.use('/api/v2/webhooks', webhookRoutes);
app.use('/api/v2/recordings', recordingStreamRouter);
app.use('/api/v2/webhooks', razorpayWebhookRouter);
app.use('/api/v2/calendar', calendarRoutes);
app.post('/api/v2/telephony/webhook', WebhookController.handleTelephonyWebhook);
app.use('/api/v2/contact', contactRoutes);
app.use('/api/v2/kyc', kycRoutes);
app.use('/api/v2/billing', requireAuth, billingRoutes);
app.use('/api/v2/chat-history', requireAuth, chatHistoryRoutes);
app.use('/api/v2/contacts', requireAuth, contactsRoutes);
app.use('/api/v2/analytics', requireAuth, analyticsRoutes);
app.use('/api/v2/qa', requireAuth, qaRoutes);
app.use('/api/v2/alerting', requireAuth, alertingRoutes);
app.use('/api/v2/audit-logs', requireAuth, auditLogRoutes);
app.use('/api/v2/reports', requireAuth, reportsRoutes);

// Administrative Console API — Guarded by strict origin policy, RBAC and AAL2 MFA
const adminOrigin = process.env.ADMIN_ORIGIN || 'https://admin.claritiy.com';
app.use('/api/v2/admin', (req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    const isLocalhostAdmin = (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) && process.env.NODE_ENV !== 'production';
    const isProductionAdmin = origin === adminOrigin;
    if (!isLocalhostAdmin && !isProductionAdmin) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
  }
  next();
}, adminRouter);

// ─── 404 Handler ─────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
    },
  });
});

// ─── Error Handler ───────────────────────────────

app.use(errorHandler);

async function seedTestEnvironment() {
  const TEST_UUID = "1e69187e-82d5-4166-929f-4bbba90e5304";
  
  // Hydrate User Table
  await prisma.user.upsert({
    where: { id: TEST_UUID },
    update: {},
    create: {
      id: TEST_UUID,
      email: "devr01499@gmail.com",
      fullName: "Rohit Kumar Sha",
      passwordHash: "secure_dev_password_hash",
      billingBalance: 1000.0
    }
  });
}

// ─── Server Bootstrap ────────────────────────────

async function bootstrap(): Promise<void> {
  logger.info('Claritiy Voice Server: starting...', {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
  });

  // Validate environment variables at startup — log warnings instead of hard-exiting on optional credentials
  if (!env.PUBLIC_URL || env.PUBLIC_URL.trim() === '') {
    logger.warn('Claritiy Voice Server: PUBLIC_URL not configured — telephony callbacks will require ngrok or explicit host configuration');
  }

  // Gracefully degrade telephony if real Vobiz credentials are not configured yet in production
  if (env.NODE_ENV === 'production' && (!env.VOBIZ_AUTH_ID || !env.VOBIZ_AUTH_TOKEN || env.VOBIZ_AUTH_ID.includes('placeholder') || env.VOBIZ_AUTH_ID === 'MA_PLACEHOLDER')) {
    logger.warn('[TELEPHONY_DEGRADED] Production server starting WITHOUT live Vobiz credentials. Telephony calling will be disabled, but all HTTP APIs, dashboard, auth, and database remain fully operational.', {
      hasAuthId: Boolean(env.VOBIZ_AUTH_ID),
      hasAuthToken: Boolean(env.VOBIZ_AUTH_TOKEN),
    });
  } else if (!env.VOBIZ_AUTH_ID || !env.VOBIZ_AUTH_TOKEN || env.VOBIZ_AUTH_ID.includes('placeholder')) {
    logger.warn('Claritiy Voice Server: Vobiz credentials missing or placeholder — telephony features will degrade gracefully in non-production');
  }

  if (!env.GOOGLE_API_KEY && !env.OPENAI_API_KEY && !env.GEMINI_API_KEY) {
    logger.warn('Claritiy Voice Server: No LLM provider configured — runtime AI voice session initialization will require an API key');
  }

  logger.info('Claritiy Voice Server: Environment variable check complete ✓');

  // Create HTTP server
  const server = http.createServer(app);

  // Create WebSocket server for audio streaming
  // Message size caps (the ws default is 100 MB per message, enough for one connection to exhaust
  // the voice server's memory). Carrier audio frames are ~1 KB; browser tester chunks are a few KB.
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: WS_MAX_AUDIO_MESSAGE_BYTES,
  });

  const audioHandler = new AudioStreamHandler();
  audioHandler.initialize(wss);

  // Create WebSocket server for browser clients to stream live transcripts
  const wssTranscript = new WebSocketServer({
    noServer: true,
    maxPayload: WS_MAX_TRANSCRIPT_MESSAGE_BYTES,
  });

  // Create WebSocket server for browser client sandbox tester streams
  const wssSandbox = new WebSocketServer({
    noServer: true,
    maxPayload: WS_MAX_AUDIO_MESSAGE_BYTES,
  });

  const sandboxHandler = new SandboxStreamHandler();
  sandboxHandler.initialize(wssSandbox);

  // Sliding window replay cache for transcript ticket nonces
  const transcriptTicketNonceCache = new Map<string, number>();

  async function verifyTranscriptTicket(
    ticket: string,
    requestedCallId: string
  ): Promise<{ valid: boolean; userId?: string; reason?: string }> {
    try {
      const parts = ticket.split('.');
      if (parts.length !== 2) {
        return { valid: false, reason: 'Malformed ticket structure' };
      }

      const [payloadBase64, receivedSig] = parts;
      const secret = getWebhookSigningSecret();
      const expectedSig = crypto.createHmac('sha256', secret).update(payloadBase64).digest('base64url');

      if (
        receivedSig.length !== expectedSig.length ||
        !crypto.timingSafeEqual(Buffer.from(receivedSig), Buffer.from(expectedSig))
      ) {
        return { valid: false, reason: 'Cryptographic signature mismatch' };
      }

      const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf8');
      const payload = JSON.parse(payloadJson);

      if (!payload.callId || !payload.userId || !payload.exp || !payload.nonce) {
        return { valid: false, reason: 'Incomplete ticket payload' };
      }

      if (payload.callId !== requestedCallId) {
        return { valid: false, reason: 'Ticket callId does not match requested callId' };
      }

      if (Date.now() > payload.exp) {
        return { valid: false, reason: 'Ticket expired' };
      }

      // Replay protection: each ticket is single-use
      const now = Date.now();
      for (const [n, expTime] of transcriptTicketNonceCache.entries()) {
        if (now >= expTime) transcriptTicketNonceCache.delete(n);
      }
      if (transcriptTicketNonceCache.has(payload.nonce)) {
        return { valid: false, reason: 'Ticket nonce already consumed (replay attempt)' };
      }
      transcriptTicketNonceCache.set(payload.nonce, payload.exp);

      // Compound tenant isolation database check
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, accountType: true, email: true },
      });
      if (!user) {
        return { valid: false, reason: 'User record not found' };
      }

      const isAdmin = user.accountType === 'admin' || user.email === ADMIN_EMAIL;
      const call = await prisma.call.findFirst({
        where: isAdmin ? { id: requestedCallId } : { id: requestedCallId, userId: payload.userId },
        select: { id: true },
      });

      if (!call) {
        return { valid: false, reason: 'Tenant unauthorized for this call session' };
      }

      return { valid: true, userId: payload.userId };
    } catch (err: any) {
      return { valid: false, reason: err.message || 'Verification exception' };
    }
  }

  // Handle server upgrades manually to route requests to the correct WebSocket server
  server.on('upgrade', (request, socket, head) => {
    try {
      if (isShuttingDown) {
        logger.warn('WebSocket upgrade rejected — server is shutting down (1001 Going Away)');
        socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
        socket.destroy();
        return;
      }
      const rawUrl = (request.url ?? '').replace(/&amp;/g, '&');
      const url = new URL(rawUrl, `http://${request.headers.host || 'localhost'}`);
      const pathname = url.pathname.replace(/\/+$/, '') || '/';

      if (pathname === '/audio-stream' || pathname.endsWith('/audio-stream')) {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else if (pathname === '/live-transcript') {
        const ticket = url.searchParams.get('ticket');
        const callId = url.searchParams.get('callId');

        if (!ticket || !callId) {
          logger.warn('WebSocket upgrade rejected for /live-transcript — missing ticket or callId');
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        verifyTranscriptTicket(ticket, callId).then((result) => {
          if (!result.valid) {
            logger.warn('WebSocket upgrade rejected for /live-transcript — unauthorized ticket', {
              callId,
              reason: result.reason,
            });
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
          }

          wssTranscript.handleUpgrade(request, socket, head, (ws) => {
            (ws as any).authorizedCallId = callId;
            (ws as any).authenticatedUserId = result.userId;
            wssTranscript.emit('connection', ws, request);
          });
        }).catch((err) => {
          logger.error('Error during live-transcript WebSocket upgrade authentication', { callId, error: String(err) });
          socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
          socket.destroy();
        });
      } else if (pathname === '/api/v2/sandbox/test-stream') {
        const token = url.searchParams.get('token');
        if (!token) {
          logger.warn('WebSocket upgrade request rejected — missing auth session token');
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        verifySupabaseToken(token).then((verified) => {
          if (!verified) {
            logger.warn('WebSocket upgrade request rejected — invalid or expired auth session token');
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
          }

          wssSandbox.handleUpgrade(request, socket, head, (ws) => {
            wssSandbox.emit('connection', ws, request);
          });
        }).catch((err) => {
          logger.error('Error during WebSocket upgrade authentication', { error: String(err) });
          socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
          socket.destroy();
        });
      } else {
        logger.warn('WebSocket upgrade request rejected — unhandled path', { pathname });
        socket.destroy();
      }
    } catch (err) {
      logger.error('Error handling WebSocket upgrade', { error: String(err) });
      socket.destroy();
    }
  });

  wssTranscript.on('connection', (ws, req) => {
    try {
      const authorizedCallId = (ws as any).authorizedCallId;
      if (!authorizedCallId) {
        ws.close(1008, 'Unauthorized stream connection');
        return;
      }
      const callId = authorizedCallId;

      logger.info('Browser client connected to live-transcript stream', { callId });

      const onTranscript = (payload: any) => {
        if (payload.callId === callId) {
          ws.send(JSON.stringify({
            event: 'transcript',
            turnId: payload.turnId,
            seq: payload.seq,
            speaker: payload.speaker,
            text: payload.text,
            isFinal: Boolean(payload.isFinal)
          }));
        }
      };

      const onStoppedSpeaking = (payload: any) => {
        if (payload.callId === callId && payload.interrupted) {
          ws.send(JSON.stringify({
            event: 'interrupted'
          }));
        }
      };

      eventBus.subscribe(PROVIDER_EVENTS.TRANSCRIPT_UPDATED, onTranscript);
      eventBus.subscribe(PROVIDER_EVENTS.AI_STOPPED_SPEAKING, onStoppedSpeaking);

      ws.on('close', () => {
        logger.info('Browser client disconnected from live-transcript stream', { callId });
        eventBus.unsubscribe(PROVIDER_EVENTS.TRANSCRIPT_UPDATED, onTranscript);
        eventBus.unsubscribe(PROVIDER_EVENTS.AI_STOPPED_SPEAKING, onStoppedSpeaking);
      });

      ws.on('error', (err) => {
        logger.error('Browser live-transcript WebSocket error', { callId, error: err.message });
      });

    } catch (err) {
      logger.error('Error in live-transcript connection', { error: String(err) });
      ws.close(1011, 'Internal Server Error');
    }
  });

  const PORT = parseInt(process.env.PORT || (env.NODE_ENV === 'production' ? '10000' : '3001'), 10);
  const HOST = '0.0.0.0';

  // Start listening immediately so cloud port scanner succeeds without delay
  server.listen(PORT, HOST, async () => {
    logger.info(`Claritiy Backend Server running natively on port ${PORT}`);
    const isStrictAuth = process.env.ENABLE_STRICT_AUTH === 'true';
    logger.info(`[ADMIN_AUTH] Strict administrative authentication configured: ${isStrictAuth ? 'ENABLED (fail-closed)' : 'DISABLED (FAIL-CLOSED: STRICT_AUTH MANDATORY)'}`, {
      ENABLE_STRICT_AUTH: process.env.ENABLE_STRICT_AUTH || 'unset',
      strictMode: isStrictAuth,
    });
    logger.info(`Claritiy Voice Server: listening on port ${PORT}`, {
      health: `http://localhost:${PORT}/health`,
      api: `http://localhost:${PORT}/api/v2`,
      ws: `ws://localhost:${PORT}/audio-stream`,
    });

    // Verify database connectivity
    try {
      await prisma.$connect();
      logger.info('Claritiy Voice Server: database connected');
      
      if (env.NODE_ENV !== 'production') {
        // Seed default workspace user to prevent multi-tenant lookups failing
        await prisma.user.upsert({
          where: { id: '1e69187e-82d5-4166-929f-4bbba90e5304' },
          update: {},
          create: {
            id: '1e69187e-82d5-4166-929f-4bbba90e5304',
            email: 'devr01499@gmail.com',
            fullName: 'Rohit Kumar Sha',
            passwordHash: 'seeded-dev-hash-12345',
            billingBalance: 1000.0, // Seed 1000 credits
          }
        });
      }
    } catch (err) {
      logger.error('Claritiy Voice Server: database connection failed — server running in degraded mode', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Knowledge-base documents a restart left "queued"/"processing" go back on the indexing queue.
    KnowledgeBaseService.resumePendingIngestions().catch((err) => {
      logger.warn('Knowledge base: could not resume pending indexing jobs', { error: err instanceof Error ? err.message : String(err) });
    });

    // One-time repair: verified accounts were left with calls blocked (audit #2).
    import('./utils/kycStatus')
      .then(async ({ repairVerifiedCallBlocks, repairInactiveInboundNumbers }) => {
        const restored = await repairInactiveInboundNumbers(); // audit #79
        if (restored > 0) logger.info('Numbers: restored outbound on numbers switched to inbound-off', { count: restored });
        return repairVerifiedCallBlocks();
      })
      .then((n) => { if (n > 0) logger.info('KYC: unblocked calls for verified accounts', { count: n }); })
      .catch((err) => logger.warn('KYC: call-block repair skipped', { error: err instanceof Error ? err.message : String(err) }));

    // Initialize providers (non-fatal if they fail)
    try {
      await initializeProviders();
    } catch (err) {
      logger.error('Claritiy Voice Server: provider initialization error', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Gemini Live boot self-test: verifies production setup builder and API readiness
    try {
      const { GeminiLiveProvider } = await import('./providers/gemini/GeminiLiveProvider');
      await GeminiLiveProvider.runStartupSelfTest();
    } catch (testErr) {
      logger.warn('Claritiy Voice Server: Gemini Live startup self-test warning', { error: String(testErr) });
    }

    // Start background rule evaluation worker
    AlertEvaluator.startBackgroundWorker(60000);

    // Start background analysis queue worker (5s evaluation cycle)
    AnalysisWorker.startBackgroundWorker(5000);

    // Payments: every 15 min, make sure every captured payment was fulfilled (no-op without keys).
    startPaymentReconciliation();

    // KYC: switch every customer's Vobiz sub-account to customer_use so Vobiz verifies each user's
    // own KYC (older ones inherited Claritiy's master KYC). Retries every 30 min until done.
    import('./services/VobizKycModeService')
      .then(({ startKycModeMigration }) => startKycModeMigration())
      .catch((err) => logger.warn('KYC: customer_use migration not started', { error: err instanceof Error ? err.message : String(err) }));

    // Plans: hourly, lapse minutes at the 30-day end, warn, and release numbers 5 days after a plan
    // ends (minutes used up or 30 days, whichever first) so carriers stop billing unused numbers.
    import('./services/PlanLifecycleService')
      .then(({ startPlanLifecycle }) => startPlanLifecycle())
      .catch((err) => logger.warn('Plans: lifecycle job not started', { error: err instanceof Error ? err.message : String(err) }));

    // Follow-up calls the agent booked: every minute, dial the ones that are due (audit #148).
    import('./services/ScheduledCallService')
      .then(({ startScheduledCallExecutor }) => startScheduledCallExecutor())
      .catch((err) => logger.warn('Scheduled calls: executor not started', { error: err instanceof Error ? err.message : String(err) }));

    // Business numbers: every 15 min, pick up carrier review results for business KYC.
    import('./services/PlivoComplianceService')
      .then(({ startPlivoCompliancePoll }) => startPlivoCompliancePoll())
      .catch((err) => logger.warn('Business KYC: poll not started', { error: err instanceof Error ? err.message : String(err) }));

    // Data retention (DPDP): purge expired calls and recordings every hour. It was never started before.
    DataRetentionJob.startBackgroundWorker();

    // Boot recovery & 60s background cycle for batch campaigns & stuck calls
    Promise.all([
      BatchService.recoverStaleBatches(),
      reapStuckCalls()
    ]).catch(err => {
      logger.error('Claritiy Voice Server: boot recovery error', { error: String(err) });
    });
    setInterval(() => {
      Promise.all([
        BatchService.recoverStaleBatches(),
        reapStuckCalls()
      ]).catch(err => {
        logger.error('Claritiy Voice Server: background recovery error', { error: String(err) });
      });
    }, 60000);

    // Call this method within the server listen block
    if (process.env.SEED_TEST_DATA === 'true') {
      seedTestEnvironment().catch(err => console.error("Database seed failure:", err));
    }

    logger.info('Claritiy Voice Server: ready ✓');
    eventLoopMonitor.start(() => callOrchestrator.getActiveCallCount());
  });

  // ─── Graceful Shutdown ───────────────────────

  let shutdownInProgress = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shutdownInProgress) return;
    shutdownInProgress = true;
    isShuttingDown = true;

    logger.info(`Claritiy Voice Server: ${signal} received, beginning graceful drain...`);

    // Stop event loop monitor
    eventLoopMonitor.stop();

    // Stop background queue workers
    AnalysisWorker.stopBackgroundWorker();

    // Stop accepting new connections
    server.close();

    // Drain active voice sessions up to SHUTDOWN_DRAIN_SECONDS
    await drainActiveCalls({
      getActiveCount: () => audioHandler.getActiveConnectionCount(),
    });

    // Shutdown remaining voice sessions
    try {
      await callOrchestrator.shutdownAll();
    } catch (err) {
      logger.error('Claritiy Voice Server: runtime shutdown error', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Close WebSocket connections
    try {
      await audioHandler.closeAll();
      wss.close();
    } catch {
      // Ignore
    }

    // Disconnect database
    try {
      await prisma.$disconnect();
    } catch {
      // Ignore
    }

    logger.info('Claritiy Voice Server: shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    logger.error('Claritiy Voice Server: uncaught exception', {
      error: err.message,
      stack: err.stack,
    });
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Claritiy Voice Server: unhandled rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
    });
  });
}

// ─── Run ─────────────────────────────────────────

bootstrap().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
