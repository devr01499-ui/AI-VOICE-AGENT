import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { VobizSubAccountService } from '../services/VobizSubAccountService';
import { verifyVobizWebhook } from '../middleware/vobizWebhook';
import { Resend } from 'resend';

const router = Router();

/**
 * Dispatches an email notification via Resend when KYC verification status changes.
 */
async function notifyUserKycStatus(userId: string, status: string, reason?: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true }
    });

    if (!user || !user.email) return;

    logger.info('KYC Notification: Sending status email to user', { userId, email: user.email, status });

    const isVerified = status === 'verified';

    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: 'Claritiy Voice <onboarding@resend.dev>',
        to: user.email,
        subject: `Claritiy Voice — KYC Verification ${isVerified ? 'Approved! 🎉' : 'Action Required'}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #0F172A;">
            <h2 style="color: ${isVerified ? '#059669' : '#DC2626'};">
              Claritiy Voice — KYC Verification ${isVerified ? 'Verified' : 'Failed'}
            </h2>
            <p>Hello ${user.fullName || 'User'},</p>
            <p>${isVerified
              ? 'Your account-level KYC verification with Vobiz has been successfully approved! You can now self-serve claim any phone numbers requiring verification directly in your dashboard.'
              : `Your account-level KYC verification could not be completed. ${reason ? 'Reason: ' + reason : 'Please retry document verification in your calling configuration.'}`
            }</p>
            <p style="margin-top: 24px; font-size: 12px; color: #64748B;">
              This is an automated notification from Claritiy Voice Enterprise Voice AI.
            </p>
          </div>
        `
      });
    } else {
      logger.info('[MOCK EMAIL NOTIFICATION] KYC status email sent to user', { email: user.email, status });
    }
  } catch (err) {
    logger.error('KYC Notification: Failed to send status notification email', { userId, error: String(err) });
  }
}

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
 * Updates phoneNumber.kycStatus & VobizSubAccount.kycStatus in DB, and notifies user via email.
 */
router.post('/webhook/vobiz', verifyVobizWebhook, async (req, res, next) => {
  try {
    const { sub_account_auth_id, phoneNumber, status, reason } = req.body;
    
    logger.info('KYC Webhook: Received update from Vobiz', { sub_account_auth_id, phoneNumber, status, reason });

    const normalizedStatus = (status || '').toLowerCase() === 'verified' ? 'verified' : 'failed';
    let targetUserId: string | null = null;

    if (sub_account_auth_id) {
      const subAccount = await prisma.vobizSubAccount.findFirst({
        where: { authId: sub_account_auth_id }
      });
      if (subAccount) {
        targetUserId = subAccount.userId;
        await prisma.vobizSubAccount.update({
          where: { id: subAccount.id },
          data: {
            kycStatus: normalizedStatus,
            kycVerifiedAt: normalizedStatus === 'verified' ? new Date() : null,
          }
        });
        await prisma.phoneNumber.updateMany({
          where: { userId: subAccount.userId },
          data: { kycStatus: normalizedStatus }
        });
        logger.info('KYC Webhook: Updated account and phone numbers for user via sub-account', { userId: subAccount.userId, status: normalizedStatus });
      }
    } else if (phoneNumber) {
      const phoneRec = await prisma.phoneNumber.findUnique({ where: { phoneNumber } });
      if (phoneRec) {
        targetUserId = phoneRec.userId;
        await prisma.phoneNumber.update({
          where: { id: phoneRec.id },
          data: { kycStatus: normalizedStatus }
        });
        await prisma.vobizSubAccount.updateMany({
          where: { userId: phoneRec.userId },
          data: {
            kycStatus: normalizedStatus,
            kycVerifiedAt: normalizedStatus === 'verified' ? new Date() : null,
          }
        });
        logger.info('KYC Webhook: Updated phone number & account status', { phoneNumber, status: normalizedStatus });
      }
    }

    if (targetUserId) {
      await notifyUserKycStatus(targetUserId, normalizedStatus, reason);
    }

    res.json({ success: true, message: 'KYC status processed successfully' });
  } catch (err) {
    logger.error('KYC Webhook: Error processing webhook', { error: String(err) });
    next(err);
  }
});

export default router;
