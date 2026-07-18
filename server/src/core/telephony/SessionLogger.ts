import { prisma } from '../../lib/prisma';
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
      const durationMinutes = durationSeconds / 60;

      const inputTokens = metrics?.tokenUsage.inputTokens || 0;
      const outputTokens = metrics?.tokenUsage.outputTokens || 0;
      
      // Calculate costs based on the strict cost sheet
      // Vobiz: 45 paise / minute
      const vobizCost = 0.45 * durationMinutes;
      // Gemini: weighted input/output tokens (paise conversion)
      const geminiInputCost = inputTokens * 0.006;  // approx rate per token in paise
      const geminiOutputCost = outputTokens * 0.025; // approx rate per token in paise
      const totalCost = vobizCost + geminiInputCost + geminiOutputCost;

      const metadata = {
        reason,
        metrics: metrics || undefined,
        costAmount: totalCost,
      };

      // 1. Update Execution table metadata
      await CallRepository.updateExecution(callId, {
        outcome: reason === 'completed' || reason === 'user_hangup' ? 'successful' : 'unsuccessful',
        costBreakdown: JSON.stringify({
          telephonyCost: vobizCost,
          aiCost: geminiInputCost + geminiOutputCost,
          total: totalCost,
        }),
        metadata: JSON.stringify(metadata),
      });

      // 2. Update Call duration seconds
      await CallRepository.updateStatus(callId, reason === 'completed' || reason === 'user_hangup' ? 'completed' : 'failed', {
        durationSeconds,
      });

      // 3. Atomically perform user-wise isolation and billing adjustments
      const call = await prisma.call.findUnique({
        where: { id: callId },
        select: { userId: true },
      });

      if (call?.userId) {
        // Deduct net cost from billing balance
        await prisma.user.update({
          where: { id: call.userId },
          data: {
            billingBalance: { decrement: totalCost }
          }
        });
        logger.info('SessionLogger: recorded user-wise session end results & balance deduction', { 
          callId, 
          userId: call.userId,
          durationMinutes, 
          totalCost 
        });
      }

    } catch (err) {
      logger.error('SessionLogger: failed to log call session metrics', {
        callId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
