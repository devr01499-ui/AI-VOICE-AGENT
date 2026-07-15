// ─────────────────────────────────────────────────────────
// Master Prisma Client Singleton — Single Connection Pool
// All server modules MUST import `prisma` from this file.
// ─────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';

// Ensure self-signed / internal TLS certs don't block Supabase pooler
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['error', 'warn'],
  });

// Preserve singleton reference across hot-reloads in development
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
