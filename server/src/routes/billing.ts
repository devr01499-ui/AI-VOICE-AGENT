import { Router } from 'express';
import { BillingService } from '../services/BillingService';
import { logger } from '../utils/logger';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';
import { env } from '../config/env';

const router = Router();

router.post('/create-plan-order', requireAuth, async (req, res) => {
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

router.post('/verify-plan', requireAuth, async (req: any, res: any) => {
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

    await billingService.processPlanPurchase(req.userId, plan, paymentId, orderId);
    
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

/**
 * GET /api/v2/billing/minutes-overview
 * Founder visibility endpoint showing total minutes consumed across all users,
 * total remaining minutes balance, user count, and Vobiz master wallet stats.
 */
router.get('/minutes-overview', requireAuth, async (req, res) => {
  try {
    const { prisma } = await import('../lib/prisma');
    const aggregate = await prisma.user.aggregate({
      _sum: {
        totalMinutesConsumed: true,
        minutesRemainingSeconds: true,
        callingBalanceMinutes: true,
      },
      _count: {
        id: true,
      },
    });

    const totalConsumedMinutes = aggregate._sum.totalMinutesConsumed || 0;
    const totalRemainingSeconds = aggregate._sum.minutesRemainingSeconds || 0;
    const totalRemainingMinutes = totalRemainingSeconds > 0
      ? (totalRemainingSeconds / 60)
      : (aggregate._sum.callingBalanceMinutes || 0);

    // Attempt to fetch Vobiz master account details safely
    let vobizMasterAccount: any = null;
    try {
      const rawAuthId = (env.VOBIZ_AUTH_ID || '').trim();
      const rawAuthToken = (env.VOBIZ_AUTH_TOKEN || '').trim();
      let baseUrl = (env.VOBIZ_API_URL || 'https://api.vobiz.ai').trim();
      baseUrl = baseUrl.replace(/\/+$/, '').replace(/\/api\/v1$/i, '');

      if (rawAuthId && rawAuthToken) {
        const vobizRes = await fetch(`${baseUrl}/api/v1/Account/${rawAuthId}/`, {
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-ID': rawAuthId,
            'X-Auth-Token': rawAuthToken,
          },
        });
        if (vobizRes.ok) {
          vobizMasterAccount = await vobizRes.json();
        } else {
          vobizMasterAccount = { note: `Vobiz master account query returned status ${vobizRes.status}` };
        }
      } else {
        vobizMasterAccount = { note: 'Vobiz credentials not set' };
      }
    } catch {
      vobizMasterAccount = { note: 'Vobiz master balance query unavailable or in mock mode' };
    }

    res.json({
      success: true,
      data: {
        totalUsers: aggregate._count.id,
        totalMinutesConsumed: Math.round(totalConsumedMinutes * 100) / 100,
        totalMinutesRemaining: Math.round(totalRemainingMinutes * 100) / 100,
        totalMinutesRemainingSeconds: Math.round(totalRemainingSeconds),
        vobizMasterAccount,
      },
    });
  } catch (err: any) {
    logger.error('Billing: failed to fetch minutes overview', { error: String(err) });
    res.status(500).json({ success: false, error: 'Failed to fetch minutes overview' });
  }
});

export default router;
