/**
 * Bolna Server — Prisma Configuration (v7+)
 *
 * Prisma 7 moved the datasource URL out of schema.prisma and into
 * this TypeScript configuration file.
 */

import 'dotenv/config';
import path from 'path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL || 'file:../dev.db',
  },
});
