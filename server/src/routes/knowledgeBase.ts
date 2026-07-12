import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { KnowledgeBaseController } from '../controllers/KnowledgeBaseController';

const router = Router();

router.post('/upload', requireAuth, KnowledgeBaseController.upload);
router.post('/scrape', requireAuth, KnowledgeBaseController.scrape);
router.get('/', requireAuth, KnowledgeBaseController.list);
router.delete('/:id', requireAuth, KnowledgeBaseController.delete);

export default router;
