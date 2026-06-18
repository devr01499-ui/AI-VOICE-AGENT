/**
 * Bolna Voice Runtime Engine — Conversation State Manager
 *
 * Maintains in-memory conversation state for each active call session.
 * Tracks turns (capped at {@link MAX_TURNS}), context variables, user data,
 * and interruption status. State is ephemeral — persistence is handled
 * by the repository layer after the call ends.
 */

import { logger } from '../utils/logger';
import { CallError } from '../types/errors';
import type {
  ConversationState,
  ConversationTurn,
  AgentConfig,
  Speaker,
  ToolCallResult,
} from '../types';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

/** Maximum number of turns retained in the in-memory sliding window. */
const MAX_TURNS = 10;

// ─────────────────────────────────────────────
// Manager Class
// ─────────────────────────────────────────────

/**
 * Per-call conversation state store.
 *
 * Usage:
 * ```ts
 * const csm = new ConversationStateManager();
 * csm.initializeState('call-1', 'agent-1', agentConfig);
 * csm.addTurn('call-1', 'user', 'Hello?');
 * const history = csm.getConversationHistory('call-1');
 * ```
 */
export class ConversationStateManager {
  /** Keyed by callId → live conversation state. */
  private readonly states: Map<string, ConversationState> = new Map();

  // ── Initialisation ──────────────────────────

  /**
   * Creates a new conversation state for the given call.
   *
   * @param callId      - Unique call identifier.
   * @param agentId     - The agent handling this conversation.
   * @param agentConfig - Full agent configuration snapshot.
   * @param userData    - Optional caller-supplied metadata.
   * @throws {CallError} If a state already exists for this callId.
   */
  initializeState(
    callId: string,
    agentId: string,
    agentConfig: AgentConfig,
    userData: Record<string, unknown> = {},
  ): void {
    if (this.states.has(callId)) {
      throw new CallError(callId, `Conversation state already exists for call ${callId}`);
    }

    const now = Date.now();

    const state: ConversationState = {
      callId,
      agentId,
      agentConfig,
      turns: [],
      contextVariables: {},
      userData,
      turnCount: 0,
      isInterrupted: false,
      startedAt: now,
      lastActivityAt: now,
    };

    this.states.set(callId, state);

    logger.info('ConversationStateManager: state initialized', {
      callId,
      agentId,
    });
  }

  // ── Turn Management ─────────────────────────

  /**
   * Appends a new turn to the conversation.
   *
   * If the total number of turns exceeds {@link MAX_TURNS}, the oldest
   * entries are trimmed to keep only the most recent turns.
   *
   * @param callId    - Unique call identifier.
   * @param speaker   - Who produced this turn (`agent`, `user`, or `system`).
   * @param content   - The textual content of the turn.
   * @param toolCalls - Optional results of tool invocations during the turn.
   * @throws {CallError} If no state exists for the callId.
   */
  addTurn(
    callId: string,
    speaker: Speaker,
    content: string,
    toolCalls?: ToolCallResult[],
  ): void {
    const state = this.getState(callId);

    const turn: ConversationTurn = {
      speaker,
      content,
      timestamp: Date.now(),
      ...(toolCalls ? { toolCalls } : {}),
    };

    state.turns.push(turn);
    state.turnCount += 1;

    // Sliding-window trim
    if (state.turns.length > MAX_TURNS) {
      state.turns = state.turns.slice(-MAX_TURNS);
    }

    state.lastActivityAt = Date.now();

    logger.debug('ConversationStateManager: turn added', {
      callId,
      speaker,
      turnCount: state.turnCount,
      retainedTurns: state.turns.length,
    });
  }

  // ── State Access ────────────────────────────

  /**
   * Returns the full conversation state for a call.
   *
   * @param callId - Unique call identifier.
   * @returns The current {@link ConversationState}.
   * @throws {CallError} If no state exists for the callId.
   */
  getState(callId: string): ConversationState {
    const state = this.states.get(callId);
    if (!state) {
      throw new CallError(callId, `No conversation state found for call ${callId}`);
    }
    return state;
  }

  /**
   * Returns the ordered list of conversation turns.
   *
   * @param callId - Unique call identifier.
   * @returns Array of {@link ConversationTurn} objects.
   * @throws {CallError} If no state exists for the callId.
   */
  getConversationHistory(callId: string): ConversationTurn[] {
    return this.getState(callId).turns;
  }

  // ── Mutations ───────────────────────────────

  /**
   * Sets or updates a single context variable.
   *
   * @param callId - Unique call identifier.
   * @param key    - Variable name.
   * @param value  - Variable value.
   * @throws {CallError} If no state exists for the callId.
   */
  updateContext(callId: string, key: string, value: unknown): void {
    const state = this.getState(callId);
    state.contextVariables[key] = value;

    logger.debug('ConversationStateManager: context updated', {
      callId,
      key,
    });
  }

  /**
   * Sets the interruption flag for a call.
   *
   * @param callId      - Unique call identifier.
   * @param interrupted - Whether the agent is currently interrupted.
   * @throws {CallError} If no state exists for the callId.
   */
  setInterrupted(callId: string, interrupted: boolean): void {
    const state = this.getState(callId);
    state.isInterrupted = interrupted;

    logger.debug('ConversationStateManager: interruption flag set', {
      callId,
      interrupted,
    });
  }

  // ── Cleanup & Diagnostics ──────────────────

  /**
   * Removes the conversation state for a call.
   *
   * @param callId - Unique call identifier.
   */
  cleanup(callId: string): void {
    this.states.delete(callId);

    logger.debug('ConversationStateManager: state cleaned up', { callId });
  }

  /**
   * Returns the number of currently active conversation sessions.
   */
  getActiveSessionCount(): number {
    return this.states.size;
  }
}
