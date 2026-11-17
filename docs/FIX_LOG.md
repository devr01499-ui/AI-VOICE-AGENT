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
