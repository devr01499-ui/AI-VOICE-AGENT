import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/v2/analytics/summary
 * 
 * Returns dynamic aggregations of call data strictly isolated to the authenticated user's UUID.
 */
router.get('/summary', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized: Missing authenticated session context' });
      return;
    }

    logger.info('Analytics: generating call summary', { userId });

    // 1. Fetch aggregates instead of loading all calls into memory
    const aggregate = await prisma.call.aggregate({
      where: { userId },
      _sum: { durationSeconds: true },
      _count: { id: true },
    });

    // 2. Compute aggregations using DB grouping
    const statusGroups = await prisma.call.groupBy({
      by: ['status'],
      where: { userId },
      _count: { id: true },
    });

    const statusCounts: Record<string, number> = {
      completed: 0,
      failed: 0,
      busy: 0,
      queued: 0,
      ringing: 0,
      in_progress: 0,
      no_answer: 0,
    };

    statusGroups.forEach((group) => {
      const st = group.status || 'failed';
      statusCounts[st] = group._count.id;
    });

    const totalSeconds = aggregate._sum.durationSeconds || 0;
    const totalCalls = aggregate._count.id || 0;

    const totalMinutesUsed = Number((totalSeconds / 60).toFixed(2));
    const averageCallDuration = totalCalls > 0 
      ? Number((totalSeconds / totalCalls).toFixed(1))
      : 0;

    // Fetch only the most recent 100 calls for visual charts
    const recentCalls = await prisma.call.findMany({
      where: { userId },
      select: {
        durationSeconds: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({
      success: true,
      data: {
        totalMinutesUsed,
        averageCallDuration,
        statusCodeBreakdown: statusCounts,
        totalCalls,
        callsList: recentCalls,
      }
    });
  } catch (err) {
    logger.error('Analytics: failed to generate call summary', { error: String(err) });
    next(err);
  }
});

export default router;
