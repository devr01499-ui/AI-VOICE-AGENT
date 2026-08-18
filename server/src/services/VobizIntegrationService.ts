import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

export interface VobizApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

export class VobizIntegrationService {
  protected baseUrl: string;
  protected authId: string;
  protected authToken: string;

  constructor() {
    let url = (env.VOBIZ_API_URL || 'https://api.vobiz.ai').trim();
    if (!url) url = 'https://api.vobiz.ai';
    url = url.replace(/\/+$/, '').replace(/\/api\/v1$/i, '');
    this.baseUrl = url;

    this.authId = (env.VOBIZ_AUTH_ID || '').trim();
    this.authToken = (env.VOBIZ_AUTH_TOKEN || '').trim();

    if (!this.authId || !this.authToken) {
      logger.warn('VobizIntegrationService: VOBIZ_AUTH_ID or VOBIZ_AUTH_TOKEN is missing. Vobiz API calls will fail.');
    }
  }

  /**
   * Executes a standardized API request to Vobiz, complete with audit logging.
   */
  public async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: any,
    options: { userId?: string, organizationId?: string } = {}
  ): Promise<VobizApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    // Attempt the request
    let response: Response;
    const start = Date.now();
    try {
      response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-ID': this.authId,
          'X-Auth-Token': this.authToken,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      logger.error(`VobizIntegrationService: Network Error [${method}] ${url}`, { error: String(err) });
      await this.logAudit({
        operation: `vobiz_${method}_network_err`,
        status: 'failed',
        errorMessage: String(err),
        userId: options.userId,
        organizationId: options.organizationId
      });
      return { success: false, error: 'Network Error reaching Vobiz' };
    }

    const providerRequestId = response.headers.get('x-request-id') || 'unknown';
    
    let responseData: any = {};
    const textData = await response.text();
    try {
      if (textData) {
         responseData = JSON.parse(textData);
      }
    } catch (e) {
      responseData = { message: textData };
    }

    const duration = Date.now() - start;

    if (!response.ok) {
      logger.error(`VobizIntegrationService: Provider Error [${response.status}]`, {
        url,
        providerRequestId,
        error: responseData
      });

      await this.logAudit({
        operation: `vobiz_${method}_${endpoint.split('/')[1] || 'req'}`,
        status: 'failed',
        errorCode: String(response.status),
        errorMessage: typeof responseData === 'object' ? JSON.stringify(responseData) : String(responseData),
        requestId: providerRequestId,
        userId: options.userId,
        organizationId: options.organizationId
      });

      let parsedError = responseData?.message;
      if (!parsedError && responseData?.error) {
        if (typeof responseData.error === 'string') {
          parsedError = responseData.error;
        } else if (typeof responseData.error === 'object') {
          parsedError = responseData.error.message || JSON.stringify(responseData.error);
        }
      }

      return {
        success: false,
        statusCode: response.status,
        error: parsedError || 'Unknown Vobiz API Error'
      };
    }

    await this.logAudit({
        operation: `vobiz_${method}_${endpoint.split('/')[1] || 'req'}`,
        status: 'success',
        requestId: providerRequestId,
        userId: options.userId,
        organizationId: options.organizationId
    });

    return {
      success: true,
      statusCode: response.status,
      data: responseData as T
    };
  }

  private async logAudit(params: {
    operation: string,
    status: string,
    errorCode?: string,
    errorMessage?: string,
    requestId?: string,
    userId?: string,
    organizationId?: string,
  }) {
    try {
      await prisma.integrationAuditLog.create({
        data: {
          provider: 'vobiz',
          operation: params.operation,
          status: params.status,
          errorCode: params.errorCode,
          errorMessage: params.errorMessage,
          requestId: params.requestId,
          userId: params.userId,
          organizationId: params.organizationId,
        }
      });
    } catch (dbErr) {
      logger.error('VobizIntegrationService: Failed to write audit log', { error: String(dbErr) });
    }
  }
}
