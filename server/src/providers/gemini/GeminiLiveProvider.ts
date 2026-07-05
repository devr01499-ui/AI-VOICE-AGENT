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
}

interface ActiveSession {
  ws: WebSocket;
  callbacks: RealtimeEventCallbacks;
  createdAt: number;
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

  async createSession(
    config: RealtimeSessionConfig,
    callbacks: RealtimeEventCallbacks
  ): Promise<RealtimeSessionResult> {
    const callId = config.callId || '';
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

    const model = 'gemini-2.5-flash-native-audio-latest';

    // ✅ FIXED: Use v1alpha endpoint (was v1beta)
    // v1alpha is the current stable endpoint for Gemini Live API
    // v1beta was causing connection timeouts and API key blocking
    const apiVersion = 'v1alpha';
    
    const baseUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.${apiVersion}.GenerativeService.BidiGenerateContent`;
    
    // ✅ FIXED: Properly URL-encode the API key
    // Some special characters in API keys can break WebSocket connections if not encoded
    const wsUrl = `${baseUrl}?key=${encodeURIComponent(this.apiKey)}`;

    logger.info('GeminiLiveProvider: creating session', {
      model,
      voice: config.voice,
      apiVersion,
      endpoint: baseUrl,  // ✅ Log the endpoint for debugging
    });

    if (!this.apiKey) {
      throw new ProviderError('gemini-live', 'GEMINI_API_KEY environment variable is missing.');
    }

    const sessionId = `gemini-sess-${Date.now()}`;
    const ws = new WebSocket(wsUrl);

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

    ws.on('open', () => {
      logger.info('GeminiLiveProvider: WebSocket successfully opened. Transmission of strict snake_case setup payload initiated.');

      // Map voices: alloy/shimmer/etc. to Gemini voices (Aoede, Puck, Charon, Fenrir, Kore)
      const voiceNameMap: Record<string, string> = {
        alloy: 'Puck',
        echo: 'Charon',
        fable: 'Fenrir',
        onyx: 'Kore',
        shimmer: 'Aoede',
        puck: 'Puck',
        charon: 'Charon',
        fenrir: 'Fenrir',
        kore: 'Kore',
        aoede: 'Aoede',
      };
      const geminiVoice = 'Puck';

      // Map tools cleanly to Gemini wire function_declarations format
      const functionDeclarations = config.tools?.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters, // JSON Schema parameters can remain camelCase/nested as standard
      }));

      // STRICT WIRE PROTOCOL REQUIREMENT: Fields must be snake_case for direct raw WebSockets
      const setupMessage = {
        setup: {
          model: `models/${model}`,
          generation_config: {
            response_modalities: ['AUDIO'],
            speech_config: {
              voice_config: {
                prebuilt_voice_config: {
                  voice_name: geminiVoice,
                },
              },
            },
          },
          system_instruction: {
            parts: [
              {
                text: config.instructions,
              },
            ],
          },
          realtime_input_config: {
            automatic_activity_detection: {
              disabled: false,
              silence_duration_ms: 600,
            },
          },
          ...(functionDeclarations && functionDeclarations.length > 0 && {
            tools: [
              {
                function_declarations: functionDeclarations,
              },
            ],
          }),
        },
      };

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
          logger.info('GeminiLiveProvider [HANDSHAKE]: setupComplete received from Google.', { sessionId, event: JSON.stringify(event) });
          this.activeSessions.set(sessionId, {
            ws,
            callbacks,
            createdAt: Date.now(),
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

    session.ws.send(
      JSON.stringify({
        realtimeInput: {
          mediaChunks: [
            {
              mimeType: 'audio/pcm;rate=16000',
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
        if (part.text) {
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
      callbacks.onTranscriptDelta?.(sessionId, event.serverContent.inputTranscription.text, true, true);
    }

    // 2. Turn Complete
    if (event.serverContent?.turnComplete) {
      callbacks.onResponseDone?.(sessionId);
    }



    // 4. Function call requested
    if (event.toolCall?.functionCalls) {
      for (const call of event.toolCall.functionCalls) {
        callbacks.onFunctionCall?.(
          sessionId,
          call.id,
          call.name,
          JSON.stringify(call.args)
        );
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
  }
}
