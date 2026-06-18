// Bolna Voice Runtime Engine — Type Definitions

// ─────────────────────────────────────────────
// Core Enums (as union types)
// ─────────────────────────────────────────────

export type CallStatus =
  | 'queued'
  | 'ringing'
  | 'connected'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'no_answer'
  | 'busy'
  | 'cancelled';

export type CallDirection = 'inbound' | 'outbound';

export type Speaker = 'agent' | 'user' | 'system';

export type SessionStatus = 'initializing' | 'active' | 'closing' | 'closed' | 'error';

// ─────────────────────────────────────────────
// Agent Configuration (stored as JSON in agents table)
// ─────────────────────────────────────────────

export interface AgentConfig {
  prompt: string;
  voice: string; // alloy | nova | echo | fable | onyx | shimmer
  llm: {
    provider: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
  };
  tools?: ToolDefinition[];
  knowledgeBaseIds?: string[];
  settings?: {
    interruptionSensitivity?: number; // 0-1
    silenceTimeout?: number; // ms
    maxCallDuration?: number; // seconds
    greeting?: string;
    endCallPhrases?: string[];
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
  executionType: 'http' | 'webhook' | 'database' | 'builtin';
  config: Record<string, unknown>;
}

// ─────────────────────────────────────────────
// Conversation
// ─────────────────────────────────────────────

export interface ConversationTurn {
  speaker: Speaker;
  content: string;
  timestamp: number;
  toolCalls?: ToolCallResult[];
}

export interface ToolCallResult {
  toolName: string;
  parameters: Record<string, unknown>;
  result: unknown;
  durationMs: number;
  success: boolean;
  error?: string;
}

export interface ConversationState {
  callId: string;
  agentId: string;
  agentConfig: AgentConfig;
  turns: ConversationTurn[];
  contextVariables: Record<string, unknown>;
  userData: Record<string, unknown>;
  turnCount: number;
  isInterrupted: boolean;
  startedAt: number;
  lastActivityAt: number;
}

// ─────────────────────────────────────────────
// Vobiz Telephony Types
// ─────────────────────────────────────────────

export interface VobizCallbackPayload {
  From: string;
  To: string;
  CallUUID: string;
  RequestUUID: string;
  ALegRequestUUID?: string;
  Direction: string;
  Event: string;
  CallStatus: string;
  SessionStart?: string;
  StartTime?: string;
  AnswerTime?: string;
  EndTime?: string;
  STIRAttestation?: string;
}

export interface VobizStreamStartEvent {
  event: 'start';
  streamId: string;
  callId: string;
  metadata?: Record<string, unknown>;
}

export interface VobizStreamMediaEvent {
  event: 'media';
  streamId: string;
  media: {
    contentType: string;
    sampleRate: number;
    payload: string; // base64
  };
}

export interface VobizStreamStopEvent {
  event: 'stop';
  streamId: string;
  callId: string;
}

export type VobizStreamEvent =
  | VobizStreamStartEvent
  | VobizStreamMediaEvent
  | VobizStreamStopEvent
  | { event: 'playedStream'; streamId: string; name: string };

// ─────────────────────────────────────────────
// API Request/Response Shapes
// ─────────────────────────────────────────────

export interface InitiateCallRequest {
  phoneNumber: string;
  agentId: string;
  userId?: string;
  userData?: Record<string, unknown>;
}

export interface CallResponse {
  callId: string;
  status: CallStatus;
  phoneNumber: string;
  agentId: string;
  createdAt: string;
}

export interface TranscriptSegmentResponse {
  id: string;
  speaker: Speaker;
  content: string;
  startTime: number;
  endTime: number | null;
  sequenceNumber: number;
}

// ─────────────────────────────────────────────
// Session Metrics
// ─────────────────────────────────────────────

export interface SessionMetrics {
  latencyAvgMs: number;
  latencyP95Ms: number;
  totalTurns: number;
  durationMs: number;
  audioPacketsReceived: number;
  audioPacketsSent: number;
}
