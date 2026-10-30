/**
 * Claritiy Voice — Carrier Hangup (single source of truth)
 *
 * Ending the AI session does NOT end the phone call: the Stream XML uses keepCallAlive="true", so the
 * PSTN leg stays up (and keeps billing) until the carrier is told to hang up. Previously only
 * CallService.terminateCall() did that, and it was skipped by the AI's own end_call tool, skipped when
 * the call was already marked finished, and sent to the WRONG carrier on inbound calls (it looked up the
 * caller's number instead of our number).
 *
 * This module is the only place that talks hangup to a carrier. It:
 *  - resolves the carrier from OUR number (outbound: fromPhoneNumber, inbound: recipientPhoneNumber),
 *  - tries the owning Plivo sub-account first, then the parent account,
 *  - retries transient failures,
 *  - treats 404/410 as "already ended" (success), and
 *  - logs a structured, alertable result for every attempt.
 */

import { prisma } from '../../lib/prisma';
import { logger } from '../../utils/logger';

export type HangupOutcome = 'hung_up' | 'already_ended' | 'failed' | 'no_carrier_uuid' | 'no_call';

const inFlight = new Map<string, Promise<HangupOutcome>>();
const finished = new Map<string, HangupOutcome>();

function numberVariants(raw?: string | null): string[] {
  if (!raw) return [];
  const digits = raw.replace(/\D/g, '');
  return Array.from(new Set([raw, digits, `+${digits}`].filter(Boolean)));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Which of the call's two numbers is OURS?
 * outbound: fromPhoneNumber is our caller-ID, recipientPhoneNumber is the person we dialled.
 * inbound : fromPhoneNumber is the CALLER, recipientPhoneNumber is our DID.
 */
export function ourNumberCandidates(call: { callDirection?: string | null; fromPhoneNumber?: string | null; recipientPhoneNumber?: string | null }): string[] {
  const isInbound = (call.callDirection || '').toLowerCase() === 'inbound';
  const ordered = isInbound
    ? [call.recipientPhoneNumber, call.fromPhoneNumber]
    : [call.fromPhoneNumber, call.recipientPhoneNumber];
  return ordered.filter((n): n is string => Boolean(n));
}

async function attemptOnce(call: any): Promise<HangupOutcome> {
  const uuid = (call.telemetryId || '').trim();
  const candidates = ourNumberCandidates(call);
  let record: { telephonyProvider: string; plivoSubAuthId: string | null } | null = null;
  for (const n of candidates) {
    record = await prisma.phoneNumber.findFirst({
      where: { phoneNumber: { in: numberVariants(n) } },
      select: { telephonyProvider: true, plivoSubAuthId: true },
    });
    if (record) break;
  }

  const provider = (record?.telephonyProvider || '').toLowerCase();
  const results: HangupOutcome[] = [];

  const tryPlivo = async () => {
    const { PlivoService } = await import('./PlivoService');
    const r = await new PlivoService().terminateCall(uuid, { subAuthId: record?.plivoSubAuthId || null });
    return (r === 'no_credentials' ? 'failed' : r) as HangupOutcome;
  };
  const tryVobiz = async () => {
    try {
      const { VobizService } = await import('./VobizService');
      await VobizService.terminateCall(uuid, call.userId);
      return 'hung_up' as HangupOutcome;
    } catch (err) {
      logger.warn('[CARRIER_HANGUP] Vobiz hangup error', { callId: call.id, error: err instanceof Error ? err.message : String(err) });
      return 'failed' as HangupOutcome;
    }
  };

  if (provider === 'plivo') results.push(await tryPlivo());
  else if (provider === 'vobiz') results.push(await tryVobiz());
  else {
    // Number not found in our inventory: we cannot know the carrier. A DELETE for an unknown UUID is a
    // harmless 404, so try both rather than silently doing nothing.
    logger.warn('[CARRIER_HANGUP] Could not resolve carrier from our number; trying Plivo then Vobiz', {
      callId: call.id, direction: call.callDirection, candidates,
    });
    const p = await tryPlivo();
    results.push(p);
    if (p !== 'hung_up') results.push(await tryVobiz());
  }

  if (results.includes('hung_up')) return 'hung_up';
  if (results.includes('already_ended')) return 'already_ended';
  return 'failed';
}

/**
 * Hang up the carrier leg of a call. Idempotent and safe to call from any end path.
 * Never throws.
 */
export function hangupCarrierLeg(callId: string, opts: { reason?: string; attempts?: number } = {}): Promise<HangupOutcome> {
  const done = finished.get(callId);
  if (done === 'hung_up' || done === 'already_ended') return Promise.resolve(done);
  const existing = inFlight.get(callId);
  if (existing) return existing;

  const run = (async (): Promise<HangupOutcome> => {
    const attempts = Math.max(1, opts.attempts ?? 3);
    try {
      const call = await prisma.call.findUnique({
        where: { id: callId },
        select: { id: true, userId: true, telemetryId: true, fromPhoneNumber: true, recipientPhoneNumber: true, callDirection: true },
      });
      if (!call) { logger.warn('[CARRIER_HANGUP] call row not found', { callId }); return 'no_call'; }
      if (!call.telemetryId) {
        logger.error('[CARRIER_HANGUP_FAILED] call has no carrier UUID; the phone call may stay connected', { callId });
        return 'no_carrier_uuid';
      }

      let outcome: HangupOutcome = 'failed';
      for (let i = 1; i <= attempts; i++) {
        outcome = await attemptOnce(call);
        if (outcome === 'hung_up' || outcome === 'already_ended') {
          logger.info('[CARRIER_HANGUP]', { callId, outcome, attempt: i, reason: opts.reason });
          finished.set(callId, outcome);
          return outcome;
        }
        if (i < attempts) await sleep(i === 1 ? 400 : 1200);
      }
      logger.error('[CARRIER_HANGUP_FAILED] carrier hangup did not succeed; the phone call may stay connected and keep billing', {
        callId, attempts, reason: opts.reason,
      });
      return 'failed';
    } catch (err) {
      logger.error('[CARRIER_HANGUP_FAILED] unexpected error', { callId, error: err instanceof Error ? err.message : String(err) });
      return 'failed';
    } finally {
      inFlight.delete(callId);
      if (finished.size > 2000) {
        const first = finished.keys().next().value;
        if (first) finished.delete(first);
      }
    }
  })();

  inFlight.set(callId, run);
  return run;
}

/** Test helper only. */
export function _resetCarrierHangupStateForTests(): void {
  inFlight.clear();
  finished.clear();
}
