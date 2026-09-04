import { IncomingMessage } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';
import { GeminiLiveProvider } from '../providers/gemini/GeminiLiveProvider';
import { McpService, DiscoveredMcpTool } from '../services/McpService';
import { verifySupabaseToken } from '../utils/auth';
import { ADMIN_EMAIL } from '../config/constants';
import { CalendarService } from '../core/orchestrator/CalendarService';
import { extractToolsFromFlowGraph } from '../core/orchestrator/CallOrchestrator';

function getGreetingTextForLanguage(languageMode: string | null | undefined): string {
  const map: Record<string, string> = {
    en: 'Please greet me, confirm my name, and begin the screening interview.',
    hi: 'कृपया मेरा अभिवादन करें, मेरे नाम की पुष्टि करें और साक्षात्कार शुरू करें।',
    bn: 'অনুগ্রহ করে আমাকে অভিবাদন জানান, আমার নাম নিশ্চিত করুন এবং ইন্টারভিউ শুরু করুন।',
    kn: 'ದಯವಿಟ್ಟು ನನ್ನನ್ನು ಅಭಿನಂದಿಸಿ, ನನ್ನ ಹೆಸರನ್ನು ಖಚಿತಪಡಿಸಿ ಮತ್ತು ಸಂದರ್ಶನವನ್ನು ಪ್ರಾರಂಭಿಸಿ।',
    ml: 'ദയവായി എന്നെ അഭിവാദ്യം ചെയ്യുക, എന്റെ പേര് സ്ഥിരീകരിക്കുക, കൂടാതെ അഭിമുഖം ആരംഭിക്കുക।',
    gu: 'કૃપા કરીને મારું અભિવાદન કરો, મારા નામની પુષ્ટિ કરો અને ઇન્ટરવ્યુ શરૂ કરો।',
    zh: '请向我打招呼，确认我的姓名，并开始面试。',
    ar: 'يرجى الترحيب بي، وتأكيد اسمي، وبدء المقابلة.',
  };
  return (languageMode && map[languageMode]) || map.en;
}

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
    const token = url.searchParams.get('token');

    if (!agentId) {
      logger.warn('SandboxStreamHandler: Rejected connection — missing agentId');
      ws.close(1008, 'Missing agentId parameter');
      return;
    }

    if (!token) {
      logger.warn('SandboxStreamHandler: Rejected connection — missing token parameter');
      ws.close(1008, 'Missing token parameter');
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
      // 1. Verify Supabase JWT token
      const verified = await verifySupabaseToken(token);
      if (!verified) {
        throw new Error('Invalid or expired authentication token');
      }

      const userId = verified.sub;

      // 2. Fetch the exact agent rules
      const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        include: { kbLinks: true },
      });

      if (!agent) {
        throw new Error(`Agent with ID ${agentId} not found in workspace database`);
      }

      if (agent.userId !== userId) {
        throw new Error('Access denied: Agent is not associated with this workspace session context');
      }

      // Extract tools from agentConfig.functions & agentConfig.mcpServers
      let tools: any[] = [];
      let mcpToolMap = new Map<string, DiscoveredMcpTool>();

      if (agent.agentConfig) {
        try {
          const parsedCfg = typeof agent.agentConfig === 'string' ? JSON.parse(agent.agentConfig) : agent.agentConfig;
          if (Array.isArray(parsedCfg?.functions)) {
            tools = parsedCfg.functions.map((fn: any) => {
              let parameters = fn.parameters;
              if (!parameters || typeof parameters !== 'object' || Object.keys(parameters).length === 0) {
                if (fn.type === 'transfer_call') {
                  parameters = {
                    type: 'OBJECT',
                    properties: {
                      phoneNumber: { type: 'STRING', description: 'Target phone number to transfer to' },
                    },
                  };
                } else if (fn.type === 'send_sms') {
                  parameters = {
                    type: 'OBJECT',
                    properties: {
                      message: { type: 'STRING', description: 'SMS message content' },
                    },
                  };
                } else if (fn.type === 'press_digit') {
                  parameters = {
                    type: 'OBJECT',
                    properties: {
                      digits: { type: 'STRING', description: 'DTMF digits to press' },
                    },
                  };
                } else {
                  parameters = { type: 'OBJECT', properties: {} };
                }
              }
              return {
                type: 'function',
                name: fn.name,
                description: fn.description || '',
                parameters,
              };
            });
          }

          if (Array.isArray(parsedCfg?.mcpServers) && parsedCfg.mcpServers.length > 0) {
            const mcpDiscovery = await McpService.fetchMcpTools(parsedCfg.mcpServers);
            mcpToolMap = mcpDiscovery.mcpToolMap;
            if (mcpDiscovery.functionDeclarations.length > 0) {
              tools = [...tools, ...mcpDiscovery.functionDeclarations];
            }
          }
        } catch (e) {
          logger.warn('SandboxStreamHandler: Failed to parse agentConfig for functions or MCPs', { error: String(e) });
        }
      }

      const flowGraphTools = extractToolsFromFlowGraph(agent.flowGraph);
      if (flowGraphTools.length > 0) {
        tools = [...tools, ...flowGraphTools];
      }

      // 2. Setup Gemini Live configuration
      const config = {
        callId: connectionId,
        agentId: agentId,
        model: agent.model || 'models/gemini-2.5-flash-native-audio-latest',
        voice: agent.voiceName || 'Aoede',
        instructions: agent.systemPrompt || 'You are a helpful assistant.',
        tools: tools.length > 0 ? tools : undefined,
        userId: userId,
        agent: agent,
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
        onFunctionCall: async (_sessId: string, callId: string, name: string, argsJson: string) => {
          logger.info('SandboxStreamHandler: onFunctionCall triggered', { connectionId, callId, name, argsJson });
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(argsJson);
          } catch {
            args = {};
          }

          let functionDef: any = null;
          if (agent.agentConfig) {
            try {
              const parsedCfg = typeof agent.agentConfig === 'string' ? JSON.parse(agent.agentConfig) : agent.agentConfig;
              if (Array.isArray(parsedCfg?.functions)) {
                functionDef = parsedCfg.functions.find((f: any) => f.name === name);
              }
            } catch {}
          }

          let resultOutput: any = { status: 'success', message: `Tool ${name} executed successfully.` };

          if (mcpToolMap.has(name)) {
            const discoveredMcp = mcpToolMap.get(name)!;
            resultOutput = await McpService.executeMcpTool(discoveredMcp, args as Record<string, any>);
          } else if (functionDef && functionDef.type === 'custom_api' && functionDef.url) {
            try {
              const method = (functionDef.method || 'POST').toUpperCase();
              const headers: Record<string, string> = { 'Content-Type': 'application/json' };
              if (functionDef.headers) {
                try {
                  const customH = typeof functionDef.headers === 'string' ? JSON.parse(functionDef.headers) : functionDef.headers;
                  Object.assign(headers, customH);
                } catch {}
              }

              let fetchUrl = functionDef.url;
              let body: string | undefined = undefined;

              if (method === 'GET' || method === 'DELETE') {
                const urlObj = new URL(fetchUrl);
                Object.entries(args).forEach(([k, v]) => urlObj.searchParams.append(k, String(v)));
                fetchUrl = urlObj.toString();
              } else {
                body = JSON.stringify(args);
              }

              const response = await fetch(fetchUrl, { method, headers, body });
              const responseText = await response.text();
              try {
                resultOutput = JSON.parse(responseText);
              } catch {
                resultOutput = { responseText, statusCode: response.status };
              }
            } catch (err: any) {
              logger.error('SandboxStreamHandler: Custom API tool execution failed', { name, error: err?.message || String(err) });
              resultOutput = { error: `Failed to execute custom API function: ${err?.message || String(err)}` };
            }
          } else if (name === 'check_calendar_availability' || name === 'check_availability') {
            try {
              const avail = await CalendarService.checkAvailability(
                userId,
                (args as any).startTime as string,
                (args as any).endTime as string
              );
              resultOutput = avail;
            } catch (err: any) {
              resultOutput = { status: 'calendar_processed', calendarId: 'primary', details: args };
            }
          } else if (functionDef && functionDef.type === 'end_call') {
            resultOutput = { status: 'call_ended', message: 'Call ended by agent tool request.' };
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ event: 'transcript', text: '[Agent triggered End Call tool]', isFinal: true }));
            }
          } else if (functionDef && functionDef.type === 'transfer_call') {
            resultOutput = { status: 'transfer_initiated', targetNumber: functionDef.targetNumber || args.phoneNumber || 'human_support' };
          } else if (functionDef && functionDef.type === 'send_sms') {
            resultOutput = { status: 'sms_sent', messageTemplate: functionDef.messageTemplate, sentTo: 'caller' };
          } else if (functionDef && (functionDef.type === 'check_calendar' || functionDef.type === 'book_calendar')) {
            resultOutput = { status: 'calendar_processed', calendarId: functionDef.calendarId || 'primary', details: args };
          } else if (functionDef && functionDef.type === 'press_digit') {
            resultOutput = { status: 'digit_pressed', digits: functionDef.digits || args.digits || '1' };
          } else if (functionDef && functionDef.type === 'agent_transfer') {
            resultOutput = { status: 'agent_transferred', targetAgentId: functionDef.targetAgentId || args.targetAgentId };
          }

          const targetSessionId = session.providerSessionId || connectionId;
          this.provider.sendFunctionResult(targetSessionId, callId, JSON.stringify(resultOutput));
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
      const greetingText = getGreetingTextForLanguage(agent.languageMode);
      this.provider.triggerGreeting(result.sessionId, greetingText);

      // Max Call Duration Enforcement
      try {
        const parsedCfg = typeof agent.agentConfig === 'string' ? JSON.parse(agent.agentConfig) : agent.agentConfig;
        const maxDurationSec = parsedCfg?.callSettings?.maxDurationSeconds;
        if (typeof maxDurationSec === 'number' && maxDurationSec > 0) {
          const durationTimer = setTimeout(() => {
            logger.info('SandboxStreamHandler: Call duration limit reached', { connectionId, maxDurationSec });
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ event: 'error', message: 'Maximum call duration limit reached.' }));
              ws.close(1000, 'Max duration reached');
            }
          }, maxDurationSec * 1000);
          ws.on('close', () => clearTimeout(durationTimer));
        }
      } catch (timerErr) {
        logger.warn('SandboxStreamHandler: Failed to set max call duration timer', { error: String(timerErr) });
      }

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
        } else if (event.event === 'media' && event.media?.payload) {
          if (session.providerSessionId) {
            this.provider.sendAudio(session.providerSessionId, event.media.payload);
          }
        } else {
          logger.warn('SandboxStreamHandler: Unrecognized inbound event', { connectionId, event: event?.event });
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
