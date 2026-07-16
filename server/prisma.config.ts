/**
 * Bolna Server — Prisma Configuration (v7+)
 *
 * Prisma 7 moved the datasource URL out of schema.prisma and into
 * this TypeScript configuration file.
 *
 * IMPORTANT: DATABASE_URL is NOT available during Render's build phase —
 * Render only injects env vars at runtime. The datasource.url here is used
 * by `prisma migrate` and `prisma db push` only. `prisma generate` reads the
 * provider type from schema.prisma and does not require a live connection URL.
 */

import 'dotenv/config';
import path from 'path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  datasource: {
    // Only pass the URL when it is actually set.
    // Do NOT fall back to 'file:../dev.db' — that causes prisma generate
    // to bake a SQLite-targeted client into dist/, which then crashes at
    // runtime when Render injects a PostgreSQL DATABASE_URL into the container.
    url: process.env.DATABASE_URL ?? '',
  },
});
