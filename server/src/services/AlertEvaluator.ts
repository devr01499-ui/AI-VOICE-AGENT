/**
 * Alert Evaluator Engine
 *
 * Evaluates operational metric rules, manages incident state lifecycle (triggered -> active -> resolved),
 * and dispatches signed HMAC-SHA256 webhooks (X-Claritiy-Signature) and email notifications.
 */

import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { WebhookDispatcher } from '../utils/WebhookDispatcher';
import crypto from 'crypto';

export class AlertEvaluator {
  private static isRunning = false;
  private static intervalTimer: NodeJS.Timeout | null = null;

  static startBackgroundWorker(intervalMs: number = 60000): void {
    if (this.intervalTimer) return;
    logger.info('AlertEvaluator: Starting background evaluation worker (60s interval)');
    this.intervalTimer = setInterval(() => {
      this.evaluateAllRules().catch((err) => {
        logger.error('AlertEvaluator: Error during scheduled evaluation worker run', { error: err.message });
      });
    }, intervalMs);
  }

  static async evaluateAllRules(): Promise<{ evaluated: number; triggered: number; resolved: number }> {
    if (this.isRunning) return { evaluated: 0, triggered: 0, resolved: 0 };
    this.isRunning = true;

    let evaluatedCount = 0;
    let triggeredCount = 0;
    let resolvedCount = 0;

    try {
      const now = new Date();
      const rules = await prisma.alertRule.findMany({
        where: { enabled: true },
        include: {
          incidents: {
            where: { status: { in: ['triggered', 'active'] } },
            take: 1,
          },
        },
      });

      for (const rule of rules) {
        // Check if rule is due for evaluation based on checkFrequencyMins
        if (rule.lastEvaluatedAt) {
          const nextDue = new Date(rule.lastEvaluatedAt.getTime() + rule.checkFrequencyMins * 60 * 1000);
          if (now < nextDue) continue;
        }

        evaluatedCount++;
        const { isBreached, metricValue, summary } = await this.evaluateSingleRule(rule);

        const activeIncident = rule.incidents[0] || null;

        if (isBreached) {
          if (!activeIncident) {
            // New incident breached!
            triggeredCount++;
            // One secret per rule, kept: a fresh random secret on every alert made the
            // signature impossible for the receiver to verify.
            let secretKey = rule.webhookSecret;
            if (!secretKey) {
              secretKey = `whsec_${crypto.randomBytes(16).toString('hex')}`;
              await prisma.alertRule.updateMany({ where: { id: rule.id, userId: rule.userId, webhookSecret: null }, data: { webhookSecret: secretKey } });
              const stored = await prisma.alertRule.findFirst({ where: { id: rule.id, userId: rule.userId }, select: { webhookSecret: true } });
              secretKey = stored?.webhookSecret || secretKey;
            }

            const newIncident = await prisma.alertIncident.create({
              data: {
                ruleId: rule.id,
                userId: rule.userId,
                status: 'triggered',
                triggerValue: metricValue,
                summary,
              },
            });

            // Dispatch Webhook with X-Claritiy-Signature header if URL configured
            if (rule.notificationWebhookUrl) {
              WebhookDispatcher.sendSignedWebhook(rule.notificationWebhookUrl, secretKey, 'alert_triggered', {
                incidentId: newIncident.id,
                ruleId: rule.id,
                ruleName: rule.name,
                metric: rule.metric,
                triggerValue: metricValue,
                thresholdValue: rule.thresholdValue,
                summary,
                triggeredAt: newIncident.triggeredAt,
              }).catch((e) => logger.warn('AlertEvaluator: Webhook dispatch error', { error: String(e) }));
            }
          } else if (activeIncident.status === 'triggered') {
            // Transition existing incident to active state (suppresses repeat notifications)
            await prisma.alertIncident.update({
              where: { id: activeIncident.id },
              data: { status: 'active', triggerValue: metricValue },
            });
          }
        } else if (activeIncident) {
          // Condition no longer breached -> Resolve incident!
          resolvedCount++;
          await prisma.alertIncident.update({
            where: { id: activeIncident.id },
            data: {
              status: 'resolved',
              resolvedAt: new Date(),
            },
          });
        }

        // Update lastEvaluatedAt timestamp
        await prisma.alertRule.update({
          where: { id: rule.id },
          // (The webhook secret is created once, when first needed — never overwritten here.)
          data: { lastEvaluatedAt: now },
        });
      }
    } finally {
      this.isRunning = false;
    }

    return { evaluated: evaluatedCount, triggered: triggeredCount, resolved: resolvedCount };
  }

  private static async evaluateSingleRule(rule: any): Promise<{ isBreached: boolean; metricValue: number; summary: string }> {
    const windowStart = new Date(Date.now() - rule.evaluationWindowMins * 60 * 1000);

    // Aggregated in the database (Phase 12, heavy traffic): this runs every minute for every rule,
    // and loading every call row of a busy workspace's window into memory does not scale.
    const where = { userId: rule.userId, createdAt: { gte: windowStart } };
    const byStatus = await prisma.call.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
      _sum: { durationSeconds: true },
    });
    const countWhere = (pred: (status: string) => boolean) =>
      byStatus.reduce((acc, g) => acc + (pred(String(g.status || '').toLowerCase()) ? g._count._all : 0), 0);
    const totalCalls = countWhere(() => true);
    let metricValue = 0;

    switch (rule.metric) {
      case 'call_volume':
        metricValue = totalCalls;
        break;
      case 'error_rate': {
        const failedCalls = countWhere((s) => ['failed', 'canceled', 'error'].includes(s));
        metricValue = totalCalls > 0 ? Math.round((failedCalls / totalCalls) * 100) : 0;
        break;
      }
      case 'success_rate': {
        const completedCalls = countWhere((s) => s === 'completed');
        metricValue = totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100) : 100;
        break;
      }
      case 'cost': {
        const totalDurationSec = byStatus.reduce((acc, g) => acc + (g._sum.durationSeconds || 0), 0);
        metricValue = Math.round((totalDurationSec / 60) * 0.05 * 100) / 100;
        break;
      }
      case 'sentiment_score': {
        const positiveCalls = totalCalls > 0
          ? await prisma.call.count({ where: { ...where, sentiment: { contains: 'positive', mode: 'insensitive' } } })
          : 0;
        metricValue = totalCalls > 0 ? Math.round((positiveCalls / totalCalls) * 100) : 100;
        break;
      }
      default:
        metricValue = totalCalls;
    }

    let isBreached = false;
    if (rule.comparator === 'greater_than') {
      isBreached = metricValue > rule.thresholdValue;
    } else if (rule.comparator === 'less_than') {
      isBreached = metricValue < rule.thresholdValue;
    } else if (rule.comparator === 'equals') {
      isBreached = metricValue === rule.thresholdValue;
    }

    const summary = `Rule "${rule.name}" breached condition: ${rule.metric} current value is ${metricValue} (Threshold: ${rule.comparator} ${rule.thresholdValue} over past ${rule.evaluationWindowMins}m)`;

    return { isBreached, metricValue, summary };
  }
}
