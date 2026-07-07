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
  tools?: any[];
}

export class GeminiLiveLLMService {
  constructor(public readonly config: GeminiLiveLLMServiceConfig) {}
}
