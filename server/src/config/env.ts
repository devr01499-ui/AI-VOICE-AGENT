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
    .string()
    .trim()
    .regex(/^\d+$/, 'PORT must be a numeric string')
    .transform(Number)
    .default('3001'),

  SIP_ENCRYPTION_KEY: z
    .string()
    .trim()
    .optional(),

  ENCRYPTION_KEY: z
    .string()
    .trim()
    .optional(),

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

  VOBIZ_WEBHOOK_SECRET: z.string().trim().optional(),

  // ── Plivo Telephony ────────────────────────
  PLIVO_AUTH_ID: z.string().trim().default(''),

  PLIVO_AUTH_TOKEN: z.string().trim().default(''),

  PLIVO_APP_ID: z.string().trim().default(''),

  // ── OpenAI ──────────────────────────────────
  OPENAI_API_KEY: z.string().trim().optional(),

  OPENAI_REALTIME_MODEL: z
    .string()
    .trim()
    .default('gpt-4o-realtime-preview'),

  // ── Gemini ──────────────────────────────────
  GEMINI_API_KEY: z.string().trim().optional(),
  GOOGLE_API_KEY: z.string().trim().optional(),
  GOOGLE_GENAI_API_KEY: z.string().trim().optional(),

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

  GEMINI_WS_BASE: z.string().trim().optional(),
  GEMINI_HTTP_BASE: z.string().trim().optional(),

  // ── Google Calendar OAuth ───────────────────
  GOOGLE_CLIENT_ID: z.string().trim().default(''),
  GOOGLE_CLIENT_SECRET: z.string().trim().default(''),
  GOOGLE_REDIRECT_URI: z.string().trim().default(''),
  GOOGLE_CALENDAR_ENABLED: z.string().trim().default('false'),

  // ── Networking / Tunnels ────────────────────
  // Optional at boot — required at runtime only for telephony webhook callbacks
  PUBLIC_URL: z.string().trim().default(''),

  NGROK_AUTH_TOKEN: z.string().trim().default(''),

  // ── Billing / Razorpay ──────────────────────
  RAZORPAY_KEY_ID: z.string().trim().optional(),
  RAZORPAY_KEY_SECRET: z.string().trim().optional(),
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

// Fail loudly in production if Google Calendar is enabled but credentials are missing
if (parsed.data.NODE_ENV === 'production' && parsed.data.GOOGLE_CALENDAR_ENABLED === 'true') {
  if (!parsed.data.GOOGLE_CLIENT_ID || !parsed.data.GOOGLE_CLIENT_SECRET) {
    console.error('❌  Production Configuration Error: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured when GOOGLE_CALENDAR_ENABLED=true.');
    process.exit(1);
  }
}

/**
 * Secrets that the server can run without but that leave a security gap when missing (Phase 12, P9/P12).
 * Returned as plain findings so the boot check is testable; nothing here exits the process, because
 * failing hard would take production down before the owner has set the new variables.
 *  - ENCRYPTION_KEY missing: stored secrets (calendar tokens, user API keys) are encrypted with a key
 *    derived from the webhook secret, or with a legacy key that is written in the source code.
 *  - VOBIZ_WEBHOOK_SECRET / SIP_ENCRYPTION_KEY missing: carrier webhooks and audio-stream tokens are
 *    signed with another service's secret (Supabase JWT secret) or a per-process random value, which
 *    breaks stream tokens across restarts and multiple instances.
 */
export function auditSecretConfiguration(e: Record<string, string | undefined>): string[] {
  const has = (k: string) => typeof e[k] === 'string' && (e[k] as string).trim().length > 0;
  const findings: string[] = [];
  if (!has('ENCRYPTION_KEY')) {
    findings.push(
      has('VOBIZ_WEBHOOK_SECRET') || has('SIP_ENCRYPTION_KEY')
        ? 'ENCRYPTION_KEY is not set: stored secrets are encrypted with a key derived from the carrier webhook secret. Set a dedicated ENCRYPTION_KEY (64 hex characters).'
        : 'ENCRYPTION_KEY is not set and no carrier webhook secret exists: stored secrets are encrypted with the LEGACY key that is written in the source code. Set ENCRYPTION_KEY (64 hex characters) now.'
    );
  }
  if (!has('VOBIZ_WEBHOOK_SECRET') && !has('SIP_ENCRYPTION_KEY')) {
    findings.push(
      'VOBIZ_WEBHOOK_SECRET is not set: carrier webhooks and audio-stream tokens are signed with a fallback secret (another service\'s secret or a random per-process value). Set VOBIZ_WEBHOOK_SECRET.'
    );
  }
  return findings;
}

if (parsed.data.NODE_ENV === 'production') {
  for (const finding of auditSecretConfiguration(process.env)) {
    console.error(`🚨  CRITICAL security configuration: ${finding}`);
  }
}

// Warn loudly if no Gemini API key is configured for the platform
if (!parsed.data.GEMINI_API_KEY && !parsed.data.GOOGLE_API_KEY) {
  console.warn('⚠️  Platform Configuration Alert: Neither GEMINI_API_KEY nor GOOGLE_API_KEY is configured in the environment. AI voice calls will fail unless individual users save their own Gemini API key in Settings > API Keys.');
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
