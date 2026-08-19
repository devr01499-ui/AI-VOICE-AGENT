import { VobizIntegrationService } from './VobizIntegrationService';
import { ProviderError } from '../types/errors';

export interface VobizInventoryNumber {
  id: string;
  e164: string;
  country: string;
  region: string;
  status: string;
  setup_fee: number;
  monthly_fee: number;
  currency: string;
  capabilities?: { voice?: boolean; sms?: boolean; fax?: boolean };
  aadhaar_verification_required?: boolean;
}

export interface VobizInventoryResult {
  items: VobizInventoryNumber[];
  total: number;
  page: number;
  per_page: number;
  hasMore: boolean;
}

export class VobizInventoryService extends VobizIntegrationService {
  
  /**
   * Fetches live available numbers from Vobiz inventory with pagination support.
   */
  public async getAvailableNumbers(
    userId: string,
    filters: { country?: string; type?: string; region?: string; page?: number; per_page?: number }
  ): Promise<VobizInventoryResult> {
    const endpoint = `/api/v1/Account/${this.authId}/inventory/numbers`;

    const page = Math.max(1, filters.page || 1);
    const perPage = Math.max(1, filters.per_page || 20);

    const queryParams = new URLSearchParams();
    if (filters.country) queryParams.append('country', filters.country);
    if (filters.type) queryParams.append('number_type', filters.type);
    if (filters.region) queryParams.append('region', filters.region);
    queryParams.append('page', page.toString());
    queryParams.append('per_page', perPage.toString());

    const queryStr = queryParams.toString();
    const finalEndpoint = `${endpoint}?${queryStr}`;

    const response = await this.request<any>(
      'GET', 
      finalEndpoint, 
      undefined, 
      { userId }
    );

    if (!response?.success || !response?.data) {
      throw new ProviderError('vobiz', `Failed to fetch inventory from Vobiz: ${response?.error || 'Unknown Error'}`);
    }

    const responseData = response.data;
    let items: VobizInventoryNumber[] = [];
    let total = 0;

    if (Array.isArray(responseData)) {
      items = responseData;
      total = items.length;
    } else if (responseData && typeof responseData === 'object') {
      items = responseData.items || responseData.numbers || [];
      total = typeof responseData.total === 'number'
        ? responseData.total
        : (responseData.meta?.total || items.length);
    }

    // Ensure currency is correctly set on items if missing (default INR)
    items = items.map(item => ({
      ...item,
      currency: item.currency || 'INR',
    }));

    const hasMore = (page * perPage) < total || (items.length === perPage);

    return {
      items,
      total: Math.max(total, items.length),
      page,
      per_page: perPage,
      hasMore,
    };
  }

  /**
   * Fetches details of a specific number from inventory to validate price before purchase.
   */
  public async getNumberDetails(userId: string, numberId: string): Promise<VobizInventoryNumber> {
    // First, try the direct endpoint
    const endpoint = `/api/v1/Account/${this.authId}/inventory/numbers/${numberId}`;

    const response = await this.request<VobizInventoryNumber>(
      'GET', 
      endpoint, 
      undefined, 
      { userId }
    );
    
    // If the direct endpoint returns 404 or fails, fallback to fetching the inventory and finding it
    if (!response?.success || !response?.data) {
       const res = await this.getAvailableNumbers(userId, { per_page: 100 });
       const foundNumber = res.items.find(n => n.id === numberId);
       if (!foundNumber) {
         throw new ProviderError('vobiz', `Failed to fetch number details: Number ${numberId} not found in inventory.`);
       }
       return foundNumber;
    }

    const numberData = response.data as VobizInventoryNumber;
    return {
      ...numberData,
      currency: numberData.currency || 'INR',
    };
  }
}
