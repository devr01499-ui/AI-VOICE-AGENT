// ─────────────────────────────────────────────
// Voice Runtime Engine — Environment Configuration
// ─────────────────────────────────────────────

import 'dotenv/config';
import { z } from 'zod';

/**
 * Zod schema for all environment variables consumed by the server.
 *
 * Required variables will cause a hard exit if missing or invalid.
 * Optional variables fall back to sensible defaults for local development.
 */
const envSchema = z.object({
  // ── Database ────────────────────────────────
  DATABASE_URL: z
    .string({ required_error: 'DATABASE_URL is required' })
    .min(1, 'DATABASE_URL must not be empty'),

  // ── Server ──────────────────────────────────
  PORT: z
    .string({ required_error: 'PORT is required' })
    .regex(/^\d+$/, 'PORT must be a numeric string')
    .transform(Number),

  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  LOG_LEVEL: z
    .enum(['debug', 'info', 'warn', 'error'])
    .default('info'),

  FRONTEND_URL: z
    .string()
    .url('FRONTEND_URL must be a valid URL')
    .default('http://localhost:3000'),

  // ── Vobiz Telephony ────────────────────────
  VOBIZ_AUTH_ID: z
    .string({ required_error: 'VOBIZ_AUTH_ID is required' })
    .min(1, 'VOBIZ_AUTH_ID must not be empty'),

  VOBIZ_AUTH_TOKEN: z
    .string({ required_error: 'VOBIZ_AUTH_TOKEN is required' })
    .min(1, 'VOBIZ_AUTH_TOKEN must not be empty'),

  VOBIZ_FROM_NUMBER: z
    .string({ required_error: 'VOBIZ_FROM_NUMBER is required' })
    .min(1, 'VOBIZ_FROM_NUMBER must not be empty'),

  VOBIZ_API_URL: z
    .string({ required_error: 'VOBIZ_API_URL is required' })
    .url('VOBIZ_API_URL must be a valid URL'),

  // ── OpenAI ──────────────────────────────────
  OPENAI_API_KEY: z.string().optional(),

  OPENAI_REALTIME_MODEL: z
    .string()
    .default('gpt-4o-realtime-preview'),

  // ── Gemini ──────────────────────────────────
  GEMINI_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),

  GEMINI_REALTIME_MODEL: z
    .string()
    .default('gemini-2.0-flash-exp'),

  // ── Networking / Tunnels ────────────────────
  PUBLIC_URL: z.string().default(''),

  NGROK_AUTH_TOKEN: z.string().default(''),
});

/**
 * Inferred TypeScript type from the validated environment schema.
 * Use this when you need to annotate a variable or parameter with the env shape.
 */
export type EnvConfig = z.infer<typeof envSchema>;

// ── Parse & validate ──────────────────────────
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌  Environment validation failed:');

  for (const issue of parsed.error.issues) {
    const path = issue.path.join('.') || '(root)';
    console.error(`   • ${path}: ${issue.message}`);
  }

  // Hard exit — the server cannot operate with invalid config.
  process.exit(1);
}

/**
 * Fully validated and typed environment variables.
 *
 * @example
 * ```ts
 * import { env } from '../config/env';
 * console.log(env.PORT); // number
 * ```
 */
export const env: EnvConfig = parsed.data;
