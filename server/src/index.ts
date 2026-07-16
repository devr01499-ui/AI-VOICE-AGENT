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
import analyticsRoutes from './routes/analytics';
import userRoutes from './routes/user';

// ─── Express App ─────────────────────────────────

const app = express();

// ── Security ──────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
const allowedOrigins = [
  'https://www.insightclaritiysolution.com',
  'https://insightclaritiysolution.com',
  'http://localhost:5173',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow serverless tasks or matching white-listed origins cleanly
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Cross-Origin Request Blocked by CTO CORS Security Policy'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// ── Body Parsing ──────────────────────────────────
app.use(express.json({ limit: '10mb' }));
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

    const allHealthy = dbHealthy && Array.from(providerHealth.values()).every((r) => r.healthy);

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: { healthy: dbHealthy },
      providers,
      runtime,
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

import { CallController } from './controllers/CallController';

// ─── API Routes ──────────────────────────────────

app.use('/api/v2/calls', requireAuth, callRoutes);
app.post('/api/calls/outbound', (req, res, next) => {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  req.body.userId = userId;
  next();
}, CallController.initiateCall);
app.post('/api/v2/calls/outbound', requireAuth, CallController.initiateCall);
app.use('/api/v2/agents', requireAuth, agentRoutes);
app.use('/api/v2/numbers', requireAuth, numbersRoutes);
app.use('/api/v2/knowledge-base', requireAuth, kbRoutes);
app.use('/api/v2/analytics', requireAuth, analyticsRoutes);
app.use('/api/v2/user', requireAuth, userRoutes);
app.use('/api/v2/webhooks', webhookRoutes);
app.post('/api/v2/telephony/webhook', WebhookController.handleTelephonyWebhook);

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
  const TEST_UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  
  console.log("CTO Audit: Running core system data rehydration checks...");
  
  // Hydrate User Table
  await prisma.user.upsert({
    where: { id: TEST_UUID },
    update: {},
    create: {
      id: TEST_UUID,
      email: "cto-test@clarity.ai",
      fullName: "Core Tester",
      passwordHash: "secure_dev_password_hash",
      billingBalance: 1000.0
    }
  });

  // Hydrate Agent Table
  await prisma.agent.upsert({
    where: { id: TEST_UUID },
    update: {
      name: "Clarity HR Customer Support Screener",
      systemPrompt: "You are Clarity AI, a highly professional senior HR recruiter running a phone screening interview for a Customer Support role. Speak in a warm, friendly, smooth, and highly conversational tone, just like a supportive human interviewer. Pause naturally and wait for candidate responses. Never output markdown formatting or bullet points. Your screening flow consists of three distinct questions: 1. \"First, could you share a specific situation where you successfully resolved a conflict with a frustrated customer?\" 2. \"Second, how do you manage high call volumes while keeping a positive and warm tone throughout the day?\" 3. \"And finally, what are your expected salary bounds for this Customer Support position?\" Be polite, listen actively, and say \"uh-huh\" or \"got it\" when they finish speaking to show smooth, realistic turn-taking. If they talk over you, stop speaking immediately.",
      voiceName: "Puck",
      model: "models/gemini-2.5-flash-native-audio-latest"
    },
    create: {
      id: TEST_UUID,
      userId: TEST_UUID,
      name: "Clarity HR Customer Support Screener",
      systemPrompt: "You are Clarity AI, a highly professional senior HR recruiter running a phone screening interview for a Customer Support role. Speak in a warm, friendly, smooth, and highly conversational tone, just like a supportive human interviewer. Pause naturally and wait for candidate responses. Never output markdown formatting or bullet points. Your screening flow consists of three distinct questions: 1. \"First, could you share a specific situation where you successfully resolved a conflict with a frustrated customer?\" 2. \"Second, how do you manage high call volumes while keeping a positive and warm tone throughout the day?\" 3. \"And finally, what are your expected salary bounds for this Customer Support position?\" Be polite, listen actively, and say \"uh-huh\" or \"got it\" when they finish speaking to show smooth, realistic turn-taking. If they talk over you, stop speaking immediately.",
      voiceName: "Puck",
      model: "models/gemini-2.5-flash-native-audio-latest"
    }
  });
  
  console.log("CTO Audit: Test framework data entities seeded successfully.");
}

// ─── Server Bootstrap ────────────────────────────

async function bootstrap(): Promise<void> {
  logger.info('Bolna Server: starting...', {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
  });

  // Validate critical environment variables at startup
  if (!env.PUBLIC_URL || env.PUBLIC_URL.trim() === '') {
    logger.error('Bolna Server: CRITICAL - PUBLIC_URL not configured');
    logger.error('Bolna Server: Vobiz will not be able to call back to this server');
    logger.error('Bolna Server: Set PUBLIC_URL environment variable (use ngrok for local dev)');
    logger.error('Bolna Server: Example: ngrok http 3001, then set PUBLIC_URL=https://abc123.ngrok.io');
    process.exit(1);
  }

  if (!env.VOBIZ_AUTH_ID || !env.VOBIZ_AUTH_TOKEN) {
    logger.error('Bolna Server: CRITICAL - Vobiz credentials missing');
    logger.error('Bolna Server: Set VOBIZ_AUTH_ID and VOBIZ_AUTH_TOKEN in .env');
    process.exit(1);
  }

  if (!env.GOOGLE_API_KEY && !env.OPENAI_API_KEY && !env.GEMINI_API_KEY) {
    logger.error('Bolna Server: CRITICAL - No LLM provider configured');
    logger.error('Bolna Server: Set either GOOGLE_API_KEY or OPENAI_API_KEY or GEMINI_API_KEY in .env');
    process.exit(1);
  }

  logger.info('Bolna Server: Critical environment variables validated ✓');

  // Verify database connectivity
  try {
    await prisma.$connect();
    logger.info('Bolna Server: database connected');
    
    // Seed default workspace user to prevent multi-tenant lookups failing
    await prisma.user.upsert({
      where: { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' },
      update: {},
      create: {
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        email: 'devr01499@gmail.com',
        fullName: 'Rohit Kumar Sha',
        passwordHash: 'seeded-dev-hash-12345',
        billingBalance: 1000.0, // Seed 1000 credits
      }
    });
    logger.info('Bolna Server: Seeded dev workspace user devr01499@gmail.com ✓');

    // Seed default workspace phone number if missing
    await prisma.phoneNumber.upsert({
      where: { phoneNumber: '+12345678901' },
      update: {},
      create: {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        phoneNumber: '+12345678901',
        userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        countryCode: 'US',
        type: 'local',
        telephonyProvider: 'vobiz',
        capabilities: '["voice"]',
        status: 'active',
        monthlyCost: 1.0,
      }
    });
    logger.info('Bolna Server: Seeded dev workspace phone number +12345678901 ✓');
  } catch (err) {
    logger.error('Bolna Server: database connection failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }

  // Initialize providers (non-fatal if they fail)
  await initializeProviders();

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

  const PORT = process.env.PORT || 3001;

  // Start listening
  server.listen(PORT, () => {
    logger.info(`Clarity Backend Server running natively on port ${PORT}`);
    logger.info(`Bolna Server: listening on port ${PORT}`, {
      health: `http://localhost:${PORT}/health`,
      api: `http://localhost:${PORT}/api/v2`,
      ws: `ws://localhost:${PORT}/audio-stream`,
    });

    // Call this method within the server listen block
    seedTestEnvironment().catch(err => console.error("Database seed failure:", err));

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
