# Antigravity Operational Governance Rules — Clarity Voice Core

You are strictly bound to this zero-regression architectural contract. Before rewriting, creating, or modifying any file in this repository, you must cross-reference your proposed changes against these structural constraints.

## 1. Frontend Communication & Signaling Contracts
- **Route Namespaces**: All outbound dashboard API communication hooks targeting calls must use versioned endpoints strictly: `/api/v2/calls/*`. Never utilize unversioned legacy routes.
- **Payload Unification**: When triggering an outbound call placement loop (`POST /api/v2/calls`), the body payload payload key must strictly be named `phoneNumber`. Never name or alias this parameter to `recipientNumber`.
- **Response Extraction**: Always wrap backend data extractions within the nested data envelope block safely (`json.data.callId` or `json.data.id`). Inspect and verify that `json.data` is defined before extracting sub-properties to prevent client-side hydration crashes.
- **Authentication Headers**: Every outbound Axios instance transaction must inherit the centralized interceptor context, automatically attaching `Authorization`, `x-user-id`, and a dynamically generated `x-request-id` to clear preflight CORS rule matrices.

## 2. Telephony & Webhook Handling (Vobiz Pipeline)
- **Middleware Ordering**: In the server bootstrap sequence (`server/src/index.ts`), `app.use(express.urlencoded({ extended: true }));` must remain declared and initialized BEFORE any route or webhook routers are registered.
- **Multi-ID Session Resolution**: Webhook lookups inside `CallController.ts` cannot look up calls via a single token. They must utilize an atomic query statement checking `RequestUUID`, `CallUUID`, and `telemetryId` interchangeably using an `OR` condition to tolerate carrier identifier shifts mid-session.
- **XML Mime-Type Enforcements**: The webhook answer controller method must run `res.set('Content-Type', 'application/xml');` before outputting VoiceXML data arrays.

## 3. Real-Time Media & Streaming (Pipecat Framework)
- **Codec Constancy**: The VoiceXML `<Stream>` tag must strictly dictate `contentType="audio/x-l16;rate=16000"`. You are strictly prohibited from degrading the media channel stream to 8kHz mu-law or A-law formats.
- **Model Isolation**: The `GeminiLiveLLMService` engine task runner configuration block must remain pinned strictly to `models/gemini-2.5-flash-native-audio-latest` utilizing the `v1alpha` API stable channel.
- **Interruption Flow**: The pipeline's Voice Activity Detection (VAD) loop must trigger an explicit, low-latency target queue flush (`this.pipeline.flushOutputQueue()`) immediately upon candidate speech interception to enforce fluid turn-taking.

## 4. Absolute Verification Gate
- After completing any edit pass, you are ordered to execute compile-time health verification checks:
  1. Root folder: `npm run typecheck && npm run build`
  2. Server folder: `npm run typecheck && npm run build`
- If a compilation error or warning is encountered, you must roll back the change immediately and refactor until the pipeline achieves absolute stability with 0 errors.
