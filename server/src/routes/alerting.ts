import { Router } from 'express';
import { requireAuth, requireEditor } from '../middleware/auth';
import { AlertingController } from '../controllers/AlertingController';
import { sensitiveOperationsLimiter } from '../middleware/rateLimiter';

const router = Router();

router.get('/rules', requireAuth, AlertingController.listRules);
// Rule changes need an editor role (audit #57).
router.post('/rules', requireAuth, requireEditor, sensitiveOperationsLimiter, AlertingController.createRule);
router.put('/rules/:id', requireAuth, requireEditor, sensitiveOperationsLimiter, AlertingController.updateRule);
router.delete('/rules/:id', requireAuth, requireEditor, sensitiveOperationsLimiter, AlertingController.deleteRule);

router.get('/incidents', requireAuth, AlertingController.listIncidents);
router.post('/evaluate-now', requireAuth, requireEditor, sensitiveOperationsLimiter, AlertingController.triggerEvaluation);

export default router;
