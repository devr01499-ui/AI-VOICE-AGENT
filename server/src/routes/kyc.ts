import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { VobizSubAccountService } from '../services/VobizSubAccountService';
import { ProviderError } from '../types/errors';
import crypto from 'crypto';
import { env } from '../config/env';

const router = Router();

/**
 * POST /api/v2/kyc/submit
 * 
 * Submits KYC documents (PAN, GST, CIN, etc.) to Vobiz API via the user's Sub-Account.
 * Marks the phone number's KYC status as 'pending' for async verification.
 */
router.post('/submit', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { phoneNumberId, documentType, documentData } = req.body;
    
    if (!phoneNumberId || !documentType || !documentData) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    logger.info('KYC: Submitting KYC documents', { userId, phoneNumberId, documentType });

    // Validate phone number belongs to user
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: { id: phoneNumberId, userId },
    });

    if (!phoneNumber) {
      res.status(404).json({ success: false, error: 'Phone number not found' });
      return;
    }

    // Retrieve sub-account to call Vobiz API (Phase 1 integration)
    const subAccountService = new VobizSubAccountService();
    const subAccount = await subAccountService.getOrCreateSubAccount(userId);

    // Call Vobiz KYC API wrapper (Mocking for now as per instructions since we don't have the exact per-document Vobiz endpoint yet)
    // We would pass subAccount.authId and subAccount.authToken to the Vobiz SDK/fetch call
    logger.info('KYC: Mocking call to Vobiz per-document KYC API', { authId: subAccount.authId, documentType });
    
    // Simulate Vobiz accepting the documents for review
    const vobizResponseStatus = 'pending'; 

    // Update phone number status
    await prisma.phoneNumber.update({
      where: { id: phoneNumber.id },
      data: {
        kycStatus: vobizResponseStatus, // "pending"
      }
    });

    res.json({
      success: true,
      data: {
        message: 'KYC documents submitted successfully. Verification pending.',
        status: vobizResponseStatus,
      }
    });
  } catch (err) {
    logger.error('KYC: failed to submit documents', { error: String(err) });
    next(err);
  }
});

/**
 * GET /api/v2/kyc/status/:phoneNumberId
 * 
 * Polls the current KYC status of a phone number from our DB, which is 
 * synced via Vobiz webhooks/polling.
 */
router.get('/status/:phoneNumberId', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    const phoneNumberId = req.params.phoneNumberId as string;

    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: { id: phoneNumberId, userId },
      select: { kycStatus: true, status: true, phoneNumber: true }
    });

    if (!phoneNumber) {
      res.status(404).json({ success: false, error: 'Phone number not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        kycStatus: phoneNumber.kycStatus, // pending, verified, failed
        isActive: phoneNumber.status === 'active' && phoneNumber.kycStatus === 'verified',
      }
    });
  } catch (err) {
    logger.error('KYC: failed to fetch status', { error: String(err) });
    next(err);
  }
});

/**
 * POST /api/v2/kyc/webhook/vobiz
 * 
 * Mock endpoint for Vobiz to push KYC status updates to us.
 * Hard constraint: A number's kyc_calls_blocked status must only ever change because 
 * Vobiz's own system confirmed it.
 */
router.post('/webhook/vobiz', async (req, res, next) => {
  try {
    const sig = req.header('X-Vobiz-Signature');
    const secret = env.VOBIZ_WEBHOOK_SECRET;

    if (secret && sig) {
      const rawBody = (req as any).rawBody;
      if (!rawBody) {
        res.status(400).json({ success: false, error: 'Raw body missing' });
        return;
      }

      const expected = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

      if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) {
        logger.warn('KYC Webhook: Invalid signature', { expected, sig });
        res.status(401).json({ success: false, error: 'Unauthorized: Invalid signature' });
        return;
      }
    } else {
      logger.warn('KYC Webhook: Missing signature or secret', { hasSecret: !!secret, hasSig: !!sig });
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { phoneNumber, status, reason } = req.body;
    
    logger.info('KYC: Webhook received from Vobiz', { phoneNumber, status, reason });

    const phoneRec = await prisma.phoneNumber.findUnique({
      where: { phoneNumber }
    });

    if (phoneRec) {
      await prisma.phoneNumber.update({
        where: { id: phoneRec.id },
        data: {
          kycStatus: status, // verified or failed
        }
      });
      logger.info('KYC: Phone number KYC status updated', { phoneNumber, newStatus: status });
    }

    res.json({ success: true });
  } catch (err) {
    logger.error('KYC: webhook processing error', { error: String(err) });
    next(err);
  }
});

export default router;
