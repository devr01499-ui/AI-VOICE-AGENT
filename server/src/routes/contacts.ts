import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { ContactsController } from '../controllers/ContactsController';

const router = Router();

router.get('/', requireAuth, ContactsController.listContacts);
router.post('/', requireAuth, ContactsController.createContact);
router.put('/:id', requireAuth, ContactsController.updateContact);
router.delete('/:id', requireAuth, ContactsController.deleteContact);

export default router;
