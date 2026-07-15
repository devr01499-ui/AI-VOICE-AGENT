import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/v2/user/billing-config
 * 
 * Saves the user's custom Gemini Live API key (BYOK mode) in the User table.
 */
router.post('/billing-config', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { geminiApiKey } = req.body;
    // We allow setting to empty string/null to clear it and fall back to platform account balances
    const apiKeyVal = (geminiApiKey && typeof geminiApiKey === 'string' && geminiApiKey.trim() !== '')
      ? geminiApiKey.trim()
      : null;

    logger.info('User billing-config: updating custom Gemini API key', { userId, hasKey: !!apiKeyVal });

    await prisma.user.update({
      where: { id: userId },
      data: {
        geminiApiKey: apiKeyVal
      }
    });

    res.json({
      success: true,
      message: 'Gemini Live API Custom Key updated successfully.'
    });
  } catch (err) {
    logger.error('User billing-config: failed to update settings', { error: String(err) });
    next(err);
  }
});

export default router;
