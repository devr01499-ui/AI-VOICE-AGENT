import { Router } from 'express';
import { TelephonyController } from '../controllers/telephony.controller';

const router = Router();

// GET /api/v2/telephony/inventory
router.get('/inventory', TelephonyController.getInventory);

// POST /api/v2/telephony/sub-accounts
router.post('/sub-accounts', TelephonyController.provisionSubAccount);

// POST /api/v2/telephony/purchase
router.post('/purchase', TelephonyController.purchaseAndAssign);

export default router;
