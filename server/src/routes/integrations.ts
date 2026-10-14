import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { IntegrationsController } from '../controllers/IntegrationsController';
import { sensitiveOperationsLimiter } from '../middleware/rateLimiter';

const router = Router();

router.get('/', requireAuth, IntegrationsController.listIntegrations);
router.post('/:type', requireAuth, sensitiveOperationsLimiter, IntegrationsController.saveIntegration);
router.post('/:type/test', requireAuth, sensitiveOperationsLimiter, IntegrationsController.testIntegration);
router.delete('/:type', requireAuth, sensitiveOperationsLimiter, IntegrationsController.deleteIntegration);

export default router;
