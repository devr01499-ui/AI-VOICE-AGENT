# Runbook — Claritiy Voice

Status: complete as of Phase 14 (2026-11-18). Deploy, rollback, migrations, CI and incident steps are at the end.

## Hosting
- Backend: Render (`render.yaml`, Singapore, health check `/live`).
- Frontend: Vercel (`Frontend/vercel.json`, SPA rewrite).

## Commands
- `npm run typecheck` · `npm run build` · `npm run test:security` (root; see CLAUDE.md §2 for the full list).

## Test database (mandatory for every test and DB script)
`DATABASE_URL` in `server/.env` is the PRODUCTION database. Never connect to it from a dev machine: no tests, no Prisma migrate/db push, no seeds, no ad-hoc queries.

Every test script and DB-touching script loads `server/scripts/lib/testDbGuard.cjs` first (added on branch `chore/test-db-guard`). It exits unless `TEST_DATABASE_URL` is set, refuses the database configured in `.env`, refuses non-local hosts unless `TEST_DATABASE_ALLOW_REMOTE=1`, then forces `DATABASE_URL` and `DIRECT_URL` to the test URL. There is no bypass switch. The same guard blanks live payment, email, carrier, AI and Supabase-admin keys so guarded scripts cannot reach real services; set `TEST_<NAME>` (for example `TEST_RAZORPAY_KEY_ID` with an `rzp_test_` key) to use a sandbox credential on purpose. Live Razorpay keys and `NODE_ENV=production` are refused.

Local throwaway database used so far (PGlite: in-memory Postgres with pgvector; nothing is installed in the repo):
1. In a temp folder outside the repo: `npm i @electric-sql/pglite @electric-sql/pglite-pgvector @electric-sql/pglite-socket`.
2. Start a small script that calls `PGlite.create({ extensions: { vector } })`, runs `CREATE EXTENSION IF NOT EXISTS vector; CREATE SCHEMA auth;` plus a stub `auth.uid()` function, and serves it with `PGLiteSocketServer` on `127.0.0.1:54330`.
3. Set `TEST_DATABASE_URL` to `postgresql://postgres:postgres@127.0.0.1:54330/postgres?sslmode=disable`. `sslmode=disable` is required: the app's pg pool otherwise demands TLS.
4. Create the schema from `server/`: run `npx prisma migrate deploy` (builds the database from the committed baseline, like CI) or `npx prisma db push`, with BOTH `DATABASE_URL` and `DIRECT_URL` set inline to the test URL. The Prisma CLI reads `server/.env` and is NOT covered by the guard, so never run it without those two inline variables.
5. Run `npm run build` in `server/` (the JS suites import `dist/`), then `npm run test:security`.

Since Phase 14 the committed migrations build an empty database (one baseline, `20261118000000_baseline`; the 17 older ones are in `prisma/migrations_archive/`). CI proves it on every run: `migrate deploy` on an empty database, then `migrate diff` against `schema.prisma` must be empty.

## Environment variables (names only — never commit values)
Collected by scanning `process.env.*` in `server/src`, `import.meta.env.*` in `Frontend/src`, `render.yaml` and the `.env.example` files. Which ones are required vs optional is defined in `server/src/config/env.ts`.

### Server
Tests only: `TEST_DATABASE_URL`, `TEST_DATABASE_ALLOW_REMOTE`, `TEST_API_URL`

Core: `NODE_ENV`, `PORT`, `PUBLIC_URL`, `PUBLIC_IP`, `FRONTEND_URL`, `ADMIN_ORIGIN`, `ADMIN_IP_ALLOWLIST`, `LOG_LEVEL`, `DATABASE_URL`, `ENCRYPTION_KEY`, `ENABLE_STRICT_AUTH`, `SEED_TEST_DATA`, `DB_POOL_MAX` (optional, 1–100, default 10: DB connections per server instance; keep instances × DB_POOL_MAX under the database plan limit)

Supabase / auth: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXTAUTH_SECRET`

AI models: `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `GOOGLE_GENAI_API_KEY`, `GEMINI_API_VERSION`, `GEMINI_REALTIME_MODEL`, `GEMINI_BUILDER_MODEL`, `GEMINI_HTTP_BASE`, `GEMINI_WS_BASE`, `REPORT_ANALYSIS_MODEL`, `OPENAI_API_KEY`, `OPENAI_REALTIME_MODEL`

Carriers: `VOBIZ_API_URL`, `VOBIZ_AUTH_ID`, `VOBIZ_AUTH_TOKEN`, `VOBIZ_APPLICATION_ID`, `VOBIZ_FROM_NUMBER`, `VOBIZ_WEBHOOK_SECRET`, `PLIVO_API_BASE`, `PLIVO_AUTH_ID`, `PLIVO_AUTH_TOKEN`, `PLIVO_APP_ID`, `TELEPHONY_AUTH_TOKEN`, `OUTBOUND_ALLOWED_COUNTRY_CODES` (optional; comma-separated calling codes besides 91 that single calls may dial, e.g. `971,65`; default: India only — toll-fraud guard)

Payments / invoices: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (required: without it every webhook is refused), `COMPANY_GSTIN` (required for tax invoices; without it receipts are issued)

Razorpay dashboard > Webhooks: URL `https://<backend>/api/v2/webhooks/razorpay`, secret = `RAZORPAY_WEBHOOK_SECRET`, events `payment.captured`, `order.paid`, `refund.processed` (and `payment.failed` for logging). The server answers 500 on temporary failures so Razorpay retries. A 15-minute reconciliation job also activates any captured plan payment that was missed and logs `[ADMIN_ALERT][PAYMENTS]` for paid numbers that were never provisioned.

Email: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`

Google Calendar: `GOOGLE_CALENDAR_ENABLED`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`

Call behaviour / feature flags: `GLOBAL_MAX_CONCURRENT_CALLS`, `ALLOW_OFFHOURS_BATCH_CALLS`, `FAREWELL_AUTOHANGUP`, `FAREWELL_HANGUP_SILENCE_MS`, `SHUTDOWN_DRAIN_SECONDS`, `PLAYOUT_LEAD_MS`, `PLAYOUT_PACING_V2`, `RESAMPLER_V2`, `INBOUND_FORMAT_V2`, `VOICE_PERSONAS_V1`, `CORE_SKILLS_ENABLED`, `EVENT_LOOP_MONITOR`

SIP / dev tooling: `SIP_ENCRYPTION_KEY` (still a fallback encryption key — do not remove), `NGROK_AUTH_TOKEN`

### Frontend (Vite, public at build time — never put secrets here)
`VITE_API_BASE_URL`, `VITE_API_URL`, `VITE_BACKEND_URL`, `VITE_WS_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_RAZORPAY_KEY_ID`

### Known gaps (not verifiable from the repo; check the Render dashboard)
- `render.yaml` declares only 15 keys; `RAZORPAY_*`, `RESEND_*`, `ENCRYPTION_KEY` and `FRONTEND_URL` are not listed there.
- `server/.env.example` has no `RAZORPAY_*`; `Frontend/.env.example` lists only `VITE_API_BASE_URL`.
- `Admin/.env.example` was not scanned.
- `ALLOW_OFFHOURS_BATCH_CALLS` bypasses the calling-hours window — must stay off in production (TRAI).
- Stale names still referenced: `NEXTAUTH_SECRET`, `NEXT_PUBLIC_*` (no Next.js in this project).

## Carriers (accuracy rules, docs checked 2026-11-19)
- **Vobiz:**
  - Every customer sub-account is `customer_use`, so Vobiz verifies that customer's own KYC and blocks their calls until it is done. Older `personal_use` accounts are switched by the boot job `VobizKycModeService` (retried every 30 min; look for `[ADMIN_ALERT][VOBIZ_KYC_MODE]` in the Render log).
  - Numbers are bought on the master account, then moved with `assign-subaccount`.
  - Releasing a number: unrent, or unassign first. A number cannot leave a sub-account for 15 days after its last call; it is kept as `release_pending` and retried hourly.
- **Plivo** (business customers only):
  - The India compliance application is filed per customer sub-account. Callback: `POST {PUBLIC_URL}/api/v2/webhooks/plivo/compliance`; it is only sent when `PUBLIC_URL` is https.
  - Status is also polled every 15 min.
  - A number is bought with `compliance_application_id` and `subaccount`.
- **Plan lifecycle** (`PlanLifecycleService`, hourly):
  - A plan ends at 0 minutes or 30 days, whichever comes first. Unused minutes lapse at the 30-day end.
  - The number is released 5 days after the plan ends.

## Deploy / rollback / incident steps

### Deploy
- Every push to `main` runs CI (`.github/workflows/ci.yml`): typecheck + build, the server test chain on a pgvector Postgres built from the migrations, browser tests, and the migration-drift check. The `deploy-render.yml` workflow calls the Render deploy hook (secret `RENDER_DEPLOY_HOOK_URL`) only after CI passes.
- If Render auto-deploy on push is also on, Render deploys without waiting for CI. To make CI a hard gate: Render → service → Settings → Auto-Deploy: Off, and add the deploy hook URL as a GitHub secret.
- Vercel deploys the frontend from `main` on its own; check the deployment in the Vercel dashboard.
- Database schema on deploy: today the Render build runs `prisma db push` (render.yaml; the dashboard command may differ). After the owner completes the M0 steps (PROGRESS owner step 25), change the build command to `npm install --include=dev && npx prisma generate && npx prisma migrate deploy && npm run build`.

### Schema changes (after M0)
- Edit `schema.prisma`, then create an additive migration offline: `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script` into a new `prisma/migrations/<timestamp>_<name>/migration.sql` (test URL inline), apply it to a test database, and let CI prove zero drift. Never `--accept-data-loss`, never `migrate reset` on production.

### Rollback
- Code: Render → service → Events → pick the previous successful deploy → Rollback (or revert the merge commit on `main` and push). Vercel → Deployments → previous → Promote.
- Schema: migrations are additive; each migration file states its rollback statement (for example `DROP INDEX IF EXISTS ...`). Run a rollback statement on production only after a backup (Supabase → Database → Backups).

### Health and incidents
- `/live` (liveness, Render health check), `/healthz`, `/health` and `/ready` (readiness: database reachable, analysis backlog).
- Boot log lines starting with `🚨  CRITICAL security configuration` mean a secret is missing (SECURITY_AUDIT S14).
- Calls failing: check carrier status, then the Render log for `[CallService]` / `AudioStreamHandler` errors and the `latency_summary` call events. Payments: search the log for `[ADMIN_ALERT][PAYMENTS]` (paid but not provisioned); the reconciliation job retries every 15 minutes.
- Webhook URLs to configure at providers: carrier answer/status/hangup URLs are set per call by the server; Razorpay `https://<backend>/api/v2/webhooks/razorpay`; carrier KYC `https://<backend>/api/v2/kyc/webhook/vobiz`; recording callbacks `https://<backend>/api/v2/webhooks/recording` (signed, set per call).
