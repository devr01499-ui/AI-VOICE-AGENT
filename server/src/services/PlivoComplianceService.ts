import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { PlivoService } from '../core/telephony/PlivoService';
import { PhoneNumberActivationService } from './PhoneNumberActivationService';
import { NotificationService } from './NotificationService';

/**
 * Plivo India numbers are for registered businesses only (owner decision 2026-11-19). Plivo
 * documents India requirements for businesses (Registration Certificate = Certificate of
 * Incorporation or Udyam, plus GST Registration Certificate). The application is filed for the
 * customer's OWN Plivo subaccount, Plivo reviews it, and a number can be rented only against an
 * ACCEPTED application (otherwise Plivo answers 400). Individuals use the other carrier.
 */
export const MAX_COMPLIANCE_FILE_BYTES = 3 * 1024 * 1024; // two files must fit the 10 MB JSON limit
const PENDING = ['submitted', 'draft'];

export class ComplianceInputError extends Error {
  constructor(message: string) { super(message); this.name = 'ComplianceInputError'; }
}

/** Decodes an uploaded document and checks its real type from the bytes (PDF, PNG or JPEG only). */
export function readComplianceDocument(input: any, label: string): { name: string; mimeType: string; buffer: Buffer } {
  const b64 = typeof input?.contentBase64 === 'string' ? input.contentBase64.replace(/^data:[^;]+;base64,/, '') : '';
  if (!b64) throw new ComplianceInputError(`${label} is required.`);
  const buffer = Buffer.from(b64, 'base64');
  if (buffer.length === 0) throw new ComplianceInputError(`${label} is empty.`);
  if (buffer.length > MAX_COMPLIANCE_FILE_BYTES) throw new ComplianceInputError(`${label} is larger than 3 MB.`);
  let mimeType = '';
  if (buffer.subarray(0, 5).toString('latin1') === '%PDF-') mimeType = 'application/pdf';
  else if (buffer[0] === 0x89 && buffer.subarray(1, 4).toString('latin1') === 'PNG') mimeType = 'image/png';
  else if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) mimeType = 'image/jpeg';
  if (!mimeType) throw new ComplianceInputError(`${label} must be a PDF, PNG or JPEG file.`);
  const ext = mimeType === 'application/pdf' ? 'pdf' : mimeType === 'image/png' ? 'png' : 'jpg';
  const safeName = String(input?.name || label).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80) || label;
  return { name: /\.[a-z]{3,4}$/i.test(safeName) ? safeName : `${safeName}.${ext}`, mimeType, buffer };
}

function text(v: unknown, label: string, max = 200, required = true): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s && required) throw new ComplianceInputError(`${label} is required.`);
  if (s.length > max) throw new ComplianceInputError(`${label} is too long.`);
  return s;
}

function publicCallbackUrl(): string | undefined {
  const base = (env.PUBLIC_URL || process.env.PUBLIC_URL || '').replace(/\/+$/, '');
  return base.startsWith('https://') ? `${base}/api/v2/webhooks/plivo/compliance` : undefined;
}

export class PlivoComplianceService {
  constructor(private readonly plivo: PlivoService = new PlivoService()) {}

  async status(userId: string) {
    return prisma.plivoComplianceApplication.findUnique({ where: { userId } });
  }

  /** Files (or re-files after a rejection) the customer's business KYC with Plivo. */
  async submit(userId: string, body: any) {
    const existing = await this.status(userId);
    if (existing && (existing.status === 'accepted' || PENDING.includes(existing.status))) {
      throw new ComplianceInputError(existing.status === 'accepted' ? 'Your business is already verified.' : 'Your business verification is already under review.');
    }
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, fullName: true } });
    if (!user) throw new ComplianceInputError('User not found.');

    const businessName = text(body?.businessName, 'Business name (as on the certificates)', 255);
    const endUser = {
      name: businessName,
      email: text(body?.email || user.email, 'Email', 200),
      address_line1: text(body?.addressLine1, 'Address line 1', 200),
      address_line2: text(body?.addressLine2, 'Address line 2', 200, false) || undefined,
      city: text(body?.city, 'City', 100),
      state: text(body?.state, 'State', 100),
      postal_code: text(body?.postalCode, 'PIN code', 6),
      registration_number: text(body?.registrationNumber, 'CIN or Udyam number', 50, false) || undefined,
    };
    if (!/^[1-9][0-9]{5}$/.test(endUser.postal_code)) throw new ComplianceInputError('PIN code must be 6 digits.');
    const registrationFile = readComplianceDocument(body?.registrationCertificate, 'Certificate of Incorporation or Udyam certificate');
    const gstFile = readComplianceDocument(body?.gstCertificate, 'GST registration certificate');
    if (registrationFile.buffer.equals(gstFile.buffer)) throw new ComplianceInputError('Please upload two different documents.');

    const sub = await this.plivo.getOrCreateSubaccount(userId, user.fullName || user.email);
    const { complianceId } = await this.plivo.submitIndiaBusinessCompliance({
      subaccountAuthId: sub.authId,
      alias: `claritiy-${userId.slice(0, 8)}`,
      endUser,
      businessName,
      registrationFile,
      gstFile,
      callbackUrl: publicCallbackUrl(),
    });

    const row = await prisma.plivoComplianceApplication.upsert({
      where: { userId },
      create: { userId, complianceId, subaccountAuthId: sub.authId, businessName, status: 'submitted' },
      update: { complianceId, subaccountAuthId: sub.authId, businessName, status: 'submitted', rejectionReason: null },
    });
    logger.info('PlivoCompliance: business application submitted', { userId, complianceId });
    return row;
  }

  /** Reads the review state from Plivo and stores it; unlocks numbers once accepted. */
  async refresh(userId: string) {
    const app = await this.status(userId);
    if (!app) return null;
    const live = await this.plivo.getComplianceApplication(app.complianceId, app.subaccountAuthId);
    if (!live || (live.status === app.status && live.rejectionReason === app.rejectionReason)) return app;
    const updated = await prisma.plivoComplianceApplication.update({
      where: { id: app.id },
      data: { status: live.status, rejectionReason: live.rejectionReason },
    });
    if (live.status === 'accepted') {
      await prisma.phoneNumber.updateMany({ where: { userId, telephonyProvider: 'plivo' }, data: { kycStatus: 'verified' } });
      await PhoneNumberActivationService.evaluateAndActivateUserNumbers(userId, 'plivo_compliance');
    }
    if (live.status === 'accepted' || live.status === 'rejected') {
      await NotificationService.createInAppNotification({
        userId,
        type: 'KYC_STATUS',
        title: live.status === 'accepted' ? 'Business verified' : 'Business verification rejected',
        severity: live.status === 'accepted' ? 'info' : 'warning',
        message: live.status === 'accepted'
          ? 'Your business documents were accepted. You can now pick a business number.'
          : `Your business documents were rejected${live.rejectionReason ? `: ${live.rejectionReason}` : ''}. Please correct them and submit again.`,
      }).catch(() => {});
    }
    return updated;
  }

  /** The accepted application for this customer, refreshed from Plivo first. Null when none. */
  async acceptedApplication(userId: string) {
    const app = (await this.refresh(userId)) || (await this.status(userId));
    return app && app.status === 'accepted' ? app : null;
  }

  /** Background: refresh applications still under review. */
  async refreshPending(limit = 50): Promise<number> {
    const pending = await prisma.plivoComplianceApplication.findMany({ where: { status: { in: PENDING } }, select: { userId: true }, take: limit, orderBy: { updatedAt: 'asc' } });
    for (const p of pending) await this.refresh(p.userId).catch((err) => logger.warn('PlivoCompliance: refresh failed', { error: String(err) }));
    return pending.length;
  }
}

let timer: NodeJS.Timeout | null = null;
export function startPlivoCompliancePoll(intervalMs = 15 * 60 * 1000): void {
  if (timer) return;
  timer = setInterval(() => { new PlivoComplianceService().refreshPending().catch(() => {}); }, intervalMs);
  timer.unref?.();
}
