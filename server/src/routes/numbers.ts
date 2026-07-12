import { Router } from 'express';
import { getUserIdFromRequest } from '../utils/auth';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/v2/numbers
 * 
 * Returns all active phone numbers provisioned to the current authenticated user's workspace.
 */
router.get('/', async (req, res, next) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    logger.info('Numbers: fetching provisioned numbers', { userId });

    const numbers = await prisma.phoneNumber.findMany({
      where: { userId: userId },
      include: {
        agent: {
          select: {
            name: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: numbers,
    });
  } catch (err) {
    logger.error('Numbers: failed to fetch numbers', { error: String(err) });
    next(err);
  }
});

export default router;
