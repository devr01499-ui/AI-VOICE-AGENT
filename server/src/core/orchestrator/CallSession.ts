import { CallStatus } from '../../types';
import { SessionMetrics } from '../provider-sdk/provider.metrics';
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

  constructor(
    public readonly callId: string,
    public readonly agentId: string,
    public readonly recipientPhoneNumber: string
  ) {}

  updateStatus(status: CallStatus): void {
    this.status = status;
  }

  setProviderSessionId(sessionId: string): void {
    this.providerSessionId = sessionId;
  }
}
