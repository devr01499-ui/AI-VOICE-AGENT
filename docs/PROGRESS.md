# PROGRESS — single memory file (max 60 lines). Read this + CODEMAP.md first. Detail: PRELAUNCH_NOTES.md.

| Phase | Scope | Status |
|---|---|---|
| 0 | Setup, baseline, code map, test-DB guard, test-secret isolation | DONE 2026-11-16, on `main` |
| 1 | F1 first-load flash, F2 auth | CODE DONE on `fix/frontend-first-load-auth` (pushed, not merged) — F1 + F2 fixed with tests (FIX_LOG, docs/proof/F1, F2); owner checks 4–8 below still open |
| 2 | B1 templates/create-agent, B2 bell, B4 remove Review QA/Auto-detect | NEXT — branch `fix/dashboard-ui-1` from `fix/frontend-first-load-auth` |
| 3–14 | See CLAUDE.md §13 | not started |

## PRODUCTION — UNTOUCHABLE (nothing relaxed; no real customers yet, launch is soon)
- `DATABASE_URL` in `server/.env` is production. Never connect: no tests, Prisma commands, seeds or queries. Never copy it or any key into docs, logs, commits or chat.
- Tests use `TEST_DATABASE_URL` only (recipe in RUNBOOK.md). The guard also blanks live payment/email/carrier/AI keys.
- Never run any `prisma` command (db push, migrate, db pull, studio) unless the test URL is passed inline for BOTH `DATABASE_URL` and `DIRECT_URL`.
- Never put command text inside double-quoted shell strings or unquoted backticks. Write docs with Write/Edit or a quoted heredoc (`<<'EOF'`).
- Every push to `main` auto-deploys Render and runs `prisma db push` against production (see pre-launch item P1).

## Baseline (2026-11-16)
- Build PASS. Typecheck: server 0 errors; frontend 37 errors after Phase 1 (App.tsx 21, SinglePromptStudio.tsx 13, DashIntegrations.tsx 3). Must be 0 by Phase 14.
- Fix per phase: AuthGateway.tsx + api.ts in Phase 1; DashIntegrations.tsx in Phase 2; SinglePromptStudio.tsx in Phases 3–4; App.tsx whenever touched.
- "Comparison can never be true" (TS2367), likely dead settings tabs — check for real logic bugs: App.tsx L5555 (`"audit"`), L6260 (`"billing"`), L6414 (`"audit"`), all against a type that only allows `webhooks | kyc | workspace | api | team`.
- Local test DB, guard + isolation on: `test:security` 19/19 (+19/19 guard tests), `test:owasp` 23/23, `test:payment-security` 16/16, `test:street-smart` 32/32.

## Pre-launch items (must be closed with proof before launch)
- P0 OWNER, URGENT: rotate the production database password. It was hard-coded in five tracked files in a PUBLIC GitHub repo (removed from the files; still in history). Also confirm the Google key literal in GeminiLiveProvider.ts L225 is revoked.
- P1 Migrations/Render: committed migrations cannot build an empty database; Render build runs `db push` on production. Plan with two options in PRELAUNCH_NOTES.md §4; recommended Option A. Owner to choose. No deploy file changed.
- P2 Payments (Phase 6): answers in PRELAUNCH_NOTES.md §1 — (a) No. (b) Not normally, but the amount check fails open if Razorpay's API errors. (c) Yes: a payment redeemed for a plan is accepted again by the paid number routes. No hotfix by owner decision.
- P3 One-number lock (Phase 7): will be fixed with a database-level unique constraint or a transaction with row lock, never check-then-set in application code, plus a parallel-request test.
- P4 `requireActivePlan` also passes free accounts with leftover minutes (Phase 7).

## Needs owner verification (cannot be checked from here; exact steps)
1. Password rotation: Supabase dashboard → Project Settings → Database → reset password; update `DATABASE_URL` on Render and in local `server/.env`; confirm the site still loads and `/live` returns 200.
2. Render build command: Render dashboard → service → Settings → Build Command. Tell Claude whether it matches `render.yaml` and whether recent deploy logs show `prisma db push` succeeding or failing.
3. Vercel: after this push, confirm the frontend deployment succeeded (the frontend lockfile changed).

## Decisions
- Checklist = 17 issues (F1–F2, B1–B15) + S7, Q8, D9, D10. "20 items"/"15 issues" in prompts mean this list.
- Zero-defect rule: nothing is closed as "known issue", "later" or "cannot reproduce" without written proof; unverifiable items go under "Needs owner verification" with steps. Phase 14 ends with a zero-open-defects gate.
- Ops scripts stay blocked from production by the guard; owner will ask if a procedure is needed.
- `npm run build` rewrites `Frontend/public/sitemap.xml` dates — `git restore` it, never commit it.
- Frontend uses pnpm; root and server use npm. No `gh` CLI, Docker or Postgres on this machine.
- Guard exemptions: `scripts/test_auth_protection.js` (deploy gate, no DB), `scripts/build_all.js`.
- Batch routes live in `routes/calendar.ts`; notification routes in `routes/user.ts`. Prompt Coach and Test Lab have no LLM call today.
- CODEMAP line ranges are unverified unless tagged [CHECKED]. Sign-up-blocked and page-flash leads are verified in Phase 1.
- 2026-11-16: owner instructed a one-time direct push of Phase 0 work to `main`. CLAUDE.md §0.6 (PRs only) still applies afterwards.

## Open questions (owner)
1. Gemini model policy (CLAUDE.md §3) — owner decides later.
2. CLAUDE.md §11 `devr0144@gmail.com` Growth upgrade address — owner confirms later.
3. Migration Option A or B (PRELAUNCH_NOTES.md §4).

4. F1 logged-in check: sign in, open `/dashboard` in a new tab with the network throttled to "Slow 4G" (browser dev tools). Expected: only the "Claritiy Voice" splash, then the dashboard — no sign-in form and no white page in between. Not provable here: the simulated session was rejected by the Supabase client.
5. Email sign-up: on the deployed site create an account with a new email and an Indian mobile number. Expected: "verification link has been sent"; the email arrives; its link opens the dashboard. Also try phone `12345`: it must be refused.
6. Google: click "Continue with Google" with a Google account never used here. Expected: lands on the dashboard, and exactly one user appears in the admin user list.
7. Password reset: "Forgot password?" → email arrives → link opens "Set New Password" (not the dashboard) → after saving, the dashboard opens and the old password no longer works. Open the same link again: expected "link has expired or was already used".
8. Supabase dashboard → Authentication: confirm the Site URL and Redirect URLs include `https://www.claritiy.com/dashboard`, minimum password length is 8, and leaked-password protection and rate limits are on.

## Next exact step
Continuous mode (CLAUDE.md §12a). Next: Phase 2 (B1, B2, B4) per docs/PHASED_PROMPTS.md; CODEMAP has the pointers (App.tsx line numbers moved by about -130 after Phase 1 — re-grep). Browser tests: `cd Frontend && npx playwright test` (dev server starts itself; stub every outside request as in e2e/auth-flows.spec.ts). Supabase session storage key is `claritiy_voice_supabase_auth_token` (needed to fake a logged-in session in tests). Known flaky: `test:street-smart` "assembly latency < 1.0 ms" fails when the machine is busy (Phase 11). Sign-up "Account Type" is saved in sign-up data but unused by the server (decide in Phase 4/13). Marketing claims seen that need measured proof by Phase 11/14: "sub-180ms" (prerender home summary), "Sub-Second Latency" (AuthGateway).
