import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { AlertingController } from '../controllers/AlertingController';

const router = Router();

router.get('/rules', requireAuth, AlertingController.listRules);
router.post('/rules', requireAuth, AlertingController.createRule);
router.put('/rules/:id', requireAuth, AlertingController.updateRule);
router.delete('/rules/:id', requireAuth, AlertingController.deleteRule);

router.get('/incidents', requireAuth, AlertingController.listIncidents);
router.post('/evaluate-now', requireAuth, AlertingController.triggerEvaluation);

export default router;
