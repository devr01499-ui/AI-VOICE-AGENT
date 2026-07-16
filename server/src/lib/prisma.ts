// ─────────────────────────────────────────────────────────
// Master Prisma Client Singleton — PostgreSQL / Supabase Pool
// All server modules MUST import `prisma` from this file.
// ─────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// ── Environment validation guard ────────────────────────
// Assert DATABASE_URL is present BEFORE calling the PrismaClient
// constructor so a missing env var produces a clear diagnostic
// instead of an opaque PrismaClientConstructorValidationError.
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl || dbUrl.trim() === '') {
  console.error('================================================================================');
  console.error('[PRISMA CRITICAL SYSTEM BLOCK]: DATABASE_URL is missing or empty on Render!');
  console.error('Check your Render Service Dashboard -> Environment Settings immediately.');
  console.error('================================================================================');
}

// Allow Supabase pooler TLS certificates through in all envs.
// Supabase connection pooler uses self-signed intermediate CAs.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error', 'warn'],
  });

// Preserve singleton reference across hot-reloads in development
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// ── Boot-time connection handshake ──────────────────────
// Explicitly connect at startup so credential failures surface
// immediately in Render logs rather than on the first route hit.
prisma.$connect()
  .then(() => {
    console.log('================================================================================');
    console.log('[Prisma Singleton Instance]: Connection established successfully to cloud PostgreSQL.');
    console.log('================================================================================');
  })
  .catch((err: Error) => {
    console.error('================================================================================');
    console.error('[Prisma Singleton Fatal Connection Failure]:', err.message || err);
    console.error('================================================================================');
    logger.error('Prisma boot connection failed — check DATABASE_URL on Render', {
      message: err.message,
    });
    // Do NOT process.exit — allow graceful degradation via route fallbacks.
  });

// ── Clean shutdown ──────────────────────────────────────
// Disconnect the pool on Render's SIGTERM / SIGINT to prevent
// connection leaks when the container is recycled or redeployed.
const disconnect = (): void => { prisma.$disconnect().catch(() => {}); };
process.once('SIGTERM', disconnect);
process.once('SIGINT', disconnect);
