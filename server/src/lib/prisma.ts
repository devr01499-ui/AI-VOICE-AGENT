// ─────────────────────────────────────────────────────────
// Master Prisma Client Singleton — PostgreSQL / Supabase Pool
// All server modules MUST import `prisma` from this file.
// ─────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// Allow Supabase's pooler TLS certificates through in all envs.
// Supabase connection pooler (port 6543) uses self-signed intermediate CAs.
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

// ── Boot-time connection check ──────────────────────────
// Explicitly connect so failures surface immediately at server startup
// instead of being deferred silently to the first query (which would
// produce a misleading HTTP 500 rather than a clear boot error).
prisma.$connect().catch((err: Error) => {
  logger.error('Prisma boot connection failed — check DATABASE_URL', {
    message: err.message,
  });
  // Do NOT process.exit here; allow graceful degradation via route fallbacks.
});

// ── Clean shutdown ──────────────────────────────────────
// Disconnect the pool on Render's SIGTERM / SIGINT to prevent connection leaks.
const disconnect = () => { prisma.$disconnect().catch(() => {}); };
process.once('SIGTERM', disconnect);
process.once('SIGINT', disconnect);
