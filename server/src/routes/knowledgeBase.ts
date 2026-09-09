import { Router } from 'express';
import { requireAuth, requireEditor } from '../middleware/auth';
import { KnowledgeBaseController } from '../controllers/KnowledgeBaseController';

const router = Router();

router.post('/upload', requireAuth, requireEditor, KnowledgeBaseController.upload);
router.post('/scrape', requireAuth, requireEditor, KnowledgeBaseController.scrape);
router.get('/', requireAuth, KnowledgeBaseController.list);
router.delete('/:id', requireAuth, requireEditor, KnowledgeBaseController.delete);
router.post('/:id/assign', requireAuth, requireEditor, KnowledgeBaseController.assignToAgent);
router.post('/:id/unassign', requireAuth, requireEditor, KnowledgeBaseController.unassignFromAgent);
router.post('/:id/update-agents', requireAuth, requireEditor, KnowledgeBaseController.updateAgentAssignments);

export default router;

