declare module 'pipecat-core' {
  export class Pipeline {
    constructor(services: any[]);
    pushInputFrame(frame: { type: string; data: Buffer; sampleRate?: number; channels?: number }): void;
    addOutputSink(callback: (frame: { type: string; data: Buffer }) => void): void;
    registerVadObserver(callback: (speechStarted: boolean) => void): void;
    flushOutputQueue(): void;
    run(): Promise<void>;
    stop(): Promise<void>;
  }
}

declare module '@pipecat-ai/gemini' {
  export interface GeminiLiveLLMServiceConfig {
    apiKey: string;
    model: string;
    apiVersion: string;
    voiceConfig: {
      prebuiltVoiceConfig: {
        voiceName: string;
      };
    };
    systemInstruction: string;
  }

  export class GeminiLiveLLMService {
    constructor(config: GeminiLiveLLMServiceConfig);
  }
}
