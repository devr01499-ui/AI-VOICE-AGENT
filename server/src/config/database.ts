// ─────────────────────────────────────────────
// Voice Runtime Engine — Database Configuration
// ─────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const dbUrl = process.env.DATABASE_URL || 'file:../dev.db';
const dbPath = dbUrl.startsWith('file:') ? dbUrl.substring(5) : dbUrl;

// Resolve path relative to the server root directory (where prisma.config.ts resides)
const serverRoot = path.resolve(__dirname, '../..');
const resolvedDbPath = path.isAbsolute(dbPath)
  ? dbPath
  : path.resolve(serverRoot, dbPath);

// Pass the absolute file path with the file: prefix to the adapter options
const adapter = new PrismaBetterSqlite3({
  url: `file:${resolvedDbPath}`,
});

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}


