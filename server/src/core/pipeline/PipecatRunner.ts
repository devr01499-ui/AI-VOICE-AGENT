import * as fs from 'fs';
import * as path from 'path';
import { Pipeline } from './pipecat/core';
import { GeminiLiveLLMService } from './pipecat/gemini';
import { logger } from '../../utils/logger';
import { convertInboundAudio, convertOutboundAudio } from '../../utils/audioConverter';
import { eventBus, PROVIDER_EVENTS } from '../provider-sdk/provider.events';

export class PipecatRunner {
  private readonly pipeline: Pipeline;
  private readonly geminiService: GeminiLiveLLMService;
  private recordingStream?: fs.WriteStream;

  constructor(
    public readonly callId: string,
    config: {
      model: string;
      voice: string;
      instructions: string;
      isRecordingEnabled?: boolean;
      isTranscriptionEnabled?: boolean;
      tools?: any[];
    },
    private readonly onAudioOutput: (audioBase64: string) => void,
    onFunctionCall?: (toolCallId: string, name: string, args: string) => Promise<string>
  ) {
    logger.info('PipecatRunner: initializing pipeline', {
      callId,
      model: config.model,
      voice: config.voice,
      isRecordingEnabled: config.isRecordingEnabled,
      isTranscriptionEnabled: config.isTranscriptionEnabled,
    });

    // 1. Setup call recording stream if enabled
    if (config.isRecordingEnabled) {
      try {
        const recordingsDir = path.join(process.cwd(), 'recordings');
        if (!fs.existsSync(recordingsDir)) {
          fs.mkdirSync(recordingsDir, { recursive: true });
        }
        const recordingPath = path.join(recordingsDir, `${this.callId}.pcm`);
        this.recordingStream = fs.createWriteStream(recordingPath);
        logger.info('PipecatRunner: Call recording enabled. Created write stream', { recordingPath });
      } catch (err) {
        logger.error('PipecatRunner: Failed to initialize call recording write stream', { error: String(err) });
      }
    }

    // 2. SECURE THE MULTIMODAL PROVIDER BUS
    this.geminiService = new GeminiLiveLLMService({
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
      model: config.model,
      apiVersion: 'v1alpha',
      voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voice } },
      systemInstruction: config.instructions,
      tools: config.tools,
    });

    // 1. PIPELINE INGESTION INTERFACE
    this.pipeline = new Pipeline([this.geminiService], this.callId, onFunctionCall);

    // 3. NATIVE ASYNC BARGE-IN DEFENSE
    // Register the Pipecat pipeline's VAD observer hook.
    this.pipeline.registerVadObserver((speechStarted: boolean) => {
      if (speechStarted) {
        logger.info('PipecatRunner: VAD detected user speech. Flushing pipeline output queue (barge-in defense).', { callId: this.callId });
        this.pipeline.flushOutputQueue();
        
        // Notify socket handlers that speech has been interrupted (barge-in)
        eventBus.publish(PROVIDER_EVENTS.AI_STOPPED_SPEAKING, {
          callId: this.callId,
          interrupted: true,
        });
      }
    });

    // 4. REAL-TIME RETURN AUDIO ROUTING
    // Catch Gemini's returned native audio frames and stream the binary buffers directly down the Vobiz socket
    this.pipeline.addOutputSink((frame: { type: string; data: Buffer }) => {
      if (frame && frame.type === 'audio' && frame.data) {
        // Record output audio stream if active
        if (this.recordingStream) {
          this.recordingStream.write(frame.data);
        }

        const telephonyCompressed = convertOutboundAudio(frame.data);
        this.onAudioOutput(telephonyCompressed);
      }
    });
  }

  handleInboundAudio(audioBase64: string): void {
    const base64Str = convertInboundAudio(audioBase64);
    const buffer = Buffer.from(base64Str, 'base64');

    // Record input audio stream if active
    if (this.recordingStream) {
      this.recordingStream.write(buffer);
    }

    this.pipeline.pushInputFrame({
      type: 'audio',
      data: buffer,
      sampleRate: 16000,
      channels: 1
    });
  }

  /**
   * Triggers the greeting turn text frame in the pipeline.
   */
  triggerGreeting(greetingText?: string): void {
    logger.info('PipecatRunner: triggering greeting turn', { callId: this.callId });
    const textPrompt = greetingText || 'Hi, please start the interview.';
    this.pipeline.pushInputFrame({
      type: 'text',
      data: Buffer.from(textPrompt)
    });
  }

  /**
   * Starts the pipeline runtime.
   */
  async start(): Promise<void> {
    logger.info('PipecatRunner: starting pipeline execution', { callId: this.callId });
    await this.pipeline.run();
  }

  /**
   * Stops the pipeline runtime.
   */
  async stop(): Promise<void> {
    logger.info('PipecatRunner: stopping pipeline execution', { callId: this.callId });
    if (this.recordingStream) {
      this.recordingStream.end();
      logger.info('PipecatRunner: Closed call recording write stream', { callId: this.callId });
    }
    await this.pipeline.stop();
  }
}
