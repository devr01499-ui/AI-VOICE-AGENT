import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { CallService } from './CallService';
import { callOrchestrator } from '../core/orchestrator/CallOrchestrator';
import { logger } from '../utils/logger';
import { ADMIN_EMAIL } from '../config/constants';
import { countActiveCalls, countGlobalActiveCalls, GLOBAL_TELEPHONY_CAP } from '../utils/concurrency';
import { getCallableSecondsRemaining } from '../utils/balanceUtils';
import { getPlanConcurrency } from '../config/plans';

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

/** Commercial calls in India: 09:00–21:00 IST (TRAI). Campaigns can narrow, never widen this. */
export const LEGAL_CALLING_START_HOUR = 9;
export const LEGAL_CALLING_END_HOUR = 21;
export const CALLING_WINDOW_PAUSE_PREFIX = 'Outside permitted calling window';
/** Never ring the same person more than 3 times per campaign, at least 10 minutes apart. */
export const MAX_ATTEMPTS_CAP = 3;
export const MIN_RETRY_INTERVAL_MS = 10 * 60 * 1000;
const ACTIVE_CALL_STATUSES = ['queued', 'ringing', 'in_progress', 'initiated', 'answered'];

/** Largest contact list one campaign may hold (one database write; split bigger lists). */
export const MAX_BATCH_RECIPIENTS = 5000;
const MAX_RECIPIENT_DATA_BYTES = 2048;

export interface PreparedRecipients {
  accepted: Array<Record<string, unknown> & { phoneNumber: string }>;
  invalid: number;
  duplicates: number;
  optedOut: number;
}

/**
 * Turns an uploaded contact list into callable recipients: every number normalised to E.164 and
 * restricted to Indian mobiles (destination allow-list: no international or premium numbers),
 * duplicates dropped, opted-out (DNC) numbers removed by their NORMALISED form (raw digits used to
 * miss "+9198…" vs "98…"), and oversized per-contact data refused.
 */
export function prepareBatchRecipients(recipients: unknown[], optedOutNumbers: Iterable<string>): PreparedRecipients {
  const { normalizePhoneNumber } = require('../utils/phoneValidator');
  const optedOut = new Set<string>();
  for (const raw of optedOutNumbers) {
    const n = normalizePhoneNumber(String(raw));
    if (n.ok) optedOut.add(n.e164);
  }
  const seen = new Set<string>();
  const out: PreparedRecipients = { accepted: [], invalid: 0, duplicates: 0, optedOut: 0 };
  for (const r of recipients) {
    const obj = r && typeof r === 'object' ? (r as Record<string, unknown>) : null;
    const raw = typeof r === 'string' ? r : String(obj?.phoneNumber ?? obj?.phone ?? '');
    const n = normalizePhoneNumber(raw);
    // Destination allow-list: Indian mobiles only (the sign-up validator also accepts international).
    if (!n.ok || !/^\+91[6-9]\d{9}$/.test(n.e164)) { out.invalid++; continue; }
    if (obj) {
      let size = Infinity;
      try { size = Buffer.byteLength(JSON.stringify(obj), 'utf8'); } catch { /* circular */ }
      if (size > MAX_RECIPIENT_DATA_BYTES) { out.invalid++; continue; }
    }
    if (seen.has(n.e164)) { out.duplicates++; continue; }
    seen.add(n.e164);
    if (optedOut.has(n.e164)) { out.optedOut++; continue; }
    out.accepted.push({ ...(obj || {}), phoneNumber: n.e164 });
  }
  return out;
}

export function resolveRetryPolicy(raw: unknown): { maxAttempts: number; retryIntervalMs: number } {
  let cfg: any = {};
  try { cfg = typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw || {}); } catch { cfg = {}; }
  const attempts = typeof cfg.maxAttempts === 'number' && Number.isFinite(cfg.maxAttempts) ? Math.floor(cfg.maxAttempts) : MAX_ATTEMPTS_CAP;
  const intervalMs = typeof cfg.intervalMinutes === 'number' && Number.isFinite(cfg.intervalMinutes)
    ? cfg.intervalMinutes * 60 * 1000
    : (typeof cfg.intervalMs === 'number' && Number.isFinite(cfg.intervalMs) ? cfg.intervalMs : 30 * 60 * 1000);
  return {
    maxAttempts: Math.min(MAX_ATTEMPTS_CAP, Math.max(1, attempts)),
    retryIntervalMs: Math.max(MIN_RETRY_INTERVAL_MS, intervalMs),
  };
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
  static isWithinCallingWindow(scheduleConfigRaw?: string | null, nowOverride?: Date): { allowed: boolean; reason?: string } {
    // Developer-only switch for local testing. It is ignored in production: TRAI calling hours
    // (09:00–21:00 IST for commercial calls) can never be switched off on the live service.
    if (process.env.ALLOW_OFFHOURS_BATCH_CALLS === 'true' && process.env.NODE_ENV !== 'production') {
      return { allowed: true };
    }

    // A campaign may only NARROW the legal window. "ignoreCallingHours" and hours outside
    // 09:00–21:00 sent by a customer used to switch the protection off; they are now ignored.
    let startHour = LEGAL_CALLING_START_HOUR;
    let endHour = LEGAL_CALLING_END_HOUR;
    if (scheduleConfigRaw) {
      try {
        const config = typeof scheduleConfigRaw === 'string' ? JSON.parse(scheduleConfigRaw) : scheduleConfigRaw;
        if (typeof config.startHour === 'number' && Number.isFinite(config.startHour)) startHour = Math.max(LEGAL_CALLING_START_HOUR, config.startHour);
        if (typeof config.endHour === 'number' && Number.isFinite(config.endHour)) endHour = Math.min(LEGAL_CALLING_END_HOUR, config.endHour);
      } catch {}
    }
    if (endHour <= startHour) {
      return { allowed: false, reason: 'The campaign calling hours are empty. Choose hours between 09:00 and 21:00 IST.' };
    }

    const now = nowOverride || new Date();
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
        reason: `${CALLING_WINDOW_PAUSE_PREFIX} (${pad(Math.floor(startHour))}:${pad(Math.round((startHour % 1) * 60))} - ${pad(Math.floor(endHour))}:${pad(Math.round((endHour % 1) * 60))} IST). Resumes automatically when calling hours open.`
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

    // Keep the lock fresh for the whole run, including the long waits for a call to end and the
    // inter-call pause (audit #26: the heartbeat only ran at the top of the loop, so any call longer
    // than the 60 s lock timeout let another worker claim the batch and dial in parallel).
    const heartbeat = setInterval(() => {
      prisma.batch.updateMany({ where: { id: batchId, lockedBy: workerId }, data: { lockedAt: new Date() } })
        .catch((err) => logger.warn(`BatchService: lock heartbeat failed for batch ${batchId}`, { error: String(err) }));
    }, Math.floor(LOCK_TIMEOUT_MS / 3));
    if (typeof heartbeat.unref === 'function') heartbeat.unref();

    const releaseLock = async (extraData: Record<string, any> = {}) => {
      clearInterval(heartbeat);
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
      // Plan-based limit; the stored value can only lower it (audit #6).
      const userMaxConcurrency = getPlanConcurrency(user.accountType, user.maxConcurrentCalls);

      const isSequential = batch.dialMode !== 'parallel';
      const interCallDelaySeconds = Math.max(5, Math.min(300, batch.interCallDelaySeconds ?? 10));

      const { maxAttempts, retryIntervalMs } = resolveRetryPolicy(batch.retryConfig);

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
      // Busy / no-answer contacts still due a retry keep the campaign running (audit #27). The 60 s
      // recovery job re-enters this loop and dials them once their retry interval has passed.
      const awaitingRetry = await prisma.batchRecipient.count({
        where: { batchId, status: 'failed', attempts: { lt: maxAttempts }, lastErrorCode: { in: Array.from(TRANSIENT_CALL_ERROR_CODES) } },
      });

      let finalStatus: string;
      let finalReason: string | null = null;

      if (inProgressCount > 0 || pendingCount > 0) {
        finalStatus = 'running';
      } else if (awaitingRetry > 0) {
        finalStatus = 'running';
        finalReason = `Waiting to retry ${awaitingRetry} unanswered or busy contact(s)`;
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
  static async recoverStaleBatches(opts: { now?: Date; dispatch?: boolean } = {}): Promise<void> {
    const now = opts.now || new Date();
    try {
      // 1. Recipients left "in_progress" (e.g. by a restart). Look at the real call first: a call
      // still going on must never be dialled again; an ended call decides the outcome; only a
      // recipient whose call was never placed goes back to pending.
      const stuckThreshold = new Date(Date.now() - STUCK_RECIPIENT_TIMEOUT_MS);
      const stuck = await prisma.batchRecipient.findMany({
        where: { status: 'in_progress', lastAttemptAt: { lt: stuckThreshold } },
        select: { id: true, callId: true, batchId: true, phoneNumber: true, lastAttemptAt: true },
        take: 500,
      });
      let requeued = 0;
      for (const r of stuck) {
        const call = r.callId
          ? await prisma.call.findUnique({ where: { id: r.callId }, select: { id: true, status: true } })
          : await prisma.call.findFirst({
              where: {
                batchId: r.batchId,
                recipientPhoneNumber: r.phoneNumber,
                createdAt: { gte: new Date((r.lastAttemptAt?.getTime() || Date.now()) - 60_000) },
              },
              orderBy: { createdAt: 'desc' },
              select: { id: true, status: true },
            });
        if (call && ACTIVE_CALL_STATUSES.includes(call.status)) continue; // still on the phone
        if (call) {
          if (!r.callId) await prisma.batchRecipient.update({ where: { id: r.id }, data: { callId: call.id } });
          await BatchService.resolveRecipientOutcome(call.id, 'recovered');
          continue;
        }
        const reset = await prisma.batchRecipient.updateMany({ where: { id: r.id, status: 'in_progress' }, data: { status: 'pending' } });
        requeued += reset.count;
      }
      if (requeued > 0) {
        logger.warn(`BatchService: ${requeued} recipients whose call was never placed went back to pending.`);
      }

      // 1b. Campaigns paused only because calling hours had closed resume when they reopen.
      const windowPaused = await prisma.batch.findMany({
        where: { status: 'paused', statusReason: { startsWith: CALLING_WINDOW_PAUSE_PREFIX } },
        select: { id: true, scheduleConfig: true },
        take: 500,
      });
      for (const b of windowPaused) {
        if (!BatchService.isWithinCallingWindow(b.scheduleConfig, now).allowed) continue;
        const resumed = await prisma.batch.updateMany({
          where: { id: b.id, status: 'paused', statusReason: { startsWith: CALLING_WINDOW_PAUSE_PREFIX } },
          data: { status: 'running', statusReason: null, lockedBy: null, lockedAt: null },
        });
        if (resumed.count) logger.info(`BatchService: calling hours open — resumed campaign ${b.id}`);
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
          if (opts.dispatch === false) continue; // tests: recovery bookkeeping only
          BatchService.processBatch(b.id, b.userId).catch(err => {
            logger.error(`BatchService: Error resuming recovered batch ${b.id}`, { error: String(err) });
          });
        }
      }
    } catch (err) {
      logger.error('BatchService: Error during stale batch recovery cycle', { error: String(err) });
    }
    // Runs on the same 60 s cycle: start campaigns whose scheduled time has come (audit #80).
    await BatchService.startDueScheduledBatches(opts);
  }

  /**
   * Starts 'scheduled' campaigns whose scheduledAt has passed. The status change is a conditional
   * claim (scheduled -> running), so two servers never start the same campaign. Calling-hours rules
   * still apply inside processBatch (outside 09:00–21:00 IST the batch pauses and resumes itself).
   */
  static async startDueScheduledBatches(opts: { now?: Date; dispatch?: boolean } = {}): Promise<number> {
    const now = opts.now || new Date();
    let started = 0;
    try {
      const due = await prisma.batch.findMany({
        where: { status: 'scheduled', scheduledAt: { not: null, lte: now } },
        select: { id: true, userId: true },
        take: 50,
      });
      for (const b of due) {
        const claim = await prisma.batch.updateMany({
          where: { id: b.id, status: 'scheduled' },
          data: { status: 'running', statusReason: null },
        });
        if (claim.count === 0) continue;
        started++;
        logger.info('BatchService: starting scheduled campaign', { batchId: b.id });
        if (opts.dispatch === false) continue;
        BatchService.processBatch(b.id, b.userId).catch((err) => {
          logger.error(`BatchService: Error starting scheduled batch ${b.id}`, { error: String(err) });
        });
      }
    } catch (err) {
      logger.error('BatchService: Error starting scheduled batches', { error: String(err) });
    }
    return started;
  }
}
