import { CallStatus } from '../../types';
import { PipecatRunner } from '../pipeline/PipecatRunner';

export interface IConversationState {
  phase: 'greeting_sent' | 'listening' | 'processing' | 'responding';
  isReadyForUserAudio(): boolean;
  markAsListening(): void;
  markAsProcessing(): void;
  markAsResponding(): void;
}

export class CallSession {
  public providerSessionId: string | null = null;
  public pipecatRunner?: PipecatRunner;
  public startedAt: number = Date.now();
  public status: CallStatus = 'queued';
  public conversationState?: IConversationState;
  public inboundAudioAllowed: boolean = false;
  public isRecordingEnabled: boolean = false;
  /** Where the AI's audio goes (the caller's stream); reused when another agent takes over. */
  public audioSink?: (audioBase64: string) => void;
  public agentName: string | null = null;

  constructor(
    public readonly callId: string,
    public readonly agentId: string,
    public readonly recipientPhoneNumber: string,
    public readonly agent?: { systemPrompt?: string | null; voiceName?: string | null; model?: string | null }
  ) {}

  updateStatus(status: CallStatus): void {
    this.status = status;
  }

  setProviderSessionId(sessionId: string): void {
    this.providerSessionId = sessionId;
  }
}
