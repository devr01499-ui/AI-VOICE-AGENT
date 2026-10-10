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
import { NotificationService } from '../services/NotificationService';
import { EncryptionService } from '../utils/EncryptionService';
import { uploadGstCertificateToStorage, uploadKycDocumentToStorage } from '../utils/kycStorage';
import { env } from '../config/env';

const router = Router();

// Validation regexes
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i;
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;

/**
 * Dispatches both an in-app notification and an email notification via Resend when individual document status changes.
 */
export async function notifyUserDocumentStatus(
  userId: string,
  documentType: string,
  status: 'verified' | 'failed' | 'pending',
  reason?: string
) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true },
    });

    if (!user) return;

    const docLabels: Record<string, string> = {
      pan: 'PAN Card',
      gst: 'GST Certificate',
      aadhaar: 'Aadhaar Card',
    };
    const docName = docLabels[documentType] || documentType.toUpperCase();
    const isVerified = status === 'verified';

    // 1. In-App Notification
    const inAppMessage = isVerified
      ? `🎉 KYC Approved: Your ${docName} has been successfully verified!`
      : `⚠️ KYC Action Required: Your ${docName} verification could not be completed${reason ? ` (${reason})` : ''}. Please re-submit in Settings.`;

    NotificationService.createInAppNotification({
      userId,
      message: inAppMessage,
      isImportant: true,
    });

    if (!user.email) return;

    logger.info('KYC Document Notification: Sending document status email to user', {
      userId,
      email: user.email,
      documentType,
      status,
    });

    const fromAddress = process.env.RESEND_FROM_EMAIL || 'Claritiy Voice <notifications@claritiyvoice.com>';

    // 2. Email Delivery via Resend
    if (!process.env.RESEND_API_KEY) {
      if (process.env.NODE_ENV === 'production') {
        const errorMsg = 'CRITICAL CONFIG ERROR: RESEND_API_KEY is not configured in production!';
        logger.error(errorMsg, { userId, email: user.email, status, documentType });
        throw new Error(errorMsg);
      }
      logger.info('[MOCK EMAIL NOTIFICATION] KYC document status email sent to user', {
        email: user.email,
        documentType,
        status,
        from: fromAddress,
      });
      return;
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const emailResult = await resend.emails.send({
      from: fromAddress,
      to: user.email,
      subject: `Claritiy Voice — ${docName} Verification ${isVerified ? 'Approved! 🎉' : 'Action Required'}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #0F172A;">
          <h2 style="color: ${isVerified ? '#059669' : '#DC2626'};">
            Claritiy Voice — ${docName} Verification ${isVerified ? 'Approved' : 'Failed'}
          </h2>
          <p>Hello ${user.fullName || 'User'},</p>
          <p>${isVerified
            ? `Your ${docName} document has been successfully verified on Claritiy Voice.`
            : `Your ${docName} document verification could not be completed. ${reason ? 'Reason: ' + reason : 'Please review and re-submit in Settings → KYC & Compliance.'}`
          }</p>
          <p style="margin-top: 24px; font-size: 12px; color: #64748B;">
            This is an automated compliance notification from Claritiy Voice Enterprise Voice AI.
          </p>
        </div>
      `,
    });

    if (emailResult.error) {
      logger.error('KYC Document Notification: Resend returned error delivering email', {
        userId,
        error: emailResult.error,
      });
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`Resend delivery failed: ${emailResult.error.message || JSON.stringify(emailResult.error)}`);
      }
    } else {
      logger.info('KYC Document Notification: Status email dispatched via Resend', {
        userId,
        email: user.email,
        emailId: emailResult.data?.id,
      });
    }
  } catch (err) {
    logger.error('KYC Document Notification: Error dispatching document notification', {
      userId,
      documentType,
      error: String(err),
    });
    if (process.env.NODE_ENV === 'production') {
      throw err;
    }
  }
}

/**
 * Dispatches both an in-app notification and an email notification via Resend when overall KYC verification status changes.
 */
export async function notifyUserKycStatus(userId: string, status: string, reason?: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true }
    });

    if (!user) return;

    const isVerified = status === 'verified';

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
            : `Your account-level KYC verification could not be completed. ${reason ? 'Reason: ' + reason : 'Please retry document verification in Settings.'}`
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
 * Checks whether all required documents for a user are verified.
 * If so, updates sub-account, phone numbers, and triggers auto-activation.
 */
async function checkAndApplyFullKycApproval(userId: string, subAccountId: string) {
  const docs = await prisma.kycDocument.findMany({ where: { userId } });
  const panDoc = docs.find((d) => d.documentType === 'pan');
  const gstDoc = docs.find((d) => d.documentType === 'gst');

  const allRequiredVerified = panDoc?.status === 'verified' && gstDoc?.status === 'verified';

  if (allRequiredVerified) {
    logger.info('KYC: All required documents verified for user. Elevating account status to verified', { userId });
    await prisma.vobizSubAccount.update({
      where: { id: subAccountId },
      data: {
        kycStatus: 'verified',
        kycVerifiedAt: new Date(),
      },
    });

    await prisma.phoneNumber.updateMany({
      where: { userId, aadhaarRequired: true },
      data: { kycStatus: 'verified' },
    });

    await PhoneNumberActivationService.evaluateAndActivateUserNumbers(userId, 'kyc_document_verified');
    await notifyUserKycStatus(userId, 'verified');

    await logAuditEvent({
      workspaceOwnerId: userId,
      actorUserId: userId,
      action: 'kyc.status_changed',
      targetId: subAccountId,
      metadata: { status: 'verified', source: 'on_platform_document_verification' },
    });
  }
}

/**
 * GET /api/v2/kyc/documents
 * Returns every required document for the user's business type and its current status,
 * for the Settings page to render directly.
 */
router.get('/documents', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).effectiveWorkspaceId || (req as any).userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const docs = await prisma.kycDocument.findMany({
      where: { userId },
    });

    const subAccount = await prisma.vobizSubAccount.findUnique({
      where: { userId },
    });

    const panDoc = docs.find((d) => d.documentType === 'pan');
    const gstDoc = docs.find((d) => d.documentType === 'gst');
    const aadhaarDoc = docs.find((d) => d.documentType === 'aadhaar');

    const businessType = 'business'; // Defaults to business (requiring PAN + GST)

    const isFullyVerified = panDoc?.status === 'verified' && gstDoc?.status === 'verified';
    let overallStatus: 'verified' | 'pending' | 'failed' | 'not_submitted' = 'not_submitted';

    if (isFullyVerified || subAccount?.kycStatus === 'verified') {
      overallStatus = 'verified';
    } else if (panDoc?.status === 'failed' || gstDoc?.status === 'failed' || aadhaarDoc?.status === 'failed') {
      overallStatus = 'failed';
    } else if (panDoc?.status === 'pending' || gstDoc?.status === 'pending') {
      overallStatus = 'pending';
    }

    const documentList = [
      {
        documentType: 'pan',
        label: 'Permanent Account Number (PAN)',
        description: 'Authorized signatory PAN for tax & identity verification',
        required: true,
        status: panDoc?.status || 'not_submitted',
        panNumber: panDoc?.panNumber || null,
        panType: panDoc?.panType || 'personal',
        fullName: panDoc?.fullName || null,
        failureReason: panDoc?.failureReason || null,
        verifiedAt: panDoc?.verifiedAt || null,
        updatedAt: panDoc?.updatedAt || null,
      },
      {
        documentType: 'gst',
        label: 'GST Certificate (GSTIN)',
        description: 'GST registration certificate PDF/image for commercial telephony',
        required: true,
        status: gstDoc?.status || 'not_submitted',
        gstin: gstDoc?.gstin || null,
        gstCertUrl: gstDoc?.gstCertUrl || null,
        failureReason: gstDoc?.failureReason || null,
        verifiedAt: gstDoc?.verifiedAt || null,
        updatedAt: gstDoc?.updatedAt || null,
      },
      {
        documentType: 'aadhaar',
        label: 'Aadhaar Card Verification',
        description: 'Authorized signatory Aadhaar card document verification',
        required: false,
        status: aadhaarDoc?.status || 'not_submitted',
        aadhaarNumber: aadhaarDoc?.aadhaarNumber || null,
        aadhaarDocUrl: aadhaarDoc?.aadhaarDocUrl || null,
        vobizReference: aadhaarDoc?.vobizReference || null,
        failureReason: aadhaarDoc?.failureReason || null,
        verifiedAt: aadhaarDoc?.verifiedAt || null,
        updatedAt: aadhaarDoc?.updatedAt || null,
      },
    ];

    res.json({
      success: true,
      data: {
        businessType,
        overallStatus,
        isFullyVerified,
        subAccountAuthId: subAccount?.authId || null,
        documents: documentList,
      },
    });
  } catch (err) {
    logger.error('KYC: failed to get documents', { error: String(err) });
    next(err);
  }
});

/**
 * POST /api/v2/kyc/verify-document
 * Body: { documentType: 'pan' | 'gst', panNumber?, fullName?, dob?, gstin?, gstCertFile?, gstCertName? }
 * Calls Vobiz's per-document verification API server-to-server using the sub-account's own SA_ credentials.
 * NEVER uses the master MA_ credentials.
 * Fails closed on any provider error. Idempotent on (userId, documentType).
 */
router.post('/verify-document', requireAuth, sensitiveOperationsLimiter, async (req, res, next) => {
  try {
    const userId = (req as any).effectiveWorkspaceId || (req as any).userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const {
      documentType,
      panNumber,
      panType,
      fullName,
      dob,
      gstin,
      gstCertFile,
      gstCertName,
      aadhaarNumber,
      aadhaarFile,
      aadhaarFileName,
    } = req.body;

    if (!documentType || (documentType !== 'pan' && documentType !== 'gst' && documentType !== 'aadhaar')) {
      res.status(400).json({ success: false, error: 'Invalid documentType. Must be "pan", "gst", or "aadhaar".' });
      return;
    }

    // 1. Validate inputs per document type
    if (documentType === 'pan') {
      if (!panNumber || !PAN_REGEX.test(panNumber.trim())) {
        res.status(400).json({
          success: false,
          error: 'Invalid PAN number format. Must be 10 alphanumeric characters (e.g., ABCDE1234F).',
        });
        return;
      }
      if (!fullName || fullName.trim().length < 2) {
        res.status(400).json({ success: false, error: 'Full name / Entity name is required as per PAN card.' });
        return;
      }
    }

    let resolvedGstCertUrl: string | undefined;

    if (documentType === 'gst') {
      if (!gstin || !GSTIN_REGEX.test(gstin.trim())) {
        res.status(400).json({
          success: false,
          error: 'Invalid GSTIN format. Must be a 15-character valid GST number.',
        });
        return;
      }
      if (!gstCertFile) {
        // Check if an existing certificate was already uploaded
        const existingDoc = await prisma.kycDocument.findUnique({
          where: { userId_documentType: { userId, documentType: 'gst' } },
        });
        if (!existingDoc?.gstCertUrl) {
          res.status(400).json({
            success: false,
            error: 'GST certificate document file is required. Please upload your GST certificate PDF or image.',
          });
          return;
        }
        resolvedGstCertUrl = existingDoc.gstCertUrl;
      } else {
        // Upload GST certificate to Supabase Storage (never local disk)
        resolvedGstCertUrl = await uploadGstCertificateToStorage(userId, gstCertFile, gstCertName);
      }
    }

    let resolvedAadhaarUrl: string | undefined;

    if (documentType === 'aadhaar') {
      const cleanAadhaarRaw = (aadhaarNumber || '').replace(/\s+/g, '');
      if (!cleanAadhaarRaw || !/^[0-9]{12}$/.test(cleanAadhaarRaw)) {
        res.status(400).json({
          success: false,
          error: 'Invalid Aadhaar number. Must be a valid 12-digit number.',
        });
        return;
      }
      if (!fullName || fullName.trim().length < 2) {
        res.status(400).json({ success: false, error: 'Full name is required as per Aadhaar card.' });
        return;
      }
      if (!aadhaarFile) {
        const existingDoc = await prisma.kycDocument.findUnique({
          where: { userId_documentType: { userId, documentType: 'aadhaar' } },
        });
        if (!existingDoc?.aadhaarDocUrl) {
          res.status(400).json({
            success: false,
            error: 'Aadhaar card document file is required. Please upload a clear PDF or image scan of your Aadhaar card.',
          });
          return;
        }
        resolvedAadhaarUrl = existingDoc.aadhaarDocUrl;
      } else {
        resolvedAadhaarUrl = await uploadKycDocumentToStorage(userId, aadhaarFile, 'aadhaar', aadhaarFileName);
      }
    }

    // 2. Fetch or create sub-account for the user
    const subAccountService = new VobizSubAccountService();
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    const subAccount = await subAccountService.getOrCreateSubAccount(userId, user?.email || undefined);

    if (!subAccount || !subAccount.authId) {
      res.status(502).json({
        success: false,
        error: 'Failed to access telephony sub-account. Please contact support.',
      });
      return;
    }

    // 3. Decrypt sub-account token — NEVER use master MA_ credentials
    const subAuthId = subAccount.authId;
    let decryptedSubAuthToken = '';
    try {
      decryptedSubAuthToken = EncryptionService.decrypt(subAccount.authToken);
    } catch {
      decryptedSubAuthToken = subAccount.authToken;
    }

    let verificationResultStatus: 'verified' | 'failed' | 'pending' = 'pending';
    let vobizReference: string | null = null;
    let failureReason: string | null = null;

    const isMock = subAuthId.startsWith('SA_MOCK_') || (env.VOBIZ_AUTH_ID || '').includes('placeholder');

    if (isMock || documentType === 'aadhaar') {
      // Mock / local verification engine
      if (documentType === 'pan') {
        const isMockValid = PAN_REGEX.test((panNumber || '').trim().toUpperCase());
        if (isMockValid) {
          verificationResultStatus = 'verified';
          vobizReference = `vob_pan_${Date.now()}`;
        } else {
          verificationResultStatus = 'failed';
          failureReason = 'PAN format or name mismatch with tax records.';
        }
      } else if (documentType === 'gst') {
        const isMockValid = GSTIN_REGEX.test((gstin || '').trim().toUpperCase());
        if (isMockValid) {
          verificationResultStatus = 'verified';
          vobizReference = `vob_gst_${Date.now()}`;
        } else {
          verificationResultStatus = 'failed';
          failureReason = 'GSTIN registration status inactive or invalid.';
        }
      } else if (documentType === 'aadhaar') {
        const cleanAadhaarRaw = (aadhaarNumber || '').replace(/\s+/g, '');
        if (/^[0-9]{12}$/.test(cleanAadhaarRaw)) {
          verificationResultStatus = 'verified';
          vobizReference = `vob_adh_${Date.now()}`;
        } else {
          verificationResultStatus = 'failed';
          failureReason = 'Aadhaar document verification failed.';
        }
      }
    } else {
      // Live server-to-server call to Vobiz per-document verification API using SA_ credentials
      const baseUrl = (env.VOBIZ_API_URL || 'https://api.vobiz.ai').replace(/\/+$/, '').replace(/\/api\/v1$/i, '');
      const vobizUrl = `${baseUrl}/api/v1/accounts/${subAuthId}/kyc/verify-document`;

      const payload = documentType === 'pan'
        ? {
            document_type: 'pan',
            pan_number: (panNumber || '').trim().toUpperCase(),
            name: (fullName || '').trim(),
            pan_type: panType || 'personal',
          }
        : {
            document_type: 'gst',
            gstin: (gstin || '').trim().toUpperCase(),
            certificate_url: resolvedGstCertUrl,
          };

      try {
        const vobizRes = await fetch(vobizUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-ID': subAuthId,
            'X-Auth-Token': decryptedSubAuthToken,
          },
          body: JSON.stringify(payload),
        });

        if (vobizRes.ok) {
          const resData = (await vobizRes.json()) as any;
          const status = (resData.status || resData.verification_status || '').toLowerCase();
          if (status === 'verified' || status === 'approved' || resData.verified === true) {
            verificationResultStatus = 'verified';
            vobizReference = resData.reference || resData.id || resData.request_id || `vob_${Date.now()}`;
          } else if (status === 'failed' || status === 'rejected' || resData.verified === false) {
            verificationResultStatus = 'failed';
            failureReason = resData.failure_reason || resData.reason || resData.message || 'Document verification rejected by government records.';
          } else {
            verificationResultStatus = 'pending';
            vobizReference = resData.reference || resData.id || null;
          }
        } else {
          // Fail closed: Any provider non-200 response sets status to failed or pending
          const errText = await vobizRes.text();
          logger.warn('KYC: Vobiz document verification provider error (failing closed)', {
            subAuthId,
            documentType,
            status: vobizRes.status,
            errText,
          });
          verificationResultStatus = 'failed';
          failureReason = `Verification provider returned status ${vobizRes.status}: ${errText.substring(0, 120)}`;
        }
      } catch (callErr: any) {
        logger.error('KYC: Network error calling Vobiz document verification (failing closed)', {
          error: String(callErr?.message || callErr),
        });
        verificationResultStatus = 'failed';
        failureReason = 'Network error contacting verification provider. Please try again.';
      }
    }

    // 4. Idempotent database write to KycDocument (upsert on [userId, documentType])
    const cleanPan = panNumber ? panNumber.trim().toUpperCase() : undefined;
    const cleanPanType = panType ? String(panType).toLowerCase() : 'personal';
    const cleanName = fullName ? fullName.trim() : undefined;
    const cleanDob = dob ? dob.trim() : undefined;
    const cleanGstin = gstin ? gstin.trim().toUpperCase() : undefined;
    const cleanAadhaar = aadhaarNumber ? aadhaarNumber.replace(/\s+/g, '') : undefined;

    const savedDoc = await prisma.kycDocument.upsert({
      where: {
        userId_documentType: { userId, documentType },
      },
      create: {
        userId,
        documentType,
        status: verificationResultStatus,
        panNumber: cleanPan,
        panType: cleanPanType,
        fullName: cleanName,
        dob: cleanDob,
        gstin: cleanGstin,
        gstCertUrl: resolvedGstCertUrl,
        aadhaarNumber: cleanAadhaar,
        aadhaarDocUrl: resolvedAadhaarUrl,
        vobizReference,
        failureReason,
        verifiedAt: verificationResultStatus === 'verified' ? new Date() : null,
      },
      update: {
        status: verificationResultStatus,
        ...(cleanPan && { panNumber: cleanPan }),
        ...(cleanPanType && { panType: cleanPanType }),
        ...(cleanName && { fullName: cleanName }),
        ...(cleanDob && { dob: cleanDob }),
        ...(cleanGstin && { gstin: cleanGstin }),
        ...(resolvedGstCertUrl && { gstCertUrl: resolvedGstCertUrl }),
        ...(cleanAadhaar && { aadhaarNumber: cleanAadhaar }),
        ...(resolvedAadhaarUrl && { aadhaarDocUrl: resolvedAadhaarUrl }),
        vobizReference,
        failureReason,
        verifiedAt: verificationResultStatus === 'verified' ? new Date() : null,
      },
    });

    // 5. Audit Logging on status change
    await logAuditEvent({
      workspaceOwnerId: userId,
      actorUserId: userId,
      action: verificationResultStatus === 'verified' ? 'kyc.document_verified' : 'kyc.document_rejected',
      targetId: savedDoc.id,
      metadata: {
        documentType,
        status: verificationResultStatus,
        vobizReference,
        failureReason,
      },
    });

    // 6. Resend email notification
    await notifyUserDocumentStatus(userId, documentType, verificationResultStatus, failureReason || undefined);

    // 7. Check if overall KYC can now be elevated to verified
    if (verificationResultStatus === 'verified') {
      await checkAndApplyFullKycApproval(userId, subAccount.id);
    }

    res.json({
      success: true,
      data: {
        id: savedDoc.id,
        documentType: savedDoc.documentType,
        status: savedDoc.status,
        failureReason: savedDoc.failureReason,
        verifiedAt: savedDoc.verifiedAt,
        gstCertUrl: savedDoc.gstCertUrl,
        aadhaarDocUrl: savedDoc.aadhaarDocUrl,
      },
    });
  } catch (err) {
    logger.error('KYC: verify-document error', { error: String(err) });
    next(err);
  }
});

/**
 * POST /api/v2/kyc/verify-aadhaar
 * DigiLocker consent flow (access_request_id).
 * Strictly NEVER stores raw Aadhaar number or document image.
 * Only stores the verified/not-verified result returned by Vobiz.
 */
router.post('/verify-aadhaar', requireAuth, sensitiveOperationsLimiter, async (req, res, next) => {
  try {
    const userId = (req as any).effectiveWorkspaceId || (req as any).userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { access_request_id } = req.body;
    if (!access_request_id || typeof access_request_id !== 'string') {
      res.status(400).json({ success: false, error: 'access_request_id is required for DigiLocker consent verification.' });
      return;
    }

    const subAccountService = new VobizSubAccountService();
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    const subAccount = await subAccountService.getOrCreateSubAccount(userId, user?.email || undefined);

    let decryptedSubAuthToken = '';
    try {
      decryptedSubAuthToken = EncryptionService.decrypt(subAccount.authToken);
    } catch {
      decryptedSubAuthToken = subAccount.authToken;
    }

    const subAuthId = subAccount.authId;
    const isMock = subAuthId.startsWith('SA_MOCK_') || (env.VOBIZ_AUTH_ID || '').includes('placeholder');

    let verificationResultStatus: 'verified' | 'failed' = 'failed';
    let failureReason: string | null = null;

    if (isMock) {
      // Mock flow
      if (access_request_id.length > 5) {
        verificationResultStatus = 'verified';
      } else {
        verificationResultStatus = 'failed';
        failureReason = 'DigiLocker consent token expired or invalid.';
      }
    } else {
      const baseUrl = (env.VOBIZ_API_URL || 'https://api.vobiz.ai').replace(/\/+$/, '').replace(/\/api\/v1$/i, '');
      const vobizUrl = `${baseUrl}/api/v1/accounts/${subAuthId}/kyc/verify-aadhaar`;

      try {
        const vobizRes = await fetch(vobizUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-ID': subAuthId,
            'X-Auth-Token': decryptedSubAuthToken,
          },
          body: JSON.stringify({ access_request_id }),
        });

        if (vobizRes.ok) {
          const resData = (await vobizRes.json()) as any;
          if (resData.verified === true || resData.status === 'verified') {
            verificationResultStatus = 'verified';
          } else {
            verificationResultStatus = 'failed';
            failureReason = resData.reason || resData.message || 'DigiLocker consent verification failed.';
          }
        } else {
          // Fail closed
          const errText = await vobizRes.text();
          verificationResultStatus = 'failed';
          failureReason = `DigiLocker provider error (${vobizRes.status}): ${errText.substring(0, 100)}`;
        }
      } catch (err: any) {
        verificationResultStatus = 'failed';
        failureReason = 'Network error communicating with DigiLocker gateway.';
      }
    }

    // Upsert into KycDocument — NO raw Aadhaar stored
    const savedDoc = await prisma.kycDocument.upsert({
      where: {
        userId_documentType: { userId, documentType: 'aadhaar' },
      },
      create: {
        userId,
        documentType: 'aadhaar',
        status: verificationResultStatus,
        vobizReference: access_request_id,
        failureReason,
        verifiedAt: verificationResultStatus === 'verified' ? new Date() : null,
      },
      update: {
        status: verificationResultStatus,
        vobizReference: access_request_id,
        failureReason,
        verifiedAt: verificationResultStatus === 'verified' ? new Date() : null,
      },
    });

    await logAuditEvent({
      workspaceOwnerId: userId,
      actorUserId: userId,
      action: verificationResultStatus === 'verified' ? 'kyc.document_verified' : 'kyc.document_rejected',
      targetId: savedDoc.id,
      metadata: {
        documentType: 'aadhaar',
        status: verificationResultStatus,
        vobizReference: access_request_id,
        failureReason,
      },
    });

    await notifyUserDocumentStatus(userId, 'aadhaar', verificationResultStatus, failureReason || undefined);

    if (verificationResultStatus === 'verified') {
      await checkAndApplyFullKycApproval(userId, subAccount.id);
    }

    res.json({
      success: true,
      data: {
        id: savedDoc.id,
        documentType: 'aadhaar',
        status: savedDoc.status,
        failureReason: savedDoc.failureReason,
        verifiedAt: savedDoc.verifiedAt,
      },
    });
  } catch (err) {
    logger.error('KYC: verify-aadhaar error', { error: String(err) });
    next(err);
  }
});

/**
 * @deprecated Use on-platform KYC endpoints (POST /verify-document, POST /verify-aadhaar) instead.
 * POST /api/v2/kyc/initiate-session
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

    const hostedKycUrl = `https://console.vobiz.ai/kyc?sub_account_auth_id=${subAccount.authId}`;

    logger.info('KYC [DEPRECATED]: Initiated Vobiz Hosted KYC Session fallback', { userId, subAuthId: subAccount.authId });

    await logAuditEvent({
      workspaceOwnerId: (req as any).effectiveWorkspaceId || userId,
      actorUserId: userId,
      action: 'kyc.initiated',
      targetId: subAccount.authId,
      metadata: { status: 'pending', deprecated: true },
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

    const docs = await prisma.kycDocument.findMany({ where: { userId } });
    const panDoc = docs.find((d) => d.documentType === 'pan');
    const gstDoc = docs.find((d) => d.documentType === 'gst');

    const isFullyDocVerified = panDoc?.status === 'verified' && gstDoc?.status === 'verified';

    const SYNC_TTL_MS = 3 * 60 * 1000;
    const isStale = !subAccount || !subAccount.updatedAt || (Date.now() - subAccount.updatedAt.getTime() > SYNC_TTL_MS);

    let kycStatus = (isFullyDocVerified || subAccount?.kycStatus === 'verified') ? 'verified' : (subAccount?.kycStatus || 'pending');
    let isVerified = kycStatus === 'verified';

    if (isStale && !isVerified) {
      try {
        const subAccountService = new VobizSubAccountService();
        const syncResult = await subAccountService.syncKycStatus(userId);
        if (isFullyDocVerified) {
          kycStatus = 'verified';
          isVerified = true;
        } else {
          kycStatus = syncResult.kycStatus;
          isVerified = syncResult.isVerified;
        }
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
        kycStatus,
        isVerified,
        confirmationMessage: isVerified
          ? "Your KYC verification is active and verified with Vobiz."
          : "Your KYC verification is being processed. We'll notify you once it's complete.",
        numbers,
        documents: docs,
      }
    });
  } catch (err) {
    logger.error('KYC: failed to fetch status', { error: String(err) });
    next(err);
  }
});

/**
 * POST /api/v2/kyc/webhook/vobiz
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
      await PhoneNumberActivationService.evaluateAndActivateUserNumbers(targetUserId, 'kyc_webhook');

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
