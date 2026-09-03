import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { IntegrationsController } from '../controllers/IntegrationsController';

const router = Router();

router.get('/', requireAuth, IntegrationsController.listIntegrations);
router.post('/:type', requireAuth, IntegrationsController.saveIntegration);
router.post('/:type/test', requireAuth, IntegrationsController.testIntegration);
router.delete('/:type', requireAuth, IntegrationsController.deleteIntegration);

export default router;
