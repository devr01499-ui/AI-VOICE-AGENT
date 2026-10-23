import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { CallService } from './CallService';
import { callOrchestrator } from '../core/orchestrator/CallOrchestrator';
import { logger } from '../utils/logger';
import { ADMIN_EMAIL } from '../config/constants';
import { countActiveCalls, countGlobalActiveCalls, GLOBAL_TELEPHONY_CAP } from '../utils/concurrency';
import { getCallableSecondsRemaining } from '../utils/balanceUtils';

const ACCOUNT_TELEPHONY_CAP = GLOBAL_TELEPHONY_CAP; // Centralized telephony cap
const LOCK_TIMEOUT_MS = 60000; // 60s stale worker lock threshold
const STUCK_RECIPIENT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes in_progress threshold

const TRANSIENT_CALL_ERROR_CODES = new Set([
  'BUSY',
  'NO_ANSWER',
  'CALL_TIMEOUT',
  'CARRIER_ERROR',
  'PROVIDER_ERROR',
  'TRANSIENT_ERROR'
]);

export interface BatchCounters {
  total: number;
  attempted: number;
  answered: number;
  notAnswered: number;
  busy: number;
  failed: number;
  skipped: number;
  cancelled: number;
  remaining: number;
  progressPercent: number;
  totalDurationSeconds: number;
  totalBilledMinutes: number;
}

export class BatchService {
  /**
   * Universal Single Source of Truth Counter Function.
   * Every number shown to customer is computed strictly from real database rows.
   * No hardcoded or estimated numbers.
   */
  static async computeBatchCounters(batchId: string): Promise<BatchCounters> {
    const recipients = await prisma.batchRecipient.findMany({
      where: { batchId },
      include: {
        call: {
          select: {
            id: true,
            status: true,
            startTime: true,
            durationSeconds: true
          }
        }
      }
    });

    const total = recipients.length;
    let attempted = 0;
    let answered = 0;
    let notAnswered = 0;
    let busy = 0;
    let failed = 0;
    let skipped = 0;
    let cancelled = 0;
    let remaining = 0;
    let totalDurationSeconds = 0;
    let finalStateCount = 0;

    for (const r of recipients) {
      const isDnc = r.lastErrorCode === 'DNC_OPT_OUT' || r.lastErrorCode === 'DNC_SKIPPED';
      const isCancelled = r.status === 'cancelled';
      const hasRealCall = !!r.callId || r.attempts > 0;

      if (isDnc) {
        skipped++;
        finalStateCount++;
      } else if (isCancelled) {
        cancelled++;
        finalStateCount++;
      } else if (r.status === 'pending') {
        remaining++;
      } else {
        if (hasRealCall) {
          attempted++;
        }

        const dur = r.call?.durationSeconds || 0;
        totalDurationSeconds += dur;

        const isAnswered = (r.call?.startTime && dur > 0) || (r.status === 'completed' && dur > 0);
        const isBusy = r.lastErrorCode === 'BUSY' || r.call?.status === 'busy';
        const isNoAnswer = r.lastErrorCode === 'NO_ANSWER' || r.call?.status === 'no_answer';

        if (isAnswered) {
          answered++;
          finalStateCount++;
        } else if (isBusy) {
          busy++;
          if (r.attempts >= 3 || r.status === 'failed') finalStateCount++;
        } else if (isNoAnswer) {
          notAnswered++;
          if (r.attempts >= 3 || r.status === 'failed') finalStateCount++;
        } else if (r.status === 'failed') {
          failed++;
          finalStateCount++;
        } else if (r.status === 'completed') {
          answered++;
          finalStateCount++;
        }
      }
    }

    const progressPercent = total > 0 ? Math.round((finalStateCount / total) * 100) : 0;
    const totalBilledMinutes = Math.ceil(totalDurationSeconds / 60);

    return {
      total,
      attempted,
      answered,
      notAnswered,
      busy,
      failed,
      skipped,
      cancelled,
      remaining,
      progressPercent,
      totalDurationSeconds,
      totalBilledMinutes
    };
  }

  /**
   * Single-Writer Idempotent Outcome Resolver:
   * Maps call outcome from real telephony CDR / hangup signals into recipient state.
   */
  static async resolveRecipientOutcome(callId: string, hangupCause?: string): Promise<void> {
    const recipient = await prisma.batchRecipient.findFirst({
      where: { callId }
    });
    if (!recipient) return;

    const call = await prisma.call.findUnique({
      where: { id: callId }
    });
    if (!call) return;

    let targetStatus = 'failed';
    let lastError: string | null = null;
    let lastErrorCode: string | null = null;

    const dur = call.durationSeconds ?? 0;
    const hasAnswerTime = !!call.startTime;
    const cause = (hangupCause || '').toLowerCase();

    if (call.status === 'cancelled') {
      targetStatus = 'cancelled';
      lastErrorCode = 'CANCELLED';
      lastError = 'Call cancelled by user';
    } else if (call.status === 'timeout' || cause === 'timeout' || cause === 'safety_timeout') {
      targetStatus = 'failed';
      lastErrorCode = 'TIMEOUT';
      lastError = 'Safety timeout reached';
    } else if (call.status === 'busy' || cause.includes('busy')) {
      targetStatus = 'failed';
      lastErrorCode = 'BUSY';
      lastError = 'Line busy';
    } else if (call.status === 'no_answer' || cause.includes('no_answer') || cause.includes('no-answer') || cause.includes('timeout')) {
      targetStatus = 'failed';
      lastErrorCode = 'NO_ANSWER';
      lastError = 'No answer';
    } else if (call.status === 'rejected' || cause.includes('reject')) {
      targetStatus = 'failed';
      lastErrorCode = 'REJECTED';
      lastError = 'Carrier rejected call';
    } else if ((hasAnswerTime && dur > 0) || (call.status === 'completed' && dur > 0)) {
      targetStatus = 'completed';
      lastErrorCode = null;
      lastError = null;
    } else {
      targetStatus = 'failed';
      lastErrorCode = 'FAILED';
      lastError = `Call ended without connection (duration: ${dur}s)`;
    }

    await prisma.batchRecipient.update({
      where: { id: recipient.id },
      data: {
        status: targetStatus,
        lastError,
        lastErrorCode
      }
    });

    // Reconcile parent batch counters from rows
    const counters = await BatchService.computeBatchCounters(recipient.batchId);
    await prisma.batch.update({
      where: { id: recipient.batchId },
      data: {
        completedCount: counters.answered,
        failedCount: counters.failed + counters.busy + counters.notAnswered
      }
    }).catch(() => {});
  }

  /**
   * Checks if current time is within permitted calling hours.
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
        reason: `Outside permitted calling window (${pad(startHour)}:00 - ${pad(endHour)}:00 IST). Resumes at 09:00 IST.`
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
   * Processes a batch campaign: Sequential by default with persistent interCallDelaySeconds,
   * deterministic CSV order (position ASC), retry queue discipline, universal concurrency checks,
   * single-writer lifecycle resolution, and fail-loud semantics.
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
      const effectiveRemainingSeconds = getCallableSecondsRemaining(user);

      if (!isAdmin && effectiveRemainingSeconds <= 0) {
        const reason = 'Insufficient call minutes remaining. Please purchase a plan.';
        logger.warn(`BatchService: Batch ${batchId} paused: ${reason}`);
        await releaseLock({ status: 'paused', statusReason: reason });
        return;
      }

      // ── Batch-level validation: Caller ID ──
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

      const isSequential = batch.dialMode !== 'parallel';
      const interCallDelaySeconds = Math.max(5, Math.min(300, batch.interCallDelaySeconds ?? 10));

      const retryConfig = typeof batch.retryConfig === 'string' ? JSON.parse(batch.retryConfig || '{}') : (batch.retryConfig || {});
      const maxAttempts = typeof retryConfig.maxAttempts === 'number' ? retryConfig.maxAttempts : 3;
      const retryIntervalMs = typeof retryConfig.intervalMinutes === 'number'
        ? retryConfig.intervalMinutes * 60 * 1000
        : (typeof retryConfig.intervalMs === 'number' ? retryConfig.intervalMs : 30 * 60 * 1000);

      // Check if resuming from an inter-call delay
      if (batch.nextDispatchAt && batch.nextDispatchAt.getTime() > Date.now()) {
        const remainingDelayMs = batch.nextDispatchAt.getTime() - Date.now();
        logger.info(`BatchService: Resuming batch ${batchId}. Respecting remaining inter-call delay (${Math.round(remainingDelayMs / 1000)}s)...`);
        await new Promise(r => setTimeout(r, remainingDelayMs));
        await prisma.batch.update({
          where: { id: batchId },
          data: { nextDispatchAt: null }
        });
      }

      // ── Main Dispatch Loop ──
      while (true) {
        // Heartbeat lock renewal
        await prisma.batch.updateMany({
          where: { id: batchId, lockedBy: workerId },
          data: { lockedAt: new Date() }
        });

        // Check if batch was paused or cancelled externally
        const stateCheck = await prisma.batch.findUnique({
          where: { id: batchId },
          select: { status: true }
        });

        if (!stateCheck || stateCheck.status === 'cancelled' || stateCheck.status === 'paused') {
          logger.info(`BatchService: Batch ${batchId} stopping due to status: ${stateCheck?.status}`);
          await releaseLock();
          return;
        }

        // Calling hours check mid-batch
        const currentWindowCheck = this.isWithinCallingWindow(batch.scheduleConfig);
        if (!currentWindowCheck.allowed) {
          logger.info(`BatchService: Batch ${batchId} outside calling window: ${currentWindowCheck.reason}`);
          await releaseLock({ status: 'paused', statusReason: currentWindowCheck.reason });
          return;
        }

        // Minutes check mid-batch
        const freshUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { accountStatus: true, minutesRemainingSeconds: true, callingBalanceMinutes: true }
        });

        if (freshUser?.accountStatus === 'suspended' || freshUser?.accountStatus === 'restricted') {
          const reason = `Account ${freshUser.accountStatus}: Outbound batch calling disabled.`;
          await releaseLock({ status: 'paused', statusReason: reason });
          return;
        }

        const freshRemainingSecs = getCallableSecondsRemaining(freshUser);

        if (!isAdmin && freshRemainingSecs <= 0) {
          const reason = 'Insufficient call minutes remaining mid-batch';
          await releaseLock({ status: 'paused', statusReason: reason });
          return;
        }

        // Candidate Selection with Strict Queue Discipline:
        // Rule: All first attempts run in position order first. Only then retry-eligible contacts run in order.
        let nextRecipient = await prisma.batchRecipient.findFirst({
          where: {
            batchId,
            status: 'pending',
            attempts: 0
          },
          orderBy: { position: 'asc' }
        });

        if (!nextRecipient) {
          // If no first attempts remaining, look for any pending with attempts > 0 (re-queued from concurrency)
          nextRecipient = await prisma.batchRecipient.findFirst({
            where: {
              batchId,
              status: 'pending',
              attempts: { gt: 0 }
            },
            orderBy: { position: 'asc' }
          });
        }

        if (!nextRecipient) {
          // Check retry-eligible contacts whose 30-minute backoff has elapsed
          const now = new Date();
          const retryThreshold = new Date(now.getTime() - retryIntervalMs);

          nextRecipient = await prisma.batchRecipient.findFirst({
            where: {
              batchId,
              status: 'failed',
              attempts: { lt: maxAttempts },
              lastErrorCode: { in: Array.from(TRANSIENT_CALL_ERROR_CODES) },
              lastAttemptAt: { lte: retryThreshold }
            },
            orderBy: { position: 'asc' }
          });
        }

        // No more eligible contacts to process
        if (!nextRecipient) {
          break;
        }

        // Concurrency Check (Universal Helper)
        const userActiveCalls = await countActiveCalls(userId);
        const globalActiveCalls = await countGlobalActiveCalls();

        const concurrencyLimit = isSequential ? 1 : userMaxConcurrency;
        if (userActiveCalls >= concurrencyLimit || globalActiveCalls >= ACCOUNT_TELEPHONY_CAP) {
          logger.info(`BatchService: Concurrency limit active (${userActiveCalls}/${concurrencyLimit}). Waiting 8s before retry.`);
          await new Promise(r => setTimeout(r, 8000));
          continue;
        }

        // ── Pre-dial Opt-out / DNC Gate ──
        const cleanDigits = nextRecipient.phoneNumber.replace(/\D/g, '');
        const toVariants = Array.from(new Set([nextRecipient.phoneNumber, `+${cleanDigits}`, cleanDigits]));
        const optedOut = await prisma.contact.findFirst({
          where: {
            userId: batch.userId,
            phoneNumber: { in: toVariants },
            optedOutAt: { not: null }
          }
        });

        if (optedOut) {
          logger.info(`BatchService: Skipping recipient ${nextRecipient.id} (${nextRecipient.phoneNumber}) - opted out (DNC)`);
          await prisma.batchRecipient.update({
            where: { id: nextRecipient.id },
            data: {
              status: 'failed',
              attempts: maxAttempts,
              callerPhoneNumber: effectiveFromNumber,
              lastError: 'Recipient has opted out of communications (DNC)',
              lastErrorCode: 'DNC_OPT_OUT',
              lastAttemptAt: new Date()
            }
          });
          continue;
        }

        // ── Place the Call ──
        let parsedUserData = {};
        try {
          parsedUserData = typeof nextRecipient.userData === 'string' ? JSON.parse(nextRecipient.userData) : nextRecipient.userData;
        } catch {}

        // Atomic recipient claim: prevents any concurrent worker cycle from double-dialing the same recipient
        const claimRecipient = await prisma.batchRecipient.updateMany({
          where: {
            id: nextRecipient.id,
            status: { in: ['pending', 'failed'] }
          },
          data: {
            status: 'in_progress',
            callerPhoneNumber: effectiveFromNumber,
            lastAttemptAt: new Date()
          }
        });

        if (claimRecipient.count === 0) {
          logger.info(`BatchService: Recipient ${nextRecipient.id} already claimed by another dispatch cycle. Skipping.`);
          continue;
        }

        let callResult: { callId: string } | null = null;
        try {
          callResult = await CallService.createCall({
            phoneNumber: nextRecipient.phoneNumber,
            agentId: batch.agentId,
            userId: batch.userId,
            fromPhoneNumber: effectiveFromNumber!,
            batchId: batch.id,
            userData: parsedUserData
          });
        } catch (callErr: any) {
          const errMsg = callErr?.message || String(callErr);

          if (BatchService.isBatchLevelError(errMsg)) {
            logger.warn(`BatchService: Pausing batch ${batchId} due to batch-level error: ${errMsg}`);
            await prisma.batchRecipient.update({
              where: { id: nextRecipient.id },
              data: {
                status: 'pending',
                lastError: errMsg,
                lastErrorCode: 'BATCH_PAUSED'
              }
            });
            await releaseLock({ status: 'paused', statusReason: errMsg });
            return;
          }

          if (errMsg.includes('Concurrency limit')) {
            // Concurrency refusal is NOT a failure: requeue as pending, do not consume attempt, short sleep
            logger.info(`BatchService: Concurrency refusal for recipient ${nextRecipient.id}. Requeueing without consuming attempt.`);
            await prisma.batchRecipient.update({
              where: { id: nextRecipient.id },
              data: {
                status: 'pending',
                lastError: 'Concurrency limit reached - waiting for slot',
                lastErrorCode: 'CONCURRENCY_WAIT'
              }
            });
            await new Promise(r => setTimeout(r, 8000));
            continue;
          }

          // Permanent or unrecoverable error
          logger.error(`BatchService: Non-concurrency error placing call for recipient ${nextRecipient.id}: ${errMsg}`);
          await prisma.batchRecipient.update({
            where: { id: nextRecipient.id },
            data: {
              status: 'failed',
              attempts: nextRecipient.attempts + 1,
              lastError: errMsg,
              lastErrorCode: 'FAILED',
              lastAttemptAt: new Date()
            }
          });
          continue;
        }

        // Call successfully initiated
        await prisma.batchRecipient.update({
          where: { id: nextRecipient.id },
          data: {
            callId: callResult.callId,
            status: 'in_progress',
            callerPhoneNumber: effectiveFromNumber,
            attempts: nextRecipient.attempts + 1,
            lastAttemptAt: new Date(),
            lastError: null,
            lastErrorCode: null
          }
        });

        logger.info(`BatchService: Call initiated for recipient ${nextRecipient.id}`, { callId: callResult.callId });

        // ── Await Call Completion (Event-driven with safety timeout) ──
        // Safety timeout = call's max duration (default 1800s) + 30s grace period
        const safetyTimeoutMs = (1800 + 30) * 1000;
        const callEndResult = await callOrchestrator.waitForCallEnd(callResult.callId, safetyTimeoutMs);

        if (callEndResult.reason === 'timeout') {
          logger.warn(`BatchService: Call ${callResult.callId} reached safety timeout. Terminating session.`);
          try {
            await callOrchestrator.endCallSession(callResult.callId, 'timeout');
          } catch {}
          await prisma.call.update({
            where: { id: callResult.callId },
            data: { status: 'timeout', endTime: new Date() }
          }).catch(() => {});
        }

        // Single-writer: Resolve recipient outcome derived from Call record
        await BatchService.resolveRecipientOutcome(callResult.callId, callEndResult.reason);

        // ── Inter-call Delay Pacing ──
        // Next call starts at previous call end time + delay
        if (isSequential) {
          const nextDispatchAt = new Date(Date.now() + interCallDelaySeconds * 1000);
          await prisma.batch.update({
            where: { id: batchId },
            data: { nextDispatchAt }
          });

          logger.info(`BatchService: Call completed. Pausing ${interCallDelaySeconds}s before next call...`);
          await new Promise(r => setTimeout(r, interCallDelaySeconds * 1000));

          await prisma.batch.update({
            where: { id: batchId },
            data: { nextDispatchAt: null }
          });
        }
      }

      // Compute final honest status from recipient rows
      const counters = await BatchService.computeBatchCounters(batchId);
      const inProgressCount = await prisma.batchRecipient.count({ where: { batchId, status: 'in_progress' } });
      const pendingCount = await prisma.batchRecipient.count({ where: { batchId, status: 'pending' } });

      let finalStatus: string;
      let finalReason: string | null = null;

      if (inProgressCount > 0 || pendingCount > 0) {
        finalStatus = 'running';
      } else if (counters.answered > 0) {
        finalStatus = 'completed';
      } else {
        finalStatus = 'failed';
        finalReason = 'Batch concluded with 0 answered calls placed.';
      }

      await releaseLock({
        completedCount: counters.answered,
        failedCount: counters.failed + counters.busy + counters.notAnswered,
        status: finalStatus,
        statusReason: finalReason,
        ...(finalStatus === 'completed' || finalStatus === 'failed' ? { completedAt: new Date() } : {})
      });

      logger.info(`BatchService: Concluded batch ${batchId}. Status: ${finalStatus}`, { counters });

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
