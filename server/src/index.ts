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
import { prisma } from './config/database';
import { callOrchestrator } from './core/orchestrator/CallOrchestrator';
import { AudioStreamHandler } from './websockets/AudioStreamHandler';

// ─── Routes ──────────────────────────────────────
import callRoutes from './routes/calls';
import agentRoutes from './routes/agents';
import webhookRoutes from './routes/webhooks';

// ─── Express App ─────────────────────────────────

const app = express();

// ── Security ──────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
const allowedOrigins = [
  env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:3001',
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      const isAllowed =
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        origin.endsWith('.onrender.com');
      if (isAllowed) {
        callback(null, true);
      } else {
        logger.warn('CORS blocked origin', { origin });
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    credentials: true,
  })
);

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

// ─── API Routes ──────────────────────────────────

app.use('/api/v2/calls', callRoutes);
app.use('/api/v2/agents', agentRoutes);
app.use('/api/v2/webhooks', webhookRoutes);

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
    server,
    path: '/audio-stream',
  });

  const audioHandler = new AudioStreamHandler();
  audioHandler.initialize(wss);

  // Start listening
  server.listen(env.PORT, () => {
    logger.info(`Bolna Server: listening on port ${env.PORT}`, {
      health: `http://localhost:${env.PORT}/health`,
      api: `http://localhost:${env.PORT}/api/v2`,
      ws: `ws://localhost:${env.PORT}/audio-stream`,
    });

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
