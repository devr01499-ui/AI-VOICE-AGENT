/**
 * Bolna Server — Voice Runtime Engine
 *
 * Central orchestrator for all voice call operations. Coordinates between:
 *   - RealtimeSessionManager (OpenAI Realtime WebSocket sessions)
 *   - ConversationStateManager (per-call conversation state)
 *   - TranscriptManager (real-time transcript persistence)
 *   - ToolExecutor (function-call execution during conversations)
 *   - CallLifecycleManager (call state machine)
 *
 * Singleton pattern — accessed via VoiceRuntimeEngine.instance.
 */

import { logger } from '../utils/logger';
import { CallError, SessionError } from '../types/errors';
import { RealtimeSessionManager } from './RealtimeSessionManager';
import { ConversationStateManager } from './ConversationStateManager';
import { TranscriptManager } from './TranscriptManager';
import { ToolExecutor } from './ToolExecutor';
import { CallLifecycleManager } from './CallLifecycleManager';
import { CallRepository } from '../repositories/CallRepository';
import { AgentRepository } from '../repositories/AgentRepository';
import type { AgentConfig, CallStatus } from '../types';
import { env } from '../config/env';

// ─── Active Call Tracking ─────────────────────────

interface ActiveCall {
  callId: string;
  agentId: string;
  phoneNumber: string;
  sessionId: string | null;
  startedAt: number;
}

// ─── Engine Implementation ────────────────────────

export class VoiceRuntimeEngine {
  private static _instance: VoiceRuntimeEngine | null = null;

  public readonly sessionManager: RealtimeSessionManager;
  public readonly conversationManager: ConversationStateManager;
  public readonly transcriptManager: TranscriptManager;
  public readonly toolExecutor: ToolExecutor;
  public readonly lifecycleManager: CallLifecycleManager;

  private readonly activeCalls = new Map<string, ActiveCall>();

  private constructor() {
    this.sessionManager = new RealtimeSessionManager();
    this.conversationManager = new ConversationStateManager();
    this.transcriptManager = new TranscriptManager();
    this.toolExecutor = new ToolExecutor();
    this.lifecycleManager = new CallLifecycleManager();

    this.wireEventCallbacks();
  }

  /** Returns the singleton instance. */
  static get instance(): VoiceRuntimeEngine {
    if (!VoiceRuntimeEngine._instance) {
      VoiceRuntimeEngine._instance = new VoiceRuntimeEngine();
    }
    return VoiceRuntimeEngine._instance;
  }

  /**
   * Starts a new voice session for a call that has been answered.
   *
   * This is called after Vobiz confirms the call is connected (via webhook).
   * It creates the OpenAI Realtime session, initializes conversation state,
   * and registers any tools defined in the agent config.
   *
   * @param callId - The internal call ID
   * @param agentId - The agent configuration to use
   * @param phoneNumber - The recipient phone number
   */
  async startSession(callId: string, agentId: string, phoneNumber: string): Promise<string> {
    logger.info('VoiceRuntimeEngine: starting session', { callId, agentId, phoneNumber });

    // Fetch agent configuration
    const agent = await AgentRepository.findById(agentId);
    let agentConfig: AgentConfig;
    try {
      agentConfig = JSON.parse(agent.agentConfig) as AgentConfig;
    } catch {
      throw new CallError(callId, 'Invalid agent configuration JSON');
    }

    // Provide defaults for missing config fields
    if (!agentConfig.prompt) {
      agentConfig.prompt = 'You are a helpful voice assistant.';
    }
    if (!agentConfig.voice) {
      agentConfig.voice = 'alloy';
    }
    if (!agentConfig.llm) {
      const isGemini = Boolean(env.GEMINI_API_KEY || env.GOOGLE_API_KEY);
      const defaultProvider = isGemini ? 'gemini' : 'openai';
      const defaultModel = isGemini ? 'gemini-2.0-flash-exp' : 'gpt-4o-realtime-preview';
      agentConfig.llm = { provider: defaultProvider, model: defaultModel };
    }

    // Initialize lifecycle state
    this.lifecycleManager.initializeState(callId);

    // Initialize conversation state
    this.conversationManager.initializeState(callId, agentId, agentConfig);

    // Register tools from agent config
    if (agentConfig.tools && agentConfig.tools.length > 0) {
      this.toolExecutor.clearRegistry();
      this.toolExecutor.registerTools(agentConfig.tools);
    }

    // Transition to in_progress (skipping queued/ringing/connected since
    // Vobiz webhooks handle those transitions before we get here)
    try {
      this.lifecycleManager.transitionState(callId, 'in_progress');
    } catch {
      // State may already be in_progress from webhook — that's fine
      logger.debug('VoiceRuntimeEngine: lifecycle transition skipped (may already be in_progress)', { callId });
    }

    // Create OpenAI Realtime session
    const maxDurationMs = (agentConfig.settings?.maxCallDuration ?? 1800) * 1000;
    const sessionId = await this.sessionManager.createSession(
      callId,
      agentId,
      agentConfig,
      maxDurationMs
    );

    // Track active call
    this.activeCalls.set(callId, {
      callId,
      agentId,
      phoneNumber,
      sessionId,
      startedAt: Date.now(),
    });

    // Update DB
    await CallRepository.updateStatus(callId, 'in_progress', { startTime: new Date() });

    logger.info('VoiceRuntimeEngine: session started', { callId, sessionId });
    return sessionId;
  }

  /**
   * Routes incoming audio from Vobiz to the OpenAI Realtime session.
   *
   * @param callId - The call this audio belongs to
   * @param audioBase64 - Base64-encoded PCM16 audio buffer
   */
  processAudioStream(callId: string, audioBase64: string): void {
    const activeCall = this.activeCalls.get(callId);
    if (!activeCall) {
      logger.warn('VoiceRuntimeEngine: processAudioStream for unknown call', { callId });
      return;
    }

    this.sessionManager.streamAudio(callId, audioBase64);
  }

  /**
   * Ends a voice session and performs cleanup.
   *
   * @param callId - The call to end
   * @param reason - Optional reason for ending (e.g., 'user_hangup', 'timeout', 'error')
   */
  async endSession(callId: string, reason = 'normal'): Promise<void> {
    logger.info('VoiceRuntimeEngine: ending session', { callId, reason });

    const activeCall = this.activeCalls.get(callId);
    if (!activeCall) {
      logger.debug('VoiceRuntimeEngine: no active call to end', { callId });
      return;
    }

    // Close OpenAI session
    await this.sessionManager.closeSession(callId);

    // Calculate duration
    const durationMs = Date.now() - activeCall.startedAt;
    const durationSeconds = Math.round(durationMs / 1000);

    // Finalize transcript — save to execution record
    try {
      const transcript = await this.transcriptManager.getFullTranscript(callId);
      await CallRepository.updateExecution(callId, {
        transcript: JSON.stringify(transcript),
        outcome: reason === 'normal' ? 'successful' : 'unsuccessful',
      });
    } catch (err) {
      logger.error('VoiceRuntimeEngine: failed to finalize transcript', {
        callId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Update call status
    const finalStatus: CallStatus = reason === 'error' ? 'failed' : 'completed';
    try {
      this.lifecycleManager.transitionState(callId, finalStatus);
    } catch {
      // May already be in terminal state
    }

    await CallRepository.updateStatus(callId, finalStatus, {
      endTime: new Date(),
      durationSeconds,
    });

    // Cleanup in-memory state
    this.conversationManager.cleanup(callId);
    this.lifecycleManager.cleanup(callId);
    this.activeCalls.delete(callId);

    logger.info('VoiceRuntimeEngine: session ended', {
      callId,
      durationSeconds,
      reason,
    });
  }

  /**
   * Returns combined session information for a call.
   */
  getSessionInfo(callId: string): {
    active: boolean;
    sessionState: { status: string; sessionId: string } | null;
    metrics: ReturnType<RealtimeSessionManager['getMetrics']>;
    conversationTurns: number;
  } {
    const activeCall = this.activeCalls.get(callId);
    return {
      active: Boolean(activeCall),
      sessionState: this.sessionManager.getSessionState(callId),
      metrics: this.sessionManager.getMetrics(callId),
      conversationTurns: activeCall
        ? this.conversationManager.getState(callId).turnCount
        : 0,
    };
  }

  /**
   * Returns the count of currently active calls.
   */
  getActiveCallCount(): number {
    return this.activeCalls.size;
  }

  /**
   * Returns all active call IDs.
   */
  getActiveCallIds(): string[] {
    return Array.from(this.activeCalls.keys());
  }

  /**
   * Gracefully shuts down all active sessions.
   */
  async shutdownAll(): Promise<void> {
    logger.info('VoiceRuntimeEngine: shutting down all sessions', {
      count: this.activeCalls.size,
    });

    const callIds = Array.from(this.activeCalls.keys());
    for (const callId of callIds) {
      await this.endSession(callId, 'shutdown');
    }
  }

  /** Resets the singleton (for testing). */
  static reset(): void {
    VoiceRuntimeEngine._instance = null;
  }

  // ─── Private: Wire Event Callbacks ─────────────

  /**
   * Connects the RealtimeSessionManager event callbacks to the
   * ConversationStateManager, TranscriptManager, and ToolExecutor.
   */
  private wireEventCallbacks(): void {
    this.sessionManager.setCallbacks({
      // Audio from OpenAI → forwarded to Vobiz via AudioStreamHandler
      onAudioResponse: (_callId: string, _audioBase64: string) => {
        // Audio routing is handled by AudioStreamHandler, not here.
        // This callback exists so the session manager can track metrics.
      },

      // Agent transcript received
      onTranscript: (callId: string, text: string, isFinal: boolean, speaker: 'agent' | 'user') => {
        if (isFinal && text.trim()) {
          const callStartedAt = this.activeCalls.get(callId)?.startedAt ?? Date.now();
          const now = Date.now();
          const startTime = (now - callStartedAt) / 1000;

          // Persist to transcript
          this.transcriptManager.addUtterance(callId, speaker, text, startTime).catch((err) => {
            logger.error('VoiceRuntimeEngine: transcript save failed', {
              callId,
              error: err instanceof Error ? err.message : String(err),
            });
          });

          // Update conversation state
          try {
            this.conversationManager.addTurn(callId, speaker, text);
          } catch {
            // State may not exist if session is closing
          }
        }
      },

      // User started speaking → handle interruption
      onSpeechStarted: (callId: string) => {
        try {
          this.conversationManager.setInterrupted(callId, true);
        } catch {
          // Ignore if state doesn't exist
        }
      },

      // User stopped speaking
      onSpeechStopped: (callId: string) => {
        try {
          this.conversationManager.setInterrupted(callId, false);
        } catch {
          // Ignore if state doesn't exist
        }
      },

      // OpenAI requested a function call
      onFunctionCall: (callId: string, fnCallId: string, name: string, args: string) => {
        logger.info('VoiceRuntimeEngine: function call requested', {
          callId,
          functionName: name,
        });

        // Execute the tool asynchronously and send result back
        let parsedArgs: Record<string, unknown>;
        try {
          parsedArgs = JSON.parse(args) as Record<string, unknown>;
        } catch {
          parsedArgs = {};
        }

        this.toolExecutor
          .executeTool(name, parsedArgs)
          .then((result) => {
            const resultStr = JSON.stringify(result.result ?? { success: result.success });
            this.sessionManager.sendFunctionResult(callId, fnCallId, resultStr);
          })
          .catch((err) => {
            const errorResult = JSON.stringify({ error: err instanceof Error ? err.message : 'Tool execution failed' });
            this.sessionManager.sendFunctionResult(callId, fnCallId, errorResult);
          });
      },

      // Error in the OpenAI session
      onError: (callId: string, error: Error) => {
        logger.error('VoiceRuntimeEngine: session error', {
          callId,
          error: error.message,
        });
      },

      // OpenAI finished generating a response
      onResponseDone: (callId: string) => {
        logger.debug('VoiceRuntimeEngine: response complete', { callId });
      },

      // Session closed (timeout, error, or normal)
      onSessionClosed: (callId: string) => {
        logger.info('VoiceRuntimeEngine: session closed callback', { callId });
        // If still tracked as active, clean up
        if (this.activeCalls.has(callId)) {
          this.endSession(callId, 'session_closed').catch((err) => {
            logger.error('VoiceRuntimeEngine: cleanup after session close failed', {
              callId,
              error: err instanceof Error ? err.message : String(err),
            });
          });
        }
      },
    });
  }
}
