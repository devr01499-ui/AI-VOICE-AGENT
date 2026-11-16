# PROGRESS — single memory file (max 60 lines). Read this + CODEMAP.md first.

| Phase | Scope | Status |
|---|---|---|
| 0 | Setup, baseline, code map | DONE 2026-11-16 — PR `chore/phase-0-setup` awaiting owner merge |
| 0b | Test-DB guard | DONE 2026-11-16 — PR `chore/test-db-guard` awaiting owner merge (merge after Phase 0) |
| 1 | F1 first-load flash, F2 auth | not started — begins from updated `main` after both PRs merge |
| 2–14 | See CLAUDE.md §13 | not started |

## PRODUCTION DATABASE — UNTOUCHABLE
`DATABASE_URL` in `server/.env` is production with real customer data. Never connect: no tests, Prisma migrate/db push, seeds or queries. Never copy it or any key into docs, logs, commits or chat. Tests use `TEST_DATABASE_URL` only (recipe: RUNBOOK.md "Test database"). The Prisma CLI is not covered by the guard — always pass `DATABASE_URL`/`DIRECT_URL` inline.

## Baseline (2026-11-16)
- `npm run build`: PASS.
- `npm run typecheck`: server PASS; frontend 41 errors (not fixed; fix when a phase touches the code). By file: App.tsx 21, SinglePromptStudio.tsx 13, DashIntegrations.tsx 3, AuthGateway.tsx 2, api.ts 2. By kind: TS2339 missing property ×20, TS2322 wrong type ×8, TS7006 implicit any ×4, TS2345 bad argument ×4, TS2367 impossible comparison ×3, TS2430 ×1, TS2353 ×1.
- On local test DB (with guard branch): `test:security` 19/19 (+13/13 guard tests), `test:owasp` 23/23, `test:payment-security` 16/16, `test:street-smart` 32/32. The earlier 13/19 was only the unreachable database.

## Findings (owner should read)
1. Number-purchase underpayment — code flaw CONFIRMED by reading, impact today LOW. Detail in CODEMAP B13. No hotfix made: `/claim` already gives the same single number free. Fix in Phase 6.
2. Committed Prisma migrations cannot rebuild the database: `migrate deploy` on an empty DB fails at `20260904170500_add_contacts_qa_alerts_integrations` (column `users.number_locked` is never created by a migration), and ~175 schema statements exist only in `schema.prisma`. Production has been shaped by `db push`.
3. Auto-deploy: `render.yaml` has `autoDeploy: true` on `main` and its build command runs `prisma db push --skip-generate` against production on every push. With the Prisma 7.10.0 installed locally that flag is rejected (exit 1); which version Render resolves, and whether the dashboard overrides the command, is NOT verified. Not changed.
4. CI: `call-path-e2e.yml` uses its own Postgres container (safe). `deploy-render.yml` runs `scripts/test_auth_protection.js` (no DB code) then calls the Render deploy hook on push to `main`.
5. Tests still load every other secret from `server/.env` (payments, email, carriers). Whether any suite calls those live services was NOT checked.
6. The guard now also blocks ops scripts from production (e.g. `admin_upgrade_plan.ts`, `create-first-owner.ts`, `seed-*.ts`, `enable_rls.js`). There is deliberately no bypass.

## Decisions
- Checklist = 17 issues (F1–F2, B1–B15) + S7, Q8, D9, D10. "20 items"/"15 issues" in prompts mean this list.
- `npm run build` rewrites `Frontend/public/sitemap.xml` dates — `git restore` it, never commit it.
- Frontend uses pnpm (`Frontend/pnpm-lock.yaml`); root and server use npm. No `gh` CLI, Docker or Postgres on this machine.
- Guard exemptions: `scripts/test_auth_protection.js` (deploy gate, no DB) and `scripts/build_all.js`. 48 guarded files are git-ignored local scratch files.
- Batch routes live in `routes/calendar.ts`; notification routes in `routes/user.ts`.
- Prompt Coach and Test Lab are template/heuristic today (no LLM call) — Phase 3 is a build.
- CODEMAP line ranges are unverified unless tagged [CHECKED].

## Open questions (owner)
1. Gemini model policy (CLAUDE.md §3): pinned `gemini-2.5-flash-native-audio-latest` vs fallback `gemini-2.0-flash-exp`. Owner will decide later.
2. CLAUDE.md §11 `devr0144@gmail.com` Growth upgrade address — owner will confirm later.
3. Migrations vs `db push` (findings 2–3): how to get a trustworthy migration history without touching production.
4. Should tests get a secrets-free `.env.test` so they cannot reach live payment/email/carrier services (finding 5)?
5. Ops scripts that must run on production (finding 6): owner-only procedure needed?

## Next exact step
Owner merges PR `chore/phase-0-setup`, then PR `chore/test-db-guard` → fresh session, paste Phase 1, branch `fix/frontend-first-load-auth` from updated `main`. Phase 1 verifies the sign-up-blocked and page-flash leads.
