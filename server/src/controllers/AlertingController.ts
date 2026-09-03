/**
 * Alerting Controller
 *
 * Provides CRUD operations for alert rules, incident history logs,
 * and immediate rule evaluation triggers.
 */

import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { AlertEvaluator } from '../services/AlertEvaluator';
import crypto from 'crypto';

export class AlertingController {
  static async listRules(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const rules = await prisma.alertRule.findMany({
        where: { userId: String(userId) },
        orderBy: { createdAt: 'desc' },
        include: {
          incidents: {
            orderBy: { triggeredAt: 'desc' },
            take: 5,
          },
        },
      });

      res.json({ success: true, data: rules });
    } catch (err: any) {
      logger.error('AlertingController: Error listing rules', { error: err.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  static async createRule(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const {
        name,
        metric,
        comparator,
        thresholdValue,
        evaluationWindowMins = 60,
        checkFrequencyMins = 5,
        notificationEmail,
        notificationWebhookUrl,
      } = req.body;

      if (!name || !metric || !comparator || thresholdValue === undefined) {
        res.status(400).json({ success: false, error: 'name, metric, comparator, and thresholdValue are required' });
        return;
      }

      const webhookSecret = `whsec_${crypto.randomBytes(16).toString('hex')}`;

      const rule = await prisma.alertRule.create({
        data: {
          userId: String(userId),
          name: String(name),
          metric: String(metric),
          comparator: String(comparator),
          thresholdValue: parseFloat(String(thresholdValue)),
          evaluationWindowMins: parseInt(String(evaluationWindowMins), 10) || 60,
          checkFrequencyMins: parseInt(String(checkFrequencyMins), 10) || 5,
          notificationEmail: notificationEmail ? String(notificationEmail) : null,
          notificationWebhookUrl: notificationWebhookUrl ? String(notificationWebhookUrl) : null,
          webhookSecret,
        },
      });

      res.status(201).json({ success: true, data: rule });
    } catch (err: any) {
      logger.error('AlertingController: Error creating rule', { error: err.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  static async updateRule(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const ruleId = String(req.params.id);

      const existing = await prisma.alertRule.findFirst({
        where: { id: ruleId, userId: String(userId) },
      });

      if (!existing) {
        res.status(404).json({ success: false, error: 'Alert rule not found' });
        return;
      }

      const {
        name,
        metric,
        comparator,
        thresholdValue,
        evaluationWindowMins,
        checkFrequencyMins,
        notificationEmail,
        notificationWebhookUrl,
        enabled,
      } = req.body;

      const updated = await prisma.alertRule.update({
        where: { id: ruleId },
        data: {
          ...(name !== undefined && { name: String(name) }),
          ...(metric !== undefined && { metric: String(metric) }),
          ...(comparator !== undefined && { comparator: String(comparator) }),
          ...(thresholdValue !== undefined && { thresholdValue: parseFloat(String(thresholdValue)) }),
          ...(evaluationWindowMins !== undefined && { evaluationWindowMins: parseInt(String(evaluationWindowMins), 10) }),
          ...(checkFrequencyMins !== undefined && { checkFrequencyMins: parseInt(String(checkFrequencyMins), 10) }),
          ...(notificationEmail !== undefined && { notificationEmail: String(notificationEmail) }),
          ...(notificationWebhookUrl !== undefined && { notificationWebhookUrl: String(notificationWebhookUrl) }),
          ...(enabled !== undefined && { enabled: Boolean(enabled) }),
        },
      });

      res.json({ success: true, data: updated });
    } catch (err: any) {
      logger.error('AlertingController: Error updating rule', { error: err.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  static async deleteRule(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const ruleId = String(req.params.id);

      const existing = await prisma.alertRule.findFirst({
        where: { id: ruleId, userId: String(userId) },
      });

      if (!existing) {
        res.status(404).json({ success: false, error: 'Alert rule not found' });
        return;
      }

      await prisma.alertRule.delete({
        where: { id: ruleId },
      });

      res.json({ success: true, message: 'Alert rule deleted successfully' });
    } catch (err: any) {
      logger.error('AlertingController: Error deleting rule', { error: err.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  static async listIncidents(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const incidents = await prisma.alertIncident.findMany({
        where: { userId: String(userId) },
        orderBy: { triggeredAt: 'desc' },
        take: 50,
        include: {
          rule: { select: { id: true, name: true, metric: true, thresholdValue: true } },
        },
      });

      res.json({ success: true, data: incidents });
    } catch (err: any) {
      logger.error('AlertingController: Error listing incidents', { error: err.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  static async triggerEvaluation(req: Request, res: Response): Promise<void> {
    try {
      const result = await AlertEvaluator.evaluateAllRules();
      res.json({ success: true, result });
    } catch (err: any) {
      logger.error('AlertingController: Error running manual evaluation pass', { error: err.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}
