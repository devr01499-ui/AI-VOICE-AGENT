/**
 * Bolna Server — Provider Manager
 *
 * Singleton registry for all external service providers. Components request
 * providers by name or role (telephony/realtime) rather than constructing
 * them directly, enabling clean dependency injection and testability.
 */

import { logger } from '../utils/logger';
import type {
  IBaseProvider,
  ITelephonyProvider,
  IRealtimeProvider,
  HealthCheckResult,
} from './interfaces/IProvider';

export class ProviderManager {
  private static _instance: ProviderManager | null = null;
  private readonly providers = new Map<string, IBaseProvider>();
  private telephonyProviderName: string | null = null;
  private realtimeProviderName: string | null = null;

  private constructor() {}

  /** Returns the singleton instance. */
  static get instance(): ProviderManager {
    if (!ProviderManager._instance) {
      ProviderManager._instance = new ProviderManager();
    }
    return ProviderManager._instance;
  }

  /** Registers a provider and optionally sets it as the default for its type. */
  registerProvider(provider: IBaseProvider): void {
    if (this.providers.has(provider.name)) {
      logger.warn('ProviderManager: overwriting existing provider', {
        name: provider.name,
      });
    }

    this.providers.set(provider.name, provider);

    if (provider.type === 'telephony' && !this.telephonyProviderName) {
      this.telephonyProviderName = provider.name;
    }
    if (provider.type === 'realtime' && !this.realtimeProviderName) {
      this.realtimeProviderName = provider.name;
    }

    logger.info('ProviderManager: provider registered', {
      name: provider.name,
      type: provider.type,
    });
  }

  /** Retrieves a provider by name, casting to the expected type. */
  getProvider<T extends IBaseProvider>(name: string): T {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`ProviderManager: provider '${name}' not registered`);
    }
    return provider as T;
  }

  /** Returns the default telephony provider. */
  getTelephonyProvider(): ITelephonyProvider {
    if (!this.telephonyProviderName) {
      throw new Error('ProviderManager: no telephony provider registered');
    }
    return this.getProvider<ITelephonyProvider>(this.telephonyProviderName);
  }

  /** Returns the default realtime provider. */
  getRealtimeProvider(): IRealtimeProvider {
    if (!this.realtimeProviderName) {
      throw new Error('ProviderManager: no realtime provider registered');
    }
    return this.getProvider<IRealtimeProvider>(this.realtimeProviderName);
  }

  /** Runs health checks on all registered providers concurrently. */
  async healthCheckAll(): Promise<Map<string, HealthCheckResult>> {
    const results = new Map<string, HealthCheckResult>();

    const entries = Array.from(this.providers.entries());
    const checks = entries.map(async ([name, provider]) => {
      try {
        const result = await provider.healthCheck();
        results.set(name, result);
      } catch (err) {
        results.set(name, {
          healthy: false,
          latencyMs: -1,
          details: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    });

    await Promise.all(checks);

    logger.info('ProviderManager: health check complete', {
      providers: entries.map(([name]) => name),
      results: Object.fromEntries(
        Array.from(results.entries()).map(([k, v]) => [k, v.healthy])
      ),
    });

    return results;
  }

  /** Returns all registered provider names. */
  getRegisteredProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /** Resets the singleton (for testing). */
  static reset(): void {
    ProviderManager._instance = null;
  }
}
