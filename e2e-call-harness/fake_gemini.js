/**
 * e2e-call-harness — Fake Gemini Live API Server
 * 
 * Simulates Google Gemini Live BidiGenerateContent WebSocket API and HTTP endpoints.
 * Supports testing normal calls and setup rejection / safe-tier fallback scenarios.
 */

const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = parseInt(process.env.FAKE_GEMINI_PORT || '8095', 10);
let rejectNextSetup = process.env.REJECT_FIRST_SETUP === 'true';

// Generate 16000Hz 16-bit PCM silent/tone audio frame (320 bytes = 20ms)
const SAMPLE_PCM_FRAME = Buffer.alloc(320, 0x55).toString('base64');

const server = http.createServer((req, res) => {
  // Support verifyApiKey endpoint
  if (req.url && req.url.includes('/v1alpha/models')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      models: [
        { name: 'models/gemini-2.0-flash-exp', displayName: 'Gemini 2.0 Flash' },
        { name: 'models/gemini-2.5-flash-native-audio-latest', displayName: 'Gemini 2.5 Flash Native Audio' },
      ],
    }));
    return;
  }

  // Health and control endpoints
  if (req.url === '/control/reject-next') {
    rejectNextSetup = true;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ rejectNextSetup: true }));
    return;
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', port: PORT }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  let isSetupComplete = false;
  let audioInterval = null;

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      // 1. Handle Setup Message
      if (msg.setup) {
        const hasThinkingConfig = Boolean(msg.setup.generationConfig?.thinkingConfig || msg.setup.generationConfig?.thinking_config);
        const hasRealtimeTuning = Boolean(msg.setup.realtimeInputConfig);

        // If configured to reject first setup or if setup contains thinkingConfig in reject mode
        if (rejectNextSetup) {
          console.log('[FakeGemini] REJECTING setup frame (simulating upstream rejection)...');
          rejectNextSetup = false; // Next retry should succeed on SAFE tier
          ws.send(JSON.stringify({
            error: {
              code: 400,
              status: 'INVALID_ARGUMENT',
              message: 'Invalid configuration: thinkingConfig and advanced realtimeInputConfig not accepted on this tier',
            },
          }));
          ws.close(1008, 'Setup rejected: invalid configuration');
          return;
        }

        console.log('[FakeGemini] Setup message accepted. SAFE tier detected:', !hasThinkingConfig && !hasRealtimeTuning);
        isSetupComplete = true;

        // Respond with setupComplete immediately
        ws.send(JSON.stringify({ setupComplete: {} }));

        // Automatically send first audio turn within 150ms of setupComplete
        setTimeout(() => {
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({
              serverContent: {
                modelTurn: {
                  parts: [
                    {
                      inlineData: {
                        mimeType: 'audio/pcm;rate=16000',
                        data: SAMPLE_PCM_FRAME,
                      },
                    },
                  ],
                },
                turnComplete: false,
              },
            }));
          }
        }, 150);

        return;
      }

      // 2. Handle Greeting Request (clientContent)
      if (msg.clientContent && isSetupComplete) {
        console.log('[FakeGemini] Greeting clientContent received, transmitting synthesized AI greeting audio');
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({
            serverContent: {
              modelTurn: {
                parts: [
                  {
                    inlineData: {
                      mimeType: 'audio/pcm;rate=16000',
                      data: SAMPLE_PCM_FRAME,
                    },
                  },
                ],
              },
              turnComplete: false,
            },
          }));
        }
        return;
      }

      // 3. Handle Streaming Audio (realtime_input)
      if (msg.realtime_input && isSetupComplete) {
        // Send periodic audio response chunks
        if (!audioInterval) {
          audioInterval = setInterval(() => {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({
                serverContent: {
                  modelTurn: {
                    parts: [
                      {
                        inlineData: {
                          mimeType: 'audio/pcm;rate=16000',
                          data: SAMPLE_PCM_FRAME,
                        },
                      },
                    ],
                  },
                },
              }));
            } else {
              clearInterval(audioInterval);
            }
          }, 400);
        }
      }
    } catch (err) {
      console.error('[FakeGemini] Error processing message:', err.message);
    }
  });

  ws.on('close', () => {
    if (audioInterval) clearInterval(audioInterval);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[FakeGemini] Server listening on http://127.0.0.1:${PORT} (ws://127.0.0.1:${PORT})`);
});
