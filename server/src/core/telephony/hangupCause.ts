/**
 * Maps a carrier hangup webhook (both carriers use Plivo-style fields) to the end reason the
 * orchestrator understands.
 *
 * The cause is checked BEFORE the source (audit #30): when a call is busy or rejected the carrier
 * itself reports the hangup (source "plivo"/"vobiz"), and checking the source first turned a busy
 * line into an "agent hangup" (completed), so busy and rejected contacts were never retried.
 *
 * Causes arrive both as codes (USER_BUSY, CALL_REJECTED) and as names ("Busy Line", "Rejected").
 */
export type CarrierHangupReason = 'busy' | 'no_answer' | 'rejected' | 'failed' | 'agent_hangup' | 'caller_hangup';

export interface CarrierHangupMapping {
  reason: CarrierHangupReason;
  endedBy: 'agent' | 'caller' | 'provider';
}

const BUSY = new Set(['BUSY', 'USER_BUSY', 'BUSY_LINE', 'LINE_BUSY']);
const NO_ANSWER = new Set(['NO_ANSWER', 'TIMEOUT', 'NO_USER_RESPONSE', 'ALLOTTED_TIMEOUT', 'RING_TIMEOUT']);
const REJECTED = new Set(['REJECTED', 'CALL_REJECTED', 'DECLINED']);
const FAILED = new Set([
  'FAILED',
  'UNALLOCATED_NUMBER',
  'INVALID_NUMBER_FORMAT',
  'INVALID_DESTINATION_ADDRESS',
  'NO_ROUTE_DESTINATION',
  'NETWORK_OUT_OF_ORDER',
  'DESTINATION_OUT_OF_ORDER',
  'SERVICE_UNAVAILABLE',
  'NORMAL_TEMPORARY_FAILURE',
]);
/** Ended before answer by the dialling side (ring timeout on our request). */
const CANCELLED_BEFORE_ANSWER = new Set(['ORIGINATOR_CANCEL', 'CANCELED', 'CANCELLED']);
const PLATFORM_SOURCES = new Set(['agent', 'plivo', 'vobiz', 'platform', 'api']);

export function normalizeHangupCause(raw: unknown): string {
  return String(raw || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}

export function mapCarrierHangup(rawCause: unknown, rawSource: unknown, answeredSeconds = 0): CarrierHangupMapping {
  const cause = normalizeHangupCause(rawCause);
  const source = String(rawSource || '').trim().toLowerCase();

  if (BUSY.has(cause)) return { reason: 'busy', endedBy: 'provider' };
  if (NO_ANSWER.has(cause)) return { reason: 'no_answer', endedBy: 'provider' };
  if (REJECTED.has(cause)) return { reason: 'rejected', endedBy: 'provider' };
  if (FAILED.has(cause)) return { reason: 'failed', endedBy: 'provider' };
  if (CANCELLED_BEFORE_ANSWER.has(cause) && !(answeredSeconds > 0)) return { reason: 'no_answer', endedBy: 'provider' };

  if (PLATFORM_SOURCES.has(source)) return { reason: 'agent_hangup', endedBy: 'agent' };
  return { reason: 'caller_hangup', endedBy: 'caller' };
}
