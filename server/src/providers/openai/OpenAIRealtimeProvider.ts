/**
 * Bolna Server — OpenAI Realtime Provider
 *
 * WebSocket client for the OpenAI Realtime API. Manages per-call sessions
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

// ─── OpenAI Wire Protocol Types ───────────────────────

interface OpenAIServerEvent {
  type: string;
  [key: string]: unknown;
}

interface OpenAISessionCreatedEvent extends OpenAIServerEvent {
  type: 'session.created';
  session: { id: string };
}

interface OpenAIAudioDeltaEvent extends OpenAIServerEvent {
  type: 'response.audio.delta';
  delta: string;
}

interface OpenAITranscriptDeltaEvent extends OpenAIServerEvent {
  type: 'response.audio_transcript.delta';
  delta: string;
}

interface OpenAIFunctionCallDoneEvent extends OpenAIServerEvent {
  type: 'response.function_call_arguments.done';
  call_id: string;
  name: string;
  arguments: string;
}

interface OpenAIErrorEvent extends OpenAIServerEvent {
  type: 'error';
  error: { message: string; type: string; code: string };
}

// ─── Active Session Tracking ──────────────────────────

interface ActiveSession {
  ws: WebSocket;
  callbacks: RealtimeEventCallbacks;
  createdAt: number;
}

// ─── Provider Implementation ──────────────────────────

export class OpenAIRealtimeProvider implements IRealtimeProvider {
  public readonly name = 'openai-realtime';
  public readonly type = 'realtime';

  private readonly activeSessions = new Map<string, ActiveSession>();
  private readonly apiKey: string;
  private readonly wsBaseUrl = 'wss://api.openai.com/v1/realtime';

  constructor() {
    this.apiKey = env.OPENAI_API_KEY || '';
  }

  async connect(): Promise<void> {
    logger.info('OpenAIRealtimeProvider: ready (connections are per-session)');
  }

  async disconnect(): Promise<void> {
    const sessionIds = Array.from(this.activeSessions.keys());
    for (const sid of sessionIds) {
      await this.closeSession(sid);
    }
    logger.info('OpenAIRealtimeProvider: all sessions closed');
  }

  /** Verifies the API key is present. A full health check would need an HTTP endpoint. */
  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    const healthy = Boolean(this.apiKey && this.apiKey.length > 0);
    return {
      healthy,
      latencyMs: Date.now() - start,
      details: healthy ? 'API key configured' : 'Missing OPENAI_API_KEY',
    };
  }

  /** Opens a WebSocket to OpenAI Realtime, sends session.update, returns sessionId. */
  async createSession(
    config: RealtimeSessionConfig,
    callbacks: RealtimeEventCallbacks
  ): Promise<RealtimeSessionResult> {
    const model = config.model || env.OPENAI_REALTIME_MODEL;
    const wsUrl = `${this.wsBaseUrl}?model=${encodeURIComponent(model)}`;

    logger.info('OpenAIRealtimeProvider: creating session', {
      model,
      voice: config.voice,
    });

    return new Promise<RealtimeSessionResult>((resolve, reject) => {
      const ws = new WebSocket(wsUrl, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'OpenAI-Beta': 'realtime=v1',
        },
      });

      let sessionId = '';
      let resolved = false;

      const connectionTimeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          ws.close();
          reject(new ProviderError('openai-realtime', 'Connection timeout after 15s'));
        }
      }, 15_000);

      ws.on('open', () => {
        logger.debug('OpenAIRealtimeProvider: WebSocket connected, sending session.update');

        const sessionUpdate = {
          type: 'session.update',
          session: {
            voice: config.voice,
            instructions: config.instructions,
            input_audio_format: config.inputAudioFormat || 'pcm16',
            output_audio_format: config.outputAudioFormat || 'pcm16',
            input_audio_transcription: { model: 'whisper-1' },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
            },
            ...(config.tools && config.tools.length > 0 && {
              tools: config.tools.map((t) => ({
                type: t.type,
                name: t.name,
                description: t.description,
                parameters: t.parameters,
              })),
            }),
          },
        };

        ws.send(JSON.stringify(sessionUpdate));
      });

      ws.on('message', (raw: WebSocket.RawData) => {
        try {
          const event = JSON.parse(raw.toString()) as OpenAIServerEvent;
          this.handleServerEvent(sessionId, event, callbacks);

          // Resolve the promise once we get session.created
          if (event.type === 'session.created' && !resolved) {
            const created = event as OpenAISessionCreatedEvent;
            sessionId = created.session.id;

            this.activeSessions.set(sessionId, {
              ws,
              callbacks,
              createdAt: Date.now(),
            });

            clearTimeout(connectionTimeout);
            resolved = true;

            logger.info('OpenAIRealtimeProvider: session created', { sessionId });
            resolve({ sessionId, ws });
          }
        } catch (err) {
          logger.error('OpenAIRealtimeProvider: failed to parse server event', {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      });

      ws.on('error', (err: Error) => {
        logger.error('OpenAIRealtimeProvider: WebSocket error', {
          sessionId,
          error: err.message,
        });
        callbacks.onError?.(sessionId, err);

        if (!resolved) {
          clearTimeout(connectionTimeout);
          resolved = true;
          reject(new ProviderError('openai-realtime', `WebSocket error: ${err.message}`));
        }
      });

      ws.on('close', (code: number, reason: Buffer) => {
        logger.info('OpenAIRealtimeProvider: WebSocket closed', {
          sessionId,
          code,
          reason: reason.toString(),
        });
        this.activeSessions.delete(sessionId);

        if (!resolved) {
          clearTimeout(connectionTimeout);
          resolved = true;
          reject(new ProviderError('openai-realtime', `WebSocket closed before session created (code=${code})`));
        }
      });
    });
  }

  /** Streams audio data to OpenAI for the given session. */
  sendAudio(sessionId: string, audioBase64: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      logger.warn('OpenAIRealtimeProvider: sendAudio called for unknown session', { sessionId });
      return;
    }

    if (session.ws.readyState !== WebSocket.OPEN) {
      logger.warn('OpenAIRealtimeProvider: WebSocket not open for sendAudio', {
        sessionId,
        readyState: session.ws.readyState,
      });
      return;
    }

    session.ws.send(
      JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: audioBase64,
      })
    );
  }

  /** Sends a function call result back to OpenAI so it can continue its response. */
  sendFunctionResult(sessionId: string, callId: string, result: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.ws.readyState !== WebSocket.OPEN) return;

    session.ws.send(
      JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callId,
          output: result,
        },
      })
    );

    // Trigger a new response turn after providing the function result
    session.ws.send(JSON.stringify({ type: 'response.create' }));
  }

  /** Explicitly commits the audio buffer so OpenAI processes it. */
  commitAudioBuffer(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.ws.readyState !== WebSocket.OPEN) return;

    session.ws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
  }

  /** Closes the OpenAI session and its WebSocket. */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      logger.debug('OpenAIRealtimeProvider: closeSession called for unknown session', { sessionId });
      return;
    }

    try {
      if (session.ws.readyState === WebSocket.OPEN) {
        session.ws.close(1000, 'Session ended');
      }
    } catch (err) {
      logger.warn('OpenAIRealtimeProvider: error closing WebSocket', {
        sessionId,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.activeSessions.delete(sessionId);
      logger.info('OpenAIRealtimeProvider: session closed', { sessionId });
    }
  }

  /** Returns count of active sessions (useful for metrics). */
  getActiveSessionCount(): number {
    return this.activeSessions.size;
  }

  // ─── Private: Event Routing ─────────────────────────

  private handleServerEvent(
    sessionId: string,
    event: OpenAIServerEvent,
    callbacks: RealtimeEventCallbacks
  ): void {
    switch (event.type) {
      case 'session.created':
      case 'session.updated':
        logger.debug(`OpenAIRealtimeProvider: ${event.type}`, { sessionId });
        break;

      case 'response.audio.delta': {
        const audioEvent = event as OpenAIAudioDeltaEvent;
        callbacks.onAudioDelta?.(sessionId, audioEvent.delta);
        break;
      }

      case 'response.audio_transcript.delta': {
        const transcriptEvent = event as OpenAITranscriptDeltaEvent;
        callbacks.onTranscriptDelta?.(sessionId, transcriptEvent.delta, false);
        break;
      }

      case 'response.audio_transcript.done': {
        const doneTranscript = event as OpenAITranscriptDeltaEvent;
        callbacks.onTranscriptDelta?.(sessionId, doneTranscript.delta || '', true);
        break;
      }

      case 'input_audio_buffer.speech_started':
        callbacks.onSpeechStarted?.(sessionId);
        break;

      case 'input_audio_buffer.speech_stopped':
        callbacks.onSpeechStopped?.(sessionId);
        break;

      case 'response.function_call_arguments.done': {
        const fnEvent = event as OpenAIFunctionCallDoneEvent;
        callbacks.onFunctionCall?.(
          sessionId,
          fnEvent.call_id,
          fnEvent.name,
          fnEvent.arguments
        );
        break;
      }

      case 'response.done':
        callbacks.onResponseDone?.(sessionId);
        break;

      case 'error': {
        const errEvent = event as OpenAIErrorEvent;
        logger.error('OpenAIRealtimeProvider: server error', {
          sessionId,
          errorType: errEvent.error.type,
          errorCode: errEvent.error.code,
          errorMessage: errEvent.error.message,
        });
        callbacks.onError?.(sessionId, new Error(errEvent.error.message));
        break;
      }

      default:
        logger.debug('OpenAIRealtimeProvider: unhandled event', {
          sessionId,
          type: event.type,
        });
    }
  }
}
