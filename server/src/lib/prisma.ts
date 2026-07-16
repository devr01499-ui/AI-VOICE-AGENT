// ─────────────────────────────────────────────────────────
// Master Prisma Client Singleton — PostgreSQL / Supabase Pool
// All server modules MUST import `prisma` from this file.
// ─────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { logger } from '../utils/logger';

// Allow Supabase pooler TLS certificates through in all envs.
// Supabase connection pooler uses self-signed intermediate CAs.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

const getPrismaInstance = (): PrismaClient => {
  const rawConnectionString = process.env.DATABASE_URL;

  if (!rawConnectionString || rawConnectionString.trim() === '') {
    console.error('================================================================================');
    console.error('[PRISMA CRITICAL SYSTEM BLOCK]: DATABASE_URL is missing or empty on Render!');
    console.error('Check your Render Service Dashboard -> Environment Settings immediately.');
    console.error('================================================================================');
    throw new Error('DATABASE_URL environment variable is missing or empty.');
  }

  // Supabase self-signed certificates require sslmode=no-verify and rejectUnauthorized: false
  // to prevent "self-signed certificate in certificate chain" connection exceptions.
  const connectionString = rawConnectionString.includes('sslmode=require')
    ? rawConnectionString.replace('sslmode=require', 'sslmode=no-verify')
    : rawConnectionString;

  const pool = new pg.Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error', 'warn'],
  });
};

export const prisma = globalForPrisma.prisma ?? getPrismaInstance();

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
  });

// ── Clean shutdown ──────────────────────────────────────
// Disconnect the pool on Render's SIGTERM / SIGINT to prevent
// connection leaks when the container is recycled or redeployed.
const disconnect = (): void => { prisma.$disconnect().catch(() => {}); };
process.once('SIGTERM', disconnect);
process.once('SIGINT', disconnect);
