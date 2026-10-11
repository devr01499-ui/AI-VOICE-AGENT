import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { logAuditEvent } from '../utils/auditLogger';
import { PhoneNumberActivationService } from './PhoneNumberActivationService';
import { NotificationService } from './NotificationService';
import { Resend } from 'resend';

export interface KycVerificationResult {
  verified: boolean;
  businessType: 'individual' | 'company';
  missing: string[];
  requiredDocs: string[];
  subAccountId?: string;
  isMockSubAccount?: boolean;
  error?: string;
}

/**
 * Hardened validation: checks whether a vobiz reference matches legitimate Vobiz response shapes.
 * Rejects any reference that doesn't match genuine Vobiz formats (e.g. AR_xxxxxxxx for DigiLocker,
 * VER_... or legitimate UUID/transaction IDs for PAN/GST), and proactively rejects any local
 * synthetic timestamps, mock prefixes (vob_, doc_, mock_, test_), or Date.now() patterns.
 */
export function isMockVobizReference(ref?: string | null): boolean {
  if (!ref || typeof ref !== 'string') return true;
  const trimmed = ref.trim();
  if (trimmed.length < 8) return true;

  const lower = trimmed.toLowerCase();
  // 1. Explicit mock markers
  if (lower.includes('mock') || lower.startsWith('test_') || lower.startsWith('sim_')) {
    return true;
  }

  // 2. Local synthetic timestamp patterns: doc_adh_..., vob_pan_..., vob_gst_..., or ending in 10-14 digit timestamp
  if (/^(doc_|vob_|mock_|fake_)/i.test(trimmed)) {
    return true;
  }
  if (/_\d{10,14}$/.test(trimmed)) {
    return true;
  }

  // 3. Genuine Vobiz reference patterns:
  // - DigiLocker: AR_[a-zA-Z0-9]{6,}
  // - Standard Vobiz verification ID: VER_[a-zA-Z0-9_-]{6,} or standard UUID or uppercase alphanumeric
  const isDigiLockerPattern = /^AR_[a-zA-Z0-9]{6,}$/.test(trimmed);
  const isVobizVerPattern = /^VER_[a-zA-Z0-9_-]{6,}$/i.test(trimmed);
  const isUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
  const isVobizAlnumPattern = /^[A-Z0-9]{10,40}$/i.test(trimmed);

  if (isDigiLockerPattern || isVobizVerPattern || isUuidPattern || isVobizAlnumPattern) {
    return false; // Valid genuine Vobiz reference
  }

  // Fail closed if reference does not match Vobiz provider shapes
  return true;
}

/**
 * Statutory PAN 4th-character entity category derivation (NSDL / Income Tax Department rule):
 * - Character 4 = 'P' (Person / Individual) -> 'personal'
 * - Character 4 = 'H' (Hindu Undivided Family) -> 'personal'
 * - Character 4 in ['C', 'F', 'A', 'T', 'B', 'L', 'J', 'G'] -> 'company'
 *   - 'C': Company
 *   - 'F': Firm / Partnership / Limited Liability Partnership (LLP)
 *   - 'A': Association of Persons (AOP)
 *   - 'T': Trust
 *   - 'B': Body of Individuals (BOI)
 *   - 'L': Local Authority
 *   - 'J': Artificial Juridical Person
 *   - 'G': Government Agency
 * Fails closed to 'personal' (requiring Aadhaar verification) for any unmapped character.
 */
export function derivePanCategory(panNumber?: string | null): 'personal' | 'company' {
  if (!panNumber || typeof panNumber !== 'string') return 'personal';
  const clean = panNumber.trim().toUpperCase();
  if (clean.length < 4) return 'personal';
  const fourthChar = clean.charAt(3);
  if (fourthChar === 'P' || fourthChar === 'H') {
    return 'personal';
  }
  if (['C', 'F', 'A', 'T', 'B', 'L', 'J', 'G'].includes(fourthChar)) {
    return 'company';
  }
  return 'personal';
}

/**
 * De-duplicated single source of truth for KYC completeness check across numbers and KYC routes.
 * Branches on sub-account business_type:
 * - individual -> requires PAN + Aadhaar (GST is NOT required)
 * - company -> requires PAN + GST (Aadhaar is NOT required)
 * Fails closed if mock verification artifacts are detected on non-mock accounts.
 */
export async function checkRequiredKycDocumentsVerified(
  userId: string
): Promise<KycVerificationResult> {
  const [subAccount, docs] = await Promise.all([
    prisma.vobizSubAccount.findUnique({ where: { userId } }),
    prisma.kycDocument.findMany({ where: { userId } }),
  ]);

  const panDoc = docs.find((d) => d.documentType === 'pan');
  const gstDoc = docs.find((d) => d.documentType === 'gst');
  const aadhaarDoc = docs.find((d) => d.documentType === 'aadhaar');

  // Authoritative entity classification:
  // Statutory PAN category derived from NSDL rules is the single source of truth.
  // An individual PAN holder (4th character P/H) can NEVER bypass Aadhaar by declaring 'company'.
  let isCompany = false;
  if (panDoc) {
    const docCategory = panDoc.panNumber && !panDoc.panNumber.includes('*')
      ? derivePanCategory(panDoc.panNumber)
      : (panDoc.panType || '').toLowerCase();
    isCompany = docCategory === 'company';
  } else if (subAccount?.businessType) {
    isCompany = subAccount.businessType.toLowerCase() === 'company';
  }

  const businessType: 'individual' | 'company' = isCompany ? 'company' : 'individual';

  const requiredDocs = isCompany ? ['PAN', 'GST'] : ['PAN', 'Aadhaar'];
  const missing: string[] = [];

  const isMockSubAccount = subAccount?.authId?.startsWith('SA_MOCK_') ?? false;

  // Helper: check if doc is genuinely verified (not a mock timestamp rubber-stamp)
  const isDocGenuinelyVerified = (doc: typeof panDoc): boolean => {
    if (!doc || doc.status !== 'verified') return false;
    // If doc has a mock reference pattern, it was rubber-stamped without government lookup
    if (isMockVobizReference(doc.vobizReference)) return false;
    return true;
  };

  if (isCompany) {
    if (!isDocGenuinelyVerified(panDoc)) missing.push('PAN');
    if (!isDocGenuinelyVerified(gstDoc)) missing.push('GST');
  } else {
    if (!isDocGenuinelyVerified(panDoc)) missing.push('PAN');
    if (!isDocGenuinelyVerified(aadhaarDoc)) missing.push('Aadhaar');
  }

  if (missing.length > 0) {
    const errorMsg = `KYC verification required for ${businessType} account: ${missing.join(' and ')} document${
      missing.length > 1 ? 's' : ''
    } not verified. Please complete verification in Settings before selecting or claiming a phone number.`;

    return {
      verified: false,
      businessType,
      missing,
      requiredDocs,
      subAccountId: subAccount?.id,
      isMockSubAccount,
      error: errorMsg,
    };
  }

  return {
    verified: true,
    businessType,
    missing: [],
    requiredDocs,
    subAccountId: subAccount?.id,
    isMockSubAccount,
  };
}

/**
 * Dispatches notification when full KYC status elevates or changes.
 */
async function notifyFullKycApproved(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true },
    });
    if (!user) return;

    NotificationService.createInAppNotification({
      userId,
      message: '🎉 KYC Verification Approved: Your account verification with Vobiz is complete! You can now activate and use your phone numbers.',
      isImportant: true,
    });

    if (!user.email || !process.env.RESEND_API_KEY) return;

    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromAddress = process.env.RESEND_FROM_EMAIL || 'Claritiy Voice <notifications@claritiy.com>';

    await resend.emails.send({
      from: fromAddress,
      to: user.email,
      subject: 'Claritiy Voice — KYC Verification Approved! 🎉',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #0F172A;">
          <h2 style="color: #059669;">Claritiy Voice — KYC Verification Verified</h2>
          <p>Hello ${user.fullName || 'User'},</p>
          <p>Your account-level KYC verification with Vobiz has been successfully approved! You can now activate and use phone numbers directly in your dashboard.</p>
          <p style="margin-top: 24px; font-size: 12px; color: #64748B;">This is an automated notification from Claritiy Voice Enterprise Voice AI.</p>
        </div>
      `,
    }).catch((emailErr) => {
      logger.warn('KycVerificationService: Failed to dispatch approval email (non-fatal)', {
        userId,
        error: String(emailErr),
      });
    });
  } catch (err) {
    logger.warn('KycVerificationService: Error in notifyFullKycApproved (non-fatal)', {
      userId,
      error: String(err),
    });
  }
}

/**
 * Checks whether all required documents for the user's business_type are verified.
 * Never elevates if the sub-account is in mock mode or has mock references.
 * If verified: elevates subAccount.kycStatus to verified, activates numbers, and dispatches notifications.
 */
export async function checkAndApplyFullKycApproval(
  userId: string,
  subAccountId?: string
): Promise<{ approved: boolean; businessType: string; missing: string[]; error?: string }> {
  const result = await checkRequiredKycDocumentsVerified(userId);

  if (!result.verified) {
    logger.info('KYC: Incomplete documents for full KYC approval', {
      userId,
      businessType: result.businessType,
      missing: result.missing,
    });
    return {
      approved: false,
      businessType: result.businessType,
      missing: result.missing,
      error: result.error,
    };
  }

  // Never let a mock sub-account silently achieve verified status
  if (result.isMockSubAccount) {
    logger.warn('[KYC_SECURITY] Prevented full KYC approval on mock sub-account', {
      userId,
      subAccountId: result.subAccountId,
    });
    return {
      approved: false,
      businessType: result.businessType,
      missing: [],
      error: 'Cannot approve KYC on a mock sub-account. Live Vobiz credentials required.',
    };
  }

  const effectiveSubAccountId = subAccountId || result.subAccountId;
  if (!effectiveSubAccountId) {
    logger.warn('KYC: Cannot elevate sub-account kycStatus - subAccount row not found', { userId });
    return {
      approved: false,
      businessType: result.businessType,
      missing: [],
      error: 'Vobiz sub-account not found.',
    };
  }

  logger.info('KYC: All required documents verified for user. Elevating account status to verified', {
    userId,
    businessType: result.businessType,
    subAccountId: effectiveSubAccountId,
  });

  await prisma.vobizSubAccount.update({
    where: { id: effectiveSubAccountId },
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
  await notifyFullKycApproved(userId);

  await logAuditEvent({
    workspaceOwnerId: userId,
    actorUserId: userId,
    action: 'kyc.status_changed',
    targetId: effectiveSubAccountId,
    metadata: {
      status: 'verified',
      businessType: result.businessType,
      source: 'on_platform_document_verification',
    },
  });

  return {
    approved: true,
    businessType: result.businessType,
    missing: [],
  };
}
