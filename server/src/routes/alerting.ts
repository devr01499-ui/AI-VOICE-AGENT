import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { AlertingController } from '../controllers/AlertingController';
import { sensitiveOperationsLimiter } from '../middleware/rateLimiter';

const router = Router();

router.get('/rules', requireAuth, AlertingController.listRules);
router.post('/rules', requireAuth, sensitiveOperationsLimiter, AlertingController.createRule);
router.put('/rules/:id', requireAuth, sensitiveOperationsLimiter, AlertingController.updateRule);
router.delete('/rules/:id', requireAuth, sensitiveOperationsLimiter, AlertingController.deleteRule);

router.get('/incidents', requireAuth, AlertingController.listIncidents);
router.post('/evaluate-now', requireAuth, sensitiveOperationsLimiter, AlertingController.triggerEvaluation);

export default router;
