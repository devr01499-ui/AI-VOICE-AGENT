import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { ContactsController } from '../controllers/ContactsController';
import { sensitiveOperationsLimiter } from '../middleware/rateLimiter';

const router = Router();

router.get('/', requireAuth, ContactsController.listContacts);
router.post('/', requireAuth, sensitiveOperationsLimiter, ContactsController.createContact);
router.post('/import', requireAuth, sensitiveOperationsLimiter, ContactsController.bulkImportContacts);
router.put('/:id', requireAuth, sensitiveOperationsLimiter, ContactsController.updateContact);
router.delete('/:id', requireAuth, sensitiveOperationsLimiter, ContactsController.deleteContact);

export default router;
