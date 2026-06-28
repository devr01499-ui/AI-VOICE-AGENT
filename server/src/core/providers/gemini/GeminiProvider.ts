import { IRealtimeProviderSDK } from '../../provider-sdk/provider.interface';
import { ProviderSessionConfig, ProviderEventCallbacks } from '../../provider-sdk/provider.types';
import { HealthCheckResult, RealtimeSessionConfig } from '../../../providers/interfaces/IProvider';
import { GeminiLiveProvider as LowLevelGeminiLive } from '../../../providers/gemini/GeminiLiveProvider';
import { GeminiSession } from './GeminiSession';
import { metricsCollector } from '../../provider-sdk/provider.metrics';
import { logger } from '../../../utils/logger';

export class GeminiProvider implements IRealtimeProviderSDK {
  public readonly name = 'gemini-live';
  private readonly lowLevelProvider: LowLevelGeminiLive;
  private readonly sessions = new Map<string, GeminiSession>();

  constructor() {
    this.lowLevelProvider = new LowLevelGeminiLive();
  }

  async initialize(): Promise<void> {
    await this.lowLevelProvider.connect();
    logger.info('GeminiProvider SDK: initialized');
  }

  async connect(): Promise<void> {
    // lowLevelProvider handles socket connects lazily per-session,
    // which aligns with BidiGenerateContent design.
  }

  async disconnect(): Promise<void> {
    await this.lowLevelProvider.disconnect();
    this.sessions.clear();
    logger.info('GeminiProvider SDK: disconnected');
  }

  async createSession(
    config: ProviderSessionConfig,
    callbacks: ProviderEventCallbacks
  ): Promise<string> {
    const callId = config.callId;
    logger.info('GeminiProvider SDK: starting session for call', { callId });

    // Map SDK ProviderSessionConfig to low-level RealtimeSessionConfig
    const mappedConfig: RealtimeSessionConfig = {
      model: config.model,
      voice: config.voice,
      instructions: config.instructions,
      tools: config.tools?.map((t) => ({
        type: 'function',
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
      inputAudioFormat: 'pcm16',
      outputAudioFormat: 'pcm16',
    };

    if (config.apiVersion) {
      (mappedConfig as any).apiVersion = config.apiVersion;
    }

    const sessionObj = new GeminiSession(
      `gemini-sess-${Date.now()}`,
      callId,
      callbacks
    );

    // Build adapter callbacks pointing to our sessionObj state manager
    const realtimeCallbacks = {
      onAudioDelta: (_sessId: string, audioBase64: string) => {
        sessionObj.handleOutboundAudio(audioBase64);
      },
      onTranscriptDelta: (_sessId: string, delta: string, isFinal: boolean) => {
        sessionObj.handleTranscript(delta, isFinal);
      },
      onSpeechStarted: (_sessId: string) => {
        sessionObj.handleSpeechStarted();
      },
      onSpeechStopped: (_sessId: string) => {
        sessionObj.handleSpeechStopped();
      },
      onFunctionCall: (_sessId: string, callId: string, name: string, args: string) => {
        sessionObj.handleFunctionCall(callId, name, args);
      },
      onError: (_sessId: string, error: Error) => {
        sessionObj.handleError(error);
      },
      onResponseDone: (_sessId: string) => {
        callbacks.onResponseDone?.(sessionObj.sessionId);
      },
    };

    const { sessionId } = await this.lowLevelProvider.createSession(mappedConfig, realtimeCallbacks);
    
    // Override the auto-generated low-level ID with our custom trackable ID
    const trackedSessionId = sessionId || sessionObj.sessionId;
    this.sessions.set(trackedSessionId, sessionObj);
    metricsCollector.initializeSession(trackedSessionId);

    logger.info('GeminiProvider SDK: session created', { sessionId: trackedSessionId });
    return trackedSessionId;
  }

  async endSession(sessionId: string): Promise<void> {
    logger.info('GeminiProvider SDK: closing session', { sessionId });
    await this.lowLevelProvider.closeSession(sessionId);
    this.sessions.delete(sessionId);
  }

  sendAudio(sessionId: string, audioBase64: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Route inbound audio through bridge (mu-law 8kHz -> PCM16 16kHz)
    const processedAudio = session.handleInboundAudio(audioBase64);
    this.lowLevelProvider.sendAudio(sessionId, processedAudio);
  }

  sendText(sessionId: string, text: string): void {
    // Gemini Live initiates user turns via clientContent / turns
    this.lowLevelProvider.triggerGreeting(sessionId, text);
  }

  triggerGreeting(sessionId: string, greetingText?: string): void {
    this.lowLevelProvider.triggerGreeting(sessionId, greetingText);
  }

  receiveTranscript(sessionId: string, callback: (text: string, isFinal: boolean) => void): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.addTranscriptCallback(callback);
    }
  }

  interrupt(sessionId: string): void {
    // Gemini Live clears audio playback queue on User turns automatically
  }

  sendFunctionResult(sessionId: string, callId: string, result: string): void {
    this.lowLevelProvider.sendFunctionResult(sessionId, callId, result);
  }

  async ping(sessionId: string): Promise<number> {
    const start = Date.now();
    const metrics = metricsCollector.getMetrics(sessionId);
    const latency = metrics ? metrics.latencyMs : 0;
    metricsCollector.updateLatency(sessionId, Date.now() - start + latency);
    return Date.now() - start;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return this.lowLevelProvider.healthCheck();
  }
}
