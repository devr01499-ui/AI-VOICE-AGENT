/**
 * Bolna Server — Realtime Session Manager
 *
 * Manages the lifecycle of OpenAI Realtime sessions on a per-call basis.
 * Bridges the gap between the VoiceRuntimeEngine (which thinks in callIds)
 * and the OpenAIRealtimeProvider (which thinks in sessionIds).
 *
 * Responsibilities:
 *   - Create/close OpenAI sessions per call
 *   - Route audio bidirectionally
 *   - Handle realtime event callbacks
 *   - Track latency metrics per session
 *   - Enforce max call duration timeouts
 */

import { logger } from '../utils/logger';
import { SessionError } from '../types/errors';
import { ProviderManager } from '../providers/ProviderManager';
import type {
  IRealtimeProvider,
  RealtimeSessionConfig,
  RealtimeEventCallbacks,
} from '../providers/interfaces/IProvider';
import type { AgentConfig, SessionMetrics, SessionStatus } from '../types';
import { env } from '../config/env';
import { convertInboundAudio, convertOutboundAudio } from '../utils/AudioConverter';

// ─── Internal Session State ──────────────────────────

interface ManagedSession {
  callId: string;
  sessionId: string;
  agentId: string;
  status: SessionStatus;
  createdAt: number;
  lastAudioAt: number;
  latencySamples: number[];
  audioPacketsSent: number;
  audioPacketsReceived: number;
  timeoutHandle: ReturnType<typeof setTimeout> | null;
  inputSampleRate: number;
  outputSampleRate: number;
  providerName: string;
}

// ─── Callback Types for Upstream Consumers ───────────

export interface SessionEventCallbacks {
  onAudioResponse?: (callId: string, audioBase64: string) => void;
  onTranscript?: (callId: string, text: string, isFinal: boolean, speaker: 'agent' | 'user') => void;
  onSpeechStarted?: (callId: string) => void;
  onSpeechStopped?: (callId: string) => void;
  onFunctionCall?: (callId: string, fnCallId: string, name: string, args: string) => void;
  onError?: (callId: string, error: Error) => void;
  onResponseDone?: (callId: string) => void;
  onSessionClosed?: (callId: string) => void;
}

// ─── Manager Implementation ──────────────────────────

export class RealtimeSessionManager {
  private readonly sessions = new Map<string, ManagedSession>();
  private readonly callToSession = new Map<string, string>();
  private callbacks: SessionEventCallbacks = {};

  /** Default max call duration: 30 minutes. */
  private readonly DEFAULT_MAX_DURATION_MS = 30 * 60 * 1000;

  /**
   * Registers upstream event callbacks.
   * Should be called before creating any sessions.
   */
  setCallbacks(callbacks: SessionEventCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Creates a new OpenAI Realtime session for the given call.
   *
   * @param callId - Internal call identifier
   * @param agentId - Agent whose config drives the session
   * @param agentConfig - Parsed agent configuration
   * @param maxDurationMs - Optional max call duration before auto-close
   * @returns The OpenAI session ID
   */
  async createSession(
    callId: string,
    agentId: string,
    agentConfig: AgentConfig,
    maxDurationMs?: number
  ): Promise<string> {
    if (this.callToSession.has(callId)) {
      throw new SessionError(callId, `Session already exists for call ${callId}`);
    }

    const providerName = agentConfig.llm.provider === 'gemini' ? 'gemini-live' : 'openai-realtime';
    const provider = ProviderManager.instance.getProvider<IRealtimeProvider>(providerName);
    const defaultModel = provider.name === 'gemini-live' ? env.GEMINI_REALTIME_MODEL : env.OPENAI_REALTIME_MODEL;

    // Cross-provider model override validation
    let selectedModel = agentConfig.llm.model || defaultModel;
    if (provider.name === 'gemini-live' && selectedModel.toLowerCase().includes('gpt')) {
      selectedModel = defaultModel;
    } else if (provider.name === 'openai-realtime' && selectedModel.toLowerCase().includes('gemini')) {
      selectedModel = defaultModel;
    }

    // Build session config from agent config
    const sessionConfig: RealtimeSessionConfig = {
      model: selectedModel,
      voice: agentConfig.voice || 'alloy',
      instructions: agentConfig.prompt,
      tools: agentConfig.tools?.map((t) => ({
        type: 'function' as const,
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
      inputAudioFormat: 'pcm16',
      outputAudioFormat: 'pcm16',
    };

    // Wire up event callbacks that translate sessionId → callId
    const realtimeCallbacks = this.buildRealtimeCallbacks(callId);

    logger.info('RealtimeSessionManager: creating session', {
      callId,
      agentId,
      voice: sessionConfig.voice,
      model: sessionConfig.model,
    });

    const { sessionId } = await provider.createSession(sessionConfig, realtimeCallbacks);

    // Determine rates based on provider name
    const inputSampleRate = provider.name === 'gemini-live' ? 16000 : 24000;
    const outputSampleRate = provider.name === 'gemini-live' ? 24000 : 24000;

    // Track the session
    const managed: ManagedSession = {
      callId,
      sessionId,
      agentId,
      status: 'active',
      createdAt: Date.now(),
      lastAudioAt: Date.now(),
      latencySamples: [],
      audioPacketsSent: 0,
      audioPacketsReceived: 0,
      timeoutHandle: null,
      inputSampleRate,
      outputSampleRate,
      providerName,
    };

    // Set up max duration timeout
    const timeout = maxDurationMs ?? this.DEFAULT_MAX_DURATION_MS;
    managed.timeoutHandle = setTimeout(() => {
      logger.warn('RealtimeSessionManager: max duration reached, closing session', {
        callId,
        sessionId,
        durationMs: timeout,
      });
      this.closeSession(callId).catch((err) => {
        logger.error('RealtimeSessionManager: failed to close timed-out session', {
          callId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }, timeout);

    this.sessions.set(sessionId, managed);
    this.callToSession.set(callId, sessionId);

    logger.info('RealtimeSessionManager: session created', {
      callId,
      sessionId,
    });

    return sessionId;
  }

  /**
   * Streams audio data to the OpenAI session for the given call.
   *
   * @param callId - The call to stream audio for
   * @param audioBase64 - Base64-encoded PCM16 audio data
   */
  streamAudio(callId: string, audioBase64: string): void {
    const sessionId = this.callToSession.get(callId);
    if (!sessionId) {
      logger.warn('RealtimeSessionManager: no session for streamAudio', { callId });
      return;
    }

    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'active') {
      return;
    }

    const provider = ProviderManager.instance.getProvider<IRealtimeProvider>(session.providerName);
    // Convert inbound audio from Vobiz (8kHz mu-law) to PCM16 at provider's input rate
    const convertedAudio = convertInboundAudio(audioBase64, session.inputSampleRate);
    provider.sendAudio(sessionId, convertedAudio);

    session.audioPacketsSent++;
    session.lastAudioAt = Date.now();
  }

  /**
   * Sends a function call result back to OpenAI.
   */
  sendFunctionResult(callId: string, fnCallId: string, result: string): void {
    const sessionId = this.callToSession.get(callId);
    if (!sessionId) {
      logger.warn('RealtimeSessionManager: no session for sendFunctionResult', { callId });
      return;
    }

    const session = this.sessions.get(sessionId);
    const providerName = session ? session.providerName : 'openai-realtime';
    const provider = ProviderManager.instance.getProvider<IRealtimeProvider>(providerName);
    provider.sendFunctionResult(sessionId, fnCallId, result);
  }

  /**
   * Triggers the initial greeting for the active session.
   */
  triggerGreeting(callId: string, greetingText?: string): void {
    const sessionId = this.callToSession.get(callId);
    if (!sessionId) {
      logger.warn('RealtimeSessionManager: no session for triggerGreeting', { callId });
      return;
    }

    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'active') {
      return;
    }

    const provider = ProviderManager.instance.getProvider<IRealtimeProvider>(session.providerName);
    provider.triggerGreeting(sessionId, greetingText);
  }

  /**
   * Returns the current state of the session for a call.
   */
  getSessionState(callId: string): { status: SessionStatus; sessionId: string } | null {
    const sessionId = this.callToSession.get(callId);
    if (!sessionId) return null;

    const session = this.sessions.get(sessionId);
    if (!session) return null;

    return { status: session.status, sessionId };
  }

  /**
   * Returns metrics for the session associated with a call.
   */
  getMetrics(callId: string): SessionMetrics | null {
    const sessionId = this.callToSession.get(callId);
    if (!sessionId) return null;

    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const latencySamples = session.latencySamples;
    const sorted = [...latencySamples].sort((a, b) => a - b);

    return {
      latencyAvgMs:
        latencySamples.length > 0
          ? latencySamples.reduce((a, b) => a + b, 0) / latencySamples.length
          : 0,
      latencyP95Ms:
        sorted.length > 0
          ? sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1]
          : 0,
      totalTurns: 0, // Tracked by ConversationStateManager
      durationMs: Date.now() - session.createdAt,
      audioPacketsReceived: session.audioPacketsReceived,
      audioPacketsSent: session.audioPacketsSent,
    };
  }

  /**
   * Closes the OpenAI session for a call and cleans up tracking state.
   */
  async closeSession(callId: string): Promise<void> {
    const sessionId = this.callToSession.get(callId);
    if (!sessionId) {
      logger.debug('RealtimeSessionManager: no session to close', { callId });
      return;
    }

    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'closing';

      if (session.timeoutHandle) {
        clearTimeout(session.timeoutHandle);
        session.timeoutHandle = null;
      }
    }

    try {
      const providerName = session ? session.providerName : 'openai-realtime';
      const provider = ProviderManager.instance.getProvider<IRealtimeProvider>(providerName);
      await provider.closeSession(sessionId);
    } catch (err) {
      logger.warn('RealtimeSessionManager: error closing provider session', {
        callId,
        sessionId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    this.sessions.delete(sessionId);
    this.callToSession.delete(callId);

    this.callbacks.onSessionClosed?.(callId);

    logger.info('RealtimeSessionManager: session closed', { callId, sessionId });
  }

  /**
   * Returns count of active sessions (for health/metrics endpoints).
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Closes all active sessions. Used during graceful shutdown.
   */
  async closeAll(): Promise<void> {
    const callIds = Array.from(this.callToSession.keys());
    for (const callId of callIds) {
      await this.closeSession(callId);
    }
  }

  // ─── Private Helpers ────────────────────────────

  private getRealtimeProvider(): IRealtimeProvider {
    return ProviderManager.instance.getRealtimeProvider();
  }

  /**
   * Builds the callback object that OpenAI Realtime events are routed through.
   * Translates sessionId-scoped events into callId-scoped events for upstream.
   */
  private buildRealtimeCallbacks(callId: string): RealtimeEventCallbacks {
    return {
      onAudioDelta: (_sessionId: string, audioBase64: string) => {
        const session = this.sessions.get(_sessionId);
        let convertedAudio = audioBase64;
        if (session) {
          session.audioPacketsReceived++;
          // Convert outbound audio from provider PCM16 rate to Vobiz 8kHz mu-law
          convertedAudio = convertOutboundAudio(audioBase64, session.outputSampleRate);
        }
        this.callbacks.onAudioResponse?.(callId, convertedAudio);
      },

      onTranscriptDelta: (_sessionId: string, delta: string, isFinal: boolean) => {
        this.callbacks.onTranscript?.(callId, delta, isFinal, 'agent');
      },

      onSpeechStarted: (_sessionId: string) => {
        this.callbacks.onSpeechStarted?.(callId);
      },

      onSpeechStopped: (_sessionId: string) => {
        this.callbacks.onSpeechStopped?.(callId);
      },

      onFunctionCall: (_sessionId: string, fnCallId: string, name: string, args: string) => {
        this.callbacks.onFunctionCall?.(callId, fnCallId, name, args);
      },

      onError: (_sessionId: string, error: Error) => {
        logger.error('RealtimeSessionManager: session error', {
          callId,
          sessionId: _sessionId,
          error: error.message,
        });
        this.callbacks.onError?.(callId, error);
      },

      onResponseDone: (_sessionId: string) => {
        // Record latency from last audio input to response completion
        const session = this.sessions.get(_sessionId);
        if (session) {
          const latency = Date.now() - session.lastAudioAt;
          session.latencySamples.push(latency);
        }
        this.callbacks.onResponseDone?.(callId);
      },
    };
  }
}
