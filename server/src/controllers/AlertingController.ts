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

/** What AlertEvaluator can measure and compare (audit #58). */
export const ALERT_METRICS = ['call_volume', 'error_rate', 'success_rate', 'cost', 'sentiment_score'] as const;
export const ALERT_COMPARATORS = ['greater_than', 'less_than', 'equals'] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RuleFields = {
  name?: string; metric?: string; comparator?: string; thresholdValue?: number;
  evaluationWindowMins?: number; checkFrequencyMins?: number;
  notificationEmail?: string | null; notificationWebhookUrl?: string | null; enabled?: boolean;
};

/** "" / null clears an optional field (audit #59: a cleared field was stored as the text "null"). */
function optionalText(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
}

function wholeNumber(v: unknown, min: number, max: number): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/**
 * Checks the fields present in a create/update body and returns clean values or an error message.
 * With requireAll (create), name, metric, comparator and thresholdValue must be present.
 */
export function parseAlertRuleBody(body: any, requireAll: boolean): { data: RuleFields } | { error: string } {
  const b = body || {};
  const data: RuleFields = {};
  if (requireAll) {
    for (const k of ['name', 'metric', 'comparator', 'thresholdValue']) {
      if (b[k] === undefined || b[k] === null || b[k] === '') return { error: 'name, metric, comparator, and thresholdValue are required' };
    }
  }
  if (b.name !== undefined) {
    const name = String(b.name).trim();
    if (!name || name.length > 120) return { error: 'Give the rule a name (up to 120 characters).' };
    data.name = name;
  }
  if (b.metric !== undefined) {
    if (!(ALERT_METRICS as readonly string[]).includes(String(b.metric))) return { error: 'metric must be one of: ' + ALERT_METRICS.join(', ') };
    data.metric = String(b.metric);
  }
  if (b.comparator !== undefined) {
    if (!(ALERT_COMPARATORS as readonly string[]).includes(String(b.comparator))) return { error: 'comparator must be one of: ' + ALERT_COMPARATORS.join(', ') };
    data.comparator = String(b.comparator);
  }
  if (b.thresholdValue !== undefined) {
    const t = typeof b.thresholdValue === 'number' ? b.thresholdValue : (String(b.thresholdValue).trim() === '' ? NaN : Number(b.thresholdValue));
    if (!Number.isFinite(t) || Math.abs(t) > 1e9) return { error: 'thresholdValue must be a number.' };
    data.thresholdValue = t;
  }
  if (b.evaluationWindowMins !== undefined) {
    const n = wholeNumber(b.evaluationWindowMins, 1, 43200);
    if (n === null) return { error: 'evaluationWindowMins must be a whole number from 1 to 43200 (30 days).' };
    data.evaluationWindowMins = n;
  }
  if (b.checkFrequencyMins !== undefined) {
    const n = wholeNumber(b.checkFrequencyMins, 1, 1440);
    if (n === null) return { error: 'checkFrequencyMins must be a whole number from 1 to 1440.' };
    data.checkFrequencyMins = n;
  }
  const email = optionalText(b.notificationEmail);
  if (email !== undefined) {
    if (email !== null && (email.length > 254 || !EMAIL_RE.test(email))) return { error: 'notificationEmail is not a valid email address.' };
    data.notificationEmail = email === null ? null : email.toLowerCase();
  }
  const hook = optionalText(b.notificationWebhookUrl);
  if (hook !== undefined) {
    if (hook !== null) {
      let ok = false;
      try { const u = new URL(hook); ok = (u.protocol === 'https:' || u.protocol === 'http:') && hook.length <= 2048; } catch { ok = false; }
      if (!ok) return { error: 'notificationWebhookUrl must be a valid http(s) URL.' };
    }
    data.notificationWebhookUrl = hook;
  }
  if (b.enabled !== undefined) {
    if (typeof b.enabled !== 'boolean') return { error: 'enabled must be true or false.' };
    data.enabled = b.enabled;
  }
  return { data };
}

export class AlertingController {
  static async listRules(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).effectiveWorkspaceId || (req as any).user?.id || (req as any).user?.userId || (req as any).userId;
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
      const userId = (req as any).effectiveWorkspaceId || (req as any).user?.id || (req as any).user?.userId || (req as any).userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const parsed = parseAlertRuleBody(req.body, true);
      if ('error' in parsed) {
        res.status(400).json({ success: false, error: parsed.error });
        return;
      }
      const d = parsed.data;

      const webhookSecret = `whsec_${crypto.randomBytes(16).toString('hex')}`;

      const rule = await prisma.alertRule.create({
        data: {
          userId: String(userId),
          name: d.name!,
          metric: d.metric!,
          comparator: d.comparator!,
          thresholdValue: d.thresholdValue!,
          evaluationWindowMins: d.evaluationWindowMins ?? 60,
          checkFrequencyMins: d.checkFrequencyMins ?? 5,
          notificationEmail: d.notificationEmail ?? null,
          notificationWebhookUrl: d.notificationWebhookUrl ?? null,
          ...(d.enabled !== undefined && { enabled: d.enabled }),
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
      const userId = (req as any).effectiveWorkspaceId || (req as any).user?.id || (req as any).user?.userId || (req as any).userId;
      const ruleId = String(req.params.id);

      const existing = await prisma.alertRule.findFirst({
        where: { id: ruleId, userId: String(userId) },
      });

      if (!existing) {
        res.status(404).json({ success: false, error: 'Alert rule not found' });
        return;
      }

      const parsed = parseAlertRuleBody(req.body, false);
      if ('error' in parsed) {
        res.status(400).json({ success: false, error: parsed.error });
        return;
      }

      const updated = await prisma.alertRule.update({
        where: { id: existing.id },
        data: parsed.data,
      });

      res.json({ success: true, data: updated });
    } catch (err: any) {
      logger.error('AlertingController: Error updating rule', { error: err.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  static async deleteRule(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).effectiveWorkspaceId || (req as any).user?.id || (req as any).user?.userId || (req as any).userId;
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
      const userId = (req as any).effectiveWorkspaceId || (req as any).user?.id || (req as any).user?.userId || (req as any).userId;
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
      // Only the caller's own rules (audit #57: this evaluated every tenant's rules and reset their timers).
      const ownerId = (req as any).effectiveWorkspaceId || (req as any).userId;
      if (!ownerId) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
      const result = await AlertEvaluator.evaluateAllRules(ownerId);
      res.json({ success: true, result });
    } catch (err: any) {
      logger.error('AlertingController: Error running manual evaluation pass', { error: err.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}
