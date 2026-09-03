/**
 * Integrations Controller
 *
 * Manages third-party connection settings (Slack incoming webhooks, generic webhooks, Zapier)
 * and verifies outbound test deliveries.
 */

import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { WebhookDispatcher } from '../utils/WebhookDispatcher';

export class IntegrationsController {
  static async listIntegrations(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const integrations = await prisma.userIntegration.findMany({
        where: { userId: String(userId) },
      });

      res.json({ success: true, data: integrations });
    } catch (err: any) {
      logger.error('IntegrationsController: Error listing integrations', { error: err.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  static async saveIntegration(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const type = String(req.params.type).toLowerCase();

      if (!['slack', 'generic_webhook', 'google_sheets', 'zapier'].includes(type)) {
        res.status(400).json({ success: false, error: 'Unsupported integration type' });
        return;
      }

      const { name, config, enabled = true } = req.body;
      const configStr = typeof config === 'string' ? config : JSON.stringify(config || {});

      const integration = await prisma.userIntegration.upsert({
        where: {
          userId_type: {
            userId: String(userId),
            type,
          },
        },
        update: {
          name: name ? String(name) : type.toUpperCase(),
          config: configStr,
          enabled: Boolean(enabled),
        },
        create: {
          userId: String(userId),
          type,
          name: name ? String(name) : type.toUpperCase(),
          config: configStr,
          enabled: Boolean(enabled),
        },
      });

      res.status(200).json({ success: true, data: integration });
    } catch (err: any) {
      logger.error('IntegrationsController: Error saving integration', { error: err.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  static async testIntegration(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const type = String(req.params.type).toLowerCase();

      const integration = await prisma.userIntegration.findFirst({
        where: { userId: String(userId), type },
      });

      if (!integration) {
        res.status(404).json({ success: false, error: 'Integration not configured' });
        return;
      }

      let parsedCfg: any = {};
      try {
        parsedCfg = JSON.parse(integration.config || '{}');
      } catch {}

      const targetUrl = parsedCfg.webhookUrl || parsedCfg.url;
      if (!targetUrl) {
        res.status(400).json({ success: false, error: 'No webhook URL configured for this integration' });
        return;
      }

      const testPayload = {
        event: 'integration_test',
        brand: 'Claritiy Voice',
        integrationType: type,
        timestamp: new Date().toISOString(),
        message: `Claritiy Voice ${integration.name} test connection successful!`,
      };

      await WebhookDispatcher.sendSignedWebhook(
        targetUrl,
        parsedCfg.secret || undefined,
        'integration_test',
        testPayload,
        parsedCfg.headers
      );

      res.json({ success: true, message: `Test webhook dispatched to ${type} successfully.` });
    } catch (err: any) {
      logger.error('IntegrationsController: Error testing integration', { error: err.message });
      res.status(500).json({ success: false, error: `Failed to test integration: ${err.message}` });
    }
  }

  static async deleteIntegration(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const type = String(req.params.type).toLowerCase();

      const existing = await prisma.userIntegration.findFirst({
        where: { userId: String(userId), type },
      });

      if (!existing) {
        res.status(404).json({ success: false, error: 'Integration not found' });
        return;
      }

      await prisma.userIntegration.delete({
        where: { id: existing.id },
      });

      res.json({ success: true, message: 'Integration disconnected successfully' });
    } catch (err: any) {
      logger.error('IntegrationsController: Error deleting integration', { error: err.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}
