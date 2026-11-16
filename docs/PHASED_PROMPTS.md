# PHASED PROMPTS — Claritiy Voice (use one phase per fresh Claude Code session)

## How to use (important, saves tokens)
1. Append the block "TOKEN RULES" (bottom of this file) to the end of the repo's `CLAUDE.md` once.
2. Run **one phase per session**. When a phase says DONE, type `/clear` (or start a new session) and paste the next phase. Never continue two phases in one long session.
3. Each phase reads only `docs/PROGRESS.md` (the single memory file) — nothing is "recalled" from chat history.
4. Do not skip phases or reorder 0 → 14 (later phases depend on earlier ones).

Every phase prompt starts with the same 4-line header, already included below.

---

## PHASE 0 — Setup, baseline, code map (read-only mapping; no feature changes)
```
Read CLAUDE.md "TOKEN RULES" first. This is Phase 0 of 14.
Goal: set up the working system, change NO product code.
1. Create docs/PROGRESS.md (max 60 lines: table of phases 0-14 with status, plus "Decisions" and "Open questions" sections), docs/FIX_LOG.md, docs/LAUNCH_CHECKLIST.md (the checklist items built from CLAUDE.md §6–§10: the 17 issues F1–F2 and B1–B15, plus one item each for §7, §8, §9 and §10; each unchecked).
2. Run baseline once: npm run typecheck, npm run build, server test:security. Record only pass/fail + failing test names in PROGRESS.md (pipe output through tail -30).
3. Create docs/CODEMAP.md (max 120 lines): for each of the 17 issues, list the exact files + line ranges that own it (use grep/Explore subagent, do NOT read whole files; App.tsx is 8,300 lines, never read it fully). This map is what later phases use instead of re-searching.
4. List environment variables the app needs (names only) in docs/RUNBOOK.md.
Stop. Mark Phase 0 DONE in PROGRESS.md. Tell me to /clear.
```

## PHASE 1 — Frontend: first-load flash + login/sign-up (F1, F2)
```
Header: read CLAUDE.md TOKEN RULES, then docs/PROGRESS.md and docs/CODEMAP.md only. Phase 1 of 14. Branch fix/frontend-first-load-auth.
Scope: Issue F1 (another page flashes before home) and F2 (login, sign-up form + Google, phone/email validation, forgot-password).
Follow CLAUDE.md section 6 F1/F2. Prove F1 with a Playwright filmstrip (0/50/100/200/500 ms) on /, /pricing, /login, /dashboard. Add E2E tests for each auth path. Do not touch anything outside this scope.
When done: targeted tests + typecheck + build, update FIX_LOG/PROGRESS/CHECKLIST, commit, STOP.
```

## PHASE 2 — Dashboard UI: templates/create-agent layout, notification bell, remove Review QA & Auto-detect (B1, B2, B4)
```
Header as above. Phase 2 of 14. Branch fix/dashboard-ui-1.
Scope: B1 (template text overflow, create-agent full width), B2 (bell: mark read, delete, mark-all-read, server-side tenant-safe), B4 (remove Review QA + Auto-detect from UI and its dead backend; do not remove shared utilities used elsewhere - verify with grep).
Screenshots at 390 and 1440 px only. STOP when done.
```

## PHASE 3 — Prompt Coach and Test Lab (B3, B5)
```
Header as above. Phase 3 of 14. Branch fix/prompt-coach-testlab.
Scope: B3 Prompt Coach (LLM-powered prompt enhancement, server-side, timeouts, rate limit, injection-safe) and B5 Test Lab (works end to end).
Use a stubbed LLM transport for tests plus one live smoke script (do not run the live script more than twice). STOP when done.
```

## PHASE 4 — Prompt-based agent editor sections + conversational format (B6, B7)
```
Header as above. Phase 4 of 14. Branch fix/agent-editor.
Scope: every section of the prompt-based agent editor (Functions, Knowledge Base, Scheduling & Calendar, Intelligence & Response Style, Speech, Realtime Transcription, Call Settings, Post-Call Extraction, Security & Fallback, Webhook Settings, MCPs) and the conversational-format builder.
Method: build a table in docs/AGENT_EDITOR_AUDIT.md: control -> API -> DB field -> runtime consumer -> status (works / broken / no-op). Fix or remove no-ops. Work section by section; commit per section.
If context passes ~60%, write progress (which sections are done) into PROGRESS.md and STOP; I will resume in a new session.
```

## PHASE 5 — Knowledge base: RAG Retrieval Inspector + limits (B8)
```
Header as above. Phase 5 of 14. Branch fix/kb-rag.
Scope: Retrieval Inspector test question, per-plan KB limits, safety for 1,000 concurrent users (queue, backpressure, pagination, timeouts). STOP when done.
```

## PHASE 6 — Billing & payment verification (CRITICAL) (B13)
```
Header as above. Phase 6 of 14. Branch fix/billing-security.
Scope: CLAUDE.md B13. BillingService already fetches order/payment from Razorpay; audit and harden: amount/currency/user/order match, captured status, replay (unique paymentId, transaction), ignore client price (expectedPrice), idempotent webhook as fallback, reconciliation job, rate-limit /billing/gstin, remove duplicate verify route only after proving it is unused. Frontend shows success only after backend-verified success.
Write tests for: forged signature, replay, amount tampering, wrong user, double submit, webhook-before-verify race. STOP when done.
```

## PHASE 7 — Phone numbers, KYC, carrier activation, sub-accounts (B9)
```
Header as above. Phase 7 of 14. Branch fix/numbers-kyc.
Scope: CLAUDE.md B9. Numbers only with active paid plan; ONE number on either carrier; sub-account created once; plan features/minutes applied; no auto-approval/no premature approval email; resolve duplicate Vobiz service files (keep one, migrate callers, prove with typecheck). Carrier calls cannot be tested live - use a simulated carrier and say so. STOP when done.
```

## PHASE 8 — Batch calling (B10)
```
Header as above. Phase 8 of 14. Branch fix/batch-calling.
Scope: CLAUDE.md B10 lifecycle, concurrency, retries, DND/calling hours, dedupe, restart-safety, balance guard, accurate counts. Use existing test:batch-a..f; add missing ones. STOP when done.
```

## PHASE 9 — Calling Configuration speed + audit of data pages (B11, B12)
```
Header as above. Phase 9 of 14. Branch fix/perf-and-audit-pages.
Scope: B11 Calling Configuration load/save speed (profile first, report numbers), B12 Call History, Contacts, Analytics, Live Monitoring, AI QA, Call Reports, Alerting. One page at a time; commit per page. If context passes ~60%, save progress and STOP.
```

## PHASE 10 — Call recording playback (B14)
```
Header as above. Phase 10 of 14. Branch feat/call-recording.
Scope: CLAUDE.md B14. recordingUrl already exists in several files - extend, do not duplicate. Secure signed URLs, tenant-scoped, player in Call History + Reports drawer, retention, plan gating, consent disclosure. STOP when done.
```

## PHASE 11 — Latency below 1 s and humanized voice (B15)
```
Header as above. Phase 11 of 14. Branch perf/voice-latency.
Scope: CLAUDE.md B15. First instrument per-stage timings and log them; measure; fix the top bottlenecks one at a time, re-measuring each. Report before/after numbers and how measured. Do not claim <1 s without measurement. STOP when done.
```

## PHASE 12 — Security, firewall, heavy-traffic hardening (whole codebase)
```
Header as above. Phase 12 of 14. Branch hardening/security.
Scope: CLAUDE.md section 7. Write docs/SECURITY_AUDIT.md as a table (finding, severity, file, status). Fix critical/high first, small PRs. Keep test:security and test:owasp at 100%. If context passes ~60%, save progress and STOP (this phase may take 2 sessions).
```

## PHASE 13 — Dead code and unused backend features
```
Header as above. Phase 13 of 14. Branch cleanup/dead-code (revertable, no mixed fixes).
Scope: CLAUDE.md section 9. Run knip/ts-prune/depcheck, verify candidates by grep, write docs/BACKEND_UNUSED_REPORT.md with KEEP/REMOVE/WIRE-UP per item, then remove only the REMOVE items. Also fix stale SYSTEM_CHARTER.md/TECH_DEBT.md. Typecheck, build, full tests, and /live boot check before commit. STOP.
```

## PHASE 14 — CI, end-to-end smoke test, final verification
```
Header as above. Phase 14 of 14. Branch ci/final-verification.
Scope: add .github/workflows CI (typecheck, build, tests); Playwright smoke: signup -> create agent -> buy plan (Razorpay test mode) -> unlock number (simulated) -> test call -> history + recording. Re-run full tests once. Update LAUNCH_CHECKLIST with proof links and write a final Verified / Could-not-verify table and remaining risks. STOP.
```

---

## TOKEN RULES — append this block to the END of the repo's CLAUDE.md
```
## TOKEN RULES (binding)
- One phase per session. Never start the next phase in the same session.
- Memory = docs/PROGRESS.md (max 60 lines) + docs/CODEMAP.md. Read these first; do NOT re-read CLAUDE.md, GOVERNANCE_RULES.md or old chat; do not re-explore what CODEMAP already maps.
- Never read a whole large file. Use grep -n, then Read with offset/limit (a 40-120 line window). App.tsx (~8,300 lines) must never be read whole.
- Broad searches go to an Explore subagent that returns a short conclusion, not file dumps.
- Pipe noisy commands through tail -30 / head -50. Never print full test or build logs.
- Run targeted tests while working; run the full suite only once at the end of a phase.
- Don't re-read a file you just edited; don't paste file contents or diffs back into chat.
- Playwright: only the screenshots needed for proof; don't view them repeatedly.
- Keep replies short: 3 lines per fix (wrong / changed / proved).
- At ~60% context: update PROGRESS.md (done, in-progress, next exact step, files touched), commit, and STOP so I can resume in a fresh session.
- At phase end: update PROGRESS.md and FIX_LOG.md, commit, then say "PHASE N DONE - /clear and paste next phase".
- Learned something durable (command, gotcha)? Add one line to PROGRESS.md "Decisions" - that is how future sessions remember, not chat.
```
