import { Router } from 'express';
import { BillingService } from '../services/BillingService';
import { logger } from '../utils/logger';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';
import { env } from '../config/env';
import { ADMIN_EMAIL } from '../config/constants';
import { logAuditEvent } from '../utils/auditLogger';
import { sensitiveOperationsLimiter } from '../middleware/rateLimiter';
import { getEffectiveRemainingSeconds, isUserEntitled } from '../middleware/planValidation';
import { touchUserSession } from '../utils/sessionManager';

const router = Router();

router.post('/create-plan-order', requireAuth, sensitiveOperationsLimiter, async (req, res) => {
  try {
    const { planName, plan, price } = req.body;
    const targetPlan = planName || plan || price;
    
    if (!targetPlan) {
      res.status(400).json({ success: false, error: 'Plan name is required' });
      return;
    }

    const billingService = new BillingService();
    const order = await billingService.createPlanPurchaseOrder(targetPlan);
    const keyId = order.keyId || order.key || env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || 'rzp_test_TO7mXkVkl4AFCy';
    const orderId = order.orderId || order.id;

    res.json({
      success: true,
      data: {
        ...order,
        id: orderId,
        orderId,
        keyId,
        key: keyId,
      }
    });
  } catch (err: any) {
    logger.error('Billing: failed to create plan order', { error: String(err) });
    if (err.message === 'Invalid or unknown plan name' || err.message === 'Minimum amount must be at least 100 paise') {
      res.status(400).json({ success: false, error: err.message });
      return;
    }
    res.status(500).json({ success: false, error: 'Payment initialization failed' });
  }
});

/**
 * Shared verification handler supporting both /verify-plan and /verify-plan-payment.
 */
async function handlePlanVerification(req: any, res: any) {
  try {
    const plan = req.body.plan || req.body.planName;
    const orderId = req.body.orderId || req.body.razorpay_order_id;
    const paymentId = req.body.paymentId || req.body.razorpay_payment_id;
    const signature = req.body.signature || req.body.razorpay_signature;

    if (!plan || !orderId || !paymentId || !signature) {
      res.status(400).json({ success: false, error: 'Missing required payment verification fields' });
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

    const { prisma } = await import('../lib/prisma');
    const userBefore = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { accountType: true }
    });

    await billingService.processPlanPurchase(req.userId, plan, paymentId, orderId);

    const isPlanChange = !!userBefore?.accountType && userBefore.accountType !== 'free';

    await logAuditEvent({
      workspaceOwnerId: req.effectiveWorkspaceId || req.userId,
      actorUserId: req.userId,
      action: 'billing.plan.purchased',
      targetId: orderId,
      metadata: { plan, paymentId, orderId, previousPlan: userBefore?.accountType || 'none' },
    });

    if (isPlanChange) {
      await logAuditEvent({
        workspaceOwnerId: req.effectiveWorkspaceId || req.userId,
        actorUserId: req.userId,
        action: 'billing.plan.changed',
        targetId: orderId,
        metadata: { plan, paymentId, orderId, previousPlan: userBefore?.accountType },
      });
    }

    logger.info(`Plan purchased: ${plan}, OrderId: ${orderId}, UserId: ${req.userId}`);

    res.json({
      success: true,
      data: {
        message: 'Plan purchased successfully.',
      }
    });
  } catch (err: any) {
    logger.error('Billing: failed to verify plan', { error: String(err) });
    if (err.message === 'Payment has already been redeemed.') {
      res.status(400).json({ success: false, error: 'Payment has already been redeemed.' });
      return;
    }
    res.status(500).json({ success: false, error: err.message || 'Verification failed' });
  }
}

router.post('/verify-plan', requireAuth, sensitiveOperationsLimiter, handlePlanVerification);
router.post('/verify-plan-payment', requireAuth, sensitiveOperationsLimiter, handlePlanVerification);

/**
 * GET /api/v2/billing/config
 * Exposes active public payment gateway key for client-side checkout hydration.
 */
router.get('/config', (req, res) => {
  res.json({
    success: true,
    data: {
      razorpayKeyId: env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || 'rzp_test_TO7mXkVkl4AFCy',
    },
  });
});

/**
 * GET /api/v2/billing/minutes-overview
 * Founder visibility endpoint showing total minutes consumed across all users,
 * total remaining minutes balance, user count, and Vobiz master wallet stats.
 * Restricted exclusively to admin accounts.
 */
router.get('/minutes-overview', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { prisma } = await import('../lib/prisma');
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || (user.accountType !== 'admin' && user.email !== ADMIN_EMAIL)) {
      res.status(403).json({ success: false, error: 'Access Denied: Founder admin privilege required.' });
      return;
    }
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

/**
 * GET /api/v2/billing/invoices
 * Lists all generated GST invoices for the authenticated customer.
 */
router.get('/invoices', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { InvoiceService } = await import('../services/InvoiceService');
    const invoices = await InvoiceService.getCustomerInvoices(req.userId!);
    res.json({ success: true, data: invoices });
  } catch (err: any) {
    logger.error('Billing: failed to fetch customer invoices', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to fetch invoices' });
  }
});

/**
 * GET /api/v2/billing/invoices/:id/download
 * Downloads HTML tax invoice for printing or PDF save.
 */
router.get('/invoices/:id/download', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { prisma } = await import('../lib/prisma');
    const { InvoiceService } = await import('../services/InvoiceService');

    const invoiceId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, userId: req.userId },
    });

    if (!invoice) {
      res.status(404).send('Invoice not found');
      return;
    }

    const html = InvoiceService.generateInvoiceHtml(invoice);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="${invoice.invoiceNumber}.html"`);
    res.send(html);
  } catch (err: any) {
    logger.error('Billing: failed to download invoice', { error: err.message });
    res.status(500).send('Failed to generate invoice document');
  }
});

/**
 * POST /api/v2/billing/gstin
 * Updates user company GSTIN to be included on future invoices.
 */
router.post('/gstin', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { gstin } = req.body;
    if (!gstin || typeof gstin !== 'string' || !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin.trim().toUpperCase())) {
      res.status(400).json({ success: false, error: 'Invalid GSTIN format (15 alphanumeric characters standard format required).' });
      return;
    }

    const { prisma } = await import('../lib/prisma');
    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: { companyGstin: gstin.trim().toUpperCase() },
      select: { id: true, companyGstin: true },
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    logger.error('Billing: failed to update company GSTIN', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to update GSTIN' });
  }
});

/**
 * GET /api/v2/billing/subscription-status
 * Real-time authoritative subscription status check (bypasses stale client state).
 */
router.get('/subscription-status', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.effectiveWorkspaceId || req.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { prisma } = await import('../lib/prisma');
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        accountType: true,
        accountStatus: true,
        callingBalanceMinutes: true,
        minutesRemainingSeconds: true,
        totalMinutesConsumed: true,
        suspendedAt: true,
        suspendedReason: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const effectiveRemainingSeconds = getEffectiveRemainingSeconds(user);
    const entitled = isUserEntitled(user);

    const latestTx = await prisma.paymentTransaction.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderId: true,
        paymentId: true,
        planName: true,
        amount: true,
        currency: true,
        status: true,
        createdAt: true,
      },
    });

    res.json({
      success: true,
      data: {
        userId: user.id,
        email: user.email,
        accountType: user.accountType,
        accountStatus: user.accountStatus,
        isEntitled: entitled,
        callingBalanceMinutes: user.callingBalanceMinutes,
        minutesRemainingSeconds: user.minutesRemainingSeconds,
        effectiveRemainingSeconds,
        effectiveRemainingMinutes: Math.round((effectiveRemainingSeconds / 60) * 100) / 100,
        latestTransaction: latestTx,
        verifiedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    logger.error('Billing: failed to verify real-time subscription status', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to verify subscription status' });
  }
});

/**
 * POST /api/v2/billing/sync-entitlements
 * Re-validates server-side entitlements and touches session freshness for client token refresh.
 */
router.post('/sync-entitlements', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.effectiveWorkspaceId || req.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    await touchUserSession(userId);

    const { prisma } = await import('../lib/prisma');
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        accountType: true,
        callingBalanceMinutes: true,
        minutesRemainingSeconds: true,
        accountStatus: true,
      },
    });

    const effectiveRemainingSeconds = user ? getEffectiveRemainingSeconds(user) : 0;
    const entitled = user ? isUserEntitled(user) : false;

    res.json({
      success: true,
      data: {
        synced: true,
        accountType: user?.accountType || 'free',
        isEntitled: entitled,
        effectiveRemainingSeconds,
        refreshedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    logger.error('Billing: failed to sync user entitlements', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to sync entitlements' });
  }
});

export default router;

