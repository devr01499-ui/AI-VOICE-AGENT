import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { TelephonyController } from '../controllers/telephony.controller';

const router = Router();

// GET /api/v2/telephony/inventory
router.get('/inventory', requireAuth, TelephonyController.getInventory);

// GET /api/v2/telephony/sub-accounts
router.get('/sub-accounts', requireAuth, TelephonyController.getSubAccount);

// POST /api/v2/telephony/sub-accounts
router.post('/sub-accounts', requireAuth, TelephonyController.provisionSubAccount);

// POST /api/v2/telephony/purchase
router.post('/purchase', requireAuth, TelephonyController.purchaseAndAssign);

export default router;
