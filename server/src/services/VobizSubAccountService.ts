import { prisma } from '../lib/prisma';
import { isPlatformAccount, normalizeKycStatus, vobizKycVerdict } from '../utils/kycStatus';
import { env } from '../config/env';
import { EncryptionService } from '../utils/EncryptionService';
import { logger } from '../utils/logger';
import { ProviderError } from '../types/errors';

/** kycMode of a local sub-account row that Vobiz says does not exist (never retried). */
export const SUB_ACCOUNT_MISSING_MODE = 'missing_at_carrier';

export class VobizSubAccountService {
  private readonly baseUrl: string;
  private readonly masterAuthId: string;
  private readonly masterAuthToken: string;

  constructor() {
    this.baseUrl = env.VOBIZ_API_URL || 'https://api.vobiz.ai';
    this.masterAuthId = (env.VOBIZ_AUTH_ID || 'MA_PLACEHOLDER').trim();
    this.masterAuthToken = (env.VOBIZ_AUTH_TOKEN || '').trim();
  }

  private get isMock(): boolean {
    return !this.masterAuthId || this.masterAuthId === 'MA_PLACEHOLDER' || this.masterAuthId.includes('placeholder');
  }

  // Item 10: In-memory promise mutex per userId to collapse concurrent requests into a single creation
  private static inFlightCreations = new Map<string, Promise<any>>();

  /**
   * Retrieves an existing sub-account for the user, or creates one via Vobiz API if it doesn't exist.
   * Checks database first to prevent duplicate sub-account creation on repeat number purchases.
   * Reprovisions legacy mock sub-accounts (SA_MOCK_) if real Vobiz credentials are now available.
   * Collapses concurrent requests for the same user into a single operation.
   */
  async getOrCreateSubAccount(userId: string, userEmail?: string) {
    const existing = await prisma.vobizSubAccount.findUnique({
      where: { userId },
    });

    if (existing) {
      // Item 9 repair path: If environment has real Vobiz credentials but record was created with SA_MOCK_, re-provision on live Vobiz
      if (!this.isMock && existing.authId.startsWith('SA_MOCK_')) {
        logger.warn('VobizSubAccountService: repairing legacy SA_MOCK_ sub-account in live environment', {
          userId,
          mockAuthId: existing.authId,
        });
        return this.repairMockSubAccount(existing.id, userId, userEmail);
      }

      logger.info('VobizSubAccountService: using existing sub-account', { userId, authId: existing.authId });
      return existing;
    }

    // Item 10: Check if another request in this process is already creating a sub-account for this userId
    const inFlight = VobizSubAccountService.inFlightCreations.get(userId);
    if (inFlight) {
      logger.info('VobizSubAccountService: waiting on concurrent sub-account creation in-flight', { userId });
      return inFlight;
    }

    const creationPromise = (async () => {
      try {
        return await this.createSubAccount(userId, userEmail);
      } finally {
        VobizSubAccountService.inFlightCreations.delete(userId);
      }
    })();

    VobizSubAccountService.inFlightCreations.set(userId, creationPromise);
    return creationPromise;
  }

  /**
   * Repairs an existing mock sub-account by provisioning real credentials on Vobiz
   * and updating the existing database record in-place.
   */
  async repairMockSubAccount(existingId: string, userId: string, userEmail?: string) {
    logger.info('VobizSubAccountService: re-provisioning mock sub-account on Vobiz', { existingId, userId });
    let effectiveName = userEmail;
    if (!effectiveName) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      effectiveName = user?.email || `user-${userId.substring(0, 8)}`;
    }

    let cleanBaseUrl = this.baseUrl.replace(/\/+$/, '').replace(/\/api\/v1$/i, '');
    const url = `${cleanBaseUrl}/api/v1/accounts/${this.masterAuthId}/sub-accounts/`;
    const body = VobizSubAccountService.createBody(effectiveName);

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Auth-ID': this.masterAuthId,
      'X-Auth-Token': this.masterAuthToken,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ProviderError('vobiz', `Repair subaccount failed on Vobiz (${response.status}): ${text}`);
    }

    const data = (await response.json()) as any;
    const subAuthId = data.sub_account?.auth_id || data.auth_credentials?.auth_id || data.auth_id;
    const subAuthToken = data.sub_account?.auth_token || data.auth_credentials?.auth_token || data.auth_token;

    if (!subAuthId || !subAuthToken) {
      throw new ProviderError('vobiz', 'Vobiz returned success for repair but missing sub-account credentials in payload');
    }

    const encryptedToken = EncryptionService.encrypt(subAuthToken);

    const repaired = await prisma.vobizSubAccount.update({
      where: { id: existingId },
      data: {
        authId: subAuthId,
        authToken: encryptedToken,
        kycMode: 'customer_use',
        kycStatus: 'pending',
        kycCallsBlocked: true,
        kycVerifiedAt: null,
      },
    });

    logger.info('VobizSubAccountService: successfully repaired mock sub-account on Vobiz', {
      userId,
      existingId,
      newAuthId: subAuthId,
    });

    return repaired;
  }

  /**
   * Provisions a new Sub-Account on Vobiz set with the user's email address as the sub-account name.
   */
  async createSubAccount(userId: string, userEmail?: string) {
    logger.info('VobizSubAccountService: provisioning new sub-account', { userId, userEmail, isMock: this.isMock });

    // Item 9: Throw loudly in production if Vobiz auth credentials are missing
    if (this.isMock) {
      if (process.env.NODE_ENV === 'production') {
        throw new ProviderError(
          'vobiz',
          'CRITICAL CONFIG ERROR: VOBIZ_AUTH_ID is not configured in production. Cannot create mock sub-accounts in production environment.'
        );
      }
    }

    let effectiveName = userEmail;
    if (!effectiveName) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      effectiveName = user?.email || `user-${userId.substring(0, 8)}`;
    }

    let subAuthId = '';
    let subAuthToken = '';

    if (this.isMock) {
      subAuthId = `SA_MOCK_${userId.replace(/-/g, '').substring(0, 16)}`;
      subAuthToken = `tok_mock_${Math.random().toString(36).substring(2, 15)}`;
    } else {
      let cleanBaseUrl = this.baseUrl.replace(/\/+$/, '').replace(/\/api\/v1$/i, '');
      const url = `${cleanBaseUrl}/api/v1/accounts/${this.masterAuthId}/sub-accounts/`;
      const body = VobizSubAccountService.createBody(effectiveName);

      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Auth-ID': this.masterAuthId,
        'X-Auth-Token': this.masterAuthToken,
      };

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new ProviderError('vobiz', `Create subaccount failed (${response.status}): ${text}`);
        }

        const data = (await response.json()) as any;
        subAuthId = data.sub_account?.auth_id || data.auth_credentials?.auth_id || data.auth_id;
        subAuthToken = data.sub_account?.auth_token || data.auth_credentials?.auth_token || data.auth_token;

        if (!subAuthId || !subAuthToken) {
          throw new ProviderError('vobiz', `Vobiz returned success but missing sub-account credentials in payload`);
        }

        // Credential self-test: make one cheap authenticated request with new credentials
        const testUrl = `${cleanBaseUrl}/api/v1/Account/${subAuthId}/Call/`;
        try {
          const testRes = await fetch(testUrl, {
            method: 'GET',
            headers: {
              'X-Auth-ID': subAuthId,
              'X-Auth-Token': subAuthToken,
              'Accept': 'application/json',
            },
          });
          if (testRes.status === 401 || testRes.status === 403) {
            logger.error('[ADMIN_ALERT][VOBIZ_CREDENTIALS_INVALID] Vobiz sub-account credentials rejected by Vobiz on creation self-test', {
              userId,
              subAuthId,
              statusCode: testRes.status,
            });
            throw new ProviderError('vobiz', `Newly created Vobiz sub-account failed credential validation (${testRes.status})`);
          }
        } catch (testErr) {
          if (testErr instanceof ProviderError) throw testErr;
          logger.warn('VobizSubAccountService: self-test network exception (continuing)', {
            subAuthId,
            error: testErr instanceof Error ? testErr.message : String(testErr),
          });
        }
      } catch (err) {
        if (err instanceof ProviderError) throw err;
        const message = err instanceof Error ? err.message : 'Unknown error';
        throw new ProviderError('vobiz', `Create subaccount error: ${message}`);
      }
    }

    const encryptedToken = EncryptionService.encrypt(subAuthToken);

    // Item 10: Database-level unique constraint race protection
    try {
      const subAccount = await prisma.vobizSubAccount.create({
        data: {
          userId,
          authId: subAuthId,
          authToken: encryptedToken,
          kycMode: 'customer_use',
          kycStatus: 'pending',
          kycCallsBlocked: true,
        },
      });

      logger.info('VobizSubAccountService: successfully provisioned sub-account with email name', {
        userId,
        subAuthId,
        name: effectiveName,
      });

      return subAccount;
    } catch (insertErr: any) {
      if (
        insertErr?.code === 'P2002' ||
        String(insertErr?.message || insertErr).includes('unique') ||
        String(insertErr?.message || insertErr).includes('UniqueConstraintViolation')
      ) {
        logger.warn('VobizSubAccountService: caught duplicate sub-account creation race condition (P2002), returning existing record', {
          userId,
          duplicateAuthId: subAuthId,
        });
        const existingAfterRace = await prisma.vobizSubAccount.findUnique({
          where: { userId },
        });
        if (existingAfterRace) {
          return existingAfterRace;
        }
      }
      throw insertErr;
    }
  }

  /**
   * Body for creating a user's sub-account. kyc_mode customer_use makes Vobiz require THIS user's own
   * KYC (PAN + Aadhaar, or PAN + GST/CIN) and block their calls until it is verified. Without it the
   * sub-account defaults to personal_use and inherits the master account's KYC (Vobiz docs: Create a
   * Subaccount). customer_use requires an email: Vobiz sends the KYC link there.
   */
  static createBody(email: string | undefined): Record<string, unknown> {
    const clean = String(email || '').trim();
    if (!clean || !clean.includes('@')) {
      throw new ProviderError('vobiz', 'A sub-account needs the customer email address for KYC.');
    }
    return { name: clean, email: clean, enabled: true, kyc_mode: 'customer_use' };
  }

  private apiBase(): string {
    return `${this.baseUrl.replace(/\/+$/, '').replace(/\/api\/v1$/i, '')}/api/v1`;
  }

  private masterHeaders(): Record<string, string> {
    return { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Auth-ID': this.masterAuthId, 'X-Auth-Token': this.masterAuthToken };
  }

  /** Vobiz's aggregated KYC state for one sub-account (documented: GET /sub-accounts/{SA}/kyc/status). */
  async fetchKycStatus(subAuthId: string): Promise<any | null> {
    if (this.isMock) return null;
    const res = await fetch(`${this.apiBase()}/sub-accounts/${encodeURIComponent(subAuthId)}/kyc/status`, { headers: this.masterHeaders() });
    if (!res.ok) {
      logger.warn('VobizSubAccountService: KYC status request failed', { subAuthId, status: res.status });
      return null;
    }
    return res.json();
  }

  /**
   * Switches an existing sub-account to customer_use so Vobiz verifies this user's own KYC
   * (documented: PUT /accounts/{MA}/sub-accounts/{SA} with email + kyc_mode). Vobiz re-derives
   * kyc_calls_blocked: an account whose own KYC is not complete is blocked until it is.
   * Returns true when Vobiz accepted the change.
   */
  async promoteToCustomerUse(subAccount: { id: string; userId: string; authId: string }, email: string): Promise<boolean> {
    if (this.isMock || subAccount.authId.startsWith('SA_MOCK_')) return false;
    const clean = String(email || '').trim();
    if (!clean.includes('@')) {
      logger.error('[ADMIN_ALERT][VOBIZ_KYC_MODE] cannot switch sub-account to customer_use: user has no email', { userId: subAccount.userId, subAuthId: subAccount.authId });
      return false;
    }
    const res = await fetch(`${this.apiBase()}/accounts/${this.masterAuthId}/sub-accounts/${encodeURIComponent(subAccount.authId)}`, {
      method: 'PUT',
      headers: this.masterHeaders(),
      body: JSON.stringify({ email: clean, kyc_mode: 'customer_use' }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (res.status === 404) {
        // The carrier has no such sub-account (e.g. a leftover test row): retrying every 30 minutes
        // can never succeed. Mark it once and stop; calls stay blocked for it (it cannot call anyway).
        await prisma.vobizSubAccount.update({ where: { id: subAccount.id }, data: { kycMode: SUB_ACCOUNT_MISSING_MODE, kycStatus: 'pending', kycCallsBlocked: true, kycVerifiedAt: null } }).catch(() => {});
        logger.error('[ADMIN_ALERT][VOBIZ_KYC_MODE] sub-account does not exist at Vobiz; marked missing_at_carrier and no longer retried', { userId: subAccount.userId, subAuthId: subAccount.authId });
        return false;
      }
      logger.error('[ADMIN_ALERT][VOBIZ_KYC_MODE] Vobiz refused switching sub-account to customer_use', { userId: subAccount.userId, subAuthId: subAccount.authId, status: res.status, body: text.slice(0, 300) });
      return false;
    }
    // Until refreshKyc reads Vobiz again, the account is not verified: an earlier "verified" was
    // only the inherited platform KYC.
    await prisma.vobizSubAccount.update({ where: { id: subAccount.id }, data: { kycMode: 'customer_use', kycStatus: 'pending', kycCallsBlocked: true, kycVerifiedAt: null } });
    return true;
  }

  /**
   * THE only writer of a user's KYC state. The customer's KYC page, the admin console's re-check,
   * the 5-minute poll, the carrier webhook and the calling-config sync all come through here, so the
   * customer and the admin console can never disagree. Reads Vobiz's documented status, applies
   * vobizKycVerdict (no sticky state: the carrier's latest answer wins), stores it with the
   * per-document result, mirrors it onto KYC-gated numbers, fills verified document references,
   * activates numbers, audits and notifies a change to verified/failed once.
   * Returns null (and changes nothing) when there is nothing to check or the carrier did not answer.
   */
  async refreshKyc(userId: string, source: string) {
    const sub = await prisma.vobizSubAccount.findUnique({ where: { userId }, include: { user: { select: { email: true, accountType: true } } } });
    if (!sub || this.isMock || sub.authId.startsWith('SA_MOCK_') || sub.kycMode === SUB_ACCOUNT_MISSING_MODE) return null;
    const platform = isPlatformAccount(sub.user);
    let data = await this.fetchKycStatus(sub.authId);
    if (data && !platform && data.kyc_mode !== 'customer_use' && await this.promoteToCustomerUse(sub, sub.user.email || '')) {
      data = await this.fetchKycStatus(sub.authId);
    }
    if (!data) return null;

    const v = vobizKycVerdict(data, platform);
    const changed = v.kycStatus !== sub.kycStatus;
    await prisma.$transaction([
      prisma.vobizSubAccount.update({
        where: { id: sub.id },
        data: {
          kycStatus: v.kycStatus,
          kycCallsBlocked: v.kycCallsBlocked,
          kycVerifications: v.verifications,
          kycCheckedAt: new Date(),
          ...(v.kycMode ? { kycMode: v.kycMode } : {}),
          ...(typeof data.business_type === 'string' && data.business_type ? { businessType: data.business_type } : {}),
          ...(changed || (v.kycStatus === 'verified' && !sub.kycVerifiedAt) ? { kycVerifiedAt: v.kycStatus === 'verified' ? new Date() : null } : {}),
        },
      }),
      prisma.phoneNumber.updateMany({ where: { userId, aadhaarRequired: true }, data: { kycStatus: v.kycStatus } }),
    ]);

    // The user's own documents Vobiz verified get a reference to that live result, so the number
    // gate and the KYC page agree (audit #7). Platform (inherited) KYC says nothing about documents.
    if (v.customerUse) {
      const { liveKycDocumentReference, isMockVobizReference } = await import('./KycVerificationService');
      for (const docType of ['pan', 'gst', 'aadhaar'] as const) {
        const ref = v.verifications[docType] === 'verified' ? liveKycDocumentReference(sub.authId, docType) : null;
        if (!ref) continue;
        const docs = await prisma.kycDocument.findMany({ where: { userId, documentType: docType }, select: { id: true, status: true, vobizReference: true, verifiedAt: true } });
        for (const d of docs) {
          if (d.status === 'verified' && !isMockVobizReference(d.vobizReference)) continue; // keep a genuine reference
          await prisma.kycDocument.updateMany({ where: { id: d.id, userId }, data: { status: 'verified', verifiedAt: d.verifiedAt || new Date(), vobizReference: ref } });
        }
      }
    }

    if (changed) {
      const { logAuditEvent } = await import('../utils/auditLogger');
      await logAuditEvent({
        workspaceOwnerId: userId,
        actorUserId: userId,
        action: 'kyc.status_changed',
        targetId: sub.authId,
        metadata: { status: v.kycStatus, previousStatus: sub.kycStatus, kycMode: v.kycMode, source },
      });
      if (v.kycStatus === 'verified' || v.kycStatus === 'failed') {
        const { notifyUserKycStatus } = await import('../routes/kyc');
        await notifyUserKycStatus(userId, v.kycStatus);
      }
    }
    const { PhoneNumberActivationService } = await import('./PhoneNumberActivationService');
    await PhoneNumberActivationService.evaluateAndActivateUserNumbers(userId, source);
    return { ...v, previous: sub.kycStatus, changed };
  }

  /**
   * Explicitly assigns a purchased phone number to a specific user sub-account on Vobiz.
   */
  async assignNumberToSubAccount(subAuthId: string, e164: string, numberId?: string) {
    logger.info('VobizSubAccountService: assigning DID number to sub-account', { subAuthId, e164, numberId });

    if (this.isMock) {
      return { success: true, message: 'Mock DID assignment successful' };
    }

    let cleanBaseUrl = this.baseUrl.replace(/\/+$/, '').replace(/\/api\/v1$/i, '');
    // Documented (Vobiz "Assign DID to Sub-Account"): lowercase /account/, the number URL-encoded
    // (+ as %2B), body { sub_account_id }. 200/204 = assigned.
    const documentedUrl = `${cleanBaseUrl}/api/v1/account/${this.masterAuthId}/numbers/${encodeURIComponent(e164)}/assign-subaccount`;
    const legacyUrl = `${cleanBaseUrl}/api/v1/accounts/${this.masterAuthId}/sub-accounts/${subAuthId}/numbers/assign`;

    const headers = {
      'Content-Type': 'application/json',
      'X-Auth-ID': this.masterAuthId,
      'X-Auth-Token': this.masterAuthToken,
    };

    try {
      let response = await fetch(documentedUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ sub_account_id: subAuthId }),
      });

      if (response.status === 405) {
        // Route used before the documented one; kept only as a logged fallback.
        logger.warn('VobizSubAccountService: documented assign-subaccount route refused (405); trying legacy route', { subAuthId, e164 });
        response = await fetch(legacyUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ number: e164, number_id: numberId, sub_account_auth_id: subAuthId }),
        });
      }

      logger.info('VobizSubAccountService: DID assignment response status', { status: response.status });
      return { success: response.ok, status: response.status };
    } catch (err) {
      logger.warn('VobizSubAccountService: DID assignment call warning', { error: String(err) });
      return { success: false, error: String(err) };
    }
  }

  /**
   * Scoped query listing phone numbers owned by or assigned to a specific sub-account.
   */
  async listSubAccountNumbers(subAuthId: string) {
    if (this.isMock) {
      return { success: true, numbers: [] };
    }

    let cleanBaseUrl = this.baseUrl.replace(/\/+$/, '').replace(/\/api\/v1$/i, '');
    const url = `${cleanBaseUrl}/api/v1/accounts/${this.masterAuthId}/sub-accounts/${subAuthId}/numbers/`;
    const headers = {
      'Content-Type': 'application/json',
      'X-Auth-ID': this.masterAuthId,
      'X-Auth-Token': this.masterAuthToken,
    };

    try {
      const res = await fetch(url, { headers });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch {}
      return { success: res.ok, status: res.status, data: data || text };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * Transfers balance from the partner master account to a sub-account's wallet.
   * NOTE: Explicitly NOT invoked during automatic number purchase per founder manual funding policy.
   */
  async transferBalance(subAuthId: string, amount: number, currency: string = 'INR') {
    logger.info('VobizSubAccountService: transferring balance (manual founder trigger)', { subAuthId, amount, currency });

    if (this.isMock) {
      return { success: true, message: 'Mock transfer successful' };
    }

    const url = `${this.baseUrl}/partner/accounts/${subAuthId}/transfer-balance`;
    const body = {
      amount,
      currency,
      description: 'Manual wallet funding'
    };

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Auth-ID': this.masterAuthId,
      'X-Auth-Token': this.masterAuthToken,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new ProviderError('vobiz', `Balance transfer failed (${response.status}): ${text}`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new ProviderError('vobiz', `Balance transfer error: ${message}`);
    }
  }

  /**
   * Makes sure a customer has a sub-account, then refreshes its KYC from Vobiz (refreshKyc).
   * FAIL-CLOSED: when the carrier does not answer, the stored state is returned unchanged.
   */
  async syncKycStatus(userId: string): Promise<{ kycStatus: string; isVerified: boolean; changed: boolean }> {
    if (this.isMock) return { kycStatus: 'pending', isVerified: false, changed: false };
    try {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, accountType: true } });
      if (!user) return { kycStatus: 'pending', isVerified: false, changed: false };
      if (!isPlatformAccount(user)) await this.getOrCreateSubAccount(userId, user.email);
      const r = await this.refreshKyc(userId, 'sync_kyc');
      const kycStatus = r?.kycStatus ?? normalizeKycStatus((await prisma.vobizSubAccount.findUnique({ where: { userId }, select: { kycStatus: true } }))?.kycStatus);
      return { kycStatus, isVerified: kycStatus === 'verified', changed: Boolean(r?.changed) };
    } catch (err) {
      logger.error('VobizSubAccountService: KYC sync failed (stored state unchanged)', { userId, error: String(err) });
      return { kycStatus: 'pending', isVerified: false, changed: false };
    }
  }
}
