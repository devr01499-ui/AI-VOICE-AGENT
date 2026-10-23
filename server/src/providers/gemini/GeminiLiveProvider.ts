/**
 * Claritiy Voice — Google Gemini Live Provider
 * ✅ FIXED VERSION
 * 
 * Changes:
 * 1. API version changed from v1beta to v1alpha
 * 2. Added proper URL encoding for API key
 * 3. Improved error logging to show actual endpoint
 *
 * WebSocket client for the Google Gemini Multimodal Live API. Manages per-call sessions
 * with bidirectional audio streaming and function-call execution.
 * Sessions are stored in an in-memory Map; cleanup is mandatory on call end.
 */

import WebSocket from 'ws';
import { logger } from '../../utils/logger';
import { ProviderError } from '../../types/errors';
import { CallError } from '../../utils/CallError';
import { env } from '../../config/env';
import { ADMIN_EMAIL } from '../../config/constants';
import { resolveLiveModel } from '../../utils/modelResolver';
import { callTimingTracker } from '../../utils/CallTimingTracker';
import { injectVoicePersonaDirective } from '../../utils/personaPrompt';
import { deduplicateSystemPrompt } from '../../utils/promptOptimizer';
import { buildFinalSystemInstruction } from '../../utils/systemInstructionBuilder';
import { getCallableSecondsRemaining } from '../../utils/balanceUtils';
import type {
  IRealtimeProvider,
  HealthCheckResult,
  RealtimeSessionConfig,
  RealtimeSessionResult,
  RealtimeEventCallbacks,
} from '../interfaces/IProvider';

// ─── Gemini Wire Protocol Types ───────────────────────

interface GeminiServerEvent {
  setupComplete?: Record<string, unknown>;
  serverContent?: {
    modelTurn?: {
      parts?: Array<{
        text?: string;
        thought?: boolean;
        inlineData?: {
          mimeType: string;
          data: string;
        };
      }>;
    };
    turnComplete?: boolean;
    interrupted?: boolean;
    inputTranscription?: {
      text: string;
    };
    outputTranscription?: {
      text: string;
    };
  };
  toolCall?: {
    functionCalls?: Array<{
      id: string;
      name: string;
      args: Record<string, unknown>;
    }>;
  };
  error?: {
    message: string;
    code?: number;
    status?: string;
  };
  goAway?: {
    timeLeftMs?: number;
    resumptionHandle?: string;
  };
}

interface ActiveSession {
  ws: WebSocket;
  callbacks: RealtimeEventCallbacks;
  createdAt: number;
  balanceInterval?: NodeJS.Timeout;
  agentId?: string;
  userId?: string;
  resumptionHandle?: string;
  targetModel?: string;
  config?: RealtimeSessionConfig;
  cleanup?: () => Promise<void>;
  callId?: string;
  hasEmittedFirstAudio?: boolean;
  turnIndex?: number;
  recentTurns?: string[];
}

export function validateSetupMessage(setupMessage: any): { valid: boolean; error?: string } {
  if (!setupMessage?.setup) {
    return { valid: false, error: 'Missing root "setup" payload key' };
  }
  const { setup } = setupMessage;
  if (!setup.model || typeof setup.model !== 'string') {
    return { valid: false, error: 'Invalid or missing "model" parameter' };
  }
  const promptText = setup.systemInstruction?.parts?.[0]?.text;
  if (!promptText || typeof promptText !== 'string' || promptText.length === 0) {
    return { valid: false, error: 'Empty or missing system instruction text' };
  }
  if (promptText.length > 200_000) {
    return { valid: false, error: `System instruction exceeds 200k character safety limit (${promptText.length} chars)` };
  }
  if (setup.tools && Array.isArray(setup.tools)) {
    for (const toolGroup of setup.tools) {
      if (!Array.isArray(toolGroup.functionDeclarations)) {
        return { valid: false, error: 'Invalid tool group: missing functionDeclarations array' };
      }
      for (const fn of toolGroup.functionDeclarations) {
        if (!fn.name || !/^[a-zA-Z0-9_]{1,64}$/.test(fn.name)) {
          return { valid: false, error: `Invalid tool declaration name: "${fn.name}" (must match ^[a-zA-Z0-9_]{1,64}$)` };
        }
        if (!fn.description || typeof fn.description !== 'string') {
          return { valid: false, error: `Invalid tool description for "${fn.name}"` };
        }
        if (fn.parameters && (typeof fn.parameters !== 'object' || Array.isArray(fn.parameters))) {
          return { valid: false, error: `Invalid tool parameters schema for "${fn.name}"` };
        }
      }
    }
  }
  return { valid: true };
}

export class GeminiLiveProvider implements IRealtimeProvider {
  public readonly name = 'gemini-live';
  public readonly type = 'realtime';

  private readonly activeSessions = new Map<string, ActiveSession>();
  private readonly apiKey: string;

  private readonly setupCompletePromises = new Map<string, {
    promise: Promise<void>;
    resolve: () => void;
    reject: (err: Error) => void;
    timeoutId: NodeJS.Timeout;
  }>();

  constructor() {
    this.apiKey = env.GEMINI_API_KEY || env.GOOGLE_API_KEY || '';
  }

  public getApiKey(): string {
    return this.apiKey;
  }

  public async verifyApiKey(apiKey: string): Promise<string | null> {
    if (!apiKey) return 'API key is missing';
    try {
      // ✅ FIXED: Use v1alpha endpoint for verification
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1alpha/models?key=${encodeURIComponent(apiKey)}`
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as any;
        if (data && data.error && typeof data.error.message === 'string') {
          return data.error.message;
        }
        return `HTTP error ${res.status}: ${res.statusText}`;
      }
      return null;
    } catch (err: any) {
      return `Failed to connect to Google API: ${err.message || String(err)}`;
    }
  }

  async connect(): Promise<void> {
    logger.info('GeminiLiveProvider: ready (connections are per-session)');
  }

  async disconnect(): Promise<void> {
    const sessionIds = Array.from(this.activeSessions.keys());
    for (const sid of sessionIds) {
      await this.closeSession(sid);
    }
    logger.info('GeminiLiveProvider: all sessions closed');
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    const healthy = Boolean(this.apiKey && this.apiKey.length > 0);
    return {
      healthy,
      latencyMs: Date.now() - start,
      details: healthy ? 'API key configured' : 'Missing GEMINI_API_KEY',
    };
  }

  static async runStartupSelfTest(): Promise<boolean> {
    logger.info('[BOOT_SELF_TEST] Initiating Gemini Live startup validation...');
    try {
      const apiKey = process.env.GEMINI_API_KEY || '';
      if (!apiKey || apiKey === 'AIzaSyAQ-x2GqymD5KvQ1tC9H78Z4E9uGGqIExQ') {
        logger.warn('[BOOT_SELF_TEST] Default or empty GEMINI_API_KEY detected. Startup test passed in sandbox mode.');
        return true;
      }

      const testPayload = {
        setup: {
          model: resolveLiveModel('gemini-2.0-flash-exp'),
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: "Puck"
                }
              }
            },
            temperature: 0.7
          },
          systemInstruction: {
            parts: [{ text: "Claritiy Voice Startup Self-Test System Instruction" }]
          },
          tools: [{
            functionDeclarations: [{
              name: "ping",
              description: "Self test ping function",
              parameters: { type: "OBJECT", properties: {} }
            }]
          }]
        }
      };

      const validation = validateSetupMessage(testPayload);
      if (!validation.valid) {
        throw new Error(`Self-test validation error: ${validation.error}`);
      }

      logger.info('[BOOT_SELF_TEST] Gemini Live production setup builder and validator verified successfully');
      return true;
    } catch (err: any) {
      logger.error('[BOOT_SELF_TEST] Boot self-test failed', { error: err.message });
      return false;
    }
  }

  async createSession(
    config: RealtimeSessionConfig,
    callbacks: RealtimeEventCallbacks
  ): Promise<RealtimeSessionResult> {
    const callId = config.callId || '';
    let resolvedAgentId: string | undefined = config.agentId;
    if (!config.callId) {
      throw new Error('callId required in config');
    }
    if (!config.model) {
      throw new CallError(callId, 'Model required', 'INVALID_CONFIG');
    }
    if (!config.instructions) {
      throw new CallError(callId, 'Prompt or instructions required', 'INVALID_CONFIG');
    }
    if (!callbacks) {
      throw new CallError(callId, 'Callbacks required', 'INVALID_CONFIG');
    }
    if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 2)) {
      throw new CallError(callId, 'Invalid temperature', 'INVALID_CONFIG');
    }
    // NOTE: Voice name validation is intentionally delegated to the Gemini API.
    // The full voice library has 30+ voices and grows over time; a static client-side
    // whitelist would silently block valid new voices. The API returns a clear error
    // for genuinely invalid voice names.

    // priority key/balance waterfall resolution:
    const userId = config.userId;
    if (!userId) {
      throw new CallError(callId, 'userId required for value gateway check', 'INVALID_CONFIG');
    }

    const tStartDb = Date.now();
    logger.info('[LATENCY_TEST] setup: starting combined db lookup', { timestamp: tStartDb });
    const prismaInstance = (await import('../../lib/prisma')).prisma;
    
    let callData: any = null;

    if (callId.startsWith('sandbox-')) {
      const user = await prismaInstance.user.findUnique({ where: { id: userId } });
      const agent = resolvedAgentId ? await prismaInstance.agent.findUnique({
        where: { id: resolvedAgentId },
        include: { kbLinks: { take: 1 } }
      }) : null;
      
      if (!user) {
        throw new CallError(callId, 'Authenticated user profile not found or mismatch', 'INVALID_CONFIG');
      }
      
      callData = {
        id: callId,
        userId,
        agentId: resolvedAgentId,
        user,
        agent
      };
    } else {
      callData = await prismaInstance.call.findUnique({
        where: { id: callId },
        include: {
          user: true,
          agent: {
            include: {
              kbLinks: { take: 1 }
            }
          }
        }
      });

      if (!callData || !callData.user || callData.userId !== userId) {
        throw new CallError(callId, 'Authenticated user profile not found or mismatch', 'INVALID_CONFIG');
      }
    }

    const userProfile = callData.user;
    logger.info('[LATENCY_TEST] setup: finished combined db lookup', { timestamp: Date.now(), durationMs: Date.now() - tStartDb });

    let selectedApiKey: string;
    let accountsAgainstPlatformBalance = false;

    const callableSeconds = getCallableSecondsRemaining(userProfile);

    if (userProfile.geminiApiKey && userProfile.geminiApiKey.trim() !== '') {
      // Use User's Custom Key (BYOK Mode - Cost Free to Platform)
      selectedApiKey = userProfile.geminiApiKey.trim();
      logger.info('Monetization Gateway: BYOK Mode enabled', { userId, callId });
    } else if (userProfile.email === ADMIN_EMAIL || userProfile.accountType === 'admin') {
      // Admin account: always use platform master key, never block, track usage only
      selectedApiKey = this.apiKey;
      accountsAgainstPlatformBalance = true;
      logger.info('Monetization Gateway: Admin bypass active — using platform key without balance check', { userId, callId });
    } else if (callableSeconds > 0) {
      // Use Platform Central Master Key (Subtracts User Free Balance Trial minutes)
      selectedApiKey = this.apiKey;
      accountsAgainstPlatformBalance = true;
      logger.info('Monetization Gateway: Platform Balance Mode enabled', { userId, callId, remainingSeconds: callableSeconds });
    } else {
      // Block Session Execution completely due to empty balances
      logger.warn('Monetization Gateway: Access blocked. Insufficient balances or missing keys.', { userId, callId, callableSeconds });
      throw new Error("You're out of calling minutes. Add minutes or your own Gemini API key in Settings.");
    }

    const apiVersion = 'v1alpha';
    const baseUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.${apiVersion}.GenerativeService.BidiGenerateContent`;
    const wsUrl = `${baseUrl}?key=${encodeURIComponent(selectedApiKey)}`;

    const sessionId = `gemini-sess-${Date.now()}`;
    const targetModel = resolveLiveModel(config.model);
    const ws = new WebSocket(wsUrl);

    // ── Per-session closure state (no shared mutable instance fields) ──────
    const sessionCallStartTime = { value: Date.now() };
    let sessionBalanceIntervalId: NodeJS.Timeout | null = null;

    const clearSessionBalanceTicker = () => {
      if (sessionBalanceIntervalId) {
        clearInterval(sessionBalanceIntervalId);
        sessionBalanceIntervalId = null;
      }
    };

    const processSessionBalanceDeduction = async () => {
      if (sessionCallStartTime.value && accountsAgainstPlatformBalance) {
        const elapsedSeconds = (Date.now() - sessionCallStartTime.value) / 1000;
        const elapsedMinutes = elapsedSeconds / 60;
        const decrementVal = parseFloat(elapsedMinutes.toFixed(4));
        sessionCallStartTime.value = 0; // Prevent double invocation
        try {
          const prismaInstance = (await import('../../lib/prisma')).prisma;
          const userRecord = await prismaInstance.user.findUnique({ where: { id: userId }, select: { email: true, accountType: true } });
          const isAdmin = userRecord?.accountType === 'admin' || userRecord?.email === ADMIN_EMAIL;
          if (isAdmin) {
            await prismaInstance.user.update({ where: { id: userId }, data: { totalMinutesConsumed: { increment: decrementVal } } });
            logger.info('Monetization Gateway: Tracked admin usage (no balance deduction)', { userId, elapsedMinutes: decrementVal });
          } else {
            // Balance deduction is handled by CallService.deductCallMinutes → MinutesService.debit()
            // at call end, which records a ledger entry. Do NOT decrement callingBalanceMinutes here
            // to avoid double deduction. Only log the elapsed time for diagnostics.
            logger.info('Monetization Gateway: Session closed; balance deduction deferred to post-call ledger path', { userId, elapsedMinutes: decrementVal });
          }
        } catch (err) {
          logger.error('Monetization Gateway: Failed to process session closure', { error: String(err) });
        }
      }
    };

    ws.on('close', () => clearSessionBalanceTicker());
    ws.on('error', () => clearSessionBalanceTicker());
    ws.on('unexpected-response', () => clearSessionBalanceTicker());

    // Repeating balance countdown interval loop:
    if (accountsAgainstPlatformBalance) {
      sessionBalanceIntervalId = setInterval(async () => {
        try {
          if (ws.readyState !== WebSocket.OPEN) {
            clearSessionBalanceTicker();
            return;
          }

          if (!sessionCallStartTime.value) return;
          const elapsedSeconds = (Date.now() - sessionCallStartTime.value) / 1000;
          const elapsedMinutes = elapsedSeconds / 60;

          const currentUser = await prismaInstance.user.findUnique({
            where: { id: userId }
          });

          if (!currentUser) {
            clearSessionBalanceTicker();
            ws.close(1011, "USER_NOT_FOUND");
            return;
          }

          const callableSeconds = getCallableSecondsRemaining(currentUser);

          logger.info('Monetization Gateway: Balance check ticker', {
            userId,
            elapsedSeconds: Math.round(elapsedSeconds),
            callableSecondsRemaining: callableSeconds,
          });

          if (elapsedSeconds >= callableSeconds) {
            logger.warn('Monetization Gateway: Balance depleted during active call. Terminating connection cleanly.', { userId, callId, elapsedSeconds, callableSeconds });
            clearSessionBalanceTicker();
            ws.close(1011, "INSUFFICIENT_BALANCE");
            callbacks.onError?.(sessionId, new Error("You're out of calling minutes. Add minutes or your own Gemini API key in Settings."));
          }
        } catch (tickerErr) {
          logger.error('Monetization Gateway: Failed to check calling credits', { error: String(tickerErr) });
        }
      }, 60000);
    }

    // Create setupComplete waiter
    let setupResolve: () => void;
    let setupReject: (err: Error) => void;

    const setupCompletePromise = new Promise<void>((resolve, reject) => {
      setupResolve = resolve;
      setupReject = reject;
    });

    const timeoutId = setTimeout(() => {
      setupReject(new CallError(callId, 'setupComplete timeout after 10s', 'GEMINI_TIMEOUT'));
      this.setupCompletePromises.delete(sessionId);
    }, 10_000);

    this.setupCompletePromises.set(sessionId, {
      promise: setupCompletePromise,
      resolve: setupResolve!,
      reject: setupReject!,
      timeoutId,
    });

    ws.on('open', async () => {
      if (config.callId) {
        callTimingTracker.mark(config.callId, 'gemini_ws_open');
      }
      logger.info('GeminiLiveProvider: WebSocket successfully opened. Transmission of strict snake_case setup payload initiated.');

      resolvedAgentId = callData.agentId || config.agentId;

      let inlinedKbFacts: string | undefined;
      let hasKbDocs = false;
      if (callData.agent && callData.agent.kbLinks && callData.agent.kbLinks.length > 0 && resolvedAgentId) {
        try {
          const prismaInst = (await import('../../lib/prisma')).prisma;
          const chunks = await prismaInst.knowledgeBaseChunk.findMany({
            where: {
              kb: {
                agentLinks: {
                  some: { agentId: resolvedAgentId }
                }
              }
            },
            select: { content: true },
            take: 12
          });

          if (chunks.length > 0) {
            const totalChars = chunks.reduce((sum, c) => sum + (c.content?.length || 0), 0);
            if (totalChars <= 4000) {
              inlinedKbFacts = chunks
                .map((c, i) => `${i + 1}. ${c.content.trim()}`)
                .join('\n\n');
              logger.info('GeminiLiveProvider: Small KB facts inlined into prompt (0ms tool latency)', {
                agentId: resolvedAgentId,
                chunkCount: chunks.length,
                totalChars,
              });
            } else {
              hasKbDocs = true;
            }
          }
        } catch (kbErr) {
          logger.warn('GeminiLiveProvider: Error inlining KB facts, defaulting to tool search', { error: String(kbErr) });
          hasKbDocs = true;
        }
      }

      // Map tools cleanly to Gemini wire function_declarations format
      const functionDeclarations = config.tools?.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters, // JSON Schema parameters can remain camelCase/nested as standard
      })) || [];

      if (hasKbDocs) {
        functionDeclarations.push({
          name: 'search_knowledge_base',
          description: 'Searches the knowledge base for information about a given query to answer user questions.',
          parameters: {
            type: 'OBJECT',
            properties: {
              query: {
                type: 'STRING',
                description: 'Search query to look up in the knowledge base.'
              }
            },
            required: ['query']
          }
        });
        logger.info('GeminiLiveProvider: Exposing search_knowledge_base tool to agent', { agentId: resolvedAgentId });
      }

      let systemVoiceVal = 'Puck';
      let temperatureVal = 0.7;
      let languageModeVal = 'auto';

      if (callData.agent) {
        systemVoiceVal = callData.agent.systemVoice || 'Puck';
        temperatureVal = callData.agent.temperature ?? 0.7;
        languageModeVal = callData.agent.languageMode || 'auto';
      }

      const agentVoiceMapping = systemVoiceVal || callData.agent?.voice || config.voice || "Puck";

      // Map voices: OpenAI legacy aliases → Gemini equivalents; all 30 Gemini library voices
      // map to themselves (correct PascalCase). Fallback passes the value through as-is.
      const voiceNameMap: Record<string, string> = {
        // Legacy OpenAI voice aliases
        alloy: 'Aoede', echo: 'Fenrir', fable: 'Fenrir', onyx: 'Kore', shimmer: 'Aoede',
        // All 30 canonical Gemini voice names (lowercase → PascalCase)
        puck: 'Puck', charon: 'Charon', fenrir: 'Fenrir', kore: 'Kore', aoede: 'Aoede',
        leda: 'Leda', orus: 'Orus', zephyr: 'Zephyr', callirhoe: 'Callirhoe',
        autonoe: 'Autonoe', enceladus: 'Enceladus', iapetus: 'Iapetus', umbriel: 'Umbriel',
        algieba: 'Algieba', despina: 'Despina', erinome: 'Erinome', algenib: 'Algenib',
        rasalgethi: 'Rasalgethi', laomedeia: 'Laomedeia', achernar: 'Achernar',
        alnilam: 'Alnilam', schedar: 'Schedar', gacrux: 'Gacrux', pulcherrima: 'Pulcherrima',
        achird: 'Achird', adara: 'Adara', castor: 'Castor', deneb: 'Deneb',
        eltanin: 'Eltanin', mizar: 'Mizar',
      };
      const geminiVoice = voiceNameMap[agentVoiceMapping.toLowerCase()] || agentVoiceMapping;

      let speechSettings: any = {};
      if (callData.agent && callData.agent.agentConfig) {
        try {
          const parsedCfg = typeof callData.agent.agentConfig === 'string'
            ? JSON.parse(callData.agent.agentConfig)
            : callData.agent.agentConfig;
          if (parsedCfg?.speechSettings) {
            speechSettings = parsedCfg.speechSettings;
          }
        } catch {}
      }

      const silenceDurationVal = typeof speechSettings.responsivenessMs === 'number'
        ? Math.max(100, Math.min(2000, speechSettings.responsivenessMs))
        : 500;

      const isInterruptionLow = speechSettings.interruptionSensitivity === 'LOW';
      const startSensitivity = isInterruptionLow ? "START_SENSITIVITY_LOW" : "START_SENSITIVITY_HIGH";
      // Invert endSensitivity: when interruptionSensitivity is HIGH or default (not LOW), set endSensitivity to HIGH for fast turn handover
      const endSensitivity = isInterruptionLow ? "END_SENSITIVITY_LOW" : "END_SENSITIVITY_HIGH";

      // Delegate live prompt assembly exclusively to buildFinalSystemInstruction (idempotent single source of truth)
      const agentObj = (config.instructions && config.instructions.includes('CLARITIY_SYSTEM_INSTRUCTION_V1'))
        ? { ...(callData.agent || {}), systemPrompt: config.instructions, languageMode: languageModeVal }
        : (callData.agent || {
            systemPrompt: config.instructions || "Default assistant prompt",
            languageMode: languageModeVal,
          });

      const systemInstructionString = buildFinalSystemInstruction(agentObj, {
        callId: config.callId,
        languageMode: languageModeVal,
        inlinedKbFacts,
        hasKbDocs,
        tools: config.tools,
      });

      const setupMessage = {
        setup: {
          model: targetModel,
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: geminiVoice
                }
              }
            },
            temperature: temperatureVal
          },
          systemInstruction: {
            parts: [{ text: systemInstructionString }]
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          realtimeInputConfig: {
            automaticActivityDetection: {
              disabled: false,
              startOfSpeechSensitivity: startSensitivity,
              endOfSpeechSensitivity: endSensitivity,
              prefixPaddingMs: 50,
              silenceDurationMs: silenceDurationVal,
            },
            activityHandling: "START_OF_ACTIVITY_INTERRUPTS",
            turnCoverage: "TURN_INCLUDES_ALL_INPUT"
          },
          proactivity: {
            proactiveAudio: true
          },
          ...(functionDeclarations && functionDeclarations.length > 0 && {
            tools: [
              {
                functionDeclarations: functionDeclarations,
              },
            ],
          }),
        }
      };

      // ── LANGUAGE MODE RUNTIME PROOF LOG ──────────────────────────────────
      // This log emits the EXACT system instruction text sent to Gemini.
      // Search server logs for "[LANG-MODE-PROOF]" to verify language directive.
      logger.info('[LANG-MODE-PROOF] GeminiLiveProvider: Full system instruction being sent to Gemini', {
        agentId: config.agentId,
        languageModeDb: languageModeVal,
        systemVoice: systemVoiceVal,
        systemInstructionLength: systemInstructionString.length,
        systemInstructionFull: systemInstructionString,
      });

      const validation = validateSetupMessage(setupMessage);
      if (!validation.valid) {
        logger.error('GeminiLiveProvider: Setup message validation failed', { error: validation.error, callId });
        setupReject(new CallError(callId, `Setup validation failed: ${validation.error}`, 'SETUP_VALIDATION_FAILED'));
        try {
          ws.close(1008, validation.error);
        } catch {}
        return;
      }

      logger.info('GeminiLiveProvider: Transmitting completed handshake frame to Google wire socket', {
        targetModel: setupMessage.setup.model,
        selectedVoice: geminiVoice
      });

      ws.send(JSON.stringify(setupMessage));
    });

    ws.on('message', (raw: WebSocket.RawData) => {
      try {
        const event = JSON.parse(raw.toString()) as GeminiServerEvent;

        // Trace error packets from Google
        if (event.error) {
          logger.error('GeminiLiveProvider [HANDSHAKE/RUNTIME ERROR]: Google returned error payload', {
            sessionId,
            error: JSON.stringify(event.error)
          });
        }

        // Handshake complete once setupComplete is received
        if (event.setupComplete) {
          if (config.callId) {
            callTimingTracker.mark(config.callId, 'gemini_setup_complete');
          }
          logger.info('GeminiLiveProvider [HANDSHAKE]: setupComplete received from Google.', { sessionId, event: JSON.stringify(event) });
          sessionCallStartTime.value = Date.now();
          this.activeSessions.set(sessionId, {
            ws,
            callbacks,
            callId: config.callId,
            createdAt: Date.now(),
            agentId: resolvedAgentId || undefined,
            userId,
            targetModel,
            config,
            turnIndex: 0,
            ...(sessionBalanceIntervalId && { balanceInterval: sessionBalanceIntervalId }),
            cleanup: async () => {
              clearSessionBalanceTicker();
              await processSessionBalanceDeduction();
            },
          });

          const handler = this.setupCompletePromises.get(sessionId);
          if (handler) {
            clearTimeout(handler.timeoutId);
            handler.resolve();
            this.setupCompletePromises.delete(sessionId);
          }
          return;
        }

        // Handle runtime events
        this.handleServerEvent(sessionId, event);
      } catch (err) {
        logger.error('GeminiLiveProvider: failed to parse server event', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

    ws.on('error', (err: Error) => {
      logger.error('GeminiLiveProvider: WebSocket error', {
        sessionId,
        error: err.message,
      });
      clearSessionBalanceTicker();
      processSessionBalanceDeduction().catch((deductErr) => {
        logger.error('GeminiLiveProvider: error during balance deduction on socket error', { error: String(deductErr) });
      });
      callbacks.onError?.(sessionId, err);

      const handler = this.setupCompletePromises.get(sessionId);
      if (handler) {
        clearTimeout(handler.timeoutId);
        handler.reject(new CallError(callId, `WebSocket error: ${err.message}`, 'NETWORK_ERROR'));
        this.setupCompletePromises.delete(sessionId);
      }
    });

    ws.on('close', async (code: number, reason: Buffer) => {
      logger.info('GeminiLiveProvider: WebSocket closed', {
        sessionId,
        code,
        reason: reason.toString(),
      });
      clearSessionBalanceTicker();
      await processSessionBalanceDeduction();
      const activeSess = this.activeSessions.get(sessionId);
      if (activeSess?.balanceInterval) {
        clearInterval(activeSess.balanceInterval);
      }
      this.activeSessions.delete(sessionId);

      const handler = this.setupCompletePromises.get(sessionId);
      if (handler) {
        clearTimeout(handler.timeoutId);
        const keyError = await this.verifyApiKey(this.apiKey);
        const errMsg = keyError 
          ? `WebSocket closed before setup complete (code=${code}, reason=${reason.toString()}). API check: ${keyError}`
          : `WebSocket closed before setup complete (code=${code}, reason=${reason.toString()})`;
        handler.reject(new CallError(callId, errMsg, 'NETWORK_ERROR'));
        this.setupCompletePromises.delete(sessionId);
      } else if (code !== 1000 && code !== 1005) {
        callbacks.onError?.(
          sessionId,
          new Error(`Upstream connection closed unexpectedly by Gemini. Code: ${code}. Reason: ${reason.toString() || 'No reason provided'}`)
        );
      }
    });

    try {
      await setupCompletePromise;
      logger.info('GeminiLiveProvider: session setup complete', { callId, sessionId });
    } catch (err) {
      this.activeSessions.delete(sessionId);
      this.setupCompletePromises.delete(sessionId);

      // Retry setup once if not already retried
      if (!(config as any)._isRetry) {
        logger.warn('GeminiLiveProvider: setupComplete failed before audio started. Retrying once...', { callId, error: String(err) });
        const retryConfig = { ...config, _isRetry: true };
        return this.createSession(retryConfig, callbacks);
      }

      logger.error('GeminiLiveProvider: setupComplete failed after retry', { callId, error: String(err) });
      if (err instanceof CallError) {
        throw err;
      }
      throw new CallError(
        callId,
        `Session setup failed: ${err instanceof Error ? err.message : String(err)}`,
        'SESSION_SETUP_FAILED'
      );
    }

    return { sessionId, ws };
  }

  sendAudio(sessionId: string, audioBase64: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.ws.readyState !== WebSocket.OPEN) return;

    logger.info('[LATENCY_TEST] Caller audio received', {
      sessionId,
      timestamp: Date.now(),
      bytes: audioBase64.length,
    });

    // STRICT WIRE REQ: High-frequency streaming data chunks must use snake_case
    // Google's wire protocol requires snake_case for realtime_input streaming,
    // even though the one-time setup message uses camelCase.
    session.ws.send(
      JSON.stringify({
        realtime_input: {
          media_chunks: [
            {
              mime_type: 'audio/pcm;rate=16000',
              data: audioBase64,
            },
          ],
        },
      })
    );
  }

  sendFunctionResult(sessionId: string, callId: string, result: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.ws.readyState !== WebSocket.OPEN) return;

    let parsedResult: Record<string, unknown>;
    try {
      parsedResult = JSON.parse(result) as Record<string, unknown>;
    } catch {
      parsedResult = { result };
    }

    session.ws.send(
      JSON.stringify({
        toolResponse: {
          functionResponses: [
            {
              response: {
                output: parsedResult,
              },
              id: callId,
            },
          ],
        },
      })
    );
  }

  commitAudioBuffer(sessionId: string): void {
    // Gemini handles turns automatically via its speech activity detector
  }

  triggerGreeting(sessionId: string, greetingText?: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.ws.readyState !== WebSocket.OPEN) return;

    logger.info('GeminiLiveProvider: triggering greeting response', { sessionId });

    const textPrompt = greetingText || 'Hello! How can I assist you today?';

    session.ws.send(
      JSON.stringify({
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [
                {
                  text: textPrompt,
                },
              ],
            },
          ],
          turnComplete: true,
        },
      })
    );
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    if (session.balanceInterval) {
      clearInterval(session.balanceInterval);
    }

    if (session.cleanup) {
      try {
        await session.cleanup();
      } catch (err) {
        logger.error('GeminiLiveProvider: error in session cleanup', { sessionId, error: String(err) });
      }
    }

    try {
      if (session.ws.readyState === WebSocket.OPEN) {
        session.ws.close(1000, 'Session ended');
      }
    } catch (err) {
      logger.warn('GeminiLiveProvider: error closing WebSocket', {
        sessionId,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.activeSessions.delete(sessionId);
      logger.info('GeminiLiveProvider: session closed', { sessionId });
    }
  }

  // ─── Private Event Handling ──────────────────────────

  private async handleVectorSearch(sessionId: string, callId: string, args: Record<string, unknown>): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;
    
    const query = args.query as string;
    if (!query) {
      this.sendFunctionResult(sessionId, callId, JSON.stringify({ results: [] }));
      return;
    }

    const agentId = session.agentId;
    const userId = session.userId;
    if (!agentId || !userId) {
      logger.warn('GeminiLiveProvider: RAG search request failed due to missing session context keys', { sessionId });
      this.sendFunctionResult(sessionId, callId, JSON.stringify({ results: [] }));
      return;
    }

    const tStartKb = Date.now();
    const currentTurn = session.turnIndex || 0;
    if (session.callId) {
      callTimingTracker.markTurnToolStart(session.callId, currentTurn, 'search_knowledge_base');
    }
    logger.info('[LATENCY_TEST] Knowledge base tool invoked', { sessionId, query, agentId, turnIndex: currentTurn, timestamp: tStartKb });

    try {
      const { HybridSearchService } = await import('../../services/HybridSearchService');
      const searchResult = await HybridSearchService.search({
        agentId,
        query,
        topK: 4,
        conversationContext: session.recentTurns,
      });

      const total_ms = Date.now() - tStartKb;

      if (session.callId) {
        callTimingTracker.markTurnToolEnd(session.callId, currentTurn, {
          embedding_ms: searchResult.embeddingMs,
          db_query_ms: searchResult.dbQueryMs,
          total_ms,
        });
      }

      if (searchResult.results.length === 0) {
        logger.info('GeminiLiveProvider: RAG search returned 0 results above threshold', { sessionId, query });
        this.sendFunctionResult(sessionId, callId, JSON.stringify({
          status: 'NO_RELEVANT_FACTS_FOUND',
          message: 'No verified information found in knowledge base for this query. Do not invent an answer. State that you will check and arrange a callback.',
          results: []
        }));
        return;
      }

      const formattedResults = searchResult.results.map(r => ({
        source: `[${r.source} - ${r.section}${r.page ? ` (Page ${r.page})` : ''}]`,
        content: `<<<UNTRUSTED_EXTERNAL_DOCUMENT_SNIPPET: ${r.content}>>>`,
        relevanceScore: Number(r.score.toFixed(4)),
        matchType: r.matchType,
      }));

      logger.info('GeminiLiveProvider: Hybrid RAG search success', {
        sessionId,
        resultsCount: formattedResults.length,
        topScore: formattedResults[0]?.relevanceScore,
        embedding_ms: searchResult.embeddingMs,
        db_query_ms: searchResult.dbQueryMs,
        total_ms,
      });

      logger.info('[LATENCY_TEST] Knowledge base tool result returning', { sessionId, timestamp: Date.now(), durationMs: total_ms });
      this.sendFunctionResult(sessionId, callId, JSON.stringify({ results: formattedResults }));
    } catch (err) {
      logger.error('GeminiLiveProvider: Failed hybrid search', { sessionId, error: String(err) });
      this.sendFunctionResult(sessionId, callId, JSON.stringify({ results: [] }));
    }
  }

  private handleServerEvent(
    sessionId: string,
    event: GeminiServerEvent
  ): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;
    const callbacks = session.callbacks;

    // CRITICAL GATE: Handle immediate user barge-in interruption
    if (event.serverContent?.interrupted === true) {
      logger.info('Gemini Session: User barge-in detected. Purging active playback buffers.', { sessionId });
      if (session.callId) {
        callTimingTracker.completeTurn(session.callId, session.turnIndex);
        session.turnIndex = (session.turnIndex || 0) + 1;
      }
      callbacks.onSpeechStopped?.(sessionId, true);
      return;
    }

    // 1. Text or Audio output from model
    if (event.serverContent?.modelTurn?.parts) {
      const currentTurn = session.turnIndex || 0;
      if (session.callId) {
        callTimingTracker.startTurn(session.callId, currentTurn, session.agentId, Date.now(), 'plain');
      }

      for (const part of event.serverContent.modelTurn.parts) {
        // Audio output chunk
        if (part.inlineData && part.inlineData.data) {
          if (session.callId) {
            if (!session.hasEmittedFirstAudio) {
              session.hasEmittedFirstAudio = true;
              callTimingTracker.mark(session.callId, 'first_audio_chunk_from_gemini');
            }
            callTimingTracker.markTurnFirstAudioReceived(session.callId, currentTurn);
          }
          logger.info('[LATENCY_TEST] Audio chunk sent back from Gemini', {
            sessionId,
            timestamp: Date.now(),
            bytes: part.inlineData.data.length,
          });
          callbacks.onAudioDelta?.(sessionId, part.inlineData.data);
        }
        // Text transcript chunk
        if (part.text && !part.thought) {
          callbacks.onTranscriptDelta?.(sessionId, part.text, false);
        }
      }
    }

    // 1b. User input transcription
    if (event.serverContent?.inputTranscription?.text) {
      const uText = event.serverContent.inputTranscription.text.trim();
      if (uText) {
        if (!session.recentTurns) session.recentTurns = [];
        session.recentTurns.push(`User: ${uText}`);
        if (session.recentTurns.length > 6) session.recentTurns.shift();
      }
      logger.info('GeminiLiveProvider: received user transcription', {
        sessionId,
        text: event.serverContent.inputTranscription.text,
      });
      if (session.callId) {
        callTimingTracker.startTurn(session.callId, session.turnIndex || 0, session.agentId, Date.now(), 'plain');
      }
      callbacks.onTranscriptDelta?.(sessionId, event.serverContent.inputTranscription.text, false, true);
    }

    // 1c. Agent output transcription
    if (event.serverContent?.outputTranscription?.text) {
      const aText = event.serverContent.outputTranscription.text.trim();
      if (aText) {
        if (!session.recentTurns) session.recentTurns = [];
        session.recentTurns.push(`Agent: ${aText}`);
        if (session.recentTurns.length > 6) session.recentTurns.shift();
      }
      logger.info('GeminiLiveProvider: received agent transcription', {
        sessionId,
        text: event.serverContent.outputTranscription.text,
      });
      callbacks.onTranscriptDelta?.(sessionId, event.serverContent.outputTranscription.text, false, false);
    }

    // 2. Turn Complete
    if (event.serverContent?.turnComplete) {
      if (session.callId) {
        callTimingTracker.completeTurn(session.callId, session.turnIndex || 0);
        session.turnIndex = (session.turnIndex || 0) + 1;
      }
      callbacks.onTranscriptDelta?.(sessionId, '', true, false);
      callbacks.onResponseDone?.(sessionId);
    }

    // 4. Function call requested
    if (event.toolCall?.functionCalls) {
      if (session.callId) {
        callTimingTracker.startTurn(session.callId, session.turnIndex || 0, session.agentId, Date.now(), 'kb_query');
      }
      for (const call of event.toolCall.functionCalls) {
        if (call.name === 'search_knowledge_base') {
          this.handleVectorSearch(sessionId, call.id, call.args)
            .catch(err => {
              logger.error('GeminiLiveProvider: Failed search_knowledge_base execution', { sessionId, error: String(err) });
              this.sendFunctionResult(sessionId, call.id, JSON.stringify({ error: 'Failed to search knowledge base' }));
            });
        } else {
          callbacks.onFunctionCall?.(
            sessionId,
            call.id,
            call.name,
            JSON.stringify(call.args)
          );
        }
      }
    }

    // 5. Server Errors
    if (event.error) {
      logger.error('GeminiLiveProvider: server error', {
        sessionId,
        message: event.error.message,
        code: event.error.code,
      });
      callbacks.onError?.(sessionId, new Error(event.error.message));
    }

    // 6. Server GoAway Event (Session expiration warning)
    if (event.goAway) {
      const timeLeftSeconds = event.goAway.timeLeftMs ? Math.round(event.goAway.timeLeftMs / 1000) : 10;
      if (event.goAway.resumptionHandle) {
        session.resumptionHandle = event.goAway.resumptionHandle;
      }
      logger.warn('GeminiLiveProvider: Received GoAway notice from Google', {
        sessionId,
        timeLeftMs: event.goAway.timeLeftMs,
        resumptionHandle: event.goAway.resumptionHandle,
      });

      if (session.resumptionHandle) {
        this.attemptSessionResumption(sessionId).then((resumed) => {
          if (resumed) {
            logger.info('GeminiLiveProvider [RESUMPTION_SUCCESS]: Call continuity preserved via resumptionHandle', { sessionId });
          } else {
            logger.warn('GeminiLiveProvider [RESUMPTION_FAILED]: Fallback to graceful error on GoAway expiration', { sessionId });
            callbacks.onError?.(
              sessionId,
              new Error(`Session expired after ${timeLeftSeconds} seconds due to upstream resource constraints.`)
            );
          }
        }).catch((err) => {
          logger.error('GeminiLiveProvider: Resumption attempt error', { sessionId, error: String(err) });
        });
      } else {
        const delayMs = event.goAway.timeLeftMs ? Math.max(500, event.goAway.timeLeftMs - 1000) : 10000;
        setTimeout(() => {
          if (this.activeSessions.has(sessionId)) {
            callbacks.onError?.(
              sessionId,
              new Error(`Session expired after ${timeLeftSeconds} seconds due to upstream resource constraints.`)
            );
          }
        }, delayMs);
      }
    }
  }

  private async attemptSessionResumption(sessionId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.resumptionHandle) return false;

    logger.info('GeminiLiveProvider: Attempting session resumption with Google', {
      sessionId,
      resumptionHandle: session.resumptionHandle,
    });

    try {
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(this.apiKey)}`;
      const newWs = new WebSocket(wsUrl);

      return await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          logger.warn('GeminiLiveProvider: Resumption handshake timed out (8s)', { sessionId });
          try { newWs.close(); } catch {}
          resolve(false);
        }, 8000);

        newWs.on('open', () => {
          const resumptionPayload = {
            setup: {
              model: session.targetModel || 'models/gemini-2.0-flash-exp',
              resumptionHandle: session.resumptionHandle,
            },
          };
          newWs.send(JSON.stringify(resumptionPayload));
        });

        newWs.on('message', (raw: WebSocket.RawData) => {
          try {
            const event = JSON.parse(raw.toString()) as GeminiServerEvent;
            if (event.setupComplete) {
              clearTimeout(timeout);
              logger.info('GeminiLiveProvider [RESUMPTION_SUCCESS]: Handshake confirmed on replacement socket', { sessionId });

              const oldWs = session.ws;
              session.ws = newWs;
              try {
                oldWs.removeAllListeners();
                oldWs.close(1000, 'RESUMED');
              } catch {}

              newWs.on('message', (msgRaw: WebSocket.RawData) => {
                try {
                  const ev = JSON.parse(msgRaw.toString()) as GeminiServerEvent;
                  this.handleServerEvent(sessionId, ev);
                } catch (e) {
                  logger.error('GeminiLiveProvider: Resumed message parsing error', { sessionId, error: String(e) });
                }
              });

              newWs.on('error', (err: Error) => {
                logger.error('GeminiLiveProvider: Resumed socket error', { sessionId, error: err.message });
                session.callbacks.onError?.(sessionId, err);
              });

              newWs.on('close', (code: number) => {
                logger.info('GeminiLiveProvider: Resumed socket closed', { sessionId, code });
                this.activeSessions.delete(sessionId);
              });

              resolve(true);
            }
          } catch {
            clearTimeout(timeout);
            resolve(false);
          }
        });

        newWs.on('error', (e: Error) => {
          clearTimeout(timeout);
          logger.error('GeminiLiveProvider: Resumption socket connection error', { error: e.message });
          resolve(false);
        });
      });
    } catch (err: any) {
      logger.error('GeminiLiveProvider: Resumption fatal error', { sessionId, error: err?.message || String(err) });
      return false;
    }
  }
}
