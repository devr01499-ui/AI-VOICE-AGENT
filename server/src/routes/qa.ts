import { Router } from 'express';
import { requireAuth, requireEditor } from '../middleware/auth';
import { QaController } from '../controllers/QaController';
import { sensitiveOperationsLimiter } from '../middleware/rateLimiter';

const router = Router();

router.get('/cohorts', requireAuth, QaController.listCohorts);
router.post('/cohorts', requireAuth, requireEditor, sensitiveOperationsLimiter, QaController.createCohort);
router.get('/cohorts/:id', requireAuth, QaController.getCohortDetails);
router.post('/cohorts/:id/evaluate', requireAuth, requireEditor, sensitiveOperationsLimiter, QaController.evaluateCohort);
router.delete('/cohorts/:id', requireAuth, requireEditor, sensitiveOperationsLimiter, QaController.deleteCohort);

export default router;
