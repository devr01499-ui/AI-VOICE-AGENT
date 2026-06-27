# CHANGELOG

## [Unreleased] - 2026-06-25
### Added
- Implemented smart REST-based API key diagnostics on Google Gemini Live provider and call routes to intercept opaque 1008 policy violation WebSocket upgrade closures and print detailed JSON errors.
- Migrated default model configuration to the GA production model name `gemini-2.0-flash` and implemented dynamic backward-compatibility mapping for `gemini-2.0-flash-exp` database configurations.

### Fixed
- Removed trailing slash from Vobiz Account endpoint in the health check, bypassing 307 redirects to private hostnames that caused connection timeouts on startup.
- Fixed critical audio format mismatch between Vobiz (8kHz mu-law) and Gemini/OpenAI (16kHz/24kHz PCM16) by adding high-performance bidirectional G.711 conversion and linear interpolation resampling to RealtimeSessionManager.


## [Unreleased] - 2026-05-20
### Added
- Proposed project roadmap and initial structural plan.
- Initialized mandatory system memory documents (`SYSTEM_CHARTER.md`, `GOVERNANCE_RULES.md`, `ARCHITECTURE_DECISIONS.md`, `BUILD_PLAN.yaml`, `ERROR_LOG.md`, `CHANGELOG.md`).

## [Unreleased] - 2026-06-15
### Fixed
- Fixed TypeScript compile errors related to Express 5 `req.params` typing by casting them to `string`.
- Updated `prisma.config.ts` to expose the datasource URL needed by `prisma db push`.
- Added `ADR-003` to document SQLite connection strategy using driver adapters in Prisma 7.
