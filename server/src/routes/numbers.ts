import { Router } from 'express';
import { requireAuth, requireEditor } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { BillingService } from '../services/BillingService';
import { UsageSyncService } from '../services/UsageSyncService';
import { VobizInventoryService } from '../services/VobizInventoryService';
import { VobizPhoneNumberService } from '../services/VobizPhoneNumberService';
import { ADMIN_EMAIL } from '../config/constants';
import { env } from '../config/env';
import { logAuditEvent } from '../utils/auditLogger';
import { sensitiveOperationsLimiter } from '../middleware/rateLimiter';

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
 * Checks that all required KycDocument records (PAN + GST) are verified for the user.
 * Blocks number selection and purchasing before charging or locking if KYC is incomplete.
 */
export async function checkRequiredKycDocumentsVerified(userId: string): Promise<{ verified: boolean; missing: string[]; error?: string }> {
  const docs = await prisma.kycDocument.findMany({
    where: { userId },
  });

  const panDoc = docs.find((d) => d.documentType === 'pan');
  const gstDoc = docs.find((d) => d.documentType === 'gst');

  const missing: string[] = [];
  if (!panDoc || panDoc.status !== 'verified') {
    missing.push('PAN');
  }
  if (!gstDoc || gstDoc.status !== 'verified') {
    missing.push('GST');
  }

  if (missing.length > 0) {
    return {
      verified: false,
      missing,
      error: `KYC verification required: ${missing.join(' and ')} document${missing.length > 1 ? 's' : ''} not verified. Please complete KYC & Compliance verification in Settings before selecting or claiming a phone number.`,
    };
  }

  return { verified: true, missing: [] };
}

/**
 * GET /api/v2/numbers
 * Returns all active phone numbers provisioned to the current authenticated user's workspace.
 * Reads from our PhoneNumber table — no live Vobiz call needed.
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).effectiveWorkspaceId || (req as any).userId;
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
  * GET /api/v2/numbers/status
  * Checks if the user's phone number selection is locked and returns active number details.
  */
router.get('/status', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).effectiveWorkspaceId || (req as any).userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { numberLocked: true, email: true, accountType: true }
    });

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const primaryNumber = await prisma.phoneNumber.findFirst({
      where: { userId },
      orderBy: { purchasedAt: 'desc' },
    });

    const kycCheck = await checkRequiredKycDocumentsVerified(userId);

    res.json({
      success: true,
      data: {
        numberLocked: user.numberLocked || false,
        accountType: user.accountType,
        hasNumber: !!primaryNumber,
        number: primaryNumber ? primaryNumber.phoneNumber : null,
        numberStatus: primaryNumber ? primaryNumber.status : null,
        kycStatus: primaryNumber ? primaryNumber.kycStatus : (kycCheck.verified ? 'verified' : 'pending'),
        isKycVerified: kycCheck.verified,
        missingKycDocuments: kycCheck.missing,
      }
    });
  } catch (err) {
    logger.error('Numbers: failed to fetch status', { error: String(err) });
    next(err);
  }
});

/**
 * GET /api/v2/numbers/vobiz-probe
 * Temporary diagnostic route to test raw Vobiz inventory request directly from Render runtime.
 */
router.get('/vobiz-probe', requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || (user.accountType !== 'admin' && user.email !== ADMIN_EMAIL)) {
    res.status(403).json({ success: false, error: 'Access Denied: Founder admin privilege required for diagnostic probe.' });
    return;
  }
  const country = (req.query.country as string) || 'IN';
  const numberType = (req.query.type as string) || 'local';

  const rawAuthId = (env.VOBIZ_AUTH_ID || process.env.VOBIZ_AUTH_ID || '').trim();
  const rawAuthToken = (env.VOBIZ_AUTH_TOKEN || process.env.VOBIZ_AUTH_TOKEN || '').trim();
  let baseUrl = (env.VOBIZ_API_URL || process.env.VOBIZ_API_URL || 'https://api.vobiz.ai').trim();
  baseUrl = baseUrl.replace(/\/+$/, '').replace(/\/api\/v1$/i, '');

  const endpoint = `/api/v1/Account/${rawAuthId}/inventory/numbers?country=${country}&number_type=${numberType}`;
  const constructedUrl = `${baseUrl}${endpoint}`;

  const start = Date.now();
  let statusCode = 0;
  let statusText = '';
  let responseHeaders: Record<string, string> = {};
  let rawResponseBody = '';
  let errorPayload: any = null;

  try {
    const vobizRes = await fetch(constructedUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-ID': rawAuthId,
        'X-Auth-Token': rawAuthToken,
      },
    });

    statusCode = vobizRes.status;
    statusText = vobizRes.statusText;
    vobizRes.headers.forEach((val, key) => {
      responseHeaders[key] = val;
    });
    rawResponseBody = await vobizRes.text();
  } catch (err: any) {
    errorPayload = {
      message: err.message,
      code: err.code,
      name: err.name,
      stack: err.stack,
    };
  }

  const durationMs = Date.now() - start;

  res.json({
    diagnosticTime: new Date().toISOString(),
    durationMs,
    envCheck: {
      hasAuthId: !!rawAuthId,
      authIdLength: rawAuthId.length,
      authIdFirst3: rawAuthId.substring(0, 3),
      hasAuthToken: !!rawAuthToken,
      authTokenLength: rawAuthToken.length,
      baseUrl,
    },
    constructedUrl,
    response: {
      statusCode,
      statusText,
      headers: responseHeaders,
      body: rawResponseBody,
    },
    error: errorPayload,
  });
});

/**
 * GET /api/v2/numbers/search?country=&type=&region=&page=&per_page=
 * Proxies Vobiz Inventory API. Auth required (no plan gate — users must be able to
 * browse numbers before purchasing a plan or with zero calling balance).
 */
router.get('/search', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).userId;

    const { country = 'IN', type = 'local', region, page = '1', per_page = '20' } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const perPageNum = parseInt(per_page as string, 10) || 20;

    logger.info('[NUMBERS_SEARCH] Fetching inventory', { userId, country, type, region, page: pageNum, perPage: perPageNum });

    const inventoryService = new VobizInventoryService();
    const inventoryResult = await inventoryService.getAvailableNumbers(userId, {
      country: country as string,
      type: type as string,
      region: region as string,
      page: pageNum,
      per_page: perPageNum,
    });

    logger.info('[NUMBERS_SEARCH] Inventory fetched successfully', { userId, count: inventoryResult.items.length, total: inventoryResult.total });

    res.json({
      success: true,
      data: {
        results: inventoryResult.items,
        total: inventoryResult.total,
        page: inventoryResult.page,
        per_page: inventoryResult.per_page,
        hasMore: inventoryResult.hasMore,
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
router.post('/create-order', requireAuth, requireEditor, requireActivePlan, sensitiveOperationsLimiter, async (req, res, next) => {
  const userId = (req as any).userId;
  try {
    // Gate on KYC: check every required KycDocument is status: 'verified' before allowing order creation
    const kycCheck = await checkRequiredKycDocumentsVerified(userId);
    if (!kycCheck.verified) {
      res.status(403).json({
        success: false,
        error: kycCheck.error,
        kycRequired: true,
        missing: kycCheck.missing,
        actionUrl: '/settings',
      });
      return;
    }

    const { baseCost = 0, setupFee = 0, currency = 'INR' } = req.body;

    logger.info('[NUMBERS_CREATE_ORDER] Creating Razorpay order', { userId, baseCost, setupFee, currency });

    const billingService = new BillingService();
    const order = await billingService.createNumberPurchaseOrder(userId, baseCost, setupFee, currency);

    res.json({ success: true, data: order });
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    logger.error('[NUMBERS_CREATE_ORDER_ERROR] Failed to create Razorpay order', {
      userId,
      error: errorMsg,
      stack: err?.stack,
    });
    
    res.status(500).json({
      success: false,
      error: errorMsg || 'Payment initialization failed. Please check Razorpay keys or configuration.',
    });
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
router.post('/purchase', requireAuth, requireEditor, requireActivePlan, sensitiveOperationsLimiter, async (req, res, next) => {
  const userId = (req as any).userId;
  const { vobizNumberId, expectedPrice, orderId, paymentId, signature, agentId } = req.body;

  // Server-side number lock guard enforcement
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(401).json({ success: false, error: 'User not found' });
    return;
  }
  if (user.numberLocked) {
    res.status(403).json({
      success: false,
      error: 'Phone number selection is locked for your account. You have already claimed your 1 free bundled phone number.',
      numberLocked: true,
    });
    return;
  }

  // Gate on KYC: check every required KycDocument is status: 'verified' before charging or locking
  const kycCheck = await checkRequiredKycDocumentsVerified(userId);
  if (!kycCheck.verified) {
    res.status(403).json({
      success: false,
      error: kycCheck.error,
      kycRequired: true,
      missing: kycCheck.missing,
      actionUrl: '/settings',
    });
    return;
  }

  if (!vobizNumberId || expectedPrice === undefined || !orderId || !paymentId || !signature) {
    res.status(400).json({ success: false, error: 'Missing required purchase fields.' });
    return;
  }

  // Idempotency check: Return existing record if this vobiz number was already provisioned for this user
  const existingNumber = await prisma.phoneNumber.findFirst({
    where: { userId, vobizNumberId },
  });
  if (existingNumber) {
    logger.info('[NUMBERS_PURCHASE] Idempotent request — number already provisioned', { userId, vobizNumberId, phoneNumber: existingNumber.phoneNumber });
    res.json({
      success: true,
      data: {
        message: 'Number already purchased and assigned.',
        phoneNumberId: existingNumber.id,
        number: existingNumber.phoneNumber,
        status: existingNumber.aadhaarRequired ? 'KYC Required' : 'Active',
        nextBillingDate: existingNumber.nextBillingDate,
        monthlyCost: existingNumber.monthlyCost,
        currency: existingNumber.currency,
        numberLocked: true,
      }
    });
    return;
  }

  // Step 1: Server-side payment signature verification
  const billingService = new BillingService();
  const isValid = billingService.verifyPayment(orderId, paymentId, signature);
  if (!isValid) {
    res.status(400).json({ success: false, error: 'Payment verification failed. No charge was made.' });
    return;
  }

  // Step 2: Ensure Vobiz sub-account exists BEFORE number purchase (blocks on failure)
  try {
    const { VobizSubAccountService } = require('../services/VobizSubAccountService');
    const subAccountService = new VobizSubAccountService();
    const subAccount = await subAccountService.getOrCreateSubAccount(userId, user.email);
    if (!subAccount || !subAccount.authId) {
      throw new Error('Vobiz sub-account could not be created or retrieved.');
    }
  } catch (subErr: any) {
    logger.error('[SUB_ACCOUNT_PROVISION_BLOCKING_ERROR] Failed to provision sub-account before purchase', {
      userId,
      error: String(subErr?.message || subErr),
    });
    res.status(502).json({
      success: false,
      error: 'Telephony sub-account provisioning failed prior to number purchase. Please contact support.',
    });
    return;
  }

  // Step 3: Attempt Vobiz purchase (idempotency key = orderId, tied to the payment)
  try {
    const phoneService = new VobizPhoneNumberService();
    const result = await phoneService.purchaseAndAssignNumber({
      userId,
      idempotencyKey: orderId,
      vobizNumberId,
      expectedPrice,
      agentId,
    });

    // Step 4: Lock number selection for user permanently
    await prisma.user.update({
      where: { id: userId },
      data: { numberLocked: true },
    });

    await logAuditEvent({
      workspaceOwnerId: (req as any).effectiveWorkspaceId || userId,
      actorUserId: userId,
      action: 'number.purchased',
      targetId: result.phoneNumber.id,
      metadata: { phoneNumber: result.phoneNumber.phoneNumber, vobizNumberId },
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
        numberLocked: true,
      }
    });

  } catch (err: any) {
    const errorMessage = err.message || '';

    // Detect post-payment Vobiz failure — must refund user and fire admin alert
    if (errorMessage.includes('[VOBIZ_PURCHASE_FAILURE]')) {
      logger.error('[ADMIN_ALERT][VOBIZ_LOW_BALANCE] CRITICAL: Post-payment Vobiz purchase failure - Master Vobiz balance insufficient or provider error', {
        userId,
        paymentId,
        orderId,
        vobizNumberId,
        errorMessage,
      });

      // Attempt automatic refund for exact expected total amount
      const amountInPaise = Math.round(expectedPrice * 100);
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
 * POST /api/v2/numbers/claim
 * Claims the 1 free bundled phone number included with the user's plan payment.
 * No second Razorpay charge required — billed against master account balance.
 * Body: { vobizNumberId, agentId? }
 */
router.post('/claim', requireAuth, requireEditor, requireActivePlan, sensitiveOperationsLimiter, async (req, res, next) => {
  const userId = (req as any).userId;
  const { vobizNumberId, agentId } = req.body;

  if (!vobizNumberId) {
    res.status(400).json({ success: false, error: 'vobizNumberId is required.' });
    return;
  }

  // Server-side number lock guard enforcement
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(401).json({ success: false, error: 'User not found' });
    return;
  }

  if (user.numberLocked) {
    res.status(403).json({
      success: false,
      error: 'Phone number selection is locked for your account. You have already claimed your 1 free bundled phone number.',
      numberLocked: true,
    });
    return;
  }

  // Gate on KYC: check every required KycDocument is status: 'verified' before claiming or locking
  const kycCheck = await checkRequiredKycDocumentsVerified(userId);
  if (!kycCheck.verified) {
    res.status(403).json({
      success: false,
      error: kycCheck.error,
      kycRequired: true,
      missing: kycCheck.missing,
      actionUrl: '/settings',
    });
    return;
  }

  const claimIdempotencyKey = `claim_${userId}_${vobizNumberId}`;

  // Idempotency check: Return existing record if already claimed
  const existingNumber = await prisma.phoneNumber.findFirst({
    where: { userId, vobizNumberId },
  });
  if (existingNumber) {
    res.json({
      success: true,
      data: {
        message: 'Number already claimed and assigned.',
        phoneNumberId: existingNumber.id,
        number: existingNumber.phoneNumber,
        status: 'Active',
        numberLocked: true,
      }
    });
    return;
  }

  // Move Vobiz sub-account creation to happen BEFORE number claim (blocks on failure)
  try {
    const { VobizSubAccountService } = require('../services/VobizSubAccountService');
    const subAccountService = new VobizSubAccountService();
    const subAccount = await subAccountService.getOrCreateSubAccount(userId, user.email);
    if (!subAccount || !subAccount.authId) {
      throw new Error('Vobiz sub-account could not be created or retrieved.');
    }
  } catch (subErr: any) {
    logger.error('[SUB_ACCOUNT_PROVISION_BLOCKING_ERROR] Failed to provision sub-account before claim', {
      userId,
      error: String(subErr?.message || subErr),
    });
    res.status(502).json({
      success: false,
      error: 'Telephony sub-account provisioning failed prior to number claim. Please contact support.',
    });
    return;
  }

  try {
    const phoneService = new VobizPhoneNumberService();
    const result = await phoneService.purchaseAndAssignNumber({
      userId,
      idempotencyKey: claimIdempotencyKey,
      vobizNumberId,
      expectedPrice: 0,
      agentId,
    });

    // Flip numberLocked to true server-side
    await prisma.user.update({
      where: { id: userId },
      data: { numberLocked: true },
    });

    await logAuditEvent({
      workspaceOwnerId: (req as any).effectiveWorkspaceId || userId,
      actorUserId: userId,
      action: 'number.claimed',
      targetId: result.phoneNumber.id,
      metadata: { phoneNumber: result.phoneNumber.phoneNumber, vobizNumberId },
    });

    res.json({
      success: true,
      data: {
        message: 'Bundled phone number claimed and assigned successfully.',
        phoneNumberId: result.phoneNumber.id,
        number: result.phoneNumber.phoneNumber,
        status: result.phoneNumber.aadhaarRequired ? 'KYC Required' : 'Active',
        numberLocked: true,
      }
    });
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    logger.error('[NUMBERS_CLAIM_ERROR] Failed to claim bundled number', { userId, vobizNumberId, error: errorMsg });
    res.status(500).json({ success: false, error: 'Failed to claim phone number. Please contact support.' });
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
router.delete('/:id', requireAuth, requireEditor, async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    const id = req.params.id as string;

    if (!id) {
      res.status(400).json({ success: false, error: 'Phone number ID is required' });
      return;
    }

    await UsageSyncService.releaseNumber(id, userId);

    await logAuditEvent({
      workspaceOwnerId: (req as any).effectiveWorkspaceId || userId,
      actorUserId: userId,
      action: 'number.released',
      targetId: id,
    });

    res.json({ success: true, message: 'Number released successfully' });
  } catch (err) {
    logger.error('Numbers: failed to release number', { error: String(err) });
    next(err);
  }
});

/**
 * PATCH /api/v2/numbers/:id/activate
 * Admin-only status toggle flipping status to "active".
 * Scoped by admin role, looking up the number by id only (not owner userId), with audit logging.
 */
router.patch('/:id/activate', requireAuth, async (req, res, next) => {
  try {
    const adminUserId = (req as any).userId;
    const adminUser = await prisma.user.findUnique({ where: { id: adminUserId } });
    if (!adminUser || (adminUser.accountType !== 'admin' && adminUser.email !== ADMIN_EMAIL)) {
      res.status(403).json({ success: false, error: 'Access Denied: Manual activation requires founder admin confirmation.' });
      return;
    }
    const id = req.params.id as string;

    // Admin lookup by number id only (scoped by admin role, not by owner)
    const phone = await prisma.phoneNumber.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!phone) {
      res.status(404).json({ success: false, error: 'Phone number not found' });
      return;
    }

    const updated = await prisma.phoneNumber.update({
      where: { id },
      data: { status: 'active' },
    });

    await logAuditEvent({
      workspaceOwnerId: phone.userId,
      actorUserId: adminUserId,
      action: 'number.activated',
      targetId: id,
      metadata: {
        activatedBy: adminUser.email,
        phoneNumber: phone.phoneNumber,
        ownerEmail: phone.user?.email,
      },
    });

    logger.info('Numbers: number status updated to active by admin', {
      adminUserId,
      adminEmail: adminUser.email,
      phoneId: id,
      ownerUserId: phone.userId,
      phoneNumber: phone.phoneNumber,
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    logger.error('Numbers: failed to activate number', { error: String(err) });
    next(err);
  }
});

/**
 * GET /api/v2/numbers/pending-activations
 * Admin-only list of numbers pending activation across all customers.
 * Returns: number, owner email, KYC state, funded? (walletFundedAt != null)
 */
router.get('/pending-activations', requireAuth, async (req, res, next) => {
  try {
    const adminUserId = (req as any).userId;
    const adminUser = await prisma.user.findUnique({ where: { id: adminUserId } });
    if (!adminUser || (adminUser.accountType !== 'admin' && adminUser.email !== ADMIN_EMAIL)) {
      res.status(403).json({ success: false, error: 'Access Denied: Founder admin privilege required.' });
      return;
    }

    const pendingNumbers = await prisma.phoneNumber.findMany({
      where: {
        status: { not: 'active' },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            vobizSubAccount: {
              select: {
                authId: true,
                kycStatus: true,
                walletFundedAt: true,
              }
            }
          }
        }
      },
      orderBy: { purchasedAt: 'desc' }
    });

    const formatted = pendingNumbers.map(n => ({
      id: n.id,
      number: n.phoneNumber,
      ownerId: n.userId,
      ownerEmail: n.user?.email || 'unknown',
      ownerName: n.user?.fullName || '',
      kycState: n.kycStatus,
      aadhaarRequired: n.aadhaarRequired,
      funded: !!n.user?.vobizSubAccount?.walletFundedAt,
      walletFundedAt: n.user?.vobizSubAccount?.walletFundedAt || null,
      status: n.status,
      purchasedAt: n.purchasedAt,
    }));

    res.json({ success: true, data: formatted });
  } catch (err) {
    logger.error('Numbers: failed to fetch pending activations', { error: String(err) });
    next(err);
  }
});

/**
 * POST /api/v2/numbers/:id/mark-funded-and-activate
 * Founder daily tool action:
 * 1. Sets walletFundedAt on the owner's Vobiz sub-account.
 * 2. Evaluates the activation rule:
 *    A number becomes active automatically when (KYC verified OR number does not require KYC) AND walletFundedAt is set.
 * 3. Audit-logs who marked it and what was activated.
 */
router.post('/:id/mark-funded-and-activate', requireAuth, async (req, res, next) => {
  try {
    const adminUserId = (req as any).userId;
    const adminUser = await prisma.user.findUnique({ where: { id: adminUserId } });
    if (!adminUser || (adminUser.accountType !== 'admin' && adminUser.email !== ADMIN_EMAIL)) {
      res.status(403).json({ success: false, error: 'Access Denied: Founder admin privilege required.' });
      return;
    }

    const id = req.params.id as string;
    const phone = await prisma.phoneNumber.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!phone) {
      res.status(404).json({ success: false, error: 'Phone number not found' });
      return;
    }

    const now = new Date();

    // 1. Mark wallet funded on the user's VobizSubAccount
    await prisma.vobizSubAccount.upsert({
      where: { userId: phone.userId },
      update: { walletFundedAt: now },
      create: {
        userId: phone.userId,
        authId: `SA_MANUAL_${phone.userId.slice(0, 8)}`,
        authToken: 'wallet_funded_manual',
        walletFundedAt: now,
      }
    });

    await logAuditEvent({
      workspaceOwnerId: phone.userId,
      actorUserId: adminUserId,
      action: 'wallet.marked_funded',
      targetId: phone.id,
      metadata: {
        markedBy: adminUser.email,
        phoneNumber: phone.phoneNumber,
        ownerEmail: phone.user?.email,
      }
    });

    // 2. Evaluate activation rule:
    // A number becomes active automatically when (KYC verified OR number does not require KYC) AND walletFundedAt is set.
    const { PhoneNumberActivationService } = await import('../services/PhoneNumberActivationService');
    const activatedNumbers = await PhoneNumberActivationService.evaluateAndActivateUserNumbers(
      phone.userId,
      'admin_wallet_funding',
      adminUserId
    );

    const refreshedPhone = await prisma.phoneNumber.findUnique({ where: { id } });

    res.json({
      success: true,
      data: {
        phoneNumber: refreshedPhone,
        activated: refreshedPhone?.status === 'active',
        activatedNumbers,
        message: refreshedPhone?.status === 'active'
          ? 'Wallet marked funded and phone number activated successfully.'
          : 'Wallet marked funded. Number is awaiting KYC verification before it auto-activates.',
      }
    });
  } catch (err) {
    logger.error('Numbers: failed to mark funded and activate', { error: String(err) });
    next(err);
  }
});

/**
 * GET /api/v2/numbers/calling-config
 * Returns inbound and outbound calling configuration for all numbers owned by user.
 */
router.get('/calling-config', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    // Live sync KYC status with Vobiz
    const { VobizSubAccountService } = require('../services/VobizSubAccountService');
    const subService = new VobizSubAccountService();
    await subService.syncKycStatus(userId).catch(() => {});

    const numbers = await prisma.phoneNumber.findMany({
      where: { userId },
      include: {
        agent: true,
        inboundConfigs: {
          include: { agent: true }
        }
      },
      orderBy: { purchasedAt: 'desc' }
    });

    const formatted = numbers.map(n => {
      const inboundCfg = n.inboundConfigs[0];
      const inboundAgentId = inboundCfg?.agentId || n.assignedAgentId || null;
      const inboundAgentName = inboundCfg?.agent?.name || n.agent?.name || 'Unassigned';

      return {
        id: n.id,
        phoneNumber: n.phoneNumber,
        status: n.status,
        kycStatus: n.kycStatus,
        assignedAgentId: n.assignedAgentId,
        outboundAgentName: n.agent?.name || 'Unassigned',
        inboundEnabled: n.status === 'active',
        inboundAgentId,
        inboundAgentName,
        businessHours: inboundCfg?.businessHours || '{}',
        outsideHoursAction: inboundCfg?.outsideHoursAction || 'agent',
      };
    });

    res.json({ success: true, data: formatted });
  } catch (err) {
    logger.error('Numbers: failed to fetch calling config', { error: String(err) });
    next(err);
  }
});

/**
 * POST /api/v2/numbers/:id/calling-config
 * Updates inbound and outbound calling configuration for a specific number.
 * Body: { assignedAgentId?, inboundAgentId?, inboundEnabled?, businessHours? }
 */
router.post('/:id/calling-config', requireAuth, requireEditor, async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    const id = req.params.id as string;
    const { assignedAgentId, inboundAgentId, inboundEnabled, businessHours } = req.body;

    const { InboundCallService } = require('../services/InboundCallService');
    const updatedNumber = await InboundCallService.updateCallingConfig({
      userId,
      phoneNumberId: id,
      assignedAgentId,
      inboundAgentId,
      inboundEnabled,
      businessHours,
    });

    await logAuditEvent({
      workspaceOwnerId: (req as any).effectiveWorkspaceId || userId,
      actorUserId: userId,
      action: 'number.assigned',
      targetId: id,
      metadata: { assignedAgentId, inboundAgentId, inboundEnabled },
    });

    res.json({
      success: true,
      message: 'Calling configuration updated successfully.',
      data: updatedNumber
    });
  } catch (err: any) {
    logger.error('Numbers: failed to update calling config', { error: String(err) });
    res.status(400).json({ success: false, error: err.message || 'Failed to update calling configuration' });
  }
});

export default router;
