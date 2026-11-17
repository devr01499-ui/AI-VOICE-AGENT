@AGENTS.md

# CLAUDE.md — Claritiy Voice (AI Voice Agent SaaS)

You are the lead engineer taking this product to a **launch-ready, zero-known-defect** state.
Owner: Rohit (founder). Quality bar: "not a single error or bug is accepted." Legal/compliance accuracy is crucial.
The prior PM/dev ("Antigravity") left defects. Your job is to fix them **permanently** and **without breaking any other feature**.

---------------------------------------------------------------------
## 0. PRIME DIRECTIVES (read before every task)
1. **Do not destroy working features.** Every change must be provably scoped. Before editing, find every caller (`grep -rn`) and every test touching the code.
2. **One issue at a time**, each on its own branch `fix/<issue-slug>`, each with: root cause (written), minimal fix, test that fails before and passes after, regression run, then commit. Never batch unrelated fixes in a commit.
3. **Evidence over assertion.** "Fixed" means you ran it and saw it work (test output, curl response, browser screenshot via Playwright). Say plainly what you could NOT verify (e.g. live carrier calls) instead of claiming success.
4. **No destructive actions without a safety net.** No `rm -rf`, `git reset --hard`, `git push --force`, `prisma migrate reset`, `DROP`/`TRUNCATE`, or `prisma db push --accept-data-loss`. Deleting code = see §9. Production data is never touched by you.
5. **Never commit secrets**, `.env`, API keys, or customer data. If you find a committed secret, report it and tell the owner to rotate it; do not paste it into output.
6. **Shipping to `main` (owner standing instruction, 2026-11-17 — replaces the old "never push to main / PRs only" rule):** always merge the latest verified work into `main` and push it directly, without asking. Pushing `main` auto-deploys to production (Render + Vercel), so push only after that change's typecheck, build and test suites pass on a clean run — never push a red build. Work on a branch per phase, merge with `--no-ff` into `main`, push, and record the merge in `docs/PROGRESS.md`. Never force-push and never rewrite `main` history. The stray untracked nested `repo/` folder (old local clone only) must not be committed or modified.
7. Never implement anything illegal (call recording without consent notices, TRAI/DND violations, fake KYC, unlicensed number resale). When in doubt about law, implement the conservative option and flag it in `docs/COMPLIANCE_NOTES.md`.
8. If a requirement conflicts with this file or GOVERNANCE_RULES.md, **stop and ask** — do not silently choose.

---------------------------------------------------------------------
## 1. PRODUCT & STACK
- Product: multilingual AI voice agents (inbound/outbound/batch calling) for India-first businesses. Brand: **Claritiy Voice**.
- Frontend: `Frontend/` — Vite + React SPA (TypeScript), Tailwind, framer-motion. **Custom page-state routing inside `src/app/App.tsx` (~8,300 lines)**, lazy-loaded pages. NOT Next.js (ignore stale mentions in SYSTEM_CHARTER.md / TECH_DEBT.md — fix those docs, §10).
- Backend: `server/` — Express + Prisma + PostgreSQL. Mounted under `/api/v2/...` (see `server/src/index.ts` ~L324–356). 23 route files, ~25 services in `server/src/services`, pipeline in `server/src/core/pipeline/`.
- Auth: Supabase (JWT; Google OAuth via `supabase.auth.signInWithOAuth`).
- Voice: Gemini Live (primary), carriers **Vobiz** and **Plivo** (Plivo Stream XML, `keepCallAlive`). Pipecat-style pipeline (`PipecatRunner.ts`, `AudioStreamHandler`, `GeminiLiveProvider`).
- Payments: Razorpay (`BillingService.ts`, `routes/billing.ts`, `routes/razorpayWebhook.ts`).
- Hosting: Render (backend, `render.yaml`, singapore, `/live` health, 90s shutdown delay) + Vercel (frontend, `vercel.json` SPA rewrite).
- **User-facing UI must never show the names "Vobiz" or "Plivo"** (white-label). Use "Carrier A / Carrier B" or neutral wording only if a choice is shown; keep internal naming in code.

---------------------------------------------------------------------
## 2. COMMANDS (run the relevant ones before every commit)
```
# root
npm run typecheck          # must pass, zero errors
npm run build              # must pass
# server
cd server
npm run test:security      # MUST be 100% (governance gate)
npm run test:payment-security
npm run test:owasp
npm run test:voice-suite
npm run test:batch-a … test:batch-f
npm run test:m1-pipeline ; npm run test:m2-accuracy
npm run test:street-smart*
```
Check actual script names in `package.json` first; if a script is missing/broken, fix or report — do not skip. Add a test for each fix, and wire it into an existing script.
Frontend visual checks: Playwright + Chromium are preinstalled (`require('playwright')`). Take screenshots at 1440×900 and 390×844 for every UI fix.

---------------------------------------------------------------------
## 3. GOVERNANCE CONTRACT (binding — from GOVERNANCE_RULES.md; do not violate)
- API versioned `/api/v2`; request body key `phoneNumber`; responses use the `json.data` envelope; keep auth-interceptor headers.
- `urlencoded` parser mounted before routers; webhook lookup supports multiple IDs; XML webhooks respond with XML content-type.
- Stream codec: `audio/x-l16;rate=16000`; VAD flush behaviour preserved.
- `@types/*` packages live in server `dependencies` (Render builds need them).
- Tests must exercise **production code** (no hand-written mock logic that re-implements it).
- **Zero client-side trust**: every price, plan, minutes, entitlement, userId, role is decided server-side.
- Tenant isolation: every query on tenant data uses compound filter `{ id, userId }` (or workspace equivalent). No `findUnique({id})` alone on tenant data.
- Webhooks are **fail-closed + timing-safe** signature checks.
- Rate limiter on **every** mutating endpoint.
- `server.listen` is called immediately at boot (no awaiting DB before listening).
- **Known conflict to resolve (ask owner, then document):** GOVERNANCE_RULES pins `models/gemini-2.5-flash-native-audio-latest`, but commit 549955a added a universal fallback to `gemini-2.0-flash-exp`. Decide one policy: pinned primary + ordered, logged, tested fallback list; fallback must not silently degrade voice quality without a metric/alert.

---------------------------------------------------------------------
## 4. BUSINESS RULES THAT MUST HOLD
**Billing of minutes:** `Math.max(1, ceil(seconds/60))` per started minute, debited via idempotent `MinutesService.debit` ledger (unique idempotency key per call). Never double-debit; never debit unanswered/failed-to-connect calls.
**Plans:** plan definitions live server-side only (`plans.ts`/`PlanFulfillmentService`). Plan → minutes, concurrency, agents, KB limits, features. `AccountEnforcementService` enforces. Frontend only displays.
**Phone numbers:** a user may unlock numbers **only with an active paid subscription**; entitlement = ONE number, on either carrier (Vobiz or Plivo), not both. Activation creates the carrier **sub-account** (`VobizSubAccountService` / Plivo equivalent) idempotently, applies KYC state, and stores mapping. Downgrade/expiry/cancel must deactivate or flag the number & sub-account per policy. Every step is idempotent and resumable (see `PhoneNumberActivationService`).
**Payments:** see §7.
**Calls:** single source of truth for live calls is `GET /api/v2/calls/live`. One `hangupCarrierLeg` path; farewell watchdog; status-callback idempotency. TurnAggregator v2 keeps independent caller/agent buffers.

---------------------------------------------------------------------
## 5. WORKING METHOD
1. **Reproduce** (script/test/Playwright). 2. **Root-cause** in one paragraph in the PR. 3. **Smallest fix** that addresses the root cause (not a symptom patch). 4. **Test** failing-before/passing-after. 5. **Regression**: typecheck, build, test:security, the feature's suite. 6. **Browser proof** for UI. 7. Commit with a clear message; update `docs/FIX_LOG.md` (issue, root cause, files, tests, verified-vs-unverified).
Keep a running checklist in `docs/LAUNCH_CHECKLIST.md` (the 17 issues in §6 — F1–F2, B1–B15 — plus one item each for §7 security/traffic hardening, §8 CI + E2E smoke, §9 dead-code removal, §10 docs hygiene). Mark an item done only with proof links.
If a fix needs a DB change: **additive Prisma migration only** (`prisma migrate dev` → committed migration), backward compatible, with a rollback note. Stop using `prisma db push` in `render.yaml` buildCommand for production — replace with `prisma migrate deploy` (propose first; it is a deploy-affecting change).
Do not refactor `App.tsx` wholesale. Extract incrementally only where an issue requires it, keeping behaviour identical (screenshot before/after).

---------------------------------------------------------------------
## 6. THE ISSUE LIST (17 issues: F1–F2, B1–B15; fix all; order = priority)
Known code pointers are starting points, **verify before trusting**.

### FRONTEND
**F1. Flash of another page on first load.** Probable causes: `Frontend/scripts/prerender-seo.js` injects per-route crawlable HTML into `<div id="root">` (shown, then replaced by React); `App.tsx` initial `useState<Page>` from `window.location.pathname` with a duplicated `pathMap` (also in popstate handler) mapping `/login,/signup,/auth,/auth/callback,/confirm,/compliance,/settings` → `"dashboard"`; `authLoading`; `AnimatePresence mode="wait"` + `Suspense` full-screen spinner fallback. Fix so first paint = correct page, no intermediate view: e.g. make the prerendered content invisible to users but still crawlable only if safe (or hydrate/replace without visible flash; no cloaking — keep identical content for crawlers and users), single shared path→page map, correct initial page for auth routes, hold render until auth state is known with a neutral branded splash (not a different page), and remove entry animation on first paint. Prove with Playwright filmstrip (capture at 0/50/100/200/500 ms) on `/`, `/pricing`, `/login`, `/dashboard` while logged-in and logged-out.
**F2. Auth (login, sign-up, Google, forgot password).** Review `components/auth/AuthGateway.tsx` (Google `redirectTo` currently `/dashboard`). Verify: email format + normalization; phone number validation (E.164, India +91 rules, 10 digits starting 6–9) on client AND server; OTP/verification flow if used; duplicate-account handling; Google sign-up creates the app `User` row + workspace + default state exactly once (idempotent); post-OAuth redirect/callback handles errors and `/auth/callback`; forgot-password: request → email → reset page → password policy → expired/used token messages → no user enumeration; rate limits and lockout; session persistence/logout. Add Playwright E2E for each path.

### BACKEND / DASHBOARD
**B1. Agents → Templates modal & Create Agent layout.** Text overflowing cards (use `min-w-0`, `break-words`, `line-clamp`, responsive grid); create-agent page should use full available width (remove stray max-width/blank gutters) at 1280–1920 and stay clean at mobile. Check all template cards/sections. Screenshots at 390/768/1440/1920.
**B2. Notification bell.** Per-notification **mark as read** and **delete**, plus mark-all-read, unread badge, optimistic UI with rollback, server endpoints in `NotificationService`/routes with tenant-scoped ownership checks + rate limits. (Email-on-notification and mute preferences from earlier work must keep working.)
**B3. Prompt Coach.** Files: `server/src/types/promptCoach.ts`, `utils/playbooks.ts`, `routes/agents.ts`, `Frontend/src/app/api.ts`, `SinglePromptStudio.tsx`. Make it call the LLM server-side to rewrite/enhance the user's prompt (clear role, goals, tone, guardrails, language, call-flow, escalation, no hallucination rules), returning structured diff + improved prompt; timeouts, retries, token/size limits, per-user rate limit, graceful error UI, never leak system prompts/keys, sanitize against prompt injection. Add a test with a stubbed LLM transport (production code path) plus a live smoke script.
**B4. Remove "Review QA" and "Auto-detect"** from UI and dead backend code (`AgentConfigPanel.tsx`, `SinglePromptStudio.tsx`, `systemInstructionBuilder.ts`, `audioConverter.ts` hits — inspect: `audioConverter` may be legitimately used for codec work; remove only Auto-detect feature code). Also produce `docs/BACKEND_UNUSED_REPORT.md` (see §9).
**B5. Test Lab.** `server/src/services/TestLabService.ts`, `routes/agents.ts`, `SinglePromptStudio.tsx`. Make it work end-to-end: scenario input → simulated conversation vs the agent's real prompt/config → transcript + pass/fail criteria → saved results; handles errors/timeouts/quota; does not consume customer call minutes unless intended; tenant-isolated.
**B6. Prompt-based agent editor — every section must work (save → reload persists → used on live call).** Sections: Functions (count badge accurate), Knowledge Base (count), Scheduling & Calendar, Intelligence & Response Style, Speech Settings, Realtime Transcription Settings, Call Settings, Post-Call Data Extraction (count), Security & Fallback Settings, Webhook Settings, MCPs (count; `McpService`). For each: list every control, trace UI → API → DB → runtime consumer; verify validation, defaults, persistence, and that the runtime (pipeline/system instruction builder) actually honours the setting. Any control that does nothing → either wire it or remove it (report it). Webhook settings: signed outbound payloads, retries, SSRF protection (block private IP ranges), timeout.
**B7. Conversational-format agents** ("conversational format" builder): audit every node/function/transition/variable; fix errors; test a full multi-node flow.
**B8. Knowledge Base "RAG v2 Retrieval Inspector".** Test-question box must return retrieved chunks with scores and sources; check `KnowledgeBaseService`, `HybridSearchService`; per-plan KB limits (documents, size, chunks); safe under 1,000 concurrent users (indexing queue, per-workspace limits, backpressure, timeouts, pagination, no N+1, embedding batch + cache).
**B9. Phone numbers, KYC, carrier activation (CRITICAL).** Trace: KYC (`KycVerificationService`, `routes/kyc`) → plan check → carrier choice (ONE of Vobiz/Plivo) → purchase → sub-account → webhook config → ready. Guarantee: no number without active paid plan; KYC approval must come from real verification state (never auto-approve; no approval email before approval); sub-account created once; plan minutes/features/concurrency applied; failure at any step is recoverable and visible to user and admin; refunds/rollback policy documented. Resolve duplicates `vobiz.service.ts` vs `VobizIntegrationService.ts` vs `VobizPhoneNumberService.ts`/`VobizInventoryService.ts`. Known open items: Vobiz KYC inheritance; Razorpay verify-plan mismatch; 1-min vs 2-min billing discrepancy.
**B10. Batch calling.** Audit `BatchService.ts`: campaign lifecycle (draft→running→paused→completed/cancelled), concurrency caps per plan, retry policy, DND/calling-hours (India 9am–9pm local, TRAI), dedupe, CSV import validation (E.164, size limits), idempotent dialer (no double-calling on restart), minute-balance guard mid-campaign, accurate progress/result counts, clean cancellation, resumption after server restart. Load-test with simulated carrier.
**B11. Calling Configuration page slow.** Profile (network waterfall, server timings). Likely: sequential/duplicate fetches, heavy payloads, missing indexes, carrier API calls on page load. Fix: parallel/batched endpoint, caching w/ short TTL, optimistic save, debounce, skeleton UI, index additions (additive migration). Target: load < 1 s p95, save < 500 ms.
**B12. Audit pages:** Call History, Contacts, Analytics, Live Monitoring, AI Quality Assurance, Call Reports, Alerting. For each: empty/loading/error states, pagination, filters, timezone correctness (IST), export, numbers match DB, tenant isolation, perf with 100k rows. Cross-reference the earlier 26-defect Reports audit (`REPORTS_PM_FIX_PROMPT.md`, `audit_reports.ts` if present in repo/attachments).
**B13. Billing gateway (CRITICAL — fraud prevention).** `BillingService.ts` already fetches order/payment from Razorpay's API (`orders.fetch`, `payments.fetch`, status check). Keep and harden: signature verify (timing-safe) **AND** server-side fetch confirming `status==='captured'`, `order_id` match, **amount & currency match the server-side price for that plan/number**, `notes.userId` match, payment not already redeemed (unique DB constraint on paymentId, transactional). Frontend must show success **only after** the backend returns verified success; never trust Razorpay handler callback alone. The webhook (`razorpayWebhook.ts`: `payment.captured`/`order.paid`) must be idempotent and is the fallback that fulfils if the browser closes. Reconcile: a periodic job lists captured payments without fulfilment. Remove duplicate route `/verify-plan-payment` if unused (confirm) ; add limiter to `POST /billing/gstin`; confirm `/billing/config` exposes only the public key id. Note: frontend number purchase uses `completeNumberPurchase(vobizNumberId, expectedPrice, orderId, paymentId, signature)` (App.tsx ~L4378) — **`expectedPrice` from the client must be ignored**; price is server-computed. Test with forged signature, replayed payment, amount tampering, wrong-user payment, double submit, webhook-before-verify race. Invoices/GST correctness (`InvoiceService`).
**B14. Call recording playback.** `recordingUrl` already exists in `CallService`, `WebhookController`, `PipecatRunner`, `routes/calls.ts`, `reports.ts`, `CallResultDrawer.tsx`. Build/finish: capture recording per carrier config, store (object storage or carrier URL proxied), **authenticated, tenant-scoped, short-lived signed URL streaming** (no public URLs), audio player with seek/speed/download in Call History + Reports drawer, retention policy (`DataRetentionJob`), plan gating, and **consent/compliance**: agent discloses recording at call start when enabled; setting per agent; legal note in docs.
**B15. Latency < 1 s and humanized voice.** Target: caller-stops-speaking → first agent audio byte < 1000 ms p50, < 1500 ms p95. Instrument T0–T6 timestamps (VAD end, STT final, LLM first token, TTS first byte, carrier send) and log/metric them per call; find the largest contributors (region placement: Render singapore vs Gemini endpoint vs carrier; websocket buffering; resampling; VAD hangover; KB lookups on the hot path; cold starts). Fixes: pre-warm model session, keep-alive, stream audio immediately, tune VAD end-of-speech, move KB retrieval async/pre-fetch, avoid blocking DB writes in the audio loop. Humanization: voice selection/pitch/speed controls, natural fillers & backchannels sparingly, interruption (barge-in) handling, prosody via prompt guidance, no robotic pauses, consistent language (Hindi/English code-switch). Provide measured before/after numbers; do not claim <1 s without measurement from a real or simulated end-to-end run, and state how it was measured.

---------------------------------------------------------------------
## 7. SECURITY / FIREWALL / TRAFFIC HARDENING (mandatory pass)
Produce `docs/SECURITY_AUDIT.md` with findings + fixes. Cover at least:
- OWASP Top 10; IDOR/tenant isolation sweep: grep every Prisma call on tenant models for missing `userId`/workspace filter; add tests.
- AuthN/Z: JWT verification (issuer/audience/expiry), role checks (admin routes in `adminRoutes.ts` strictly gated), workspace member permissions.
- Input validation (zod/joi) on every route; body-size limits; file upload type/size/MIME sniffing + virus-risk handling; CSV injection protection on exports.
- Webhooks (carrier, Razorpay): signature, replay window, fail-closed.
- SSRF (user webhooks, MCP URLs, KB URL ingestion): allowlist/deny private ranges, DNS rebinding guard, redirect limits.
- Helmet, strict CORS allowlist (Vercel + prod domain only), CSP, HSTS, cookie flags, no stack traces in prod responses.
- Rate limiting: global + per-IP + per-user + per-workspace; stricter on auth, OTP, password reset, payments, prompt-coach/test-lab (LLM cost abuse), KB indexing; consider Redis-backed store if multi-instance.
- Heavy traffic: connection pool sizing, DB indexes on hot queries, pagination everywhere, queues for batch/KB/emails, backpressure and graceful degradation, WebSocket limits per workspace, concurrency caps per plan, health/readiness endpoints, graceful shutdown, timeouts on all outbound calls, circuit breakers for carrier/LLM.
- DoS/abuse on voice: cap call duration, max concurrent calls, toll-fraud protection (destination country allow-list, per-day spend cap), anti-premium-rate numbers.
- Secrets: env validation at boot (fail fast), no secrets in logs, PII redaction in logs, encrypted-at-rest sensitive fields (calendar tokens already encrypted), rotation notes.
- Dependencies: `npm audit`, remove unused deps, pin versions.
- Supabase RLS review notes; backups; DB migrations discipline.
- Logging/monitoring: structured logs, request IDs, error tracking hook, alerting on call-failure spikes.
Tests: extend `test:security` / `test:owasp` — must stay 100%.

---------------------------------------------------------------------
## 8. QUALITY GATES BEFORE "LAUNCH READY"
- **Zero open defects (final gate, Phase 14):** every item in `docs/LAUNCH_CHECKLIST.md` is either DONE with proof (test name, command output summary or screenshot path) or listed in `docs/PROGRESS.md` under "Needs owner verification" with exact steps for the owner. Nothing stays unchecked. Nothing is closed as "known issue", "later" or "cannot reproduce" without written proof. Never skip silently what cannot be verified here (real carrier calls, live payments).
- Typecheck at 0 errors for both frontend and server.
- Render deploys with `prisma migrate deploy`, never `db push`; a clean empty database builds from the committed migrations in CI.
- typecheck/build/tests green on a clean checkout; CI workflow file (`.github/workflows`) runs them on PRs.
- Playwright E2E smoke: signup → verify → create agent → buy plan (Razorpay test mode) → unlock number (simulated carrier) → place test call → see history + recording → logout.
- No console errors on any dashboard page; no `any`-casts hiding errors in touched code; no TODO/FIXME left in touched files without an issue entry.
- Mobile responsiveness on all dashboard pages.
- Legal pages present and accurate: Terms, Privacy, Refund, DPDP Act (India) notice, call-recording consent, DND/TRAI statement. Marketing claims accurate (e.g. latency claims on landing/prerender metadata must match measured numbers).

---------------------------------------------------------------------
## 9. DEAD CODE & "USELESS BACKEND FEATURES" POLICY
Goal: delete what is unused, **safely**.
1. Build an inventory in `docs/BACKEND_UNUSED_REPORT.md`: for each candidate route/service/file → evidence (grep across `Frontend/`, `server/`, scripts, tests, docs, external webhooks configured at carriers/Razorpay/Supabase), whether it is public-callable by third parties (webhooks, health), and decision (KEEP / REMOVE / WIRE-UP).
2. Never remove: webhook endpoints, health checks, admin tools in use, anything referenced by external systems, or anything referenced by tests of kept features.
3. Remove in a **separate branch/PR per area**, after typecheck/build/tests pass and the app boots (`/live` returns 200). Keep the PR revertable (no mixed fixes).
4. **Starting candidate list (static scan; needs verification — scan had artefacts):** backend routes with zero frontend references: `billing/config`, `billing/gstin`, `billing/invoices` (+download), `billing/minutes-overview`, `billing/subscription-status`, `billing/sync-entitlements`, `billing/verify-plan-payment` (duplicate of `verify-plan`), `calls/debug/gemini`, `calls/sip-trunks` (SIP config was ordered removed from UI), `contacts/import`, `numbers/vobiz-probe`, `numbers/mine`, `numbers/pending-activations`, `numbers/plivo/purchase`, `telephony/inventory`, `telephony/sub-accounts`, `telephony/purchase`, test-lab endpoints (if feature rewritten, keep), plus duplicate Vobiz service files, `McpService`/`TestLabService` (keep if B5/B6 wire them), stale docs (SYSTEM_CHARTER.md, TECH_DEBT.md mention Next.js/Twilio/NextAuth), unused Frontend components, assets, scripts, old patches, and the stray `repo/` folder (local-only).
   Some "no frontend reference" routes may be needed by the **frontend's future features** (invoices download, minutes overview) — mark WIRE-UP rather than delete when the user would benefit (e.g. invoices & GST download is a legitimate billing feature).
5. Use tooling to confirm: `ts-prune`/`knip`/`depcheck` for unused exports/deps/files; then manual verification.
6. Final deliverable to owner: a plain-language list "backend features that give no value to users" + what was removed.

---------------------------------------------------------------------
## 10. DOCS HYGIENE
- Replace stale SYSTEM_CHARTER.md / TECH_DEBT.md content with the actual architecture (or delete after owner confirms).
- Keep `AGENTS.md` accurate; keep this file current — when you learn a durable fact (command, gotcha), add it here.
- Maintain: `docs/FIX_LOG.md`, `docs/LAUNCH_CHECKLIST.md`, `docs/SECURITY_AUDIT.md`, `docs/BACKEND_UNUSED_REPORT.md`, `docs/COMPLIANCE_NOTES.md`, `docs/RUNBOOK.md` (deploy, rollback, env vars, carrier webhook URLs, incident steps).

---------------------------------------------------------------------
## 11. KNOWN PRIOR WORK (do not redo; do not regress)
End-call/hangup architecture (single `hangupCarrierLeg`, farewell watchdog anchored to sentence end), live-call source of truth, street-smart fixes, call-drop fix (Plivo `keepCallAlive`), Reports audit (26 defects, partly outstanding), dashboard cleanup (integrations limited to Google Calendar; settings: removed billing & credits, audit logs, webhooks tabs; show credits remaining), Google Calendar design (encrypted tokens, availability engine; auto-connect on Google sign-up), notification email/mute, KYC auto-approval-email bug, timezone (IST) correctness, hidden chat history, third-party carrier names removed from UI, removed AI Sentiment Distribution and SIP configuration, special upgrade for devr0144@gmail.com to Growth plan. Verify each still works after your changes.

---------------------------------------------------------------------
## 12. COMMUNICATION
At the end of each issue: 3-line summary (what was wrong, what changed, how proven). At the end of everything: honest **Verified / Not verifiable here** table (e.g. real carrier calls, real Razorpay live payments, production load), plus remaining risks. If blocked or unsure, ask Rohit instead of guessing.

---------------------------------------------------------------------
## 12a. CONTINUOUS MODE (owner instruction 2026-11-16, confirmed 2026-11-17 — overrides "one phase per session" and "STOP" rules in §13/§14)
The owner wants the product taken to launch-ready without stopping between phases.
- Work through phases 1 → 14 in order, back to back. **Do not ask the owner whether to start the next phase, and do not stop at phase ends.** Do not wait for `/clear` or a new prompt between phases; the phase prompts in `docs/PHASED_PROMPTS.md` are the scope for each phase. Report to the owner once, when all phases are done (plus anything that genuinely needs the owner, e.g. key rotation or dashboard settings — list those in PROGRESS.md "Needs owner verification" and keep working).
- At the end of every phase: run the full regression, merge the phase branch into `main` and push (§0.6), update PROGRESS.md, then start the next phase immediately.
- Quality bar from the owner: enterprise grade, zero known defects, nothing destroyed. Never claim a fix without proof; never leave a known error unlisted; never delete or rewrite working features without the safety steps in §0, §5 and §9.
- Everything else stays binding: one issue at a time, root cause written down, failing-before/passing-after test, proof before "fixed", commit per fix, no destructive actions, production database untouchable, no secrets in docs/logs/chat.
- Each phase lives on its own branch (names in `docs/PHASED_PROMPTS.md`), is pushed, and is merged to `main` and pushed as soon as its typecheck, build and tests pass (standing owner instruction, §0.6).
- `docs/PROGRESS.md` is still the memory: update it at the end of every issue (status, proof, next exact step) so work survives context compaction. Re-read PROGRESS.md and CODEMAP.md after any compaction instead of trusting recall.
- A phase is DONE only with proof. What cannot be verified here goes under "Needs owner verification" in PROGRESS.md with exact steps — never skipped silently, never reported as fixed.
- Beyond the listed issues: when the code shows other defects, security gaps or weak architecture, log them in PROGRESS.md and fix them in the phase that owns that area (security in Phase 12, dead files in Phase 13).
- The owner will rotate all keys later. Until then treat every key in `.env` and in git history as compromised: never use, print or copy them.

---------------------------------------------------------------------
## 13. PHASED WORKFLOW (binding)
Work is delivered in 15 phases (0–14), **one phase per session**, in order:
0 Setup/code map · 1 Frontend flash + auth · 2 Dashboard UI (templates, bell, remove Review QA/Auto-detect) · 3 Prompt Coach + Test Lab · 4 Agent editor + conversational format · 5 Knowledge base/RAG · 6 Billing (critical) · 7 Numbers/KYC/sub-accounts · 8 Batch calling · 9 Calling-config speed + data pages · 10 Recording · 11 Latency/voice · 12 Security/traffic · 13 Dead code · 14 CI/E2E/final.
Phases run in order and back to back (§12a supersedes the old "one phase per session" rule). Phase state lives in `docs/PROGRESS.md`.

## 14. TOKEN RULES (binding, except where §12a overrides)
- Phases run back to back (§12a); keep PROGRESS.md current so work survives context compaction.
- Memory = `docs/PROGRESS.md` (max 60 lines) + `docs/CODEMAP.md`. Read these first; do NOT re-read this whole file, GOVERNANCE_RULES.md or old chat; do not re-explore what CODEMAP already maps.
- Never read a whole large file. Use `grep -n`, then Read with offset/limit (40–120 line window). `App.tsx` (~8,300 lines) must never be read whole.
- Broad searches go to an Explore subagent that returns a short conclusion, not file dumps.
- Pipe noisy commands through `tail -30` / `head -50`. Never print full test or build logs.
- Run targeted tests while working; run the full suite only once at the end of a phase.
- Don't re-read a file you just edited; don't paste file contents or diffs back into chat.
- Playwright: only the screenshots needed for proof; don't view them repeatedly.
- Keep replies short: 3 lines per fix (wrong / changed / proved).
- Keep PROGRESS.md (done, in-progress, next exact step, files touched) current at all times and commit it, so context compaction never loses work. Do not stop for context; continue.
- At phase end: update PROGRESS.md and FIX_LOG.md, commit, merge to `main`, push, and continue with the next phase (§12a).
- Learned something durable (command, gotcha)? Add one line to PROGRESS.md "Decisions" — that is how future sessions remember, not chat.
