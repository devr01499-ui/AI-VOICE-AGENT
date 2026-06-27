import { providerManagerSDK } from '../provider-sdk/provider.manager';
import { metricsCollector } from '../provider-sdk/provider.metrics';
import { eventBus, PROVIDER_EVENTS } from '../provider-sdk/provider.events';
import { ProviderSessionConfig, ProviderEventCallbacks } from '../provider-sdk/provider.types';
import { CallSession } from './CallSession';
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
  async startVoiceSession(callId: string, agentId: string, phoneNumber: string): Promise<string> {
    logger.info('CallOrchestrator: startVoiceSession', { callId, agentId });

    const agent = await AgentRepository.findById(agentId);
    if (!agent.agentConfig || agent.agentConfig === '{}') {
      throw new CallError(callId, 'Agent configuration is empty. Please configure the agent first.');
    }

    let agentConfig: AgentConfig;
    try {
      const rawConfig = JSON.parse(agent.agentConfig) as any;

      // Validate required fields
      if (!rawConfig.prompt && !rawConfig.system_prompt) {
        throw new Error('Missing prompt/system_prompt in agent config');
      }

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
        prompt: rawConfig.prompt || rawConfig.system_prompt,
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
    this.activeCalls.set(callId, callSession);

    // Mapped config structure passed down to SDK Provider
    const providerName = agentConfig.llm.provider === 'openai' ? 'openai' : 'gemini';
    const config: ProviderSessionConfig = {
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
      onTranscriptDelta: (sessId, delta, isFinal) => {
        TranscriptRecorder.recordSegment(callId, 'agent', delta);
      },
      onSpeechStarted: (sessId) => {
        eventBus.publish(PROVIDER_EVENTS.AI_STARTED_SPEAKING, { callId, sessionId: sessId });
      },
      onSpeechStopped: (sessId) => {
        eventBus.publish(PROVIDER_EVENTS.AI_STOPPED_SPEAKING, { callId, sessionId: sessId });
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
      onError: (sessId, error) => {
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
  processAudioStream(callId: string, audioBase64: string): void {
    const session = this.activeCalls.get(callId);
    if (session && session.providerSessionId) {
      providerManagerSDK.sendAudio(session.providerSessionId, audioBase64);
    }
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
