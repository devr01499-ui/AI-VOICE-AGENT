import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { ChatHistoryController } from '../controllers/ChatHistoryController';

const router = Router();

router.get('/', requireAuth, ChatHistoryController.listChatMessages);
router.post('/', requireAuth, ChatHistoryController.logMessage);

export default router;
