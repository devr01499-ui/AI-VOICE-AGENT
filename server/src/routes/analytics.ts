import { Router } from 'express';
import { prisma } from '../config/database';
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

    // 1. Fetch all calls for this user
    const calls = await prisma.call.findMany({
      where: { userId },
      select: {
        durationSeconds: true,
        status: true,
        createdAt: true,
      }
    });

    // 2. Compute aggregations
    let totalSeconds = 0;
    let completedCount = 0;
    const statusCounts: Record<string, number> = {
      completed: 0,
      failed: 0,
      busy: 0,
      queued: 0,
      ringing: 0,
      in_progress: 0,
      no_answer: 0,
    };

    calls.forEach(c => {
      const dur = c.durationSeconds || 0;
      totalSeconds += dur;
      
      const st = c.status || 'failed';
      statusCounts[st] = (statusCounts[st] || 0) + 1;
      
      if (st === 'completed') {
        completedCount++;
      }
    });

    const totalMinutesUsed = Number((totalSeconds / 60).toFixed(2));
    const averageCallDuration = calls.length > 0 
      ? Number((totalSeconds / calls.length).toFixed(1))
      : 0;

    res.json({
      success: true,
      data: {
        totalMinutesUsed,
        averageCallDuration,
        statusCodeBreakdown: statusCounts,
        totalCalls: calls.length,
        callsList: calls.slice(0, 100), // return last 100 calls for visual charts
      }
    });
  } catch (err) {
    logger.error('Analytics: failed to generate call summary', { error: String(err) });
    next(err);
  }
});

export default router;
