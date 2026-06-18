/**
 * Bolna Server — Vobiz Telephony Provider
 *
 * REST client for the Vobiz voice API. Handles outbound call placement,
 * termination, and status polling. All failures are wrapped in ProviderError
 * for consistent upstream handling.
 */

import { logger } from '../../utils/logger';
import { ProviderError } from '../../types/errors';
import { env } from '../../config/env';
import { v4 as uuidv4 } from 'uuid';
import type {
  ITelephonyProvider,
  HealthCheckResult,
  InitiateCallParams,
  InitiateCallResult,
  CallStatusResult,
} from '../interfaces/IProvider';

interface VobizCallResponse {
  api_id: string;
  request_uuid: string;
  message: string;
}

interface VobizCallStatusResponse {
  api_id: string;
  call_uuid: string;
  direction: string;
  call_status: string;
  duration?: number;
}

export class VobizProvider implements ITelephonyProvider {
  public readonly name = 'vobiz';
  public readonly type = 'telephony';

  private readonly baseUrl: string;
  private readonly authId: string;
  private readonly authToken: string;

  constructor() {
    this.baseUrl = env.VOBIZ_API_URL;
    this.authId = env.VOBIZ_AUTH_ID;
    this.authToken = env.VOBIZ_AUTH_TOKEN;
  }

  private get isMock(): boolean {
    return this.authId === 'MA_PLACEHOLDER' || this.authId.includes('placeholder');
  }

  /** Validates API credentials on startup. */
  async connect(): Promise<void> {
    logger.info('VobizProvider: connecting...', { baseUrl: this.baseUrl, isMock: this.isMock });
    const health = await this.healthCheck();
    if (!health.healthy) {
      throw new ProviderError('vobiz', 'Failed to connect — health check failed');
    }
    logger.info('VobizProvider: connected', { latencyMs: health.latencyMs, isMock: this.isMock });
  }

  async disconnect(): Promise<void> {
    logger.info('VobizProvider: disconnected');
  }

  /** Pings the Vobiz account endpoint to verify credentials. */
  async healthCheck(): Promise<HealthCheckResult> {
    if (this.isMock) {
      return {
        healthy: true,
        latencyMs: 1,
        details: 'Mock Mode: Health check bypassed.',
      };
    }

    const start = Date.now();
    try {
      const response = await fetch(
        `${this.baseUrl}/Account/${this.authId}/`,
        { method: 'GET', headers: this.buildHeaders() }
      );
      const latencyMs = Date.now() - start;

      if (response.ok) {
        return { healthy: true, latencyMs };
      }

      return {
        healthy: false,
        latencyMs,
        details: `Vobiz responded with status ${response.status}`,
      };
    } catch (err) {
      const latencyMs = Date.now() - start;
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { healthy: false, latencyMs, details: message };
    }
  }

  /** Places an outbound call via Vobiz REST API. */
  async initiateCall(params: InitiateCallParams): Promise<InitiateCallResult> {
    if (this.isMock) {
      const mockUuid = `mock-call-${uuidv4()}`;
      logger.info('VobizProvider: initiating mock call', {
        to: params.to,
        from: params.from,
        answerUrl: params.answerUrl,
        callUuid: mockUuid,
      });

      // Simulate a webhook call asynchronously to transition state to connected/in_progress
      // and simulate the call flow in dev environments.
      setTimeout(async () => {
        try {
          logger.info('VobizProvider [Mock]: simulating incoming answer callback', {
            callUuid: mockUuid,
            answerUrl: params.answerUrl,
          });

          const res = await fetch(params.answerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              call_uuid: mockUuid,
              event: 'answer',
            }),
          });
          
          if (res.ok) {
            logger.info('VobizProvider [Mock]: simulated answer callback succeeded');
          } else {
            logger.warn('VobizProvider [Mock]: simulated answer callback failed', {
              status: res.status,
            });
          }
        } catch (err) {
          logger.error('VobizProvider [Mock]: failed to simulate answer callback', {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }, 1500);

      return {
        callUuid: mockUuid,
        requestUuid: mockUuid,
      };
    }

    const url = `${this.baseUrl}/Account/${this.authId}/Call/`;
    const body = {
      from: params.from,
      to: params.to,
      answer_url: params.answerUrl,
      answer_method: 'POST',
      ...(params.ringUrl && { ring_url: params.ringUrl, ring_method: 'POST' }),
      ...(params.hangupUrl && { hangup_url: params.hangupUrl, hangup_method: 'POST' }),
    };

    logger.info('VobizProvider: initiating call', {
      to: params.to,
      from: params.from,
      answerUrl: params.answerUrl,
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new ProviderError(
          'vobiz',
          `Initiate call failed (${response.status}): ${text}`
        );
      }

      const data = (await response.json()) as VobizCallResponse;

      logger.info('VobizProvider: call initiated', {
        requestUuid: data.request_uuid,
      });

      return {
        callUuid: data.request_uuid,
        requestUuid: data.request_uuid,
      };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new ProviderError('vobiz', `Initiate call error: ${message}`);
    }
  }

  /** Hangs up an active call. */
  async terminateCall(callUuid: string): Promise<void> {
    if (this.isMock) {
      logger.info('VobizProvider: terminating mock call', { callUuid });
      return;
    }

    const url = `${this.baseUrl}/Account/${this.authId}/Call/${callUuid}/`;

    logger.info('VobizProvider: terminating call', { callUuid });

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: this.buildHeaders(),
      });

      if (!response.ok && response.status !== 404) {
        const text = await response.text();
        throw new ProviderError(
          'vobiz',
          `Terminate call failed (${response.status}): ${text}`
        );
      }

      logger.info('VobizProvider: call terminated', { callUuid });
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new ProviderError('vobiz', `Terminate call error: ${message}`);
    }
  }

  /** Queries the status of a specific call. */
  async getCallStatus(callUuid: string): Promise<CallStatusResult> {
    if (this.isMock) {
      return {
        status: 'completed',
        direction: 'outbound',
        duration: 10,
      };
    }

    const url = `${this.baseUrl}/Account/${this.authId}/Call/${callUuid}/`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new ProviderError(
          'vobiz',
          `Get call status failed (${response.status}): ${text}`
        );
      }

      const data = (await response.json()) as VobizCallStatusResponse;

      return {
        status: data.call_status,
        direction: data.direction,
        duration: data.duration,
      };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new ProviderError('vobiz', `Get call status error: ${message}`);
    }
  }

  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Auth-ID': this.authId,
      'X-Auth-Token': this.authToken,
    };
  }
}
