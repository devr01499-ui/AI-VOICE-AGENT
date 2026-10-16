import { GeminiLiveLLMService } from './gemini';
import { GeminiLiveProvider } from '../../../providers/gemini/GeminiLiveProvider';
import { logger } from '../../../utils/logger';
import { eventBus, PROVIDER_EVENTS } from '../../provider-sdk/provider.events';
import { TurnAggregator } from '../../../runtime/TurnAggregator';

export class Pipeline {
  private readonly service: GeminiLiveLLMService;
  private readonly provider: GeminiLiveProvider;
  private sessionId: string | null = null;
  private sessionStartTime: number = Date.now();
  private onAudioOutputCallback: ((frame: { type: string; data: Buffer }) => void) | null = null;
  private onVadSpeechStartedCallback: ((speechStarted: boolean) => void) | null = null;
  private turnAggregator: TurnAggregator | null = null;

  constructor(
    services: any[],
    private readonly callId: string,
    private readonly onFunctionCallCallback?: (toolCallId: string, name: string, args: string) => Promise<string>,
    private readonly userId?: string,
    private readonly agentId?: string
  ) {
    this.service = services[0];
    this.provider = new GeminiLiveProvider();
  }

  addOutputSink(callback: (frame: { type: string; data: Buffer }) => void): void {
    this.onAudioOutputCallback = callback;
  }

  registerVadObserver(callback: (speechStarted: boolean) => void): void {
    this.onVadSpeechStartedCallback = callback;
  }

  flushOutputQueue(): void {
    if (this.sessionId) {
      this.provider.commitAudioBuffer(this.sessionId);
    }
  }

  pushInputFrame(frame: { type: string; data: Buffer; sampleRate?: number; channels?: number }): void {
    if (!this.sessionId) {
      logger.warn('Pipeline: pushInputFrame called but session is not running');
      return;
    }

    if (frame.type === 'audio') {
      const base64 = frame.data.toString('base64');
      this.provider.sendAudio(this.sessionId, base64);
    } else if (frame.type === 'text') {
      const text = frame.data.toString();
      this.provider.triggerGreeting(this.sessionId, text);
    }
  }

  async run(): Promise<void> {
    this.sessionStartTime = Date.now();
    this.turnAggregator = new TurnAggregator(this.callId, this.sessionStartTime);

    const config = {
      callId: this.callId,
      model: this.service.config.model,
      voice: this.service.config.voiceConfig.prebuiltVoiceConfig.voiceName,
      instructions: this.service.config.systemInstruction,
      tools: this.service.config.tools,
      userId: this.userId,
      agentId: this.agentId,
    };

    const callbacks = {
      onAudioDelta: (sessId: string, audioBase64: string) => {
        if (this.onAudioOutputCallback) {
          this.onAudioOutputCallback({
            type: 'audio',
            data: Buffer.from(audioBase64, 'base64'),
          });
        }
      },
      onTranscriptDelta: (sessId: string, text: string, isFinal: boolean, isUser?: boolean) => {
        if (this.turnAggregator) {
          this.turnAggregator.handleFragment(isUser ? 'user' : 'agent', text, isFinal);
        }
      },
      onSpeechStopped: (sessId: string, interrupted?: boolean) => {
        if (interrupted) {
          if (this.turnAggregator) {
            this.turnAggregator.handleInterruption();
          }
          if (this.onVadSpeechStartedCallback) {
            this.onVadSpeechStartedCallback(true);
          }
        }
      },
      onFunctionCall: async (sessId: string, toolCallId: string, name: string, args: string) => {
        if (this.onFunctionCallCallback) {
          try {
            const resultJson = await this.onFunctionCallCallback(toolCallId, name, args);
            this.provider.sendFunctionResult(sessId, toolCallId, resultJson);
          } catch (err) {
            logger.error('Pipeline: onFunctionCallCallback error', { toolCallId, name, err });
          }
        }
      },
      onError: (sessId: string, error: Error) => {
        logger.error('Pipeline Runtime Error:', { callId: this.callId, message: error.message, stack: error.stack });
        eventBus.publish(PROVIDER_EVENTS.ERROR_OCCURRED, {
          callId: this.callId,
          reason: error.message,
        });

        // Trigger AI stopped speaking event to prevent dead air and inform socket handlers to close or play fallback
        eventBus.publish(PROVIDER_EVENTS.AI_STOPPED_SPEAKING, {
          callId: this.callId,
          interrupted: false,
          error: error.message,
        });
      },
    };

    const result = await this.provider.createSession(config, callbacks);
    this.sessionId = result.sessionId;
  }

  async stop(): Promise<void> {
    if (this.turnAggregator) {
      this.turnAggregator.destroy();
      this.turnAggregator = null;
    }
    if (this.sessionId) {
      await this.provider.closeSession(this.sessionId);
      this.sessionId = null;
    }
  }
}

