import { EventEmitter } from 'events';
import { PipecatRunner } from '../pipeline/PipecatRunner';
import { eventBus, PROVIDER_EVENTS } from '../provider-sdk/provider.events';
import { CallSession, IConversationState } from './CallSession';
import { CallStateMachine } from './CallStateMachine';
import { SessionLogger } from '../telephony/SessionLogger';
import { ProviderManager } from '../../providers/ProviderManager';
import { AgentRepository } from '../../repositories/AgentRepository';
import { CallRepository } from '../../repositories/CallRepository';
import { ToolExecutor } from '../../runtime/ToolExecutor';
import { CallStatus, AgentConfig } from '../../types';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { prisma } from '../../lib/prisma';
import { ADMIN_EMAIL } from '../../config/constants';
import { CalendarService } from './CalendarService';
import { bookFollowUpCallTool, executeBookFollowUpCall } from '../../lib/calendar/bookingTool';
import { resolveLiveModel } from '../../utils/modelResolver';
import { callTimingTracker } from '../../utils/CallTimingTracker';
import { formatGreetingTurnPrompt } from '../../utils/greetingUtils';
import { injectVoicePersonaDirective } from '../../utils/personaPrompt';
import { buildFinalSystemInstruction } from '../../utils/systemInstructionBuilder';
import { buildCapabilitiesBlock, filterActiveTools } from '../../utils/capabilities';

export function extractToolsFromFlowGraph(flowGraphInput: string | object | null | undefined): any[] {
  if (!flowGraphInput) return [];
  let graphObj: any = null;
  try {
    graphObj = typeof flowGraphInput === 'string' ? JSON.parse(flowGraphInput) : flowGraphInput;
  } catch {
    return [];
  }

  if (!graphObj || !Array.isArray(graphObj.nodes)) return [];

  const tools: any[] = [];
  const registeredNames = new Set<string>();

  for (const node of graphObj.nodes) {
    const type = node.type;
    const data = node.data || {};

    if (type === 'function' || type === 'callTool') {
      const toolName = (data.toolName || data.label || 'custom_tool').toLowerCase().replace(/[^a-z0-9_]/g, '_');
      if (!registeredNames.has(toolName)) {
        registeredNames.add(toolName);
        tools.push({
          type: 'function',
          name: toolName,
          description: data.instructions || data.prompt || `Dynamic flow tool: ${data.label || toolName}`,
          parameters: data.parameters || { type: 'OBJECT', properties: {} },
        });
      }
    } else if (type === 'checkCalendar') {
      if (!registeredNames.has('check_calendar_availability')) {
        registeredNames.add('check_calendar_availability');
        tools.push({
          type: 'function',
          name: 'check_calendar_availability',
          description: 'Query Google Calendar availability for open meeting slots.',
          parameters: {
            type: 'OBJECT',
            properties: {
              startTime: { type: 'STRING', description: 'ISO start date time string' },
              endTime: { type: 'STRING', description: 'ISO end date time string' },
            },
            required: ['startTime', 'endTime'],
          },
        });
      }
    } else if (type === 'pressDigit') {
      if (!registeredNames.has('press_digit')) {
        registeredNames.add('press_digit');
        tools.push({
          type: 'function',
          name: 'press_digit',
          description: 'Play IVR DTMF key tone or transmit touch-tone keypad digits.',
          parameters: {
            type: 'OBJECT',
            properties: {
              digits: { type: 'STRING', description: 'Keypad digit string (e.g. 1, 2, #, *)' },
            },
            required: ['digits'],
          },
        });
      }
    } else if (type === 'agentTransfer' || type === 'subagent') {
      if (!registeredNames.has('agent_transfer')) {
        registeredNames.add('agent_transfer');
        tools.push({
          type: 'function',
          name: 'agent_transfer',
          description: 'Transfer conversational context to a subagent or specialist agent.',
          parameters: {
            type: 'OBJECT',
            properties: {
              targetAgent: { type: 'STRING', description: 'Subagent name or ID to transfer conversation to' },
            },
          },
        });
      }
    } else if (type === 'code') {
      const codeToolName = (data.label ? `code_${data.label}` : 'execute_inline_code').toLowerCase().replace(/[^a-z0-9_]/g, '_');
      if (!registeredNames.has(codeToolName)) {
        registeredNames.add(codeToolName);
        tools.push({
          type: 'function',
          name: codeToolName,
          description: 'Execute custom server-side inline logic for flow node.',
          parameters: {
            type: 'OBJECT',
            properties: {
              input: { type: 'STRING', description: 'Input payload or arguments for code node' },
            },
          },
        });
      }
    }
  }

  return tools;
}

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

interface PrewarmedSession {
  callId: string;
  agentId: string;
  phoneNumber: string;
  pipecatRunner: PipecatRunner;
  callSession: CallSession;
  readyPromise: Promise<string>;
  bufferedAudio: string[];
  ttlTimeout: NodeJS.Timeout;
}

export class CallOrchestrator extends EventEmitter {
  private static _instance: CallOrchestrator | null = null;
  private readonly activeCalls = new Map<string, CallSession>();
  private readonly prewarmedSessions = new Map<string, PrewarmedSession>();
  private readonly stateMachines = new Map<string, CallStateMachine>();
  private readonly toolExecutor = new ToolExecutor();

  private constructor() {
    super();
    this.subscribeToEventBus();
    this.startMidCallEnforcementMonitor();
  }

  waitForCallEnd(callId: string, timeoutMs: number): Promise<{ reason: string; durationSeconds?: number }> {
    return new Promise((resolve) => {
      let timer: NodeJS.Timeout | null = null;

      const handler = (event: { callId: string; reason: string; durationSeconds?: number }) => {
        if (event.callId === callId) {
          if (timer) clearTimeout(timer);
          this.off('callEnded', handler);
          resolve(event);
        }
      };

      this.on('callEnded', handler);

      timer = setTimeout(() => {
        this.off('callEnded', handler);
        resolve({ reason: 'timeout' });
      }, timeoutMs);
    });
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

  getActiveCallCountForUser(userId: string): number {
    let count = 0;
    for (const session of this.activeCalls.values()) {
      if ((session as any).userId === userId) {
        count++;
      }
    }
    return count;
  }

  /**
   * Placed outbound call handler.
   */
  async initiateOutboundCall(
    phoneNumber: string,
    agentId: string,
    userId: string,
    fromPhoneNumber: string,
    maxDuration: number,
    isRecordingEnabled?: boolean,
    batchId?: string
  ): Promise<string> {
    // 1. Create Call database records
    const call = await CallRepository.create({
      agentId,
      userId,
      batchId,
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

      const agent = await AgentRepository.findById(agentId);
      let record = isRecordingEnabled !== undefined ? isRecordingEnabled : true;
      if (isRecordingEnabled === undefined && agent && agent.agentConfig) {
        try {
          const parsedConfig = JSON.parse(agent.agentConfig);
          if (typeof parsedConfig.isRecordingEnabled === 'boolean') {
            record = parsedConfig.isRecordingEnabled;
          }
        } catch {}
      }

      // Determine provider from caller ID (Plivo vs Vobiz)
      const cleanFromDigits = fromPhoneNumber.replace(/\D/g, '');
      const fromVariants = Array.from(new Set([
        fromPhoneNumber,
        `+${cleanFromDigits}`,
        cleanFromDigits,
      ]));

      const { prisma } = await import('../../lib/prisma');
      const fromNumberRecord = await prisma.phoneNumber.findFirst({
        where: { phoneNumber: { in: fromVariants } },
        select: { telephonyProvider: true, plivoSubAuthId: true },
      });

      const isPlivo = fromNumberRecord?.telephonyProvider === 'plivo';

      let result: any;
      if (isPlivo) {
        const { PlivoService } = await import('../telephony/PlivoService');
        const plivo = new PlivoService();
        result = await plivo.initiateCall({
          to: phoneNumber,
          from: fromPhoneNumber,
          answerUrl: `${publicUrl}/api/v2/webhooks/plivo/answer?callId=${call.id}`,
          ringUrl: `${publicUrl}/api/v2/webhooks/plivo/status?callId=${call.id}`,
          hangupUrl: `${publicUrl}/api/v2/webhooks/plivo/hangup?callId=${call.id}`,
          userId,
          record,
          subaccountAuthId: fromNumberRecord?.plivoSubAuthId || undefined,
        });
      } else {
        const providerName = 'vobiz';
        const telephonyProvider = ProviderManager.instance.getProvider<any>(providerName);

        result = await telephonyProvider.initiateCall({
          to: phoneNumber,
          from: fromPhoneNumber,
          answerUrl: `${publicUrl}/api/v2/webhooks/vobiz/answer?callId=${call.id}`,
          ringUrl: `${publicUrl}/api/v2/webhooks/vobiz/status?callId=${call.id}`,
          hangupUrl: `${publicUrl}/api/v2/webhooks/vobiz/hangup?callId=${call.id}`,
          userId,
          record,
        });
      }

      const requestUuid = result?.requestUuid || result?.request_uuid;
      if (requestUuid) {
        await CallRepository.update(call.id, { telemetryId: requestUuid });
        logger.info('CallOrchestrator: call telemetryId updated', { callId: call.id, requestUuid });
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
        "You are Claritiy AI, a helpful and professional AI voice assistant. " +
        "- Personality: Articulate, warm, helpful, and conversational. " +
        "- Constraints: Keep your utterances concise and natural. Speak clearly and politely.";

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
          systemInstructions = FlowCompiler.compile(agent.flowGraph, agent.name, rawConfig.flexibilityMode || 'rigid');
        } catch (parseError) {
          logger.error('CallOrchestrator: Canvas layout parsing failed. Utilizing baseline system instruction prompt block.', { error: String(parseError) });
          systemInstructions = agent.systemPrompt || defaultPrompt;
        }
      }

      const isRecordingEnabled = rawConfig.isRecordingEnabled ?? rawConfig.settings?.isRecordingEnabled ?? false;
      const isTranscriptionEnabled = rawConfig.isTranscriptionEnabled ?? rawConfig.settings?.isTranscriptionEnabled ?? false;

      let compiledFunctionsTools: any[] = [];
      if (Array.isArray(rawConfig.functions)) {
        compiledFunctionsTools = rawConfig.functions.map((fn: any) => ({
          type: 'function',
          name: fn.name,
          description: fn.description || '',
          parameters: fn.parameters || { type: 'OBJECT', properties: {} },
        }));
      }

      const flowGraphTools = extractToolsFromFlowGraph(agent.flowGraph);
      const combinedTools = [
        ...compiledFunctionsTools,
        ...flowGraphTools,
      ];

      agentConfig = {
        prompt: buildFinalSystemInstruction(agent, { callId }),
        voice: finalVoice,
        llm: {
          provider: llmProvider,
          model: resolveLiveModel(agent.model || rawConfig.llm_config?.model),
          temperature: agent.temperature !== null && agent.temperature !== undefined ? Number(agent.temperature) : (rawConfig.temperature !== undefined ? Number(rawConfig.temperature) : (rawConfig.llm_config?.temperature !== undefined ? Number(rawConfig.llm_config.temperature) : undefined)),
        },
        tools: rawConfig.tools || (combinedTools.length > 0 ? combinedTools : undefined),
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
        systemPrompt: "You are Claritiy AI, a highly professional, senior executive talent acquisition manager for Claritiy. Your sole mission is to execute a brief, high-signal preliminary phone screening with the candidate on the line. - Personality: Articulate, warm, objective, professional, and conversational. - Constraints: Keep your utterances concise and tightly focused. Never output multi-paragraph answers or text formatting characters. Do not use markdown blocks. Speak naturally, allowing comfortable pauses, and avoid talking over the candidate. - Flow: First, greet them and confirm you are speaking with the applicant. Second, ask them to briefly detail their hands-on engineering experiences deploying large language models or low-latency system components. Third, inquire about their expected salary bounds. Finally, thank them for their time and state that our executive operations board will follow up with next steps.",
        voiceName: 'Puck',
        model: 'models/gemini-2.5-flash-native-audio-latest',
        userId: '1e69187e-82d5-4166-929f-4bbba90e5304',
      };

      agentConfig = {
        prompt: buildFinalSystemInstruction(activeAgent, { callId }),
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

    if (agentConfig.settings?.isRecordingEnabled) {
      agentConfig.prompt = `[MANDATORY DISCLOSURE] You must explicitly state that the call is being recorded for quality assurance in your first utterance.\n\n` + agentConfig.prompt;
    }

    // Register active tools
    agentConfig.tools = agentConfig.tools || [];
    agentConfig.tools.push(bookFollowUpCallTool);
    agentConfig.tools.push({
      name: 'check_availability',
      description: 'Check Google Calendar for available meeting slots',
      executionType: 'builtin',
      config: {},
      parameters: {
        type: 'OBJECT',
        properties: {
          startTime: { type: 'STRING', description: 'ISO string of start time' },
          endTime: { type: 'STRING', description: 'ISO string of end time' }
        },
        required: ['startTime', 'endTime']
      }
    });
    agentConfig.tools.push({
      name: 'schedule_event',
      description: 'Schedule an event on Google Calendar',
      executionType: 'builtin',
      config: {},
      parameters: {
        type: 'OBJECT',
        properties: {
          summary: { type: 'STRING', description: 'Event summary/title' },
          startTime: { type: 'STRING', description: 'ISO string of start time' },
          endTime: { type: 'STRING', description: 'ISO string of end time' },
          description: { type: 'STRING', description: 'Event description (optional)' }
        },
        required: ['summary', 'startTime', 'endTime']
      }
    });

    if (agentConfig.tools && agentConfig.tools.length > 0) {
      this.toolExecutor.clearRegistry();
      this.toolExecutor.registerTools(agentConfig.tools);
    }

    const existingCall = await CallRepository.findById(callId).catch(() => null);
    const stateMachine = this.stateMachines.get(callId) || new CallStateMachine(callId, (existingCall?.status as CallStatus) || 'queued');
    this.stateMachines.set(callId, stateMachine);
    stateMachine.transitionTo('in_progress');

    if (activeAgent) {
      activeAgent.systemPrompt = agentConfig.prompt;
    }
    const callSession = new CallSession(callId, agentId, phoneNumber, activeAgent);
    callSession.isRecordingEnabled = agentConfig.settings?.isRecordingEnabled || false;
    callSession.conversationState = new ConversationState();
    this.activeCalls.set(callId, callSession);

    // Instantiate and execute the Pipecat runner asynchronously
    const pipecatRunner = new PipecatRunner(
      callId,
      {
        model: agentConfig.llm.model,
        voice: agentConfig.voice,
        instructions: `${agentConfig.prompt}\n\n${buildCapabilitiesBlock()}`,
        userId: activeAgent.userId,
        agentId: agentId,
        isRecordingEnabled: agentConfig.settings?.isRecordingEnabled || false,
        isTranscriptionEnabled: agentConfig.settings?.isTranscriptionEnabled || false,
        tools: filterActiveTools([
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
            name: 'end_call',
            description: 'Ends the call immediately. Include reason (e.g. "opt_out", "completed", "user_request") if caller wishes to opt out.',
            parameters: {
              type: 'OBJECT',
              properties: {
                reason: { type: 'STRING', description: 'Reason for terminating call (e.g. opt_out, dnc, caller_requested)' }
              }
            }
          },
        ]),
      },
      (audioBase64: string) => {
        onAudioDelta?.(audioBase64);
      },
      async (toolCallId: string, name: string, args: string) => {
        try {
          const parsedArgs = JSON.parse(args) as Record<string, unknown>;
          if (name === 'hang_up' || name === 'end_call') {
            logger.info(`Flow Engine: trigger ${name} tool call via Pipecat`, { callId, args });
            const reason = String(parsedArgs.reason || '').toLowerCase();
            const isOptOut = reason.includes('opt_out') || reason.includes('optout') || reason.includes('dnc') || reason.includes('do_not_call') || reason.includes('unsubscribe');
            if (isOptOut && phoneNumber) {
              try {
                const cleanDigits = phoneNumber.replace(/\D/g, '');
                const variants = Array.from(new Set([phoneNumber, `+${cleanDigits}`, cleanDigits]));
                await prisma.contact.updateMany({
                  where: {
                    userId: activeAgent.userId,
                    phoneNumber: { in: variants }
                  },
                  data: {
                    optedOutAt: new Date(),
                    optOutReason: parsedArgs.reason ? String(parsedArgs.reason) : 'Opt-out requested during call'
                  }
                });
                logger.info('Flow Engine: Successfully marked contact optedOutAt in compliance with UCC regulations', { callId, phoneNumber });
              } catch (optErr) {
                logger.error('Flow Engine: Error updating contact opt-out state', { callId, phoneNumber, error: String(optErr) });
              }
            }
            await this.endCallSession(callId, isOptOut ? ('opted_out' as any) : 'completed');
            return JSON.stringify({ success: true, message: isOptOut ? 'Call ended and recipient registered on Do Not Call list.' : 'Call completed.' });
          }
          if (name === 'transfer_call') {
            logger.warn('Flow Engine: trigger transfer_call tool call via Pipecat - capability unavailable', { callId, args });
            return JSON.stringify({ success: false, error: 'Call transfer capability is currently unavailable on this system.' });
          }
          if (name === 'send_sms') {
            logger.warn('Flow Engine: trigger send_sms tool call via Pipecat - capability unavailable', { callId, args });
            return JSON.stringify({ success: false, error: 'SMS sending capability is currently unavailable on this system.' });
          }
          if (name === 'book_follow_up_call') {
            logger.info('Flow Engine: trigger book_follow_up_call tool call via Pipecat', { callId, args });
            const result = await executeBookFollowUpCall(agentId, phoneNumber, callId, parsedArgs);
            return JSON.stringify(result);
          }
          if (name === 'check_availability' || name === 'check_calendar_availability') {
            logger.info('Flow Engine: trigger check_availability/check_calendar_availability tool call via Pipecat', { callId, args });
            const result = await CalendarService.checkAvailability(activeAgent.userId, parsedArgs.startTime as string, parsedArgs.endTime as string);
            return JSON.stringify(result);
          }
          if (name === 'schedule_event') {
            logger.info('Flow Engine: trigger schedule_event tool call via Pipecat', { callId, args });
            const result = await CalendarService.scheduleEvent(activeAgent.userId, parsedArgs.summary as string, parsedArgs.startTime as string, parsedArgs.endTime as string, parsedArgs.description as string);
            return JSON.stringify(result);
          }
          if (name === 'press_digit') {
            logger.warn('Flow Engine: trigger press_digit tool call via Pipecat - capability unavailable', { callId, args });
            return JSON.stringify({ success: false, error: 'DTMF digit pressing capability is currently unavailable on this system.' });
          }
          if (name === 'agent_transfer') {
            logger.warn('Flow Engine: trigger agent_transfer tool call via Pipecat - capability unavailable', { callId, args });
            return JSON.stringify({ success: false, error: 'Agent transfer capability is currently unavailable on this system.' });
          }
          if (name.startsWith('code_') || name === 'execute_inline_code') {
            logger.warn('Flow Engine: trigger custom code tool call via Pipecat - capability unavailable', { callId, name, args });
            return JSON.stringify({ success: false, error: 'Inline code execution capability is currently unavailable on this system.' });
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
   * Prewarms the voice session (Google Gemini Live WebSocket connection + Setup Complete handshake)
   * in background while the telephony carrier answers and establishes the media stream.
   * Session has a 15-second TTL cleanup if telephony never opens the stream.
   */
  async prewarmVoiceSession(
    callId: string,
    agentId: string,
    phoneNumber: string
  ): Promise<void> {
    if (this.activeCalls.has(callId) || this.prewarmedSessions.has(callId)) {
      return;
    }

    logger.info('CallOrchestrator: prewarming voice session', { callId, agentId });
    const bufferedAudio: string[] = [];

    const ttlTimeout = setTimeout(() => {
      const pw = this.prewarmedSessions.get(callId);
      if (pw) {
        logger.info('CallOrchestrator: prewarmed session expired TTL, cleaning up', { callId });
        this.prewarmedSessions.delete(callId);
        pw.pipecatRunner?.stop().catch(() => {});
      }
    }, 15000);

    const readyPromise = this.startVoiceSession(
      callId,
      agentId,
      phoneNumber,
      (audioBase64: string) => {
        const pw = this.prewarmedSessions.get(callId);
        if (pw) {
          pw.bufferedAudio.push(audioBase64);
        }
      }
    );

    // Register immediately so attachPrewarmedVoiceSession knows prewarm is already in-flight!
    this.prewarmedSessions.set(callId, {
      callId,
      agentId,
      phoneNumber,
      pipecatRunner: null as any,
      callSession: null as any,
      readyPromise,
      bufferedAudio,
      ttlTimeout,
    });

    readyPromise.then((sessionId) => {
      const pw = this.prewarmedSessions.get(callId);
      const session = this.activeCalls.get(callId);
      if (pw) {
        if (session && session.pipecatRunner) {
          pw.pipecatRunner = session.pipecatRunner;
          pw.callSession = session;
        }
        logger.info('CallOrchestrator: voice session prewarmed and standing by', { callId, sessionId });
      }
    }).catch((err) => {
      clearTimeout(ttlTimeout);
      this.prewarmedSessions.delete(callId);
      logger.warn('CallOrchestrator: prewarm failed, will fallback to on-demand start', { callId, error: String(err) });
    });
  }

  /**
   * Attaches telephony stream to prewarmed session, or creates standard session if none exists.
   */
  async attachPrewarmedVoiceSession(
    callId: string,
    agentId: string,
    phoneNumber: string,
    onAudioDelta: (audioBase64: string) => void
  ): Promise<string> {
    const pw = this.prewarmedSessions.get(callId);
    if (pw) {
      clearTimeout(pw.ttlTimeout);
      this.prewarmedSessions.delete(callId);

      // Await setup completion (whether already resolved or still in-flight)
      const sessionId = await pw.readyPromise;
      const session = this.activeCalls.get(callId) || pw.callSession;
      if (session && session.pipecatRunner) {
        session.pipecatRunner.setOutputSink(onAudioDelta);
        this.activeCalls.set(callId, session);
      }

      if (pw.bufferedAudio.length > 0) {
        logger.info('CallOrchestrator: delivering pre-buffered audio chunks to telephony', { callId, count: pw.bufferedAudio.length });
        for (const chunk of pw.bufferedAudio) {
          onAudioDelta(chunk);
        }
        pw.bufferedAudio.length = 0;
      }

      logger.info('CallOrchestrator: prewarmed voice session successfully attached to telephony', { callId, sessionId });
      return sessionId;
    }

    // Check if session is already active in activeCalls
    const existing = this.activeCalls.get(callId);
    if (existing && existing.pipecatRunner) {
      existing.pipecatRunner.setOutputSink(onAudioDelta);
      logger.info('CallOrchestrator: existing active call session attached to telephony', { callId });
      return existing.providerSessionId || `pipecat-sess-${callId}`;
    }

    return this.startVoiceSession(callId, agentId, phoneNumber, onAudioDelta);
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
      callTimingTracker.mark(callId, 'greeting_requested');
      const finalPrompt = formatGreetingTurnPrompt(greetingText || 'Thank you for calling. How can I help you today?');
      session.pipecatRunner.triggerGreeting(finalPrompt);
    }

    // Enable inbound audio streaming and mark as listening after 350ms (reduced from 1500ms to eliminate awkward silence)
    setTimeout(() => {
      const session = this.activeCalls.get(callId);
      if (session) {
        session.inboundAudioAllowed = true;
        if (session.conversationState) {
          session.conversationState.markAsListening();
        }
        logger.info('Now listening for user input and streaming audio to Gemini', { callId });
      }
    }, 350);
  }

  enableInboundAudio(callId: string): void {
    const session = this.activeCalls.get(callId);
    if (session) {
      session.inboundAudioAllowed = true;
      if (session.conversationState) {
        session.conversationState.markAsListening();
      }
      logger.info('CallOrchestrator: Inbound audio immediately enabled for user-first interaction', { callId });
    }
  }

  /**
   * Ends a session, clean up resources, and records session metrics.
   */
  async endCallSession(callId: string, reason: string): Promise<void> {
    logger.info('CallOrchestrator: endCallSession', { callId, reason });

    const prewarmed = this.prewarmedSessions.get(callId);
    if (prewarmed) {
      clearTimeout(prewarmed.ttlTimeout);
      prewarmed.pipecatRunner.stop().catch(() => {});
      this.prewarmedSessions.delete(callId);
    }

    const session = this.activeCalls.get(callId);
    if (session) {
      if (session.pipecatRunner) {
        await session.pipecatRunner.stop();
      }
      this.activeCalls.delete(callId);
    }

    const mappedStatus: CallStatus = reason === 'completed' || reason === 'user_hangup' || reason === 'stream_stopped'
      ? 'completed'
      : 'failed';

    const stateMachine = this.stateMachines.get(callId);
    if (stateMachine) {
      stateMachine.transitionTo(mappedStatus);
      this.stateMachines.delete(callId);
    }

    const endTime = new Date();
    const call = await prisma.call.findUnique({ where: { id: callId } });
    let durationSeconds = 0;
    if (call && call.startTime) {
      durationSeconds = Math.max(1, Math.round((endTime.getTime() - call.startTime.getTime()) / 1000));
    }
    const existingCdrDuration = call?.durationSeconds ?? null;

    logger.info('[CALL_DURATION_AUDIT] Call session ended duration metrics', {
      callId,
      userId: call?.userId,
      computedDurationSeconds: durationSeconds,
      vobizCdrReportedDuration: existingCdrDuration,
      discrepancySeconds: existingCdrDuration !== null ? Math.round(durationSeconds - existingCdrDuration) : null,
      timestamps: {
        createdAt: call?.createdAt?.toISOString(),
        startTime: call?.startTime?.toISOString(),
        endTime: endTime.toISOString(),
        setupLatencyMs: (call?.startTime && call?.createdAt)
          ? (call.startTime.getTime() - call.createdAt.getTime())
          : null,
        wallDurationSec: (call?.startTime)
          ? Math.round((endTime.getTime() - call.startTime.getTime()) / 1000)
          : null,
      },
    });

    // If Vobiz hangup webhook already recorded the authoritative telephony CDR duration, preserve it
    const finalDurationSeconds = (existingCdrDuration && existingCdrDuration > 0)
      ? existingCdrDuration
      : durationSeconds;

    await CallRepository.updateStatus(callId, mappedStatus, { endTime, durationSeconds: finalDurationSeconds });
    await SessionLogger.logCallEnded(callId, reason, session?.providerSessionId || '');

    // Trigger post-call deduction asynchronously
    const { CallService } = await import('../../services/CallService');
    CallService.deductCallMinutes(callId, finalDurationSeconds).catch((deductErr: any) => {
      logger.error('[CALL_DEDUCTION_ERROR] Failed during post-call deduction', { callId, error: String(deductErr) });
    });

    this.emit('callEnded', { callId, reason });
  }

  private startMidCallEnforcementMonitor() {
    setInterval(async () => {
      if (this.activeCalls.size === 0) return;

      for (const [callId] of this.activeCalls) {
        try {
          const call = await prisma.call.findUnique({
            where: { id: callId },
            include: { user: true }
          });
          if (!call || !call.startTime || call.user.accountType === 'admin' || call.user.email === ADMIN_EMAIL) continue;

          const elapsedSeconds = Math.round((Date.now() - call.startTime.getTime()) / 1000);
          const remainingSeconds = call.user.minutesRemainingSeconds > 0
            ? call.user.minutesRemainingSeconds
            : (call.user.callingBalanceMinutes * 60);

          if (elapsedSeconds >= remainingSeconds) {
            logger.warn('[MID_CALL_CUTOFF] Minutes remaining depleted during call. Force terminating session.', {
              callId,
              userId: call.userId,
              elapsedSeconds,
              remainingSeconds,
            });
            const { CallService } = await import('../../services/CallService');
            await CallService.terminateCall(callId).catch(async (termErr) => {
              logger.warn('[MID_CALL_CUTOFF] CallService.terminateCall error, falling back to endCallSession', { callId, error: String(termErr) });
              await this.endCallSession(callId, 'minutes_exhausted');
            });
          }
        } catch (monitorErr) {
          logger.error('[MID_CALL_MONITOR_ERROR] Failed during mid-call check', { callId, error: String(monitorErr) });
        }
      }
    }, 3000);
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
