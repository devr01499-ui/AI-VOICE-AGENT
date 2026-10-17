import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { CallService } from './CallService';
import { callOrchestrator } from '../core/orchestrator/CallOrchestrator';
import { logger } from '../utils/logger';
import { ADMIN_EMAIL } from '../config/constants';
import type { CallStatus } from '../types';

const ACCOUNT_TELEPHONY_CAP = 50; // Plivo India account-wide telephony cap
const MIN_CALL_INTERVAL_MS = 500; // 2 calls per second dial rate limit
const LOCK_TIMEOUT_MS = 60000; // 60s stale worker lock threshold
const STUCK_RECIPIENT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes in_progress threshold

const TRANSIENT_ERROR_CODES = new Set([
  'BUSY',
  'NO_ANSWER',
  'TIMEOUT',
  'CALL_TIMEOUT',
  'CARRIER_ERROR',
  'PROVIDER_ERROR',
  'CONCURRENCY_LIMIT',
  'TRANSIENT_ERROR'
]);

export class BatchService {
  /**
   * Helper to check if current time is within legal/permitted calling hours.
   * Default: 09:00 - 21:00 IST (UTC+5:30).
   */
  static isWithinCallingWindow(scheduleConfigRaw?: string | null): { allowed: boolean; reason?: string } {
    if (process.env.ALLOW_OFFHOURS_BATCH_CALLS === 'true') {
      return { allowed: true };
    }

    let startHour = 9;
    let endHour = 21;
    let ignoreHours = false;

    if (scheduleConfigRaw) {
      try {
        const config = typeof scheduleConfigRaw === 'string' ? JSON.parse(scheduleConfigRaw) : scheduleConfigRaw;
        if (config.ignoreCallingHours) ignoreHours = true;
        if (typeof config.startHour === 'number') startHour = config.startHour;
        if (typeof config.endHour === 'number') endHour = config.endHour;
      } catch {}
    }

    if (ignoreHours) {
      return { allowed: true };
    }

    const now = new Date();
    // Convert UTC to IST (+5:30)
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffsetMs);
    const istHour = istDate.getUTCHours();
    const istMinute = istDate.getUTCMinutes();
    const currentIstDecimal = istHour + istMinute / 60;

    if (currentIstDecimal < startHour || currentIstDecimal >= endHour) {
      const pad = (n: number) => n.toString().padStart(2, '0');
      return {
        allowed: false,
        reason: `Outside permitted calling window (${pad(startHour)}:00 - ${pad(endHour)}:00 IST). Current IST time: ${pad(istHour)}:${pad(istMinute)}`
      };
    }

    return { allowed: true };
  }

  /**
   * Determines whether an error is a batch-level error (affects all contacts)
   * vs contact-specific error.
   */
  static isBatchLevelError(errorMessage: string): boolean {
    const lower = errorMessage.toLowerCase();
    return (
      lower.includes('caller id required') ||
      lower.includes('missing caller id') ||
      lower.includes('unauthorized caller id') ||
      lower.includes('awaiting activation') ||
      lower.includes('unverified kyc') ||
      lower.includes('insufficient call minutes') ||
      lower.includes('account suspended') ||
      lower.includes('account restricted') ||
      lower.includes('vobiz account not provisioned') ||
      lower.includes('provider credentials')
    );
  }

  /**
   * Processes a batch campaign respecting concurrency, caller ID, retry backoff,
   * calling hours, and atomic worker locking.
   */
  static async processBatch(batchId: string, userId: string): Promise<void> {
    const workerId = `${process.pid}_${crypto.randomUUID()}`;

    // Atomic worker claim: ensures only one worker runs this batch
    const staleLockThreshold = new Date(Date.now() - LOCK_TIMEOUT_MS);
    const claim = await prisma.batch.updateMany({
      where: {
        id: batchId,
        userId,
        status: 'running',
        OR: [
          { lockedBy: null },
          { lockedAt: { lt: staleLockThreshold } }
        ]
      },
      data: {
        lockedBy: workerId,
        lockedAt: new Date()
      }
    });

    if (claim.count === 0) {
      logger.info(`BatchService: Batch ${batchId} already claimed by another active worker or not in running state. Skipping.`);
      return;
    }

    logger.info(`BatchService: Worker ${workerId} claimed batch ${batchId} for user ${userId}.`);

    const releaseLock = async (extraData: Record<string, any> = {}) => {
      try {
        await prisma.batch.updateMany({
          where: { id: batchId, lockedBy: workerId },
          data: {
            lockedBy: null,
            lockedAt: null,
            ...extraData
          }
        });
      } catch (err) {
        logger.warn(`BatchService: Failed to release lock for batch ${batchId}`, { error: String(err) });
      }
    };

    try {
      const batch = await prisma.batch.findUnique({
        where: { id: batchId },
        include: {
          fromPhoneNumber: true
        }
      });

      if (!batch || batch.status !== 'running') {
        await releaseLock();
        return;
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        await releaseLock({ status: 'failed', statusReason: 'User not found' });
        return;
      }

      const isAdmin = user.accountType === 'admin' || user.email === ADMIN_EMAIL;

      // ── Batch-level validation: Calling hours ──
      const windowCheck = this.isWithinCallingWindow(batch.scheduleConfig);
      if (!windowCheck.allowed) {
        logger.info(`BatchService: Batch ${batchId} paused: ${windowCheck.reason}`);
        await releaseLock({ status: 'paused', statusReason: windowCheck.reason });
        return;
      }

      // ── Batch-level validation: Account status ──
      if (user.accountStatus === 'suspended' || user.accountStatus === 'restricted') {
        const reason = `Account ${user.accountStatus}: Outbound batch calling disabled.`;
        logger.warn(`BatchService: Batch ${batchId} paused: ${reason}`);
        await releaseLock({ status: 'paused', statusReason: reason });
        return;
      }

      // ── Batch-level validation: Minutes ──
      const effectiveRemainingSeconds = user.minutesRemainingSeconds > 0
        ? user.minutesRemainingSeconds
        : (user.callingBalanceMinutes * 60);

      if (!isAdmin && effectiveRemainingSeconds <= 0) {
        const reason = 'Insufficient call minutes remaining. Please purchase a plan.';
        logger.warn(`BatchService: Batch ${batchId} paused: ${reason}`);
        await releaseLock({ status: 'paused', statusReason: reason });
        return;
      }

      // ── Batch-level validation: Caller ID (Item 16: Admin accounts must not silently fall back) ──
      if (!batch.fromPhoneNumberId || !batch.fromPhoneNumber?.phoneNumber) {
        const reason = 'Caller ID required. Please assign a verified phone number to this campaign.';
        logger.warn(`BatchService: Batch ${batchId} paused: ${reason}`);
        await releaseLock({ status: 'paused', statusReason: reason });
        return;
      }

      let effectiveFromNumber: string | null = null;
      try {
        const validated = await CallService.validateCallerNumber(userId, batch.fromPhoneNumber.phoneNumber, false);
        effectiveFromNumber = validated.effectiveFromNumber;
      } catch (valErr: any) {
        const reason = valErr.message || 'Invalid caller ID assigned to campaign';
        logger.warn(`BatchService: Batch ${batchId} paused due to caller ID validation failure: ${reason}`);
        await releaseLock({ status: 'paused', statusReason: reason });
        return;
      }

      // Concurrency limits configuration
      let userMaxConcurrency = user.maxConcurrentCalls ?? 1;
      if (user.maxConcurrentCalls === null || user.maxConcurrentCalls === undefined) {
        if (user.accountType === 'developer' || user.accountType === 'professional') {
          userMaxConcurrency = 5;
        } else if (user.accountType === 'enterprise') {
          userMaxConcurrency = 15;
        }
      }

      // Pacing and retry configs
      const retryConfig = typeof batch.retryConfig === 'string' ? JSON.parse(batch.retryConfig || '{}') : (batch.retryConfig || {});
      const maxAttempts = typeof retryConfig.maxAttempts === 'number' ? retryConfig.maxAttempts : 3;
      const retryIntervalMs = typeof retryConfig.intervalMinutes === 'number'
        ? retryConfig.intervalMinutes * 60 * 1000
        : (typeof retryConfig.intervalMs === 'number' ? retryConfig.intervalMs : 30 * 60 * 1000);

      const inFlightRecipientIds = new Set<string>();

      // Main dispatch & monitor loop
      while (true) {
        // Heartbeat lock renewal
        await prisma.batch.updateMany({
          where: { id: batchId, lockedBy: workerId },
          data: { lockedAt: new Date() }
        });

        // Check if batch was paused/cancelled externally
        const stateCheck = await prisma.batch.findUnique({
          where: { id: batchId },
          select: { status: true }
        });

        if (!stateCheck || stateCheck.status === 'cancelled' || stateCheck.status === 'paused') {
          logger.info(`BatchService: Batch ${batchId} stopping due to status change: ${stateCheck?.status}`);
          await releaseLock();
          return;
        }

        // Mid-batch calling hours check
        const currentWindowCheck = this.isWithinCallingWindow(batch.scheduleConfig);
        if (!currentWindowCheck.allowed) {
          logger.info(`BatchService: Batch ${batchId} reached end of calling window: ${currentWindowCheck.reason}`);
          await releaseLock({ status: 'paused', statusReason: currentWindowCheck.reason });
          return;
        }

        // Mid-batch account and minutes check
        const freshUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { accountStatus: true, minutesRemainingSeconds: true, callingBalanceMinutes: true }
        });

        if (freshUser?.accountStatus === 'suspended' || freshUser?.accountStatus === 'restricted') {
          const reason = `Account ${freshUser.accountStatus}: Outbound batch calling disabled.`;
          await releaseLock({ status: 'paused', statusReason: reason });
          return;
        }

        const freshRemainingSecs = (freshUser?.minutesRemainingSeconds ?? 0) > 0
          ? freshUser!.minutesRemainingSeconds
          : ((freshUser?.callingBalanceMinutes ?? 0) * 60);

        if (!isAdmin && freshRemainingSecs <= 0) {
          const reason = 'Insufficient call minutes remaining mid-batch';
          await releaseLock({ status: 'paused', statusReason: reason });
          return;
        }

        // Calculate available concurrency capacity
        const userActiveCalls = await prisma.call.count({
          where: {
            userId,
            status: { in: ['queued', 'ringing', 'in_progress'] }
          }
        });

        const globalActiveCalls = await prisma.call.count({
          where: {
            status: { in: ['queued', 'ringing', 'in_progress'] }
          }
        });

        const availableSlots = Math.max(
          0,
          Math.min(userMaxConcurrency - userActiveCalls, ACCOUNT_TELEPHONY_CAP - globalActiveCalls)
        );

        const now = new Date();
        const retryThreshold = new Date(now.getTime() - retryIntervalMs);

        // Fetch eligible recipients: pending OR transient failed whose backoff expired
        const candidateRecipients = await prisma.batchRecipient.findMany({
          where: {
            batchId,
            id: { notIn: Array.from(inFlightRecipientIds) },
            OR: [
              { status: 'pending' },
              {
                status: 'failed',
                attempts: { lt: maxAttempts },
                lastErrorCode: { in: Array.from(TRANSIENT_ERROR_CODES) },
                lastAttemptAt: { lte: retryThreshold }
              }
            ]
          },
          orderBy: [
            { position: 'asc' }
          ],
          take: Math.max(1, availableSlots)
        });

        if (candidateRecipients.length === 0 && inFlightRecipientIds.size === 0) {
          // No more recipients to process and no active calls in-flight
          break;
        }

        // If capacity available, dial candidates up to available slots
        if (availableSlots > 0 && candidateRecipients.length > 0) {
          const toDial = candidateRecipients.slice(0, availableSlots);

          for (const recipient of toDial) {
            inFlightRecipientIds.add(recipient.id);

            // Dial asynchronously with a tracking wrapper
            (async () => {
              try {
                // Pre-dial Opt-out / DNC Gate
                const cleanDigits = recipient.phoneNumber.replace(/\D/g, '');
                const toVariants = Array.from(new Set([recipient.phoneNumber, `+${cleanDigits}`, cleanDigits]));
                const optedOut = await prisma.contact.findFirst({
                  where: {
                    userId: batch.userId,
                    phoneNumber: { in: toVariants },
                    optedOutAt: { not: null }
                  }
                });

                if (optedOut) {
                  logger.info(`BatchService: Skipping recipient ${recipient.id} (${recipient.phoneNumber}) - opted out (DNC)`);
                  await prisma.batchRecipient.update({
                    where: { id: recipient.id },
                    data: {
                      status: 'failed',
                      attempts: maxAttempts,
                      callerPhoneNumber: effectiveFromNumber,
                      lastError: 'Recipient has opted out of communications (DNC)',
                      lastErrorCode: 'DNC_OPT_OUT',
                      lastAttemptAt: new Date()
                    }
                  });
                  return;
                }

                const attemptCount = recipient.attempts + 1;
                await prisma.batchRecipient.update({
                  where: { id: recipient.id },
                  data: {
                    status: 'in_progress',
                    callerPhoneNumber: effectiveFromNumber,
                    attempts: attemptCount,
                    lastAttemptAt: new Date(),
                    lastError: null,
                    lastErrorCode: null
                  }
                });

                let parsedUserData = {};
                try {
                  parsedUserData = typeof recipient.userData === 'string' ? JSON.parse(recipient.userData) : recipient.userData;
                } catch {}

                const callResult = await CallService.createCall({
                  phoneNumber: recipient.phoneNumber,
                  agentId: batch.agentId,
                  userId: batch.userId,
                  fromPhoneNumber: effectiveFromNumber!,
                  userData: parsedUserData
                });

                await prisma.batchRecipient.update({
                  where: { id: recipient.id },
                  data: {
                    callId: callResult.callId,
                    callerPhoneNumber: effectiveFromNumber
                  }
                });

                logger.info(`BatchService: Call initiated for recipient ${recipient.id}`, { callId: callResult.callId });

                // Wait for call completion (terminal status or 5-min timeout)
                const terminalStatuses: string[] = ['completed', 'failed', 'busy', 'no_answer', 'cancelled', 'timeout'];
                const pollInterval = 2000;
                const maxWaitMs = 5 * 60 * 1000;
                const startTime = Date.now();
                let callFinished = false;

                while (Date.now() - startTime < maxWaitMs) {
                  const callRecord = await prisma.call.findUnique({
                    where: { id: callResult.callId },
                    select: { status: true }
                  });

                  if (callRecord && terminalStatuses.includes(callRecord.status)) {
                    callFinished = true;
                    const finalStatus = callRecord.status === 'completed' ? 'completed' : 'failed';
                    await prisma.batchRecipient.update({
                      where: { id: recipient.id },
                      data: {
                        status: finalStatus,
                        lastError: callRecord.status === 'completed' ? null : `Call ended with status: ${callRecord.status}`,
                        lastErrorCode: callRecord.status === 'completed' ? null : callRecord.status.toUpperCase()
                      }
                    });
                    logger.info(`BatchService: Call ${callResult.callId} resolved with status ${callRecord.status}`);
                    break;
                  }

                  await new Promise(r => setTimeout(r, pollInterval));
                }

                if (!callFinished) {
                  // Timed out after 5 minutes: terminate call session and record failure
                  logger.warn(`BatchService: Call ${callResult.callId} timed out after 5 minutes. Terminating session.`);
                  try {
                    await callOrchestrator.endCallSession(callResult.callId, 'timeout');
                  } catch (termErr) {
                    logger.warn('BatchService: Error ending timed-out call session', { error: String(termErr) });
                  }

                  await prisma.call.update({
                    where: { id: callResult.callId },
                    data: { status: 'timeout', endTime: new Date() }
                  }).catch(() => {});

                  await prisma.batchRecipient.update({
                    where: { id: recipient.id },
                    data: {
                      status: 'failed',
                      lastError: 'Call resolution timed out after 5 minutes',
                      lastErrorCode: 'TIMEOUT'
                    }
                  });
                }

              } catch (callErr: any) {
                const errMsg = callErr?.message || String(callErr);
                logger.error(`BatchService: Error placing call for recipient ${recipient.id}`, { error: errMsg });

                // Check for batch-level error
                if (BatchService.isBatchLevelError(errMsg)) {
                  // Reset recipient so it isn't marked as failed due to account configuration
                  await prisma.batchRecipient.update({
                    where: { id: recipient.id },
                    data: {
                      status: 'pending',
                      attempts: Math.max(0, recipient.attempts),
                      lastError: errMsg,
                      lastErrorCode: 'BATCH_PAUSED'
                    }
                  });

                  // Pause the whole batch immediately with visible reason
                  await prisma.batch.updateMany({
                    where: { id: batchId },
                    data: {
                      status: 'paused',
                      statusReason: errMsg
                    }
                  });
                  return;
                }

                // Check transient vs permanent error
                const isTransient = errMsg.includes('Concurrency limit') || errMsg.includes('50') || errMsg.includes('network');
                await prisma.batchRecipient.update({
                  where: { id: recipient.id },
                  data: {
                    status: 'failed',
                    attempts: isTransient ? recipient.attempts + 1 : maxAttempts,
                    lastError: errMsg,
                    lastErrorCode: isTransient ? 'CONCURRENCY_LIMIT' : 'PERMANENT_ERROR'
                  }
                });
              } finally {
                inFlightRecipientIds.delete(recipient.id);

                // Update batch live counters
                const completedCount = await prisma.batchRecipient.count({ where: { batchId, status: 'completed' } });
                const failedCount = await prisma.batchRecipient.count({ where: { batchId, status: 'failed' } });

                await prisma.batch.updateMany({
                  where: { id: batchId },
                  data: { completedCount, failedCount }
                }).catch(() => {});
              }
            })();

            // Rate limit throttle: 2 calls per second
            await new Promise(r => setTimeout(r, MIN_CALL_INTERVAL_MS));
          }
        } else {
          // No slots available right now or waiting on in-flight calls: poll interval
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      // Compute final honest status from recipient rows
      const completedCount = await prisma.batchRecipient.count({ where: { batchId, status: 'completed' } });
      const failedCount = await prisma.batchRecipient.count({ where: { batchId, status: 'failed' } });
      const inProgressCount = await prisma.batchRecipient.count({ where: { batchId, status: 'in_progress' } });
      const pendingCount = await prisma.batchRecipient.count({ where: { batchId, status: 'pending' } });

      let finalStatus: string;
      let finalReason: string | null = null;

      if (inProgressCount > 0 || pendingCount > 0) {
        finalStatus = 'running';
      } else if (completedCount > 0) {
        finalStatus = 'completed';
      } else {
        // Honest final status: completed ONLY if at least 1 call placed!
        finalStatus = 'failed';
        finalReason = 'Batch concluded with 0 successful calls placed.';
      }

      await releaseLock({
        completedCount,
        failedCount,
        status: finalStatus,
        statusReason: finalReason,
        ...(finalStatus === 'completed' || finalStatus === 'failed' ? { completedAt: new Date() } : {})
      });

      logger.info(`BatchService: Finished processing batch ${batchId}. Status: ${finalStatus}`, {
        completedCount,
        failedCount
      });

    } catch (unexpectedErr) {
      logger.error(`BatchService: Unexpected error in batch runner for ${batchId}`, { error: String(unexpectedErr) });
      await releaseLock();
    }
  }

  /**
   * Backward-compatible alias for processBatch.
   */
  static async processBatchOneAtATime(batchId: string, userId: string): Promise<void> {
    return this.processBatch(batchId, userId);
  }

  /**
   * Restart Recovery Worker:
   * Called on boot and every 60 seconds.
   * Resets recipients stuck in_progress for >10 mins back to pending.
   * Finds running batches with stale or missing locks and resumes them.
   */
  static async recoverStaleBatches(): Promise<void> {
    try {
      // 1. Reset stuck recipients
      const stuckThreshold = new Date(Date.now() - STUCK_RECIPIENT_TIMEOUT_MS);
      const resetResult = await prisma.batchRecipient.updateMany({
        where: {
          status: 'in_progress',
          lastAttemptAt: { lt: stuckThreshold }
        },
        data: {
          status: 'pending'
        }
      });

      if (resetResult.count > 0) {
        logger.warn(`BatchService: Reset ${resetResult.count} stuck in_progress recipients back to pending.`);
      }

      // 2. Find running batches with stale lock
      const staleLockThreshold = new Date(Date.now() - LOCK_TIMEOUT_MS);
      const staleBatches = await prisma.batch.findMany({
        where: {
          status: 'running',
          OR: [
            { lockedBy: null },
            { lockedAt: { lt: staleLockThreshold } }
          ]
        },
        select: { id: true, userId: true }
      });

      if (staleBatches.length > 0) {
        logger.info(`BatchService: Found ${staleBatches.length} running batches with stale/missing locks. Resuming.`);
        for (const b of staleBatches) {
          BatchService.processBatch(b.id, b.userId).catch(err => {
            logger.error(`BatchService: Error resuming recovered batch ${b.id}`, { error: String(err) });
          });
        }
      }
    } catch (err) {
      logger.error('BatchService: Error during stale batch recovery cycle', { error: String(err) });
    }
  }
}
