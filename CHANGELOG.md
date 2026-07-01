# CHANGELOG

## [Unreleased] - 2026-07-01
### Added
- Added ConversationState class in CallOrchestrator.ts to track AI-user conversational phase transitions.
- Modified processAudioStream in CallOrchestrator.ts to filter outbound user audio based on the current ConversationState.
- Integrated triggerGreeting handler in CallOrchestrator.ts and AudioStreamHandler.ts to transition conversation state to 'listening' after 1.5 seconds post-greeting.
- Implemented onResponseDone callback in CallOrchestrator.ts to transition conversation state to 'listening' when AI finishes responding.
- Implemented Server-Side Voice Activity Detection (VAD) via RMS energy computation on incoming audio streams.
- Configured user barge-in detection by subscribing AudioStreamHandler to USER_STARTED_SPEAKING events to clear telephony queues with sub-200ms latency.
- Added default system prompt in CallOrchestrator.ts incorporating conversational fillers, micro-pauses, and brevity (under 2 sentences).
- Added alignment checks for Int16Array construction in audioConverter.ts to prevent start offset unalignment.

### Fixed
- Fixed Gemini greeting role mismatch in GeminiLiveProvider.ts by setting the role to 'assistant' instead of 'user'.
- Fixed barge-in event callback in GeminiLiveProvider.ts to trigger onSpeechStopped on interruption, and updated CallOrchestrator.ts to transition conversation state to 'listening' on AI speech stop.

## [Unreleased] - 2026-06-30
### Fixed
- Added a `!sessionId` check in the greeting `setTimeout` handler to prevent triggering greeting events with an empty session ID.
- Configured a runtime model name mapping in `GeminiLiveProvider.ts` to map legacy/experimental model names like `gemini-2.0-flash` and `gemini-2.0-flash-exp` to `gemini-2.5-flash-native-audio-latest`.
- Updated the API version endpoint to use `v1beta` for BidiGenerateContent compatibility.
- Added debug log statements in `sendAudioToVobiz` to trace outgoing audio flows.
- Corrected the audio input MIME type to specify the sample rate: 'audio/pcm;rate=16000' in GeminiLiveProvider.ts. This fixes the issue where the Gemini Live API would ignore user speech by failing to run voice activity detection on raw PCM data without a declared rate.
- Reverted the manual conversation state override in CallOrchestrator.ts to allow the model's configured prompt (system instruction) to drive the conversation flow natively.

## [Unreleased] - 2026-06-28
### Fixed
- Fixed critical naming mismatch where `ProviderManagerSDK` called `startSession` instead of `createSession` on the provider.
- Consolidated audio callbacks by passing them directly through `createSession` and removing separate post-init registration maps.
- Implemented robust `setupComplete` promise tracking with timeout error handling in `GeminiLiveProvider` to prevent race conditions.
- Resolved silent call disconnects by catching connection initialization failures and closing WebSocket connections immediately to trigger hangup events.
- Created `CallError` custom exception for rich diagnostic propagation across orchestrator boundaries.

## [Unreleased] - 2026-06-25
### Added
- Implemented smart REST-based API key diagnostics on Google Gemini Live provider and call routes to intercept opaque 1008 policy violation WebSocket upgrade closures and print detailed JSON errors.
- Migrated default model configuration to the GA production model name `gemini-2.0-flash` and implemented dynamic backward-compatibility mapping for `gemini-2.0-flash-exp` database configurations.

### Fixed
- Removed trailing slash from Vobiz Account endpoint in the health check, bypassing 307 redirects to private hostnames that caused connection timeouts on startup.
- Fixed critical audio format mismatch between Vobiz (8kHz mu-law) and Gemini/OpenAI (16kHz/24kHz PCM16) by adding high-performance bidirectional G.711 conversion and linear interpolation resampling to RealtimeSessionManager.
- Resolved Gemini API routing mismatch by mapping database agentConfig keys (llm_config, voice_config) correctly and refactoring RealtimeSessionManager to route calls dynamically to OpenAI Realtime or Gemini Live based on agent configuration, supporting concurrent provider registration at bootstrap.



## [Unreleased] - 2026-05-20
### Added
- Proposed project roadmap and initial structural plan.
- Initialized mandatory system memory documents (`SYSTEM_CHARTER.md`, `GOVERNANCE_RULES.md`, `ARCHITECTURE_DECISIONS.md`, `BUILD_PLAN.yaml`, `ERROR_LOG.md`, `CHANGELOG.md`).

## [Unreleased] - 2026-06-15
### Fixed
- Fixed TypeScript compile errors related to Express 5 `req.params` typing by casting them to `string`.
- Updated `prisma.config.ts` to expose the datasource URL needed by `prisma db push`.
- Added `ADR-003` to document SQLite connection strategy using driver adapters in Prisma 7.
