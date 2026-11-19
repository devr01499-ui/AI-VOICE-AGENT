import { Router } from 'express';
import { requireAuth, requireEditor } from '../middleware/auth';
import { ContactsController } from '../controllers/ContactsController';
import { sensitiveOperationsLimiter } from '../middleware/rateLimiter';

const router = Router();

router.get('/', requireAuth, ContactsController.listContacts);
// Viewers/analysts are read-only (audit #47: they could delete contacts or clear opt-outs).
router.post('/', requireAuth, requireEditor, sensitiveOperationsLimiter, ContactsController.createContact);
router.post('/import', requireAuth, requireEditor, sensitiveOperationsLimiter, ContactsController.bulkImportContacts);
router.put('/:id', requireAuth, requireEditor, sensitiveOperationsLimiter, ContactsController.updateContact);
router.delete('/:id', requireAuth, requireEditor, sensitiveOperationsLimiter, ContactsController.deleteContact);

export default router;
