import { HealthCheckResult } from '../../providers/interfaces/IProvider';
import { ProviderSessionConfig, ProviderEventCallbacks } from './provider.types';

export interface IRealtimeProviderSDK {
  readonly name: string;

  initialize(): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  startSession(
    callId: string,
    config: ProviderSessionConfig,
    callbacks: ProviderEventCallbacks
  ): Promise<string>;

  endSession(sessionId: string): Promise<void>;

  sendAudio(sessionId: string, audioBase64: string): void;
  receiveAudio(sessionId: string, callback: (audioBase64: string) => void): void;

  sendText(sessionId: string, text: string): void;
  receiveTranscript(sessionId: string, callback: (text: string, isFinal: boolean) => void): void;

  sendFunctionResult(sessionId: string, callId: string, result: string): void;

  interrupt(sessionId: string): void;

  ping(sessionId: string): Promise<number>;
  healthCheck(): Promise<HealthCheckResult>;
}
