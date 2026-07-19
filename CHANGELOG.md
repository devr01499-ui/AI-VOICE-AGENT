# CHANGELOG

## [Unreleased] - 2026-07-19
### Fixed
- Resolved visual clipping bug for the multi-agent assignment dropdown panel inside the overflow-hidden documents table. Rewrote the select agents menu to use Radix-based `Popover` portals so the dropdown renders outside the clipping ancestor container.
- Removed legacy global window 'click' event listener (`handleOutsideClick`) that conflicted with the new Popover component's automatic focus-handling and immediately closed the dropdown after opening.
- Resolved authentication bypass on phone numbers list route (`GET /api/v2/numbers`) by adding the `requireAuth` middleware and replacing legacy raw `getUserIdFromRequest` calls.
- Resolved payload over-fetching in phone numbers list endpoint. Added a Prisma query `select` block returning only the required fields to display provisioned phone numbers list.
- Resolved out-of-sync agent lists across different views/tabs when creating or deleting an agent inside `DashAgents` by optimistically updating the parent `apiAgents` state.
### Changed
- Optimistically updated the document lists and agent configuration list in the UI for creation, deletion, scraping, uploads, and link assignments. This eliminates unnecessary full list refetches (e.g., `loadDocs()`, `loadAgents()`) upon mutation, with full reversion and user notification on backend failure.
- Restricted query scope of `/api/v2/agents` and `/api/v2/knowledge-base` list endpoints. They now select only the fields needed by their respective list views and exclude heavy fields (like `systemPrompt`, `flowGraph`, `agentConfig`, and `contentText`). Added on-demand fetching via single item endpoints when navigating to configuration or detail screens.
- Added a `sizeChars` integer column to the `KnowledgeBase` model stored during creation, instead of dynamically loading the entire content text just to count its length.
- Added database index `@@index([userId])` to the `PhoneNumber` model in both schemas via a proper Prisma migration, resolving unindexed query scans in high-concurrency environments.

## [Unreleased] - 2026-07-17
### Fixed
- Unmasked generic authentication 500 exceptions in `requireAuth` middleware by tracking processing phases (`token_verification`, `supabase_getUser`, `legacy_auth_fallback`, `database_upsert`). The middleware now logs and returns explicit phase failure messages to simplify client-side/console-side troubleshooting.

## [Unreleased] - 2026-07-16
### Fixed
- Resolved `PrismaClientConstructorValidationError` boot crash on Render by removing the Prisma 7-incompatible `engineType = "library"` field from both `server/prisma/schema.prisma` and `prisma/schema.prisma`. Prisma v7 removed the native Rust query engine; this field caused error P1012 at schema validation.
- Confirmed connection URL is correctly routed via `datasource.url` in `server/prisma.config.ts` (Prisma 7 forbids `url` in schema files per error code P1012).
- Hardened `server/src/lib/prisma.ts` singleton: added explicit `$connect()` call at boot for immediate connection failure surfacing, development-mode query logging for Supabase diagnostics, and `SIGTERM`/`SIGINT` disconnect handlers for clean connection pool teardown on Render.
- Added `earlyAccess: true` flag verified present in `server/prisma.config.ts` (required by Prisma 7 `defineConfig` API in the server workspace).


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
- Fixed potential undefined sample indices inside Catmull-Rom resampling loop inside audioConverter.ts by clamping index boundaries to lastIndex.
- Added detailed diagnostic logging for Gemini WebSocket handshake frames, setupComplete, and error response packages.
- Configured media hook raw inbound bytes logging in AudioStreamHandler.ts to track traffic ingestion.
- Converted Gemini Live setup configuration structure from camelCase fields to strict snake_case wire protocol parameters (generation_config, realtime_input_config, system_instruction, prebuilt_voice_config) to resolve handshake failures.

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
