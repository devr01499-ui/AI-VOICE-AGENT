import { ProviderEventCallbacks } from '../../provider-sdk/provider.types';
import { GeminiAudioBridge } from './GeminiAudioBridge';
import { metricsCollector } from '../../provider-sdk/provider.metrics';

export class GeminiSession {
  private audioCallbacks: ((audioBase64: string) => void)[] = [];
  private transcriptCallbacks: ((text: string, isFinal: boolean) => void)[] = [];

  constructor(
    public readonly sessionId: string,
    public readonly callId: string,
    private readonly callbacks: ProviderEventCallbacks
  ) {}

  addAudioCallback(callback: (audioBase64: string) => void): void {
    this.audioCallbacks.push(callback);
  }

  clearAudioCallbacks(): void {
    this.audioCallbacks = [];
  }

  addTranscriptCallback(callback: (text: string, isFinal: boolean) => void): void {
    this.transcriptCallbacks.push(callback);
  }

  handleInboundAudio(audioBase64: string): string {
    metricsCollector.recordAudioChunkSent(this.sessionId);
    // Convert 8kHz mu-law to 16kHz PCM16 via the Audio Bridge
    return GeminiAudioBridge.toGeminiAudio(audioBase64);
  }

  handleOutboundAudio(audioBase64: string): void {
    metricsCollector.recordAudioChunkReceived(this.sessionId);
    // Convert 24kHz PCM16 output back to 8kHz mu-law
    const converted = GeminiAudioBridge.toVobizAudio(audioBase64);
    
    // Distribute to internal listeners
    this.audioCallbacks.forEach((cb) => cb(converted));
    this.callbacks.onAudioDelta?.(this.sessionId, converted);
  }

  handleTranscript(text: string, isFinal: boolean): void {
    this.transcriptCallbacks.forEach((cb) => cb(text, isFinal));
    this.callbacks.onTranscriptDelta?.(this.sessionId, text, isFinal);
  }

  handleSpeechStarted(): void {
    this.callbacks.onSpeechStarted?.(this.sessionId);
  }

  handleSpeechStopped(): void {
    this.callbacks.onSpeechStopped?.(this.sessionId);
  }

  handleFunctionCall(callId: string, name: string, args: string): void {
    this.callbacks.onFunctionCall?.(this.sessionId, callId, name, args);
  }

  handleError(error: Error): void {
    metricsCollector.incrementError(this.sessionId);
    this.callbacks.onError?.(this.sessionId, error);
  }
}
