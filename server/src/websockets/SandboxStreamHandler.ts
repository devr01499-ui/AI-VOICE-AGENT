import { IncomingMessage } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { logger } from '../utils/logger';
import { prisma } from '../config/database';
import { GeminiLiveProvider } from '../providers/gemini/GeminiLiveProvider';

interface ActiveSandboxSession {
  ws: WebSocket;
  agentId: string;
  providerSessionId?: string;
  createdAt: number;
}

export class SandboxStreamHandler {
  private readonly connections = new Map<string, ActiveSandboxSession>();
  private readonly provider = new GeminiLiveProvider();

  /**
   * Attaches upgrade connection logic.
   */
  initialize(wss: WebSocketServer): void {
    wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });
    logger.info('SandboxStreamHandler: WebSocket listener initialized');
  }

  private async handleConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${req.headers.host || 'localhost'}`);
    const agentId = url.searchParams.get('agentId');

    if (!agentId) {
      logger.warn('SandboxStreamHandler: Rejected connection — missing agentId');
      ws.close(1008, 'Missing agentId parameter');
      return;
    }

    const connectionId = `sandbox-${Date.now()}`;
    logger.info('SandboxStreamHandler: New browser sandbox client connecting', { connectionId, agentId });

    const session: ActiveSandboxSession = {
      ws,
      agentId,
      createdAt: Date.now(),
    };
    this.connections.set(connectionId, session);

    try {
      // 1. Fetch the exact agent rules
      const agent = await prisma.agent.findUnique({
        where: { id: agentId },
      });

      if (!agent) {
        throw new Error(`Agent with ID ${agentId} not found in workspace database`);
      }

      // 2. Setup Gemini Live configuration
      const config = {
        callId: connectionId,
        model: agent.model || 'models/gemini-2.5-flash-native-audio-latest',
        voice: agent.voiceName || 'Aoede',
        instructions: agent.systemPrompt || 'You are a helpful assistant.',
      };

      const callbacks = {
        onAudioDelta: (_sessId: string, audioBase64: string) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ event: 'audio', data: audioBase64 }));
          }
        },
        onTranscriptDelta: (_sessId: string, delta: string, isFinal: boolean, isUser?: boolean) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ event: 'transcript', text: delta, isFinal, isUser }));
          }
        },
        onSpeechStopped: (_sessId: string, interrupted?: boolean) => {
          if (interrupted && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ event: 'interrupted' }));
          }
        },
        onError: (_sessId: string, error: Error) => {
          logger.error('SandboxStreamHandler: Gemini runtime provider error', { connectionId, error: error.message });
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ event: 'error', message: error.message }));
          }
        }
      };

      // 3. Spawn the Gemini session
      logger.info('SandboxStreamHandler: Creating live provider session', { connectionId, agentId, voice: config.voice });
      const result = await this.provider.createSession(config, callbacks);
      session.providerSessionId = result.sessionId;

      logger.info('SandboxStreamHandler: Session handshake confirmed. Sending greeting.', { connectionId });
      
      // Trigger dynamic greeting turn
      const greetingText = 'Please greet me, confirm my name, and begin the screening interview.';
      this.provider.triggerGreeting(result.sessionId, greetingText);

    } catch (err: any) {
      logger.error('SandboxStreamHandler: Failed to initialize session', { connectionId, error: err.message });
      ws.send(JSON.stringify({ event: 'error', message: err.message }));
      ws.close(1011, 'Initialization failed');
      this.connections.delete(connectionId);
      return;
    }

    // 4. Handle client events
    ws.on('message', (message: WebSocket.RawData) => {
      try {
        const event = JSON.parse(message.toString());
        if (event.event === 'audio' && event.data) {
          if (session.providerSessionId) {
            this.provider.sendAudio(session.providerSessionId, event.data);
          }
        }
      } catch (err: any) {
        logger.error('SandboxStreamHandler: Failed to process incoming socket message', { connectionId, error: err.message });
      }
    });

    ws.on('close', async () => {
      logger.info('SandboxStreamHandler: Client connection closed', { connectionId });
      if (session.providerSessionId) {
        try {
          await this.provider.closeSession(session.providerSessionId);
        } catch (err: any) {
          logger.error('SandboxStreamHandler: Error closing provider session during cleanup', { connectionId, error: err.message });
        }
      }
      this.connections.delete(connectionId);
    });

    ws.on('error', (err: Error) => {
      logger.error('SandboxStreamHandler: Client connection error', { connectionId, error: err.message });
    });
  }
}
