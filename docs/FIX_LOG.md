# Fix Log — Claritiy Voice

One entry per fix, newest at the bottom. Template:

```
## <issue id> — <short title> (Phase N, branch <name>, commit <sha>)
- Issue: what the user saw
- Root cause: one paragraph
- Files: paths changed
- Tests: added/updated, and the script that runs them
- Verified: what was run and seen working
- Not verified here: what could not be checked (e.g. live carrier calls)
```

---

## Phase 0 — Setup (branch chore/phase-0-setup)
- No product code changed. Created docs/PROGRESS.md, CODEMAP.md, LAUNCH_CHECKLIST.md, RUNBOOK.md, PHASED_PROMPTS.md and this file.
- Baseline results are recorded in docs/PROGRESS.md.

## F1 — Another page flashed before the real page (Phase 1, branch fix/frontend-first-load-auth)
- Issue: on first load a plain white page (heading, one paragraph, a row of green links) showed for a moment, then the real page appeared. It happened on every URL, including /login and /dashboard.
- Root cause: `Frontend/scripts/prerender-seo.js` writes crawlable fallback HTML into `<div id="root">` of every built page, and Vercel serves the home copy for all app routes. That unstyled fallback was painted until the JavaScript bundle loaded and React replaced it. After React mounted there were two more intermediate states: a spinner as the Suspense fallback and a fade-in animation on the first page, and a different "Verifying Workspace Credentials" screen on dashboard routes.
- Fix: `index.html` now ships a neutral branded splash as the first child of `#root` (fixed overlay, inline CSS, hidden via `<noscript>` when JavaScript is off). The prerender script puts the crawlable content after the splash in `.cv-prerender` (same HTML for crawlers and visitors; nothing is removed or served differently). The React Suspense fallback and the auth-check screen use the identical splash (`BrandSplash.tsx`), and the first page no longer animates in (`AnimatePresence initial={false}`). The three hand-copied path maps in `App.tsx` were replaced by one module, `lib/routes.ts`.
- Files: Frontend/index.html, Frontend/scripts/prerender-seo.js, Frontend/scripts/verify-first-paint.js (new), Frontend/package.json (postbuild), Frontend/src/app/App.tsx, Frontend/src/app/lib/routes.ts (new), Frontend/src/app/components/common/BrandSplash.tsx (new), Frontend/src/app/components/auth/ProtectedRoute.tsx.
- Tests: `verify-first-paint.js` runs in every build (`postbuild`) and fails the build if any page would paint something before the splash. Passes on 108 built pages; fails (exit 1) when given the pre-fix page shape.
- Verified: Playwright filmstrip on the built site at 0/50/100/200/500/1500 ms for `/`, `/pricing`, `/login`, `/dashboard`, logged out, with bundles delayed 300 ms. Before: the unstyled fallback page was the visible content. After: only the splash is visible until the correct page appears (home hero, pricing, sign-in). Screenshots in docs/proof/F1/. Root build passes; frontend typecheck still 41 errors (no new ones).
- Not verified here: the logged-in `/dashboard` first paint (the simulated session was not accepted by the Supabase client, so that run showed the sign-in screen); real Vercel hosting; the visual result on a slow real phone.

## F2 — Sign-up, sign-in, Google and forgot/reset password (Phase 1, branch fix/frontend-first-load-auth)
- Issues found (all confirmed before fixing):
  1. Email sign-up could not work at all. The form first calls `/api/v2/user/validate-signup` and `/consent`, but the whole `/api/v2/user` API was mounted behind the login check, so a new visitor got HTTP 401 (reproduced: `401 Unauthorized: Missing authenticated session context`). The front end then signed the visitor out and showed "UNAUTHORIZED_ACCESS".
  2. Phone numbers were not validated anywhere (browser or server); any text was stored.
  3. Password reset was broken: the email link signs the visitor in, so the app opened the dashboard and never showed the "set new password" form.
  4. Expired or already-used email links showed nothing; raw internal error text was shown for other failures.
  5. Password minimum was 6 characters; emails were sent without trimming or lower-casing; the forgot-password form revealed whether an email had an account.
  6. An existing e2e test attempted a real sign-in with built-in credentials on every run.
- Fix:
  - Server: `routes/user.ts` now has a small public router for the two pre-signup routes (each keeps its rate limiter, IP throttle and honeypot) and one `mountUserRoutes()` used by `index.ts`; every other user route still requires login. New `utils/phoneValidator.ts` (Indian mobile: 10 digits starting 6–9 with optional +91/91/0; other countries: full E.164) is enforced in `validate-signup` and when the login middleware stores the contact number from sign-up data (invalid values are dropped, and a stored number is no longer overwritten with nothing).
  - Browser: same phone rule plus email-format and password policy (8+ characters, a letter and a number) before anything is sent; emails trimmed and lower-cased; reset links open the "set new password" form and then the dashboard; expired/used links explain themselves and offer a new link; forgot-password always gives the same neutral answer; friendly error messages.
  - 4 type errors fixed in `AuthGateway.tsx` and `api.ts` (frontend total 41 → 37).
- Files: server/src/routes/user.ts, server/src/index.ts, server/src/middleware/auth.ts, server/src/utils/phoneValidator.ts (new), server/scripts/test_signup_public_routes.js (new), server/package.json; Frontend/src/app/components/auth/AuthGateway.tsx, Frontend/src/app/App.tsx, Frontend/src/main.tsx, Frontend/src/app/api.ts, Frontend/src/app/lib/phone.ts (new), Frontend/src/app/lib/authRedirect.ts (new), Frontend/e2e/auth-flows.spec.ts (new), Frontend/e2e/dashboard-auth-gate.spec.ts.
- Tests: `npm run test:signup` (11 tests, now the second step of `test:security`) runs the production router, login middleware and phone validator. `Frontend/e2e/auth-flows.spec.ts` (12 browser tests, all outside requests stubbed) covers sign-up validation, the full sign-up sequence, duplicate email, wrong password, Google start, forgot password (known and unknown email), reset link, expired link, and layout at 1440 and 390 px.
- Verified: before = HTTP 401 on the pre-signup route; after = 11/11 server tests and 12/12 browser tests. Full frontend e2e 59 passed, 1 skipped, twice in a row (the live sign-in test, which now needs a supplied test account). On the local test database: test:security 19/19 + 19/19 guard + 11/11 sign-up, test:owasp 23/23, test:payment-security 16/16, test:street-smart 32/32. Root build passes. Screenshots: docs/proof/F2/.
- Not verified here (see PROGRESS.md "Needs owner verification"): a real sign-up email arriving and its link working; real Google sign-in; a real password-reset email end to end; Supabase's own password and rate-limit settings; the redirect URL allow-list in Supabase.
- Notes: `test:street-smart` has one timing check ("assembly latency < 1.0 ms") that failed once while the machine was busy building and passed three times when idle; it is load-sensitive and is logged for Phase 11. The "Account Type" choice on the sign-up form is now saved with the sign-up data but nothing on the server reads it yet (Phase 4/13 decision: use or remove).

## B1 — Agent templates: text outside the boxes, pop-up not using the screen (Phase 2, branch fix/dashboard-ui-1)
- Issue: in Agents → Create an Agent, template descriptions ran out of the bottom of their cards, the left edge of the pop-up (including its title) was hidden behind the side menu, and the pop-up left wide blank margins on large screens.
- Root cause: (1) cards had a fixed row height and no overflow rules, and the grid chose its column count from the screen width, so with the preview panel open cards shrank to about 180 px. (2) The dashboard's main content area had `z-index: 0`, which trapped every pop-up opened from a dashboard page underneath the side menu. (3) The pop-up was capped at 1152 px wide.
- Fix: grid columns now come from the space actually available (never narrower than 240 px) and rows grow to fit their text; names clamp to 2 lines and descriptions to 3 with the full text on hover; the category label truncates inside the card. The pop-up now uses up to 1760 px. The `z-index` was removed from the content area, which also fixes every other dashboard pop-up that was being covered by the side menu.
- Also fixed (found while testing): on phones the side menu opened by default and covered the whole page; it now starts closed below 768 px. The side menu showed "Rohit's Workspace" to every customer; it now shows the signed-in customer's own first name.
- Files: Frontend/src/app/App.tsx; Frontend/e2e/agent-templates-layout.spec.ts (new); Frontend/e2e/helpers/dashboard.ts (new: fake logged-in session + stubbed backend for dashboard tests).
- Tests: `e2e/agent-templates-layout.spec.ts`, 10 tests: no text outside any card at 390/768/1280/1440/1920 px, pop-up uses at least 90% of the width at 1280/1440/1920, workspace name, phone menu closed.
- Verified: before the fix the same test failed 7 of 8 (text outside cards on every size); after, 10 of 10 pass. Screenshots in docs/proof/B1/. Frontend type errors unchanged at 37.
- Checked and left alone: the agent editor page itself already uses the full screen width at 1440 and 1920 px.
- Not verified here: other dashboard pop-ups were not individually re-tested after the `z-index` change (they are covered page by page in Phases 4–10).

## B4 — Remove "Review QA" and industry "Auto-detect" (Phase 2, branch fix/dashboard-ui-1)
- Issue: owner asked for both features to be removed.
- What was there: "Review QA" was a button plus pop-up in the prompt editor (calling `POST /api/v2/agents/prompt-coach/review`) and a "QA: PASS 90/100" badge computed in the browser from a few keyword checks. "Auto-detect" was the default industry choice in both agent editors; the server guessed the industry from keywords in the prompt.
- Fix: removed the button, pop-up, badge, client function `reviewPromptWithCoach` and the server route. Removed "Auto-detect" from both industry menus; new agents start on "Other". Added the missing "Recruitment / HR" option the server already supported. The server now rejects "auto" or unknown values as new input (`normalizeIndustryInput`), keeping the stored value unchanged.
- Kept on purpose: `reviewPromptQuality` (Prompt Coach "generate" uses it); the language option "Automatic / Multilingual" (a different feature); codec detection in `audioConverter.ts`; and the server's call-time resolution for agents saved earlier with "auto", so their live calls behave exactly as before. When such an agent is opened, the editor pre-selects the industry the server was already applying, so saving it does not change behaviour. The BFSI compliance safety gate still overrides any choice.
- Files: Frontend/src/app/components/agents/SinglePromptStudio.tsx, AgentConfigPanel.tsx, Frontend/src/app/api.ts, server/src/routes/agents.ts, server/src/utils/systemInstructionBuilder.ts, server/scripts/test_agent_industry_rules.js (new), server/package.json, Frontend/e2e/agent-editor-removed-features.spec.ts (new).
- Tests: `npm run test:agent-rules` (7, part of test:security): review route gone, generate still present, "auto"/junk rejected, old "auto" agents still resolve, BFSI gate. Browser: 3 tests (no Review QA/badge/Auto-detect, industry list exact, review request never sent).
- Verified: 7/7 and 3/3 pass; server typecheck 0 errors; frontend type errors 37 → 36.

## B2 — Notification bell: per-item delete and mark read (Phase 2, branch fix/dashboard-ui-1)
- Issue: notifications could not be deleted one at a time. Found while fixing:
  1. Privacy leak: every notification with no owner was shown to every customer. The "number assignment failed" operations alert is created that way, so all customers would have seen another customer's phone number, sub-account ID, order ID and the carrier name.
  2. Company announcements (also owner-less) could never be marked read or deleted, because "read" was a single flag on a row shared by everyone.
  3. Customer-facing KYC message named the carrier ("verification with Vobiz").
  4. Action endpoints had no rate limiter, accepted any id, returned success for ids that were not the caller's, and failures were silently ignored in the UI.
  5. Founder announcement endpoint did not await the insert (always returned empty data).
  6. On phones the bell panel stuck out past the left edge, and page content showed through its corner.
- Fix:
  - Server: customers now see only their own notifications plus rows of type `ANNOUNCEMENT`; every other owner-less row is admin-console only. The provisioning alert is now `FAILED_PROVISIONING` (it appears in the admin console's provisioning alerts). New table `notification_receipts` stores read/deleted state per workspace for announcements. New `DELETE /api/v2/user/notifications/:id`; mark-read/delete return 404 for anything not the caller's; ids validated; new `notificationActionLimiter` (120 per 15 min) on every action; KYC text made carrier-neutral; announcement insert awaited and typed.
  - Database: additive migration `server/prisma/migrations/20261117120000_add_notification_receipts` (one new table, rollback = drop it). Proven offline: old schema + this SQL = new schema, zero remaining difference.
  - Browser: "Delete" on every notification, "Mark read" on unread ones; optimistic updates that roll back with a message if the server refuses; background refresh paused while an action is in flight; relative dates with full date on hover; panel pinned to the screen edges on phones; header layered above page content.
- Files: server/src/services/NotificationService.ts, server/src/routes/user.ts, server/src/middleware/rateLimiter.ts, server/src/services/VobizPhoneNumberService.ts, server/src/services/KycVerificationService.ts, server/prisma/schema.prisma, server/prisma/migrations/20261117120000_add_notification_receipts/, server/scripts/test_notifications.js (new), server/package.json; Frontend/src/app/App.tsx, Frontend/e2e/notification-bell.spec.ts (new).
- Tests: `npm run test:notifications` (16, part of test:security) on the local test database with the production service and router: isolation between workspaces, ops alerts hidden, mark read/delete/mark all/clear, per-workspace announcement state, 404s, id validation, login required, rate limit. Browser: 9 tests including rollback on failure, empty state, phone fit and no show-through.
- Verified: 16/16 and 9/9. Full regression: test:security (19 guard + 11 sign-up + 7 agent rules + 16 bell + 19 security), test:owasp 23/23, test:payment-security 16/16, test:street-smart 32/32, root build, 81 browser tests passed + 1 skipped. Typecheck: server 0, frontend 36.
- Not verified here: the new table being created on production (needs the deploy to apply the schema — see PROGRESS "Needs owner verification"); email-on-notification and mute preferences (no code for them was found in the server; listed in PROGRESS for the owner to confirm what was meant).
- Behaviour change to note: older owner-less notifications of type SYSTEM (if any exist on production) are no longer shown to customers; only rows of type ANNOUNCEMENT are.

## INT-1 — Integrations page always showed Google Calendar as "disconnected" (Phase 2, found while fixing DashIntegrations.tsx type errors)
- Root cause: `GET /api/v2/calendar/status` answered without the standard `{ success, data }` envelope. The dashboard API client rejects any answer without `success: true`, so the page fell into its error path and showed "disconnected" even for a connected calendar. The agent editor's calendar check (`getCalendarStatus`) had the same problem.
- Fix: the route now returns `{ success: true, data: {...} }` (errors return `success: false`); the page's type gained the `googleEmail` field the server already sent (3 type errors fixed, frontend 36 → 33).
- Tests: `npm run test:calendar-status` (2, part of test:security) calls the production handler on the test database; it FAILS on the previous code and passes now. Browser: 2 tests (connected shows the Google account; disconnected shows Connect).
- Not fixed here (same defect, owned by Phase 4 "Scheduling & Calendar"): `GET /calendar/bookings`, `POST /calendar/bookings/:id/cancel`, `POST /calendar/bookings/:id/reschedule` also omit the envelope.
- Not verified here: a real connected Google Calendar.

## B3 — Prompt Coach did not enhance prompts (Phase 3, branch fix/prompt-coach-testlab)
- Issue: "Prompt Coach" only filled fixed playbook templates; it never read or improved the customer's own prompt and made no AI call.
- Fix:
  - New shared AI text client `server/src/services/ai/textModel.ts`: per-attempt timeout (plus a hard outer timeout), one retry for temporary failures, then the fallback model; uses the workspace's own saved Gemini key if present, else the platform key; never logs prompts or keys; swappable transport for tests.
  - New `server/src/services/PromptCoachService.ts` + `POST /api/v2/agents/prompt-coach/enhance`: rewrites the prompt with clear role, goal, tone, language/Hinglish, call flow, objections, guardrails (no invented facts, no OTP/bank details, DND respect, honest AI disclosure) and escalation; returns improved prompt, summary, list of changes, placeholders for missing facts, a line diff, and before/after quality scores. Input 20–12,000 characters; output size-capped and validated as JSON.
  - Prompt-injection defence: the customer's prompt is wrapped in delimiters (delimiter tags stripped from input), the model is told never to follow instructions inside it, and a private random marker in the instructions causes any answer that echoes them to be rejected.
  - Cost protection: new `aiFeatureLimiter` (30 AI calls per user per hour) on the route.
  - Errors map to clear messages (not configured 503, timeout 504, busy 503, blocked 422, unreadable 502); provider error text is never shown.
  - Browser: Coach opens on a new "Enhance my prompt" tab (playbooks kept as the second tab): optional goal, Enhance, before/after score, what changed, placeholders to fill, "Compare changes" diff, Use / Discard.
- Security fix found here: `requireActivePlanOrBYOK` accepted a Gemini key sent in the request body or header as proof of "bring your own key". Nothing uses that key, so any free account could unlock the AI builder, Prompt Coach and knowledge-base uploads by sending any string. Now only a key saved in the account counts.
- Test-infrastructure fix: Playwright now defaults to 2 local workers (this 6.3 GB machine ran out of memory with 4 browsers + dev server, causing random connection resets). Override with PW_WORKERS.
- Files: server/src/services/ai/textModel.ts (new), server/src/services/PromptCoachService.ts (new), server/src/routes/agents.ts, server/src/middleware/rateLimiter.ts, server/src/middleware/planValidation.ts, server/scripts/test_prompt_coach.js (new), server/package.json; Frontend/src/app/api.ts, Frontend/src/app/components/agents/SinglePromptStudio.tsx, Frontend/e2e/prompt-coach.spec.ts (new), Frontend/playwright.config.ts.
- Tests: `npm run test:prompt-coach` (16, in test:security) with a stubbed AI transport through the production code path: result shape, delimiting, marker leak rejected, bad JSON rejected, retry then fallback, timeout, no retry on safety block, input limits, no key configured, diff, plan gate refuses body/header keys. Browser: 6 tests.
- Verified: 16/16 and 6/6 (twice). Server typecheck 0; frontend 33.
- Not verified here: a real call to the AI model (keys are treated as compromised until rotated; live smoke script deferred to owner verification). The quality of the AI's rewrite can only be judged with a live model.

## B5 — Test Lab did not work (Phase 3, branch fix/prompt-coach-testlab)
- Issues (both confirmed in code):
  1. Test Lab was fake: `TestLabService.runSimulation` ignored the agent's prompt and scored hard-coded replies about "UAE real estate", so every agent got the same passing result.
  2. The screen never showed a result: it read `res.scorecard`, a field the server never sent, so it always said "No Simulation Run Yet".
- Fix:
  - `TestLabService` rewritten: for each chosen caller type (hesitant, price-sensitive, upset/opt-out, busy, Hinglish) the AI model plays the agent turn by turn using the agent's SAVED prompt compiled by the same `buildFinalSystemInstruction` a live call uses; a second AI pass grades the transcript (objections, accuracy/no invented facts, compliance, next step, tone). Deterministic checks can only LOWER scores: not honouring "stop calling" → compliance 0; not admitting it is an AI when asked → compliance ≤ 20; monologue → tone ≤ 70. Pass = compliance ≥ 90, accuracy ≥ 70, score ≥ 75. A caller that fails to simulate is reported as "Not completed" and the run never counts as passed.
  - Runs are saved (`test_lab_runs` table, additive migration `20261117130000_add_test_lab_runs`, rollback = drop it; latest 20 per agent kept) with list/reopen routes, all tenant-scoped. Uses AI credits, never call minutes. Protected by the plan gate and the 30-per-hour AI limiter. Errors mapped to clear messages.
  - Screen rebuilt: caller choice, clear note that the SAVED version is tested (warning when there are unsaved changes), per-caller scores, issues, "Show conversation" transcript, previous runs.
  - Two old, unwired dev scripts (`eval_rag_v2.js`, `test_section_g_matrix.ts`) that asserted the fake output now point to the new test.
- Also fixed (test reliability): `test:street-smart` "assembly latency" used one unwarmed batch and failed under load (4 ms once vs ~0.5 ms idle); now warm-up + median of 5 batches, same 1 ms target, passes idle and under heavy load. A layout test measured the pop-up mid-animation; now uses laid-out width.
- Files: server/src/services/TestLabService.ts, server/src/routes/agents.ts, server/prisma/schema.prisma, server/prisma/migrations/20261117130000_add_test_lab_runs/, server/scripts/test_test_lab.js (new), server/scripts/test_street_smart_intelligence.ts, server/scripts/eval_rag_v2.js, server/scripts/test_section_g_matrix.ts, server/package.json; Frontend/src/app/api.ts, Frontend/src/app/components/agents/SinglePromptStudio.tsx, Frontend/e2e/test-lab.spec.ts (new), Frontend/e2e/agent-templates-layout.spec.ts.
- Tests: `npm run test:test-lab` (12, in test:security) with a stubbed AI model: real prompt used turn by turn, good agent passes, opt-out violation fails even with a generous grader, monologue check, saved/listed/reopened per workspace only, other workspace refused, empty prompt refused before any AI call, bad persona list refused, one failing caller reported while others complete, unreadable grader output never passes, only 20 runs kept, calling minutes untouched. Browser: 5 tests.
- Verified: migration proven offline-generated and applied to the old schema with zero remaining difference; full regression green (see PROGRESS).
- Not verified here: a real run against the live AI model (keys treated as compromised until rotated); grading quality can only be judged live.
- Disclosure: while proving the migration I ran `prisma db push --accept-data-loss` against the LOCAL throwaway database only (CLAUDE.md forbids the flag). It failed and changed nothing; the proof did not depend on it. Not repeated.

## B6-CAL — Calendar bookings never showed; successful cancels reported as failures; cancel left Google events behind (Phase 4, branch fix/agent-editor)
- Root causes:
  1. `GET /calendar/bookings`, `POST /calendar/bookings/:id/cancel` and `/reschedule` answered without the standard `{ success, data }` envelope. The dashboard client rejects such answers, so the Calendar page always showed no bookings and every successful cancel showed "Failed to cancel".
  2. `CalendarService.cancelAppointment` swallowed a failed Google Calendar delete and still marked the booking cancelled, so the appointment stayed in the customer's Google Calendar (slot blocked, caller may still turn up). The same function is used by the live-call agent's cancel tool.
  3. Cancel/reschedule had no rate limiter and no id validation.
- Fix: envelopes with clear status codes (404 not found, 409 not connected / slot taken, 502 Google refused); cancel keeps the booking unchanged unless Google deleted the event (or it was already gone: 404/410); `sensitiveOperationsLimiter` + id/slot validation; the Calendar page shows a load error instead of an empty list and shows the server's message on a failed cancel.
- Files: server/src/routes/calendar.ts, server/src/core/orchestrator/CalendarService.ts, server/scripts/test_calendar_bookings.js (new), server/package.json, Frontend/src/app/components/calendar/CalendarOverview.tsx.
- Tests: `npm run test:calendar-bookings` (7, in test:security) on the local test DB with the production handlers: envelope, tenant isolation of list and cancel, successful cancel, Google-failure keeps booking, validation, limiter + login present. Against the previous code 6 of 7 FAIL; now 7/7.
- Not verified here: a real Google Calendar delete/reschedule (needs a connected Google account).

## A2–A5 — Agent Functions never ran on live calls; tools shared across calls; hard-coded fallback account (Phase 4)
- Root causes (from docs/AGENT_EDITOR_AUDIT.md, confirmed in code):
  - A5: saved "Custom API" functions (and flow function nodes) were declared to the AI model without URL or execution type, so every invocation failed with "Unsupported execution type".
  - A2: `CallOrchestrator` kept ONE `ToolExecutor` for all calls and cleared/refilled it per call, so concurrent calls overwrote each other's tools.
  - A4: a duplicate or built-in tool name threw and aborted the whole call start.
  - A3: if the agent could not be loaded, the call ran as a hard-coded user id with a recruiter prompt (billing and calendar actions on the wrong account).
  - HTTP tools had no timeout, followed redirects (SSRF bypass) and sent a body on GET (which fetch rejects); non-JSON replies threw.
- Fix: new `runtime/agentTools.ts` builds executable http tools (URL, method, safe headers, parameter schema) from editor functions and flow nodes, skipping built-in/invalid/duplicate names with a log line; platform types (end call, calendar, transfer, SMS) are not declared twice. One `ToolExecutor` per call. `ToolExecutor`: 10 s timeout, `redirect: 'error'`, GET/DELETE params in the query string, custom headers, non-JSON replies returned as text, duplicate names skipped. A call with no loadable agent is refused (the carrier leg is hung up by the existing failure path). Editor validates function names (built-in names, duplicates), URL format and header JSON.
- Files: server/src/runtime/agentTools.ts (new), server/src/runtime/ToolExecutor.ts, server/src/core/orchestrator/CallOrchestrator.ts, server/scripts/test_agent_tools.js (new), server/package.json, Frontend/src/app/components/agents/SinglePromptStudio.tsx.
- Tests: `npm run test:agent-tools` (12, in test:security; outbound HTTP stubbed via global fetch, production code otherwise): executable tool built, reserved/invalid/duplicate skipped, platform types not duplicated, flow nodes, header sanitising, GET query + headers + no redirect + timeout signal, POST body + text reply, hung endpoint fails fast, internal addresses refused before any request, duplicate registration not fatal, no shared registry, missing agent refused.
- Not verified here: a live call invoking a customer's real API.

## A1, A7, A11, A12 — flow saves wiped settings; webhooks incomplete; no save validation; secrets in plain text (Phase 4)
- Root causes:
  - A1: the flow builder sends `agentConfig: { handbookPresets }` only and `PUT /agents/:id` replaced the whole stored config, wiping webhooks, post-call fields, functions, MCPs, call settings and greeting on every flow save.
  - A11: create/update accepted any body (status any string, agentType, workspaceId from the client) with no rate limiter.
  - A12: webhook signing secret and MCP API keys were stored and returned to the browser in plain text.
  - A7: only `call_analyzed` was ever sent although the editor offers four events; no retries; signature had no timestamp (replayable); deliveries sequential; stored secret not decrypted.
- Fix:
  - Update merges the incoming config onto the stored one section by section (a sent section replaces that section; others are kept).
  - zod body schema on create and update (types, enums, sizes; unknown helper fields pass through); `workspaceId` never taken from the client; new `agentWriteLimiter` (120 per 15 min).
  - New `utils/agentSecrets.ts`: secrets encrypted at rest, masked (`••••••••`) in every agent response, a masked value sent back keeps the stored secret; decrypted only where used (WebhookDispatcher, McpService).
  - WebhookDispatcher: decrypts secret, keeps the existing signature header and adds `X-Claritiy-Timestamp` + `X-Claritiy-Signature-V2` (HMAC of `timestamp.body`), 3 attempts with backoff on network/5xx/429 (no retry on other 4xx), parallel delivery, no redirects, sanitised custom headers. `call_started`, `call_ended` (once, after finalisation) and `transcript_updated` (per finished turn) are now sent.
  - Test guard: production `ENCRYPTION_KEY`/`SIP_ENCRYPTION_KEY` are replaced with test-only values in every guarded script.
- Files: server/src/routes/agents.ts, server/src/utils/agentSecrets.ts (new), server/src/utils/WebhookDispatcher.ts, server/src/services/McpService.ts, server/src/core/orchestrator/CallOrchestrator.ts, server/src/middleware/rateLimiter.ts, server/scripts/lib/testDbGuardCore.cjs, server/scripts/test_db_guard.js, server/scripts/test_agent_config_integrity.js (new), server/package.json.
- Tests: `npm run test:agent-config` (11, in test:security): partial save keeps other sections, secrets masked and kept, new secrets encrypted, invalid fields rejected, workspaceId ignored, cross-workspace update refused, limiter present, v2 signature, unsubscribed event not sent, 5xx retried / 4xx not, internal URLs refused. Against the previous route 6 of 11 FAIL; now 11/11. Guard tests 20/20.
- Not verified here: a real receiver verifying the v2 signature; live call_started/call_ended deliveries.

## A6 — Post-Call Data Extraction never ran on live calls (Phase 4)
- Root cause: the editor saves `agentConfig.postCallAnalysis` (summary prompt + fields), but the live hang-up path (CallFinalizer → AnalysisService) chose a fixed report template and never read it; only an unused generic-webhook path (CallService) did, storing results where no screen reads them.
- Fix: `AnalysisService.resolveBlueprint` now returns a COPY of the chosen template plus the agent's fields (normalised names, types, enum options, max 25, matched case-insensitively against template fields so nothing is duplicated) and the agent's summary instruction, which is added to the analysis prompt. Results are stored with the call's report, so they show in Call Reports → Fields and in the `call_analyzed` webhook. The editor now says where results appear.
- Files: server/src/services/AnalysisService.ts, server/src/config/reportBlueprints.ts, server/scripts/test_post_call_fields.js (new), server/package.json, Frontend/src/app/components/agents/SinglePromptStudio.tsx.
- Tests: `npm run test:post-call-fields` (6, in test:security): fields included, summary carried, shared templates unchanged, same-name field replaces not duplicates, safe defaults, limits. Fails on the previous code.
- Not verified here: an extraction by the live AI model after a real call.

## A8 — Security & Fallback settings did nothing (Phase 4)
- Root cause: the editor saved `securityFallback.{piiRedaction, fallbackModel, fallbackVoice, maxRetries}` but no server code read any of it; the real switch `Agent.isPiiRedactionEnabled` was never set by the editor; the category redactor existed but nothing passed it categories; its phone pattern only matched US formats; there was no Aadhaar or PAN option (US "SSN" instead).
- Fix: transcripts are now redacted BEFORE they are stored, with the categories the agent chose (`TranscriptRepository.addSegment` looks them up per call, cached), and again when read (covers older rows). Categories: phone (Indian +91/0/plain and international), email, Aadhaar, PAN, card numbers (`ssn` still honoured for older agents). Older agents with only the on/off switch get everything redacted. The editor sends `isPiiRedactionEnabled` with saves and explains what redaction does. The fallback model / voice / retry controls were removed (nothing read them; failover is automatic; the model policy itself awaits the owner's Gemini decision) and replaced by a one-line explanation.
- Files: server/src/repositories/TranscriptRepository.ts, server/src/services/CallService.ts, server/scripts/test_pii_redaction_settings.js (new), server/package.json, Frontend/src/app/components/agents/SinglePromptStudio.tsx.
- Tests: `npm run test:pii-settings` (6, in test:security) on the local test DB: per-category redaction, Aadhaar vs phone, ordinary text untouched, redaction before storage, no redaction when off, legacy switch, redaction on read. 5 of 6 FAIL on the previous code; now 6/6.
- Note: post-call extraction and reports read the redacted transcript, so a redacted phone/email cannot be extracted — that is the intended effect of the customer's choice and is stated in the editor.

## A10 (part) — browser test calls fetched customer URLs with no SSRF check or timeout (Phase 4)
- Root cause: `SandboxStreamHandler` had its own copy of custom-API execution: no SSRF check, no timeout, unsanitised headers, redirects followed. MCP requests followed redirects.
- Fix: test calls now use the same `buildAgentTools` + `ToolExecutor` path as live calls (SSRF check, 10 s timeout, no redirects, safe headers). MCP requests use `redirect: 'error'`.
- Remaining (Phase 12, logged as P10): `assertSafeUrl` resolves DNS once and fetch resolves again, so a DNS-rebinding attack is still theoretically possible; the fix is pinning the checked IP in the HTTP agent.
- Tests: regression check added to `npm run test:agent-tools` (13/13).

## A13 — MCP servers only worked in browser test calls (Phase 4)
- Root cause: only `SandboxStreamHandler` (browser test calls) discovered and executed MCP tools; `CallOrchestrator` (real phone calls) ignored `agentConfig.mcpServers`.
- Fix: live calls discover MCP tools (max 5 servers, 6 s overall cap, during the pre-warm while the phone rings; failures and timeouts never block the call), declare them to the AI model (built-in names protected), and route their calls to `McpService.executeMcpTool` with the decrypted key, SSRF check and no redirects.
- Files: server/src/core/orchestrator/CallOrchestrator.ts, server/scripts/test_mcp_live.js (new), server/package.json.
- Tests: `npm run test:mcp-live` (4, in test:security): discovery with decrypted key and no redirects, execution, internal URLs refused, live-call wiring present (source check: a real call needs the voice AI service).
- Not verified here: a live phone call using a real MCP server.

## A14 — Knowledge Base badge showed 0 until the section was opened (Phase 4)
- Root cause: the editor loaded the knowledge-base list only when that section was expanded, and the parent never passed one in.
- Fix: the list loads when the editor opens and refreshes whenever the section is opened.
- Test: browser test in `Frontend/e2e/test-lab.spec.ts` (badge shows "Knowledge Base (2)" for an agent with two attached KBs, without opening the section); fails with the old condition, passes now.

## Call Settings no-ops — max duration, end on silence, closing message, ambient noise (Phase 4)
- Root cause: on live calls nothing enforced "Max call duration" (not even the 30-minute default every call row carries — calls had no length limit at all, a cost/abuse risk); "End on silence" was only a sentence in the prompt; "Closing message" was never read; "Ambient noise" only added a meaningless prompt line (no audio can be mixed).
- Fix: per-call timers in `CallOrchestrator`, armed when the call starts and cleared in the single end-call path: max duration = the agent's setting when set, else the call's limit, never above a 60-minute platform ceiling (min 60 s); end-on-silence (10–600 s) restarted by any speech from either side, ending with reason `silence_timeout`. The closing message is added to the agent's instructions. The ambient-noise control was removed and is ignored.
- Files: server/src/core/orchestrator/CallOrchestrator.ts, server/src/utils/systemInstructionBuilder.ts, server/scripts/test_call_limits.js (new), server/package.json, Frontend/src/app/components/agents/SinglePromptStudio.tsx.
- Tests: `npm run test:call-limits` (7, in test:security) with the production orchestrator (only its end action replaced by a recorder): limit rules, max duration fires, silence fires and speech resets it, other calls' speech ignored, timers cleared on end, closing message in / ambient noise out.
- Caveat (to watch in live calls, Phase 11): the silence timer is reset by transcript events; if a caller speaks continuously for longer than the silence period without any transcript event, the call could end early. The minimum period is 10 s and the default 30 s.

## A9 — Conversational flow builder lost its settings and ran different instructions (Phase 4, B7)
- Root cause: (1) on reopen the builder loaded the whole saved prompt (global prompt + compiled flow + handbook) into the "Global Prompt" box, so every save nested another copy; the input hint text was stored as the value and reached calls. (2) Direction, voice, language, flexibility, speech and transcription settings always reset to defaults on reopen, and the app saved only the handbook list. (3) At call time the server threw the saved prompt away and recompiled the bare graph without direction, dropping the global prompt and handbook. (4) Branches of a Logic Split could not be named (edges saved without labels), so the agent had only "Condition 1/2". (5) The builder's Knowledge Base toggle changed nothing on the server. (6) Extract Variable's key (`variableKey`) was ignored by both compilers. (7) Code, MCP and Subagent nodes did nothing on a live call.
- Fix: `agentConfig.flowSettings` {globalPrompt, flexibilityMode, handbookPresets} plus speech/transcription saved through one payload builder in App.tsx; the builder reloads all of them from the saved agent and recovers the user's own text from old saves (`extractFlowGlobalPrompt`). One server resolver `FlowCompiler.resolveFlowAgentInstructions` is used by live calls, browser test calls and the instruction builder (Test Lab): the builder's saved prompt runs as previewed, old nested copies collapse to one, agents without a builder prompt compile with their own direction. Logic Split inspector names each branch; unnamed branches block saving. KB toggle assigns/unassigns on the server (saves a new agent first), with rollback on error. Both compilers read `variableKey`. Code/MCP/Subagent marked Soon and blocked on save like the other Soon nodes.
- Files: Frontend/src/app/components/agents/VisualFlowCanvas.tsx, flowCompiler.ts, Frontend/src/app/App.tsx, server/src/core/orchestrator/FlowCompiler.ts, CallOrchestrator.ts, server/src/websockets/SandboxStreamHandler.ts, server/src/utils/systemInstructionBuilder.ts, server/scripts/test_flow_agent_instructions.js (new), Frontend/e2e/flow-builder.spec.ts (new), server/package.json.
- Tests: `npm run test:flow-agent` (8, in test:security): 0/8 on the old code, 8/8 now. `Frontend/e2e/flow-builder.spec.ts` (4): reload, save payload + branch names, KB assignment, Soon nodes: 4/4 fail on the old code, 4/4 pass now.
- Not verified here: a live phone call on a flow agent (needs carrier + voice AI).

## Speech speed / volume / boosted keywords described as exact settings (Phase 4)
- Root cause: these controls only add speaking-style text to the AI's instructions (the voice AI has no exact rate/volume/keyword-boost setting), but the labels promised exact audio and recognition changes.
- Fix: helper text in the prompt editor and the flow builder now says they are guidance to the AI voice. Volume still changes the in-browser preview loudness. Audit also corrected: "Add Meet link" does work (saved by the calendar rules route; booking adds a Google Meet conference to the event).
- Test: `Frontend/e2e/flow-builder.spec.ts` "speed and keywords say honestly…" (passes).

## B8 — Knowledge base + RAG v2 Retrieval Inspector (Phase 5)
- Root cause (several): (1) the server's 10 MB JSON limit made plan file limits above ~7 MB unreachable (bare 413). (2) Plan limits: only document count and file size were checked, after the PDF was already parsed, with a race (parallel uploads all passed the last slot); storage, chunks-per-workspace and documents-per-agent were never enforced. (3) DOCX was offered but read as plain text (zip bytes indexed as gibberish). (4) Indexing was fire-and-forget: no queue, unbounded parallel embedding calls, lost on restart. (5) Without an embedding key the server silently indexed fake vectors outside tests; no request timeout; key in the URL. (6) Search: document/agent paths had no workspace filter in SQL; the 300 ms budget in the options was never applied; on error a live call got an empty list (no "do not guess" instruction). (7) URL crawl followed redirects without re-checking them against internal addresses (SSRF), unbounded body, any content type. (8) No rate limit on any KB route; errors leaked internal messages. (9) Inspector: "Synthesized Agent Answer" was just the first chunk; "v2 Hybrid HNSW" claimed an index that does not exist; processing documents never refreshed; failure reasons only in a tooltip.
- Fix: upload route has its own capped parser (20 MB file max, 4 uploads in flight → 503 "busy"); effective per-file limit = min(plan, 20 MB), shown via new `GET /knowledge-base/limits`. All limits checked before decoding/parsing and again inside a per-workspace advisory-lock transaction (upload, crawl, assign, update-agents); chunk limit checked before paying for embeddings. Only PDF (magic bytes), TXT, CSV, MD accepted; binary content refused. Indexing queue (2 documents at a time per server, 1 per workspace, `queued` status, resumes after restart, batched inserts, throttled progress). Embeddings: fail closed outside tests, 5 s timeout, key in header. Search: one query builder, workspace filter on every path, time budget (8 s default, 2.5 s on live calls), failed/slow lookups tell the agent not to guess, query text no longer logged. Crawl: every redirect hop re-checked, max 3, 5 MB, HTML/text only. Rate limits: ingest 30/h, writes 120/15 min, inspector 60/10 min. Inspector shows what calls use (score, similarity, source) plus near-misses with similarity; failed reasons visible; auto-refresh while indexing; phone layout scrolls inside the table. `DB_POOL_MAX` (optional) sizes the DB pool. Full-text GIN index as additive migration `20261117140000_kb_chunks_fulltext_index`.
- Kept on purpose: the strict relevance gate for live calls (cosine distance ≤ 0.15). The inspector now shows near-misses so it can be tuned on real documents (owner step 13).
- Files: server/src/controllers/KnowledgeBaseController.ts, routes/knowledgeBase.ts, services/KnowledgeBaseService.ts, services/HybridSearchService.ts, utils/embedding.ts, middleware/rateLimiter.ts, lib/prisma.ts, index.ts, providers/gemini/GeminiLiveProvider.ts, core/orchestrator/CallOrchestrator.ts, prisma/migrations/20261117140000_kb_chunks_fulltext_index, scripts/test_kb_rag.js, scripts/test_kb_limits_race.js, package.json; Frontend/src/app/App.tsx (DashKnowledge), api.ts, e2e/knowledge-base.spec.ts.
- Tests: `test:kb-rag` 20/20 (in test:security; crashes on old code); `test:kb-race` 2/2 on a real Postgres with a 10-connection pool (0/2 on old code: 8 parallel uploads created more than the plan allows); browser 6/6 (6 fail on old code).
- Not verified here: real embeddings (no key may be used), the embedding model name `gemini-embedding-2`, and the full-text index on production (created only by `migrate deploy`, P1).

## B13 — Billing: payment verification and fraud prevention (Phase 6)
- Root cause (several): (1) plan confirmation trusted the plan name sent by the browser, accepted a payment when Razorpay could not be reached (fail open), accepted `authorized` payments, and skipped the user check when the order had no notes. (2) Number orders were priced from `baseCost`/`setupFee` sent by the browser; the number purchase routes only checked the signature, so any validly signed payment (even one already used for a plan) bought a number, and refunds used the browser-sent `expectedPrice`. (3) Webhook: Razorpay sends empty notes as `[]`, so order notes were ignored and `payment.captured` (which has no order notes) never activated a plan, i.e. the "browser closed after paying" fallback did not work; it acknowledged before processing, so failures were never retried; it trusted payment notes that the checkout script can set; the built-in test secret worked whenever NODE_ENV was not exactly "production"; `refund.created` + `refund.processed` counted every refund twice; payment-link and subscription events had no amount check. (4) Browser confirmation and webhook racing each other made the loser fail with a DB error (user saw "failed" although paid). (5) No reconciliation. (6) Invoices: a hard-coded seller GSTIN that is not ours; numbers from a plain count (parallel purchases collided and the second purchase failed); customer name not escaped in the invoice HTML; no CGST/SGST/IGST split. (7) Hard-coded Razorpay test-key fallbacks; duplicate unused `/verify-plan-payment`; `/gstin` had no rate limit.
- Fix: one verification path in BillingService: signature + Razorpay order and payment fetched (fail closed with a clear "pending" answer), same order, same amount, INR, captured, user and purpose from server-set order notes; the plan is decided by the order; orders auto-capture; payment ids redeemable once (PaymentTransaction for numbers too); number price from carrier inventory; refunds use the verified amount. Webhook processes before answering (500 = retry), uses only order notes (fetches the order when needed), dedupes in the DB, counts refunds once, checks amounts on every crediting event. Concurrent fulfilment answered idempotently. New `PaymentReconciliationService` (every 15 min) shares the webhook rules. Invoices: seller GSTIN from env only (else "PAYMENT RECEIPT"), financial-year consecutive numbers under a lock, CGST/SGST vs IGST, HTML escaped. Hard-coded keys and `/verify-plan-payment` removed; `/gstin` rate limited. Frontend: checkout sends no price, shows success only after server success and "processing" when pending; number purchase sends only the number id.
- Files: server/src/services/BillingService.ts, PlanFulfillmentService.ts, PaymentReconciliationService.ts (new), InvoiceService.ts, routes/billing.ts, routes/numbers.ts, routes/razorpayWebhook.ts, index.ts, scripts/test_billing_verification.js (new), scripts/test_payment_gateway_security.js (updated to the new API), package.json; Frontend/src/app/pages/Pricing.tsx, App.tsx (number purchase), e2e/billing-checkout.spec.ts (new); docs/COMPLIANCE_NOTES.md (new).
- Tests: `test:billing` 21/21 (in test:security; the invoice tests fail on the old InvoiceService, the rest need hooks the old code lacks); `test:payment-security` 16/16; browser 3/3 (2 fail on the old Pricing page).
- Not verified here: a real Razorpay test-mode payment and webhook delivery (owner step 14); GST/SAC treatment (COMPLIANCE_NOTES, CA review). Left for Phase 13: `Frontend/src/app/components/settings/BillingGateway.tsx` (unreachable, has mock purchase code) and root `scripts/test_plan_security.ts` (old API).

## B9 — Phone numbers, KYC and carrier activation (Phase 7)
- Root cause (several): (1) P4: number routes used `requireActivePlan`, which also passes a FREE account that still has minutes, so non-paying users could take numbers. (2) P8: `PAID_ACCOUNT_TYPES` lacked `trial` and `starter`, so paying Starter customers were treated as free (e.g. capped at 2 agents). (3) P3: the one-number rule was read `numberLocked` -> provision -> set it, so parallel requests each got a number. (4) `POST /api/v2/telephony/purchase` (unused by any client) bought a carrier number with company money with no payment, KYC, limit or DB record — open to any account with leftover minutes. (5) P6: carrier names in several user-facing errors.
- Fix: `requirePaidPlan` on every number route (paid plan, not suspended; minutes alone do not count); `trial`/`starter` added to paid types. `NumberEntitlementService.reserveNumberSlot`: one conditional UPDATE (`numberLocked` false -> true) taken BEFORE provisioning on all four claim/purchase routes, also refusing accounts that already hold a number; released only when setup fails and no number is held; a paid purchase that loses the slot is refunded automatically (verified amount). Removed the `/telephony` inventory/sub-accounts/purchase router, its controller and the duplicate `vobiz.service.ts` (carrier webhook kept). Neutral wording for carrier errors.
- Checked and kept: KYC is never auto-approved (mock modes refuse to mark verified; approval comes from the carrier response or its signed webhook, which fails closed with constant-time compare and replay protection); approval email only after verification; sub-account creation is idempotent (unique `userId`, in-process de-dupe, unique-constraint race returns the existing row). The "3 missing KYC routes" finding was a scan artefact (routes declared as arrays) — now pinned by a test. The remaining Vobiz files have distinct jobs (base client, inventory, number purchase, call placement).
- Files: server/src/services/NumberEntitlementService.ts (new), middleware/planValidation.ts, routes/numbers.ts, index.ts, services/CallService.ts, KycVerificationService.ts, VobizIntegrationService.ts; removed routes/telephony.ts, controllers/telephony.controller.ts, services/vobiz.service.ts; scripts/test_number_entitlement.js (new), root scripts/test_auth_protection.cjs; docs/BACKEND_UNUSED_REPORT.md.
- Tests: `test:number-entitlement` 9/9 (in test:security). The new middleware/service do not exist on the old code (suite cannot load there); the old behaviour is shown by the root causes above (code lines in CODEMAP B9).
- Not verified here: a real carrier claim/purchase and a real KYC approval (owner step 15). Known gap: if two servers create the same user's carrier sub-account at the same instant, one carrier-side sub-account can be orphaned (DB stays correct). Policy question for the owner: what happens to a number when an account loses its paid plan (open question 4).

## B10 — Batch calling (Phase 8)
- Root cause (several): (1) calling hours could be switched off (`ignoreCallingHours`) or widened (any start/end hour) by the campaign settings a customer sends, and an environment switch bypassed them even in production; (2) retries came straight from the customer settings with no upper bound; (3) after a restart, every recipient "in progress" for 10+ minutes went back to pending — including people still on a long call, who were then dialled again; (4) a campaign paused because calling hours closed was never resumed (recovery only looked at running campaigns); (5) contact lists were not validated (any string or international number), not de-duplicated, opt-outs were matched on raw digits (missed `+91…` vs `98…`), no size cap; (6) the idempotency lookup was not scoped to the account (another account's key returned its campaign); (7) the launch banner showed the CSV row count, not what was accepted.
- Fix: `isWithinCallingWindow` only narrows 09:00–21:00 IST, dev switch ignored in production; `resolveRetryPolicy` caps at 3 attempts / 10-minute minimum; restart recovery looks at the real call (live = left alone, ended = outcome decided, never placed = pending, also when the call id was not yet saved); window-paused campaigns auto-resume; `prepareBatchRecipients` (Indian mobiles only, E.164, de-duplicated, opt-outs matched normalised, 2 KB per contact); 5,000-contact cap; account-scoped idempotency; response and banner report skipped counts.
- Files: server/src/services/BatchService.ts, routes/calendar.ts, scripts/test_batch_compliance.js (new), package.json; Frontend/src/app/App.tsx (DashBatch), e2e/batch-launch.spec.ts (new); docs/COMPLIANCE_NOTES.md.
- Tests: `test:batch-compliance` 8/8 (in test:security; the 6 original cases all fail on the old BatchService); browser 1/1 (fails on old code).
- Not verified here: a live campaign through the carrier; national DND registry (not implemented — COMPLIANCE_NOTES). Known: "parallel" dial mode still dials one call at a time (the loop waits for each call to end) — logged for Phase 11 (capacity) rather than changed here.

## B11 — Calling Configuration page slow (Phase 9)
- Root cause: `GET /numbers/calling-config` awaited a live carrier KYC call with no timeout on every page load, and loaded each agent's full row (prompt, config, flow graph) only to show its name. After every save the page reloaded everything behind a full-page "Loading".
- Fix: KYC refresh runs in the background, at most once per 5 minutes per account; agents loaded as id+name; the page updates the row at once (rollback if refused) and refreshes quietly.
- Proof: with a deliberately slow (3 s) carrier, old code answered in 3,045 ms, new < 1 s (`test:calling-config` 3/3, 0/3 on old code); browser 2/2. Not measured: production p95 (owner step 17).

## B12 — Data pages audit (Phase 9)
- Tenant isolation: every query on Call History, Contacts, Analytics, Live Monitoring, AI QA, Reports and Alerting checked — all writes check ownership first or use server-derived ids. Lists are capped (calls 500, contacts 100, QA 50, reports cursor-paged 100). Reports: the 26-defect audit harness now reports 28/28 ok.
- Fixed: (1) Analytics loaded every call into memory and grouped days by UTC (calls 00:00–05:30 IST counted on the previous day); now one database GROUP BY with IST days; bad/huge ranges -> 400. (2) Analytics showed invented costs ("Estimated Spend" at Rs 4/min, plus $0.05 and Rs 5 estimates in the API); now shows billed minutes using the billing rule. (3) CSV injection: the browser Call History export and the admin exports wrote caller/user text raw (formulas would run in Excel); now formula-safe like Reports. (4) Alert webhooks were signed with a new random secret every time (and the secret was overwritten after each evaluation), so receivers could never verify them; now one stored secret per rule. (5) Found via typecheck: the agent editor's Scheduling & Calendar settings never reloaded after saving (read `res.data.rule` instead of `res.data.data.rule`), and "parse instructions" / slot preview did nothing. (6) Typecheck 33 -> 0: failed-call badge had no style (`danger` missing), button tooltips were dropped, section links passed unchecked strings, dead Billing/Audit settings tabs and the unreachable BillingGateway (old mock-payment flow) removed.
- Files: server/src/controllers/AnalyticsController.ts, utils/csv.ts (new), routes/adminRoutes.ts, routes/reports.ts, services/AlertEvaluator.ts, scripts/test_data_pages.js (new); Frontend/src/app/lib/csv.ts (new), App.tsx, api.ts, components/analytics/DashAnalytics.tsx, components/agents/SinglePromptStudio.tsx; removed components/settings/BillingGateway.tsx; e2e/analytics.spec.ts, scheduling-reload.spec.ts (new).
- Not verified here: 100k-row timings on production data; the alert evaluator still loads the window's calls per rule (logged for Phase 12 traffic work).

## B14 — Call recording playback (Phase 10, with P7 data retention)
- Root cause: (1) the carrier was never asked to record; (2) the in-process recorder appended AI audio and caller audio (different sample rates) one after another into one raw `.pcm` file, capped at ~5,000 chunks (a few minutes) — never playable in a browser; (3) carrier recording links were passed to a storage signer that only understands bucket paths, so playback links were always empty, while list endpoints sent raw values to the browser; (4) the agent editor had no recording switch; (5) the data-retention job existed but was never started, and it would have left carrier recordings behind.
- Fix: `RecordingService` — answer XML adds `<Speak>` notice then `<Record recordSession fileFormat=mp3>` before `<Stream>` when the agent has recording on; carrier callback accepted only with the call's HMAC token and an allow-listed https carrier URL; `GET /calls/:id/recording-link` (owner) returns a 5-minute signed link to `/api/v2/recordings/:id/stream`, which fetches server-side (no redirects), passes Range for seeking, can force download, and is never cached; lists/details return `hasRecording` only. Removed the in-process recorder. `RecordingPlayer` component (play on demand, seek, speed, download) in Call History and the Reports drawer. "Record calls" switch + optional notice in the editor. `DataRetentionJob` started at boot; deletes the recording at the carrier first (kept + alert on failure); recordings expire after 90 days by default.
- Files: server/src/services/RecordingService.ts (new), DataRetentionJob.ts, CallService.ts, controllers/CallController.ts, routes/webhooks.ts, calls.ts, reports.ts, core/pipeline/PipecatRunner.ts, index.ts, scripts/test_recording.js (new); Frontend/src/app/components/calls/RecordingPlayer.tsx (new), App.tsx, components/reports/CallResultDrawer.tsx, components/agents/SinglePromptStudio.tsx, e2e/recording-player.spec.ts, recording-toggle.spec.ts (new); docs/COMPLIANCE_NOTES.md.
- Tests: `test:recording` 8/8 (in test:security); browser 2/2 (the player test fails on old code).
- Not verified here: that both carriers accept `<Record recordSession="true">` alongside `<Stream>` and post `RecordUrl` to the callback, the carriers' recording DELETE endpoints, and the notice wording (owner step 18). Flow-builder agents have no Call Settings panel yet, so recording is set on prompt agents only (logged).

## B15 — Latency and voice (Phase 11) + P11 pre-existing failures
- Root causes found: (1) both agent editors defaulted the end-of-speech wait to 600 ms, so every reply waited 0.6 s of silence before the AI started; (2) per-turn latency was measured but never summarised or kept, and the in-memory records were never cleared (unbounded growth on the voice server); (3) a Google API key literal sat in GeminiLiveProvider.ts; (4) the site and SEO pages advertised unmeasured "sub-180ms" latency and a WebRTC architecture. P11: (5) an UNVERIFIED audio-stream handshake naming a call id marked that real call as failed (anyone knowing a call id could end it) — this was why test:batch-a failed; (6) busy calls were reported as "No Answer" ('busy' listed under no-answer first); (7) the m1 stale-lock test used 6 minutes while the worker's documented window is 15.
- Fix: 300 ms default (new agents; existing agents keep their saved value); at call end the p50/p95/max reply latency, model TTFT and turns over 1 s are logged and saved as a `latency_summary` call event, then the turn records are freed; key literal removed; marketing latency/WebRTC claims replaced and guarded by a test; unverified handshakes only close; busy -> Busy; m1 test aligned.
- Measured here: platform audio work per 20 ms frame p95 = 0.013 ms (caller audio in) / 0.027 ms (AI audio out, resampled) — negligible. NOT measured here: model time to first audio and network hops (need live keys and a carrier); the end-to-end < 1 s p50 target is therefore not claimed until owner step 19.
- Files: server/src/utils/CallTimingTracker.ts, core/orchestrator/CallOrchestrator.ts, providers/gemini/GeminiLiveProvider.ts, websockets/AudioStreamHandler.ts, services/AnalysisService.ts, scripts/test_voice_latency.js (new), scripts/test_call_finalizer_idempotency.ts; Frontend agent editors, marketing pages, scripts/prerender-seo.js; docs/COMPLIANCE_NOTES.md.
- Tests: `test:voice-latency` 5/5 (1/5 on old code); `test:batch-a` 9/9 (was 8/9); `test:m1-pipeline` 13/13 (was 10/13).

## S7 — Security / traffic hardening (Phase 12) + P5, P9, P10, P12
- Full write-up: docs/SECURITY_AUDIT.md (S1–S15, accepted items A1–A5, owner steps 20–24).
- Root causes: (S1) `CallService.createCall` loaded the agent by id only, so any customer could call with another customer's agent; (S2) calendar rule routes keyed on `agentId` alone; (S3) number purchase/claim stored the body `agentId` unchecked and inbound routing trusted it, plus an unscoped "any agent" fallback; (S4) public consent route marked any existing account by email; (S5) rate-limit key trusted the client `x-user-id` header; (S6) user-URL fetches validated DNS once, then connected (rebinding window); (S7) single calls had no destination policy; (S8) CORS allowed localhost in production; (S9) WebSocket default 100 MB messages; (S10) log metadata written verbatim; (S11) AI/delete/call-action routes without limiters; (S12) admin order retry needed only a view permission; (S13) alert evaluator loaded all call rows per rule per minute; (S14) missing ENCRYPTION_KEY / webhook secret silently fell back; (S15) 15 npm advisories.
- Fixes: ownership checks (CallService, calendar `ownsAgent`, `utils/agentOwnership.ts` in Vobiz/Plivo provisioning, inbound re-check); consent linked only for the signed-in owner (+5 min signup window for self-heal, trusted client IP); limiter key from auth only; `ssrfSafeDispatcher` (undici, connect-time IP check) on all 6 user-URL fetches; `utils/destinationPolicy.ts` (India only, 1900/1860 blocked, `OUTBOUND_ALLOWED_COUNTRY_CODES`); `config/cors.ts` (403 `CORS_ORIGIN_BLOCKED`); `config/limits.ts` ws `maxPayload` 1 MB / 64 KB; logger redaction (secrets, phone last-4, email masked, Error message, circular-safe); `callActionLimiter` + limiters on 20 routes; retry needs `numbers:activate`; alert metrics via `groupBy`; boot CRITICAL lines via `auditSecretConfiguration`; `npm audit fix`, Prisma CLI/client/adapter aligned 7.10.1, undici 7.30.2.
- Files: server/src/services/CallService.ts, routes/calendar.ts, routes/user.ts, routes/agents.ts, routes/calls.ts, routes/reports.ts, routes/billing.ts, routes/numbers.ts, routes/adminRoutes.ts, services/InboundCallService.ts, services/VobizPhoneNumberService.ts, core/telephony/PlivoService.ts, services/AlertEvaluator.ts, middleware/rateLimiter.ts, utils/ssrfValidator.ts, utils/logger.ts, utils/agentOwnership.ts (new), utils/destinationPolicy.ts (new), config/cors.ts (new), config/limits.ts (new), config/env.ts, index.ts, runtime/ToolExecutor.ts, services/McpService.ts, utils/WebhookDispatcher.ts, controllers/KnowledgeBaseController.ts, package.json, package-lock.json; scripts/test_security_hardening.js (new), scripts/test_caller_id_fallback.js (stale fixture: sub-accounts now default to calls blocked).
- Tests: `test:security-hardening` 13/13; on the old code the rate-limit, cross-tenant call, calendar, number-agent and consent tests fail (5 of the then 11). Verified-not-here: production RLS state, Render env secrets, live carrier/webhook traffic (owner steps 20–24).

## D9 — Dead-code removal (Phase 13) + D10 docs hygiene (part)
- Root cause: features removed from the UI (SIP, integrations, audit-log tab, duplicate routes) left their server routes, files and dependencies behind; a Next.js template and an unused shadcn kit were never cleaned; ad-hoc scratch/probe scripts accumulated in `server/`.
- Removed (each a separate revertable commit on `chore/dead-code`): 12 server routes, 9 server files + SIP provider/drachtio, 19 scratch/probe files, 51 frontend files, unused frontend helpers and App.tsx audit-log state, 50 frontend + 4 server dependencies, root Next.js SVGs, stale `scripts/test_plan_security.ts` and `scripts/test_pii_redaction.js`. Full list and the kept-on-purpose list with reasons: docs/BACKEND_UNUSED_REPORT.md §5.
- Wired instead of removed: `lib/calendar/timezone.test.ts` (13 IST/DST checks) as `test:timezone` in test:security.
- Docs: README (was the create-next-app template), SYSTEM_CHARTER and TECH_DEBT rewritten to the real architecture and current debt; superseded notes on ARCHITECTURE_DECISIONS and DOMAIN_MODEL; RUNBOOK SIP vars.
- Tests: typecheck 0/0; build OK; test:security 27 suites pass (incl. caller-id 5/5, timezone 13/13); owasp, payment-security, batch a–f, m1, m2, street-smart(+regression), plivo-webhook, audiostream-isolation, live-transcript-auth, prompt-injection, audio/codec/drain/turn/persona pass; reports audit harness 28/28; Playwright e2e 116 passed / 1 skipped (--workers=1).
- Not verified here: a local `/live` boot of `dist/index.js` (the privacy plugin blocks running the compiled server because it contains the admin email constant). Covered by Render's `/live` health check on deploy (owner step 2) and by suites that mount the real routers.

## Q8 / T0 / M0 / marketing — Phase 14 (final)
- CI: `.github/workflows/ci.yml` added (typecheck + build; server test chain on a pgvector Postgres built with `migrate deploy`; browser tests; blocking migration-drift check). Root causes fixed in old workflows: `deploy-render.yml` ran `npm ci` at the root plus an unguarded live-API test (failed on every push) — now fires the Render hook only after CI passes; `call-path-e2e.yml` used `postgres:15` without pgvector and `db push --accept-data-loss` — now pgvector + plain `db push`.
- M0: the 17 committed migrations could not build an empty database. New single baseline generated offline from schema.prisma + vector extension + expression index + RLS; old folders archived; `call_results_fields_gin_idx` declared in the schema (it existed only in a migration, so migrate diff wanted to drop it). Proof: empty DB → `migrate deploy` → 62 tables, 2 GIN indexes, 13 RLS policies → `migrate diff --exit-code` = 0; test:security 100% on that DB. Production switch = owner step 25.
- Smoke E2E: `Frontend/e2e/smoke-journey.spec.ts` (sign-up → agent → plan → number → call → history + recording → sign-out) passes twice in a row.
- Marketing (launch gate §8): false product claims removed site-wide (SRTP/zero-copy, zero audio retention, DND-registry filtering — including a dashboard sentence, 10,000+ concurrent calls, HIPAA, FHIR/HNSW, bring-your-own SIP/Twilio/Exotel, toll-free/international numbers, native CRM sync, fictional Solutions API endpoints and timings). Guard: `test:marketing-claims` 11/11 (0/11 on the old site). Business/legal statements listed for the owner (COMPLIANCE_NOTES part 2).
- Not verified here: the first GitHub Actions run (owner step 26), Render/Vercel deploy results, anything needing live keys (FINAL_REPORT table).

## Defect audit — batches 1–3 + pricing (2026-11-19)
- Source: docs/AUDIT_FINDINGS.md (143 findings). Fixed here (each with a test that fails on the old code): #1 #2 #3 #6 #17 #32 #79 #90 · #111–#113 #115–#119 #132 #133 · #43 #44 #45 #51 #76 #78 #81 #82 #83 #84 #91 #92 #97 #141 · #46 #47 #48 #54 #57 #63 #64 #77 #80 #86. Root cause and fix per item: the batch commit messages (c622170, 6432e82, 64f9086, 12aea83).
- Highest impact: calls were refused for every non-admin account after KYC (#2); parallel calls lost minute debits (#1); the ₹1 trial was repeatable and every plan got 10 concurrent calls (#3, #6); outbound calls asked the carrier to record without the notice (#32); turning inbound off blocked outbound (#79); the Pricing page sold 1,000 minutes for a 750-minute plan and the site quoted prices that do not exist (#111–#113).
- Schema: additive migrations 20261118100000_phone_number_inbound_enabled, 20261119090000_batch_scheduled_at; one-time boot repairs for verified-but-blocked accounts and numbers left "inactive" (Render still deploys with db push, which runs no migration SQL).
- Tests: test:audit-batch1 8/8, test:audit-batch2 7/7, test:audit-batch3 5/5, test:minutes-race 3/3 (real Postgres), test:marketing-claims 18/18; full test:security chain, all other server suites, kb-race, typecheck 0/0, build, Playwright 120 passed / 1 skipped.
- Not verifiable here: behaviour against the live carriers (recording flag, KYC status values) — covered by owner steps 15/18.

## Defect audit — batches 4–5 + Gemini 3.8 Live (2026-11-19)
- Fixed (each with a test that fails on the old code): #4 #5 #12 #22 #23 #24 #25 #26 #27 #42 #144 (3ab90e6) · #28 #29 #30 #31 #35 #36 #38 #114 #145 (9bd8c13). Root cause per item: the commit messages.
- Highest impact: a paid number that failed to provision was not refunded (#4); one valid Plivo webhook token could end any other call (#28); hangups on carrier-A calls used the dial request id (#29); busy/rejected calls were recorded as completed and never retried (#30); a voice reconnect reset billing start and played audio twice (#23/#24); a failed session start left the phone line open and blocked the batch worker for 30 min (#35/#36); anyone with a call id could mark a live call failed (#145).
- Gemini models (owner request, cde3afd): Google's pages (checked 2026-11-19) list gemini-3.8-live as the current Live model; our fallback gemini-2.0-flash-exp was shut down 2025-12-09 and our default gemini-2.5-flash-native-audio-latest is no longer documented; text gemini-2.0-flash shut down 2026-06-01. Now: gemini-3.8-live → gemini-2.5-flash-native-audio-preview-12-2025 (logged fallback); text gemini-3.6-flash → gemini-3.5-flash-lite; one source of truth `server/src/config/geminiModels.ts`; 3.8 setup omits `proactivity` and declares tools BLOCKING.
- Tests: test:audit-batch4 8/8 (0/8 before), test:audit-batch5 8/8 (0/8 before), test:gemini-models 5/5, e2e audit-pending-plan 2/2 (both fail before); legacy batch-calling suite repaired 8/8.
- Not verifiable here: a real call on gemini-3.8-live (keys treated as compromised) — owner step 11a; Google's 15-minute session cap (#146, open).

## Carrier accuracy — Vobiz + Plivo checked against their docs (2026-11-19, branch fix/carrier-accuracy)
- **Vobiz KYC (critical):**
  - Root cause: sub-accounts were created with `{ name, enabled }`. Vobiz then defaults to `personal_use`, which inherits the master KYC, and our sync counted the resulting "calls not blocked" as verified. So no customer was ever verified by Vobiz.
  - Fix:
    - Customers are created as `customer_use` with their email.
    - KYC is read from the documented `/sub-accounts/{SA}/kyc/status`; only own-KYC `verified` + not blocked counts.
    - The webhook re-reads Vobiz's status instead of trusting its body.
    - Existing accounts are switched by a boot job; owner chose all users.
- **Vobiz numbers:**
  - Assignment used undocumented paths; it now uses `assign-subaccount`.
  - Purchase now sends only the documented fields.
  - Numbers auto-activate (owner choice).
  - Release used an undocumented path and deleted our record even when the carrier refused, so the master kept paying. It now uses the documented unrent/unassign and keeps `release_pending` until the carrier confirms.
- **Plans** (owner choice):
  - A plan ends at 0 minutes or 30 days, whichever comes first, and the number is released 5 days later.
  - New nullable `users.plan_expires_at`. Plans sold earlier keep no end date (COMPLIANCE_NOTES).
  - Terms §2.1 corrected (it described monthly card billing).
- **Plivo:**
  - India numbers need an accepted business compliance application per sub-account, and our code never filed one.
  - Built: document upload (checked by content), filing, review tracking (callback, poll, refresh on view), claim gated on `accepted`, and purchase with `compliance_application_id`. `/plivo/onboard` now needs a paid plan.
  - New table `plivo_compliance_applications`.
- **Tests:**
  - test:carrier-accuracy 8/8 (0/8 on the old code).
  - test:plan-lifecycle 6/6.
  - test:plivo-business 5/5.
  - e2e business-verification 4/4, screenshots in docs/proof.
- **Not verified here:** the live Vobiz and Plivo APIs (keys treated as compromised); see PROGRESS owner step 15a.

## Defect audit — batches 6–8 (2026-11-19, branch fix/audit-batch-6)
- **Batch 6 (d8171bb), money and call outcomes:** #8 #9 #10 #13 #14 #15 #16 #18 #19 #20 #21 #40.
  - Built-in plan keys always use the server plan config; catalog rows only for their own customer.
  - Answered calls that end on an error are recorded as completed; reaped stuck calls are billed only on a real carrier duration.
  - Restoring a suspended account re-enables only the API keys the suspension switched off.
  - No simulated carrier results in production; a repeat purchase of an owned number is idempotent.
  - Busy and no-answer outcomes are kept; batch billed minutes use the per-started-minute rule.
  - Refunds take back minutes in proportion (never below zero, admin alert on any shortfall); a full refund ends the plan.
  - Restricted or suspended accounts cannot buy; a late hangup webhook cannot change a billed call's duration.
  - Test: test:audit-batch6 11/11.
- **Batch 7 (a07d7ed), teams:** #11 #49 #50 #60 #61 #88 #89.
  - One workspace per person: invites are case-insensitive, and are refused for someone already in another team or with their own workspace.
  - API keys, the Gemini key, calls, numbers and plan purchases belong to the workspace, with role checks.
  - Test: test:audit-batch7 6/6.
- **Batch 8 (dccab7a), live calls:** #33 #34 #37 #39 #146.
  - Inbound calls give the AI the caller's number; an opt-out from an unknown caller creates a DNC contact.
  - A failed AI start or an expired pre-warmed session leaves no session or timers behind.
  - Closing the test tab during setup closes the model session.
  - Long calls: context-window compression and session resumption are on; handles are captured; a resume reuses the full setup and the same key.
  - Test: test:audit-batch8 5/5, and 0/5 on the old code.
- **Test hygiene (ca4e38d):** m1-pipeline drains only its own analysis jobs, and batch 6 deletes the jobs it queues. This fixed an intermittent 5/13 m1 result.
- **Not verified here:** a live call longer than 15 minutes against Google (#146), because the keys are treated as compromised. See PROGRESS owner step 11a.

## Defect audit — batch 9 (2026-11-20, branch fix/audit-batch-9, ea9b5f2)
- **Calendar:**
  - #52: the daily booking cap counts bookings made earlier today, grouped by the rule's own time zone.
  - #53: a buffer or minimum notice of 0 is kept at every layer (frontend, save route, read, slot search).
  - #65: appointments and scheduled calls (follow-up, manual, batch) are listed together, and a scheduled call can be cancelled from the page.
- **Batches (#55):** resuming right after a pause switches the campaign to running; the worker's atomic claim still allows only one runner.
- **Reports (#56):** re-analysis uses the worker's 15-minute lock rule and answers 409 when nothing was queued.
- **Alert rules (#58/#59):** metric, comparator, threshold, window, email and webhook URL are validated; clearing a field stores null.
- **Admin (#62):** daily metrics are the latest 14 days.
- **QA (#101):** transcript times are seconds, so the latency flag now fires at more than 2.5 s.
- **KYC:**
  - #7: the page shows a document as verified only when the number gate accepts it; no made-up references.
  - #151: carrier-confirmed documents (customer_use sub-account only) get a traceable reference.
  - #150: a pending document no longer triggers a "re-submit" email.
- **White label (#95):**
  - Provider errors reach customers as a neutral message.
  - Customer JSON error and message text and customer notifications are scrubbed of carrier names.
  - Raw carrier errors were removed from the onboard and search routes; the KYC email and the carrier-console fallback link no longer name the carrier.
  - Staff routes keep the real names.
- **Tests:** test:audit-batch9 10/10, and 0/10 on the old code. Related suites pass: calendar-bookings, data-pages, number-entitlement, carrier-accuracy, plivo-business, batch-compliance, notifications, scheduled-calls, batch3, batch5, recording.
- **Not verified here:** a live hosted-KYC session from the carrier (keys treated as compromised).

## Defect audit — batch 10, dashboard (2026-11-20, branch fix/audit-batch-9, a67fbcb)
- **Calls:**
  - #85: the live call transcript merges the per-turn events the server actually sends. It no longer reconnects on every live-calls refresh, and lines loaded before connecting stay.
  - #87: a new search or filter starts Call History at page 1, and the page number is clamped.
- **Reports:**
  - #93: the "Pending"/"Processing" filters list the calls waiting in the analysis queue, workspace-scoped and not clickable until analysed.
  - #94: report history shows the customer's own corrections and accepts, with the team member's name. Staff entries show as "Claritiy support" and never include a staff email.
- **Pages:**
  - #96: the plan badge shows the plan name (Startup, Growth…).
  - #98: picking an agent for the KB test survives list reloads.
  - #99: Publish sets the agent active.
  - #100/#152: 23 error messages now show the server's reason (apiFetch puts it in err.message).
  - #153: the Calendar card is readable on phones.
- **Alerts (#149):** the "cost" metric is now "Billed Minutes": per started minute, connected calls only. Rules saved earlier with a dollar threshold now compare minutes; the owner may want to tell users who set one.
- **Tests:**
  - test:audit-batch10: 3/3, and 0/3 on the old code.
  - e2e audit-batch10: 8/8. On the old code 7 tests ran and all failed; the 8th (proof screenshots) only captures images.
  - #53 editor: shows 10 for a saved 0 on the pre-batch-9 editor.
  - Screenshots: docs/proof/audit-batch10-*.png (1440 and 390).

## Defect audit — batch 12, server low items (2026-11-20, branch fix/audit-batch-11, f0c6c20)
- **Agents:**
  - #66: the agent list caps the page size at 200 and answers 401 without a user. A database error is a 503, no longer an empty "success".
  - #67: deleting an agent **archives** it. Call → Agent is ON DELETE CASCADE, so deleting the row erased every call, transcript and report. The agent is hidden and can't be used; unfinished campaigns and booked follow-ups are cancelled.
- **Reports, Analytics, Batches:**
  - #68: the summary's queue counts follow the agent and date filters.
  - #69: the trend keeps no-answer and busy calls out of "failed".
  - #41: batch buckets add up to the total ("inProgress" added), and retries follow the campaign's policy.
  - #73: batch "created" dates are IST days.
  - #74: a finished campaign can't be rewritten as cancelled.
- **Admin and notifications:**
  - #70: staff roles are validated.
  - #71: important notices are flagged as important.
  - #72: each workspace's retention audit entry carries its own purge count.
  - #107: the calendar-connect error is a plain sentence; setup details go to the logs.
- **Tests:** test:audit-batch12 11/11, and 0/11 on the old code. Related suites pass.

## Defect audit — batch 11, website and SEO (2026-11-20, branch fix/audit-batch-11, 20099b4)
- **One source of truth:**
  - Page titles, descriptions and H1s come from `src/app/data/seoPages.json`; the Voice AI Index article from `src/app/data/voiceAiArticle.json`.
  - Both are used by the app and the pre-render. The build gate `scripts/verify-seo-output.js` fails the build when they drift (#134 #137 #138).
- **Pages and routing:**
  - #120: the Voice AI Index hub is its own canonical page.
  - #121: leaving it no longer overwrites the next page's title and description.
  - #125: unknown URLs, industries and topics show a noindex "Page not found" page.
  - #131: industry tabs are real navigation, so the URL and canonical follow them.
  - #135: app pages (/dashboard, /login, /signup…) are noindex.
- **Structured data:**
  - #122: /faq has FAQPage with its 9 real questions.
  - #123: no FAQ schema on Home or Pricing, whose questions weren't on the page.
- **Navigation:**
  - #128: "Join Now" opens sign-up, and the mobile menu shows "Go to Dashboard" when signed in.
  - #129 #130: footer items are real links to the page they name, plus Blog and AI Voice Agent Software; the blog opens the real RTO post instead of an inline copy.
  - #136: the LinkedIn link no longer carries the admin parameter.
- **Accurate claims:**
  - #124: the fake newsletter form is gone.
  - #133: no "free sandbox".
  - #138: no certification-sounding titles and no false claims in the index article.
  - Also removed: zero lag, SIP and bi-directional CRM claims elsewhere (COMPLIANCE_NOTES "Website accuracy, part 3").
- **Not changed:**
  - #126 Terms (California/Delaware, US-only telephony addendum): a draft for the owner's lawyer is in COMPLIANCE_NOTES (owner step 27a).
  - Whether to noindex the 90 templated index pages is the owner's decision (step 28).
- **Tests:**
  - e2e audit-batch11: 9/9, and 0/9 on the old code.
  - test:marketing-claims: 25/25, and 18/25 on the old code.
  - Build gate: passes; 595 problems on the old code.
  - Screenshots: docs/proof/audit-batch11-*.png.

## Defect audit — batch 13 (2026-11-20, branch fix/audit-batch-13, 8149fb7)
- **Lists and totals:**
  - #75 #103: Contacts load 100 at a time with the real total and "Load more", and search runs on the server (names and notes, any case). A contact's call history is searched on the server, not taken from the latest 50 calls.
  - #110: Call History shows "N loaded of TOTAL calls" and can load older calls. `apiFetchWithMeta` now keeps the server's paging info, which `apiFetch` drops.
- **Dates (#104):** alerts, chat history, API keys, KYC, team members, Test Lab and calendar status now use the workspace timezone (IST), not the browser's.
- **Numbers:**
  - #105: changing the carrier or region searches once.
  - #106: a plan-included number no longer shows the carrier's ₹450/month + GST as if the customer paid it.
- **Other screens:**
  - #108: the low-balance message states the real rule (under 100 minutes).
  - #109: the Reports "Unclear" filter includes unlabelled rows.
- **Legal (#140):** the AI companion avatar was a real actor's photo. It is now a neutral icon, and the image is deleted from `public/`.
- **Live calls (#143):** the temperature is one named constant, `LIVE_CALL_TEMPERATURE = 0.5`, unchanged. The agent's stored temperature is not applied to calls; wiring it would silently move every agent to 0.7. The API schema's temperature regex had lost its backslashes: it rejected "0.7" and accepted "dd".
- **SEO (#139):**
  - Titles are at most 65 characters and descriptions at most 160, enforced by the build gate.
  - Topic titles use the " | Claritiy Voice" suffix only when it fits.
  - The sitemap no longer carries a fake build-date `lastmod`, so builds stop rewriting it.
  - The "thin" pre-rendered pages are the short static fallbacks shown before the app loads; search engines render the full page. Accepted.
- **Tests:** test:audit-batch13 4/4, and 0/4 on the old code. e2e audit-batch13 5/5, and 0/5 on the old code.
- **Not changed:** #127 (sign-up says an email is already registered) is an owner decision; see PROGRESS open question 5.

## Demo-readiness sweep (2026-11-20, branch fix/demo-readiness)
- **Access (7bf06e3):** read-only (viewer/analyst) members could end or transfer live calls, start KYC sessions, onboard the business carrier, run or delete QA cohorts and test the AI key.
  - Root cause: those routes had `requireAuth` only.
  - Fix: `requireEditor` / `requireRole(['admin'])`.
  - Number search no longer passes the carrier's raw error text to the customer.
  - Test: `test:demo-smoke` (in test:security):
    - every GET as the owner without a 5xx;
    - another customer can neither read nor change anything through any id-based endpoint;
    - viewers cannot write;
    - no token is refused.
- **#154 (ee12894):** pausing and then resuming a campaign scheduled for later started dialling at once.
  - Root cause: resume always set `running`.
  - Fix: it goes back to `scheduled`, keeping its start time, when it never started.
  - Test: test:audit-batch9 #154. It failed before the fix and passes after.
- **UI polish (bfd1038):**
  - Primary buttons had black text on black.
  - The Agents list showed a hard-coded phone number and date for every agent.
  - Call History: filter widths, raw status/end-reason codes, wrapping direction pills.
  - The Analytics chart height and colours were wrong, and busy calls were missing from the status boxes.
  - Batch and KB stat numbers used a font that is never loaded, so they rendered in Times.
  - "1 campaigns" / "1 numbers" plurals.
  - KB sizes showed "0.0 KB".
  - The Calendar listed finished campaigns as active.
  - Proof: docs/proof/demo-*-1440.png.
- **Tooling (70b8968, aaad3af):** `server/scripts/demo_backend.js` and `Frontend/scripts/demo-walkthrough.cjs`.
  - The backend runs the production routers on the TEST database, with a seeded workspace.
  - The walkthrough covers 21 views: all dashboard pages, the agent editor and Create Agent. It reports console errors, failed API calls, crashes, error banners and undefined/NaN text.
  - Result: CLEAN.
  - Owner write flows also checked against the real API: agent create/edit/delete, contacts, alert rules, QA cohorts, API keys, KB upload/query/assign, retention, notifications, campaign create/pause/resume/cancel. All succeed, and invalid input gets a clear 4xx message.
- **Not verifiable here:** live carrier calls, Gemini answers, Razorpay payments and emails. These need the rotated production keys (PROGRESS owner steps 11–19).
- **#155 (cf3fe5c):** the agent editor's Test LLM, the AI Companion and the conversational agent builder called Gemini directly.
  - Each had one model, no timeout and no retry. Test LLM and the builder ignored the workspace's own key. The Companion and the builder showed Google's raw error text.
  - Fix: they now use the shared client `services/ai/textModel`, which handles timeouts, retry, the fallback model, the workspace key and customer-safe errors. The client gains multi-turn history, cleaned by `sanitizeChatHistory`.
  - Test: test:ai-chat is 7/7; on the old code it was 1/7.
- **#156 (5d724ab):** the database's or Google's error text could reach the customer on three paths:
  - the Call History load failure;
  - a calling-configuration save failure;
  - Google Calendar linking.
  - Fix: plain sentences, plus a typed 404 for "not found".
  - Test: test:error-leaks is 3/3; on the old code it was 0/3.

## SEO, GEO and AEO content pass + product guide (2026-11-22, branch feat/seo-content-guide)
- **#157 (01c6ffb):** the KYC tab logged a 404 in every new customer's browser console.
  - Root cause: `/kyc/status` answered 404 before KYC had started.
  - Fix: it now answers 200 `{ provisioned: false }`, and the tab skips the call when there is no sub-account.
  - Test: test:error-leaks #157. It failed before the fix and passes after.
- **Product guide `/guide` (86532d7):**
  - 16 sections and 22 real dashboard screenshots (WebP, about 1 MB in total), taken from the demo backend with fictional data.
  - Quick start and FAQ, with HowTo, FAQPage, TechArticle and BreadcrumbList structured data.
  - Linked from the navbar, footer, FAQ and How It Works; listed in the sitemap with its images.
  - Proof: docs/proof/seo-guide-*.png.
- **Accurate content across the public site (86532d7):**
  - Home, Hero, FAQ (20 answers), How It Works, Voices, Solutions, Use Cases, AI Voice Agent Software, Security, Contact, the blog index and three blog posts, Footer, Navbar and the showroom.
  - Every false or unverified claim is listed in COMPLIANCE_NOTES "Website content pass".
  - Guard: test:marketing-claims went from 25 to 38 checks. Each new pattern matched HEAD before the change and matches nothing now.
  - The build gate checks the guide and the minimum crawlable words per page; it caught a thin /pricing.
  - e2e seo-guide.spec.ts: 4/4.
- **GEO:**
  - Organization, WebSite and SoftwareApplication (with offers) structured data on the home page.
  - llms.txt rewritten as a factual sheet.
  - robots.txt allows answer-engine crawlers and disallows /dashboard.
- **Not verifiable here:** rankings, indexing and traffic. These need Search Console after deploy (PROGRESS owner step 29).

## CI E2E harness and AUTH-TRACE errors (2026-11-22, branches fix/call-path-e2e 07199de, fix/auth-transient-errors 474acce)
- **Call Path E2E Lock & Timing Verification** had failed on all 26 runs since it was added (GitHub Actions emails). Five root causes, each reproduced locally:
  - The repo root is `"type": "module"`, so the harness `.js` files loaded as ESM and died on `require`. Fix: `e2e-call-harness/package.json` scopes the folder as CommonJS.
  - `ws` and `dotenv` are server dependencies, not installed at the root. Fix: resolved from `server/`.
  - The server ran without the test-DB guard and the simulator with it, so the carrier token differed between them and no Gemini key existed. Fix: both run through the guard with fixed `TEST_` values; the key only reaches the fake Gemini server.
  - The workflow database URLs lacked `sslmode=disable` (the app pool always asks for TLS).
  - The seed used "the first user in the database"; it is now a dedicated paying harness tenant.
  - Safety: `prisma db push --accept-data-loss` removed from `run_case.sh` (run locally it would have hit the database in `server/.env`); the script now requires `TEST_DATABASE_URL`.
  - Proof: `run_case.sh` locally: ALL 21 TEST RUNS GREEN (first audio 110-200 ms); street-smart 32/32, regression 41/41, eval bad caught / good 100.
  - "Trigger Render Deployment" failures in the same emails stopped on 2026-11-18 (fixed in Q8); every run since is green.
- **"Internal Server Authentication Exception (Reference: AUTH-TRACE-1795322434580)":**
  - Evidence: the reference is 04:40:34Z. Production `/live` showed the process started at 04:39:12Z, so the error came 82 s after a server restart. There was no git deploy at that time.
  - Root cause in code: `requireAuth` turned every thrown error into this 500, including a database connection that was briefly down. It also answered an unreachable Supabase with 401, and the dashboard signs the customer out on a 401.
  - Fix: `utils/transientErrors.ts` classifies connection-level errors. `requireAuth` answers those with 503 + `Retry-After` (code `AUTH_TEMPORARILY_UNAVAILABLE`, reference kept). Real bugs keep a 500 with a plain sentence and the reference. The log phase now says `user_lookup` for the user lookup.
  - Frontend: GET requests retry twice on 502/503/504; writes are never retried. The Agents page error text is now readable.
  - Test: `test_auth_transient.js` in test:security: 8/8; on the old code 3/8.
  - Regression: test:security 100%, OWASP 23/23, payment security 16/16, Playwright 149 passed / 1 skipped, typecheck 0, build OK.
  - **Not verifiable here:** the exact failing phase of that one production request. It is in the Render log line containing `AUTH-TRACE-1795322434580` (PROGRESS owner step 30).

## Double audit, frontend and backend (2026-11-22, branch fix/double-audit)
New guards, all wired into test:security:
- `test:api-contract`: 161 frontend calls checked against the 199 server routes by method and path. No mismatches.
- `test:query-junk`: 47 GET routes × 8 junk query strings, plus 75 write routes × 5 wrong-shaped JSON bodies. None may answer 500.
- `test:agent-tags`.

Browser tooling (local only; it refuses non-local hosts):
- `Frontend/scripts/demo-actions.cjs`: 9 real-API UI actions, 9/9.
- `demo-walkthrough.cjs` at 390 px: CLEAN.
- `site-audit.cjs`: 19 public pages at 2 widths, 111 internal links. CLEAN.

Fixes:
- **#158 (e07011d): text typed after a saved agent's generated prompt blocks was silently lost on Save.**
  - Root cause: a regex removed everything from the generated header to the end of the prompt.
  - Fix: the line parser `promptBlocks.ts` removes generated lines only.
  - Test: `e2e/agent-prompt-edit.spec.ts` (2 tests). They failed before the fix and pass after.
- **#159 (e303031): UI polish.**
  - Status codes are readable on phones and in Live Monitoring.
  - A failed retention change now shows an error.
  - Phone placeholders and flow-template transfer numbers are valid Indian numbers.
- **#160 (d2b448a): tags sent as text made agent create, get and update answer 500.**
  - Fix: `tagList` normalises them.
  - Test: `test:agent-tags` was 0/3 before the fix and is 3/3 after.
- **#161 (92e477d): an invalid date filter answered 500.**
  - Affected: Call History, chat history and audit logs.
  - Fix: they now answer 400 (`utils/queryDates.ts`).
  - Test: `test:query-junk`.
- **#162 (d267bfe): a NUL character in any input answered 500.**
  - Fix: the request is now rejected with 400 (`middleware/rejectNullCharacters.ts`), and KB documents are cleaned instead of failing.
  - Test: `test:query-junk` had 5 failures before the fix and passes after.
- **#163 (0bbfba7): DELETE /numbers/:id for a number the customer does not own answered 500.**
  - Fix: it now answers 404 (a typed AppError in `UsageSyncService.releaseNumber`).
  - Test: `test:query-junk` write-route pass, which failed before the fix and passes after. `test_carrier_accuracy` 8/8; `test_audit_batch4` 8/8.

Noted, not changed:
- CORS does not allow PATCH, but no client sends PATCH.
- `npm audit` (server, production dependencies) shows:
  - 4 high: prisma CLI at build time, and zod 3, which is accepted item A1;
  - 5 moderate: transitive dependencies of googleapis.
- Upgrades were deferred: node_modules is shared with another working session.

## WhatsApp instead of SMS, live transfer to a person or another agent (2026-11-22, branch feat/whatsapp-transfers)
Owner decisions:
- each customer connects their own WhatsApp Business account;
- the whole call is billed after a hand-off;
- all paid plans;
- SMS is replaced by WhatsApp.

- **Backend (3fd0adc):**
  - `runtime/callRouting.ts`:
    - routes come only from saved functions and flow nodes;
    - the AI picks a key and never a number, agent or template;
    - a paid plan is required.
  - `services/CallTransferService.ts` and `routes/transferWebhooks.ts`:
    - the carrier "transfer a call" request and the signed dial XML (caller ID = our number; the time limit comes from the time and minutes left);
    - the dial outcome: no answer = a spoken message plus a call-back notification.
  - `CallOrchestrator`:
    - `transfer_call`, `agent_transfer` and `send_whatsapp` handlers;
    - while the caller is with a person, only the carrier's final hangup ends and bills the call;
    - an agent hand-off continues the same call with a summary and the transcript, and falls back to the previous agent.
  - `services/whatsapp/*` and `routes/whatsapp.ts`:
    - Meta Cloud API v27.0;
    - consent first, approved templates only, limits;
    - fail-closed webhook, forward-only statuses, STOP opt-out, tokens encrypted.
  - Supervisor transfer in Live Monitoring now really transfers; it used to answer 501.
  - Save-time checks never block an unchanged old step.
  - Additive migration `20261122120000_whatsapp_and_call_transfers`.
- **Frontend:**
  - agent editor function types;
  - flow nodes (Call Transfer, Agent Transfer, WhatsApp Message);
  - the WhatsApp card in Integrations;
  - the Transfers & WhatsApp panel in Call History and the Reports drawer;
  - Live Monitoring transfer and the "with your team" badge;
  - FAQ, guide, llms.txt and the Privacy paragraph.
- **Found and fixed on the way:** #164 (example numbers in templates), #165 (false "message sent" claims), #166 (such flows could not be published). #167 is for the owner/lawyer.
- **Tests:**
  - `test:whatsapp` 16/16 and `test:call-transfer` 15/15, both in test:security; `test:marketing-claims` 39/39.
  - `e2e/whatsapp-transfers.spec.ts` 6/6, with screenshots in docs/proof/whatsapp-integration-{1440,390}.png.
  - Related specs 29/29.
- **Not verifiable here (needs real accounts):**
  - a real carrier transfer (Plivo/Vobiz) and the exact Dial callback fields on a live call;
  - the audio switch of an agent hand-off with a live AI session;
  - a real Meta send and webhook.

  Steps are in PROGRESS "Needs owner verification" item 31.

## AUTH-TRACE again + Edit Studio does nothing (2026-11-22, branch fix/auth-db-error-shapes)
- **Owner report:** "We could not verify your session ... AUTH-TRACE-1795370858084" (23:37:38 IST, about 2 h after the last deploy at 21:43), and "users can't open agents through the Edit Studio button".
- **Root cause 1 (proven on a real test database):** the earlier fix (474acce) was tested with hand-made error objects. Real Prisma 7 + adapter-pg errors look different: P2010/P2039 with the Postgres code inside `meta.driverAdapterError.cause` (`originalCode`, `kind`, `originalMessage`), and no `cause` chain. So these were all treated as bugs and answered with the 500 the owner saw:
  - a database restart or failover (57P01);
  - "too many clients" (53300);
  - the Supabase pooler limits ("Max client connections reached", EMAXCONNSESSION, XX000).
  A probe against the native test DB showed `isTransientDbError = false` for all of them.
- **Root cause 2:** most routers are mounted with `requireAuth` and list it again on each route (125 places), so every request verified the token with Supabase and read the user rows twice. That doubled connection use, which is exactly the pressure that triggers the pooler limit.
- **Root cause 3 (Edit Studio):** the Agents list can come from the browser cache (`cache_agent_rows`) while the server fails. The Edit Studio click then loaded the agent with no error handling, so a failed load was swallowed and nothing happened.
- **Fix:**
  - `utils/transientErrors.ts` reads Prisma 7's real shape (meta.driverAdapterError, adapter kinds, P2037, pooler messages); `describeDbError` puts the Prisma code, adapter kind and pg code in the log line.
  - `requireAuth` retries once on the server (300 ms) before answering 503, and authenticates a request only once, even when listed twice.
  - Edit Studio shows a disabled/busy state while loading and a dismissible message naming the agent and the reason (session ended, AUTH-TRACE reference, "Agent not found").
- **Tests:**
  - `test_auth_transient.js` (in test:security), with errors raised by the real test database: 15/15 pass; on the old code 9/15.
  - `e2e/edit-studio-open.spec.ts` 2/2; on the old App.tsx 0/2. Edit Studio specs (prompt edit, flow builder, test lab) 13/13.
  - Screenshots: Frontend/test-results/edit-studio-open-error-{1440,390}.png.
- **Not verifiable here:**
  - which of these errors production actually hit at 23:37. The new log line (code / adapterKind / pgCode) will say so next time; the old line is in the Render log under `AUTH-TRACE-1795370858084`.
  - whether the agent load failed in production for this reason or another. The page now shows the real reason.
- **Found, not fixed (pre-existing):** at 390 px the Agents page folder column takes about half the width, so the agent table is cramped (visible in the 390 screenshot).

## Features page: live transfers and WhatsApp (2026-11-23, branch feat/features-page-whatsapp)
- **Product Guide (`/guide`):**
  - New section "Live transfers and WhatsApp" under "Build your agent", with 6 steps and 5 tips.
  - 3 new screenshots: `handoff-functions`, `whatsapp-step` and `call-handoffs`.
  - The `integrations`, `agent-editor` and `call-transcript` screenshots were retaken.
- **Screenshots and demo data:**
  - Taken from the real dashboard against the demo backend.
  - The demo seed now holds fictional data: a connected WhatsApp number, a billing agent, the receptionist's three hand-off functions, and one transfer and one WhatsApp message.
  - `GUIDE_SHOTS=a,b` retakes only the named screens.
- **AI Voice Agent Software page:** 2 new feature cards ("Live Transfer to Your Team", "WhatsApp Follow-ups"). The grid is now 3 per row.
- **Call History:** the transfer label shows "front desk" rather than "front_desk".
- **Proof:**
  - Build gate: the guide has 17 sections and every screenshot exists.
  - Screenshots: `docs/proof/features-guide-transfers-whatsapp-{1440,390}.png` and `features-software-cards-{1440,390}.png`, with no sideways overflow.
  - Tests: marketing claims 39/39, demo smoke 5/5, guide and viewport specs 63/63.

## Agents page on phones and tablets (2026-11-23, branch fix/agents-mobile-layout)
- **Found during the Edit Studio fix:** below 1024 px the Agents page kept its 224 px folder column next to the main sidebar. The table box clips its overflow, so the row actions were pushed off-screen: at 390 px the Call button started at x = 835 px, and Call, Edit Studio, Export and Delete could not be reached on a phone. The Delete button also had no accessible name.
- **Fix (App.tsx, layout only):**
  - The folder column shows from 1024 px. Its only action, "Template Agents", opens the same create screen as "Create an Agent", which stays visible.
  - The header wraps; search is full width on phones.
  - Agent Type shows from 640 px; Voice, Phone and Last edited from 1024 px. Anything wider scrolls inside the table box, never the page.
  - Delete is labelled "Delete agent <name>"; the type badge stays on one line.
- **Tests:** `e2e/agents-mobile-layout.spec.ts`, at 390, 768 and 1440 px: every action is inside the viewport, no sideways scroll, and desktop still shows the folders and all six columns. 3/3 pass; on the old App.tsx 0/3. Full Playwright 166 passed / 1 skipped; typecheck 0; build OK.
- **Screenshots:** docs/proof/agents-mobile-390.png, agents-tablet-768.png, agents-desktop-1440.png.

## Session check redesigned: AUTH-TRACE on Edit Studio (2026-11-23, branch fix/auth-session-resolver)
- **Owner report:** "We could not open "Medical Clinic Receptionist". We could not verify your session ... AUTH-TRACE-1795435853155" (17:40:53 IST). Production had restarted at 17:33 IST with no deploy (`/live` uptime), and was already running the 2026-11-22 fix, so this was not a classified blip.
- **Ruled out, with evidence:**
  - shutdown disconnecting the database: Prisma reconnects by itself (probe: queries after `$disconnect` succeed, also during a burst);
  - named prepared statements on the transaction pooler: adapter-pg uses unnamed statements;
  - unique phone numbers: `contactNumber` is not unique;
  - the phone and email helpers: they cannot throw on odd input.
- **Root cause, reproduced on the old code:** for EVERY request the old check:
  - verified the token with Supabase;
  - read the user row, then looked the email up again;
  - WROTE the user row (`upsert`), which Prisma runs as read-then-write.

  A dashboard page fires about 10 requests in parallel with one token, so each page load meant 10 Supabase calls, 30+ queries and 10 writes to the same row. Proven failure: a new account's first page load (10 parallel requests) failed with P2002 `users_email_key` in `database_upsert`, which is exactly this AUTH-TRACE 500. Any failure in that write also blocked existing customers, whose request needs no write at all.
- **Fix (`middleware/auth.ts`):**
  - Parallel requests with the same token share one verification. Nothing is cached after it settles: sign-out, suspension and role changes still apply to the next request.
  - The user row is written only when the name or phone actually changed. A failed sync for an existing account logs a warning and uses the stored row.
  - The email lookup is skipped when the row already holds that email.
  - A new account's create re-reads the winner's row on P2002. This guard is defensive: I could not trigger the race through the new path, even with 8 tabs.
  - Same checks, statuses and messages as before: 401, 403 not-verified/disposable/suspended, 409 duplicate, IP allowlist per request.
  - A 500 now ends with `(stage/code)`, e.g. `(team_lookup/TypeError)`: the stage name and error code, never the message. The next screenshot names the cause even without the Render log.
- **Tests:** `test_auth_session_resolver.js` (new, in test:security) 9/9; on the old code 3/9. `test_auth_transient` 15/15. test:security exit 0 (PGlite), OWASP 23/23, payment security 16/16, typecheck 0, build OK.
- **Not verifiable here:** which stage failed for that production request. The old log line is in Render under `AUTH-TRACE-1795435853155`; any new error now names its stage on screen. Also why production restarted at 17:33 IST without a deploy (Render → Events / Logs: look for "uncaught exception", "out of memory" or a health-check restart).

## The real cause of the AUTH-TRACE errors: production database missing 5 migrations (2026-11-23, branch fix/deploy-schema-sync)
- **Evidence:** the new on-screen tag read `AUTH-TRACE-1795438024855 (user_lookup/42703)`. 42703 is Postgres "column does not exist". The Render log of the a571846 deploy showed `phone_numbers.inbound_enabled` and `batches.scheduled_at` missing. The build line read `Running build command 'npm install; npm run build'`.
- **Root cause:** the live service's dashboard Build Command (which overrides render.yaml) never touched the database. So none of the migrations after the baseline reached production:
  - `users.plan_expires_at` (20261119120000);
  - `phone_numbers.inbound_enabled` (20261118100000);
  - `batches.scheduled_at` (20261119090000);
  - `plivo_compliance_applications` (20261119130000);
  - WhatsApp + call transfer tables (20261122120000).

  Every request that read a full user row failed with 42703, which customers saw as "We could not verify your session". The two earlier AUTH-TRACE fixes were real hardening but not this cause. The stage/code tag added in fix/auth-session-resolver is what exposed it.
- **Fix:** `server/scripts/deploy_schema_sync.js`, run as `postbuild`, so it runs on every Render deploy without changing the dashboard:
  - asks `prisma migrate diff --from-config-datasource` for the SQL from the live database to schema.prisma;
  - applies only additive parts (CREATE TABLE, CREATE INDEX, ALTER TABLE ADD COLUMN / ADD CONSTRAINT, clause by clause) in ONE transaction, with lock and statement timeouts, plus a migration's one-time data step when its column is added (the inbound_enabled status conversion);
  - never drops, renames or retypes anything: those parts are logged as "kept as is";
  - re-checks afterwards;
  - uses session mode (5432) instead of the transaction pooler (6543) for schema changes;
  - runs only on Render (RENDER=true and no local .env), so a developer's build never touches the production database in server/.env (verified: the local build prints "skipped: not a Render build"). SCHEMA_SYNC=off disables it.

  If additive SQL fails, everything is rolled back and the build fails, so Render keeps the running version. render.yaml buildCommand now matches reality (no `db push`).
- **Tests:** `test_deploy_schema_sync.js` (test:schema-sync; its unit part is in test:security) 9/9 on a real Postgres built from the baseline (= production's state):
  - reproduces the 42703;
  - the sync adds every missing column and table;
  - the full-text index and an extra column survive;
  - the inbound data step runs;
  - a second run changes nothing;
  - a failing statement rolls back everything (exit 1).

  test:security exit 0 (PGlite), OWASP 23/23, payment 16/16, typecheck 0, build OK.
- **Not verifiable here:** the run against production itself. The Render build log will show `[schema-sync] apply: ...` lines and `database schema is up to date`; anything listed as "kept as is" is drift for the owner to review.

## Admin console: defects fixed + Control Panel (2026-11-23, branch fix/admin-panel, commits 40a5c1d..7842263)
- **Issue (owner):** the admin folder was "full of bugs"; the owner wants to change business settings from a panel instead of code, with 2FA for the owner too (decision 2026-11-23: all four areas — plans & prices, customer plan control, platform switches, staff limits).
- **Root causes (backend, `routes/adminRoutes.ts` unless noted):**
  - Money: a failed Razorpay refund was still saved as "refunded"; refunded customers kept their minutes; two clicks could refund twice. Payment links were a made-up URL (`pages.claritiy.com/pay/...`) with browser-set price/minutes, never sent to Razorpay. Custom plans accepted built-in keys, duplicates (500) and nonsense, and the discount cap trusted a percent typed in the browser. Custom plans were never sellable.
  - Secrets: Customer 360 returned the whole user row (password hash, the customer's own Gemini key, encrypted calendar tokens, carrier sub-account token, full PAN/Aadhaar) to every staff role.
  - Auth: owner skipped 2FA; the router rate limiter was keyed by a staff id that is unknown before sign-in, so every caller shared one bucket; invited staff became active before 2FA; DB errors answered 401.
  - Broken actions: force sign-out passed a user id where Supabase expects the user's token (and searched only the first 50 users) yet audited success; "Retry order" set a state nothing processes and stranded the customer on "purchase already in progress"; "activate number" marked KYC verified without any check; "KYC reset" flipped one flag that blocked calls while the real KYC stayed unchanged; exports opened without the token (always 401); call list customer links used a field the API never sent; customer sort sorted one page only; "minutes" like "abc" reached the database (error leaked a server path); no idempotency key, so double clicks granted twice; the daily grant cap reset at 05:30 IST (UTC midnight); suspension categories in the UI did not exist on the server; provisioning alerts were fetched but never shown; Settings showed fixed text (e.g. "IP allowlist enabled" when it was not); the console was built with a relative base so any deep link/refresh (e.g. `/customers/<id>`) was a blank page; owner recording playback sent the raw carrier URL to the browser and was not audited.
- **Fix:** validation + audit on every write; refund = claim → Razorpay → record (minutes taken back, optional "end plan now"); real Razorpay payment links (create/list/cancel) priced by the server and credited with the minutes they promised; custom plans validated with a server-computed discount and on/off; explicit Customer 360 field list with masked KYC numbers; 2FA for every role; per-staff limiter inside `requireStaff`; force sign-out via new `users.sessions_revoked_at` (additive migration `20261123120000_user_sessions_revoked_at`) checked against the token's original sign-in time (`amr`); KYC-bypass routes removed; "retry" replaced by an audited "resolve"; signed, audited recording links; server-side sorting; absolute Vite base (`/` own domain, `/admin/` via build_all).
- **New (Control Panel, owner only):** `services/PlatformConfigService.ts` stores overrides in `admin_settings` (no schema change) and applies them in place to `PLAN_CONFIG`, so checkout, limits and concurrency follow; 30 s refresh; money/call/sign-up paths wait for the first load after a restart. Checkout stamps price+minutes into the Razorpay order notes; verify, webhook and reconciliation honour them, so a price edit never breaks a payment in progress. Switches: pause all outgoing calling (calls refused, scheduled calls left for later, campaigns paused with a marker and auto-resumed), pause new sign-ups (existing customers unaffected), dashboard banner. Staff caps editable (owner fixed unlimited). Announcements to every customer's bell. Customer plan control: assign a plan without payment / extend validity (new permission `plans:assign`: owner, admin), idempotent per request key. Public `GET /api/v2/public/platform` feeds the website (live prices, plans off sale hidden), the dashboard banner and the sign-up notice.
- **Files:** server `routes/adminRoutes.ts`, `routes/publicPlatform.ts`, `services/PlatformConfigService.ts`, `middleware/requireStaff.ts`, `middleware/auth.ts`, `admin/{capEnforcement,permissions}.ts`, `services/{BillingService,PlanFulfillmentService,PaymentReconciliationService,CallService,ScheduledCallService,BatchService,VobizPhoneNumberService}.ts`, `routes/{razorpayWebhook,user}.ts`, `config/plans.ts`, `index.ts`, `prisma/schema.prisma` + migration; Admin `src/**` (new ControlPanel, Dialog, RefundDialog, CustomerPlanControls, format), `vite.config.ts`; Frontend `lib/plans.ts`, `components/platform/PlatformBanner.tsx`, Pricing, Hero, AiVoiceAgentSoftware, LottieVoiceOrb, AuthGateway, App.tsx; `scripts/build_all.js`.
- **Tests:** `test:admin-panel` (12, all failed before), `test:platform-config` (10), both in test:security; `e2e/live-platform.spec.ts` (4); admin browser proof 15/15 (stubbed API, `docs/proof/admin-panel/*.png` at 1440 and 390); re-run green: billing 21/21, plan lifecycle, batch compliance, scheduled calls, sign-up, auth resolver/transient, call limits, marketing claims, number entitlement, API contract, query junk, Playwright 163 passed (3 load flakes re-run 51/51 with no retries).
- **Not verified here:** real Razorpay payment links and refunds (test keys on staging), owner 2FA enrolment on production Supabase, the console reaching production from its real origin (`ADMIN_ORIGIN`), a live call refused while "pause outgoing calls" is on. Owner steps 33-36 in PROGRESS.md.

## Refunds only by the owner's decision (2026-11-23, branch fix/refund-owner-decision)
- **Owner rule:** nothing is refunded automatically; failures are reported in the admin console and the owner decides, with one click, whether to refund (Razorpay refunds and the customer is updated).
- **Before:** `/numbers/purchase` refunded on its own in four places (slot already taken, carrier refused, price changed, any other setup failure; audit #4). The 15-minute payment check only wrote "paid number never set up" to the log, so those cases were invisible in the console.
- **Now:** `services/PaymentIssueService.ts` records the payment, opens one PAYMENT_REVIEW case per payment (internal, never in a customer's bell) and tells the customer once that the money is safe and the team will contact them. Admin: `GET /payment-issues`, `POST /payment-issues/:id/close` (no refund, audited); the existing Refund (`POST /payments/:id/refund`) now also sets `refundedAmount`, closes the case and notifies the customer (bell + email). Console: Payments → "Waiting for your decision" (Refund / Close without refund) and an Overview pointer.
- **Tests:** test:admin-panel A13 (case once, no refund by itself, one-click refund closes it and notifies, close without refund audited); audit batch 4 #4 rewritten to the new rule (failed against the old automatic-refund code: `refunded true !== false`); billing 21/21 and number entitlement 9/9 updated; admin browser proof 19/19 (`docs/proof/admin-panel/admin-payment-decision-1440.png`).
- **Not verified here:** a real Razorpay refund and the refund email (needs test keys and RESEND_API_KEY on staging; owner step 35).

## Admin console without login: owner access key (2026-11-24, branch feat/admin-access-key)
- **Owner request:** remove the admin console login. Removing every check would have let anyone who knows the public API address (it is in the customer site's JavaScript) refund, change prices and read all customer data, so the login was replaced by an owner access key instead.
- **Change:** `requireStaff` accepts `x-admin-access-key` equal to `ADMIN_ACCESS_KEY` (>= 32 chars, sha256 + timingSafeEqual; off when unset/short) as the platform owner (staff row upserted, audit entries name the owner, rate limit and ENABLE_STRICT_AUTH/IP allowlist still apply); CORS allows the header. Admin console: `VITE_ADMIN_ACCESS_KEY` (admin Vercel project only) skips Supabase, login and 2FA screens and hides Sign Out; without it the normal sign-in flow is unchanged.
- **Tests:** test:admin-panel A15 (right key = owner; wrong, short, unset key refused; ENABLE_STRICT_AUTH still required); key-build browser proof 4/4 (`docs/proof/admin-panel/admin-access-key-1440.png`); normal-build browser proof 19/19.
- **Not verified here:** the real Vercel/Render deploy with the key set (owner step 33a).

## Admin console unreachable on its Vercel address + Render log errors (2026-11-23, branch fix/admin-vercel-access)
- **Issue (owner):** the admin Vercel link "does not open"; Render log full of `CORS_ORIGIN_BLOCKED`, `Vobiz initialization failed ... 404`, repeated `[VOBIZ_KYC_MODE]` refusals.
- **Root causes:** (1) CORS and the `/api/v2/admin` gate accepted exactly one console origin (`ADMIN_ORIGIN`, default admin.claritiy.com), so the console on `*.vercel.app` was refused; the log never named the refused origin; CORS methods lacked PATCH (used by 3 console actions). (2) No way to create the first owner: staff can only be invited by an owner. (3) `VobizProvider` used `VOBIZ_API_URL` raw (production: bare `https://api.vobiz.ai`), so its start-up check, call placing, hang-up, status and transfer requests went to paths without `/api/v1` and got 404; the failed check then left NO telephony provider registered until the next restart. (4) The legacy KYC-mode job retried every 30 min, forever, sub-accounts Vobiz does not have (leftover `SA_TEST_`/`SUB_BATCH_` rows) and the platform owner's own account (409: email already used by the master account).
- **Fix:** `ADMIN_ORIGIN` takes a comma list of exact origins (no wildcard), used by CORS and the admin gate; refused origins logged once a minute; PATCH allowed. Owner bootstrap for ADMIN_EMAIL (confirmed email, still 2FA). `VobizProvider` normalises to `<root>/api/v1` like every other Vobiz caller and stays registered when the boot check fails (loud `[ADMIN_ALERT][VOBIZ]`). 404 from the switch marks the row `missing_at_carrier` (never retried); platform admin accounts skipped.
- **Tests:** test:security-hardening CORS list case; test:carrier-accuracy 10/10 (URL for all four setting forms; boot failure keeps telephony; ghost sub-account tried once; admin skipped); test:admin-panel A14 (bootstrap); full test:security.
- **Not verified here:** the real Vercel address (owner sets ADMIN_ORIGIN on Render); a live call/hang-up through Vobiz after this deploy (check the log shows `Providers: Vobiz telephony initialized`).

## Deploy schema sync: foreign keys added NOT VALID (2026-11-23, branch fix/schema-sync-fk-not-valid)
- **Render build of 80e3140 failed safely.** The sync found production missing more than the 5 known migrations: also `notification_receipts`, `kyc_email_logs`, `test_lab_runs`, and 5 foreign keys on the calendar tables. Adding `calendar_bookings_agent_id_fkey` failed because an old booking points to an agent that no longer exists. Everything rolled back, the build stopped, and the running version stayed live, as designed.
- **Fix:** foreign keys are now added `NOT VALID`. Postgres enforces them for every new and changed row without checking or touching old rows. Inside the same transaction the sync then tries `VALIDATE CONSTRAINT` under a savepoint; if old rows do not match, it logs a note and keeps going. No row is changed or deleted.
- **"Kept as is" lines in that log (harmless, left alone):** `updated_at` defaults on 3 calendar/scheduling tables, and older names for 6 indexes.
- **Test:** `test_deploy_schema_sync.js` reproduces production (no agent foreign key + a booking of a deleted agent). The 80e3140 script fails with the same error; now 10/10: key added NOT VALID, old row untouched, new orphan rows refused (23503), second run changes nothing.

## The agent greets, then never answers the caller (2026-11-23, branch fix/gemini-audio-input)
- **Owner report:** desktop test call: "agent spoke, I answered back but no response", and "this same issue happened many times".
- **Root cause:** caller audio went to Gemini as `realtime_input.media_chunks`. Google deprecated that field, and the primary model `gemini-3.8-live` silently drops it: no error, the model just hears nothing. The greeting is sent as text, so it still worked.
  - Desktop tests (SandboxStreamHandler) and phone calls (pipeline → `GeminiLiveProvider.sendAudio`) share this one function, so both were affected.
  - Earlier attempts flipped between formats (call_process_log.md, 2026-07): `audio` was rejected then only because it was sent together with `media_chunks`.
- **Why tests never caught it:** the call harness's fake Gemini answered ANY `realtime_input`, and its only audio check (first AI audio within 3 s) is met by the greeting alone. The harness was green while real calls were deaf.
- **Fix:**
  - `GeminiLiveProvider.buildRealtimeAudioMessage`: caller audio is sent as `realtime_input.audio` (`audio/pcm;rate=16000`), the only field in the message. Google's current reference uses it, and the fallback model accepts it too.
  - The per-chunk log line (50-125 per second per call) became a line on the first chunk and every 1000 chunks; the per-chunk model-audio line is debug-only (timing stays in callTimingTracker).
  - The boot self-test also reads `GOOGLE_API_KEY`. It printed "empty GEMINI_API_KEY" on a server whose calls work.
- **Regression locks:**
  - `e2e-call-harness/fake_gemini.js` now behaves like gemini-3.8-live: it hears only `realtime_input.audio`, silently drops `media_chunks`, rejects both together (1007), and reports `/control/stats`.
  - `call_sim.js` Requirement 4: the caller speaks (a loud tone) and the fake must report it heard it.
  - `scripts/test_gemini_audio_input.js` (test:gemini-audio, in test:security): greeting → caller audio → the agent answers; the log is not flooded; no code sends `media_chunks`.
- **Proof:**
  - test_gemini_audio_input: 0/4 on the old code (the agent's audio = ["greeting"] only), 4/4 now.
  - Call harness on the old code: Requirements 1-2 pass, Requirement 4 fails ("heard 0 frames, dropped 50").
- **Not verifiable here:** a real call against Google with the production key. After deploy: one desktop test and one phone call; the agent must answer. The Render log shows `[CALLER_AUDIO] forwarding caller audio to Gemini` once per call start.

## Error sweep 2026-11-24 (loop) — lint, admin Ctrl+K, zod memory DoS, test tooling
- **fix/eslint-config** — Issue: `npm run lint` crashed on load (`eslint-config-next` not installed; this repo has no Next.js), so no lint rule had ever run. Fix: `eslint.config.mjs` = @eslint/js + typescript-eslint 8.72.2 + react-hooks 7.1.1 (pinned); bug-class rules block, style debt (any, require, unused vars) warns. CI runs `npm run lint -- --quiet`. Lint-only edits, same behaviour: CSV BOM written as `﻿` (adminRoutes), redundant `Boolean()` (CallOrchestrator), regex `{2}` (test_recording). Proof: 0 errors; no rules-of-hooks violation anywhere.
- **fix/admin-ctrl-k** — Issue: the admin sidebar shows "Ctrl+K", but the shortcut never opened the search palette. Root cause: the listener lived in CommandPalette and could only close it (`isOpen ? onClose() : undefined`); AdminLayout owns the open state. Fix: AdminLayout toggles on Ctrl/Cmd+K; the palette keeps Escape. Test: `Frontend/e2e-admin/command-palette.spec.ts` (first admin browser test, `npx playwright test -c playwright.admin.config.ts`, in CI). Old code 1/3, fix 3/3.
- **fix/zod-4** (SECURITY_AUDIT A1, high) — Issue: one request could exhaust server memory. Root cause: zod 3 builds one issue per bad item; the 10 MB body cap did not prevent it (300,000 issues from one Prompt Coach request). zod 4 stops at a size limit, but a collection without one still makes one issue per item (~640 MB for 2 M items). Fix: zod 4.6.7; Prompt Coach `businessFacts` key cap (50) before the values; agent tags already `.max(50)`. Kept: `z.record(key, value)`, `ZodError.issues`, `z.guid()` for IDs (zod 4 `.uuid()` refuses non-RFC IDs), `PORT` default 3001 as a number. Files: server/package.json, config/env.ts, middleware/validation.ts, routes/agents|calls|contact|reports|team.ts, types/promptCoach.ts. Test: `test:validation-limits` (in test:security), old code 3/8, fix 8/8; full test:security green on the merged tree.
- **fix/demo-backend-routes** (test tooling) — `scripts/lib/demoApp.cjs` had drifted from `src/index.ts`: `/api/v2/public`, `/recordings`, `/contact` were missing, so the real-API walkthrough reported 42 problems production does not have. Now: walkthrough CLEAN (21 pages at 1440 and 390 px), demo-actions 9/9.
- **fix/site-audit-robust** (test tooling) — `site-audit.cjs` crashed on a page that navigated mid-check; it now lists that page and continues. Site audit CLEAN (19 pages x 2 widths, 111 links).
- **Not verifiable here:** none of these need a live service. After deploy, Prompt Coach "Generate" on the live site should behave as before.
- **fix/frontend-supabase-auth** — Customer app pinned `@supabase/supabase-js` 2.45.0 (auth-js 2.65, advisory GHSA-8r88-6cj9-9fh5, low); the pin existed only to pass Vercel's pnpm release-age rule. Now 2.117.3 pinned (the admin console's version, released 2026-10-07). Default auth flowType still `implicit`, so OAuth/reset links keep their shape. Proof: pnpm audit 1 → 0, tsc 0, auth specs 14 passed (1 skipped live sign-in, as before), full Playwright 170/170. Not verifiable here: real Google sign-in and a real reset email (owner steps 6-7).
- **fix/css-dead-font-import** — `neumorphism.css` had an `@import` for Outfit after other rules, so the build dropped it (Vite warning) and Outfit never loaded in production, although `body` asks for it. Measured: no visible text on /, /pricing, /login uses Outfit. Removed the dead line; built CSS byte-identical (same hash). Font choice left to the owner (PROGRESS open question 6).
- **fix/googleapis-advisories** (SECURITY_AUDIT A2) — `googleapis-common` 8.0.3 pins gaxios 7.1.3 → rimraf/glob/minimatch advisories. npm `overrides` → gaxios 7.3.1. Proof: audit 5 moderate → 0; real calendar request through gaxios to a local fake server 200; calendar suites green. Left: A4 prisma CLI (build-time only).
- **fix/auth-transient-test-race** (flaky test) — `test_auth_transient` failed once in the full chain (14/15): after raising 57P01 the pool drops its connection, so the next captured "real query bug" (42883) could come back as "connection terminated" (correctly transient). `realDbError` now keeps only an error carrying the requested code (5 tries). Proof: 5 consecutive runs 15/15.
- **Investigated, not a defect:** one Playwright retry (batch-launch) and two cold-cache failures were Chromium "Target crashed" on this 5.9 GB machine (0.8 GB free); Vite log showed no reloads; 8/8 on repeat.

## Error sweep round 3 (2026-11-24) — AI Companion memory; hook-warning review
- **fix/companion-memory** — Issue: the AI Companion voice call (dashboard → AI Companion → Talk Now) forgot everything after the first sentence, although the page and its prompt promise "strong memory". Root cause: the speech recognizer is set up once (`useEffect(..., [])`), so `onresult` called the first render's `handleUserSpeech`, whose `history` was always `[]`; every `POST /agents/:id/chat` sent `history: []`. Fix: the conversation lives in a ref, and the recognizer calls the latest handler through a ref. The `onerror` restart read a stale `callState` (always "idle", so it never ran) and was removed; the browser fires `onend` after an error and `onend` already restarts listening. Call buttons got aria-labels (Start talking / Pause listening / End call). Files: Frontend/src/app/DashCompanionCall.tsx. Test: Frontend/e2e/companion-memory.spec.ts (scripted speech recognition/synthesis): old code sends `history: []` on turn 2 (fails), fix sends both earlier turns (3/3 repeats); 390 px fits. Screenshots: docs/proof/companion/. Not verifiable here: real browser speech (Chrome mic + speech service).
- **fix/companion-test-fake** (test only) — the regression run showed the new companion test flaky (2/15 under 3 workers): the fake recognizer accepted speech before firing `onstart`, which real browsers never do. Fixed the fake (speech only after onstart) and a lint error in it. Proof: 20/20 under 3 workers; still fails on the pre-fix component; full Playwright 172 passed, 0 flaky.
- **fix/real-call-modal-fallbacks** — Issue: the Test Call modal (agent card "Test Real Call", Calling Config "Test Call", Phone Numbers) showed a placeholder caller ID "+918065530386 (Claritiy System Line)" and the platform owner's agent "Claritiy Voice Assistant (Default)" whenever a list was empty or still loading; Inbound told the customer to dial the platform's number. The server refuses both for customers, so those calls always failed, and the inbound advice pointed callers at the wrong line. Root cause: hard-coded fallback options instead of empty/loading states. Fix: loading state (call waits), "No phone number yet" + guidance (button enabled: the server decides; the owner may call without a number), "No agents yet" + guidance (button disabled), Inbound explains a number is needed and names the number's assigned agent. Files: Frontend/src/app/components/calls/RealCallModal.tsx. Test: Frontend/e2e/real-call-modal-empty.spec.ts (3 cases, 9/9 over 3 repeats); probe of visible text: old shows platform line + default agent, fixed shows neither. Screenshots: docs/proof/real-call-modal/.
- **Unused-variable sweep (171 warnings), checked for hidden bugs:** no unused limiter/auth/validator import anywhere (no unprotected route). Checked and correct: razorpay webhook `eventId` (dedupe is by paymentId), calendar `workspaceId` (route checks ownership first), CallFinalizer `metadata` (reads the DB), voicemail / flow speech pass-through state (saved values preserved). Server `initiateCall` looked up the agent without an owner filter (fixed next, below). The flow builder has no interruption-sensitivity/volume control (values preserved; feature gap, not a defect).
- **fix/initiate-call-agent-owner** (governance §3, tenant isolation) — Issue: `POST /api/v2/calls` read the agent with `findUnique({ id })`, so another customer's agent passed the controller (CallService refused it later), any customer who sent the legacy default-agent id made the server create that agent under the platform owner's account (a 500 with Prisma internals where that owner row is missing), and the 404 echoed the id. Fix: customers → `findFirst({ id, userId })`; only the platform admin keeps the legacy default agent; one 404 "Agent not found" without the id. Files: server/src/controllers/CallController.ts. Test: `test:call-agent-owner` (in test:security), production routers on the test DB, no carrier: old 1/3, fix 3/3.
- **fix/vobiz-kyc-status-poll** (owner report 2026-11-25: "KYC is taking too much time for approval") — Root cause: nothing asked Vobiz for a pending customer's KYC result. It changed only if Vobiz's webhook reached us (needs `VOBIZ_WEBHOOK_SECRET` + URL in the Vobiz console; the handler's "next poll will retry" pointed at a poll that did not exist) or when the customer opened Calling Config. `GET /kyc/status` stores the verdict but by design activates nothing. An approved customer could stay "pending", calls blocked, number off, indefinitely. Plivo already had a 15-min poll. Fix: `VobizKycStatusPoll` (boot job, every 5 min, 50 pending sub-accounts per run, least recently checked first) through the existing `syncKycStatus`; a real change is announced once via the webhook's `notifyUserKycStatus` (email de-duplicated by `kyc_email_logs`); mock/admin skipped; no schema change. Test: `test:vobiz-kyc-poll` (in test:security) against a fake Vobiz: before 0/1, after 6/6. Not verifiable here: Vobiz's own review time (carrier side; DigiLocker is near-instant, document review can take hours to days), and whether the Vobiz console webhook is configured (owner step 37).
- **Hook warnings reviewed, no other defect:** the remaining react-hooks/exhaustive-deps warnings (Reports date filter, Live Monitoring socket, call modal defaults, agent panel resync, Pricing resume-after-login, admin pages' fetch-on-mount) are intentional patterns; each was read and judged correct.

## fix/kyc-single-truth (owner report 2026-11-25: own account "pending" on the customer KYC page, "verified" in the admin console)
- **Root cause:** three different KYC answers. (1) The 5-minute poll / calling-config sync / admin re-check (syncKycStatus) treated an admin account by the MASTER account's KYC and stored "verified"; (2) GET /kyc/status read the personal_use sub-account, forced "pending", tried to switch it to customer_use (Vobiz refused: the owner's email is the master's) and stored "pending" - so the stored value flipped with whichever path ran last; (3) GET /kyc/documents built its own headline from local document rows. A "sticky verified" rule also hid a real carrier downgrade for customers.
- **Fix (one writer, one reader):** VobizSubAccountService.refreshKyc is the only writer (customer KYC page, admin re-check, 5-min poll, webhook, mode switch, calling-config sync). Rule (Vobiz docs, sub-account KYC): a customer is verified only when kyc_mode=customer_use, overall_status=verified and kyc_calls_blocked=false; overall failed = failed; else pending. The platform's own account (accountType admin / owner email) on personal_use inherits the company KYC, verified only while Vobiz does not block its calls, labelled "Company KYC". No sticky state; carrier silent = nothing changes. It also stores the carrier's per-document result + last-checked time (additive migration 20261125120000, nullable), mirrors the state to KYC-gated numbers, fills verified document references, audits, notifies a change once and activates numbers. utils/kycStatus.kycSummary is the only reader: /kyc/status, /kyc/documents (and the dashboard tab badge), admin KYC list, customer 360 and re-check all return it. Webhook accepts the documented account_auth_id and "sha256=<hex>" signature (HMAC of the raw body with the master auth token).
- **Tests:** test:carrier-accuracy 11/11 (new: verdict table per docs; platform account stored identically by every path, changed once, no PUT; carrier downgrade shown; carrier silent = no change; signed documented webhook, forged one refused; no second writer in the source). test:vobiz-kyc-poll 6/6, test:audit-batch1 8/8, test_admin_panel 16/16 (A16 now runs the real writer with only the carrier call stubbed). Before: the new single-truth test fails on the old code (no refreshKyc; admin and customer paths stored different values).
- **Not verifiable here:** the live Vobiz answer for the owner's sub-account. After deploy: owner step 38 (PROGRESS).

## fix/kyc-platform-master (owner report 2026-11-25, after fix/kyc-single-truth: "my KYC is verified at Vobiz as the main account; Claritiy and admin say pending, calls blocked")
- **Root cause (my error in fix/kyc-single-truth):** the owner's account was judged by its leftover personal_use sub-account (verified only if Vobiz said that sub-account's calls were not blocked; a row marked missing_at_carrier was never re-checked). The owner's account is the carrier's MAIN account, already KYC-verified by Vobiz; Vobiz documents no KYC field for a main account (GET /auth/me has none). The previous code read the main account and had it right for the owner. Second defect found: the inbound-call KYC gate had no owner exemption (outbound had one), so a "pending" row could also refuse calls to the owner's numbers.
- **Fix:** utils/kycStatus: isPlatformAccount accounts are the main account: kycSummary = verified, calls not blocked, source 'company', with or without a sub-account row; vobizKycVerdict is now customer-only. refreshKyc corrects the owner's stored row to verified with no carrier call and no customer_use switch; syncKycStatus never creates a sub-account for the owner; the 5-minute poll now also corrects a stale owner row. /kyc/status and /kyc/documents read the owner flag from the user (not the sub-account row) and return kycCallsBlocked; InboundCallService gate exempts the owner exactly like CallService. UI: "Main carrier account (owner) — KYC done with the carrier"; no re-check button / document count for it.
- **Tests:** new test:carrier-accuracy "owner account" case (the reported state: personal_use sub-account blocked at Vobiz, row missing_at_carrier + pending) fails on the previous code (11/12: "every path stores verified, calls not blocked") and passes now (12/12); poll 6/6 (owner row corrected without a carrier call); audit-batch1 8/8; error-leaks 4/4; admin panel 16/16.
- **Not verifiable here:** production state of the owner's row; after deploy, PROGRESS owner step 38.

## fix/kyc-owner-numbers (self-review after fix/kyc-platform-master, 2026-11-26)
- **Issue found on review:** the owner fix covered the account row and the inbound ACCOUNT gate only. Each phone number also stores its own kycStatus (Vobiz numbers that need Aadhaar). Calling Configuration and Phone Numbers show that field ("KYC Verification Pending"), and the inbound PER-NUMBER gate refused calls unless it said verified - with no owner exemption (outbound already skips both for the owner). Any owner number stored "pending" (at purchase, or by fix/kyc-single-truth) stayed pending: the 5-minute job only looked at accounts marked pending, and the owner path ignored numbers and owners without a sub-account row.
- **Fix:** refreshKyc's owner path (with or without a sub-account row) sets the row and the owner's KYC-gated numbers verified in one transaction and runs activation; the 5-minute job refreshes owner accounts every run (no carrier call); InboundCallService per-number gate exempts the owner exactly like CallService. Checked that no customer can get the owner flag: accountType 'admin' is set only for ADMIN_EMAIL at sign-up; plans and the admin panel accept only trial/starter/developer/professional/enterprise.
- **Tests:** test:carrier-accuracy owner case extended (owner row verified + number pending -> verified and active via the 5-min job; owner without a row too; a customer's pending number untouched; both inbound gates exempt the owner): fails on the previous code (11/12, "owner number verified and active"), passes now (12/12). Poll 6/6, audit-batch1 8/8, error-leaks 4/4, caller-id 5/5, admin 16/16, test:security green.
- **Not verifiable here:** the production rows; after deploy, Calling Configuration must show your numbers as "KYC Verified" within 5 minutes and an inbound call must ring (PROGRESS step 38).

## fix/kyc-doc-approval-carrier (self-review, 2026-11-26)
- **Issue found on review:** a second KYC writer. When a customer's PAN/GST or Aadhaar check passed, checkAndApplyFullKycApproval set the ACCOUNT verified, unblocked calls, activated numbers and sent the "full KYC approved" email - without the carrier's account verdict. The single writer then read Vobiz (still blocking) and set it back to pending: the same flip-flop the owner reported, for customers, plus an approval email before approval (CLAUDE.md B9: "never auto-approve; no approval email before approval").
- **Fix:** both document routes now call the single writer (refreshKyc, source kyc_document_verified), non-fatal if the carrier is unreachable (the 5-minute job retries). checkAndApplyFullKycApproval, notifyFullKycApproved and their imports removed. The approval email is the one refreshKyc sends when the carrier verifies (once, kyc_email_logs).
- **Tests:** new test:carrier-accuracy case (documents verified, carrier still blocking -> account pending, calls blocked, no approval email; after the carrier approves -> verified) fails on the previous code (12/13, "no approval email before the carrier approves": 1 !== 0) and passes now (13/13). test:audit-batch1 now asserts KycVerificationService never writes the account KYC. number-entitlement 9/9, PAN suites pass, test:security green.
