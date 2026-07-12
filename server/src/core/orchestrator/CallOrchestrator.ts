import { PipecatRunner } from '../pipeline/PipecatRunner';
import { eventBus, PROVIDER_EVENTS } from '../provider-sdk/provider.events';
import { CallSession, IConversationState } from './CallSession';
import { CallStateMachine } from './CallStateMachine';
import { VobizService } from '../telephony/VobizService';
import { SessionLogger } from '../telephony/SessionLogger';
import { AgentRepository } from '../../repositories/AgentRepository';
import { CallRepository } from '../../repositories/CallRepository';
import { ToolExecutor } from '../../runtime/ToolExecutor';
import { CallStatus, AgentConfig } from '../../types';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

class ConversationState implements IConversationState {
  phase: 'greeting_sent' | 'listening' | 'processing' | 'responding' = 'greeting_sent';
  lastSpeechTime: number = 0;
  silenceThresholdMs: number = 600;
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

      const result = await VobizService.placeCall({
        to: phoneNumber,
        from: fromPhoneNumber,
        answerUrl: `${publicUrl}/api/v2/webhooks/vobiz/answer?callId=${call.id}`,
        ringUrl: `${publicUrl}/api/v2/webhooks/vobiz/status?callId=${call.id}`,
        hangupUrl: `${publicUrl}/api/v2/webhooks/vobiz/hangup?callId=${call.id}`,
      });

      if (result && result.requestUuid) {
        await CallRepository.update(call.id, { telemetryId: result.requestUuid });
        logger.info('CallOrchestrator: call telemetryId updated', { callId: call.id, requestUuid: result.requestUuid });
      }

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

    let agentConfig: AgentConfig;
    let activeAgent: any = null;
    try {
      const agent = await AgentRepository.findById(agentId);
      if (!agent) {
        throw new Error(`Agent not found with ID: ${agentId}`);
      }
      activeAgent = agent;

      const rawConfig = JSON.parse(agent.agentConfig || '{}') as any;

      const defaultPrompt = 
        "You are Clarity AI, a highly professional, senior executive talent acquisition manager for Clarity. Your sole mission is to execute a brief, high-signal preliminary phone screening with the candidate on the line. " +
        "- Personality: Articulate, warm, objective, professional, and conversational. " +
        "- Constraints: Keep your utterances concise and tightly focused. Never output multi-paragraph answers or text formatting characters. Do not use markdown blocks. Speak naturally, allowing comfortable pauses, and avoid talking over the candidate. " +
        "- Flow: First, greet them and confirm you are speaking with the applicant. Second, ask them to briefly detail their hands-on engineering experiences deploying large language models or low-latency system components. Third, inquire about their expected salary bounds. Finally, thank them for their time and state that our executive operations board will follow up with next steps.";

      const voiceName = agent.voiceName || rawConfig.voice || rawConfig.voice_config?.voice || 'Puck';
      const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'shimmer', 'puck', 'charon', 'fenrir', 'kore', 'aoede'];
      const finalVoice = validVoices.includes(voiceName.toLowerCase()) ? voiceName : 'Puck';

      const llmProvider = rawConfig.llm?.provider || 
        (Boolean(env.GEMINI_API_KEY || env.GOOGLE_API_KEY) ? 'gemini' : 'openai');

      let systemInstructions: string;
      if (!agent.flowGraph || agent.flowGraph === "" || agent.flowGraph === "{}") {
        logger.warn('CallOrchestrator: Empty visual canvas detected. Injected default prompt block sequence safely.');
        systemInstructions = agent.systemPrompt || defaultPrompt;
      } else {
        try {
          const FlowCompiler = require('./FlowCompiler');
          systemInstructions = FlowCompiler.compile(agent.flowGraph, agent.name);
        } catch (parseError) {
          logger.error('CallOrchestrator: Canvas layout parsing failed. Utilizing baseline system instruction prompt block.', { error: String(parseError) });
          systemInstructions = agent.systemPrompt || defaultPrompt;
        }
      }

      const isRecordingEnabled = rawConfig.isRecordingEnabled ?? rawConfig.settings?.isRecordingEnabled ?? false;
      const isTranscriptionEnabled = rawConfig.isTranscriptionEnabled ?? rawConfig.settings?.isTranscriptionEnabled ?? false;

      agentConfig = {
        prompt: systemInstructions,
        voice: finalVoice,
        llm: {
          provider: llmProvider,
          model: agent.model || rawConfig.llm_config?.model || 
            (llmProvider === 'gemini' ? 'models/gemini-2.5-flash-native-audio-latest' : 'gpt-4o-realtime-preview'),
          temperature: agent.temperature !== null && agent.temperature !== undefined ? Number(agent.temperature) : (rawConfig.temperature !== undefined ? Number(rawConfig.temperature) : (rawConfig.llm_config?.temperature !== undefined ? Number(rawConfig.llm_config.temperature) : undefined)),
        },
        tools: rawConfig.tools,
        knowledgeBaseIds: rawConfig.knowledgeBaseIds,
        settings: {
          isRecordingEnabled,
          isTranscriptionEnabled,
        },
      };

    } catch (err) {
      logger.error('CRITICAL: Forensic audit lookup failed. Injecting default fallback config.', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      });

      activeAgent = {
        systemPrompt: "You are Clarity AI, a highly professional, senior executive talent acquisition manager for Clarity. Your sole mission is to execute a brief, high-signal preliminary phone screening with the candidate on the line. - Personality: Articulate, warm, objective, professional, and conversational. - Constraints: Keep your utterances concise and tightly focused. Never output multi-paragraph answers or text formatting characters. Do not use markdown blocks. Speak naturally, allowing comfortable pauses, and avoid talking over the candidate. - Flow: First, greet them and confirm you are speaking with the applicant. Second, ask them to briefly detail their hands-on engineering experiences deploying large language models or low-latency system components. Third, inquire about their expected salary bounds. Finally, thank them for their time and state that our executive operations board will follow up with next steps.",
        voiceName: 'Puck',
        model: 'models/gemini-2.5-flash-native-audio-latest',
        userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      };

      agentConfig = {
        prompt: activeAgent.systemPrompt,
        voice: activeAgent.voiceName,
        llm: {
          provider: 'gemini',
          model: activeAgent.model,
          temperature: 0.7,
        },
        tools: [],
      };
    }

    logger.info('CallOrchestrator: agent config validated', { 
      callId, 
      agentId,
      voice: agentConfig.voice,
      provider: agentConfig.llm.provider,
    });

    // Register active tools
    if (agentConfig.tools && agentConfig.tools.length > 0) {
      this.toolExecutor.clearRegistry();
      this.toolExecutor.registerTools(agentConfig.tools);
    }

    const stateMachine = this.stateMachines.get(callId) || new CallStateMachine(callId);
    this.stateMachines.set(callId, stateMachine);
    stateMachine.transitionTo('in_progress');

    const callSession = new CallSession(callId, agentId, phoneNumber, activeAgent);
    callSession.conversationState = new ConversationState();
    this.activeCalls.set(callId, callSession);

    // Instantiate and execute the Pipecat runner asynchronously
    const pipecatRunner = new PipecatRunner(
      callId,
      {
        model: agentConfig.llm.model,
        voice: agentConfig.voice,
        instructions: agentConfig.prompt,
        userId: activeAgent.userId,
        isRecordingEnabled: agentConfig.settings?.isRecordingEnabled || false,
        isTranscriptionEnabled: agentConfig.settings?.isTranscriptionEnabled || false,
        tools: [
          ...(agentConfig.tools?.map((t) => ({
            type: 'function' as const,
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })) || []),
          {
            type: 'function' as const,
            name: 'hang_up',
            description: 'Hangs up the current call session immediately.',
            parameters: { type: 'OBJECT', properties: {} }
          },
          {
            type: 'function' as const,
            name: 'transfer_call',
            description: 'Transfers the active call to another phone number.',
            parameters: {
              type: 'OBJECT',
              properties: {
                phoneNumber: { type: 'STRING', description: 'The phone number to transfer the call to in E.164 format' }
              },
              required: ['phoneNumber']
            }
          },
          {
            type: 'function' as const,
            name: 'send_sms',
            description: 'Sends a transaction text message/SMS during the call.',
            parameters: {
              type: 'OBJECT',
              properties: {
                phoneNumber: { type: 'STRING', description: 'Destination E.164 phone number' },
                message: { type: 'STRING', description: 'Body text content of the SMS' }
              },
              required: ['phoneNumber', 'message']
            }
          }
        ],
      },
      (audioBase64: string) => {
        onAudioDelta?.(audioBase64);
      },
      async (toolCallId: string, name: string, args: string) => {
        try {
          const parsedArgs = JSON.parse(args) as Record<string, unknown>;
          if (name === 'hang_up') {
            logger.info('Flow Engine: trigger hang_up tool call via Pipecat', { callId });
            await this.endCallSession(callId, 'completed');
            return JSON.stringify({ success: true });
          }
          if (name === 'transfer_call') {
            logger.info('Flow Engine: trigger transfer_call tool call via Pipecat', { callId, args });
            await this.endCallSession(callId, 'completed');
            return JSON.stringify({ success: true });
          }
          if (name === 'send_sms') {
            logger.info('Flow Engine: trigger send_sms tool call via Pipecat', { callId, args });
            return JSON.stringify({ success: true, messageSent: true });
          }
          const result = await this.toolExecutor.executeTool(name, parsedArgs);
          return JSON.stringify(result);
        } catch (err) {
          logger.error('CallOrchestrator: tool execution error in Pipecat handler', { toolCallId, name, err });
          return JSON.stringify({ error: String(err) });
        }
      }
    );

    callSession.pipecatRunner = pipecatRunner;

    // Start pipeline execution and await connection setup to complete
    logger.info('CallOrchestrator: starting pipeline execution and awaiting connection setup', { callId });
    await pipecatRunner.start();
    logger.info('CallOrchestrator: pipeline execution started successfully', { callId });

    await CallRepository.updateStatus(callId, 'in_progress', { startTime: new Date() });

    const sessionId = `pipecat-sess-${Date.now()}`;
    logger.info('CallOrchestrator: sessionId generated', { callId, sessionId });
    return sessionId;
  }

  /**
   * Streams inbound audio from SIP channel to the provider.
   */
  processAudioStream(callId: string, audioBase64: string): void {
    const session = this.activeCalls.get(callId);
    if (!session || !session.pipecatRunner) return;

    // Do not stream user audio to Gemini until the initial greeting has been triggered and played.
    // This prevents early static, telephony ringback, or handshake noise from disrupting VAD and greeting generation.
    if (!session.inboundAudioAllowed) {
      return;
    }

    logger.debug('Sending user audio to PipecatRunner', { callId, bytes: audioBase64.length });
    session.pipecatRunner.handleInboundAudio(audioBase64);
  }

  triggerGreeting(callId: string, sessionId: string, greetingText?: string): void {
    const session = this.activeCalls.get(callId);
    if (session?.pipecatRunner) {
      session.pipecatRunner.triggerGreeting(greetingText);
    }

    // Enable inbound audio streaming and mark as listening after 1.5 seconds
    setTimeout(() => {
      const session = this.activeCalls.get(callId);
      if (session) {
        session.inboundAudioAllowed = true;
        if (session.conversationState) {
          session.conversationState.markAsListening();
        }
        logger.info('Now listening for user input and streaming audio to Gemini', { callId });
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
      if (session.pipecatRunner) {
        await session.pipecatRunner.stop();
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
    return {
      active,
      metrics: null,
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
