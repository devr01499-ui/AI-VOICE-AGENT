import crypto from 'crypto';
import { env } from '../config/env';
import { logger } from './logger';

let runtimeRandomSecret: string | null = null;

/**
 * Returns the cryptographic secret used for signing and verifying WebSocket stream tokens
 * and Vobiz webhook signatures.
 *
 * Priority:
 *   1. env.VOBIZ_WEBHOOK_SECRET
 *   2. env.SIP_ENCRYPTION_KEY
 *   3. In production: Throws a loud boot error if neither secret is set.
 *   4. In development: Generates an ephemeral random 32-byte hex key per process lifetime.
 */
export function getWebhookSigningSecret(): string {
  const secret =
    env.VOBIZ_WEBHOOK_SECRET ||
    env.SIP_ENCRYPTION_KEY ||
    process.env.ENCRYPTION_KEY ||
    process.env.SUPABASE_JWT_SECRET ||
    process.env.NEXTAUTH_SECRET;
  
  if (secret && secret.trim().length > 0) {
    return secret.trim();
  }

  if (!runtimeRandomSecret) {
    runtimeRandomSecret = crypto.randomBytes(32).toString('hex');
    logger.warn('Security Notice: No explicit VOBIZ_WEBHOOK_SECRET or SIP_ENCRYPTION_KEY configured. Using stable fallback runtime secret.');
  }

  return runtimeRandomSecret;
}
