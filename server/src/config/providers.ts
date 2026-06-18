/**
 * Bolna Server — Provider Initialization
 *
 * Instantiates all external service providers and registers them with
 * the ProviderManager singleton. Called once during server bootstrap.
 * Provider connect() is invoked here; failures are surfaced early.
 */

import { logger } from '../utils/logger';
import { ProviderManager } from '../providers/ProviderManager';
import { VobizProvider } from '../providers/vobiz/VobizProvider';
import { OpenAIRealtimeProvider } from '../providers/openai/OpenAIRealtimeProvider';

/**
 * Initializes all providers and registers them with the ProviderManager.
 * Should be called once during server startup. Logs success or failure
 * for each provider independently so partial availability is visible.
 */
export async function initializeProviders(): Promise<void> {
  const manager = ProviderManager.instance;

  // ─── Vobiz Telephony ───────────────────────────
  try {
    const vobiz = new VobizProvider();
    await vobiz.connect();
    manager.registerProvider(vobiz);
    logger.info('Providers: Vobiz telephony initialized');
  } catch (err) {
    logger.error('Providers: Vobiz initialization failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    // Non-fatal: server can start without telephony for API development
  }

  // ─── OpenAI Realtime ───────────────────────────
  try {
    const openai = new OpenAIRealtimeProvider();
    await openai.connect();
    manager.registerProvider(openai);
    logger.info('Providers: OpenAI Realtime initialized');
  } catch (err) {
    logger.error('Providers: OpenAI Realtime initialization failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    // Non-fatal: server can start without realtime for API development
  }

  const registered = manager.getRegisteredProviders();
  logger.info('Providers: initialization complete', {
    count: registered.length,
    providers: registered,
  });
}
