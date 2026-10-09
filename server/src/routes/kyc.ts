import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { VobizSubAccountService } from '../services/VobizSubAccountService';
import { verifyVobizWebhook } from '../middleware/vobizWebhook';
import { Resend } from 'resend';
import { logAuditEvent } from '../utils/auditLogger';
import { sensitiveOperationsLimiter } from '../middleware/rateLimiter';
import { PhoneNumberActivationService } from '../services/PhoneNumberActivationService';

const router = Router();

import { NotificationService } from '../services/NotificationService';

/**
 * Dispatches both an in-app notification and an email notification via Resend when KYC verification status changes.
 */
export async function notifyUserKycStatus(userId: string, status: string, reason?: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true }
    });

    if (!user) return;

    const isVerified = status === 'verified';

    // 1. In-App Notification (Guaranteed delivery even if external email provider fails)
    const inAppMessage = isVerified
      ? '🎉 KYC Verification Approved: Your account verification with Vobiz is complete! You can now activate and use your phone numbers.'
      : `⚠️ KYC Verification Action Required: Your verification could not be completed${reason ? ` (${reason})` : ''}. Please retry verification in your dashboard.`;

    NotificationService.createInAppNotification({
      userId,
      message: inAppMessage,
      isImportant: true,
    });

    if (!user.email) return;

    logger.info('KYC Notification: Sending status email to user', { userId, email: user.email, status });

    const fromAddress = process.env.RESEND_FROM_EMAIL || 'Claritiy Voice <notifications@claritiyvoice.com>';

    // 2. Email Delivery via Resend
    if (!process.env.RESEND_API_KEY) {
      if (process.env.NODE_ENV === 'production') {
        const errorMsg = 'CRITICAL CONFIG ERROR: RESEND_API_KEY is not configured in production! Customer KYC notification email could not be delivered.';
        logger.error(errorMsg, { userId, email: user.email, status });
        throw new Error(errorMsg);
      }
      logger.info('[MOCK EMAIL NOTIFICATION] KYC status email sent to user', { email: user.email, status, from: fromAddress });
      return;
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const emailResult = await resend.emails.send({
      from: fromAddress,
      to: user.email,
      subject: `Claritiy Voice — KYC Verification ${isVerified ? 'Approved! 🎉' : 'Action Required'}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #0F172A;">
          <h2 style="color: ${isVerified ? '#059669' : '#DC2626'};">
            Claritiy Voice — KYC Verification ${isVerified ? 'Verified' : 'Failed'}
          </h2>
          <p>Hello ${user.fullName || 'User'},</p>
          <p>${isVerified
            ? 'Your account-level KYC verification with Vobiz has been successfully approved! You can now activate and use phone numbers directly in your dashboard.'
            : `Your account-level KYC verification could not be completed. ${reason ? 'Reason: ' + reason : 'Please retry document verification in your calling configuration.'}`
          }</p>
          <p style="margin-top: 24px; font-size: 12px; color: #64748B;">
            This is an automated notification from Claritiy Voice Enterprise Voice AI.
          </p>
        </div>
      `
    });

    if (emailResult.error) {
      logger.error('KYC Notification: Resend returned error delivering email', {
        userId,
        error: emailResult.error
      });
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`Resend delivery failed: ${emailResult.error.message || JSON.stringify(emailResult.error)}`);
      }
    } else {
      logger.info('KYC Notification: Status email dispatched via Resend', {
        userId,
        email: user.email,
        emailId: emailResult.data?.id
      });
    }
  } catch (err) {
    logger.error('KYC Notification: Error dispatching status notifications', { userId, error: String(err) });
    if (process.env.NODE_ENV === 'production') {
      throw err;
    }
  }
}

/**
 * POST /api/v2/kyc/initiate-session
 * 
 * Initiates Vobiz's Hosted KYC Session for the user's sub-account.
 * Strictly ZERO raw document upload/storage on our servers (Aadhaar Act compliant).
 */
router.post(['/initiate-session', '/start'], requireAuth, sensitiveOperationsLimiter, async (req, res, next) => {
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

    await logAuditEvent({
      workspaceOwnerId: (req as any).effectiveWorkspaceId || userId,
      actorUserId: userId,
      action: 'kyc.initiated',
      targetId: subAccount.authId,
      metadata: { status: 'pending' },
    });

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
 * Returns current KYC status from database.
 * Only triggers live sync to Vobiz API if last sync is older than 3 minutes and status is not yet verified.
 */
router.get('/status', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const subAccount = await prisma.vobizSubAccount.findUnique({
      where: { userId }
    });

    const SYNC_TTL_MS = 3 * 60 * 1000; // 3 minutes
    const isStale = !subAccount || !subAccount.updatedAt || (Date.now() - subAccount.updatedAt.getTime() > SYNC_TTL_MS);

    let kycStatus = subAccount?.kycStatus || 'pending';
    let isVerified = kycStatus === 'verified';

    // Only live-sync if cache is stale and account is not already verified
    if (isStale && !isVerified) {
      try {
        const subAccountService = new VobizSubAccountService();
        const syncResult = await subAccountService.syncKycStatus(userId);
        kycStatus = syncResult.kycStatus;
        isVerified = syncResult.isVerified;
      } catch (syncErr) {
        logger.warn('KYC: non-blocking sync error, returning cached DB state', { userId, error: String(syncErr) });
      }
    }

    const numbers = await prisma.phoneNumber.findMany({
      where: { userId },
      select: { id: true, phoneNumber: true, kycStatus: true, status: true }
    });

    res.json({
      success: true,
      data: {
        kycStatus, // "verified" | "pending" | "failed"
        isVerified,
        confirmationMessage: isVerified
          ? "Your KYC verification is active and verified with Vobiz."
          : "Your KYC verification is being processed and typically takes up to 24 hours. We'll notify you once it's complete.",
        numbers
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
 * Webhook endpoint registered with Vobiz to receive asynchronous KYC status updates.
 * Updates phoneNumber.kycStatus & VobizSubAccount.kycStatus in DB, and notifies user via email.
 */
router.post('/webhook/vobiz', verifyVobizWebhook, async (req, res, next) => {
  try {
    const { sub_account_auth_id, phoneNumber, status, reason } = req.body;
    
    logger.info('KYC Webhook: Received update from Vobiz', { sub_account_auth_id, phoneNumber, status, reason });

    const rawStatus = (status || '').toLowerCase().trim();
    let normalizedStatus: 'verified' | 'failed' | 'pending';
    if (rawStatus === 'verified' || rawStatus === 'approved') {
      normalizedStatus = 'verified';
    } else if (rawStatus === 'failed' || rawStatus === 'rejected') {
      normalizedStatus = 'failed';
    } else {
      normalizedStatus = 'pending';
    }

    let targetUserId: string | null = null;

    if (sub_account_auth_id) {
      const subAccount = await prisma.vobizSubAccount.findFirst({
        where: { authId: sub_account_auth_id }
      });
      if (subAccount) {
        targetUserId = subAccount.userId;

        // Prevent downgrade of an already-verified account
        if (subAccount.kycStatus === 'verified' && normalizedStatus !== 'verified') {
          logger.info('KYC Webhook: Ignoring non-verified update for already-verified sub-account to prevent downgrade', {
            subAccountId: subAccount.id,
            currentKycStatus: subAccount.kycStatus,
            incomingStatus: normalizedStatus,
          });
        } else {
          await prisma.vobizSubAccount.update({
            where: { id: subAccount.id },
            data: {
              kycStatus: normalizedStatus,
              kycVerifiedAt: normalizedStatus === 'verified' ? new Date() : (normalizedStatus === 'failed' ? null : subAccount.kycVerifiedAt),
            }
          });
          // Update KYC-required phone numbers
          await prisma.phoneNumber.updateMany({
            where: { userId: subAccount.userId, aadhaarRequired: true },
            data: { kycStatus: normalizedStatus }
          });
          logger.info('KYC Webhook: Updated account and phone numbers for user via sub-account', { userId: subAccount.userId, status: normalizedStatus });
        }
      }
    } else if (phoneNumber) {
      const phoneRec = await prisma.phoneNumber.findUnique({ where: { phoneNumber } });
      if (phoneRec) {
        targetUserId = phoneRec.userId;
        const currentSubAccount = await prisma.vobizSubAccount.findUnique({
          where: { userId: phoneRec.userId }
        });

        if (currentSubAccount && currentSubAccount.kycStatus === 'verified' && normalizedStatus !== 'verified') {
          logger.info('KYC Webhook: Ignoring non-verified update for already-verified phone/account to prevent downgrade', {
            phoneId: phoneRec.id,
            currentKycStatus: currentSubAccount.kycStatus,
            incomingStatus: normalizedStatus,
          });
        } else {
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
    }

    if (targetUserId) {
      // Evaluate number auto-activation rule:
      // Number becomes active when (KYC verified OR number does not require KYC) AND walletFundedAt is set
      await PhoneNumberActivationService.evaluateAndActivateUserNumbers(targetUserId, 'kyc_webhook');

      // Send email notifications ONLY on final state transitions (verified or failed), never on pending
      if (normalizedStatus === 'verified' || normalizedStatus === 'failed') {
        await notifyUserKycStatus(targetUserId, normalizedStatus, reason);
      }

      await logAuditEvent({
        workspaceOwnerId: targetUserId,
        actorUserId: targetUserId,
        action: 'kyc.status_changed',
        targetId: sub_account_auth_id || phoneNumber || targetUserId,
        metadata: { status: normalizedStatus, reason },
      });
    }

    res.json({ success: true, message: 'KYC status processed successfully' });
  } catch (err) {
    logger.error('KYC Webhook: Error processing webhook', { error: String(err) });
    next(err);
  }
});

export default router;
