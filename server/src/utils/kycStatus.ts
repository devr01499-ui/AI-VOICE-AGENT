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
 * Next stored state. A verified account is never downgraded by a later sync or webhook (the
 * carrier sometimes reports intermediate states after approval); calls are blocked unless the
 * account is verified, or when the carrier explicitly says calls are blocked.
 */
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

export function nextKycState(
  current: string | null | undefined,
  incomingRaw: unknown,
  carrierCallsBlocked?: unknown,
): { kycStatus: KycState; kycCallsBlocked: boolean; changed: boolean } {
  const incoming = normalizeKycStatus(incomingRaw);
  const currentNorm = normalizeKycStatus(current);
  const kycStatus: KycState = currentNorm === 'verified' && incoming !== 'verified' ? 'verified' : incoming;
  const blockedByCarrier = typeof carrierCallsBlocked === 'boolean' ? carrierCallsBlocked : undefined;
  const kycCallsBlocked = kycStatus !== 'verified' || blockedByCarrier === true;
  return { kycStatus, kycCallsBlocked, changed: kycStatus !== current };
}
