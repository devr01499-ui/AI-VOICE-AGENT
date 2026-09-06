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
  const secret = env.VOBIZ_WEBHOOK_SECRET || env.SIP_ENCRYPTION_KEY;
  
  if (secret && secret.trim().length > 0) {
    return secret.trim();
  }

  if (env.NODE_ENV === 'production') {
    logger.error('CRITICAL SECURITY ERROR: VOBIZ_WEBHOOK_SECRET or SIP_ENCRYPTION_KEY must be set in production!');
    throw new Error('CRITICAL SECURITY ERROR: Missing required webhook signing key (VOBIZ_WEBHOOK_SECRET / SIP_ENCRYPTION_KEY) in production environment.');
  }

  if (!runtimeRandomSecret) {
    runtimeRandomSecret = crypto.randomBytes(32).toString('hex');
    logger.warn('Security Warning: No VOBIZ_WEBHOOK_SECRET or SIP_ENCRYPTION_KEY configured. Generated ephemeral runtime secret for development mode.');
  }

  return runtimeRandomSecret;
}
