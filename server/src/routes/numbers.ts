import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { VobizSubAccountService } from '../services/VobizSubAccountService';
import { BillingService } from '../services/BillingService';
import { UsageSyncService } from '../services/UsageSyncService';

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
 * Searches for available numbers and ensures the user has a Vobiz Sub-Account provisioned.
 */
router.get('/search', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { country = 'IN', type = 'local' } = req.query;

    logger.info('Numbers: searching for available numbers', { userId, country, type });

    const subAccountService = new VobizSubAccountService();
    // Phase 1: Create a sub-account the first time a user initiates a number purchase (search)
    const subAccount = await subAccountService.getOrCreateSubAccount(userId);

    // TODO: Phase 4 will implement actual Vobiz inventory search using subAccount credentials.
    res.json({
      success: true,
      data: {
        message: 'Search initiated',
        subAccountCreated: true,
        // We omit returning the sensitive auth token
        authId: subAccount.authId,
        mockResults: [
          { phoneNumber: '+919876543210', region: 'IN', monthlyCost: 1.5 }
        ]
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
 * Verifies payment and provisions the number in our database (inactive until KYC clears)
 */
router.post('/purchase', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    const { phoneNumber, countryCode, orderId, paymentId, signature } = req.body;

    if (!phoneNumber || !countryCode || !orderId || !paymentId) {
      res.status(400).json({ success: false, error: 'Missing required purchase fields' });
      return;
    }

    const billingService = new BillingService();
    const isValid = billingService.verifyPayment(orderId, paymentId, signature);

    if (!isValid) {
      res.status(400).json({ success: false, error: 'Invalid payment signature' });
      return;
    }

    // Record the number in DB as inactive and pending KYC
    const newNumber = await prisma.phoneNumber.create({
      data: {
        userId,
        phoneNumber,
        countryCode,
        type: 'local',
        telephonyProvider: 'vobiz',
        status: 'inactive', // inactive until KYC clears
        kycStatus: 'pending',
        monthlyCost: 3.5, // 1.5 base + 2 margin
      }
    });

    res.json({
      success: true,
      data: {
        message: 'Number purchased successfully. Please complete KYC to activate.',
        phoneNumberId: newNumber.id,
      }
    });
  } catch (err) {
    logger.error('Numbers: failed to complete purchase', { error: String(err) });
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
    const { id } = req.params;

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
