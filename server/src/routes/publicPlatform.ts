import { Router } from 'express';
import { PlatformConfigService } from '../services/PlatformConfigService';
import { logger } from '../utils/logger';

/**
 * GET /api/v2/public/platform
 * Public, read-only: live plan prices/limits (as charged at checkout), the maintenance banner, and
 * whether sign-ups / outgoing calls are paused. Set from the admin panel. Contains no secrets and no
 * customer data. Cached briefly by browsers and CDNs (30 s, the same as the server's refresh).
 */
export const publicPlatformRouter = Router();

publicPlatformRouter.get('/platform', async (_req, res) => {
  try {
    await PlatformConfigService.ensureLoaded();
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.status(200).json({ success: true, data: PlatformConfigService.getPublicState() });
  } catch (err: any) {
    logger.error('[PUBLIC_PLATFORM] Failed to read platform state', { error: err?.message });
    res.status(503).json({ success: false, error: 'UNAVAILABLE', message: 'Please try again shortly.' });
  }
});
