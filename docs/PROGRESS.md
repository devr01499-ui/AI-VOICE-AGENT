# PROGRESS — single memory file (max 60 lines). Read this + CODEMAP.md first. Detail: PRELAUNCH_NOTES.md, FIX_LOG.md.

| Phase | Scope | Status |
|---|---|---|
| 0 | Setup, code map, test-DB guard, test-secret isolation | DONE, on `main` |
| 1 | F1 first-load flash, F2 auth | DONE, merged to `main` 2026-11-17 (owner said "yes to main directly") |
| 2 | B1 templates, B2 bell, B4 remove Review QA/Auto-detect (+ calendar status fix) | DONE, merged to `main` 2026-11-17 |
| 3 | B3 Prompt Coach, B5 Test Lab | DONE, merged to `main` 2026-11-17 |
| 4 | B6 agent editor sections, B7 conversational builder | DONE, merged to `main` 2026-11-17 |
| 5 | B8 knowledge base / RAG inspector | DONE, merged to `main` 2026-11-17 |
| 6–14 | See CLAUDE.md §13 | not started |

## PRODUCTION — UNTOUCHABLE (nothing relaxed)
- `DATABASE_URL` in `server/.env` is production. Never connect; never copy it or any key anywhere. Tests use `TEST_DATABASE_URL` only (RUNBOOK.md); the guard blanks live service keys.
- Prisma CLI only with BOTH `DATABASE_URL` and `DIRECT_URL` set inline to the test URL. Offline SQL: `prisma migrate diff --from-schema <old> --to-schema prisma/schema.prisma --script`.
- No command text inside double quotes/unquoted backticks; write files with Write/Edit or `<<'EOF'`.
- Every push to `main` auto-deploys Render and runs `prisma db push` on production (P1).

## Status of checks (2026-11-17, after Phase 5)
- Typecheck: server 0; frontend 33 (App.tsx 21, SinglePromptStudio.tsx 12). Must be 0 by Phase 14.
- test:security 17 suites all pass (incl. kb-rag 20, flow-agent 8); kb-race 2/2 (native PG); owasp 23/23; payment 16/16; street-smart 32/32 + regression 41/41; m2 37/37; batch b–f pass; browser 106 pass, 1 skipped (live login).
- TS2367 "can never be true" in App.tsx settings tabs (`"audit"`, `"billing"`) — dead tab code, check when Settings is touched (Phase 9).

## Pre-launch items
- P0 OWNER: rotate the production DB password (was public in git history); confirm the Google key literal in GeminiLiveProvider.ts is revoked.
- P1 Migrations/Render (PRELAUNCH_NOTES §4, Option A recommended, owner choice pending). New additive migrations `20261117120000_add_notification_receipts`, `20261117130000_add_test_lab_runs`; under the current `db push` deploy the tables are created automatically. Phase 5 adds `20261117140000_kb_chunks_fulltext_index` (expression index: only `migrate deploy` creates it).
- P2 Payments (Phase 6): plan check fails open if the gateway API errors; plan payment re-usable on paid number routes.
- P3 One-number lock (Phase 7): DB-level unique constraint or locked transaction + parallel test.
- P4 `requireActivePlan` passes free accounts with leftover minutes (Phase 7).
- P5 Security (Phase 12): rate-limit key trusts client `x-user-id` header on public routes.
- P6 White-label (Phases 6/7/9): carrier names still in some user-facing errors (CallService L129/136, billing minutes-overview, KYC errors).
- P8 Plans (Phases 6–7): `PAID_ACCOUNT_TYPES` lists growth/scale (unused) but not starter/trial; plans.ts types are trial, starter, developer, professional (Growth), enterprise. Paying Starter users count as entitled only while minutes remain.
- P11 Pre-existing on `main` (same result before Phase 4): `test:m1-pipeline` 10/13 (analysis worker stale-lock reclaim; Plivo "Busy" scored null) → Phase 9; `test:batch-a` 8/9 (audio-stream handshake with valid HMAC in extraHeaders refused) → Phase 11/12. Scripts that load `-r dotenv/config` need `NODE_ENV=test` set inline (guard blocks production mode — correct).
- P7 Found by backend inventory (BACKEND_UNUSED_REPORT.md): data-retention job never runs (Phase 10, DPDP); KYC page calls 3 routes that do not exist (Phase 7); MCPs only used in browser test calls (Phase 4); calendar bookings routes lack the response envelope (Phase 4).

## Needs owner verification (exact steps)
1. Password rotation: Supabase → Project Settings → Database → reset; update `DATABASE_URL` on Render and local `server/.env`; check `/live` returns 200.
2. Render: Settings → Build Command; tell Claude if it matches `render.yaml` and whether the last deploy log shows `prisma db push` succeeding. 3. Vercel: confirm the latest frontend deployment succeeded.
4. F1 logged-in: sign in, open `/dashboard` in a new tab on "Slow 4G": only the splash, then the dashboard.
5. Email sign-up on the live site with a new email and Indian mobile; verification email arrives; phone `12345` is refused. 6. Google sign-in with a new Google account lands on the dashboard; exactly one user in the admin list.
7. Password reset: email → "Set New Password" → dashboard; old password fails; reusing the link says expired. 8. Supabase → Authentication: redirect URLs include `https://www.claritiy.com/dashboard`; min password length 8; rate limits on.
9. After Phase 2 is deployed: Render deploy log shows the `notification_receipts` table created; the bell's Delete works on the live site.
10. "Email on notification" and "mute preferences" (CLAUDE.md §2 of B2): no such code was found on the server. Tell Claude where these live or whether they still need building.
11. Prompt Coach + Test Lab live smoke (after key rotation): open an agent → Prompt Coach → Enhance; then Test Lab → Run. Expected: a rewritten prompt with placeholders; Test Lab shows 5 callers with transcripts. Judge the quality of the AI answers.
12. Flow + prompt agents live call (after key rotation): call a test number with a flow agent that has a global prompt, inbound direction and two named branches; the agent follows the branches and never reads the instructions aloud; max duration / end-on-silence end the call.
13. Knowledge base with real AI key: upload a real PDF, wait for Ready, ask 5 questions in the Retrieval Inspector (2 in Hinglish). Expected: right section on top; if right answers sit under "Close but not used on calls", tell Claude the similarity numbers (gate tuning). Also confirms the embedding model name works.

## Decisions
- Checklist = 17 issues + S7, Q8, D9, D10, T0, M0, K0. Zero-open-defects gate in Phase 14. `npm run build` rewrites `Frontend/public/sitemap.xml` dates — `git restore` it.
- Frontend uses pnpm; root/server npm. No `gh`, Docker or Postgres here; local DB = PGlite (RUNBOOK). Don't probe its port with a raw socket before it is up. Browser tests: `cd Frontend && npx playwright test`; helpers in `e2e/helpers/dashboard.ts` (fake session + stubbed backend; session key `claritiy_voice_supabase_auth_token`).
- AI features use `services/ai/textModel.ts` (timeouts, retry, fallback, BYOK) + `aiFeatureLimiter`; tests stub it with `setTextModelTransportForTests`. Never run `db push --accept-data-loss`, even locally.
- LOW MEMORY: when PGlite dies with "out of memory: Zone", use the native test DB: scratchpad `pg/start.mjs` (port 54329, password localtest, db `claritiy_phase4`) and push a copy of schema.prisma with `Unsupported("vector(3072)")` → `Unsupported("text")` (vector search tests still need PGlite). Never use git stash for before/after proofs (a cut-off session can strand work): copy the file aside, test, restore.
- On PGlite run suites with `DB_POOL_MAX=1` (it serialises connections; parallel pools break it). `test:kb-race` needs a real Postgres (native DB on 54329). Playwright runs 2 workers locally (memory-bound machine); measure layout with offsetWidth, not boundingBox, when animations exist. Bell: customers see own rows + `ANNOUNCEMENT` rows only. Sign-up "Account Type" saved but unused by the server (decide in Phase 13).

## Open questions (owner)
1. Gemini model policy (CLAUDE.md §3). 2. `devr0144@gmail.com` address (§11). 3. Migration Option A or B. STANDING RULE (§0.6/§12a): merge each verified phase to `main`, push, never ask between phases.

## Next exact step
Phase 6 (branch `fix/billing-security`, PHASED_PROMPTS.md + CLAUDE.md B13, P2): BillingService.ts, routes/billing.ts, razorpayWebhook.ts, number purchase (`completeNumberPurchase` ignores client price). Tests: forged signature, replay, amount tampering, wrong user, double submit, webhook-before-verify race.
