import { env } from '../config/env';
import { logger } from '../utils/logger';

export class VobizService {
  private static readonly baseUrl = env.VOBIZ_API_URL || 'https://api.vobiz.ai';
  private static readonly authId = env.VOBIZ_AUTH_ID;
  private static readonly authToken = env.VOBIZ_AUTH_TOKEN;

  /**
   * 1. Live Inventory Search
   * Fetches available DID numbers from Vobiz.
   */
  public static async getInventory(params: {
    country?: string;
    page?: number;
    per_page?: number;
    search?: string;
    exclude?: string;
  }) {
    const url = new URL(`${this.baseUrl}/api/v1/Account/${this.authId}/inventory/numbers`);
    
    url.searchParams.append('country', params.country || 'IN');
    url.searchParams.append('page', (params.page || 1).toString());
    url.searchParams.append('per_page', (params.per_page || 25).toString());
    if (params.search) url.searchParams.append('search', params.search);
    if (params.exclude) url.searchParams.append('exclude', params.exclude);

    return this.request('GET', url.toString());
  }

  /**
   * 2. Sub-Account Provisioning
   * Provisions a new Sub-Account on Vobiz.
   */
  public static async provisionSubAccount(orgIdPrefix: string, orgName: string) {
    const url = `${this.baseUrl}/api/v1/accounts/${this.authId}/sub-accounts`;
    
    const body = {
      name: `Org-${orgIdPrefix}-${orgName}`,
      description: `Tenant Sub-Account for ${orgName}`,
      permissions: { calls: true, cdr: true },
      rate_limit: 10,
      kyc_mode: "personal_use"
    };

    return this.request('POST', url, body);
  }

  /**
   * 3. DID Purchase from Inventory
   * Purchases a specific DID using its number_id.
   */
  public static async purchaseDid(numberId: string) {
    const url = `${this.baseUrl}/api/v1/Account/${this.authId}/number`;
    
    const body = {
      number_id: numberId,
      application_id: process.env.VOBIZ_APPLICATION_ID || ''
    };

    return this.request('POST', url, body);
  }

  /**
   * 4. Assign DID to Sub-Account
   * Assigns a purchased DID (E.164) to a sub-account.
   */
  public static async assignDidToSubAccount(subAuthId: string, purchasedE164: string) {
    const url = `${this.baseUrl}/api/v1/accounts/${this.authId}/sub-accounts/${subAuthId}/assign-number`;
    
    const body = {
      number_e164: purchasedE164
    };

    return this.request('POST', url, body);
  }

  /**
   * Helper to perform fetch requests with auth headers.
   */
  private static async request(method: string, url: string, body?: any) {
    if (!this.authId || !this.authToken) {
       logger.warn('VobizService: VOBIZ_AUTH_ID or VOBIZ_AUTH_TOKEN is missing. Request will fail.');
    }

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'X-Auth-ID': this.authId,
          'X-Auth-Token': this.authToken,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const responseText = await response.text();
      let responseData: any = {};
      try {
        if (responseText) {
          responseData = JSON.parse(responseText);
        }
      } catch (e) {
        responseData = { message: responseText };
      }

      if (!response.ok) {
        throw new Error(responseData?.error || responseData?.message || `Vobiz API Error: ${response.status}`);
      }

      return responseData;
    } catch (error) {
      logger.error(`VobizService request failed [${method}] ${url}`, { error: String(error) });
      throw error;
    }
  }
}
