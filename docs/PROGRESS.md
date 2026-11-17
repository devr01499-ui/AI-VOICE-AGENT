# PROGRESS — single memory file (max 60 lines). Read this + CODEMAP.md first. Detail: PRELAUNCH_NOTES.md, FIX_LOG.md.

| Phase | Scope | Status |
|---|---|---|
| 0 | Setup, code map, test-DB guard, test-secret isolation | DONE, on `main` |
| 1 | F1 first-load flash, F2 auth | DONE, merged to `main` 2026-11-17 (owner said "yes to main directly") |
| 2 | B1 templates, B2 bell, B4 remove Review QA/Auto-detect (+ calendar status fix) | DONE, merged to `main` 2026-11-17 |
| 3 | B3 Prompt Coach, B5 Test Lab | NEXT — branch `fix/prompt-coach-testlab` from `fix/dashboard-ui-1` |
| 4–14 | See CLAUDE.md §13 | not started |

## PRODUCTION — UNTOUCHABLE (nothing relaxed)
- `DATABASE_URL` in `server/.env` is production. Never connect; never copy it or any key anywhere. Tests use `TEST_DATABASE_URL` only (RUNBOOK.md); the guard blanks live service keys.
- Prisma CLI only with BOTH `DATABASE_URL` and `DIRECT_URL` set inline to the test URL. Offline SQL: `prisma migrate diff --from-schema <old> --to-schema prisma/schema.prisma --script`.
- No command text inside double quotes/unquoted backticks; write files with Write/Edit or `<<'EOF'`.
- Every push to `main` auto-deploys Render and runs `prisma db push` on production (P1).

## Status of checks (2026-11-17, branch fix/dashboard-ui-1)
- Typecheck: server 0; frontend 33 (App.tsx 21, SinglePromptStudio.tsx 12). Must be 0 by Phase 14.
- test:security = guard 19 + sign-up 11 + agent rules 7 + bell 16 + calendar status 2 + security 19, all pass; owasp 23/23; payment 16/16; street-smart 32/32; browser 81+ pass, 1 skipped (live login).
- TS2367 "can never be true" in App.tsx settings tabs (`"audit"`, `"billing"`) — dead tab code, check when Settings is touched (Phase 9).

## Pre-launch items
- P0 OWNER: rotate the production DB password (was public in git history); confirm the Google key literal in GeminiLiveProvider.ts is revoked.
- P1 Migrations/Render (PRELAUNCH_NOTES §4, Option A recommended, owner choice pending). New additive migration `20261117120000_add_notification_receipts` exists; under the current `db push` deploy the table is created automatically.
- P2 Payments (Phase 6): plan check fails open if the gateway API errors; plan payment re-usable on paid number routes.
- P3 One-number lock (Phase 7): DB-level unique constraint or locked transaction + parallel test.
- P4 `requireActivePlan` passes free accounts with leftover minutes (Phase 7).
- P5 Security (Phase 12): rate-limit key trusts client `x-user-id` header on public routes.
- P6 White-label (Phases 6/7/9): carrier names still in some user-facing errors (CallService L129/136, billing minutes-overview, KYC errors).
- P7 Found by backend inventory (BACKEND_UNUSED_REPORT.md): data-retention job never runs (Phase 10, DPDP); KYC page calls 3 routes that do not exist (Phase 7); MCPs only used in browser test calls (Phase 4); calendar bookings routes lack the response envelope (Phase 4).

## Needs owner verification (exact steps)
1. Password rotation: Supabase → Project Settings → Database → reset; update `DATABASE_URL` on Render and local `server/.env`; check `/live` returns 200.
2. Render: Settings → Build Command; tell Claude if it matches `render.yaml` and whether the last deploy log shows `prisma db push` succeeding.
3. Vercel: confirm the latest frontend deployment succeeded.
4. F1 logged-in: sign in, open `/dashboard` in a new tab on "Slow 4G": only the splash, then the dashboard.
5. Email sign-up on the live site with a new email and Indian mobile; verification email arrives; phone `12345` is refused.
6. Google sign-in with a new Google account lands on the dashboard; exactly one user in the admin list.
7. Password reset: email → "Set New Password" → dashboard; old password fails; reusing the link says expired.
8. Supabase → Authentication: redirect URLs include `https://www.claritiy.com/dashboard`; min password length 8; rate limits on.
9. After Phase 2 is deployed: Render deploy log shows the `notification_receipts` table created; the bell's Delete works on the live site.
10. "Email on notification" and "mute preferences" (CLAUDE.md §2 of B2): no such code was found on the server. Tell Claude where these live or whether they still need building.

## Decisions
- Checklist = 17 issues + S7, Q8, D9, D10, T0, M0, K0. Zero-open-defects gate in Phase 14.
- `npm run build` rewrites `Frontend/public/sitemap.xml` dates — `git restore` it.
- Frontend uses pnpm; root/server npm. No `gh`, Docker or Postgres here; local DB = PGlite (RUNBOOK). Don't probe its port with a raw socket before it is up.
- Browser tests: `cd Frontend && npx playwright test`; helpers in `e2e/helpers/dashboard.ts` (fake session + stubbed backend; session key `claritiy_voice_supabase_auth_token`).
- Customer bell shows own rows + `ANNOUNCEMENT` rows only; owner-less rows of other types are admin-only.
- `test:street-smart` "assembly latency < 1.0 ms" is load-sensitive (Phase 11).
- Sign-up "Account Type" saved but unused by the server (decide in Phase 4/13).

## Open questions (owner)
1. Gemini model policy (CLAUDE.md §3). 2. `devr0144@gmail.com` address (§11). 3. Migration Option A or B.
- STANDING OWNER RULE (2026-11-17, CLAUDE.md §0.6/§12a): merge every verified phase to `main` and push directly; never ask between phases; report once at the end.

## Next exact step
Phase 3 (B3 Prompt Coach, B5 Test Lab) per docs/PHASED_PROMPTS.md. Start: CODEMAP B3/B5 pointers (re-grep line numbers); Prompt Coach and Test Lab currently make no AI call. Use a stubbed AI transport in tests; never call the live AI API (keys are compromised until rotated).
