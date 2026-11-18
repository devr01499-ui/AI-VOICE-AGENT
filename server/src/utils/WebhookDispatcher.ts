/**
 * Claritiy Voice Webhook Dispatcher
 *
 * Sends call events (call_started, call_ended, call_analyzed, transcript_updated) to the agent's
 * webhook (agentConfig.webhooks) and to account-level webhooks.
 *
 * Signing (when a secret is set):
 *  - X-Claritiy-Signature / X-Signature-SHA256: HMAC-SHA256(secret, body)   [unchanged, for existing receivers]
 *  - X-Claritiy-Timestamp: unix seconds
 *  - X-Claritiy-Signature-V2: HMAC-SHA256(secret, `${timestamp}.${body}`)  [lets receivers reject replays]
 *
 * Delivery: SSRF-checked URL, no redirects, 8 s timeout per attempt, up to 3 attempts with backoff
 * on network errors / 5xx / 429 (never on other 4xx), all targets in parallel.
 */

import { ssrfSafeDispatcher } from './ssrfValidator';
import crypto from 'crypto';
import { logger } from './logger';
import { prisma } from '../lib/prisma';
import { assertSafeUrl } from './ssrfValidator';
import { revealSecret } from './agentSecrets';
import { parseToolHeaders } from '../runtime/agentTools';

export type WebhookEventType = 'call_started' | 'call_ended' | 'call_analyzed' | 'transcript_updated';

export interface DispatchWebhookParams {
  agentId?: string;
  userId?: string;
  eventType: WebhookEventType;
  payload: Record<string, any>;
}

export const WEBHOOK_TIMEOUT_MS = 8_000;
export const WEBHOOK_MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [1_000, 3_000];

/** Short cache of each agent's webhook settings (transcript events fire once per turn). */
const agentWebhookCache = new Map<string, { at: number; cfg: any }>();
const CACHE_MS = 30_000;

async function agentWebhookConfig(agentId: string): Promise<any> {
  const hit = agentWebhookCache.get(agentId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.cfg;
  const agent = await prisma.agent.findUnique({ where: { id: agentId }, select: { agentConfig: true } });
  let cfg: any = null;
  if (agent?.agentConfig) {
    try {
      const parsed = typeof agent.agentConfig === 'string' ? JSON.parse(agent.agentConfig) : agent.agentConfig;
      cfg = parsed?.webhooks || null;
    } catch {
      cfg = null;
    }
  }
  agentWebhookCache.set(agentId, { at: Date.now(), cfg });
  return cfg;
}

/** Tests only. */
export function clearWebhookCacheForTests(): void {
  agentWebhookCache.clear();
}

export class WebhookDispatcher {
  static async dispatch(params: DispatchWebhookParams): Promise<void> {
    const { agentId, userId, eventType, payload } = params;
    const deliveries: Array<Promise<boolean>> = [];
    try {
      if (agentId) {
        const webhookCfg = await agentWebhookConfig(agentId);
        if (webhookCfg && typeof webhookCfg.url === 'string' && webhookCfg.url && (!Array.isArray(webhookCfg.events) || webhookCfg.events.includes(eventType))) {
          deliveries.push(WebhookDispatcher.sendSignedWebhook(webhookCfg.url, revealSecret(webhookCfg.secret), eventType, payload, parseToolHeaders(webhookCfg.headers)));
        }
      }

      if (userId) {
        const accountWebhooks = await prisma.webhook.findMany({
          where: {
            userId,
            isActive: true,
            OR: [{ eventType: eventType }, { eventType: 'call.*' }, { eventType: '*' }],
          },
        });
        for (const wh of accountWebhooks) {
          deliveries.push(WebhookDispatcher.sendSignedWebhook(wh.url, revealSecret(wh.secretKey) || undefined, eventType, payload));
        }
      }
      await Promise.allSettled(deliveries);
    } catch (err) {
      logger.error('WebhookDispatcher: Error dispatching webhook event', { eventType, error: String(err) });
    }
  }

  /** Delivers one webhook with retries. Resolves true when a 2xx was received. Never throws. */
  static async sendSignedWebhook(
    url: string,
    secretKey: string | undefined,
    eventType: string,
    payload: Record<string, any>,
    customHeaders?: Record<string, string>
  ): Promise<boolean> {
    try {
      // OWASP A10: SSRF Defense for user-configured webhooks
      await assertSafeUrl(url);
    } catch (err: any) {
      logger.warn('WebhookDispatcher: webhook URL refused', { eventType, error: err?.message || String(err) });
      return false;
    }

    const body = JSON.stringify({ event: eventType, timestamp: new Date().toISOString(), data: payload });
    const unixTs = Math.floor(Date.now() / 1000).toString();
    const headers: Record<string, string> = {
      ...(customHeaders || {}),
      'Content-Type': 'application/json',
      'User-Agent': 'Claritiy-Voice-Webhook/1.1',
      'X-Claritiy-Event': eventType,
      'X-Claritiy-Timestamp': unixTs,
    };
    if (secretKey) {
      const signature = crypto.createHmac('sha256', secretKey).update(body).digest('hex');
      headers['X-Claritiy-Signature'] = signature;
      headers['X-Signature-SHA256'] = signature;
      headers['X-Claritiy-Signature-V2'] = crypto.createHmac('sha256', secretKey).update(`${unixTs}.${body}`).digest('hex');
    }

    for (let attempt = 1; attempt <= WEBHOOK_MAX_ATTEMPTS; attempt++) {
      let retryable = true;
      try {
        const response = await fetch(url, {
          ...({ dispatcher: ssrfSafeDispatcher } as object), // connect-time SSRF check (DNS rebinding)
          method: 'POST',
          headers,
          body,
          signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
          redirect: 'error',
        });
        if (response.ok) {
          logger.info('WebhookDispatcher: Webhook delivered', { eventType, status: response.status, attempt });
          return true;
        }
        retryable = response.status >= 500 || response.status === 429;
        logger.warn('WebhookDispatcher: webhook answered with an error', { eventType, status: response.status, attempt });
      } catch (err: any) {
        logger.warn('WebhookDispatcher: webhook delivery failed', { eventType, attempt, error: err?.message || String(err) });
      }
      if (!retryable || attempt === WEBHOOK_MAX_ATTEMPTS) break;
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1] ?? 3_000));
    }
    return false;
  }
}
