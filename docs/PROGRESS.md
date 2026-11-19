# PROGRESS — single memory file (max 60 lines). Read this + CODEMAP.md first. Detail: PRELAUNCH_NOTES.md, FIX_LOG.md.

| Phase | Scope | Status |
|---|---|---|
| 0 | Setup, code map, test-DB guard, test-secret isolation | DONE, on `main` |
| 1 | F1 first-load flash, F2 auth | DONE, merged to `main` 2026-11-17 (owner said "yes to main directly") |
| 2 | B1 templates, B2 bell, B4 remove Review QA/Auto-detect (+ calendar status fix) | DONE, merged to `main` 2026-11-17 |
| 3–5 | B3 Prompt Coach, B5 Test Lab · B6 agent editor, B7 conversational builder · B8 knowledge base / RAG | DONE, merged to `main` 2026-11-17 |
| 6 | B13 billing / payment verification | DONE, merged to `main` 2026-11-18 |
| 7 | B9 numbers / KYC / carrier activation | DONE, merged to `main` 2026-11-18 |
| 8 | B10 batch calling | DONE, merged to `main` 2026-11-18 |
| 9 | B11 calling config speed, B12 data pages, typecheck 0 | DONE, merged to `main` 2026-11-18 |
| 10 | B14 recording + P7 data retention | DONE, merged to `main` 2026-11-18 |
| 11 | B15 latency/voice, P11 fixed | DONE, merged to `main` 2026-11-18 |
| 12 | S7 security/traffic hardening, P5/P9/P10/P12 (docs/SECURITY_AUDIT.md) | DONE, merged to `main` 2026-11-18 |
| 13 | D9 dead code (BACKEND_UNUSED_REPORT §5), docs README/SYSTEM_CHARTER/TECH_DEBT | DONE, merged to `main` 2026-11-18 |
| 14 | Q8 CI + smoke E2E, T0, M0 baseline (offline part), marketing accuracy, final report (docs/FINAL_REPORT.md) | DONE, merged to `main` 2026-11-18 |

## PRODUCTION — UNTOUCHABLE (nothing relaxed)
- `DATABASE_URL` in `server/.env` is production. Never connect; never copy it or any key anywhere. Tests use `TEST_DATABASE_URL` only (RUNBOOK.md); the guard blanks live service keys.
- Prisma CLI only with BOTH `DATABASE_URL` and `DIRECT_URL` set inline to the test URL. Offline SQL: `prisma migrate diff --from-schema <old> --to-schema prisma/schema.prisma --script`.
- No command text inside double quotes/unquoted backticks; write files with Write/Edit or `<<'EOF'`. Every push to `main` auto-deploys Render and runs `prisma db push` on production until owner step 25.

## Status of checks (2026-11-19, merge of audit batches 4-5): typecheck 0/0; build OK; test:security 100% on PGlite; all CI suites pass; kb-race 2/2, minutes-race 3/3 (native PG); Playwright 122 passed / 1 skipped (--workers=1).

## Pre-launch items
- P0 OWNER: rotate the production DB password (was public in git history); confirm the Google key literal in GeminiLiveProvider.ts is revoked.
- P1/M0: baseline `20261118000000_baseline` committed and proven (CI checks it); Render still runs `db push` until owner step 25 is done.
- P9/P12 (Phase 12): boot now prints CRITICAL when `ENCRYPTION_KEY` / `VOBIZ_WEBHOOK_SECRET` are unset; owner steps 20–21. Accepted: zod 4 upgrade (A1), Redis limiter store before 2+ instances (A3) — SECURITY_AUDIT §3.

## Needs owner verification (exact steps)
1. Password rotation: Supabase → Project Settings → Database → reset; update `DATABASE_URL` on Render and local `server/.env`; check `/live` returns 200.
2. Render: Settings → Build Command; tell Claude if it matches `render.yaml` and whether the last deploy log shows `prisma db push` succeeding. 3. Vercel: confirm the latest frontend deployment succeeded.
4. F1 logged-in: sign in, open `/dashboard` in a new tab on "Slow 4G": only the splash, then the dashboard. 5. Email sign-up on the live site with a new email and Indian mobile; verification email arrives; phone `12345` is refused. 6. Google sign-in with a new Google account lands on the dashboard; exactly one user in the admin list.
7. Password reset: email → "Set New Password" → dashboard; old password fails; reusing the link says expired. 8. Supabase → Authentication: redirect URLs include `https://www.claritiy.com/dashboard`; min password length 8; rate limits on.
9. After Phase 2 is deployed: Render deploy log shows the `notification_receipts` table created; the bell's Delete works on the live site. 10. "Email on notification" and "mute preferences" (CLAUDE.md §2 of B2): no such code was found on the server. Tell Claude where these live or whether they still need building.
11a. Gemini 3.8 Live (after key rotation): place one test call; Render log must show `targetModel: models/gemini-3.8-live` and no `[LIVE_MODEL_FALLBACK]`; the agent uses end_call/booking tools normally. If the key has no 3.8 access, tell Claude the Google error text. 11. Prompt Coach + Test Lab live smoke (after key rotation): open an agent → Prompt Coach → Enhance; then Test Lab → Run. Expected: a rewritten prompt with placeholders; Test Lab shows 5 callers with transcripts. Judge the quality of the AI answers. 12. Flow + prompt agents live call (after key rotation): call a test number with a flow agent that has a global prompt, inbound direction and two named branches; the agent follows the branches and never reads the instructions aloud; max duration / end-on-silence end the call.
13. Knowledge base with real AI key: upload a real PDF, wait for Ready, ask 5 questions in the Retrieval Inspector (2 in Hinglish). Expected: right section on top; if right answers sit under "Close but not used on calls", tell Claude the similarity numbers (gate tuning). Also confirms the embedding model name works. 14. Razorpay test mode on a staging deploy (test keys, `RAZORPAY_WEBHOOK_SECRET`, webhook per RUNBOOK): buy Starter; on a second try close the tab right after paying. Expected: both activate once; Render log shows webhook 200. Set `COMPANY_GSTIN`; have a CA review COMPLIANCE_NOTES.
15. Numbers live (after keys): with a paid test account, complete KYC, claim one number; a second claim must be refused; a free account must see "needs an active paid plan".
16. Batch live: run a 3-contact campaign at 20:55 IST; it pauses at 21:00 and resumes at 09:00 by itself; an opted-out contact is skipped; get legal advice on TRAI DLT/NCPR (COMPLIANCE_NOTES).
17. Calling Configuration on the live site: open it 5 times; each load should feel instant (<1 s); change an agent — it updates at once.
18. Recording live: switch "Record calls" on for a test agent, call it, hear the notice, then play the recording from Call History (seek, 1.5x, download). Ask Claude to check the Render log for the recording callback if nothing appears. Confirm notice wording/retention with a lawyer (COMPLIANCE_NOTES).
19. Latency live: after 20 real calls, ask Claude to read the `latency_summary` call events (p50/p95). Only then publish a latency number. Existing agents saved with 600 ms "Responsiveness": lower to 300 ms in Speech Settings. Review pricing/competitor copy (COMPLIANCE_NOTES "Marketing claims").
20–24. Security settings (SECURITY_AUDIT §4): set `ENCRYPTION_KEY`, a dedicated `VOBIZ_WEBHOOK_SECRET`, check/enable Supabase RLS (read-only query first), `OUTBOUND_ALLOWED_COUNTRY_CODES` only for countries you sell to.
25. M0 Option A (after this release is live): in `server/`, run `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` (read-only). Expected: `-- This is an empty migration.` Then run `npx prisma migrate resolve --applied 20261118000000_baseline`. Any other output or error: send it to Claude and stop. Then Claude switches render.yaml (and you the Render Build Command) to `migrate deploy`. 26. GitHub → Actions: "CI" green on `main`; add secret `RENDER_DEPLOY_HOOK_URL`; optionally Render Auto-Deploy Off so CI gates deploys. 27. Lawyer: Terms §6 (cites US FTC), Privacy processors, site business figures, MSME/DPDP badges (COMPLIANCE_NOTES).

## Decisions
- Checklist = 17 issues + S7, Q8, D9, D10, T0, M0, K0. Zero-open-defects gate in Phase 14. `npm run build` rewrites `Frontend/public/sitemap.xml` dates — `git restore` it.
- Frontend uses pnpm; root/server npm. No `gh`, Docker or Postgres here; local DB = PGlite (RUNBOOK). Don't probe its port with a raw socket before it is up. Browser tests: `cd Frontend && npx playwright test`; helpers in `e2e/helpers/dashboard.ts` (fake session + stubbed backend; session key `claritiy_voice_supabase_auth_token`).
- Gemini model IDs live only in `server/src/config/geminiModels.ts`. Local native PG runs in IST: `test:m1-pipeline` is flaky there (job times mix DB now() and UTC); judge it on PGlite/CI. Suites that load dotenv need `NODE_ENV=test` inline. Long-wait tests (batch4 #26) need native PG: PGlite drops the socket.
- AI features use `services/ai/textModel.ts` (timeouts, retry, fallback, BYOK) + `aiFeatureLimiter`; tests stub it with `setTextModelTransportForTests`. Never run `db push --accept-data-loss`, even locally.
- LOW MEMORY: when PGlite dies with "out of memory: Zone", use the native test DB: scratchpad `pg/start.mjs` (port 54329, password localtest, db `claritiy_phase4`) and push a copy of schema.prisma with `Unsupported("vector(3072)")` → `Unsupported("text")` (vector search tests still need PGlite). Never use git stash for before/after proofs (a cut-off session can strand work): copy the file aside, test, restore.
- On PGlite run suites with `DB_POOL_MAX=1` (it serialises connections; parallel pools break it). `test:kb-race` needs a real Postgres (native DB on 54329). Playwright runs 2 workers locally (memory-bound machine); measure layout with offsetWidth, not boundingBox, when animations exist. Bell: customers see own rows + `ANNOUNCEMENT` rows only. Sign-up "Account Type" saved but unused by the server (decide in Phase 13).

## Open questions (owner)
1. (resolved 2026-11-19) Gemini model policy: newest Live model, removed ones dropped — config/geminiModels.ts. 2. `devr0144@gmail.com` address (§11). 3. Migration: Option A prepared (step 25). 4. When an account loses its paid plan (cancel/downgrade): keep its number working, pause calls on it, or release it after N days? STANDING RULE (§0.6/§12a): merge each verified phase to `main`, push, never ask between phases.

## Next exact step
AUDIT FIXES (owner: fix all in docs/AUDIT_FINDINGS.md one by one). Done and merged to main (merge 92053a6, 2026-11-19): batches 1-5 + pricing + Gemini 3.8 Live (fix-status table). All H items fixed except #146 (Live 15-min session cap; needs a live Google test) and #148 (scheduled follow-up calls never dialled). Dead-code sweep 2 (2026-11-19, branch chore/dead-code-2): 56 files removed, 27 legacy suites wired as test:legacy (BACKEND_UNUSED_REPORT §6). NEXT: the M items in order (#7 onward, skipping fixed ones), then L.
