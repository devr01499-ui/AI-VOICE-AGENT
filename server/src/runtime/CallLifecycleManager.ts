/**
 * Bolna Voice Runtime Engine — Call Lifecycle Manager
 *
 * Finite state machine governing call lifecycle transitions.
 * Each call progresses through a strict sequence of states; only
 * transitions listed in VALID_TRANSITIONS are permitted. Terminal
 * states (completed, failed, no_answer, busy, cancelled) accept
 * no further transitions.
 *
 * Throws `CallError` when an invalid transition is attempted.
 */

import { logger } from '../utils/logger';
import { CallError } from '../types/errors';
import type { CallStatus } from '../types';

// ─────────────────────────────────────────────
// Transition Map
// ─────────────────────────────────────────────

/** Immutable mapping from each state to the set of states it may transition to. */
const VALID_TRANSITIONS: ReadonlyMap<CallStatus, readonly CallStatus[]> = new Map<
  CallStatus,
  readonly CallStatus[]
>([
  ['queued', ['ringing', 'failed', 'cancelled']],
  ['ringing', ['connected', 'no_answer', 'busy', 'failed', 'cancelled']],
  ['connected', ['in_progress', 'failed', 'cancelled']],
  ['in_progress', ['completed', 'failed', 'cancelled']],
  ['completed', []],
  ['failed', []],
  ['no_answer', []],
  ['busy', []],
  ['cancelled', []],
]);

/** States that cannot transition to any other state. */
const TERMINAL_STATES: ReadonlySet<CallStatus> = new Set<CallStatus>([
  'completed',
  'failed',
  'no_answer',
  'busy',
  'cancelled',
]);

// ─────────────────────────────────────────────
// Manager Class
// ─────────────────────────────────────────────

/**
 * Tracks per-call state and enforces valid lifecycle transitions.
 *
 * Usage:
 * ```ts
 * const lifecycle = new CallLifecycleManager();
 * lifecycle.initializeState('call-1');
 * lifecycle.transitionState('call-1', 'ringing');
 * lifecycle.transitionState('call-1', 'connected');
 * ```
 */
export class CallLifecycleManager {
  /** Current state of each tracked call. */
  private readonly states: Map<string, CallStatus> = new Map();

  // ── Initialisation ──────────────────────────

  /**
   * Registers a new call with the initial `queued` state.
   *
   * @param callId - Unique identifier for the call.
   * @throws {CallError} If the call is already being tracked.
   */
  initializeState(callId: string): void {
    if (this.states.has(callId)) {
      throw new CallError(callId, `Call ${callId} is already being tracked`);
    }

    this.states.set(callId, 'queued');
    this.onStateEnter(callId, 'queued');

    logger.info('CallLifecycleManager: call initialized', {
      callId,
      state: 'queued',
    });
  }

  // ── State Queries ───────────────────────────

  /**
   * Returns the current state for a tracked call.
   *
   * @param callId - Unique identifier for the call.
   * @returns The current {@link CallStatus}.
   * @throws {CallError} If the call is not being tracked.
   */
  getState(callId: string): CallStatus {
    const state = this.states.get(callId);
    if (state === undefined) {
      throw new CallError(callId, `Call ${callId} is not being tracked`);
    }
    return state;
  }

  /**
   * Checks whether a given state is terminal (no further transitions possible).
   *
   * @param state - The {@link CallStatus} to check.
   * @returns `true` when the state is terminal.
   */
  isTerminalState(state: CallStatus): boolean {
    return TERMINAL_STATES.has(state);
  }

  // ── Transition Logic ────────────────────────

  /**
   * Validates whether a transition from `fromState` to `toState` is permitted.
   *
   * @param fromState - The origin state.
   * @param toState   - The target state.
   * @returns `true` when the transition is valid.
   */
  validateTransition(fromState: CallStatus, toState: CallStatus): boolean {
    const allowed = VALID_TRANSITIONS.get(fromState);
    if (!allowed) {
      return false;
    }
    return allowed.includes(toState);
  }

  /**
   * Moves a call from its current state to `newState`.
   *
   * Validates the transition, fires exit/enter hooks, and logs the change.
   *
   * @param callId   - Unique identifier for the call.
   * @param newState - The target {@link CallStatus}.
   * @throws {CallError} If the call is not tracked or the transition is invalid.
   */
  transitionState(callId: string, newState: CallStatus): void {
    const currentState = this.getState(callId);

    if (!this.validateTransition(currentState, newState)) {
      throw new CallError(
        callId,
        `Invalid state transition: ${currentState} → ${newState} for call ${callId}`,
        400,
      );
    }

    this.onStateExit(callId, currentState);
    this.states.set(callId, newState);
    this.onStateEnter(callId, newState);

    logger.info('CallLifecycleManager: state transition', {
      callId,
      from: currentState,
      to: newState,
    });
  }

  // ── Cleanup ─────────────────────────────────

  /**
   * Removes a call from the internal tracking map.
   *
   * @param callId - Unique identifier for the call.
   */
  cleanup(callId: string): void {
    this.states.delete(callId);

    logger.debug('CallLifecycleManager: call cleaned up', { callId });
  }

  // ── Lifecycle Hooks (private) ───────────────

  /**
   * Invoked immediately after a call enters a new state.
   * Placeholder for future event emission.
   */
  private onStateEnter(callId: string, state: CallStatus): void {
    logger.debug('CallLifecycleManager: entering state', { callId, state });
  }

  /**
   * Invoked immediately before a call leaves its current state.
   * Placeholder for future event emission.
   */
  private onStateExit(callId: string, state: CallStatus): void {
    logger.debug('CallLifecycleManager: exiting state', { callId, state });
  }
}
