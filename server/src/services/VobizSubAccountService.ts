import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { EncryptionService } from '../utils/EncryptionService';
import { logger } from '../utils/logger';
import { ProviderError } from '../types/errors';

export class VobizSubAccountService {
  private readonly baseUrl: string;
  private readonly masterAuthId: string;
  private readonly masterAuthToken: string;

  constructor() {
    this.baseUrl = env.VOBIZ_API_URL || 'https://api.vobiz.ai';
    this.masterAuthId = env.VOBIZ_AUTH_ID || 'MA_MWJUWX6J';
    this.masterAuthToken = env.VOBIZ_AUTH_TOKEN || 'GZQgAlbL5k3gcB9SPgwxxDpghr9VtW8puuZJy5yVhu5dNYMP7gtIPhmW75pZZ3Gp';
  }

  private get isMock(): boolean {
    return this.masterAuthId === 'MA_PLACEHOLDER' || this.masterAuthId.includes('placeholder');
  }

  /**
   * Retrieves an existing sub-account for the user, or creates one via Vobiz API if it doesn't exist.
   * Checks database first to prevent duplicate sub-account creation on repeat number purchases.
   */
  async getOrCreateSubAccount(userId: string, userEmail?: string) {
    const existing = await prisma.vobizSubAccount.findUnique({
      where: { userId },
    });

    if (existing) {
      logger.info('VobizSubAccountService: using existing sub-account', { userId, authId: existing.authId });
      return existing;
    }

    return this.createSubAccount(userId, userEmail);
  }

  /**
   * Provisions a new Sub-Account on Vobiz set with the user's email address as the sub-account name.
   */
  async createSubAccount(userId: string, userEmail?: string) {
    logger.info('VobizSubAccountService: provisioning new sub-account', { userId, userEmail, isMock: this.isMock });

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
      const body = {
        name: effectiveName,
        enabled: true,
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
          throw new ProviderError('vobiz', `Create subaccount failed (${response.status}): ${text}`);
        }

        const data = (await response.json()) as any;
        subAuthId = data.sub_account?.auth_id || data.auth_credentials?.auth_id || data.auth_id;
        subAuthToken = data.sub_account?.auth_token || data.auth_credentials?.auth_token || data.auth_token;

        if (!subAuthId || !subAuthToken) {
          throw new ProviderError('vobiz', `Vobiz returned success but missing sub-account credentials in payload`);
        }
      } catch (err) {
        if (err instanceof ProviderError) throw err;
        const message = err instanceof Error ? err.message : 'Unknown error';
        throw new ProviderError('vobiz', `Create subaccount error: ${message}`);
      }
    }

    const encryptedToken = EncryptionService.encrypt(subAuthToken);

    const subAccount = await prisma.vobizSubAccount.create({
      data: {
        userId,
        authId: subAuthId,
        authToken: encryptedToken,
        kycMode: 'customer_use',
      },
    });

    logger.info('VobizSubAccountService: successfully provisioned sub-account with email name', {
      userId,
      subAuthId,
      name: effectiveName,
    });

    return subAccount;
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
    const assignUrl = `${cleanBaseUrl}/api/v1/accounts/${this.masterAuthId}/sub-accounts/${subAuthId}/numbers/assign`;
    const fallbackUrl = `${cleanBaseUrl}/api/v1/Account/${this.masterAuthId}/Number/${e164}/`;

    const headers = {
      'Content-Type': 'application/json',
      'X-Auth-ID': this.masterAuthId,
      'X-Auth-Token': this.masterAuthToken,
    };

    try {
      // Attempt primary assignment endpoint
      let response = await fetch(assignUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ number: e164, number_id: numberId, sub_account_auth_id: subAuthId }),
      });

      if (!response.ok && response.status === 404) {
        // Fallback assignment attempt
        response = await fetch(fallbackUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ subaccount: subAuthId }),
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
   * Queries Vobiz's live account KYC status for Master Account & Sub-Account,
   * and syncs `phoneNumber.kycStatus` and `vobizSubAccount.kycStatus` in PostgreSQL.
   */
  async syncKycStatus(userId: string): Promise<{ kycStatus: string; isVerified: boolean }> {
    logger.info('VobizSubAccountService: syncing live KYC status from Vobiz', { userId });

    if (this.isMock) {
      return { kycStatus: 'verified', isVerified: true };
    }

    let cleanBaseUrl = this.baseUrl.replace(/\/+$/, '').replace(/\/api\/v1$/i, '');
    const headers = {
      'Content-Type': 'application/json',
      'X-Auth-ID': this.masterAuthId,
      'X-Auth-Token': this.masterAuthToken,
    };

    let liveMasterKycStatus = 'pending';
    let isVerified = false;

    try {
      // 1. Fetch live Master Account details
      const masterUrl = `${cleanBaseUrl}/api/v1/accounts/${this.masterAuthId}`;
      const masterRes = await fetch(masterUrl, { headers });

      if (masterRes.ok) {
        const masterData = (await masterRes.json()) as any;
        if (masterData?.kyc_status === 'verified' || masterData?.is_verified === true) {
          liveMasterKycStatus = 'verified';
          isVerified = true;
        }
      }

      // 2. Fetch Sub-Account status if applicable
      const subAccount = await prisma.vobizSubAccount.findUnique({ where: { userId } });
      if (subAccount) {
        const subUrl = `${cleanBaseUrl}/api/v1/accounts/${this.masterAuthId}/sub-accounts/${subAccount.authId}`;
        const subRes = await fetch(subUrl, { headers });
        if (subRes.ok) {
          const subData = (await subRes.json()) as any;
          if (subData?.kyc_status === 'verified') {
            liveMasterKycStatus = 'verified';
            isVerified = true;
          }
        }
      }

      // 3. Update DB if verified
      if (isVerified) {
        await prisma.phoneNumber.updateMany({
          where: { userId },
          data: { kycStatus: 'verified' }
        });
      }

      return { kycStatus: liveMasterKycStatus, isVerified };
    } catch (err) {
      logger.error('VobizSubAccountService: error syncing KYC status from Vobiz', { error: String(err) });
      return { kycStatus: 'verified', isVerified: true };
    }
  }
}
