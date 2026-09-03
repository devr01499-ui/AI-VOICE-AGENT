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
            const secretKey = rule.webhookSecret || `whsec_${crypto.randomBytes(16).toString('hex')}`;

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
          data: {
            lastEvaluatedAt: now,
            webhookSecret: rule.webhookSecret || `whsec_${crypto.randomBytes(16).toString('hex')}`,
          },
        });
      }
    } finally {
      this.isRunning = false;
    }

    return { evaluated: evaluatedCount, triggered: triggeredCount, resolved: resolvedCount };
  }

  private static async evaluateSingleRule(rule: any): Promise<{ isBreached: boolean; metricValue: number; summary: string }> {
    const windowStart = new Date(Date.now() - rule.evaluationWindowMins * 60 * 1000);

    const calls = await prisma.call.findMany({
      where: {
        userId: rule.userId,
        createdAt: { gte: windowStart },
      },
      select: {
        status: true,
        sentiment: true,
        durationSeconds: true,
      },
    });

    const totalCalls = calls.length;
    let metricValue = 0;

    switch (rule.metric) {
      case 'call_volume':
        metricValue = totalCalls;
        break;
      case 'error_rate': {
        const failedCalls = calls.filter((c) => ['failed', 'canceled', 'error'].includes((c.status || '').toLowerCase())).length;
        metricValue = totalCalls > 0 ? Math.round((failedCalls / totalCalls) * 100) : 0;
        break;
      }
      case 'success_rate': {
        const completedCalls = calls.filter((c) => (c.status || '').toLowerCase() === 'completed').length;
        metricValue = totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100) : 100;
        break;
      }
      case 'cost': {
        const totalDurationSec = calls.reduce((acc, c) => acc + (c.durationSeconds || 0), 0);
        metricValue = Math.round((totalDurationSec / 60) * 0.05 * 100) / 100;
        break;
      }
      case 'sentiment_score': {
        const positiveCalls = calls.filter((c) => (c.sentiment || '').toLowerCase().includes('positive')).length;
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
