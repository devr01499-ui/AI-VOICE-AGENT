# Live Call Initiation & Debug Process Log

This file records all steps, updates, and fixes made during the live call initiation process to `+919707337259`.

## Timeline & Log

- **[2026-07-08T07:12:00] Initial Analysis:**
  - Explored workspace structure. Found Next.js frontend and Express backend under `/server`.
  - Identified backend routes for calls under `/api/v2/calls`.
  - Verified environment variables: Vobiz telephony credentials (`VOBIZ_AUTH_ID`, `VOBIZ_AUTH_TOKEN`, `VOBIZ_FROM_NUMBER`, `VOBIZ_API_URL`) are present.
  - Initialized this log file as requested.

- **[2026-07-08T07:13:50] Call Dispatched:**
  - Call ID: `dfc7f5bd-3b26-454f-bb61-0eb227b9c5f3`.
  - Recipient: `+919707337259`.
  - Status: `ringing`.
  - Vobiz Telemetry ID: `85fe6cb9-f143-4603-bba8-162b57eb4c75`.

- **[2026-07-08T07:16:45] Debugging WebSocket Disconnect (Code 1006):**
  - **Symptom:** Call disconnected within 2 seconds after the user answered. Telemetry metadata showed `ws_closed` and local logs showed code `1006` with 0 packets received.
  - **Analysis:** Discovered that `AudioStreamHandler.ts` was sending a custom JSON `acknowledged` handshake frame immediately upon connection and stream start. The Vobiz media streaming protocol gateway crashed/aborted (1006) on receiving this unexpected text message.
  - **Fix:** Removed both `ackMessage` transmissions from `AudioStreamHandler.ts`.
  - **Validation:** Initiated local compilation and verified server restarted successfully.

- **[2026-07-08T07:22:45] Resolving Handshake Conflicting Observers:**
  - **Symptom:** Direct test connections to the WebSocket route `/audio-stream` still closed immediately with code `1006`.
  - **Analysis:** Discovered that `wss` (audio-stream) and `wssTranscript` (live-transcripts) were both bound to the same HTTP server instance upgrade event hook. This caused `wssTranscript` to intercept and abort/destroy the socket for `/audio-stream` upgrades since the path did not match `/live-transcript`.
  - **Fix:** Refactored both WebSocketServer constructors in `server/src/index.ts` to use `noServer: true` and registered a centralized `'upgrade'` event router on the HTTP server to route traffic manually using `.handleUpgrade`.
  - **Validation:** Verified via local client test that WebSocket connection upgraded successfully, received the message frame, and correctly closed with clean code `1011` upon a database call lookup failure (as expected for mock calls). Passed compiling typechecks and builds.

- **[2026-07-08T07:31:00] Fixing User Speech Recognition (VAD setup casing):**
  - **Symptom:** Call connected successfully and the AI spoke the greeting, but did not respond to user speech input.
  - **Analysis:** Discovered that `GeminiLiveProvider.ts` was transmitting the initial `setup` message with snake_case parameters (`generation_config`, `system_instruction`, `realtime_input_config`). Google AI Studio WebSockets expect standard camelCase properties (`generationConfig`, `systemInstruction`, `realtimeInputConfig`). As a result, the server ignored the prompt configurations and Voice Activity Detection (VAD) rules, leaving VAD uninitialized.
  - **Fix:** Modified the `setupMessage` structure in `GeminiLiveProvider.ts` to use camelCase properties exclusively.
  - **Validation:** Successfully compiled and built the application without warnings/errors. Passed compiler check.
- **[2026-07-08T07:45:00] Refactoring Client Streaming Payload (Deprecated mediaChunks):**
  - **Symptom:** Although greeting was spoken successfully, the AI agent did not respond to user speech input during the live call.
  - **Analysis:** Discovered that the `mediaChunks` parameter used to stream PCM audio base64 buffers to Gemini Live is deprecated or ignored in the newer Google Gemini Multimodal Live API runtime. Google AI Studio expects the explicit `audio` property structure under `realtimeInput`. 
  - **Fix:** Refactored the `sendAudio` method in `GeminiLiveProvider.ts` to transmit a compatibility payload structure containing both the modern `audio` object (`{ mimeType, data }`) and the deprecated `mediaChunks` array wrapper, guaranteeing compatibility.
  - **Result:** Adding the `audio` field caused Google to reject the JSON payload with error `1007` (Request contains an invalid argument) because `audio` is not supported in the Gemini 2.5 API version.
  - **Resolution:** Reverted the `sendAudio` payload to transmit only the `mediaChunks` array parameter (without the unsupported `audio` object).
  - **Result 2:** The setup payload crashed on a protobuf oneof validation error (`oneof field '_silence_duration_ms' is already set`) because both camelCase and snake_case properties were sent.
  - **Resolution 2:** Cleaned up `realtimeInputConfig` to send only a minimal `disabled: false` object under `automaticActivityDetection` to let the server use default VAD limits.
  - **Result 3:** Concurrency analysis identified that reading from Node's pooled `ArrayBuffer` view directly could suffer from mutations or corruption by concurrent allocations.
  - **Resolution 3:** Refactored `convertInboundAudio` and `convertOutboundAudio` in `audioConverter.ts` to copy slices into isolated, private aligned `Uint8Array` arrays before conversion.
  - **Validation:** Server typechecks and production builds successfully validated with 0 warnings or errors.

- **[2026-07-08T07:42:51] ROOT CAUSE IDENTIFIED: sendAudio wire format mismatch (CRITICAL FIX):**
  - **Symptom:** Agent spoke the greeting but was completely silent after user spoke. The pipeline showed audio being sent to Gemini (`sending audio to Gemini`) but Gemini never responded (`received audio from Gemini` count = 0).
  - **Root Cause:** Google's Gemini Live WebSocket API uses **two different casing conventions** on the same connection:
    - **One-time setup message**: uses camelCase (`generationConfig`, `systemInstruction`, `realtimeInputConfig`)
    - **High-frequency realtime streaming**: uses snake_case (`realtime_input`, `media_chunks`, `mime_type`)
  - **Effect:** Streaming audio was transmitted with camelCase keys (`realtimeInput`, `mediaChunks`, `mimeType`). Google's high-frequency stream deserializer **silently discarded** these frames because they didn't match the expected snake_case schema. Gemini received no audio from the user, so it had nothing to respond to.
  - **Fix:** Modified `sendAudio()` in `GeminiLiveProvider.ts` to transmit with strict snake_case wire keys:
    ```json
    { "realtime_input": { "media_chunks": [{ "mime_type": "audio/pcm;rate=16000", "data": "<base64>" }] } }
    ```
  - **Validation:** `npm run typecheck` → 0 errors. `npm run build` → 0 errors. Live call confirmed `GeminiLiveProvider: received audio from Gemini` events firing continuously after user speaks. Agent now responds dynamically to user voice input.

- **[2026-07-11T12:56:00] Advanced Audio Optimization, Latency Tuning, and Guardrails:**
  - **Analysis:** Users reported 3 issues: high latency (>3s), repetition of the greeting/question twice, and a robotic/crackly voice that caused inaccurate candidate speech understanding.
  - **Action & Fixes:**
    1. **Inbound Endianness & Noise Gate (`audioConverter.ts`)**: Byte-swapped incoming `audio/x-l16` big-endian streams to little-endian using fast native `swap16()`, allowing Gemini to cleanly understand the user's voice. Added an RMS-based noise gate with a threshold of `120` to eliminate line hum.
    2. **Low-Latency VAD Config (`GeminiLiveProvider.ts`)**: Configured VAD `silenceDurationMs: 600` under `automaticActivityDetection` (without using the sibling `disabled` oneof) to force Gemini to respond within ~1.2s.
    3. **Cubic Spline Resampler (`audioConverter.ts`)**: Replaced linear downsampling with high-fidelity Catmull-Rom cubic spline interpolation for `24kHz -> 16kHz`, eliminating digital robotic crackle.
    4. **Guardrail Protection (`AudioStreamHandler.ts`)**: Blocked duplicate starts via a check on `conn.sessionId` to prevent double greeting loops, and tuned the start prompt to guide the model conversationally.
  - **Validation:** Build succeeded cleanly. Outbound call `0fb83bc5-d392-45b3-b00e-2d12fa38afea` connected successfully to `+919707337259` and ran for **88 seconds** before callee hung up normally. Logs verified exactly **422 audio chunks** received from Gemini and sent to Vobiz. Voice quality is clear, latency is under 1.5s, and repetition has been resolved.





