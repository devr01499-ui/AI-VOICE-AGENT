import { VobizIntegrationService } from './VobizIntegrationService';

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
    // According to OpenAPI: /api/v1/inventory/numbers
    const endpoint = '/api/v1/inventory/numbers';
    
    // Construct query parameters safely
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

    if (!response.success || !response.data) {
      // Return empty array or throw based on preference. Throwing is safer for the UI to show an error.
      throw new Error(`Failed to fetch inventory from Vobiz: ${response.error}`);
    }

    // Usually APIs return paginated arrays or a data envelope
    if (Array.isArray(response.data)) {
        return response.data;
    }

    return response.data.numbers || [];
  }

  /**
   * Fetches details of a specific number from inventory to validate price before purchase.
   */
  public async getNumberDetails(userId: string, numberId: string): Promise<VobizInventoryNumber> {
    const endpoint = `/api/v1/inventory/numbers/${numberId}`;
    
    const response = await this.request<VobizInventoryNumber>(
      'GET', 
      endpoint, 
      undefined, 
      { userId }
    );

    if (!response.success || !response.data) {
      throw new Error(`Failed to fetch number details: ${response.error}`);
    }

    return response.data;
  }
}
