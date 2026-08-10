import { Router } from 'express';
import { BillingService } from '../services/BillingService';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

router.post('/create-plan-order', async (req, res) => {
  try {
    const { price } = req.body; // e.g. 2999
    
    if (!price || isNaN(price)) {
      res.status(400).json({ success: false, error: 'Invalid price' });
      return;
    }

    const billingService = new BillingService();
    const order = await billingService.createPlanPurchaseOrder(price);
    
    res.json({ success: true, data: order });
  } catch (err: any) {
    logger.error('Billing: failed to create plan order', { error: String(err) });
    if (err.message === 'Minimum amount must be at least 100 paise') {
      res.status(400).json({ success: false, error: err.message });
      return;
    }
    res.status(500).json({ success: false, error: 'Payment initialization failed' });
  }
});

router.post('/verify-plan', async (req: any, res: any) => {
  try {
    const { plan, orderId, paymentId, signature } = req.body;

    if (!plan || !orderId || !paymentId || !signature) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    const billingService = new BillingService();
    const isValid = billingService.verifyPayment(orderId, paymentId, signature);

    if (!isValid) {
      res.status(400).json({ success: false, error: 'Invalid payment signature' });
      return;
    }

    if (!req.userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    await billingService.processPlanPurchase(req.userId, plan);
    
    logger.info(`Plan purchased: ${plan}, OrderId: ${orderId}, UserId: ${req.userId}`);

    res.json({
      success: true,
      data: {
        message: 'Plan purchased successfully.',
      }
    });
  } catch (err: any) {
    logger.error('Billing: failed to verify plan', { error: String(err) });
    res.status(500).json({ success: false, error: err.message || 'Verification failed' });
  }
});

export default router;
