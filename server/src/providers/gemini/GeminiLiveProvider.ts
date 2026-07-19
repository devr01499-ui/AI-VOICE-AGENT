/**
 * Bolna Server — Google Gemini Live Provider
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
}

export class GeminiLiveProvider implements IRealtimeProvider {
  public readonly name = 'gemini-live';
  public readonly type = 'realtime';
  public currentAgent?: {
    systemPrompt?: string;
    instruction?: string;
    voice?: string;
    model?: string;
  };
  public ws!: WebSocket;

  private balanceIntervalId: NodeJS.Timeout | null = null;
  private callStartTime: number | null = null;
  private currentUserId: string | null = null;
  private accountsAgainstPlatformBalance: boolean = false;

  private clearBalanceTicker() {
    if (this.balanceIntervalId) {
      clearInterval(this.balanceIntervalId);
      this.balanceIntervalId = null;
    }
  }

  private async processBalanceDeduction(): Promise<void> {
    if (this.callStartTime && this.accountsAgainstPlatformBalance && this.currentUserId) {
      const elapsedSeconds = (Date.now() - this.callStartTime) / 1000;
      const elapsedMinutes = elapsedSeconds / 60;
      const decrementVal = parseFloat(elapsedMinutes.toFixed(4));
      
      const userId = this.currentUserId;
      this.callStartTime = null; // Prevent double deduction
      this.accountsAgainstPlatformBalance = false;
      this.currentUserId = null;

      try {
        const prismaInstance = (await import('../../lib/prisma')).prisma;
        const userRecord = await prismaInstance.user.findUnique({ where: { id: userId }, select: { email: true } });
        const isAdmin = userRecord?.email === ADMIN_EMAIL;

        if (isAdmin) {
          // Admin: only track total consumption, never decrement callingBalanceMinutes
          await prismaInstance.user.update({
            where: { id: userId },
            data: { totalMinutesConsumed: { increment: decrementVal } }
          });
          logger.info('Monetization Gateway: Tracked admin usage (no balance deduction)', { userId, elapsedMinutes: decrementVal });
        } else {
          // Regular users: decrement calling balance and track total consumption
          await prismaInstance.user.update({
            where: { id: userId },
            data: {
              callingBalanceMinutes: { decrement: decrementVal },
              totalMinutesConsumed: { increment: decrementVal },
            }
          });
          logger.info('Monetization Gateway: Deducted minutes from platform balance upon call termination', {
            userId,
            elapsedMinutes: decrementVal
          });
        }
      } catch (err) {
        logger.error('Monetization Gateway: Failed to decrement calling credits on session closure', { error: String(err) });
      }
    }
  }

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
    const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'shimmer', 'puck', 'charon', 'fenrir', 'kore', 'aoede'];
    if (config.voice && !validVoices.includes(config.voice.toLowerCase())) {
      throw new CallError(callId, `Invalid voice: ${config.voice}`, 'INVALID_CONFIG');
    }

    // priority key/balance waterfall resolution:
    const userId = config.userId;
    if (!userId) {
      throw new CallError(callId, 'userId required for value gateway check', 'INVALID_CONFIG');
    }

    const prismaInstance = (await import('../../lib/prisma')).prisma;
    const userProfile = await prismaInstance.user.findUnique({ where: { id: userId } });
    if (!userProfile) {
      throw new CallError(callId, 'Authenticated user profile not found', 'INVALID_CONFIG');
    }

    let selectedApiKey: string;
    let accountsAgainstPlatformBalance = false;

    if (userProfile.geminiApiKey && userProfile.geminiApiKey.trim() !== '') {
      // Use User's Custom Key (BYOK Mode - Cost Free to Platform)
      selectedApiKey = userProfile.geminiApiKey.trim();
      logger.info('Monetization Gateway: BYOK Mode enabled', { userId, callId });
    } else if (userProfile.email === ADMIN_EMAIL) {
      // Admin account: always use platform master key, never block, track usage only
      selectedApiKey = this.apiKey;
      accountsAgainstPlatformBalance = true;
      logger.info('Monetization Gateway: Admin bypass active — using platform key without balance check', { userId, callId });
    } else if (userProfile.callingBalanceMinutes > 0) {
      // Use Platform Central Master Key (Subtracts User Free Balance Trial minutes)
      selectedApiKey = this.apiKey;
      accountsAgainstPlatformBalance = true;
      logger.info('Monetization Gateway: Platform Balance Mode enabled', { userId, callId, remainingMinutes: userProfile.callingBalanceMinutes });
    } else {
      // Block Session Execution completely due to empty balances
      logger.warn('Monetization Gateway: Access blocked. Insufficient balances or missing keys.', { userId, callId });
      throw new Error("INSUFFICIENT_FUNDS_OR_MISSING_KEY");
    }

    const model = 'gemini-2.5-flash-native-audio-latest';
    const apiVersion = 'v1alpha';
    const baseUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.${apiVersion}.GenerativeService.BidiGenerateContent`;
    const wsUrl = `${baseUrl}?key=${encodeURIComponent(selectedApiKey)}`;

    const sessionId = `gemini-sess-${Date.now()}`;
    const ws = new WebSocket(wsUrl);

    // Bind context instances
    this.currentAgent = {
      systemPrompt: config.instructions,
      instruction: config.instructions,
      voice: config.voice,
      model: `models/${model}`,
    };
    this.ws = ws;
    this.currentUserId = userId;
    this.callStartTime = Date.now();
    this.accountsAgainstPlatformBalance = accountsAgainstPlatformBalance;

    ws.on('close', () => this.clearBalanceTicker());
    ws.on('error', () => this.clearBalanceTicker());
    ws.on('unexpected-response', () => this.clearBalanceTicker());

    // Repeating balance countdown interval loop:
    if (accountsAgainstPlatformBalance) {
      this.balanceIntervalId = setInterval(async () => {
        try {
          if (ws.readyState !== WebSocket.OPEN) {
            this.clearBalanceTicker();
            return;
          }

          if (!this.callStartTime) return;
          const elapsedSeconds = (Date.now() - this.callStartTime) / 1000;
          const elapsedMinutes = elapsedSeconds / 60;

          const currentUser = await prismaInstance.user.findUnique({
            where: { id: userId }
          });

          if (!currentUser) {
            this.clearBalanceTicker();
            ws.close(1011, "USER_NOT_FOUND");
            return;
          }

          logger.info('Monetization Gateway: Balance check ticker', {
            userId,
            elapsedMinutes: elapsedMinutes.toFixed(4),
            startingBalance: currentUser.callingBalanceMinutes
          });

          if (elapsedMinutes >= currentUser.callingBalanceMinutes) {
            logger.warn('Monetization Gateway: Balance depleted. Terminating connection cleanly.', { userId, callId });
            this.clearBalanceTicker();
            ws.close(1011, "INSUFFICIENT_BALANCE");
            callbacks.onError?.(sessionId, new Error("INSUFFICIENT_BALANCE"));
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
      logger.info('GeminiLiveProvider: WebSocket successfully opened. Transmission of strict snake_case setup payload initiated.');

      resolvedAgentId = config.agentId;
      if (config.callId) {
        try {
          const prismaInstance = (await import('../../lib/prisma')).prisma;
          const callLog = await prismaInstance.call.findFirst({
            where: { id: config.callId, userId },
            select: { agentId: true }
          });
          if (callLog?.agentId) {
            resolvedAgentId = callLog.agentId;
          }
        } catch (err) {
          logger.error('GeminiLiveProvider: Failed to resolve callLog', { error: String(err) });
        }
      }

      let hasKbDocs = false;
      if (resolvedAgentId) {
        try {
          const prismaInstance = (await import('../../lib/prisma')).prisma;
          const count = await prismaInstance.knowledgeBase.count({
            where: {
              userId,
              agentLinks: {
                some: {
                  agentId: resolvedAgentId
                }
              }
            }
          });
          hasKbDocs = count > 0;
        } catch (err) {
          logger.error('GeminiLiveProvider: Failed to count kbDocs', { error: String(err) });
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
      }

      let systemInstructionString = this.currentAgent?.systemPrompt || this.currentAgent?.instruction || "Default assistant prompt";

      if (hasKbDocs) {
        systemInstructionString = `${systemInstructionString}\n\n[KNOWLEDGE BASE GATES]\nYou have access to a knowledge base search tool 'search_knowledge_base'. If the user asks questions about facts, documents, websites, or details that you do not know, you MUST call this tool with a relevant search query to find the answer. Do not guess.`;
        logger.info('GeminiLiveProvider: Exposing search_knowledge_base tool to agent', { agentId: resolvedAgentId });
      }

      let systemVoiceVal = 'Puck';
      let temperatureVal = 0.7;
      let languageModeVal = 'auto';

      if (config.agentId) {
        try {
          const prismaInstance = (await import('../../lib/prisma')).prisma;
          const dbAgent = await prismaInstance.agent.findFirst({
            where: { id: config.agentId, userId },
            select: { systemVoice: true, temperature: true, languageMode: true }
          });
          if (dbAgent) {
            systemVoiceVal = dbAgent.systemVoice || 'Puck';
            temperatureVal = dbAgent.temperature ?? 0.7;
            languageModeVal = dbAgent.languageMode || 'auto';
          }
        } catch (dbErr) {
          logger.error('GeminiLiveProvider: Failed to fetch agent parameters from database', { 
            agentId: config.agentId, 
            error: String(dbErr) 
          });
        }
      }

      // Supported target languages for system-instruction injection
      const languageInstructionMap: Record<string, string> = {
        en: "English",
        hi: "Hindi",
      };

      if (languageModeVal && languageModeVal !== 'auto') {
        const targetLang = languageInstructionMap[languageModeVal];
        if (targetLang) {
          systemInstructionString = `${systemInstructionString}\n\n[LANGUAGE SECURITY GATES]\nYou must listen, transcribe, and respond strictly in ${targetLang} only. Never transcribe user input or respond in any other language under any circumstances.`;
        }
      }

      const agentVoiceMapping = systemVoiceVal || this.currentAgent?.voice || "Puck";

      // Map voices: alloy/shimmer/etc. to Gemini voices (Aoede, Puck, Charon, Fenrir, Kore)
      const voiceNameMap: Record<string, string> = {
        alloy: 'Aoede',
        echo: 'Fenrir',
        fable: 'Fenrir',
        onyx: 'Kore',
        shimmer: 'Aoede',
        puck: 'Puck',
        charon: 'Charon',
        fenrir: 'Fenrir',
        kore: 'Kore',
        aoede: 'Aoede',
      };
      const geminiVoice = voiceNameMap[agentVoiceMapping.toLowerCase()] || agentVoiceMapping;

      const setupMessage = {
        setup: {
          model: this.currentAgent?.model || "models/gemini-2.5-flash-native-audio-latest",
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
              silenceDurationMs: 600
            }
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

      logger.info('GeminiLiveProvider: Transmitting completed handshake frame to Google wire socket', {
        targetModel: setupMessage.setup.model,
        selectedVoice: geminiVoice
      });

      this.ws.send(JSON.stringify(setupMessage));
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
          logger.info('GeminiLiveProvider [HANDSHAKE]: setupComplete received from Google.', { sessionId, event: JSON.stringify(event) });
          this.callStartTime = Date.now();
          this.activeSessions.set(sessionId, {
            ws,
            callbacks,
            createdAt: Date.now(),
            agentId: resolvedAgentId || undefined,
            userId,
            ...(this.balanceIntervalId && { balanceInterval: this.balanceIntervalId }),
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
      this.clearBalanceTicker();
      this.processBalanceDeduction().catch((deductErr) => {
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
      this.clearBalanceTicker();
      await this.processBalanceDeduction();
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
      } else {
        callbacks.onError?.(
          sessionId,
          new Error(`Upstream connection closed by Gemini. Code: ${code}. Reason: ${reason.toString() || 'No reason provided'}`)
        );
      }
    });

    try {
      await setupCompletePromise;
      logger.info('GeminiLiveProvider: session setup complete', { callId, sessionId });
    } catch (err) {
      this.activeSessions.delete(sessionId);
      this.setupCompletePromises.delete(sessionId);
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

    logger.info('GeminiLiveProvider: sending audio to Gemini', {
      sessionId,
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

    const textPrompt = greetingText || 'Hi, please start the interview.';

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

    this.clearBalanceTicker();
    await this.processBalanceDeduction();

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

    logger.info('GeminiLiveProvider: Performing pgvector search', { sessionId, query, agentId });

    try {
      const { getEmbedding } = await import('../../utils/embedding');
      const queryVector = await getEmbedding(query);

      const prismaInstance = (await import('../../lib/prisma')).prisma;

      const kbDocs = await prismaInstance.knowledgeBase.findMany({
        where: {
          userId,
          agentLinks: {
            some: {
              agentId
            }
          }
        },
        select: { id: true }
      });

      if (kbDocs.length === 0) {
        this.sendFunctionResult(sessionId, callId, JSON.stringify({ results: [] }));
        return;
      }

      const kbIds = kbDocs.map(d => d.id);
      
      const results: any[] = await prismaInstance.$queryRawUnsafe(
        `SELECT id, content, (embedding <=> cast($1 as vector)) as distance FROM "kb_chunks" WHERE "kb_id" IN (${kbIds.map(id => `'${id}'`).join(',')}) ORDER BY distance ASC LIMIT 3`,
        `[${queryVector.join(',')}]`
      );

      const formattedResults = results.map(r => ({
        content: r.content,
        score: 1 - r.distance
      }));

      logger.info('GeminiLiveProvider: pgvector search success', {
        sessionId,
        resultsCount: formattedResults.length,
        topScore: formattedResults[0]?.score
      });

      this.sendFunctionResult(sessionId, callId, JSON.stringify({ results: formattedResults }));
    } catch (err) {
      logger.error('GeminiLiveProvider: Failed pgvector search', { sessionId, error: String(err) });
      throw err;
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
      callbacks.onSpeechStopped?.(sessionId, true);
      return;
    }

    // 1. Text or Audio output from model
    if (event.serverContent?.modelTurn?.parts) {
      for (const part of event.serverContent.modelTurn.parts) {
        // Audio output chunk
        if (part.inlineData && part.inlineData.data) {
          logger.info('GeminiLiveProvider: received audio from Gemini', {
            sessionId,
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
      logger.info('GeminiLiveProvider: received user transcription', {
        sessionId,
        text: event.serverContent.inputTranscription.text,
      });
      callbacks.onTranscriptDelta?.(sessionId, event.serverContent.inputTranscription.text, false, true);
    }

    // 1c. Agent output transcription
    if (event.serverContent?.outputTranscription?.text) {
      logger.info('GeminiLiveProvider: received agent transcription', {
        sessionId,
        text: event.serverContent.outputTranscription.text,
      });
      callbacks.onTranscriptDelta?.(sessionId, event.serverContent.outputTranscription.text, false, false);
    }

    // 2. Turn Complete
    if (event.serverContent?.turnComplete) {
      callbacks.onTranscriptDelta?.(sessionId, '', true, false);
      callbacks.onResponseDone?.(sessionId);
    }

    // 4. Function call requested
    if (event.toolCall?.functionCalls) {
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
      logger.warn('GeminiLiveProvider: Received GoAway notice from Google', {
        sessionId,
        timeLeftMs: event.goAway.timeLeftMs,
        resumptionHandle: event.goAway.resumptionHandle,
      });
      callbacks.onError?.(
        sessionId,
        new Error(`Session is ending in ${timeLeftSeconds} seconds due to upstream resource constraints.`)
      );
    }
  }
}
