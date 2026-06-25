/**
 * Bolna Server — Google Gemini Live Provider
 *
 * WebSocket client for the Google Gemini Multimodal Live API. Manages per-call sessions
 * with bidirectional audio streaming and function-call execution.
 * Sessions are stored in an in-memory Map; cleanup is mandatory on call end.
 */

import WebSocket from 'ws';
import { logger } from '../../utils/logger';
import { ProviderError } from '../../types/errors';
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
  private readonly wsBaseUrl = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent';

  constructor() {
    this.apiKey = env.GEMINI_API_KEY || env.GOOGLE_API_KEY || '';
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
    const model = config.model || env.GEMINI_REALTIME_MODEL;
    // Format Gemini URL with key query parameter
    const wsUrl = `${this.wsBaseUrl}?key=${this.apiKey}`;

    logger.info('GeminiLiveProvider: creating session', {
      model,
      voice: config.voice,
    });

    if (!this.apiKey) {
      throw new ProviderError('gemini-live', 'GEMINI_API_KEY environment variable is missing.');
    }

    return new Promise<RealtimeSessionResult>((resolve, reject) => {
      const ws = new WebSocket(wsUrl);

      let sessionId = `gemini-sess-${Date.now()}`;
      let resolved = false;

      const connectionTimeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          ws.close();
          reject(new ProviderError('gemini-live', 'Connection timeout after 15s'));
        }
      }, 15_000);

      ws.on('open', () => {
        logger.debug('GeminiLiveProvider: WebSocket connected, sending setup message');

        // Map voices: alloy/shimmer/etc. to Gemini voices (Aoede, Puck, Charon, Fenrir, Kore)
        const voiceNameMap: Record<string, string> = {
          alloy: 'Puck',
          echo: 'Charon',
          fable: 'Fenrir',
          onyx: 'Kore',
          shimmer: 'Aoede',
        };
        const geminiVoice = voiceNameMap[config.voice.toLowerCase()] || 'Puck';

        // Map tools to Gemini functionDeclarations format
        const functionDeclarations = config.tools?.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        }));

        const setupMessage = {
          setup: {
            model: `models/${model}`,
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: geminiVoice,
                  },
                },
              },
            },
            systemInstruction: {
              parts: [
                {
                  text: config.instructions,
                },
              ],
            },
            ...(functionDeclarations && functionDeclarations.length > 0 && {
              tools: [
                {
                  functionDeclarations,
                },
              ],
            }),
          },
        };

        ws.send(JSON.stringify(setupMessage));
      });

      ws.on('message', (raw: WebSocket.RawData) => {
        try {
          const event = JSON.parse(raw.toString()) as GeminiServerEvent;

          // Handshake complete once setupComplete is received
          if (event.setupComplete && !resolved) {
            this.activeSessions.set(sessionId, {
              ws,
              callbacks,
              createdAt: Date.now(),
            });

            clearTimeout(connectionTimeout);
            resolved = true;

            logger.info('GeminiLiveProvider: session created', { sessionId });
            resolve({ sessionId, ws });
            return;
          }

          // Handle runtime events
          this.handleServerEvent(sessionId, event, callbacks);
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

        if (!resolved) {
          clearTimeout(connectionTimeout);
          resolved = true;
          reject(new ProviderError('gemini-live', `WebSocket error: ${err.message}`));
        }
      });

      ws.on('close', (code: number, reason: Buffer) => {
        logger.info('GeminiLiveProvider: WebSocket closed', {
          sessionId,
          code,
          reason: reason.toString(),
        });
        this.activeSessions.delete(sessionId);

        if (!resolved) {
          clearTimeout(connectionTimeout);
          resolved = true;
          reject(new ProviderError('gemini-live', `WebSocket closed before setup complete (code=${code})`));
        }
      });
    });
  }

  sendAudio(sessionId: string, audioBase64: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.ws.readyState !== WebSocket.OPEN) return;

    session.ws.send(
      JSON.stringify({
        realtimeInput: {
          mediaChunks: [
            {
              mimeType: 'audio/pcm',
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
    event: GeminiServerEvent,
    callbacks: RealtimeEventCallbacks
  ): void {
    // 1. Text or Audio output from model
    if (event.serverContent?.modelTurn?.parts) {
      for (const part of event.serverContent.modelTurn.parts) {
        // Audio output chunk
        if (part.inlineData && part.inlineData.data) {
          callbacks.onAudioDelta?.(sessionId, part.inlineData.data);
        }
        // Text transcript chunk
        if (part.text) {
          callbacks.onTranscriptDelta?.(sessionId, part.text, false);
        }
      }
    }

    // 2. Turn Complete
    if (event.serverContent?.turnComplete) {
      callbacks.onResponseDone?.(sessionId);
    }

    // 3. User Interruption detected
    if (event.serverContent?.interrupted) {
      callbacks.onSpeechStarted?.(sessionId);
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
