/**
 * Bolna Server — WebSocket Audio Stream Handler
 * 
 * Refactored to utilize the decoupled Provider SDK & CallOrchestrator.
 */

import { IncomingMessage } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { logger } from '../utils/logger';
import { callOrchestrator } from '../core/orchestrator/CallOrchestrator';
import { providerManagerSDK } from '../core/provider-sdk/provider.manager';
import { eventBus, PROVIDER_EVENTS } from '../core/provider-sdk/provider.events';
import { mulawToPCM16, getAudioConversionStats } from '../utils/audioConverter';
import type { VobizStreamEvent } from '../types';

// ─── Active Connection Tracking ───────────────────────

interface ActiveConnection {
  ws: WebSocket;
  callId: string;
  streamId: string | null;
  createdAt: number;
  audioStats: {
    packetsReceived: number;
    bytesReceived: number;
    bytesConverted: number;
    conversionErrors: number;
  };
  sessionId?: string;
  playbackQueue: string[]; // Sequential array buffer for outbound payloads
  isPlayoutActive: boolean;
}

// ─── Handler Implementation ──────────────────────────

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
      audioStats: {
        packetsReceived: 0,
        bytesReceived: 0,
        bytesConverted: 0,
        conversionErrors: 0,
      },
      playbackQueue: [],
      isPlayoutActive: false,
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
   * Vobiz stream started — initialize the CallOrchestrator session.
   */
  private handleStreamStart(callId: string, event: VobizStreamEvent): void {
    if (event.event !== 'start') return;

    const conn = this.connections.get(callId);
    const rawEvent = event as any;
    const streamId = rawEvent.streamId || rawEvent.start?.streamId || null;
    if (conn) {
      conn.streamId = streamId;
    }

    logger.info('AudioStreamHandler: stream started', {
      callId,
      streamId,
    });

    const orchestrator = callOrchestrator;

    import('../repositories/CallRepository').then(({ CallRepository }) => {
      CallRepository.findById(callId)
        .then((call) => {
          return orchestrator.startVoiceSession(
            callId,
            call.agentId,
            call.recipientPhoneNumber,
            (audioBase64: string) => {
              this.sendAudioToVobiz(callId, audioBase64);
            }
          );
        })
        .then((sessionId) => {
          logger.info('AudioStreamHandler: CallOrchestrator session started', { callId, sessionId });

          const currentConn = this.connections.get(callId);
          if (currentConn) {
            currentConn.sessionId = sessionId;
          }

          logger.info('AudioStreamHandler: audio response callback registered via startVoiceSession', { callId, sessionId });

          // Register speech-started interruption clearance
          eventBus.subscribe(PROVIDER_EVENTS.AI_STARTED_SPEAKING, (payload) => {
            if (payload.callId === callId) {
              this.clearAudio(callId);
            }
          });

          // Register user-started speech (tentative trigger) - clear Vobiz audio queue immediately
          // eventBus.subscribe(PROVIDER_EVENTS.USER_STARTED_SPEAKING, (payload) => {
          //   if (payload.callId === callId) {
          //     logger.info('AudioStreamHandler: Local VAD tentative speech detected, clearing Vobiz queue', { callId });
          //     this.clearAudio(callId);
          //   }
          // });

          // Register AI-stopped / interrupted speech (definitive barge-in trigger confirmed by Gemini)
          eventBus.subscribe(PROVIDER_EVENTS.AI_STOPPED_SPEAKING, (payload) => {
            if (payload.callId === callId && (payload as any).interrupted) {
              logger.info('AudioStreamHandler: Gemini confirmed speech interruption (barge-in), clearing outbound audio queue', { callId });
              this.clearAudio(callId);
            }
          });

          // Trigger initial greeting turn text after 1 second
          setTimeout(() => {
            try {
              logger.info('AudioStreamHandler: triggering greeting', { callId, sessionId });

              if (!sessionId) {
                logger.error('AudioStreamHandler: no sessionId for greeting', { callId });
                return;
              }

              const greetingText = 'Hi, please start the interview.';
              callOrchestrator.triggerGreeting(callId, sessionId, greetingText);
              logger.info('AudioStreamHandler: greeting triggered', { callId, sessionId });
            } catch (err) {
              logger.error('AudioStreamHandler: failed to trigger greeting', {
                callId,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          }, 1000);
        })
        .catch((err) => {
          logger.error('AudioStreamHandler: failed to start orchestrator session', {
            callId,
            error: err instanceof Error ? err.message : String(err),
          });

          // ✅ Immediately close WebSocket
          if (conn && conn.ws.readyState === WebSocket.OPEN) {
            conn.ws.close(1011, 'Session initialization failed');
          }

          // ✅ Update DB asynchronously
          CallRepository.updateStatus(callId, 'failed')
            .then(() => {
              return CallRepository.updateExecution(callId, {
                outcome: 'unsuccessful',
                metadata: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
              });
            })
            .catch((dbErr) => {
              logger.error('AudioStreamHandler: cleanup on error failed', { callId, error: dbErr });
            });

          // ✅ Clean up connection reference
          this.connections.delete(callId);
        });
    }).catch((err) => {
      logger.error('AudioStreamHandler: failed to import CallRepository', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  /**
   * Vobiz audio media received — convert codec and forward to CallOrchestrator.
   */
  private handleMediaEvent(callId: string, event: VobizStreamEvent): void {
    if (event.event !== 'media') return;
    const conn = this.connections.get(callId);
    if (!conn) return;

    try {
      const mulawAudio = event.media.payload; // Base64 raw G.711 stream
      
      // Track and log raw inbound packet payload for diagnostic audit
      conn.audioStats.packetsReceived++;
      conn.audioStats.bytesReceived += mulawAudio.length;

      logger.info('AudioStreamHandler [MEDIA HOOK DIAGNOSTIC]: Received raw inbound media payload from Vobiz', {
        callId,
        packetIndex: conn.audioStats.packetsReceived,
        payloadLength: mulawAudio.length,
        cumulativeBytes: conn.audioStats.bytesReceived
      });
      
      callOrchestrator.processAudioStream(callId, mulawAudio);
      
      if (conn.sessionId) {
        logger.info('AudioStreamHandler: audio sent to Gemini', {
          callId,
          sessionId: conn.sessionId,
          bytes: mulawAudio.length,
        });
      }
    } catch (err) {
      logger.error('AudioStreamHandler: media pipe execution failed', { callId, error: err });
    }
  }

  /**
   * Vobiz stream stopped — clean up.
   */
  private handleStreamStop(callId: string, _event: VobizStreamEvent): void {
    const conn = this.connections.get(callId);
    logger.info('AudioStreamHandler: stream stopped', {
      callId,
      stats: conn?.audioStats,
    });

    callOrchestrator.endCallSession(callId, 'stream_stopped').catch((err) => {
      logger.error('AudioStreamHandler: failed to end session', {
        callId,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  /**
   * Pushes audio chunk to playout queue and starts sequential playout if inactive.
   */
  private sendAudioToVobiz(callId: string, audioBase64: string): void {
    const conn = this.connections.get(callId);
    if (!conn) return;

    conn.playbackQueue.push(audioBase64);

    if (!conn.isPlayoutActive) {
      this.flushNextAudioChunk(callId);
    }
  }

  /**
   * Playout pump to send audio sequentially to Vobiz.
   */
  private flushNextAudioChunk(callId: string): void {
    const conn = this.connections.get(callId);
    if (!conn || conn.playbackQueue.length === 0) {
      if (conn) conn.isPlayoutActive = false;
      return;
    }

    conn.isPlayoutActive = true;
    const nextChunkBase64 = conn.playbackQueue.shift()!;
    this.sendAudioToVobizDirect(callId, nextChunkBase64);

    setTimeout(() => this.flushNextAudioChunk(callId), 30);
  }

  /**
   * Sends audio data immediately to Vobiz via the WebSocket connection.
   */
  private sendAudioToVobizDirect(callId: string, audioBase64: string): void {
    const conn = this.connections.get(callId);
    if (!conn || conn.ws.readyState !== WebSocket.OPEN) {
      logger.warn('AudioStreamHandler: cannot send audio - no connection', { callId });
      return;
    }

    logger.debug('AudioStreamHandler: sending audio to Vobiz', {
      callId,
      bytes: audioBase64?.length || 0,
    });

    const audioBuffer = Buffer.from(audioBase64, 'base64');
    logger.info('AudioStreamHandler: sending audio to Vobiz', {
      callId,
      bytes: audioBuffer.length,
    });

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

    // Clear buffer queue immediately to drop any pending outbound frames on user barge-in!
    conn.playbackQueue = [];
    conn.isPlayoutActive = false;

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
    const conn = this.connections.get(callId);
    logger.info('AudioStreamHandler: connection closed', {
      callId,
      code,
      reason,
      stats: conn?.audioStats,
    });



    this.connections.delete(callId);

    callOrchestrator.endCallSession(callId, 'ws_closed').catch((err) => {
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
