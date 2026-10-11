import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireActivePlan } from '../middleware/planValidation';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { checkRequiredKycDocumentsVerified, checkAndApplyFullKycApproval } from '../services/KycVerificationService';
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

export function maskPan(pan?: string | null): string | null {
  if (!pan) return null;
  const p = pan.trim().toUpperCase();
  if (p.length !== 10) return p;
  return `${p.substring(0, 2)}******${p.substring(8)}`;
}

export function maskAadhaar(aadhaar?: string | null): string | null {
  if (!aadhaar) return null;
  const a = aadhaar.replace(/\s+/g, '');
  if (a.length !== 12) return a;
  return `********${a.substring(8)}`;
}

export function maskFullName(name?: string | null): string | null {
  if (!name) return null;
  const parts = name.trim().split(/\s+/);
  return parts.map((p) => (p.length <= 2 ? p : `${p[0]}***${p[p.length - 1]}`)).join(' ');
}

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

    const fromAddress = process.env.RESEND_FROM_EMAIL || 'Claritiy Voice <notifications@claritiy.com>';

    // 2. Email Delivery via Resend (non-fatal side effect)
    if (!process.env.RESEND_API_KEY) {
      logger.info('[NOTIFICATION] RESEND_API_KEY is not configured, skipping document email dispatch', {
        userId,
        email: user.email,
        documentType,
        status,
        from: fromAddress,
      });
      return;
    }

    try {
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
        logger.warn('KYC Document Notification: Resend returned error delivering email (non-fatal)', {
          userId,
          error: emailResult.error,
          recipient: user.email,
          documentType,
          status,
        });
      } else {
        logger.info('KYC Document Notification: Status email dispatched via Resend', {
          userId,
          email: user.email,
          emailId: emailResult.data?.id,
        });
      }
    } catch (emailErr) {
      logger.warn('KYC Document Notification: Failed to dispatch Resend email (non-fatal)', {
        userId,
        recipient: user.email,
        error: String(emailErr),
      });
    }
  } catch (err) {
    logger.warn('KYC Document Notification: Error in document notification handler (non-fatal)', {
      userId,
      documentType,
      error: String(err),
    });
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

    const fromAddress = process.env.RESEND_FROM_EMAIL || 'Claritiy Voice <notifications@claritiy.com>';

    if (!process.env.RESEND_API_KEY) {
      logger.info('[NOTIFICATION] RESEND_API_KEY not configured, skipping status email dispatch', {
        email: user.email,
        status,
        from: fromAddress
      });
      return;
    }

    try {
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
        logger.warn('KYC Notification: Resend returned error delivering email (non-fatal)', {
          userId,
          recipient: user.email,
          error: emailResult.error
        });
      } else {
        logger.info('KYC Notification: Status email dispatched via Resend', {
          userId,
          email: user.email,
          emailId: emailResult.data?.id
        });
      }
    } catch (emailErr) {
      logger.warn('KYC Notification: Failed to dispatch Resend email (non-fatal)', {
        userId,
        recipient: user.email,
        error: String(emailErr)
      });
    }
  } catch (err) {
    logger.warn('KYC Notification: Error in status notification handler (non-fatal)', { userId, error: String(err) });
  }
}

/**
 * GET /api/v2/kyc/documents
 * Returns every required document for the user's business type and its current status,
 * for the Settings page to render directly.
 */
router.get('/documents', requireAuth, requireActivePlan, async (req, res, next) => {
  try {
    const userId = (req as any).effectiveWorkspaceId || (req as any).userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const [docs, subAccount, kycResult] = await Promise.all([
      prisma.kycDocument.findMany({ where: { userId } }),
      prisma.vobizSubAccount.findUnique({ where: { userId } }),
      checkRequiredKycDocumentsVerified(userId),
    ]);

    const panDoc = docs.find((d) => d.documentType === 'pan');
    const gstDoc = docs.find((d) => d.documentType === 'gst');
    const aadhaarDoc = docs.find((d) => d.documentType === 'aadhaar');

    const businessType = kycResult.businessType;
    const isFullyVerified = kycResult.verified;

    let overallStatus: 'verified' | 'pending' | 'failed' | 'not_submitted' = 'not_submitted';

    if (isFullyVerified || subAccount?.kycStatus === 'verified') {
      overallStatus = 'verified';
    } else if (
      (kycResult.requiredDocs.includes('PAN') && panDoc?.status === 'failed') ||
      (kycResult.requiredDocs.includes('GST') && gstDoc?.status === 'failed') ||
      (kycResult.requiredDocs.includes('Aadhaar') && aadhaarDoc?.status === 'failed')
    ) {
      overallStatus = 'failed';
    } else if (
      (kycResult.requiredDocs.includes('PAN') && panDoc?.status === 'pending') ||
      (kycResult.requiredDocs.includes('GST') && gstDoc?.status === 'pending') ||
      (kycResult.requiredDocs.includes('Aadhaar') && aadhaarDoc?.status === 'pending')
    ) {
      overallStatus = 'pending';
    }

    const documentList = [
      {
        documentType: 'pan',
        label: 'Permanent Account Number (PAN)',
        description: 'Authorized signatory PAN for tax & identity verification',
        required: true,
        status: panDoc?.status || 'not_submitted',
        panNumber: maskPan(panDoc?.panNumber),
        panType: panDoc?.panType || 'personal',
        fullName: maskFullName(panDoc?.fullName),
        failureReason: panDoc?.failureReason || null,
        verifiedAt: panDoc?.verifiedAt || null,
        updatedAt: panDoc?.updatedAt || null,
      },
      {
        documentType: 'gst',
        label: 'GST Certificate (GSTIN)',
        description: 'GST registration certificate PDF/image for commercial telephony',
        required: businessType === 'company',
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
        description: 'Authorized signatory Aadhaar card DigiLocker identity verification',
        required: businessType === 'individual',
        status: aadhaarDoc?.status || 'not_submitted',
        aadhaarNumber: maskAadhaar(aadhaarDoc?.aadhaarNumber),
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
router.post('/verify-document', requireAuth, requireActivePlan, sensitiveOperationsLimiter, async (req, res, next) => {
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

    // 3. Verify sub-account token decryption health — alert admin and return 503 if failed
    const subAuthId = subAccount.authId;
    let decryptedSubAuthToken = '';
    try {
      const { plaintext, needsMigration } = EncryptionService.decryptWithMetadata(subAccount.authToken);
      decryptedSubAuthToken = plaintext;
      if (needsMigration) {
        const reEncrypted = EncryptionService.encrypt(plaintext);
        prisma.vobizSubAccount.update({
          where: { id: subAccount.id },
          data: { authToken: reEncrypted },
        }).catch((err) => logger.warn('KYC: lazy token migration warning', { error: String(err) }));
      }
    } catch (decryptErr) {
      logger.error('[ADMIN_ALERT][CRYPTO_FAILURE] KYC: Failed to decrypt sub-account auth token', {
        userId,
        subAuthId,
        error: decryptErr instanceof Error ? decryptErr.message : String(decryptErr),
      });
      res.status(503).json({
        success: false,
        outcome: 'error',
        canFallbackHosted: true,
        error: 'Verification is temporarily unavailable, please try again shortly',
      });
      return;
    }

    let verificationResultStatus: 'verified' | 'failed' | 'pending' = 'pending';
    let vobizReference: string | null = null;
    let failureReason: string | null = null;

    const isMock = subAuthId.startsWith('SA_MOCK_') || (env.VOBIZ_AUTH_ID || '').includes('placeholder');

    let digilockerLink: string | null = null;
    let digilockerAccessRequestId: string | null = null;

    if (isMock) {
      if (process.env.NODE_ENV === 'production') {
        logger.error('[CRITICAL_SECURITY_ALERT] Mock KYC verification path invoked in production! Failing closed.', {
          userId,
          subAuthId,
          documentType,
        });
        res.status(503).json({
          success: false,
          outcome: 'error',
          canFallbackHosted: true,
          error: 'Live verification required. Mock verification is disabled in production.',
        });
        return;
      }

      logger.warn('[MOCK_MODE_ALERT] Document verification attempted in mock mode. Documents cannot be rubber-stamped as verified without government check.', {
        userId,
        subAuthId,
        documentType,
      });
      verificationResultStatus = 'failed';
      failureReason = 'Live government verification required. Cannot verify document under mock/simulated credentials.';
      vobizReference = `mock_${documentType}_${Date.now()}`;
    } else {
      // Live server-to-server call to documented Vobiz KYC API authenticated with parent credentials
      const baseUrl = (env.VOBIZ_API_URL || 'https://api.vobiz.ai').replace(/\/+$/, '').replace(/\/api\/v1$/i, '');
      const masterAuthId = env.VOBIZ_AUTH_ID;
      const masterAuthToken = env.VOBIZ_AUTH_TOKEN;

      if (!masterAuthId || !masterAuthToken || masterAuthId.includes('placeholder')) {
        logger.error('[ADMIN_ALERT][VOBIZ_CONFIG_ERROR] Missing VOBIZ_AUTH_ID or VOBIZ_AUTH_TOKEN in production environment');
        res.status(503).json({
          success: false,
          outcome: 'error',
          canFallbackHosted: true,
          error: 'Verification service is temporarily unavailable, please try again shortly',
        });
        return;
      }

      const headers = {
        'Content-Type': 'application/json',
        'X-Auth-ID': masterAuthId,
        'X-Auth-Token': masterAuthToken,
      };

      try {
        let vobizRes: Response;
        if (documentType === 'pan') {
          const vobizUrl = `${baseUrl}/api/v1/sub-accounts/${subAuthId}/kyc/verify-pan`;
          vobizRes = await fetch(vobizUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({ pan: (panNumber || '').trim().toUpperCase() }),
          });
        } else if (documentType === 'gst') {
          const vobizUrl = `${baseUrl}/api/v1/sub-accounts/${subAuthId}/kyc/verify-gst`;
          vobizRes = await fetch(vobizUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({ gstin: (gstin || '').trim().toUpperCase() }),
          });
        } else {
          // Aadhaar: Official Vobiz DigiLocker integration
          const vobizUrl = `${baseUrl}/api/v1/sub-accounts/${subAuthId}/kyc/digilocker/initiate`;
          vobizRes = await fetch(vobizUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              redirect_url: 'https://www.claritiy.com/compliance?tab=kyc',
            }),
          });
        }

        if (vobizRes.ok) {
          const resData = (await vobizRes.json()) as any;
          if (documentType === 'aadhaar') {
            // DigiLocker initiate returns link and access_request_id
            digilockerLink = resData.link || resData.auth_url || null;
            digilockerAccessRequestId = resData.access_request_id || resData.api_id || null;
            vobizReference = digilockerAccessRequestId;
            verificationResultStatus = 'pending';
          } else {
            const status = (resData.status || '').toLowerCase();
            if (status === 'verified' || resData.verified === true) {
              verificationResultStatus = 'verified';
              vobizReference = resData.api_id || resData.reference || resData.id || `vob_${Date.now()}`;
            } else if (status === 'failed' || status === 'rejected' || resData.verified === false) {
              verificationResultStatus = 'failed';
              failureReason = resData.message || resData.reason || 'Document verification rejected: details did not match official records.';
            } else {
              verificationResultStatus = 'pending';
              vobizReference = resData.api_id || resData.reference || null;
            }
          }
        } else {
          // Provider 401/403/5xx/404 system errors:
          // Do NOT count as a rejection, do NOT store 'failed', do NOT leak provider text to client.
          const errText = await vobizRes.text();
          logger.error('[ADMIN_ALERT][VOBIZ_PROVIDER_ERROR] KYC: Vobiz document verification provider error', {
            subAuthId,
            documentType,
            status: vobizRes.status,
            errText: errText.substring(0, 300),
          });

          res.status(502).json({
            success: false,
            outcome: 'error',
            canFallbackHosted: true,
            error: 'Verification provider is temporarily unavailable. Please try again shortly or continue with Vobiz hosted verification.',
          });
          return;
        }
      } catch (callErr: any) {
        logger.error('[ADMIN_ALERT][VOBIZ_PROVIDER_ERROR] KYC: Network error calling Vobiz document verification', {
          error: String(callErr?.message || callErr),
        });

        res.status(502).json({
          success: false,
          outcome: 'error',
          canFallbackHosted: true,
          error: 'Network error contacting verification provider. Please try again shortly or continue with Vobiz hosted verification.',
        });
        return;
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
        panNumber: cleanPan ? maskPan(cleanPan) : undefined,
        panType: cleanPanType,
        fullName: cleanName ? maskFullName(cleanName) : undefined,
        dob: cleanDob,
        gstin: cleanGstin,
        gstCertUrl: resolvedGstCertUrl,
        aadhaarNumber: cleanAadhaar ? maskAadhaar(cleanAadhaar) : undefined,
        aadhaarDocUrl: resolvedAadhaarUrl,
        vobizReference,
        failureReason,
        verifiedAt: verificationResultStatus === 'verified' ? new Date() : null,
      },
      update: {
        status: verificationResultStatus,
        ...(cleanPan && { panNumber: maskPan(cleanPan) }),
        ...(cleanPanType && { panType: cleanPanType }),
        ...(cleanName && { fullName: maskFullName(cleanName) }),
        ...(cleanDob && { dob: cleanDob }),
        ...(cleanGstin && { gstin: cleanGstin }),
        ...(resolvedGstCertUrl && { gstCertUrl: resolvedGstCertUrl }),
        ...(cleanAadhaar && { aadhaarNumber: maskAadhaar(cleanAadhaar) }),
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
      authUrl: digilockerLink,
      link: digilockerLink,
      accessRequestId: digilockerAccessRequestId,
      data: {
        id: savedDoc.id,
        documentType: savedDoc.documentType,
        status: savedDoc.status,
        failureReason: savedDoc.failureReason,
        verifiedAt: savedDoc.verifiedAt,
        gstCertUrl: savedDoc.gstCertUrl,
        aadhaarDocUrl: savedDoc.aadhaarDocUrl,
        authUrl: digilockerLink,
        link: digilockerLink,
        accessRequestId: digilockerAccessRequestId,
      },
    });
  } catch (err) {
    logger.error('KYC: verify-document error', { error: String(err) });
    next(err);
  }
});

/**
 * POST /api/v2/kyc/digilocker/initiate
 * Starts a DigiLocker-based Aadhaar verification session with Vobiz.
 * Returns auth_url and access_request_id.
 */
router.post(['/digilocker/initiate', '/aadhaar/initiate'], requireAuth, requireActivePlan, sensitiveOperationsLimiter, async (req, res, next) => {
  try {
    const userId = (req as any).effectiveWorkspaceId || (req as any).userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const subAccountService = new VobizSubAccountService();
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    const subAccount = await subAccountService.getOrCreateSubAccount(userId, user?.email || undefined);
    const subAuthId = subAccount.authId;
    const isMock = subAuthId.startsWith('SA_MOCK_') || (env.VOBIZ_AUTH_ID || '').includes('placeholder');

    if (isMock) {
      if (process.env.NODE_ENV === 'production') {
        logger.error('[CRITICAL_SECURITY_ALERT] Mock DigiLocker initiate invoked in production! Failing closed.', { userId, subAuthId });
        res.status(503).json({ success: false, error: 'Live DigiLocker verification required. Mock mode is disabled in production.' });
        return;
      }
      const mockAccessRequestId = `AR_MOCK_${Date.now()}`;
      res.json({
        success: true,
        auth_url: `https://www.claritiy.com/compliance?tab=kyc&mock_dl=${mockAccessRequestId}`,
        link: `https://www.claritiy.com/compliance?tab=kyc&mock_dl=${mockAccessRequestId}`,
        access_request_id: mockAccessRequestId,
        message: 'Open the link to authenticate via DigiLocker. Complete Aadhaar OTP verification.',
      });
      return;
    }

    const baseUrl = (env.VOBIZ_API_URL || 'https://api.vobiz.ai').replace(/\/+$/, '').replace(/\/api\/v1$/i, '');
    const masterAuthId = env.VOBIZ_AUTH_ID;
    const masterAuthToken = env.VOBIZ_AUTH_TOKEN;

    if (!masterAuthId || !masterAuthToken || masterAuthId.includes('placeholder')) {
      res.status(503).json({
        success: false,
        error: 'Verification service is temporarily unavailable, please try again shortly',
      });
      return;
    }

    const vobizUrl = `${baseUrl}/api/v1/sub-accounts/${subAuthId}/kyc/digilocker/initiate`;
    const vobizRes = await fetch(vobizUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-ID': masterAuthId,
        'X-Auth-Token': masterAuthToken,
      },
      body: JSON.stringify({
        redirect_url: req.body.redirect_url || 'https://www.claritiy.com/compliance?tab=kyc',
        oauth_state: req.body.oauth_state || undefined,
      }),
    });

    if (vobizRes.ok) {
      const data = (await vobizRes.json()) as any;
      const accessRequestId = data.access_request_id || data.api_id;
      const authUrl = data.link || data.auth_url;

      // Upsert pending Aadhaar document
      await prisma.kycDocument.upsert({
        where: { userId_documentType: { userId, documentType: 'aadhaar' } },
        create: {
          userId,
          documentType: 'aadhaar',
          status: 'pending',
          vobizReference: accessRequestId,
        },
        update: {
          status: 'pending',
          vobizReference: accessRequestId,
        },
      });

      res.json({
        success: true,
        auth_url: authUrl,
        link: authUrl,
        access_request_id: accessRequestId,
        message: data.message || 'Open the link to authenticate via DigiLocker. Complete Aadhaar OTP verification.',
      });
    } else {
      const errText = await vobizRes.text();
      logger.error('KYC: DigiLocker initiate provider error', { status: vobizRes.status, errText: errText.substring(0, 300) });
      res.status(502).json({
        success: false,
        error: 'DigiLocker service is temporarily unavailable. Please try again shortly or use hosted verification.',
      });
    }
  } catch (err) {
    logger.error('KYC: digilocker/initiate error', { error: String(err) });
    next(err);
  }
});

/**
 * POST /api/v2/kyc/verify-aadhaar (and alias /digilocker/verify)
 * DigiLocker consent flow (access_request_id).
 * Strictly NEVER stores raw Aadhaar number or document image.
 * Only stores the verified/not-verified result returned by Vobiz.
 */
router.post(['/verify-aadhaar', '/digilocker/verify'], requireAuth, requireActivePlan, sensitiveOperationsLimiter, async (req, res, next) => {
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
      const { plaintext, needsMigration } = EncryptionService.decryptWithMetadata(subAccount.authToken);
      decryptedSubAuthToken = plaintext;
      if (needsMigration) {
        const reEncrypted = EncryptionService.encrypt(plaintext);
        prisma.vobizSubAccount.update({
          where: { id: subAccount.id },
          data: { authToken: reEncrypted },
        }).catch((err) => logger.warn('KYC: lazy token migration warning for Aadhaar', { error: String(err) }));
      }
    } catch (decryptErr) {
      logger.error('[ADMIN_ALERT][CRYPTO_FAILURE] KYC: Failed to decrypt sub-account auth token for Aadhaar', {
        userId,
        subAuthId: subAccount.authId,
        error: decryptErr instanceof Error ? decryptErr.message : String(decryptErr),
      });
      res.status(503).json({
        success: false,
        outcome: 'error',
        canFallbackHosted: true,
        error: 'Verification is temporarily unavailable, please try again shortly',
      });
      return;
    }

    const subAuthId = subAccount.authId;
    const isMock = subAuthId.startsWith('SA_MOCK_') || (env.VOBIZ_AUTH_ID || '').includes('placeholder');

    let verificationResultStatus: 'verified' | 'failed' | 'pending' = 'pending';
    let failureReason: string | null = null;

    if (isMock) {
      if (process.env.NODE_ENV === 'production') {
        logger.error('[CRITICAL_SECURITY_ALERT] Mock Aadhaar verify invoked in production! Failing closed.', { userId, subAuthId });
        res.status(503).json({ success: false, error: 'Live DigiLocker verification required. Mock mode is disabled in production.' });
        return;
      }
      logger.warn('[MOCK_MODE_WARNING] Aadhaar verify running in mock dev mode. Cannot rubber-stamp as verified.', { userId, access_request_id });
      verificationResultStatus = 'failed';
      failureReason = 'Live DigiLocker verification required. Simulated credentials cannot verify Aadhaar.';
    } else {
      const baseUrl = (env.VOBIZ_API_URL || 'https://api.vobiz.ai').replace(/\/+$/, '').replace(/\/api\/v1$/i, '');
      const masterAuthId = env.VOBIZ_AUTH_ID;
      const masterAuthToken = env.VOBIZ_AUTH_TOKEN;

      if (!masterAuthId || !masterAuthToken || masterAuthId.includes('placeholder')) {
        res.status(503).json({
          success: false,
          outcome: 'error',
          canFallbackHosted: true,
          error: 'Verification service is temporarily unavailable, please try again shortly',
        });
        return;
      }

      const vobizUrl = `${baseUrl}/api/v1/sub-accounts/${subAuthId}/kyc/digilocker/verify`;

      try {
        const vobizRes = await fetch(vobizUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-ID': masterAuthId,
            'X-Auth-Token': masterAuthToken,
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
          // Provider system error: separate from document rejection
          const errText = await vobizRes.text();
          logger.error('[ADMIN_ALERT][VOBIZ_PROVIDER_ERROR] KYC: DigiLocker provider error', {
            subAuthId,
            status: vobizRes.status,
            errText: errText.substring(0, 300),
          });
          res.status(502).json({
            success: false,
            outcome: 'error',
            canFallbackHosted: true,
            error: 'DigiLocker provider is temporarily unavailable. Please try again shortly or continue with Vobiz hosted verification.',
          });
          return;
        }
      } catch (err: any) {
        logger.error('[ADMIN_ALERT][VOBIZ_PROVIDER_ERROR] KYC: DigiLocker network error', { error: String(err) });
        res.status(502).json({
          success: false,
          outcome: 'error',
          canFallbackHosted: true,
          error: 'Network error communicating with DigiLocker gateway. Please try again shortly.',
        });
        return;
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
router.post(['/initiate-session', '/start'], requireAuth, requireActivePlan, sensitiveOperationsLimiter, async (req, res, next) => {
  try {
    const userId = (req as any).effectiveWorkspaceId || (req as any).userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const subAccountService = new VobizSubAccountService();
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    const subAccount = await subAccountService.getOrCreateSubAccount(userId, user?.email || undefined);

    let redirectUrl = `https://console.vobiz.ai/kyc?sub_account_auth_id=${subAccount.authId}`;

    const baseUrl = (env.VOBIZ_API_URL || 'https://api.vobiz.ai').replace(/\/+$/, '').replace(/\/api\/v1$/i, '');
    const masterAuthId = env.VOBIZ_AUTH_ID;
    const masterAuthToken = env.VOBIZ_AUTH_TOKEN;

    if (masterAuthId && masterAuthToken && !masterAuthId.includes('placeholder')) {
      try {
        const sessionUrl = `${baseUrl}/api/v1/sub-accounts/${subAccount.authId}/kyc-sessions`;
        const sessionRes = await fetch(sessionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-ID': masterAuthId,
            'X-Auth-Token': masterAuthToken,
          },
          body: JSON.stringify({
            account_auth_id: subAccount.authId,
            flow_type: 'redirect',
            redirect_url: `${env.FRONTEND_URL || 'https://ai-voice-agent-kohl-alpha.vercel.app'}/dashboard/compliance`,
          }),
        });

        if (sessionRes.ok) {
          const sessionData = (await sessionRes.json()) as any;
          if (sessionData.widget_url) {
            redirectUrl = sessionData.widget_url;
            logger.info('KYC: successfully obtained Vobiz hosted KYC widget URL', {
              userId,
              subAuthId: subAccount.authId,
              sessionId: sessionData.session_id,
            });
          }
        } else {
          logger.warn('KYC: Vobiz kyc-sessions returned non-200, falling back to console link', {
            status: sessionRes.status,
            subAuthId: subAccount.authId,
          });
        }
      } catch (sessionErr) {
        logger.warn('KYC: error contacting Vobiz kyc-sessions, falling back to console link', {
          error: String(sessionErr),
        });
      }
    }

    logger.info('KYC: Initiated Vobiz Hosted KYC Session flow', { userId, subAuthId: subAccount.authId });

    await logAuditEvent({
      workspaceOwnerId: (req as any).effectiveWorkspaceId || userId,
      actorUserId: userId,
      action: 'kyc.initiated',
      targetId: subAccount.authId,
      metadata: { status: 'pending', hostedFallback: true },
    });

    res.json({
      success: true,
      data: {
        redirectUrl,
        subAccountAuthId: subAccount.authId,
        confirmationMessage: "Your KYC verification is being processed. Complete the verification steps on the hosted portal.",
        status: "pending",
      },
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

/**
 * GET /api/v2/kyc/status
 * Queries live Vobiz sub-account KYC status (/api/v1/sub-accounts/{sub_auth_id}/kyc/status)
 * and syncs business_type and kyc_calls_blocked.
 */
router.get('/status', requireAuth, requireActivePlan, async (req, res, next) => {
  try {
    const userId = (req as any).effectiveWorkspaceId || (req as any).userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const subAccount = await prisma.vobizSubAccount.findUnique({ where: { userId } });
    if (!subAccount) {
      res.status(404).json({ success: false, error: 'Sub-account not provisioned for this user.' });
      return;
    }

    const subAuthId = subAccount.authId;
    const isMock = subAuthId.startsWith('SA_MOCK_') || (env.VOBIZ_AUTH_ID || '').includes('placeholder');

    if (isMock) {
      res.json({
        success: true,
        data: {
          authId: subAuthId,
          kycStatus: subAccount.kycStatus,
          businessType: subAccount.businessType,
          kycCallsBlocked: true,
          isMock: true,
        },
      });
      return;
    }

    const baseUrl = (env.VOBIZ_API_URL || 'https://api.vobiz.ai').replace(/\/+$/, '').replace(/\/api\/v1$/i, '');
    const masterAuthId = env.VOBIZ_AUTH_ID;
    const masterAuthToken = env.VOBIZ_AUTH_TOKEN;

    if (!masterAuthId || !masterAuthToken || masterAuthId.includes('placeholder')) {
      res.status(503).json({ success: false, error: 'Vobiz credentials not configured.' });
      return;
    }

    const vobizRes = await fetch(`${baseUrl}/api/v1/sub-accounts/${subAuthId}/kyc/status`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Auth-ID': masterAuthId,
        'X-Auth-Token': masterAuthToken,
      },
    });

    if (!vobizRes.ok) {
      const errText = await vobizRes.text();
      logger.warn('KYC: Failed to fetch live Vobiz status', { status: vobizRes.status, errText: errText.substring(0, 200) });
      res.status(502).json({ success: false, error: 'Unable to query KYC provider status.' });
      return;
    }

    const data = (await vobizRes.json()) as any;
    const liveKycStatus = (data.kyc_status || 'pending').toLowerCase();
    const kycCallsBlocked = Boolean(data.kyc_calls_blocked);
    const liveBusinessType = data.business_type || subAccount.businessType || 'individual';

    if (subAccount.businessType !== liveBusinessType) {
      await prisma.vobizSubAccount.update({
        where: { id: subAccount.id },
        data: { businessType: liveBusinessType },
      });
    }

    res.json({
      success: true,
      data: {
        authId: subAuthId,
        kycStatus: liveKycStatus,
        businessType: liveBusinessType,
        kycCallsBlocked,
        panStatus: data.pan_status,
        aadhaarStatus: data.aadhaar_status,
        gstStatus: data.gst_status,
      },
    });
  } catch (err) {
    logger.error('KYC: GET /status error', { error: String(err) });
    next(err);
  }
});

export default router;
