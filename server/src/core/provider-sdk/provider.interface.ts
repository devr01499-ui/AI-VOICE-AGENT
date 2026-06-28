import { HealthCheckResult } from '../../providers/interfaces/IProvider';
import { ProviderSessionConfig, ProviderEventCallbacks } from './provider.types';

export interface IRealtimeProviderSDK {
  readonly name: string;

  initialize(): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  createSession(
    config: ProviderSessionConfig,
    callbacks: ProviderEventCallbacks
  ): Promise<string>;

  endSession(sessionId: string): Promise<void>;

  sendAudio(sessionId: string, audioBase64: string): void;

  sendText(sessionId: string, text: string): void;
  receiveTranscript(sessionId: string, callback: (text: string, isFinal: boolean) => void): void;

  sendFunctionResult(sessionId: string, callId: string, result: string): void;

  interrupt(sessionId: string): void;

  triggerGreeting(sessionId: string, greetingText?: string): void;

  ping(sessionId: string): Promise<number>;
  healthCheck(): Promise<HealthCheckResult>;
}
