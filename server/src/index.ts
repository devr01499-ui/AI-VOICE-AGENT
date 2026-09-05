/**
 * Bolna Server — Express Application Entrypoint
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
import { env } from './config/env';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import { WebSocketServer } from 'ws';

import { logger } from './utils/logger';
import { errorHandler } from './utils/errorHandler';
import { requestIdMiddleware } from './middleware/requestId';
import { initializeProviders } from './config/providers';
import { ProviderManager } from './providers/ProviderManager';
import { prisma } from './lib/prisma';
import { callOrchestrator } from './core/orchestrator/CallOrchestrator';
import { AudioStreamHandler } from './websockets/AudioStreamHandler';
import { eventBus, PROVIDER_EVENTS } from './core/provider-sdk/provider.events';

// ─── Routes ──────────────────────────────────────
import callRoutes from './routes/calls';
import agentRoutes from './routes/agents';
import numbersRoutes from './routes/numbers';
import { getUserIdFromRequest, verifySupabaseToken } from './utils/auth';
import webhookRoutes from './routes/webhooks';
import { SandboxStreamHandler } from './websockets/SandboxStreamHandler';
import { requireAuth } from './middleware/auth';
import { WebhookController } from './controllers/WebhookController';
import kbRoutes from './routes/knowledgeBase';
import userRoutes from './routes/user';
import contactRoutes from './routes/contact';
import teamRoutes from './routes/team';
import apikeysRoutes from './routes/apikeys';
import calendarRoutes from './routes/calendar';
import kycRoutes from './routes/kyc';
import billingRoutes from './routes/billing';
import telephonyRoutes from './routes/telephony';
import conductorRoutes from './routes/conductor';
import chatHistoryRoutes from './routes/chatHistory';
import contactsRoutes from './routes/contacts';
import analyticsRoutes from './routes/analytics';
import qaRoutes from './routes/qa';
import alertingRoutes from './routes/alerting';
import { AlertEvaluator } from './services/AlertEvaluator';
import { requireAuthOrApiKey } from './middleware/authWrapper';

// ─── Express App ─────────────────────────────────

const app = express();

// ── Security ──────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
const allowedOrigins = [
  'https://www.claritiy.com',
  'https://claritiy.com',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    const frontendOrigin = env.FRONTEND_URL ? (() => { try { return new URL(env.FRONTEND_URL).origin; } catch { return null; } })() : null;
    const isAllowedList = allowedOrigins.includes(origin) || (frontendOrigin !== null && origin === frontendOrigin);
    const isAnchoredDomain = /^https:\/\/(www\.)?claritiy\.com$/.test(origin) ||
                             /^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(origin) ||
                             /^https:\/\/[a-zA-Z0-9-]+\.onrender\.com$/.test(origin);

    if (isAllowedList || isAnchoredDomain) {
      callback(null, true);
    } else {
      callback(new Error('Cross-Origin Request Blocked by Security Policy'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-request-id', 'x-user-id']
}));

// ── Body Parsing ──────────────────────────────────
app.use(express.json({ 
  limit: '10mb',
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));
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

// ─── Health Check ────────────────────────────────

app.get('/health', async (_req, res) => {
  try {
    // Check database connectivity
    let dbHealthy = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbHealthy = true;
    } catch {
      dbHealthy = false;
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
    };

    // Core platform health returns status payload (ok / degraded)
    res.status(200).json({
      status: dbHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: { healthy: dbHealthy },
      providers,
      runtime,
    });
  } catch (err: any) {
    const refCode = `HEALTH-500-${Date.now()}`;
    logger.error(`Health status check failed [${refCode}]`, {
      error: err instanceof Error ? err.message : String(err),
      stack: err.stack,
      refCode,
    });
    const displayError = env.NODE_ENV === 'development'
      ? (err instanceof Error ? err.message : 'Unknown error')
      : `Internal Server Error (Reference: ${refCode})`;
    res.status(200).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: displayError,
    });
  }
});

import rateLimit from 'express-rate-limit';
import { CallController } from './controllers/CallController';

// ─── Rate Limiting ───────────────────────────────

const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});

const sensitiveOperationsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Rate limit exceeded for sensitive operation. Please wait before retrying.' },
});

app.use('/api/v2/', generalApiLimiter);

// ─── API Routes ──────────────────────────────────

app.use('/api/v2/calls', sensitiveOperationsLimiter, requireAuthOrApiKey, callRoutes);
app.post('/api/calls/outbound', sensitiveOperationsLimiter, requireAuthOrApiKey, CallController.initiateCall);
app.post('/api/v2/calls/outbound', sensitiveOperationsLimiter, requireAuthOrApiKey, CallController.initiateCall);
app.use('/api/v2/agents', requireAuth, agentRoutes);
app.use('/api/v2/numbers', requireAuth, numbersRoutes);
app.use('/api/v2/knowledge-base', requireAuth, kbRoutes);
app.use('/api/v2/user', requireAuth, userRoutes);
app.use('/api/v2/team', requireAuth, teamRoutes);
app.use('/api/v2/apikeys', requireAuth, apikeysRoutes);
app.use('/api/v2/webhooks', webhookRoutes);
app.use('/api/v2/calendar', calendarRoutes);
app.post('/api/v2/telephony/webhook', WebhookController.handleTelephonyWebhook);
app.use('/api/v2/contact', sensitiveOperationsLimiter, contactRoutes);
app.use('/api/v2/kyc', sensitiveOperationsLimiter, kycRoutes);
app.use('/api/v2/billing', sensitiveOperationsLimiter, requireAuth, billingRoutes);
app.use('/api/v2/telephony', requireAuth, telephonyRoutes);
app.use('/api/v2/conductor', requireAuth, conductorRoutes);
app.use('/api/v2/chat-history', requireAuth, chatHistoryRoutes);
app.use('/api/v2/contacts', requireAuth, contactsRoutes);
app.use('/api/v2/analytics', requireAuth, analyticsRoutes);
app.use('/api/v2/qa', requireAuth, qaRoutes);
app.use('/api/v2/alerting', requireAuth, alertingRoutes);

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
  logger.info('Bolna Server: starting...', {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
  });

  // Validate environment variables at startup — log warnings instead of hard-exiting on optional credentials
  if (!env.PUBLIC_URL || env.PUBLIC_URL.trim() === '') {
    logger.warn('Bolna Server: PUBLIC_URL not configured — telephony callbacks will require ngrok or explicit host configuration');
  }

  if (!env.VOBIZ_AUTH_ID || !env.VOBIZ_AUTH_TOKEN) {
    logger.warn('Bolna Server: Vobiz credentials missing — telephony features will degrade gracefully');
  }

  if (!env.GOOGLE_API_KEY && !env.OPENAI_API_KEY && !env.GEMINI_API_KEY) {
    logger.warn('Bolna Server: No LLM provider configured — runtime AI voice session initialization will require an API key');
  }

  logger.info('Bolna Server: Environment variable check complete ✓');

  // Verify database connectivity
  try {
    await prisma.$connect();
    logger.info('Bolna Server: database connected');
    
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
    logger.error('Bolna Server: database connection failed — server running in degraded mode', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Initialize providers (non-fatal if they fail)
  await initializeProviders();

  // Start background alerting evaluator worker
  AlertEvaluator.startBackgroundWorker();

  // Create HTTP server
  const server = http.createServer(app);

  // Create WebSocket server for audio streaming
  const wss = new WebSocketServer({
    noServer: true,
  });

  const audioHandler = new AudioStreamHandler();
  audioHandler.initialize(wss);

  // Create WebSocket server for browser clients to stream live transcripts
  const wssTranscript = new WebSocketServer({
    noServer: true,
  });

  // Create WebSocket server for browser client sandbox tester streams
  const wssSandbox = new WebSocketServer({
    noServer: true,
  });

  const sandboxHandler = new SandboxStreamHandler();
  sandboxHandler.initialize(wssSandbox);

  // Handle server upgrades manually to route requests to the correct WebSocket server
  server.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url ?? '', `http://${request.headers.host || 'localhost'}`);
      const pathname = url.pathname;

      if (pathname === '/audio-stream') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else if (pathname === '/live-transcript') {
        wssTranscript.handleUpgrade(request, socket, head, (ws) => {
          wssTranscript.emit('connection', ws, request);
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
      const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
      const callId = url.searchParams.get('callId');

      if (!callId) {
        ws.close(1008, 'Missing callId');
        return;
      }

      logger.info('Browser client connected to live-transcript stream', { callId });

      const onTranscript = (payload: any) => {
        if (payload.callId === callId) {
          ws.send(JSON.stringify({
            event: 'transcript',
            speaker: payload.speaker,
            text: payload.text,
            isFinal: payload.isFinal
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

  const PORT = parseInt(process.env.PORT || '3001', 10);
  const HOST = '0.0.0.0';

  // Start listening
  server.listen(PORT, HOST, () => {
    logger.info(`Claritiy Backend Server running natively on port ${PORT}`);
    logger.info(`Bolna Server: listening on port ${PORT}`, {
      health: `http://localhost:${PORT}/health`,
      api: `http://localhost:${PORT}/api/v2`,
      ws: `ws://localhost:${PORT}/audio-stream`,
    });

    // Call this method within the server listen block
    if (process.env.SEED_TEST_DATA === 'true') {
      seedTestEnvironment().catch(err => console.error("Database seed failure:", err));
    }

    logger.info('Bolna Server: ready ✓');
  });

  // ─── Graceful Shutdown ───────────────────────

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Bolna Server: ${signal} received, shutting down...`);

    // Stop accepting new connections
    server.close();

    // Shutdown active voice sessions
    try {
      await callOrchestrator.shutdownAll();
    } catch (err) {
      logger.error('Bolna Server: runtime shutdown error', {
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

    logger.info('Bolna Server: shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    logger.error('Bolna Server: uncaught exception', {
      error: err.message,
      stack: err.stack,
    });
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Bolna Server: unhandled rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
    });
  });
}

// ─── Run ─────────────────────────────────────────

bootstrap().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
