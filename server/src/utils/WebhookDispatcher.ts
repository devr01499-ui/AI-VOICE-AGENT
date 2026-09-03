/**
 * Claritiy Voice Webhook Dispatcher
 *
 * Dispatches webhook events (call_started, call_ended, call_analyzed, transcript_updated)
 * to per-agent configured webhooks (agentConfig.webhooks) and account-level webhooks.
 * Signs payloads with HMAC-SHA256 signature (X-Claritiy-Signature) using the secret key if configured.
 */

import crypto from 'crypto';
import { logger } from './logger';
import { prisma } from '../lib/prisma';

export interface DispatchWebhookParams {
  agentId?: string;
  userId?: string;
  eventType: 'call_started' | 'call_ended' | 'call_analyzed' | 'transcript_updated';
  payload: Record<string, any>;
}

export class WebhookDispatcher {
  static async dispatch(params: DispatchWebhookParams): Promise<void> {
    const { agentId, userId, eventType, payload } = params;

    try {
      // 1. Per-agent Webhook Check
      if (agentId) {
        const agent = await prisma.agent.findUnique({
          where: { id: agentId },
          select: { agentConfig: true },
        });

        if (agent?.agentConfig) {
          try {
            const parsedCfg = typeof agent.agentConfig === 'string' ? JSON.parse(agent.agentConfig) : agent.agentConfig;
            const webhookCfg = parsedCfg?.webhooks;

            if (webhookCfg && webhookCfg.url && (!webhookCfg.events || webhookCfg.events.includes(eventType))) {
              await WebhookDispatcher.sendSignedWebhook(
                webhookCfg.url,
                webhookCfg.secret,
                eventType,
                payload,
                webhookCfg.headers
              );
            }
          } catch (e) {
            logger.warn('WebhookDispatcher: Failed to parse agent webhook config', { agentId, error: String(e) });
          }
        }
      }

      // 2. User Account-level Webhooks Check
      if (userId) {
        const accountWebhooks = await prisma.webhook.findMany({
          where: {
            userId,
            isActive: true,
            OR: [{ eventType: eventType }, { eventType: 'call.*' }, { eventType: '*' }],
          },
        });

        for (const wh of accountWebhooks) {
          await WebhookDispatcher.sendSignedWebhook(wh.url, wh.secretKey || undefined, eventType, payload);
        }
      }
    } catch (err) {
      logger.error('WebhookDispatcher: Error dispatching webhook event', { eventType, error: String(err) });
    }
  }

  static async sendSignedWebhook(
    url: string,
    secretKey: string | undefined,
    eventType: string,
    payload: Record<string, any>,
    customHeaders?: Record<string, string>
  ): Promise<void> {
    try {
      const body = JSON.stringify({
        event: eventType,
        timestamp: new Date().toISOString(),
        data: payload,
      });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Claritiy-Voice-Webhook/1.0',
        ...(customHeaders || {}),
      };

      if (secretKey) {
        const signature = crypto.createHmac('sha256', secretKey).update(body).digest('hex');
        headers['X-Claritiy-Signature'] = signature;
        headers['X-Signature-SHA256'] = signature;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      logger.info('WebhookDispatcher: Webhook delivered', {
        url,
        eventType,
        status: response.status,
      });
    } catch (err: any) {
      logger.warn('WebhookDispatcher: Failed to deliver webhook', {
        url,
        eventType,
        error: err.message || String(err),
      });
    }
  }
}
