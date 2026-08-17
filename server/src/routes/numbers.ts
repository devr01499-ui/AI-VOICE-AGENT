import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { BillingService } from '../services/BillingService';
import { UsageSyncService } from '../services/UsageSyncService';
import { VobizInventoryService } from '../services/VobizInventoryService';
import { VobizPhoneNumberService } from '../services/VobizPhoneNumberService';
import { ADMIN_EMAIL } from '../config/constants';

const router = Router();

const requireActivePlan = async (req: any, res: any, next: any) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || (user.email !== ADMIN_EMAIL && user.callingBalanceMinutes <= 0)) {
      res.status(403).json({ success: false, error: 'You must purchase a Trial Plan or Subscription to unlock phone number provisioning.' });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v2/numbers
 * Returns all active phone numbers provisioned to the current authenticated user's workspace.
 * Reads from our PhoneNumber table — no live Vobiz call needed.
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const numbers = await prisma.phoneNumber.findMany({
      where: { userId },
      select: {
        id: true,
        phoneNumber: true,
        assignedAgentId: true,
        countryCode: true,
        region: true,
        type: true,
        status: true,
        kycStatus: true,
        monthlyCost: true,
        setupFee: true,
        currency: true,
        capabilities: true,
        aadhaarRequired: true,
        telephonyProvider: true,
        nextBillingDate: true,
        purchasedAt: true,
      },
      orderBy: { purchasedAt: 'desc' },
    });

    res.json({ success: true, data: numbers });
  } catch (err) {
    logger.error('Numbers: failed to fetch numbers', { error: String(err) });
    next(err);
  }
});

/**
 * GET /api/v2/numbers/search?country=&type=&region=&page=&per_page=
 * Proxies Vobiz Inventory API. Auth required (no plan gate — users must be able to
 * browse numbers before purchasing a plan or with zero calling balance).
 */
router.get('/search', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).userId;

    const { country = 'IN', type = 'local', region, per_page } = req.query;

    logger.info('[NUMBERS_SEARCH] Fetching inventory', { userId, country, type, region });

    const inventoryService = new VobizInventoryService();
    let numbers = await inventoryService.getAvailableNumbers(userId, {
      country: country as string,
      type: type as string,
      region: region as string,
    });

    // Apply per_page limit if requested
    if (per_page) {
      numbers = numbers.slice(0, parseInt(per_page as string, 10));
    }

    logger.info('[NUMBERS_SEARCH] Inventory fetched successfully', { userId, count: numbers.length });

    res.json({
      success: true,
      data: {
        results: numbers,
        total: numbers.length,
      },
    });
  } catch (err) {
    // Log the REAL, specific error
    const errorDetail = err instanceof Error ? err.message : String(err);
    logger.error('[NUMBERS_SEARCH_ERROR] Failed to fetch inventory from Vobiz', {
      error: errorDetail,
      stack: err instanceof Error ? err.stack : undefined,
    });

    // Sanitize error string to prevent raw secret leaks while still surfacing real failure reason
    let sanitizedError = errorDetail;
    if (env.VOBIZ_AUTH_TOKEN && sanitizedError.includes(env.VOBIZ_AUTH_TOKEN)) {
      sanitizedError = sanitizedError.replaceAll(env.VOBIZ_AUTH_TOKEN, '[REDACTED]');
    }
    if (env.VOBIZ_AUTH_ID && sanitizedError.includes(env.VOBIZ_AUTH_ID)) {
      sanitizedError = sanitizedError.replaceAll(env.VOBIZ_AUTH_ID, '[REDACTED]');
    }

    res.status(502).json({
      success: false,
      error: `Failed to fetch available numbers: ${sanitizedError}`,
    });
  }
});

/**
 * POST /api/v2/numbers/create-order
 * Creates a Razorpay order for purchasing a number.
 * Body: { baseCost, setupFee?, currency? }
 */
router.post('/create-order', requireAuth, requireActivePlan, async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    const { baseCost = 1.5, setupFee = 0 } = req.body;

    const totalCost = baseCost + setupFee;
    const billingService = new BillingService();
    const order = await billingService.createNumberPurchaseOrder(userId, totalCost);

    res.json({ success: true, data: order });
  } catch (err: any) {
    logger.error('Numbers: failed to create order', { error: String(err) });
    if (err.message === 'Minimum amount must be at least 100 paise') {
      res.status(400).json({ success: false, error: err.message });
      return;
    }
    res.status(500).json({ success: false, error: 'Payment initialization failed. Please try again.' });
  }
});

/**
 * POST /api/v2/numbers/purchase
 * Server-confirmed payment → Vobiz purchase → PhoneNumber DB record.
 * 
 * Body: { vobizNumberId, expectedPrice, orderId, paymentId, signature, agentId? }
 * Idempotency: orderId is the unique idempotency key.
 * 
 * Failure safety:
 *   - If Vobiz purchase fails AFTER payment is verified, we refund the user automatically
 *     and log a [VOBIZ_PURCHASE_FAILURE] alert for ops.
 *   - Raw error strings from Vobiz are never returned to the client.
 */
router.post('/purchase', requireAuth, requireActivePlan, async (req, res, next) => {
  const userId = (req as any).userId;
  const { vobizNumberId, expectedPrice, orderId, paymentId, signature, agentId } = req.body;

  if (!vobizNumberId || expectedPrice === undefined || !orderId || !paymentId || !signature) {
    res.status(400).json({ success: false, error: 'Missing required purchase fields.' });
    return;
  }

  // Step 1: Server-side payment signature verification
  const billingService = new BillingService();
  const isValid = billingService.verifyPayment(orderId, paymentId, signature);
  if (!isValid) {
    res.status(400).json({ success: false, error: 'Payment verification failed. No charge was made.' });
    return;
  }

  // Step 2: Attempt Vobiz purchase (idempotency key = orderId, tied to the payment)
  try {
    const phoneService = new VobizPhoneNumberService();
    const result = await phoneService.purchaseAndAssignNumber({
      userId,
      idempotencyKey: orderId,
      vobizNumberId,
      expectedPrice,
      agentId,
    });

    res.json({
      success: true,
      data: {
        message: 'Number purchased and assigned successfully.',
        phoneNumberId: result.phoneNumber.id,
        number: result.phoneNumber.phoneNumber,
        status: result.phoneNumber.aadhaarRequired ? 'KYC Required' : 'Active',
        nextBillingDate: result.phoneNumber.nextBillingDate,
        monthlyCost: result.phoneNumber.monthlyCost,
        currency: result.phoneNumber.currency,
      }
    });

  } catch (err: any) {
    const errorMessage = err.message || '';

    // Detect post-payment Vobiz failure — must refund user
    if (errorMessage.includes('[VOBIZ_PURCHASE_FAILURE]')) {
      logger.error('[VOBIZ_PURCHASE_FAILURE] CRITICAL: Post-payment Vobiz failure — initiating refund', {
        userId,
        paymentId,
        orderId,
        vobizNumberId,
        errorMessage,
      });

      // Attempt automatic refund
      const amountInPaise = Math.round((expectedPrice + 2) * 100); // matches createNumberPurchaseOrder margin
      const refundResult = await billingService.refundOrder(paymentId, amountInPaise);

      if (refundResult.success) {
        res.status(503).json({
          success: false,
          error: 'This number is temporarily unavailable due to a provisioning issue. Your payment has been refunded automatically. Please try a different number or contact support.',
          refunded: true,
          refundId: refundResult.refundId,
        });
      } else {
        // Refund also failed — this needs immediate human attention
        logger.error('[VOBIZ_PURCHASE_FAILURE][REFUND_FAILED] URGENT: Manual refund required', {
          userId,
          paymentId,
          orderId,
          amountInPaise,
        });
        res.status(503).json({
          success: false,
          error: 'A provisioning error occurred and we were unable to automatically refund your payment. Please contact support immediately — no number was assigned and you will be refunded manually.',
          refunded: false,
        });
      }
      return;
    }

    // Price changed or idempotency conflict — safe user-facing messages
    if (errorMessage.includes('Price changed')) {
      res.status(409).json({ success: false, error: errorMessage });
      return;
    }
    if (errorMessage.includes('already in progress')) {
      res.status(409).json({ success: false, error: 'This purchase is already processing. Please wait and refresh.' });
      return;
    }
    if (errorMessage.includes('already been processed')) {
      res.status(409).json({ success: false, error: errorMessage });
      return;
    }

    logger.error('Numbers: purchase failed', { userId, error: errorMessage });
    res.status(500).json({ success: false, error: 'Purchase processing failed. Please contact support.' });
  }
});

/**
 * GET /api/v2/numbers/mine
 * Alias of GET / — explicit endpoint for "My Numbers" view.
 * Reads from our PhoneNumber table only; no live Vobiz call.
 */
router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).userId;

    const numbers = await prisma.phoneNumber.findMany({
      where: { userId },
      select: {
        id: true,
        phoneNumber: true,
        assignedAgentId: true,
        countryCode: true,
        region: true,
        type: true,
        status: true,
        kycStatus: true,
        monthlyCost: true,
        setupFee: true,
        currency: true,
        capabilities: true,
        aadhaarRequired: true,
        telephonyProvider: true,
        nextBillingDate: true,
        purchasedAt: true,
      },
      orderBy: { purchasedAt: 'desc' },
    });

    res.json({ success: true, data: numbers });
  } catch (err) {
    logger.error('Numbers: failed to fetch user numbers', { error: String(err) });
    next(err);
  }
});

/**
 * DELETE /api/v2/numbers/:id
 * Releases a phone number from the user's workspace
 */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    const id = req.params.id as string;

    if (!id) {
      res.status(400).json({ success: false, error: 'Phone number ID is required' });
      return;
    }

    await UsageSyncService.releaseNumber(id, userId);

    res.json({ success: true, message: 'Number released successfully' });
  } catch (err) {
    logger.error('Numbers: failed to release number', { error: String(err) });
    next(err);
  }
});

export default router;
