/**
 * Bolna Server — Provider Interfaces
 *
 * Abstract contracts for all external service integrations.
 * Implementations must handle connection lifecycle, health monitoring,
 * and graceful error propagation via ProviderError.
 */

import type WebSocket from 'ws';

// ─── Health Check Result ──────────────────────────────

export interface HealthCheckResult {
  healthy: boolean;
  latencyMs: number;
  details?: string;
}

// ─── Call Initiation Params ───────────────────────────

export interface InitiateCallParams {
  to: string;
  from: string;
  answerUrl: string;
  ringUrl?: string;
  hangupUrl?: string;
}

export interface InitiateCallResult {
  callUuid: string;
  requestUuid: string;
}

// ─── Call Status Result ───────────────────────────────

export interface CallStatusResult {
  status: string;
  direction: string;
  duration?: number;
}

// ─── Realtime Session Config ──────────────────────────

export interface RealtimeSessionConfig {
  model: string;
  voice: string;
  instructions: string;
  tools?: RealtimeToolDefinition[];
  inputAudioFormat?: string;
  outputAudioFormat?: string;
}

export interface RealtimeToolDefinition {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface RealtimeSessionResult {
  sessionId: string;
  ws: WebSocket;
}

// ─── Realtime Event Callbacks ─────────────────────────

export interface RealtimeEventCallbacks {
  onAudioDelta?: (sessionId: string, audioBase64: string) => void;
  onTranscriptDelta?: (sessionId: string, delta: string, isFinal: boolean) => void;
  onSpeechStarted?: (sessionId: string) => void;
  onSpeechStopped?: (sessionId: string) => void;
  onFunctionCall?: (sessionId: string, callId: string, name: string, args: string) => void;
  onError?: (sessionId: string, error: Error) => void;
  onResponseDone?: (sessionId: string) => void;
}

// ─── Base Provider Interface ──────────────────────────

export interface IBaseProvider {
  readonly name: string;
  readonly type: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<HealthCheckResult>;
}

// ─── Telephony Provider ───────────────────────────────

export interface ITelephonyProvider extends IBaseProvider {
  initiateCall(params: InitiateCallParams): Promise<InitiateCallResult>;
  terminateCall(callUuid: string): Promise<void>;
  getCallStatus(callUuid: string): Promise<CallStatusResult>;
}

// ─── Realtime AI Provider ─────────────────────────────

export interface IRealtimeProvider extends IBaseProvider {
  createSession(
    config: RealtimeSessionConfig,
    callbacks: RealtimeEventCallbacks
  ): Promise<RealtimeSessionResult>;
  sendAudio(sessionId: string, audioBase64: string): void;
  sendFunctionResult(sessionId: string, callId: string, result: string): void;
  commitAudioBuffer(sessionId: string): void;
  closeSession(sessionId: string): Promise<void>;
}
