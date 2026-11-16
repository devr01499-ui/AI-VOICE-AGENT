# PROGRESS — single memory file (max 60 lines). Read this + CODEMAP.md first.

| Phase | Scope | Status |
|---|---|---|
| 0 | Setup, baseline, code map | DONE 2026-11-16 (branch chore/phase-0-setup) |
| 1 | F1 first-load flash, F2 auth | not started |
| 2 | B1 templates/create-agent, B2 bell, B4 remove Review QA/Auto-detect | not started |
| 3 | B3 Prompt Coach, B5 Test Lab | not started |
| 4 | B6 agent editor, B7 conversational format | not started |
| 5 | B8 knowledge base / RAG | not started |
| 6 | B13 billing (critical) | not started |
| 7 | B9 numbers / KYC / sub-accounts | not started |
| 8 | B10 batch calling | not started |
| 9 | B11 calling-config speed, B12 data pages | not started |
| 10 | B14 call recording | not started |
| 11 | B15 latency / voice | not started |
| 12 | §7 security / traffic | not started |
| 13 | §9 dead code | not started |
| 14 | §8 CI / E2E / final | not started |

## Baseline (2026-11-16, commit 549955a, nothing fixed — owner to decide)
- `npm run build`: PASS.
- `npm run typecheck`: FAIL — environment, not code. Frontend step cannot find `node_modules/typescript/bin/tsc` at the repo root (typescript is not installed there; Frontend/package.json does not list it). Server typecheck run alone: PASS. Frontend types: NOT CHECKED.
- `npm run test:security`: FAIL 13/19 — database unreachable (`ENOTFOUND tenant/user postgres...`). Failing: Seed multi-tenant accounts for IDOR validation; Tenant A cannot read or mutate Tenant B agent; Tenant A cannot use Tenant B agent for batch campaigns; Idempotent payment defense; AlertEvaluator background evaluation; Clean up penetration test accounts.
- The suite prints "100% COVERAGE" even when tests fail — misleading banner.

## Decisions
- Checklist = 17 issues (F1–F2, B1–B15) + S7, Q8, D9, D10. Phase prompts saying "20 items"/"15 issues" mean this list. MASTER_PROMPT file is not in the repo.
- `npm run build` rewrites `Frontend/public/sitemap.xml` lastmod dates — `git restore` it, never commit that diff.
- `test:security` writes fixture users/agents into whatever `DATABASE_URL` in server/.env points to. Do not run it against production.
- Batch routes live in `server/src/routes/calendar.ts`; notification routes in `routes/user.ts`.
- Prompt Coach and Test Lab are template/heuristic today (no LLM call) — Phase 3 is a build, not a bug fix.
- CODEMAP "LEAD" items are unverified; reproduce before fixing.

## Open questions (owner)
1. Typecheck: OK to run `npm install` at the repo root (and add typescript to Frontend devDependencies) so the frontend typecheck can run?
2. test:security: which database should tests use? Is `DATABASE_URL` in server/.env the production Supabase DB? A separate test database is needed before the gate can be trusted.
3. Gemini model policy (CLAUDE.md §3): pinned `gemini-2.5-flash-native-audio-latest` vs fallback `gemini-2.0-flash-exp` — pick one policy.
4. CLAUDE.md §11 lists `devr0144@gmail.com` for the Growth upgrade — confirm the address.
5. Phase 1 branches from `main`, but CLAUDE.md and docs/ exist only on `chore/phase-0-setup` — merge that PR first (it is not pushed yet).

## Next exact step
Owner answers questions 1, 2 and 5 → then paste Phase 1 in a fresh session.
