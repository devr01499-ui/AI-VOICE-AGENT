import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { ChatHistoryController } from '../controllers/ChatHistoryController';
import { sensitiveOperationsLimiter } from '../middleware/rateLimiter';

const router = Router();

router.get('/', requireAuth, ChatHistoryController.listChatMessages);
router.post('/', requireAuth, sensitiveOperationsLimiter, ChatHistoryController.logMessage);

export default router;
