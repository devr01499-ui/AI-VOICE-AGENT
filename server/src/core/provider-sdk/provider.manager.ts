import { IRealtimeProviderSDK } from './provider.interface';
import { ProviderFactory } from './provider.factory';
import { ProviderSessionConfig, ProviderEventCallbacks } from './provider.types';
import { HealthCheckResult } from '../../providers/interfaces/IProvider';
import { logger } from '../../utils/logger';

export class ProviderManagerSDK {
  private static _instance: ProviderManagerSDK | null = null;
  private readonly providers = new Map<string, IRealtimeProviderSDK>();
  private readonly activeProviderSessions = new Map<string, string>(); // Maps sessionId -> providerName

  private constructor() {}

  static get instance(): ProviderManagerSDK {
    if (!ProviderManagerSDK._instance) {
      ProviderManagerSDK._instance = new ProviderManagerSDK();
    }
    return ProviderManagerSDK._instance;
  }

  /**
   * Resolves or creates a concrete provider instance.
   */
  getProvider(providerName: string): IRealtimeProviderSDK {
    let provider = this.providers.get(providerName);
    if (!provider) {
      provider = ProviderFactory.create(providerName);
      this.providers.set(providerName, provider);
    }
    return provider;
  }

  /**
   * Orchestrates a provider session.
   */
  async startSession(
    providerName: string,
    callId: string,
    config: ProviderSessionConfig,
    callbacks: ProviderEventCallbacks
  ): Promise<string> {
    const provider = this.getProvider(providerName);
    await provider.initialize();
    await provider.connect();

    const sessionId = await provider.startSession(callId, config, callbacks);
    this.activeProviderSessions.set(sessionId, providerName);
    return sessionId;
  }

  async endSession(sessionId: string): Promise<void> {
    const providerName = this.activeProviderSessions.get(sessionId);
    if (!providerName) {
      logger.warn('ProviderManagerSDK: endSession called for unknown session', { sessionId });
      return;
    }

    const provider = this.getProvider(providerName);
    await provider.endSession(sessionId);
    this.activeProviderSessions.delete(sessionId);
  }

  sendAudio(sessionId: string, audioBase64: string): void {
    const providerName = this.activeProviderSessions.get(sessionId);
    if (providerName) {
      this.getProvider(providerName).sendAudio(sessionId, audioBase64);
    }
  }

  sendText(sessionId: string, text: string): void {
    const providerName = this.activeProviderSessions.get(sessionId);
    if (providerName) {
      this.getProvider(providerName).sendText(sessionId, text);
    }
  }

  interrupt(sessionId: string): void {
    const providerName = this.activeProviderSessions.get(sessionId);
    if (providerName) {
      this.getProvider(providerName).interrupt(sessionId);
    }
  }

  async healthCheckAll(): Promise<Map<string, HealthCheckResult>> {
    const results = new Map<string, HealthCheckResult>();
    const providerTypes = ['gemini'];

    for (const name of providerTypes) {
      try {
        const provider = this.getProvider(name);
        const health = await provider.healthCheck();
        results.set(name, health);
      } catch (err) {
        results.set(name, {
          healthy: false,
          latencyMs: 0,
          details: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return results;
  }
}

export const providerManagerSDK = ProviderManagerSDK.instance;
