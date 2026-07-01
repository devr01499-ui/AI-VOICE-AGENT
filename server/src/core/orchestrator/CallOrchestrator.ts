import { providerManagerSDK } from '../provider-sdk/provider.manager';
import { metricsCollector } from '../provider-sdk/provider.metrics';
import { eventBus, PROVIDER_EVENTS } from '../provider-sdk/provider.events';
import { ProviderSessionConfig, ProviderEventCallbacks } from '../provider-sdk/provider.types';
import { CallSession, IConversationState } from './CallSession';
import { CallStateMachine } from './CallStateMachine';
import { VobizService } from '../telephony/VobizService';
import { TranscriptRecorder } from '../telephony/TranscriptRecorder';
import { SessionLogger } from '../telephony/SessionLogger';
import { AgentRepository } from '../../repositories/AgentRepository';
import { CallRepository } from '../../repositories/CallRepository';
import { ToolExecutor } from '../../runtime/ToolExecutor';
import { CallError } from '../../types/errors';
import { AgentConfig, CallStatus } from '../../types';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { mulawToPCM16 } from '../../utils/audioConverter';

class ConversationState implements IConversationState {
  phase: 'greeting_sent' | 'listening' | 'processing' | 'responding' = 'greeting_sent';
  lastSpeechTime: number = 0;
  silenceThresholdMs: number = 1500;
  speechThreshold: number = 1000;
  
  isReadyForUserAudio(): boolean {
    return this.phase === 'listening' || this.phase === 'processing';
  }
  
  markAsListening() {
    this.phase = 'listening';
  }
  
  markAsProcessing() {
    this.phase = 'processing';
    this.lastSpeechTime = Date.now();
  }
  
  markAsResponding() {
    this.phase = 'responding';
  }
}

export class CallOrchestrator {
  private static _instance: CallOrchestrator | null = null;
  private readonly activeCalls = new Map<string, CallSession>();
  private readonly stateMachines = new Map<string, CallStateMachine>();
  private readonly toolExecutor = new ToolExecutor();

  private constructor() {
    this.subscribeToEventBus();
  }

  static get instance(): CallOrchestrator {
    if (!CallOrchestrator._instance) {
      CallOrchestrator._instance = new CallOrchestrator();
    }
    return CallOrchestrator._instance;
  }

  getActiveCallCount(): number {
    return this.activeCalls.size;
  }

  /**
   * Placed outbound call handler.
   */
  async initiateOutboundCall(
    phoneNumber: string,
    agentId: string,
    userId: string,
    fromPhoneNumber: string,
    maxDuration: number
  ): Promise<string> {
    // 1. Create Call database records
    const call = await CallRepository.create({
      agentId,
      userId,
      recipientPhoneNumber: phoneNumber,
      fromPhoneNumber,
      userData: '{}',
      maxDuration,
    });

    const stateMachine = new CallStateMachine(call.id);
    this.stateMachines.set(call.id, stateMachine);

    // 2. Trigger SIP Call
    try {
      const publicUrl = env.PUBLIC_URL;
      if (!publicUrl) {
        throw new Error('env.PUBLIC_URL not configured');
      }

      await VobizService.placeCall({
        to: phoneNumber,
        from: fromPhoneNumber,
        answerUrl: `${publicUrl}/api/v2/webhooks/vobiz/answer?callId=${call.id}`,
        ringUrl: `${publicUrl}/api/v2/webhooks/vobiz/status?callId=${call.id}`,
        hangupUrl: `${publicUrl}/api/v2/webhooks/vobiz/hangup?callId=${call.id}`,
      });

      stateMachine.transitionTo('ringing');
      await CallRepository.updateStatus(call.id, 'ringing');
      eventBus.publish(PROVIDER_EVENTS.CALL_STARTED, { callId: call.id });

    } catch (err) {
      stateMachine.transitionTo('failed');
      await CallRepository.updateStatus(call.id, 'failed');
      throw err;
    }

    return call.id;
  }

  /**
   * Starts a voice provider session once the telephony answers the call.
   */
  async startVoiceSession(
    callId: string,
    agentId: string,
    phoneNumber: string,
    onAudioDelta?: (audioBase64: string) => void
  ): Promise<string> {
    logger.info('CallOrchestrator: startVoiceSession', { callId, agentId });

    const agent = await AgentRepository.findById(agentId);
    if (!agent.agentConfig || agent.agentConfig === '{}') {
      throw new CallError(callId, 'Agent configuration is empty. Please configure the agent first.');
    }

    let agentConfig: AgentConfig;
    try {
      const rawConfig = JSON.parse(agent.agentConfig) as any;

      const defaultPrompt = 
        "You are Priya, a friendly, professional AI HR Recruiter from Delhi Tech Careers calling about a Software Engineer job opening. " +
        "Your task is to pre-qualify the candidate's technical stack (specifically React and TypeScript experience). " +
        "You must keep all your responses extremely concise—strictly under 2 sentences per turn. " +
        "Permit yourself to use occasional conversational fillers at the beginning of a sentence (e.g., 'Got it...', 'Ah, interesting...', 'Right...', 'Ok...'). " +
        "Use commas (,) and ellipsis (...) cleanly inside your replies to introduce natural micro-pauses so that the text-to-speech engine speaks with realistic breathing points and pitch changes.";

      const voiceName = rawConfig.voice || rawConfig.voice_config?.voice || 'alloy';
      const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'shimmer'];
      if (!validVoices.includes(voiceName.toLowerCase())) {
        throw new Error(`Invalid voice: ${voiceName}. Must be one of: ${validVoices.join(', ')}`);
      }

      const llmProvider = rawConfig.llm?.provider || 
        (Boolean(env.GEMINI_API_KEY || env.GOOGLE_API_KEY) ? 'gemini' : 'openai');
      const validProviders = ['gemini', 'openai'];
      if (!validProviders.includes(llmProvider.toLowerCase())) {
        throw new Error(`Invalid LLM provider: ${llmProvider}`);
      }

      // Build validated config
      agentConfig = {
        prompt: rawConfig.prompt || rawConfig.system_prompt || defaultPrompt,
        voice: voiceName,
        llm: {
          provider: llmProvider,
          model: rawConfig.llm_config?.model || 
            (llmProvider === 'gemini' ? 'gemini-2.0-flash' : 'gpt-4o-realtime-preview'),
        },
        tools: rawConfig.tools,
        knowledgeBaseIds: rawConfig.knowledgeBaseIds,
        settings: rawConfig.settings,
      };

      logger.info('CallOrchestrator: agent config validated', { 
        callId, 
        agentId,
        voice: agentConfig.voice,
        provider: agentConfig.llm.provider,
      });

    } catch (err) {
      throw new CallError(
        callId, 
        `Invalid agent configuration: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // Register active tools
    if (agentConfig.tools && agentConfig.tools.length > 0) {
      this.toolExecutor.clearRegistry();
      this.toolExecutor.registerTools(agentConfig.tools);
    }

    const stateMachine = this.stateMachines.get(callId) || new CallStateMachine(callId);
    this.stateMachines.set(callId, stateMachine);
    stateMachine.transitionTo('in_progress');

    const callSession = new CallSession(callId, agentId, phoneNumber);
    callSession.conversationState = new ConversationState();
    this.activeCalls.set(callId, callSession);

    // Mapped config structure passed down to SDK Provider
    const providerName = agentConfig.llm.provider === 'openai' ? 'openai' : 'gemini';
    const config: ProviderSessionConfig = {
      callId,
      model: agentConfig.llm.model,
      voice: agentConfig.voice,
      instructions: agentConfig.prompt,
      tools: agentConfig.tools?.map((t) => ({
        type: 'function',
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
    };

    const callbacks: ProviderEventCallbacks = {
      onAudioDelta: (sessId, audioBase64) => {
        logger.info('Audio response from Gemini', { callId, bytes: audioBase64?.length });
        onAudioDelta?.(audioBase64);
      },
      onTranscriptDelta: (sessId, delta, isFinal, isUser) => {
        TranscriptRecorder.recordSegment(callId, isUser ? 'user' : 'agent', delta);
        if (isUser) {
          logger.info('User transcript', { callId, text: delta });
        } else {
          logger.info('AI transcript', { callId, text: delta });
        }
      },
      onSpeechStarted: (sessId) => {
        const session = this.activeCalls.get(callId);
        if (session?.conversationState) {
          session.conversationState.markAsResponding();
          logger.info('AI speech started, state set to responding', { callId });
        }
        eventBus.publish(PROVIDER_EVENTS.AI_STARTED_SPEAKING, { callId, sessionId: sessId });
      },
      onSpeechStopped: (sessId, interrupted?: boolean) => {
        const session = this.activeCalls.get(callId);
        if (session?.conversationState && session.conversationState.phase === 'responding') {
          session.conversationState.markAsListening();
          logger.info('AI speech stopped / interrupted, listening again', { callId });
        }
        eventBus.publish(PROVIDER_EVENTS.AI_STOPPED_SPEAKING, { callId, sessionId: sessId, interrupted });
      },
      onFunctionCall: async (sessId, toolCallId, name, args) => {
        try {
          const parsedArgs = JSON.parse(args) as Record<string, unknown>;
          const result = await this.toolExecutor.executeTool(name, parsedArgs);
          providerManagerSDK.getProvider(providerName).sendFunctionResult(sessId, toolCallId, JSON.stringify(result));
        } catch (err) {
          logger.error('CallOrchestrator: tool execution error', { toolCallId, name, err });
        }
      },
      onResponseDone: (sessId) => {
        const session = this.activeCalls.get(callId);
        if (session?.conversationState) {
          session.conversationState.markAsListening();
          logger.info('AI response complete, listening again', { callId });
        }
      },
      onError: (sessId, error) => {
        logger.error('Gemini error', { callId, error: error.message });
        eventBus.publish(PROVIDER_EVENTS.ERROR_OCCURRED, { callId, error: error.message });
      },
    };

    const providerSessionId = await providerManagerSDK.startSession(providerName, callId, config, callbacks);
    callSession.setProviderSessionId(providerSessionId);

    await CallRepository.updateStatus(callId, 'in_progress', { startTime: new Date() });

    return providerSessionId;
  }

  /**
   * Streams inbound audio from SIP channel to the provider.
   */
  private calculateRMS(mulawBase64: string): number {
    try {
      const pcm16Base64 = mulawToPCM16(mulawBase64);
      const buffer = Buffer.from(pcm16Base64, 'base64');
      const numSamples = buffer.length / 2;
      if (numSamples === 0) return 0;
      
      let sumSquares = 0;
      for (let i = 0; i < numSamples; i++) {
        const sample = buffer.readInt16LE(i * 2);
        sumSquares += sample * sample;
      }
      return Math.sqrt(sumSquares / numSamples);
    } catch (err) {
      return 0;
    }
  }

  processAudioStream(callId: string, audioBase64: string): void {
    const session = this.activeCalls.get(callId);
    if (!session) return;

    const state = session.conversationState as ConversationState;
    if (!state) return;

    // Run Server-Side VAD on incoming audio
    const rms = this.calculateRMS(audioBase64);
    const now = Date.now();

    if (rms > state.speechThreshold) {
      state.lastSpeechTime = now;
      if (state.phase === 'listening') {
        state.markAsProcessing();
        logger.info('VAD: User started speaking', { callId, rms });
        eventBus.publish(PROVIDER_EVENTS.USER_STARTED_SPEAKING, { callId });
      } else if (state.phase === 'responding') {
        // User barge-in / interruption detected!
        state.markAsProcessing();
        logger.info('VAD: User barge-in detected (speech during response)', { callId, rms });
        eventBus.publish(PROVIDER_EVENTS.USER_STARTED_SPEAKING, { callId });
      }
    } else {
      // Silence detected
      if (state.phase === 'processing') {
        const silentDuration = now - state.lastSpeechTime;
        if (silentDuration >= state.silenceThresholdMs) {
          state.markAsResponding();
          logger.info('VAD: Silence duration reached, user finished speaking', { callId, silentDuration });
          eventBus.publish(PROVIDER_EVENTS.USER_STOPPED_SPEAKING, { callId });
        }
      }
    }

    // Only forward audio if we are in listening or processing state
    if (!state.isReadyForUserAudio()) {
      logger.info('Audio arrived but AI not ready (dropped)', { callId, phase: state.phase });
      return;
    }

    if (!session.providerSessionId) return;

    logger.info('Sending user audio to Gemini', { callId, bytes: audioBase64.length });
    providerManagerSDK.sendAudio(session.providerSessionId, audioBase64);
  }

  triggerGreeting(callId: string, sessionId: string, greetingText?: string): void {
    const provider = providerManagerSDK.getProvider('gemini');
    provider.triggerGreeting(sessionId, greetingText);

    // After greeting sent, mark that we're ready for user input
    setTimeout(() => {
      const session = this.activeCalls.get(callId);
      if (session?.conversationState) {
        session.conversationState.markAsListening();
        logger.info('Now listening for user input', { callId });
      }
    }, 1500);  // Wait 1.5 seconds after greeting
  }

  /**
   * Ends a session, clean up resources, and records session metrics.
   */
  async endCallSession(callId: string, reason: string): Promise<void> {
    logger.info('CallOrchestrator: endCallSession', { callId, reason });

    const session = this.activeCalls.get(callId);
    if (session) {
      if (session.providerSessionId) {
        await providerManagerSDK.endSession(session.providerSessionId);
      }
      this.activeCalls.delete(callId);
    }

    const stateMachine = this.stateMachines.get(callId);
    if (stateMachine) {
      const mappedStatus: CallStatus = reason === 'completed' || reason === 'user_hangup' || reason === 'stream_stopped'
        ? 'completed'
        : 'failed';
      stateMachine.transitionTo(mappedStatus);
      this.stateMachines.delete(callId);

      await CallRepository.updateStatus(callId, mappedStatus, { endTime: new Date() });
      await SessionLogger.logCallEnded(callId, reason, session?.providerSessionId || '');
    }
  }

  getSessionInfo(callId: string) {
    const session = this.activeCalls.get(callId);
    const active = Boolean(session);
    const providerSessionId = session?.providerSessionId;
    const metrics = providerSessionId ? metricsCollector.getMetrics(providerSessionId) : null;
    return {
      active,
      metrics: metrics ? {
        latencyAvgMs: metrics.latencyMs,
        durationMs: Date.now() - session!.startedAt,
        audioPacketsReceived: metrics.audioChunksReceived,
        audioPacketsSent: metrics.audioChunksSent,
      } : null,
      conversationTurns: 0,
    };
  }

  async shutdownAll(): Promise<void> {
    logger.info('CallOrchestrator: shutting down all sessions');
    for (const [callId] of this.activeCalls) {
      try {
        await this.endCallSession(callId, 'system_shutdown');
      } catch (err) {
        logger.error('CallOrchestrator: failed to end session during shutdown', { callId, err });
      }
    }
  }

  // ─── Event Bus Listeners ──────────────────────────

  private subscribeToEventBus(): void {
    eventBus.subscribe(PROVIDER_EVENTS.CALL_CONNECTED, (payload) => {
      logger.info('Orchestrator: Event CALL_CONNECTED', payload);
    });

    eventBus.subscribe(PROVIDER_EVENTS.CALL_ENDED, (payload) => {
      logger.info('Orchestrator: Event CALL_ENDED', payload);
    });

    eventBus.subscribe(PROVIDER_EVENTS.ERROR_OCCURRED, (payload) => {
      logger.error('Orchestrator: Event ERROR_OCCURRED', payload);
    });
  }
}

export const callOrchestrator = CallOrchestrator.instance;
