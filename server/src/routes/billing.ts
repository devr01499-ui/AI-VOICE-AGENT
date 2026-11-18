import { Router } from 'express';
import { BillingService, PaymentVerificationError } from '../services/BillingService';
import { logger } from '../utils/logger';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';
import { env } from '../config/env';
import { ADMIN_EMAIL } from '../config/constants';
import { logAuditEvent } from '../utils/auditLogger';
import { sensitiveOperationsLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/create-plan-order', requireAuth, sensitiveOperationsLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const { planName, plan } = req.body || {};
    const targetPlan = planName || plan;
    if (!targetPlan || typeof targetPlan !== 'string') {
      res.status(400).json({ success: false, error: 'Plan name is required' });
      return;
    }
    if (!req.userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const order = await new BillingService().createPlanPurchaseOrder(targetPlan, req.userId);
    res.json({ success: true, data: order });
  } catch (err: any) {
    if (err instanceof PaymentVerificationError) {
      res.status(err.status).json({ success: false, error: err.message, code: err.code });
      return;
    }
    logger.error('Billing: failed to create plan order', { error: String(err) });
    res.status(500).json({ success: false, error: 'Payment initialization failed' });
  }
});

/**
 * POST /api/v2/billing/verify-plan — called by the checkout after payment. Success is returned
 * only after Razorpay's API confirms the payment (see BillingService). The plan activated is the
 * one on the server's order. A repeat of the same confirmation (or one that loses the race with
 * the webhook) returns success without adding minutes twice.
 */
router.post('/verify-plan', requireAuth, sensitiveOperationsLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const body = req.body || {};
    const orderId = body.orderId || body.razorpay_order_id;
    const paymentId = body.paymentId || body.razorpay_payment_id;
    const signature = body.signature || body.razorpay_signature;
    const clientPlan = body.plan || body.planName;

    const { prisma } = await import('../lib/prisma');
    const userBefore = await prisma.user.findUnique({ where: { id: req.userId }, select: { accountType: true } });

    const result = await new BillingService().processPlanPurchase({
      userId: req.userId,
      orderId,
      paymentId,
      signature,
      clientPlan: typeof clientPlan === 'string' ? clientPlan : undefined,
    });

    if (!result.alreadyActive) {
      await logAuditEvent({
        workspaceOwnerId: req.effectiveWorkspaceId || req.userId,
        actorUserId: req.userId,
        action: 'billing.plan.purchased',
        targetId: orderId,
        metadata: { plan: result.planKey, paymentId, orderId, previousPlan: userBefore?.accountType || 'none' },
      });
      if (userBefore?.accountType && userBefore.accountType !== 'free') {
        await logAuditEvent({
          workspaceOwnerId: req.effectiveWorkspaceId || req.userId,
          actorUserId: req.userId,
          action: 'billing.plan.changed',
          targetId: orderId,
          metadata: { plan: result.planKey, paymentId, orderId, previousPlan: userBefore.accountType },
        });
      }
    }

    res.json({
      success: true,
      data: {
        message: result.alreadyActive ? 'Your plan is already active.' : 'Plan purchased successfully.',
        plan: result.planKey,
        planName: result.planName,
        alreadyActive: result.alreadyActive,
      },
    });
  } catch (err: any) {
    if (err instanceof PaymentVerificationError) {
      res.status(err.status).json({ success: false, error: err.message, code: err.code, pending: err.status === 202 || err.code === 'PAYMENT_UNCONFIRMED' });
      return;
    }
    const message = String(err?.message || '');
    if (message === 'Payment has already been redeemed.' || message.includes('already redeemed')) {
      res.status(409).json({ success: false, error: 'Payment has already been redeemed.', code: 'PAYMENT_ALREADY_REDEEMED' });
      return;
    }
    logger.error('Billing: failed to verify plan', { error: message });
    res.status(500).json({ success: false, error: 'We could not activate your plan. If money was deducted, it will be activated automatically or refunded; contact support if it is not active within 30 minutes.' });
  }
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
router.post('/gstin', requireAuth, sensitiveOperationsLimiter, async (req: AuthenticatedRequest, res) => {
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

export default router;

