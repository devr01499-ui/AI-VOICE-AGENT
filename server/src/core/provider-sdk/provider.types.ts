export type Speaker = 'agent' | 'user' | 'system';

export type SessionStatus = 'initializing' | 'active' | 'closing' | 'closed' | 'error';

export interface ProviderSessionConfig {
  callId: string;
  model: string;
  voice: string;
  instructions: string;
  tools?: ProviderToolDefinition[];
  inputAudioFormat?: string;
  outputAudioFormat?: string;
  apiVersion?: string;
}

export interface ProviderToolDefinition {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ProviderEventCallbacks {
  onAudioDelta?: (sessionId: string, audioBase64: string) => void;
  onTranscriptDelta?: (sessionId: string, delta: string, isFinal: boolean) => void;
  onSpeechStarted?: (sessionId: string) => void;
  onSpeechStopped?: (sessionId: string) => void;
  onFunctionCall?: (sessionId: string, callId: string, name: string, args: string) => void;
  onError?: (sessionId: string, error: Error) => void;
  onResponseDone?: (sessionId: string) => void;
}
