import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { VobizSubAccountService } from '../services/VobizSubAccountService';
import { BillingService } from '../services/BillingService';
import { UsageSyncService } from '../services/UsageSyncService';
import { VobizInventoryService } from '../services/VobizInventoryService';
import { VobizPhoneNumberService } from '../services/VobizPhoneNumberService';

const router = Router();

/**
 * GET /api/v2/numbers
 * 
 * Returns all active phone numbers provisioned to the current authenticated user's workspace.
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    logger.info('Numbers: fetching provisioned numbers', { userId });

    const numbers = await prisma.phoneNumber.findMany({
      where: { userId: userId },
      select: {
        id: true,
        phoneNumber: true,
        assignedAgentId: true,
        type: true,
        status: true,
      }
    });

    res.json({
      success: true,
      data: numbers,
    });
  } catch (err) {
    logger.error('Numbers: failed to fetch numbers', { error: String(err) });
    next(err);
  }
});

/**
 * GET /api/v2/numbers/search
 * 
 * Searches for available numbers using the Vobiz Inventory API.
 */
router.get('/search', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { country = 'US', type = 'local', region } = req.query;

    logger.info('Numbers: searching for available numbers', { userId, country, type });

    const inventoryService = new VobizInventoryService();
    const numbers = await inventoryService.getAvailableNumbers(userId, { 
      country: country as string, 
      type: type as string, 
      region: region as string 
    });

    res.json({
      success: true,
      data: {
        message: 'Search completed',
        results: numbers
      },
    });
  } catch (err) {
    logger.error('Numbers: failed to search numbers', { error: String(err) });
    next(err);
  }
});

/**
 * POST /api/v2/numbers/create-order
 * Creates a Razorpay order for purchasing a number
 */
router.post('/create-order', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    const { baseCost = 1.5 } = req.body;

    const billingService = new BillingService();
    const order = await billingService.createNumberPurchaseOrder(userId, baseCost);

    res.json({ success: true, data: order });
  } catch (err) {
    logger.error('Numbers: failed to create order', { error: String(err) });
    next(err);
  }
});

/**
 * POST /api/v2/numbers/purchase
 * Verifies payment and securely provisions the number via Vobiz Integration.
 */
router.post('/purchase', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    const { vobizNumberId, expectedPrice, orderId, paymentId, signature } = req.body;

    if (!vobizNumberId || expectedPrice === undefined || !orderId || !paymentId) {
      res.status(400).json({ success: false, error: 'Missing required purchase fields' });
      return;
    }

    const billingService = new BillingService();
    const isValid = billingService.verifyPayment(orderId, paymentId, signature);

    if (!isValid) {
      res.status(400).json({ success: false, error: 'Invalid payment signature' });
      return;
    }

    // We use the Razorpay orderId as the unique idempotency key
    const phoneService = new VobizPhoneNumberService();
    
    // This handles validation, sub-account creation, master purchase, and assignment.
    const result = await phoneService.purchaseAndAssignNumber({
      userId,
      idempotencyKey: orderId, // strict idempotency based on payment order
      vobizNumberId,
      expectedPrice,
    });

    res.json({
      success: true,
      data: {
        message: 'Number purchased and assigned successfully.',
        phoneNumberId: result.phoneNumber.id,
        number: result.phoneNumber.phoneNumber,
        status: result.phoneNumber.kycStatus === 'pending' ? 'KYC Required' : 'Active'
      }
    });
  } catch (err: any) {
    logger.error('Numbers: failed to complete purchase', { error: String(err) });
    res.status(500).json({ success: false, error: err.message || 'Purchase processing failed' });
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
