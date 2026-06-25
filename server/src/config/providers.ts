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
import { GeminiLiveProvider } from '../providers/gemini/GeminiLiveProvider';
import { env } from './env';

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

  // ─── Realtime AI Provider ──────────────────────
  if (env.GEMINI_API_KEY || env.GOOGLE_API_KEY) {
    try {
      const gemini = new GeminiLiveProvider();
      await gemini.connect();
      manager.registerProvider(gemini);
      logger.info('Providers: Google Gemini Live initialized');
    } catch (err) {
      logger.error('Providers: Google Gemini Live initialization failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  } else if (env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAIRealtimeProvider();
      await openai.connect();
      manager.registerProvider(openai);
      logger.info('Providers: OpenAI Realtime initialized');
    } catch (err) {
      logger.error('Providers: OpenAI Realtime initialization failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  } else {
    logger.warn('Providers: No realtime AI provider key configured (GEMINI_API_KEY or OPENAI_API_KEY)');
    // Register GeminiLiveProvider as default fallback
    try {
      const gemini = new GeminiLiveProvider();
      manager.registerProvider(gemini);
    } catch {
      // Ignore
    }
  }

  const registered = manager.getRegisteredProviders();
  logger.info('Providers: initialization complete', {
    count: registered.length,
    providers: registered,
  });
}
