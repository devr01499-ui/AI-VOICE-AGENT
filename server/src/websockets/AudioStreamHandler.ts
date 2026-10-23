/**
 * Claritiy Voice Server — WebSocket Audio Stream Handler
 * 
 * Refactored to utilize the decoupled Provider SDK & CallOrchestrator.
 */

import crypto from 'crypto';
import { IncomingMessage } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { getWebhookSigningSecret } from '../utils/security';
import { callOrchestrator } from '../core/orchestrator/CallOrchestrator';
import { providerManagerSDK } from '../core/provider-sdk/provider.manager';
import { eventBus, PROVIDER_EVENTS } from '../core/provider-sdk/provider.events';
import type { VobizStreamEvent } from '../types';
import { callTimingTracker } from '../utils/CallTimingTracker';
import { buildGreetingText, getGreetingTextForLanguage, resolveGreeting } from '../utils/greetingUtils';

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
  playoutTimeout?: NodeJS.Timeout;
  sessionReady: boolean;       // True once Gemini session setup is confirmed
  inboundAudioBuffer: string[]; // Buffer audio packets arriving before session is ready
  hasSentFirstAudio?: boolean;
  silenceTimer?: NodeJS.Timeout;
  greetingResolved?: boolean;
  isFallingBack?: boolean;
}

// ─── Pipeline Safety Limits ───────────────────────────
const MAX_INBOUND_BUFFER_CHUNKS = 50;  // Max ~1 second of buffered audio before session ready
const MAX_PLAYBACK_QUEUE_CHUNKS = 50;  // Max ~1.5 seconds of outbound playback buffer to prevent jitter lag & OOM


// ─── Provider Error Classifier ────────────────────────
export function classifyProviderError(errorStr: string): 'transient' | 'fatal' {
  const err = (errorStr || '').toLowerCase();
  if (
    err.includes('api key') ||
    err.includes('unauthenticated') ||
    err.includes('unauthorized') ||
    err.includes('out of calling minutes') ||
    err.includes('insufficient_balance') ||
    err.includes('balance_exhausted') ||
    err.includes('balance exhausted') ||
    err.includes('permission_denied') ||
    err.includes('user_not_found') ||
    err.includes('model not found') ||
    err.includes('setup_validation_failed') ||
    err.includes('invalid argument')
  ) {
    return 'fatal';
  }
  return 'transient';
}

// ─── Handler Implementation ──────────────────────────

export class AudioStreamHandler {
  private readonly connections = new Map<string, ActiveConnection>();
  private readonly reconnectAttempts = new Map<string, number>();

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

  private setupAuthorizedConnection(ws: WebSocket, callId: string): ActiveConnection {
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
      sessionReady: false,
      inboundAudioBuffer: [],
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

    logger.info('AudioStreamHandler: connection registered and active', { callId });
    return conn;
  }

  private async validateAndSetupAuthorizedConnection(ws: WebSocket, callId: string): Promise<ActiveConnection | null> {
    if (this.connections.has(callId)) {
      logger.warn('AudioStreamHandler: stream connection rejected — stream already active for call', { callId });
      try {
        ws.close(1008, 'Stream already active for this call');
      } catch {}
      return null;
    }

    try {
      const { prisma } = await import('../lib/prisma');
      const call = await prisma.call.findUnique({
        where: { id: callId },
        select: { id: true, status: true, endTime: true },
      });

      if (!call) {
        logger.warn('AudioStreamHandler: stream connection rejected — call session not found', { callId });
        try {
          ws.close(1008, 'Call session not found');
        } catch {}
        return null;
      }

      const terminalStatuses = ['completed', 'failed', 'canceled', 'busy', 'no_answer'];
      if (call.endTime !== null || terminalStatuses.includes(call.status)) {
        logger.warn('AudioStreamHandler: stream connection rejected — call already ended', { callId, status: call.status });
        try {
          ws.close(1008, 'Call already ended');
        } catch {}
        return null;
      }
    } catch (dbErr) {
      logger.error('AudioStreamHandler: DB session validation error', { callId, error: dbErr });
      try {
        ws.close(1011, 'Internal session error');
      } catch {}
      return null;
    }

    return this.setupAuthorizedConnection(ws, callId);
  }

  private async handleConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
    // Parse callId, token, and timestamp from the URL query string
    // Clean XML entity escapes (&amp;) if present
    const rawUrl = (req.url ?? '/').replace(/&amp;/g, '&');
    const url = new URL(rawUrl, `http://${req.headers.host || 'localhost'}`);
    let callId = url.searchParams.get('callId');
    const token = url.searchParams.get('token') || url.searchParams.get('amp;token');
    const tsStr = url.searchParams.get('ts') || url.searchParams.get('amp;ts');

    // Case 1: callId provided directly in URL query parameters
    if (callId) {
      let isAuthorized = false;
      if (token && tsStr) {
        const secret = getWebhookSigningSecret();
        const expectedToken = crypto.createHmac('sha256', secret).update(`${callId}:${tsStr}`).digest('hex');
        const timestamp = parseInt(tsStr, 10);
        if (
          token.length === expectedToken.length &&
          crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken)) &&
          timestamp > 0 &&
          Math.abs(Date.now() - timestamp) < 15 * 60 * 1000
        ) {
          isAuthorized = true;
        }
      }

      if (!isAuthorized) {
        const rejectionReason = (!token || !tsStr)
          ? 'Missing token or ts in query params'
          : 'Invalid or expired stream token HMAC signature';
        logger.warn('AudioStreamHandler: unauthorized stream connection attempt via URL parameters', { callId, rejectionReason });
        import('../repositories/CallRepository').then(({ CallRepository }) => {
          CallRepository.updateStatus(callId, 'failed', {
            endReason: 'handshake_failed',
            endDetail: rejectionReason,
            endedBy: 'system',
          }).catch(() => {});
        }).catch(() => {});
        try {
          ws.close(1008, `Unauthorized: ${rejectionReason}`);
        } catch {}
        return;
      }

      logger.info('AudioStreamHandler: connection authorized via URL parameters', { callId });
      await this.validateAndSetupAuthorizedConnection(ws, callId);
      return;
    }

    // Case 2: Telephony carrier (such as Plivo) connected without query parameters.
    // Await initial 'start' event carrying extra_headers with verified token.
    logger.info('AudioStreamHandler: stream connection received without URL query parameters. Awaiting initial start event payload.');

    let isHandshakeComplete = false;
    const handshakeTimeout = setTimeout(() => {
      if (!isHandshakeComplete) {
        logger.warn('AudioStreamHandler: handshake timeout waiting for stream start payload');
        try {
          ws.close(1008, 'Handshake timeout');
        } catch {}
      }
    }, 15000);

    ws.once('close', () => clearTimeout(handshakeTimeout));

    const onInitialMessage = async (data: WebSocket.RawData) => {
      ws.off('message', onInitialMessage);
      clearTimeout(handshakeTimeout);

      try {
        const message = JSON.parse(data.toString());
        logger.info('AudioStreamHandler: received initial handshake message', { event: message.event });

        // Extract and cryptographically verify token from extra_headers (supports root/nested start, string or object format)
        const rawHeaders = message.extra_headers || (message as any).extraHeaders || message.start?.extra_headers || message.start?.extraHeaders || message.start?.custom_parameters || '';
        let verifiedCallId: string | null = null;

        let parsedCallId: string | null = null;
        let parsedToken: string | null = null;
        let parsedTs: number | null = null;

        if (typeof rawHeaders === 'object' && rawHeaders !== null) {
          parsedCallId = rawHeaders.callId || rawHeaders.call_id || null;
          parsedToken = rawHeaders.token || null;
          parsedTs = rawHeaders.ts ? parseInt(String(rawHeaders.ts), 10) : null;
        } else if (typeof rawHeaders === 'string' && rawHeaders.trim() !== '') {
          // Supports both comma and semicolon delimiters (Plivo comma format vs semicolon format)
          const pairs = rawHeaders.split(/[;,]/);
          for (const pair of pairs) {
            const [k, v] = pair.split('=');
            if (k && v) {
              const key = k.trim();
              const val = decodeURIComponent(v.trim());
              if (key === 'callId' || key === 'call_id') parsedCallId = val;
              if (key === 'token') parsedToken = val;
              if (key === 'ts') parsedTs = parseInt(val, 10);
            }
          }
        }

        if (parsedCallId && parsedToken && parsedTs) {
          const secret = getWebhookSigningSecret();
          const expectedToken = crypto.createHmac('sha256', secret).update(`${parsedCallId}:${parsedTs}`).digest('hex');

          if (
            parsedToken.length === expectedToken.length &&
            crypto.timingSafeEqual(Buffer.from(parsedToken), Buffer.from(expectedToken)) &&
            parsedTs > 0 &&
            Math.abs(Date.now() - parsedTs) < 15 * 60 * 1000
          ) {
            verifiedCallId = parsedCallId;
          }
        }

        if (!verifiedCallId) {
          const startCallId = message.start?.callId || message.callId;
          const rejectionReason = 'Missing or invalid cryptographic token in stream extra_headers';
          logger.warn('AudioStreamHandler: unauthorized stream start payload', {
            hasRawHeaders: Boolean(rawHeaders),
            rawType: typeof rawHeaders,
            startCallId,
            rejectionReason,
          });
          if (startCallId) {
            import('../repositories/CallRepository').then(({ CallRepository }) => {
              CallRepository.updateStatus(startCallId, 'failed', {
                endReason: 'handshake_failed',
                endDetail: rejectionReason,
                endedBy: 'system',
              }).catch(() => {});
            }).catch(() => {});
          }
          try {
            ws.close(1008, `Unauthorized: ${rejectionReason}`);
          } catch {}
          return;
        }

        // Confirm call exists and matches verifiedCallId
        const { prisma } = await import('../lib/prisma');
        const matchedCall = await prisma.call.findUnique({
          where: { id: verifiedCallId },
          select: { id: true, telemetryId: true, status: true, endTime: true },
        });

        if (!matchedCall) {
          logger.warn('AudioStreamHandler: call record not found for verified token', { callId: verifiedCallId });
          try {
            ws.close(1008, 'Unknown call session');
          } catch {}
          return;
        }

        // If payload explicitly carries a start.callId, it must match the verified call
        const startCallId = message.start?.callId || message.callId;
        if (startCallId && startCallId !== matchedCall.id && startCallId !== matchedCall.telemetryId) {
          logger.warn('AudioStreamHandler: start payload identifier mismatch with verified call session', {
            startCallId,
            verifiedCallId,
          });
          try {
            ws.close(1008, 'Session identifier mismatch');
          } catch {}
          return;
        }

        isHandshakeComplete = true;
        const finalCallId = matchedCall.id;
        logger.info('AudioStreamHandler: successfully resolved and verified stream to call session', {
          callId: finalCallId,
          status: matchedCall.status,
        });

        const conn = await this.validateAndSetupAuthorizedConnection(ws, finalCallId);
        if (!conn) {
          return;
        }

        // Process the initial start event message now that the connection is registered
        if (message.event === 'start') {
          this.handleStreamStart(finalCallId, message);
        } else {
          this.handleMessage(finalCallId, data);
        }
      } catch (err) {
        logger.error('AudioStreamHandler: failed to process initial stream message', { error: err });
        try {
          ws.close(1008, 'Invalid start payload');
        } catch {}
      }
    };

    ws.on('message', onInitialMessage);
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

    callTimingTracker.mark(callId, 'ws_stream_started');

    const conn = this.connections.get(callId);
    const rawEvent = event as any;
    const streamId = rawEvent.streamId || rawEvent.start?.streamId || null;
    if (conn) {
      if (conn.sessionId) {
        logger.info('AudioStreamHandler: stream start event received, but session is already active. Ignoring duplication.', { callId, sessionId: conn.sessionId });
        return;
      }
      conn.streamId = streamId;
    }

    logger.info('AudioStreamHandler: stream started', {
      callId,
      streamId,
    });

    const orchestrator = callOrchestrator;

    import('../repositories/CallRepository').then(({ CallRepository }) => {
      CallRepository.findById(callId)
        .then(async (call) => {
          const prismaInstance = (await import('../lib/prisma')).prisma;
          const agent = await prismaInstance.agent.findUnique({
            where: { id: call.agentId },
            select: { name: true, languageMode: true, firstMessage: true, agentConfig: true, direction: true }
          });
          const sessionId = await orchestrator.attachPrewarmedVoiceSession(
            callId,
            call.agentId,
            call.recipientPhoneNumber,
            (audioBase64: string) => {
              this.sendAudioToVobiz(callId, audioBase64);
            }
          );
          return { sessionId, agent, call };
        })
        .then(({ sessionId, agent, call }) => {
          logger.info('AudioStreamHandler: CallOrchestrator session started', { callId, sessionId });

          const currentConn = this.connections.get(callId);
          if (currentConn) {
            currentConn.sessionId = sessionId;
            // Mark session as ready and discard early handshake/ringing buffer (just silence/noise)
            currentConn.sessionReady = true;
            currentConn.inboundAudioBuffer = [];
            logger.info('AudioStreamHandler: session marked ready. Discarded early handshake buffer to prevent VAD flooding.', { callId });
          }

          logger.info('AudioStreamHandler: audio response callback registered via startVoiceSession', { callId, sessionId });

          // Register speech-started interruption clearance
          eventBus.subscribe(PROVIDER_EVENTS.AI_STARTED_SPEAKING, (payload) => {
            if (payload.callId === callId) {
              this.clearAudio(callId);
            }
          });

          // Register AI-stopped / interrupted speech (definitive barge-in trigger confirmed by Gemini or error fallback)
          eventBus.subscribe(PROVIDER_EVENTS.AI_STOPPED_SPEAKING, (payload) => {
            if (payload.callId === callId && (payload as any).interrupted) {
              logger.info('AudioStreamHandler: Gemini confirmed speech interruption (barge-in), clearing outbound audio queue', { callId });
              this.clearAudio(callId);
            }
            if (payload.callId === callId && (payload as any).error) {
              this.handleProviderRuntimeError(callId, (payload as any).error);
            }
          });

          // Register explicit engine error event for instant fallback on transport disconnect
          eventBus.subscribe(PROVIDER_EVENTS.ERROR_OCCURRED, (payload) => {
            if (payload.callId === callId) {
              this.handleProviderRuntimeError(callId, (payload as any).reason || 'Provider error');
            }
          });

          // Trigger greeting or start silence timer based on unified greeting resolution
          try {
            const direction = (call as any)?.callDirection || (call as any)?.direction;
            const isRecording = Boolean((call as any)?.isRecordingEnabled || (call as any)?.record);
            const resolved = resolveGreeting(agent, direction, isRecording);

            logger.info('AudioStreamHandler: greeting resolved', {
              callId,
              sessionId,
              mode: resolved.mode,
              silenceStart: resolved.silenceStart,
              greetingLength: resolved.text.length,
            });

            const activeConn = this.connections.get(callId);
            if (resolved.mode === 'agent_first') {
              if (activeConn) {
                activeConn.greetingResolved = true;
              }
              callOrchestrator.triggerGreeting(callId, sessionId, resolved.text);
              logger.info('AudioStreamHandler: agent_first greeting triggered immediately', { callId, sessionId });
            } else {
              // Mode is user_first: caller speaks first upon connection
              callOrchestrator.enableInboundAudio(callId);
              logger.info('AudioStreamHandler: user_first mode active; listening for caller speech', { callId });

              if (resolved.silenceStart?.enabled) {
                const silenceSec = resolved.silenceStart.seconds || 4;
                logger.info(`AudioStreamHandler: silence timer started (${silenceSec}s)`, { callId, seconds: silenceSec });
                const timer = setTimeout(() => {
                  const currentActiveConn = this.connections.get(callId);
                  if (currentActiveConn && !currentActiveConn.greetingResolved) {
                    currentActiveConn.greetingResolved = true;
                    logger.info(`[SILENCE_START] User remained silent for ${silenceSec}s; AI initiated greeting`, {
                      callId,
                      sessionId,
                      silenceSec,
                    });
                    callOrchestrator.triggerGreeting(callId, sessionId, resolved.text);
                  }
                }, silenceSec * 1000);

                if (activeConn) {
                  activeConn.silenceTimer = timer;
                }
              }
            }
          } catch (err) {
            logger.error('AudioStreamHandler: failed to process greeting configuration', {
              callId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        })
        .catch((err) => {
          logger.error('AudioStreamHandler: failed to start orchestrator session', {
            callId,
            error: err instanceof Error ? err.message : String(err),
          });

          if (conn?.silenceTimer) {
            clearTimeout(conn.silenceTimer);
            conn.silenceTimer = undefined;
          }

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

          // ✅ Terminate carrier call to prevent stranded PSTN leg
          import('../services/CallService').then(({ CallService }) => {
            CallService.terminateCall(callId).catch((termErr) => {
              logger.warn('AudioStreamHandler: failed to terminate carrier call on session startup error', { callId, error: String(termErr) });
            });
          }).catch(() => {});
        });
    }).catch((err) => {
      logger.error('AudioStreamHandler: failed to import CallRepository', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  /**
   * Vobiz audio media received — forward to CallOrchestrator.
   * Buffers audio packets if the Gemini session is not yet ready.
   */
  private handleMediaEvent(callId: string, event: VobizStreamEvent): void {
    if (event.event !== 'media') return;
    const conn = this.connections.get(callId);
    if (!conn) return;

    try {
      const audioPayload = event.media.payload; // Base64 L16 PCM at 16kHz

      // Track stats
      conn.audioStats.packetsReceived++;
      conn.audioStats.bytesReceived += audioPayload.length;

      // If user sends audio before silence timer fires, cancel timer and let conversation flow
      if (conn.silenceTimer) {
        clearTimeout(conn.silenceTimer);
        conn.silenceTimer = undefined;
        conn.greetingResolved = true;
        logger.info('[SILENCE_START] Caller activity detected before timeout, silence timer cancelled', { callId });
      }

      // If session not ready yet, buffer the audio with boundary cap against OOM/jitter
      if (!conn.sessionReady) {
        if (conn.inboundAudioBuffer.length >= MAX_INBOUND_BUFFER_CHUNKS) {
          conn.inboundAudioBuffer.shift(); // Drop oldest to avoid lag and memory bloat
        }
        conn.inboundAudioBuffer.push(audioPayload);
        return;
      }

      // Echo suppression: while AI is speaking, if inbound audio RMS is below threshold (< 90),
      // it is speakerphone/telephony echo of the AI voice leaking back. Suppress it to prevent double-voice feedback.
      if (conn.isPlayoutActive) {
        const rawInbound = Buffer.from(audioPayload, 'base64');
        if (rawInbound.length >= 320) {
          const samples16 = new Int16Array(rawInbound.buffer, rawInbound.byteOffset, Math.floor(rawInbound.length / 2));
          let sum = 0;
          for (let i = 0; i < samples16.length; i++) sum += samples16[i] * samples16[i];
          const rms = Math.sqrt(sum / samples16.length);
          if (rms < 90) {
            // Low energy echo while AI is speaking - drop to avoid dual voice feedback
            return;
          }
        }
      }

      callOrchestrator.processAudioStream(callId, audioPayload);

      if (conn.sessionId) {
        logger.debug('AudioStreamHandler: audio sent to Gemini', {
          callId,
          sessionId: conn.sessionId,
          bytes: audioPayload.length,
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
    if (conn?.silenceTimer) {
      clearTimeout(conn.silenceTimer);
      conn.silenceTimer = undefined;
    }

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
   * Streams audio chunks directly to telephony without artificial queue delay.
   */
  private sendAudioToVobiz(callId: string, audioBase64: string): void {
    const conn = this.connections.get(callId);
    if (!conn) return;

    // Send audio packet immediately to telephony WebSocket without buffering delay
    this.sendAudioToVobizDirect(callId, audioBase64);

    // Track playout state for echo cancellation
    conn.isPlayoutActive = true;
    const pcmBytes = Math.floor((audioBase64.length * 3) / 4);
    const durationMs = Math.max(20, Math.round(pcmBytes / 32));

    if (conn.playoutTimeout) {
      clearTimeout(conn.playoutTimeout);
    }
    conn.playoutTimeout = setTimeout(() => {
      const current = this.connections.get(callId);
      if (current) {
        current.isPlayoutActive = false;
      }
    }, durationMs + 100);
  }

  /**
   * Playout pump to send audio sequentially to Vobiz (legacy fallback).
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

    const pcmBytes = Math.floor((nextChunkBase64.length * 3) / 4);
    const durationMs = Math.max(10, Math.min(200, Math.round(pcmBytes / 32)));

    if (conn.playoutTimeout) {
      clearTimeout(conn.playoutTimeout);
    }
    conn.playoutTimeout = setTimeout(() => this.flushNextAudioChunk(callId), durationMs || 30);
  }

  /**
   * Sends audio data immediately to Vobiz via the WebSocket connection.
   *
   * CRITICAL FIX: Vobiz bidirectional stream expects a JSON `playAudio` event
   * with base64-encoded L16 PCM payload — NOT raw binary WebSocket frames.
   * The stream was configured with contentType="audio/x-l16;rate=16000" so
   * we must send the same format back.
   */
  private sendAudioToVobizDirect(callId: string, audioBase64: string): void {
    const conn = this.connections.get(callId);
    if (!conn || conn.ws.readyState !== WebSocket.OPEN) {
      logger.warn('AudioStreamHandler: cannot send audio - no connection', { callId });
      return;
    }

    if (!conn.hasSentFirstAudio) {
      conn.hasSentFirstAudio = true;
      callTimingTracker.mark(callId, 'first_audio_sent_to_telephony');
    }
    callTimingTracker.markTurnFirstAudioSentToTelephony(callId);

    // Send as JSON playAudio event with base64 L16 payload
    // Vobiz and Plivo bidirectional stream protocols require this JSON envelope
    const playAudioEvent = JSON.stringify({
      event: 'playAudio',
      ...(conn.streamId ? { streamId: conn.streamId } : {}),
      media: {
        contentType: 'audio/x-l16',
        sampleRate: 16000,
        payload: audioBase64,
      },
    });

    logger.debug('AudioStreamHandler: sending audio to telephony provider', {
      callId,
      bytes: audioBase64.length,
      hasStreamId: Boolean(conn.streamId),
    });

    try {
      conn.ws.send(playAudioEvent);
    } catch (err) {
      logger.error('AudioStreamHandler: failed to send audio to telephony provider', {
        callId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Clears any active audio in telephony playback queue (for interruptions).
   */
  private clearAudio(callId: string): void {
    const conn = this.connections.get(callId);
    if (!conn || conn.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    // Clear buffer queue immediately to drop any pending outbound frames on user barge-in!
    conn.playbackQueue = [];
    conn.isPlayoutActive = false;
    if (conn.playoutTimeout) {
      clearTimeout(conn.playoutTimeout);
      conn.playoutTimeout = undefined;
    }

    const message = JSON.stringify({
      event: 'clearAudio',
      ...(conn.streamId ? { streamId: conn.streamId } : {}),
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

  /**
   * Synthesizes and plays a brief soft fallback tone over outbound audio before gracefully closing the call on mid-call runtime error.
   */
  private async handleProviderRuntimeError(callId: string, errorReason: string): Promise<void> {
    const classification = classifyProviderError(errorReason);
    const retries = this.reconnectAttempts.get(callId) || 0;
    const MAX_RETRIES = 2;

    logger.warn('[PROVIDER_ERROR_CLASSIFICATION]', {
      callId,
      classification,
      errorReason,
      retryCount: retries,
      maxRetries: MAX_RETRIES,
    });

    if (classification === 'transient' && retries < MAX_RETRIES) {
      this.reconnectAttempts.set(callId, retries + 1);
      logger.info('AudioStreamHandler: attempting mid-call session recovery for transient error', { callId, attempt: retries + 1 });
      try {
        await callOrchestrator.reconnectVoiceSession(callId);
        logger.info('AudioStreamHandler: transient error reconnected successfully, telephony call kept alive', { callId });
        return;
      } catch (recErr) {
        logger.error('AudioStreamHandler: mid-call session recovery failed', { callId, error: String(recErr) });
      }
    }

    // Fatal or exhausted retries: play spoken apology chime and end cleanly
    const endReason = errorReason.toLowerCase().includes('balance') ? 'balance_exhausted' : 'provider_error';
    this.playFallbackAndEndCall(callId, endReason, errorReason);
  }

  /**
   * Synthesizes and plays a soft apology audio chime over outbound audio before gracefully closing the call on unrecoverable error.
   */
  private playFallbackAndEndCall(callId: string, endReason: string = 'provider_error', detail?: string): void {
    const conn = this.connections.get(callId);
    if (!conn) {
      callOrchestrator.endCallSession(callId, endReason, detail, 'system').catch(() => {});
      import('../services/CallService').then(({ CallService }) => {
        CallService.terminateCall(callId, endReason, detail, 'system').catch(() => {});
      }).catch(() => {});
      return;
    }

    if (conn.isFallingBack) return;
    conn.isFallingBack = true;

    this.clearAudio(callId);

    if (conn.ws.readyState !== WebSocket.OPEN) {
      callOrchestrator.endCallSession(callId, endReason, detail, 'system').catch(() => {});
      import('../services/CallService').then(({ CallService }) => {
        CallService.terminateCall(callId, endReason, detail, 'system').catch(() => {});
      }).catch(() => {});
      return;
    }

    // Synthesize a gentle 1.5-second two-tone apology chime (440Hz -> 330Hz) at 16kHz PCM16 mono
    const sampleRate = 16000;
    const durationSec = 1.5;
    const numSamples = Math.floor(sampleRate * durationSec);
    const pcmBuffer = Buffer.alloc(numSamples * 2);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const freq = t < 0.7 ? 440 : 330;
      const decay = Math.exp(-2.5 * t);
      const sampleValue = Math.floor(Math.sin(2 * Math.PI * freq * t) * 7000 * decay);
      pcmBuffer.writeInt16LE(sampleValue, i * 2);
    }

    const fallbackBase64 = pcmBuffer.toString('base64');
    this.sendAudioToVobiz(callId, fallbackBase64);

    // After playout finishes (~1.8s), close connection cleanly, end call session, and terminate carrier leg
    setTimeout(() => {
      const activeConn = this.connections.get(callId);
      if (activeConn && activeConn.ws.readyState === WebSocket.OPEN) {
        logger.info('AudioStreamHandler: error fallback playout completed, closing websocket', { callId, endReason });
        activeConn.ws.close(1000, 'Call completed with fallback');
      }
      callOrchestrator.endCallSession(callId, endReason, detail, 'system').catch((err) => {
        logger.error('AudioStreamHandler: failed to end session after fallback', { callId, error: err });
      });
      import('../services/CallService').then(({ CallService }) => {
        CallService.terminateCall(callId, endReason, detail, 'system').catch((termErr) => {
          logger.warn('AudioStreamHandler: failed to terminate carrier call after fallback playout', { callId, error: String(termErr) });
        });
      }).catch(() => {});
    }, 1800);
  }

  private handleClose(callId: string, code: number, reason: string): void {
    const conn = this.connections.get(callId);
    if (conn?.playoutTimeout) {
      clearTimeout(conn.playoutTimeout);
      conn.playoutTimeout = undefined;
    }
    if (conn?.silenceTimer) {
      clearTimeout(conn.silenceTimer);
      conn.silenceTimer = undefined;
    }

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
    const conn = this.connections.get(callId);
    if (conn && conn.ws.readyState === WebSocket.OPEN) {
      try {
        conn.ws.send(JSON.stringify({ event: 'clearAudio' }));
        conn.ws.close(1011, 'Voice pipeline network error');
      } catch {}
    }
  }
}
