import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { AnalyticsController } from '../controllers/AnalyticsController';

const router = Router();

router.get('/summary', requireAuth, AnalyticsController.getAnalyticsSummary);

export default router;
