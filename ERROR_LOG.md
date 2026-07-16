# ERROR_LOG

| ID | Symptom | Root Cause | Fix | Prevention Rule | Date |
|----|---------|------------|-----|-----------------|------|
| ERR-001 | Providers: Vobiz initialization failed (fetch failed) | Trailing slash in Account healthcheck URL triggered 307 redirect to private DNS account-service.vobiz.ai | Removed trailing slash from Account API healthcheck URL | Test API endpoints for redirection behavior when using trailing slashes | 2026-06-25 |
| ERR-002 | Provider socket closed after 2s / decoding error | Vobiz sends 8kHz mu-law audio but the server claimed it was PCM16 without doing any conversion | Implemented G.711 mu-law decoding/encoding and linear interpolation resampling to match provider specs | Validate audio format and sample rate compatibility across telephone and AI provider boundaries | 2026-06-27 |
| ERR-003 | Call routed to Gemini instead of OpenAI / fallback model used | Mismatch in agent configuration keys (llm_config vs llm in DB) caused runtime engine to load defaults and select Gemini globally | Mapped database keys to runtime layout and refactored RealtimeSessionManager to route calls dynamically per-session | Map database configurations to types safely and avoid hardcoded global default providers | 2026-06-27 |
| ERR-004 | PrismaClientConstructorValidationError on server boot (Render HTTP 500) | `engineType = "library"` in generator block is a removed API in Prisma 7 (P1012). Prisma 7 eliminated the native Rust engine. `url` in datasource block is also forbidden in schema files (P1012) — must live in `prisma.config.ts` | Removed `engineType = "library"` from both schema files; confirmed `datasource.url` correctly routed via `server/prisma.config.ts`; hardened singleton with `$connect()` boot check | Never set `engineType` in Prisma 7 schema files. Connection URLs must be in `prisma.config.ts` datasource block only | 2026-07-16 |


