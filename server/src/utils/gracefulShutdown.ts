/**
 * Claritiy Voice Server — Graceful Shutdown & Drain State Machine (Task T5)
 *
 * Provides connection draining logic for SIGTERM / deploys, allowing live
 * calls to complete naturally without dropped calls.
 */

import { logger } from './logger';

export interface DrainOptions {
  timeoutSeconds?: number;
  checkIntervalMs?: number;
  getActiveCount: () => number;
  onLog?: (activeCount: number, remainingSeconds: number) => void;
}

export async function drainActiveCalls(options: DrainOptions): Promise<{ drainedCleanly: boolean; remainingCalls: number }> {
  const rawTimeout = options.timeoutSeconds ?? parseInt(process.env.SHUTDOWN_DRAIN_SECONDS || '90', 10);
  const timeoutSeconds = Math.max(30, Math.min(180, isNaN(rawTimeout) ? 90 : rawTimeout));
  const checkIntervalMs = options.checkIntervalMs ?? 5000;
  const deadline = Date.now() + timeoutSeconds * 1000;

  while (Date.now() < deadline) {
    const active = options.getActiveCount();
    const remainingSeconds = Math.max(0, Math.round((deadline - Date.now()) / 1000));

    if (options.onLog) {
      options.onLog(active, remainingSeconds);
    } else {
      logger.info(`Claritiy Voice Server: draining active calls... [active=${active}, remainingDrainSec=${remainingSeconds}]`);
    }

    if (active === 0) {
      return { drainedCleanly: true, remainingCalls: 0 };
    }

    // Wait until next poll or deadline, whichever is smaller
    const waitMs = Math.min(checkIntervalMs, Math.max(10, deadline - Date.now()));
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const finalActive = options.getActiveCount();
  return { drainedCleanly: finalActive === 0, remainingCalls: finalActive };
}
