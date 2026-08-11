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
    const candidates = [
      `/api/v1/account/${this.authId}/inventory/numbers`, // lowercase account
      `/api/v1/Account/${this.authId}/inventory/numbers`, // uppercase Account
      `/v1/Account/${this.authId}/inventory/numbers`,     // missing /api
      `/v1/account/${this.authId}/inventory/numbers`,     // missing /api + lowercase
      `/api/v1/inventory/numbers`,                        // global path
      `/api/v2/Account/${this.authId}/inventory/numbers`, // v2 version
      `/api/v1/numbers/inventory`                         // flipped path
    ];

    let lastResponse: any = null;

    for (const endpoint of candidates) {
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

      lastResponse = response;

      // If we got a 200 OK, or any error OTHER than 404 Not Found, we hit a real endpoint!
      if (response.success || response.statusCode !== 404) {
        break; 
      }
    }

    if (!lastResponse?.success || !lastResponse?.data) {
      throw new ProviderError('vobiz', `Failed to fetch inventory from Vobiz: ${lastResponse?.error || 'All endpoints returned 404'}`);
    }

    const responseData = lastResponse.data as any;

    if (Array.isArray(responseData)) {
        return responseData;
    }

    return responseData.numbers || [];

  }

  /**
   * Fetches details of a specific number from inventory to validate price before purchase.
   */
  public async getNumberDetails(userId: string, numberId: string): Promise<VobizInventoryNumber> {
    const candidates = [
      `/api/v1/account/${this.authId}/inventory/numbers/${numberId}`, 
      `/api/v1/Account/${this.authId}/inventory/numbers/${numberId}`, 
      `/v1/Account/${this.authId}/inventory/numbers/${numberId}`,     
      `/v1/account/${this.authId}/inventory/numbers/${numberId}`,     
      `/api/v1/inventory/numbers/${numberId}`,                        
      `/api/v2/Account/${this.authId}/inventory/numbers/${numberId}`, 
      `/api/v1/numbers/inventory/${numberId}`                         
    ];

    let lastResponse: any = null;

    for (const endpoint of candidates) {
      const response = await this.request<VobizInventoryNumber>(
        'GET', 
        endpoint, 
        undefined, 
        { userId }
      );
      
      lastResponse = response;
      if (response.success || response.statusCode !== 404) break;
    }

    if (!lastResponse?.success || !lastResponse?.data) {
      throw new ProviderError('vobiz', `Failed to fetch number details: ${lastResponse?.error || 'All endpoints returned 404'}`);
    }

    return lastResponse.data;
  }
}
