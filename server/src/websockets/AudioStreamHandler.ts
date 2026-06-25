/**
 * Bolna Server — WebSocket Audio Stream Handler
 *
 * Handles bidirectional audio streaming between Vobiz telephony and
 * OpenAI Realtime. When Vobiz answers a call and opens a WebSocket
 * stream (via the <Stream> XML directive), this handler:
 *
 *   1. Accepts the incoming WebSocket connection
 *   2. Parses the callId from the query string
 *   3. Starts the VoiceRuntimeEngine session for the call
 *   4. Routes incoming audio (Vobiz → OpenAI)
 *   5. Routes response audio (OpenAI → Vobiz)
 *   6. Manages connection lifecycle and cleanup
 *
 * Events emitted: audio:received, audio:processed, transcript:segment,
 * call:status, call:error, call:ended
 */

import { IncomingMessage } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { logger } from '../utils/logger';
import { VoiceRuntimeEngine } from '../runtime/VoiceRuntimeEngine';
import type { VobizStreamEvent } from '../types';

// ─── Active Connection Tracking ───────────────────

interface ActiveConnection {
  ws: WebSocket;
  callId: string;
  streamId: string | null;
  createdAt: number;
}

// ─── Handler Implementation ──────────────────────

export class AudioStreamHandler {
  private readonly connections = new Map<string, ActiveConnection>();

  /**
   * Attaches the WebSocket upgrade handler to the given WebSocketServer.
   * Should be called once during server bootstrap.
   */
  initialize(wss: WebSocketServer): void {
    wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    logger.info('AudioStreamHandler: initialized');
  }

  /**
   * Returns the count of active audio stream connections.
   */
  getActiveConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Closes all active connections. Used during graceful shutdown.
   */
  async closeAll(): Promise<void> {
    for (const [callId, conn] of this.connections) {
      try {
        conn.ws.close(1000, 'Server shutting down');
      } catch {
        // Ignore close errors during shutdown
      }
      this.connections.delete(callId);
    }
  }

  // ─── Private: Connection Handling ───────────────

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    // Parse callId from the URL query string
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const callId = url.searchParams.get('callId');

    if (!callId) {
      logger.warn('AudioStreamHandler: connection rejected — missing callId');
      ws.close(1008, 'Missing callId parameter');
      return;
    }

    logger.info('AudioStreamHandler: new connection', { callId });

    const conn: ActiveConnection = {
      ws,
      callId,
      streamId: null,
      createdAt: Date.now(),
    };

    this.connections.set(callId, conn);

    // Wire up event handlers
    ws.on('message', (data: WebSocket.RawData) => {
      this.handleMessage(callId, data);
    });

    ws.on('close', (code: number, reason: Buffer) => {
      this.handleClose(callId, code, reason.toString());
    });

    ws.on('error', (err: Error) => {
      this.handleError(callId, err);
    });
  }

  private handleMessage(callId: string, data: WebSocket.RawData): void {
    try {
      const message = JSON.parse(data.toString()) as VobizStreamEvent;

      switch (message.event) {
        case 'start':
          this.handleStreamStart(callId, message);
          break;

        case 'media':
          this.handleMediaEvent(callId, message);
          break;

        case 'stop':
          this.handleStreamStop(callId, message);
          break;

        default:
          logger.debug('AudioStreamHandler: unhandled event', {
            callId,
            event: (message as { event: string }).event,
          });
      }
    } catch (err) {
      logger.error('AudioStreamHandler: failed to parse message', {
        callId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Vobiz stream started — initialize the VoiceRuntimeEngine session.
   */
  private handleStreamStart(callId: string, event: VobizStreamEvent): void {
    if (event.event !== 'start') return;

    const conn = this.connections.get(callId);
    // Parse streamId robustly from both flat and nested structures
    const rawEvent = event as any;
    const streamId = rawEvent.streamId || rawEvent.start?.streamId || null;
    if (conn) {
      conn.streamId = streamId;
    }

    logger.info('AudioStreamHandler: stream started', {
      callId,
      streamId,
    });

    // Start the runtime engine session
    // We need to look up the call to get the agentId
    const engine = VoiceRuntimeEngine.instance;

    // Import CallRepository inline to avoid circular dependency at module level
    import('../repositories/CallRepository').then(({ CallRepository }) => {
      CallRepository.findById(callId)
        .then((call) => {
          return engine.startSession(callId, call.agentId, call.recipientPhoneNumber);
        })
        .then((sessionId) => {
          logger.info('AudioStreamHandler: runtime session started', { callId, sessionId });

          // Wire up audio response callback — send OpenAI/Gemini audio back to Vobiz
          const originalSpeechStarted = engine.sessionManager['callbacks'].onSpeechStarted;
          engine.sessionManager.setCallbacks({
            ...engine.sessionManager['callbacks'],
            onAudioResponse: (_callId: string, audioBase64: string) => {
              this.sendAudioToVobiz(_callId, audioBase64);
            },
            onSpeechStarted: (_callId: string) => {
              originalSpeechStarted?.(_callId);
              this.clearAudio(_callId);
            },
          });

          // Trigger initial greeting after 1 second to stabilize handset audio path
          setTimeout(() => {
            try {
              logger.info('AudioStreamHandler: triggering initial greeting', { callId });
              engine.sessionManager.triggerGreeting(callId);
            } catch (err) {
              logger.error('AudioStreamHandler: failed to trigger greeting', {
                callId,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          }, 1000);
        })
        .catch((err) => {
          logger.error('AudioStreamHandler: failed to start runtime session', {
            callId,
            error: err instanceof Error ? err.message : String(err),
          });

          // Update call status to failed so dashboard does not hang on ringing/connected
          CallRepository.updateStatus(callId, 'failed')
            .then(() => {
              return CallRepository.updateExecution(callId, {
                outcome: 'unsuccessful',
                metadata: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
              });
            })
            .catch((dbErr) => {
              logger.error('AudioStreamHandler: failed to update DB status to failed', {
                callId,
                error: dbErr instanceof Error ? dbErr.message : String(dbErr),
              });
            });

          const connRef = this.connections.get(callId);
          if (connRef) {
            connRef.ws.close(1011, 'Failed to start session');
          }
        });
    }).catch((err) => {
      logger.error('AudioStreamHandler: failed to import CallRepository', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  /**
   * Vobiz audio media received — forward to OpenAI Realtime via the engine.
   */
  private handleMediaEvent(callId: string, event: VobizStreamEvent): void {
    if (event.event !== 'media') return;

    const engine = VoiceRuntimeEngine.instance;
    engine.processAudioStream(callId, event.media.payload);
  }

  /**
   * Vobiz stream stopped — clean up.
   */
  private handleStreamStop(callId: string, _event: VobizStreamEvent): void {
    logger.info('AudioStreamHandler: stream stopped', { callId });

    const engine = VoiceRuntimeEngine.instance;
    engine.endSession(callId, 'stream_stopped').catch((err) => {
      logger.error('AudioStreamHandler: failed to end session on stream stop', {
        callId,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  /**
   * Sends audio data back to Vobiz via the WebSocket connection.
   */
  private sendAudioToVobiz(callId: string, audioBase64: string): void {
    const conn = this.connections.get(callId);
    if (!conn || conn.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    // Vobiz/Plivo bidirectional streaming protocol requires 'playAudio' event name
    const message = JSON.stringify({
      event: 'playAudio',
      streamId: conn.streamId ?? '',
      media: {
        contentType: 'audio/x-mulaw',
        sampleRate: 8000,
        payload: audioBase64,
      },
    });

    try {
      conn.ws.send(message);
    } catch (err) {
      logger.error('AudioStreamHandler: failed to send audio to Vobiz', {
        callId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Clears any active audio in Vobiz playback queue (for interruptions).
   */
  private clearAudio(callId: string): void {
    const conn = this.connections.get(callId);
    if (!conn || conn.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message = JSON.stringify({
      event: 'clearAudio',
    });

    try {
      conn.ws.send(message);
      logger.info('AudioStreamHandler: sent clearAudio to Vobiz', { callId });
    } catch (err) {
      logger.error('AudioStreamHandler: failed to send clearAudio to Vobiz', {
        callId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private handleClose(callId: string, code: number, reason: string): void {
    logger.info('AudioStreamHandler: connection closed', { callId, code, reason });

    this.connections.delete(callId);

    // Ensure runtime session is cleaned up
    const engine = VoiceRuntimeEngine.instance;
    engine.endSession(callId, 'ws_closed').catch((err) => {
      logger.error('AudioStreamHandler: cleanup on close failed', {
        callId,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  private handleError(callId: string, err: Error): void {
    logger.error('AudioStreamHandler: WebSocket error', {
      callId,
      error: err.message,
    });
  }
}
