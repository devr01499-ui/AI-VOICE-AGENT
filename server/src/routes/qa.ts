import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { QaController } from '../controllers/QaController';

const router = Router();

router.get('/cohorts', requireAuth, QaController.listCohorts);
router.post('/cohorts', requireAuth, QaController.createCohort);
router.get('/cohorts/:id', requireAuth, QaController.getCohortDetails);
router.post('/cohorts/:id/evaluate', requireAuth, QaController.evaluateCohort);
router.delete('/cohorts/:id', requireAuth, QaController.deleteCohort);

export default router;
