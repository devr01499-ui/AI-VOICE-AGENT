import { Pipeline } from 'pipecat-core';
import { GeminiLiveLLMService } from '@pipecat-ai/gemini';
import { logger } from '../../utils/logger';

export class PipecatRunner {
  private readonly pipeline: Pipeline;
  private readonly geminiService: GeminiLiveLLMService;

  constructor(
    public readonly callId: string,
    private readonly onAudioOutput: (audioBase64: string) => void
  ) {
    // 2. SECURE THE MULTIMODAL PROVIDER BUS
    this.geminiService = new GeminiLiveLLMService({
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
      model: 'models/gemini-2.5-flash-native-audio-latest',
      apiVersion: 'v1alpha',
      voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
      systemInstruction: "You are Clarity AI, a professional talent manager running a brief, concise candidate screening interview. Be warm, speak in brief sentences, allow natural pauses, and stop immediately if the user talks over you."
    });

    // 1. PIPELINE INGESTION INTERFACE
    this.pipeline = new Pipeline([this.geminiService]);

    // 3. NATIVE ASYNC BARGE-IN DEFENSE
    // Register the Pipecat pipeline's VAD observer hook.
    this.pipeline.registerVadObserver((speechStarted: boolean) => {
      if (speechStarted) {
        logger.info('PipecatRunner: VAD detected user speech. Flushing pipeline output queue (barge-in defense).', { callId: this.callId });
        this.pipeline.flushOutputQueue();
      }
    });

    // 4. REAL-TIME RETURN AUDIO ROUTING
    // Catch Gemini's returned native audio frames and stream the binary buffers directly down the Vobiz socket
    this.pipeline.addOutputSink((frame: { type: string; data: Buffer }) => {
      if (frame && frame.type === 'audio' && frame.data) {
        const audioBase64 = frame.data.toString('base64');
        this.onAudioOutput(audioBase64);
      }
    });
  }

  /**
   * Consume incoming 16kHz L16 byte arrays straight from Vobiz WebSocket connections.
   */
  handleInboundAudio(audioBase64: string): void {
    const buffer = Buffer.from(audioBase64, 'base64');
    this.pipeline.pushInputFrame({
      type: 'audio',
      data: buffer,
      sampleRate: 16000,
      channels: 1
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
    await this.pipeline.stop();
  }
}
