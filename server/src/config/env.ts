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
    .trim()
    .min(1, 'DATABASE_URL must not be empty'),

  // ── Server ──────────────────────────────────
  PORT: z
    .string({ required_error: 'PORT is required' })
    .trim()
    .regex(/^\d+$/, 'PORT must be a numeric string')
    .transform(Number),

  SIP_ENCRYPTION_KEY: z
    .string()
    .trim()
    .length(64, 'SIP_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)')
    .default('a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90'),

  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  LOG_LEVEL: z
    .enum(['debug', 'info', 'warn', 'error'])
    .default('info'),

  FRONTEND_URL: z
    .string()
    .trim()
    .url('FRONTEND_URL must be a valid URL')
    .default('http://localhost:3000'),

  // ── Vobiz Telephony ────────────────────────
  // Optional: server boots without telephony configured; features degrade gracefully.
  VOBIZ_AUTH_ID: z.string().trim().default(''),

  VOBIZ_AUTH_TOKEN: z.string().trim().default(''),

  VOBIZ_FROM_NUMBER: z.string().trim().default(''),

  VOBIZ_API_URL: z.string().trim().default(''),

  // ── OpenAI ──────────────────────────────────
  OPENAI_API_KEY: z.string().trim().optional(),

  OPENAI_REALTIME_MODEL: z
    .string()
    .trim()
    .default('gpt-4o-realtime-preview'),

  // ── Gemini ──────────────────────────────────
  GEMINI_API_KEY: z.string().trim().optional(),
  GOOGLE_API_KEY: z.string().trim().optional(),

  GEMINI_REALTIME_MODEL: z
    .string()
    .trim()
    .default('gemini-2.0-flash'),

  // ✅ FIXED: Changed from 'v1beta' to 'v1alpha'
  // Reason: v1beta endpoint is deprecated/rate-limited for WebSocket Live API
  // v1alpha is the current stable endpoint for Gemini Live/Multimodal API
  GEMINI_API_VERSION: z
    .string()
    .trim()
    .default('v1alpha'),

  // ── Networking / Tunnels ────────────────────
  // Optional at boot — required at runtime only for telephony webhook callbacks
  PUBLIC_URL: z.string().trim().default(''),

  NGROK_AUTH_TOKEN: z.string().trim().default(''),
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
