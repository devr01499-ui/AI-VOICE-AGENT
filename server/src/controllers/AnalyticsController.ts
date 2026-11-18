/**
 * Analytics Controller
 *
 * Call analytics for one account and date range: volume per day, completion rate, average
 * duration, billed minutes, sentiment and direction split.
 *
 * Computed in the database (one GROUP BY), so 100k calls cost the same as 100: the old version
 * loaded every call into memory. Days are Indian days (Asia/Kolkata): the old version used UTC
 * days, so calls between 00:00 and 05:30 IST were counted on the previous day.
 */

import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

const MAX_RANGE_DAYS = 366;

/** Billing rule (CLAUDE.md §4): every answered call is billed per started minute, minimum 1. */
const BILLED_MINUTES_SQL = `CASE WHEN c."duration_seconds" > 0 THEN GREATEST(1, CEIL(c."duration_seconds" / 60.0)) ELSE 0 END`;

function parseDate(value: unknown): Date | null | 'invalid' {
  if (value === undefined || value === null || value === '') return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? 'invalid' : d;
}

export class AnalyticsController {
  static async getAnalyticsSummary(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).effectiveWorkspaceId || (req as any).user?.id || (req as any).user?.userId || (req as any).userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { startDate, endDate, agentId } = req.query;
      const parsedEnd = parseDate(endDate);
      const parsedStart = parseDate(startDate);
      if (parsedEnd === 'invalid' || parsedStart === 'invalid') {
        res.status(400).json({ success: false, error: 'Invalid date range.' });
        return;
      }
      const end = parsedEnd || new Date();
      const start = parsedStart || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      if (start > end || end.getTime() - start.getTime() > MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) {
        res.status(400).json({ success: false, error: `Choose a date range of up to ${MAX_RANGE_DAYS} days.` });
        return;
      }

      const params: unknown[] = [String(userId), start, end];
      let agentFilter = '';
      if (agentId && typeof agentId === 'string' && agentId !== 'all') {
        params.push(agentId);
        agentFilter = ` AND c."agent_id" = $4`;
      }

      const rows: Array<{ day: string; status: string; direction: string; sentiment: string; n: number; dur: number; durn: number; billed: number }> =
        await prisma.$queryRawUnsafe(
          `SELECT
             to_char((c."created_at" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day,
             lower(coalesce(c."status", '')) AS status,
             CASE WHEN c."call_direction" = 'inbound' THEN 'inbound' ELSE 'outbound' END AS direction,
             CASE WHEN lower(coalesce(c."sentiment", '')) LIKE '%positive%' THEN 'positive'
                  WHEN lower(coalesce(c."sentiment", '')) LIKE '%negative%' THEN 'negative'
                  ELSE 'neutral' END AS sentiment,
             count(*)::int AS n,
             coalesce(sum(CASE WHEN c."duration_seconds" > 0 THEN c."duration_seconds" ELSE 0 END), 0)::float8 AS dur,
             count(*) FILTER (WHERE c."duration_seconds" > 0)::int AS durn,
             coalesce(sum(${BILLED_MINUTES_SQL}), 0)::float8 AS billed
           FROM "calls" c
           WHERE c."user_id" = $1 AND c."created_at" >= $2 AND c."created_at" <= $3${agentFilter}
           GROUP BY 1, 2, 3, 4
           ORDER BY 1`,
          ...params
        );

      let totalCalls = 0, completed = 0, failed = 0, noAnswer = 0, busy = 0, inProgress = 0;
      let totalDurationSeconds = 0, durationCount = 0, billedMinutes = 0;
      let positive = 0, neutral = 0, negative = 0, inbound = 0, outbound = 0;
      const trendMap = new Map<string, { date: string; total: number; completed: number; failed: number }>();

      for (const r of rows) {
        const n = Number(r.n);
        totalCalls += n;
        if (r.status === 'completed') completed += n;
        else if (r.status === 'failed' || r.status === 'canceled' || r.status === 'cancelled' || r.status === 'error') failed += n;
        else if (r.status === 'no_answer') noAnswer += n;
        else if (r.status === 'busy') busy += n;
        else if (r.status === 'in_progress' || r.status === 'ringing') inProgress += n;
        totalDurationSeconds += Number(r.dur);
        durationCount += Number(r.durn);
        billedMinutes += Number(r.billed);
        if (r.sentiment === 'positive') positive += n; else if (r.sentiment === 'negative') negative += n; else neutral += n;
        if (r.direction === 'inbound') inbound += n; else outbound += n;
        const item = trendMap.get(r.day) || { date: r.day, total: 0, completed: 0, failed: 0 };
        item.total += n;
        if (r.status === 'completed') item.completed += n; else item.failed += n;
        trendMap.set(r.day, item);
      }

      const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
      const sentimentTotal = positive + neutral + negative;

      res.json({
        success: true,
        summary: {
          totalCalls,
          completionRatePct: pct(completed, totalCalls),
          averageDurationSeconds: durationCount > 0 ? Math.round(totalDurationSeconds / durationCount) : 0,
          totalDurationMinutes: Math.round(totalDurationSeconds / 60),
          billedMinutes,
          timeZone: 'Asia/Kolkata',
          statusBreakdown: { completed, failed, noAnswer, busy, inProgress },
          sentimentBreakdown: {
            positive,
            neutral,
            negative,
            positivePct: pct(positive, sentimentTotal),
            neutralPct: pct(neutral, sentimentTotal),
            negativePct: pct(negative, sentimentTotal),
          },
          directionSplit: { inbound, outbound, inboundPct: pct(inbound, totalCalls), outboundPct: pct(outbound, totalCalls) },
          volumeTrend: Array.from(trendMap.values()),
        },
      });
    } catch (err: any) {
      logger.error('AnalyticsController: Error computing summary', { error: err.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}
