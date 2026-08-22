import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { VobizSubAccountService } from '../services/VobizSubAccountService';
import { verifyVobizWebhook } from '../middleware/vobizWebhook';

const router = Router();

/**
 * POST /api/v2/kyc/initiate-session
 * 
 * Initiates Vobiz's Hosted KYC Session for the user's sub-account.
 * Strictly ZERO raw document upload/storage on our servers (Aadhaar Act compliant).
 */
router.post('/initiate-session', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const subAccountService = new VobizSubAccountService();
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    const subAccount = await subAccountService.getOrCreateSubAccount(userId, user?.email || undefined);

    // Build Vobiz Hosted KYC Redirect URL for sub-account
    const hostedKycUrl = `https://console.vobiz.ai/kyc?sub_account_auth_id=${subAccount.authId}`;

    logger.info('KYC: Initiated Vobiz Hosted KYC Session', { userId, subAuthId: subAccount.authId });

    res.json({
      success: true,
      data: {
        redirectUrl: hostedKycUrl,
        subAccountAuthId: subAccount.authId,
        confirmationMessage: "Your KYC verification is being processed and typically takes up to 24 hours. We'll notify you once it's complete.",
        status: "pending"
      }
    });
  } catch (err) {
    logger.error('KYC: failed to initiate hosted session', { error: String(err) });
    next(err);
  }
});

/**
 * GET /api/v2/kyc/status
 * 
 * Performs a live query to Vobiz API to fetch and sync current KYC status.
 */
router.get('/status', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const subAccountService = new VobizSubAccountService();
    const syncResult = await subAccountService.syncKycStatus(userId);

    const numbers = await prisma.phoneNumber.findMany({
      where: { userId },
      select: { id: true, phoneNumber: true, kycStatus: true, status: true }
    });

    res.json({
      success: true,
      data: {
        kycStatus: syncResult.kycStatus, // "verified" | "pending" | "failed"
        isVerified: syncResult.isVerified,
        confirmationMessage: syncResult.isVerified
          ? "Your KYC verification is active and verified with Vobiz."
          : "Your KYC verification is being processed and typically takes up to 24 hours. We'll notify you once it's complete.",
        numbers
      }
    });
  } catch (err) {
    logger.error('KYC: failed to fetch live status', { error: String(err) });
    next(err);
  }
});

/**
 * POST /api/v2/webhooks/vobiz/kyc
 * 
 * Webhook endpoint registered with Vobiz to receive asynchronous KYC status updates.
 * Updates phoneNumber.kycStatus in DB and unlocks calling permissions when verified.
 */
router.post('/webhook/vobiz', verifyVobizWebhook, async (req, res, next) => {
  try {
    const { sub_account_auth_id, phoneNumber, status, reason } = req.body;
    
    logger.info('KYC Webhook: Received update from Vobiz', { sub_account_auth_id, phoneNumber, status, reason });

    const normalizedStatus = (status || '').toLowerCase() === 'verified' ? 'verified' : 'failed';

    if (sub_account_auth_id) {
      const subAccount = await prisma.vobizSubAccount.findFirst({
        where: { authId: sub_account_auth_id }
      });
      if (subAccount) {
        await prisma.phoneNumber.updateMany({
          where: { userId: subAccount.userId },
          data: { kycStatus: normalizedStatus }
        });
        logger.info('KYC Webhook: Updated phone numbers for user via sub-account', { userId: subAccount.userId, status: normalizedStatus });
      }
    } else if (phoneNumber) {
      const phoneRec = await prisma.phoneNumber.findUnique({ where: { phoneNumber } });
      if (phoneRec) {
        await prisma.phoneNumber.update({
          where: { id: phoneRec.id },
          data: { kycStatus: normalizedStatus }
        });
        logger.info('KYC Webhook: Updated phone number status', { phoneNumber, status: normalizedStatus });
      }
    }

    res.json({ success: true, message: 'KYC status processed successfully' });
  } catch (err) {
    logger.error('KYC Webhook: Error processing webhook', { error: String(err) });
    next(err);
  }
});

export default router;
