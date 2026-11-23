/**
 * e2e-call-harness — Fake Gemini Live API Server
 * 
 * Simulates Google Gemini Live BidiGenerateContent WebSocket API and HTTP endpoints.
 * Supports testing normal calls and setup rejection / safe-tier fallback scenarios.
 */

const http = require('http');
const path = require('path');
// ws is a server dependency (the repo root does not install it): resolve it there.
const { WebSocketServer } = require('module').createRequire(path.resolve(__dirname, '../server/package.json'))('ws');

const PORT = parseInt(process.env.FAKE_GEMINI_PORT || '8095', 10);
let rejectNextSetup = process.env.REJECT_FIRST_SETUP === 'true';
let callerAudioHeard = 0;
let callerAudioDropped = 0;

// Generate 16000Hz 16-bit PCM silent/tone audio frame (320 bytes = 20ms)
const SAMPLE_PCM_FRAME = Buffer.alloc(320, 0x55).toString('base64');

const server = http.createServer((req, res) => {
  // Support verifyApiKey endpoint
  if (req.url && req.url.includes('/v1alpha/models')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      models: [
        { name: 'models/gemini-3.8-live', displayName: 'Gemini 3.8 Live' },
        { name: 'models/gemini-2.5-flash-native-audio-preview-12-2025', displayName: 'Gemini 2.5 Flash Native Audio (preview 12-2025)' },
      ],
    }));
    return;
  }

  // Caller audio actually heard (realtime_input.audio) vs dropped (media_chunks), for the
  // simulator's "the agent hears the caller" requirement.
  if (req.url === '/control/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ callerAudioHeard, callerAudioDropped }));
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

      // 3. Handle Streaming Audio — exactly like gemini-3.8-live (owner report 2026-11-23: agent
      // greeted, then never answered). Only `realtime_input.audio` is heard; the deprecated
      // `media_chunks` is silently dropped; both together are rejected (1007). This fake used to
      // answer any realtime_input, so the harness passed while real calls were deaf.
      const rt = msg.realtime_input || msg.realtimeInput;
      if (rt && (rt.media_chunks || rt.mediaChunks) && rt.audio) {
        ws.close(1007, 'Request contains an invalid argument.');
        return;
      }
      const audio = rt && rt.audio;
      const audioMime = audio && (audio.mime_type || audio.mimeType);
      if (rt && !audio) {
        callerAudioDropped++;
        return; // media_chunks (or anything else): ignored, no error — the real model's behaviour
      }
      if (audio && isSetupComplete && /^audio\/pcm/.test(String(audioMime)) && audio.data) {
        callerAudioHeard++;
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
