import { ADMIN_EMAIL } from '../config/constants';

/**
 * Single rule for the account-level KYC state (audit #2 and #17).
 *
 * Before this, `kycCallsBlocked` (default true) was never written as false anywhere, so every
 * non-admin call on the default carrier was refused even after KYC was verified. And the
 * `/kyc/status` sync stored the carrier's raw status ("approved"), which every `=== 'verified'`
 * check rejected, and could overwrite a verified account with a lower status.
 */
export type KycState = 'verified' | 'failed' | 'pending';

export function normalizeKycStatus(raw: unknown): KycState {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'verified' || s === 'approved') return 'verified';
  if (s === 'failed' || s === 'rejected') return 'failed';
  return 'pending';
}

/**
 * One-time repair (audit #2): accounts verified before this fix still carry the column default
 * kycCallsBlocked=true. Unblock verified accounts once; a later carrier sync re-applies a real block.
 * Idempotent (marker row in audit_logs) and safe to call at every boot.
 */
export async function repairVerifiedCallBlocks(): Promise<number> {
  const { prisma } = await import('../lib/prisma');
  const MARKER = 'maintenance.kyc_calls_unblocked_v1';
  const done = await prisma.auditLog.findFirst({ where: { action: MARKER }, select: { id: true } });
  if (done) return 0;
  const res = await prisma.vobizSubAccount.updateMany({
    where: { kycStatus: 'verified', kycCallsBlocked: true },
    data: { kycCallsBlocked: false },
  });
  const anyUser = await prisma.vobizSubAccount.findFirst({ select: { userId: true } });
  if (anyUser) {
    await prisma.auditLog.create({
      data: { workspaceOwnerId: anyUser.userId, actorUserId: anyUser.userId, action: MARKER, metadata: { repaired: res.count } },
    });
  }
  return res.count;
}

/**
 * One-time repair (audit #79): the old inbound switch stored status 'inactive' (blocking outbound
 * too). Restore those numbers to 'active' with inbound off. Render deploys with db push, which does
 * not run the migration's UPDATE, so the same statement runs here once.
 */
export async function repairInactiveInboundNumbers(): Promise<number> {
  const { prisma } = await import('../lib/prisma');
  const res = await prisma.phoneNumber.updateMany({
    where: { status: 'inactive' },
    data: { status: 'active', inboundEnabled: false },
  });
  return res.count;
}


/**
 * The platform's own account (the owner): its sub-account is personal_use and, as Vobiz documents,
 * inherits the platform's (parent account's) KYC. Every customer must pass their own KYC.
 */
export function isPlatformAccount(user: { accountType?: string | null; email?: string | null } | null | undefined): boolean {
  return user?.accountType === 'admin' || String(user?.email || '').trim().toLowerCase() === ADMIN_EMAIL;
}

export type KycVerifications = Record<'pan' | 'gst' | 'aadhaar' | 'cin', string>;

/**
 * THE KYC rule, read from Vobiz's documented answer (GET /sub-accounts/{SA}/kyc/status):
 *  - customer: verified only when kyc_mode is customer_use (their OWN KYC), overall_status is
 *    verified and kyc_calls_blocked is false; overall failed = failed; anything else = pending.
 *  - platform account: personal_use inherits the company's KYC, so verified only while Vobiz says
 *    its calls are not blocked (source 'company').
 * No "sticky" state: the carrier's latest answer is the truth, in both directions.
 */
export function vobizKycVerdict(data: any, platformAccount = false) {
  const kycMode: string | null = typeof data?.kyc_mode === 'string' ? data.kyc_mode : null;
  const customerUse = kycMode === 'customer_use';
  const inherited = platformAccount && kycMode === 'personal_use';
  const notBlocked = data?.kyc_calls_blocked === false;
  const overall = normalizeKycStatus(data?.overall_status ?? data?.kyc_status);
  const kycStatus: KycState = inherited
    ? (notBlocked ? 'verified' : 'pending')
    : !customerUse ? 'pending'
      : overall === 'failed' ? 'failed'
        : overall === 'verified' && notBlocked ? 'verified' : 'pending';
  const v = data?.verifications || {};
  const doc = (k: string) => String(v[k] || data?.[`${k}_status`] || 'not_started').toLowerCase();
  const verifications: KycVerifications = { pan: doc('pan'), gst: doc('gst'), aadhaar: doc('aadhaar'), cin: doc('cin') };
  return { kycStatus, kycCallsBlocked: kycStatus !== 'verified', customerUse, kycMode, source: inherited ? 'company' as const : 'own' as const, verifications };
}

type StoredKyc = {
  authId: string; kycMode: string; kycStatus: string; kycCallsBlocked: boolean; businessType: string;
  kycVerifiedAt: Date | null; kycCheckedAt?: Date | null; kycVerifications?: unknown;
};

/**
 * THE KYC reader. The customer dashboard and the admin console both show exactly this, built from
 * the one stored row that only VobizSubAccountService.refreshKyc writes.
 */
export function kycSummary(sub: StoredKyc | null | undefined, platformAccount: boolean) {
  if (!sub) {
    return { status: 'not_started' as const, callsBlocked: true, source: null, mode: null, businessType: null, verifiedAt: null, checkedAt: null, verifications: null, simulated: false };
  }
  const status = normalizeKycStatus(sub.kycStatus);
  return {
    status,
    callsBlocked: status !== 'verified' || sub.kycCallsBlocked,
    source: platformAccount && sub.kycMode === 'personal_use' ? 'company' as const : 'own' as const,
    mode: sub.kycMode,
    businessType: sub.businessType,
    verifiedAt: status === 'verified' ? sub.kycVerifiedAt : null,
    checkedAt: sub.kycCheckedAt ?? null,
    verifications: (sub.kycVerifications as KycVerifications | null) ?? null,
    simulated: sub.authId.startsWith('SA_MOCK_'),
  };
}
