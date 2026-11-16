# Runbook — Claritiy Voice

Status: skeleton created in Phase 0. Deploy, rollback, carrier webhook URLs and incident steps are filled in during Phases 12–14.

## Hosting
- Backend: Render (`render.yaml`, Singapore, health check `/live`).
- Frontend: Vercel (`Frontend/vercel.json`, SPA rewrite).

## Commands
- `npm run typecheck` · `npm run build` · `npm run test:security` (root; see CLAUDE.md §2 for the full list).

## Environment variables (names only — never commit values)
Collected by scanning `process.env.*` in `server/src`, `import.meta.env.*` in `Frontend/src`, `render.yaml` and the `.env.example` files. Which ones are required vs optional is defined in `server/src/config/env.ts`.

### Server
Core: `NODE_ENV`, `PORT`, `PUBLIC_URL`, `PUBLIC_IP`, `FRONTEND_URL`, `ADMIN_ORIGIN`, `ADMIN_IP_ALLOWLIST`, `LOG_LEVEL`, `DATABASE_URL`, `ENCRYPTION_KEY`, `ENABLE_STRICT_AUTH`, `SEED_TEST_DATA`

Supabase / auth: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXTAUTH_SECRET`

AI models: `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `GOOGLE_GENAI_API_KEY`, `GEMINI_API_VERSION`, `GEMINI_REALTIME_MODEL`, `GEMINI_BUILDER_MODEL`, `GEMINI_HTTP_BASE`, `GEMINI_WS_BASE`, `REPORT_ANALYSIS_MODEL`, `OPENAI_API_KEY`, `OPENAI_REALTIME_MODEL`

Carriers: `VOBIZ_API_URL`, `VOBIZ_AUTH_ID`, `VOBIZ_AUTH_TOKEN`, `VOBIZ_APPLICATION_ID`, `VOBIZ_FROM_NUMBER`, `VOBIZ_WEBHOOK_SECRET`, `PLIVO_API_BASE`, `PLIVO_AUTH_ID`, `PLIVO_AUTH_TOKEN`, `PLIVO_APP_ID`, `TELEPHONY_AUTH_TOKEN`

Payments / invoices: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `COMPANY_GSTIN`

Email: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`

Google Calendar: `GOOGLE_CALENDAR_ENABLED`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`

Call behaviour / feature flags: `GLOBAL_MAX_CONCURRENT_CALLS`, `ALLOW_OFFHOURS_BATCH_CALLS`, `FAREWELL_AUTOHANGUP`, `FAREWELL_HANGUP_SILENCE_MS`, `SHUTDOWN_DRAIN_SECONDS`, `PLAYOUT_LEAD_MS`, `PLAYOUT_PACING_V2`, `RESAMPLER_V2`, `INBOUND_FORMAT_V2`, `VOICE_PERSONAS_V1`, `CORE_SKILLS_ENABLED`, `EVENT_LOOP_MONITOR`

SIP / dev tooling: `SIP_TRUNKING_ENABLED`, `SIP_ENCRYPTION_KEY`, `DRACHTIO_HOST`, `DRACHTIO_PORT`, `DRACHTIO_SECRET`, `NGROK_AUTH_TOKEN`

### Frontend (Vite, public at build time — never put secrets here)
`VITE_API_BASE_URL`, `VITE_API_URL`, `VITE_BACKEND_URL`, `VITE_WS_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_RAZORPAY_KEY_ID`

### Known gaps (to resolve in Phase 12, not yet verified against the Render dashboard)
- `render.yaml` declares only 15 keys; `RAZORPAY_*`, `RESEND_*`, `ENCRYPTION_KEY` and `FRONTEND_URL` are not listed there.
- `server/.env.example` has no `RAZORPAY_*`; `Frontend/.env.example` lists only `VITE_API_BASE_URL`.
- `Admin/.env.example` was not scanned.
- `ALLOW_OFFHOURS_BATCH_CALLS` bypasses the calling-hours window — must stay off in production (TRAI).
- Stale names still referenced: `NEXTAUTH_SECRET`, `NEXT_PUBLIC_*` (no Next.js in this project).

## Deploy / rollback / incident steps
To be written (Phases 12–14).
