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
}

export class VobizInventoryService extends VobizIntegrationService {
  
  /**
   * Fetches live available numbers from Vobiz inventory
   */
  public async getAvailableNumbers(
    userId: string,
    filters: { country?: string, type?: string, region?: string }
  ): Promise<VobizInventoryNumber[]> {
    const endpoint = `/api/v1/Account/${this.authId}/inventory/numbers`;

    const queryParams = new URLSearchParams();
    if (filters.country) queryParams.append('country', filters.country);
    if (filters.type) queryParams.append('number_type', filters.type);
    if (filters.region) queryParams.append('region', filters.region);
    
    const queryStr = queryParams.toString();
    const finalEndpoint = queryStr ? `${endpoint}?${queryStr}` : endpoint;

    const response = await this.request<{ numbers: VobizInventoryNumber[] }>(
      'GET', 
      finalEndpoint, 
      undefined, 
      { userId }
    );

    if (!response?.success || !response?.data) {
      throw new ProviderError('vobiz', `Failed to fetch inventory from Vobiz: ${response?.error || 'Unknown Error'}`);
    }

    const responseData = response.data as { items?: VobizInventoryNumber[], numbers?: VobizInventoryNumber[] };

    if (Array.isArray(responseData)) {
        return responseData;
    }

    return responseData.items || responseData.numbers || [];
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
       const allNumbers = await this.getAvailableNumbers(userId, {});
       const foundNumber = allNumbers.find(n => n.id === numberId);
       if (!foundNumber) {
         throw new ProviderError('vobiz', `Failed to fetch number details: Number ${numberId} not found in inventory.`);
       }
       return foundNumber;
    }

    return response.data;
  }
}
