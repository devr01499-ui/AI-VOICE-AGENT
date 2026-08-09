import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { EncryptionService } from '../utils/EncryptionService';
import { logger } from '../utils/logger';
import { ProviderError } from '../types/errors';

interface VobizSubAccountResponse {
  api_id: string;
  auth_id: string;
  auth_token: string;
  message: string;
}

export class VobizSubAccountService {
  private readonly baseUrl: string;
  private readonly masterAuthId: string;
  private readonly masterAuthToken: string;

  constructor() {
    this.baseUrl = env.VOBIZ_API_URL;
    this.masterAuthId = env.VOBIZ_AUTH_ID;
    this.masterAuthToken = env.VOBIZ_AUTH_TOKEN;
  }

  private get isMock(): boolean {
    return this.masterAuthId === 'MA_PLACEHOLDER' || this.masterAuthId.includes('placeholder');
  }

  /**
   * Retrieves an existing sub-account for the user, or creates one via Vobiz API if it doesn't exist.
   */
  async getOrCreateSubAccount(userId: string) {
    const existing = await prisma.vobizSubAccount.findUnique({
      where: { userId },
    });

    if (existing) {
      return existing;
    }

    return this.createSubAccount(userId);
  }

  /**
   * Provisions a new Sub-Account on Vobiz for the given user, encrypts the credentials, and saves them.
   */
  async createSubAccount(userId: string) {
    logger.info('VobizSubAccountService: provisioning new sub-account', { userId, isMock: this.isMock });

    let subAuthId = '';
    let subAuthToken = '';

    if (this.isMock) {
      // Mock sub-account creation
      subAuthId = `SA_MOCK_${userId.replace(/-/g, '').substring(0, 16)}`;
      subAuthToken = `tok_mock_${Math.random().toString(36).substring(2, 15)}`;
    } else {
      // Partner API endpoint for provisioning sub-accounts
      const url = `${this.baseUrl}/partner/accounts`;
      const body = {
        name: `Customer_${userId}`,
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

        const data = (await response.json()) as VobizSubAccountResponse;
        subAuthId = data.auth_id;
        subAuthToken = data.auth_token;
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

    logger.info('VobizSubAccountService: successfully provisioned sub-account', { userId, subAuthId });

    return subAccount;
  }

  /**
   * Transfers balance from the partner master account to a sub-account's wallet.
   */
  async transferBalance(subAuthId: string, amount: number, currency: string = 'USD') {
    logger.info('VobizSubAccountService: transferring balance', { subAuthId, amount, currency });

    if (this.isMock) {
      return { success: true, message: 'Mock transfer successful' };
    }

    const url = `${this.baseUrl}/partner/accounts/${subAuthId}/transfer-balance`;
    const body = {
      amount,
      currency,
      description: 'Initial balance funding'
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
}
