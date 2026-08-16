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
    const endpoint = `/api/v1/Account/${this.authId}/phone_numbers/inventory`;

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

    const responseData = response.data as any;

    if (Array.isArray(responseData)) {
        return responseData;
    }

    return responseData.items || responseData.numbers || [];

  }

  /**
   * Fetches details of a specific number from inventory to validate price before purchase.
   */
  public async getNumberDetails(userId: string, numberId: string): Promise<VobizInventoryNumber> {
    // There is no direct endpoint to fetch a single number from inventory in the docs.
    // We must query the inventory and filter by ID.
    // In a real scenario we'd query by the actual number, but assuming numberId is the e164 or id.
    const available = await this.getAvailableNumbers(userId, {});
    const numberDetails = available.find(n => n.id === numberId || n.e164 === numberId);
    
    if (!numberDetails) {
      throw new ProviderError('vobiz', `Number details not found for ID: ${numberId}`);
    }

    return numberDetails;
  }
}
