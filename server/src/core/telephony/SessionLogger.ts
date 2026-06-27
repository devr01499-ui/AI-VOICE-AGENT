import { CallRepository } from '../../repositories/CallRepository';
import { metricsCollector } from '../provider-sdk/provider.metrics';
import { logger } from '../../utils/logger';

export class SessionLogger {
  /**
   * Logs session end-state, calculates cost metric elements, and saves metadata metrics to database.
   */
  static async logCallEnded(callId: string, reason: string, providerSessionId: string): Promise<void> {
    try {
      const metrics = providerSessionId ? metricsCollector.getMetrics(providerSessionId) : null;
      
      const durationSeconds = metrics ? Math.round(metrics.sessionDurationMs / 1000) : 0;

      // Mock Cost Calculation: $0.0002 / second, plus $0.005 / token
      const audioSeconds = durationSeconds;
      const inputTokens = metrics?.tokenUsage.inputTokens || 0;
      const outputTokens = metrics?.tokenUsage.outputTokens || 0;
      
      const costAmount = (audioSeconds * 0.0002) + ((inputTokens + outputTokens) * 0.00005);

      const metadata = {
        reason,
        metrics: metrics || undefined,
        costAmount,
      };

      // 1. Update Execution table metadata
      await CallRepository.updateExecution(callId, {
        outcome: reason === 'completed' || reason === 'user_hangup' ? 'successful' : 'unsuccessful',
        costBreakdown: JSON.stringify({
          telephonyCost: audioSeconds * 0.0001,
          aiCost: (inputTokens + outputTokens) * 0.00005,
          total: costAmount,
        }),
        metadata: JSON.stringify(metadata),
      });

      // 2. Update Call duration seconds
      await CallRepository.updateStatus(callId, reason === 'completed' || reason === 'user_hangup' ? 'completed' : 'failed', {
        durationSeconds,
      });

      logger.info('SessionLogger: recorded session end results', { callId, durationSeconds, costAmount });

    } catch (err) {
      logger.error('SessionLogger: failed to log call session metrics', {
        callId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
