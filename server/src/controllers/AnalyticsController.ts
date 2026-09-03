/**
 * Analytics Controller
 *
 * Computes analytics metrics over call data (volume trends, completion rates, average duration,
 * sentiment breakdown, direction splits) scoped by userId and date range filters.
 */

import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

export class AnalyticsController {
  static async getAnalyticsSummary(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { startDate, endDate, agentId } = req.query;

      // Default date range: last 30 days if not specified
      const end = endDate ? new Date(String(endDate)) : new Date();
      const start = startDate
        ? new Date(String(startDate))
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const whereClause: any = {
        userId,
        createdAt: {
          gte: start,
          lte: end,
        },
      };

      if (agentId && typeof agentId === 'string' && agentId !== 'all') {
        whereClause.agentId = agentId;
      }

      const calls = await prisma.call.findMany({
        where: whereClause,
        select: {
          id: true,
          status: true,
          sentiment: true,
          durationSeconds: true,
          callDirection: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      const totalCalls = calls.length;

      // 1. Completion Rate Metrics
      let completed = 0;
      let failed = 0;
      let noAnswer = 0;
      let busy = 0;
      let inProgress = 0;

      calls.forEach((c) => {
        const s = (c.status || '').toLowerCase();
        if (s === 'completed') completed++;
        else if (s === 'failed' || s === 'canceled' || s === 'error') failed++;
        else if (s === 'no_answer') noAnswer++;
        else if (s === 'busy') busy++;
        else if (s === 'in_progress' || s === 'ringing') inProgress++;
      });

      const completionRatePct = totalCalls > 0 ? Math.round((completed / totalCalls) * 100) : 0;

      // 2. Average Duration & Cost Estimate
      let totalDurationSeconds = 0;
      let durationCount = 0;

      calls.forEach((c) => {
        if (typeof c.durationSeconds === 'number' && c.durationSeconds > 0) {
          totalDurationSeconds += c.durationSeconds;
          durationCount++;
        }
      });

      const averageDurationSeconds = durationCount > 0 ? Math.round(totalDurationSeconds / durationCount) : 0;
      const estimatedCostUsd = Math.round((totalDurationSeconds / 60) * 0.05 * 100) / 100; // $0.05 / min estimate

      // 3. Sentiment Breakdown
      let positive = 0;
      let neutral = 0;
      let negative = 0;

      calls.forEach((c) => {
        const sent = (c.sentiment || '').toLowerCase();
        if (sent.includes('positive')) positive++;
        else if (sent.includes('negative')) negative++;
        else neutral++;
      });

      const sentimentTotal = positive + neutral + negative || 1;
      const sentimentBreakdown = {
        positive,
        neutral,
        negative,
        positivePct: Math.round((positive / sentimentTotal) * 100),
        neutralPct: Math.round((neutral / sentimentTotal) * 100),
        negativePct: Math.round((negative / sentimentTotal) * 100),
      };

      // 4. Inbound vs Outbound Split
      let inbound = 0;
      let outbound = 0;

      calls.forEach((c) => {
        if (c.callDirection === 'inbound') inbound++;
        else outbound++;
      });

      const directionSplit = {
        inbound,
        outbound,
        inboundPct: totalCalls > 0 ? Math.round((inbound / totalCalls) * 100) : 0,
        outboundPct: totalCalls > 0 ? Math.round((outbound / totalCalls) * 100) : 0,
      };

      // 5. Volume Trends grouped by day
      const trendMap = new Map<string, { date: string; total: number; completed: number; failed: number }>();

      calls.forEach((c) => {
        const dateKey = new Date(c.createdAt).toISOString().split('T')[0];
        if (!trendMap.has(dateKey)) {
          trendMap.set(dateKey, { date: dateKey, total: 0, completed: 0, failed: 0 });
        }
        const item = trendMap.get(dateKey)!;
        item.total++;
        if ((c.status || '').toLowerCase() === 'completed') item.completed++;
        else item.failed++;
      });

      const volumeTrend = Array.from(trendMap.values());

      res.json({
        success: true,
        summary: {
          totalCalls,
          completionRatePct,
          averageDurationSeconds,
          totalDurationMinutes: Math.round(totalDurationSeconds / 60),
          estimatedCostUsd,
          statusBreakdown: {
            completed,
            failed,
            noAnswer,
            busy,
            inProgress,
          },
          sentimentBreakdown,
          directionSplit,
          volumeTrend,
        },
      });
    } catch (err: any) {
      logger.error('AnalyticsController: Error computing summary', { error: err.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}
