# Defect audit — 2026-11-18 (post-launch-prep sweep)

Read-only sweep of the whole platform: five area audits plus strict TypeScript checks. **143 findings** (the dashboard and website audits' overlapping items are merged).

Paths: `SV` = `server/src`, `FE` = `Frontend/src/app`.

**V** = re-checked by hand against the code (17 of 17 checks confirmed). The rest are reported with exact file:line and a concrete failure scenario, but have not been hand-checked yet. Re-verify each one before fixing it (CLAUDE.md §5).

Severity: H high, M medium, L low.

## Fix status (updated as each batch lands; each fix has a test that fails on the old code)
| Batch | Commit | Fixed |
|---|---|---|
| 1 | c622170 | #1 #2 #3 #6 #17 #32 #79 #90 (tests: test:audit-batch1, test:minutes-race) |
| pricing | 6432e82 | #111 #112 #113 #115 #116 #117 #118 #119 #132 #133 (test:marketing-claims) |
| 2 | 64f9086 | #43 #44 #45 #51 #76 #78 #81 #82 #83 #84 #91 #92 #97 #141 (test:audit-batch2, e2e audit-dashboard) |
| 3 | 12aea83 | #46 #47 #48 #54 #57 #63 #64 #77 #80 #86 (test:audit-batch3, e2e audit-dashboard) |
| 4 | 3ab90e6 | #4 #5 #12 #22 #23 #24 #25 #26 #27 #42 #144 (test:audit-batch4) |
| 5 | 9bd8c13 | #28 #29 #30 #31 #35 #36 #38 #114 #145 (test:audit-batch5, e2e audit-pending-plan) |
| 6 | d8171bb | #8 #9 #10 #13 #14 #15 #16 #18 #19 #20 #21 #40 (test:audit-batch6) |
| 7 | a07d7ed | #11 #49 #50 #60 #61 #88 #89 (test:audit-batch7) |
| 8 | dccab7a | #33 #34 #37 #39 #146 (test:audit-batch8) |
| 9 | ea9b5f2 | #7 #52 #53 #55 #56 #58 #59 #62 #65 #95 #101 #150 #151 (test:audit-batch9) |
| #148 | 7c19afa | scheduled follow-up calls (test:scheduled-calls) |
| models | cde3afd | Gemini 3.8 Live + removed models dropped (owner request; test:gemini-models) |

Everything not listed above is still OPEN. New findings while fixing:
- **#144** (fixed, batch 4) `CallOrchestrator.initiateOutboundCall` always stored `userData: '{}'`, so per-call variables (e.g. a batch contact's name) were lost.
- **#145** (fixed, batch 5) H `SV/websockets/AudioStreamHandler.ts`: an unauthenticated audio-stream connection naming a call id marked that call failed (no token needed).
- **#146** (fixed, batch 8: compression + resumption enabled, handles captured, resume reuses the full setup and key; a live 15+ min call is an owner check) H `SV/providers/gemini/GeminiLiveProvider.ts`: Google caps an audio Live session at about 15 minutes unless session resumption / context-window compression is used. Neither is enabled, and the resumption payload uses a wrong field (`setup.resumptionHandle` instead of `setup.sessionResumption.handle`), so calls longer than ~15 min (max duration is 30 min) can drop to a fresh session. Needs a live test against Google before changing.
- **#148** FIXED (ScheduledCallService: claimed per row, DNC + calling-hours checked, retries, restart-safe; test:scheduled-calls 7/7). Daily report email deliberately NOT wired: nothing in the product promises it, and emailing every customer daily without opt-in would be unsolicited (owner decision needed). Was: H `server/scripts/calendar/execute-scheduled-calls.ts`: scheduled follow-up calls (booked by the agent through the follow-up tool, rows in `scheduled_calls`) are never dialled. The only code that executes them is this script, and no cron, Render job or in-server timer runs it. The daily report email (`send-daily-report.ts`) is in the same state. Fix: run the executor inside the server on a timer (with a lock), or add a Render cron job.
- **#147** L the legacy `scripts/test_batch_calling_suite.js` was unwired and stale (it hung for 30 min); fixed and exposed as `test:batch-calling` (about 10 min, not in CI).
- **#149** OPEN M `FE/components/alerting/DashAlerting.tsx:427` + `SV/services/AlertEvaluator.ts:161`: the "Total Spend ($)" alert metric is minutes x $0.05, a made-up dollar rate; customers pay in rupees per plan minute.
- **#150** (fixed, batch 9) M `SV/routes/kyc.ts`: a document still being checked ("pending") got the "could not be completed, please re-submit" email and in-app notice.
- **#151** (fixed, batch 9) H `SV/routes/kyc.ts` GET /status: documents were marked verified from the carrier status even for a personal_use sub-account, whose checks are the master account's, not the user's.
- **#152** OPEN L `FE/components/alerting/DashAlerting.tsx:114,128`: create/toggle failures show a fixed "Failed to ..." alert and hide the server's reason.

## 1. Billing, plans, minutes, numbers, KYC
1. H **V** `SV/services/MinutesService.ts:59-96,143-193`: the balance is read and then written back as an absolute value, with no row lock. Two calls ending at the same moment lose one debit, and a plan credit racing a debit can wipe paid minutes. Fix: atomic increment/decrement.
2. H **V** `SV/routes/kyc.ts:1366-1387`: `kycCallsBlocked` (default true) is never saved as false anywhere. Every non-admin call on the default carrier is refused even after KYC passes, and so is every inbound call (`CallService.ts:134`, `InboundCallService.ts:208`).
3. H **V** `SV/services/BillingService.ts:121`, `PlanFulfillmentService.ts`: the ₹1 trial can be bought any number of times (25 × ₹1 = 500 minutes).
4. H `SV/routes/numbers.ts:434-451`: if anything fails after a number payment is redeemed (price change, inventory lookup, assignment), the customer is never refused or refunded, and reconciliation counts it as fine.
5. H `SV/routes/numbers.ts:461-523` + `UsageSyncService.ts:124`: the free bundled number can be claimed again after a release (claim, delete, claim…). Each loop buys a new number on the master account.
6. H **V** `prisma/schema.prisma:33` (`maxConcurrentCalls @default(10)`): the per-plan concurrency fallback is dead code. Any owner can set an unlimited value through `/user/concurrency`, because `requireRole(['admin'])` treats an owner as admin. The balance monitor checks each call against the whole balance, so 10 parallel calls on a 20-minute trial overspend about 10×.
7. M `SV/routes/kyc.ts:722,1391`, `KycVerificationService.ts:131`: documents marked "verified" without a real carrier reference fail the number gate ("PAN not verified") even though the UI says Verified.
8. M `SV/services/PlanFulfillmentService.ts:26-39`: a staff PlanCatalog row whose key is a built-in plan (e.g. "starter") overrides minutes for every self-serve buyer of that plan, because `customerUserId`/`active` are ignored.
9. M `SV/core/orchestrator/CallOrchestrator.ts:1214,1288`, `CallService.ts:607`: answered calls that end with a provider error are stored as 'failed' and still billed, which breaks the "never bill failed calls" rule.
10. M `SV/utils/concurrency.ts:137-148`: stuck calls reaped after a restart get no duration and are never billed.
11. M `SV/routes/numbers.ts:177,235,462`, `billing.ts:57`: the plan gate uses the workspace, but plan minutes, KYC and number slots use the team member's own record. Minutes bought by an editor never reach the workspace.
12. M `SV/services/PlanFulfillmentService.ts:144`: every purchase overwrites accountType, so an Enterprise customer buying a ₹1 trial top-up is downgraded to trial.
13. M `SV/services/AccountEnforcementService.ts:194`: restoring an account re-enables API keys the user had revoked.
14. M `SV/core/telephony/PlivoService.ts:78-95`: mock mode depends only on missing keys, not on NODE_ENV. Without keys in production it creates fake "active" numbers.
15. L `SV/routes/numbers.ts:245-252`: a double-click after a successful paid purchase gets "already claimed your free number" instead of the idempotent success.
16. L `SV/controllers/WebhookController.ts:156`: carrier no-answer/busy are stored as 'failed', so batch stats and retries are wrong.
17. L `SV/routes/kyc.ts:1365`: `/kyc/status` stores the carrier's raw status (e.g. 'approved'), which fails every `=== 'verified'` check, and it can downgrade a verified account.
18. L `SV/services/BatchService.ts:183`, `routes/calls.ts:155`: displayed billed minutes don't follow the billing rule (batch total is `ceil(sum/60)`, and unanswered calls show minutes).
19. L `SV/routes/razorpayWebhook.ts:182`: a refunded plan keeps its credited minutes.
20. L `SV/services/BillingService.ts:273`: a plan mismatch shows the "amount does not match" message.
21. L `SV/routes/billing.ts:12,42`: suspended or restricted accounts can still buy plans.

## 2. Calls, voice pipeline, batch, webhooks
22. H `SV/websockets/AudioStreamHandler.ts:638-654`: one provider error runs the error handler 2–4 times, giving parallel reconnects plus a fallback hang-up, orphaned Gemini sessions and timers.
23. H **V** `SV/core/orchestrator/CallOrchestrator.ts:1040-1052`: after a reconnect every AI audio frame is sent to the caller twice (sink + `outboundAudio` emit).
24. H `SV/core/orchestrator/CallOrchestrator.ts:622,835-846`: a reconnect re-runs the whole session start. Caller audio stays blocked, `startTime` resets (under-billing), the max-duration timer re-arms and call_started is sent again.
25. H `SV/websockets/AudioStreamHandler.ts:632-654`: three event-bus subscriptions per call are never removed (memory/CPU leak that grows with every call).
26. H `SV/services/BatchService.ts:11,481,710`: the 60 s batch lock is not renewed while a call is in progress. Any call longer than 60 s lets a second worker dial the same batch in parallel.
27. H `SV/services/BatchService.ts:550-570,745-768`: the batch is finalised while failed recipients are still waiting for their retry, so busy/no-answer contacts are never retried.
28. H `SV/middleware/plivoWebhook.ts:252` vs `CallController.ts:368`: the signature is checked on `query.callId` but the handler uses `body.callId`. One valid signature can end any other call, and replays are possible.
29. H `SV/core/telephony/carrierHangup.ts:48`, `CallController.ts:304`: on carrier-A calls the stored id stays the request UUID, not the call UUID. AI end_call or a balance cutoff may log "hung up" while the line stays up and keeps billing (check against the carrier's API).
30. H `SV/controllers/CallController.ts:590-602`: hangup mapping checks HangupSource before HangupCause. Busy becomes failed and a rejected call becomes completed, so neither is retried.
31. H `SV/websockets/AudioStreamHandler.ts:772-777`: the "greet if the caller is silent" timer is cancelled by the first audio frame, which includes silence, so the AI never greets a silent caller.
32. H **V** `SV/core/orchestrator/CallOrchestrator.ts:280-288` + `providers/vobiz/VobizProvider.ts:227`: outbound `record` defaults to true and ignores the editor's "Record calls" setting. Calls may be recorded with no spoken notice (consent/DPDP; check whether the carrier honours the flag).
33. M `SV/core/orchestrator/CallOrchestrator.ts:625,831,965`: a failed runner start leaves a dead session in activeCalls; prewarm reuses it and the caller hears dead air.
34. M `SV/core/orchestrator/CallOrchestrator.ts:875`: the 15 s prewarm TTL leaves orphaned sessions and timers.
35. M `SV/websockets/AudioStreamHandler.ts:727`, `CallOrchestrator.ts:1205`: when a session fails to start, `callEnded` is never emitted, so the batch worker waits the full 30 minutes.
36. M `SV/services/BatchService.ts:636-710`: the call-end listener is attached after dialing, so an instantly rejected call blocks the worker for 30 minutes.
37. M `SV/websockets/SandboxStreamHandler.ts:412,426`: closing the test tab during setup leaves the Gemini session and balance ticker running.
38. M `SV/services/BatchService.ts:661`: a "global capacity" refusal burns the recipient's attempt as a permanent failure.
39. M `SV/websockets/AudioStreamHandler.ts:610`: inbound calls on the fallback path pass OUR number as the caller's. Opt-out then marks our own number as DNC and bookings store the wrong phone.
40. M `SV/controllers/CallController.ts:580,694`: the hangup webhook overwrites the duration after billing, so displayed duration ≠ billed minutes.
41. L `SV/services/BatchService.ts:138-179`: progress buckets don't add up (there's no in-progress bucket, and attempts are hard-coded to 3).
42. L `SV/websockets/AudioStreamHandler.ts:109`: the `reconnectAttempts` map is never cleared.

## 3. Other server routes and services
43. H **V** `SV/routes/agents.ts:357` vs `:1077`: `GET /:agentId` is declared before `GET /playbooks`, so the playbook list always fails (400).
44. H **V** `SV/routes/reports.ts:152-156`: the cursor is off by one, so one report per page never appears.
45. H **V** `SV/routes/user.ts:125-158`: `verify-gemini-key` never returns `success`, so a valid key shows an error in Settings.
46. H `SV/routes/calendar.ts:940,1220,1267,1325`: batch create/pause/resume/cancel have no viewer/analyst block, so a viewer can launch a paid campaign.
47. H `SV/routes/contacts.ts:9-12`: contact create/import/update/delete have no role check, so a viewer can clear opt-outs.
48. H `SV/controllers/ContactsController.ts:139,264`: a missing consent date is saved as "now", so contacts with no consent look consented.
49. M `SV/middleware/auth.ts:149`, `routes/team.ts:53`: inviting an existing owner moves them out of their own workspace, and a user in two teams lands in a random one.
50. M `SV/routes/team.ts:53`: the invite email is not normalised, so a real user gets "User not found".
51. M `SV/lib/calendar/timezone.ts:113-145`: day arithmetic assumes 30-day months, so `dateTo=Oct 31` also includes Nov 1.
52. M `SV/core/orchestrator/CalendarService.ts:522-534`: the daily booking cap counts only future bookings, grouped by UTC date.
53. M `SV/routes/calendar.ts:580-583`, `CalendarService.ts:491`: `Number(x) || default` turns 0 into the default, so a buffer or notice of 0 can't be saved.
54. M `SV/routes/calendar.ts:826,848,97`: booking cancel/reschedule and link-from-signin have no role check.
55. M `SV/routes/calendar.ts:1288`: resuming within 60 s of a pause returns success but the batch stays paused forever.
56. M `SV/routes/reports.ts:825-859`: re-analysing a job with a stale lock returns "queued" but nothing runs.
57. M `SV/routes/alerting.ts:9-14`, `AlertingController.ts:186`: rule writes have no role check, and evaluate-now runs every tenant's rules.
58. M `SV/controllers/AlertingController.ts:60-80`: metric, comparator and threshold aren't validated (wrong metric, NaN thresholds).
59. M `SV/controllers/AlertingController.ts:124`: clearing a field stores the text "null".
60. M `SV/routes/apikeys.ts:35,182`: keys are scoped to the member, not the workspace, and have no role check.
61. M `SV/routes/user.ts:58-81`: the BYOK key is saved on the member's row and never used for the workspace.
62. M `SV/routes/adminRoutes.ts:1600`: the admin daily metrics show the oldest 14 days, not the latest.
63. M `SV/controllers/ContactsController.ts:257`: a numeric phone in an import gives a 500 after earlier rows are already saved.
64. M `SV/controllers/ContactsController.ts:217`: contact update doesn't normalise the phone, and a duplicate gives a 500.
65. M `SV/routes/calendar.ts:755-776`: after the first AI booking, manual and batch scheduled calls disappear from the Calendar page.
66. L `SV/routes/agents.ts:273,340`: there is no cap on the list limit, and DB errors return 200 with an empty list.
67. L `SV/routes/agents.ts:892-913`: deleting an agent erases its call history from Reports and Analytics.
68. L `SV/routes/reports.ts:274`: pending/failed counts ignore the agent/date filters.
69. L `SV/controllers/AnalyticsController.ts:97`: the trend counts no-answer calls as failed.
70. L `SV/routes/adminRoutes.ts:431`: a staff role isn't validated, so a typo removes every permission.
71. L `SV/services/NotificationService.ts:56,231`: important announcements are never shown as important.
72. L `SV/services/DataRetentionJob.ts:143`: the per-workspace purge count is a running total.
73. L `SV/routes/calendar.ts:924,1206`: the batch "created" date is a UTC slice, which shows the previous day in IST.
74. L `SV/routes/calendar.ts:1340`: cancelling a completed batch rewrites it as cancelled.
75. L `SV/routes/contacts.ts`, `ContactsController.ts:51`: the contacts list stops at 50 because `pagination` is dropped.

## 4. Dashboard (frontend ↔ backend contracts)
76. H **V** `SV/routes/calls.ts:161-186`: the call list returns no `agentId`, `phoneNumber` or `duration`. As a result:
    - `FE/App.tsx:1569,2275`: per-agent call counts are always 0;
    - `FE/components/contacts/DashContacts.tsx:62`: the contact call history is always empty;
    - `FE/components/calls/RealCallModal.tsx:210`: an inbound test call is never detected.
77. H `FE/components/calls/RealCallModal.tsx:260`: nothing polls the call status, so "Ringing…" never ends after a hang-up or no answer.
78. H `FE/components/monitoring/DashLiveMonitoring.tsx:221` + `SV/controllers/CallController.ts:784`: "Force Transfer" says "initiated" but the carrier is never asked to transfer.
79. H **V** `FE/components/calling/DashCallingConfig.tsx:270` → `SV/services/InboundCallService.ts:491`: switching inbound off sets the number to 'inactive', which also blocks outbound calls.
80. H `FE/App.tsx:3196`, `SV/routes/calendar.ts:945,1044`: `scheduledAt` is ignored and nothing starts 'scheduled' batches, so scheduled campaigns never dial.
81. H `FE/App.tsx:5830`: workspace webhook URL, secret and events are saved only in the browser (with fake defaults), yet the screen says "test ping sent".
82. H **V** `FE/App.tsx:5814-5822,5975`: the Recording/Transcription/Sentiment/Summary toggles and billing email are saved only in the browser.
83. H `FE/App.tsx:3341,3379`: the campaign Failed column reads `failedCount`, but the server sends `failed`, so it always shows 0.
84. M `FE/App.tsx:3340`: "Connected" falls back to the attempted count when 0 calls connected.
85. M `FE/App.tsx:3724`: the call-history live transcript expects a different event shape, so it never shows lines.
86. M `FE/components/calls/RealCallModal.tsx:171`: interim transcripts are appended as many partial lines.
87. M `FE/App.tsx:3796,3837`: the page number isn't reset when filters change, so the table shows empty with no way back.
88. M `SV/routes/calls.ts:282,306,330,403`: call detail/transcript/terminate/delete use userId, not the workspace, so team members get "not found".
89. M `SV/routes/numbers.ts:883,938`: calling-config uses userId, not the workspace.
90. M `FE/components/calling/DashCallingConfig.tsx:243`: "None (Unassigned)" sends '' as a foreign key, which errors.
91. M `SV/routes/calls.ts:166`: inbound rows show our business number as the caller.
92. M `SV/routes/calls.ts:102-108`: "Today" uses UTC, so it misses calls between 00:00 and 05:30 IST.
93. M `FE/components/reports/ReportsHome.tsx:327`: the "Pending/Processing" filters always return an empty list.
94. M `FE/components/reports/CallResultDrawer.tsx:293`: audit history reads the admin log, so customer corrections never appear.
95. M `SV/routes/numbers.ts:1040`, `PlivoService.ts:240`, `numbers.ts:595,612`, `CallService.ts:135,141`, `KycVerificationService.ts:199`, `kyc.ts:1127`: carrier names reach the user in errors, notifications, an email and a redirect (white-label breach).
96. M `FE/App.tsx:6070`: the plan badge shows internal names ("developer Plan", "professional Plan").
97. M `FE/App.tsx:5808`: the saved default number is overwritten on every visit and never used.
98. M `FE/App.tsx:4539,4558`: picking an agent in the KB test is silently replaced by document #1.
99. M `FE/components/agents/SinglePromptStudio.tsx:1731`: Publish doesn't set status 'active', so the agent stays a draft.
100. M `FE/App.tsx:5773-5799`, `DashContacts.tsx:130`, `ApiKeyManagement.tsx:52`, `DashIntegrations.tsx:96`: these read `err.response.data.error`, which doesn't exist with `apiFetch`, so the real error reason is hidden.
101. M `SV/controllers/QaController.ts:162`: seconds are compared with a millisecond threshold, so the latency QA flag never fires.
102. L `FE/components/alerting/DashAlerting.tsx:160,427`, `AlertEvaluator.ts:162`: cost is shown in "$" at $0.05/min.
103. L `FE/DashContacts.tsx:43`, `DashChatHistory.tsx:31`: only page 1 is fetched, and search is client-side.
104. L FE: several dates use the browser timezone, not IST (alerting, chat history, API keys, KYC, `App.tsx:6327`, `App.tsx:3398`).
105. L `FE/components/numbers/NumberSearchAndPurchase.tsx:321`: every search runs twice.
106. L `FE/components/numbers/NumberSearchAndPurchase.tsx:1025`: the rental "₹450/mo + ₹81 GST" is hard-coded.
107. L `SV/routes/calendar.ts:224`: the Google-not-configured alert shows a raw code.
108. L `FE/App.tsx:6087`: the low-balance warning uses a fixed 100-minute threshold but says "below 10%".
109. L `FE/components/reports/ReportsHome.tsx:349`: the "Unclear" filter hides the unlabelled rows it should show.
110. L `FE/App.tsx:4174`: "N total calls" shows the page size (100), not the real total.

## 5. Public website, SEO, auth
111. H **V** `FE/pages/Pricing.tsx:244`: Startup is sold as **1,000 minutes**, but `SV/config/plans.ts:67` credits **750**.
112. H **V** `FE/App.tsx:8023,8096`: FAQ structured data says "from ₹1,799/month", and no such plan exists.
113. H **V** `Frontend/public/llms.txt:6`: the prices shown to AI assistants are wrong (₹2,999/₹9,999/₹29,999 vs ₹3,799/₹10,799/₹30,799).
114. H `FE/App.tsx:8154`, `AuthGateway.tsx:412`: when a signed-out visitor picks a plan and then signs in, checkout doesn't open then, but it opens unexpectedly later (on a token refresh).
115. M `FE/pages/Pricing.tsx:245,283,327`: the overage rates shown (₹3.79/₹3.49/₹2.99) don't match the server's (2.99/2.99/1.99).
116. M `FE/pages/FAQ.tsx:43` vs `Pricing.tsx:250-337`: the bundled number and SIP trunking claims contradict each other.
117. M `FE/pages/Pricing.tsx:338` vs `Terms.tsx:195`: the SLA is 99.99% on Pricing but 99.5% in the Terms.
118. M Home/Pricing/FAQ/prerender: concurrency is stated four different ways ("Unlimited", 10/50/200+, 10,000+, 1,000+).
119. M JSON-LD vs Hero/Navbar/Footer/Home: the language claims conflict ("70+", "60+", a short list), and Tamil/Marathi have no voice samples.
120. M `FE/pages/VoiceAIIndex.tsx:82-88`: the `/voice-ai-index` hub canonicalises to the first topic, so the hub won't be indexed.
121. M `FE/pages/VoiceAIIndex.tsx:143`: its unmount cleanup overwrites the next page's title and description.
122. M `Frontend/scripts/prerender-seo.js:393`: `/faq` has FAQPage schema without `mainEntity` (invalid).
123. M `FE/App.tsx:8058-8110`: `/pricing` carries FAQ schema for questions that aren't on that page.
124. M `FE/pages/BlogIndex.tsx:186`: the newsletter form sends nothing but says "subscribed".
125. M `FE/lib/routes.ts:91`: unknown URLs render the home page (soft 404), and invalid `/use-cases/x` silently shows healthcare.
126. M `FE/pages/Terms.tsx:224-233,324`: California law, Delaware courts and US FTC DNC rules for an Indian company (lawyer).
127. L `FE/components/auth/AuthGateway.tsx:225`: sign-up reveals whether an email is already registered.
128. L `Navbar.tsx:142,211`: "Join Now" opens the sign-in tab instead of sign-up; on mobile it's shown even when signed in.
129. L `Footer.tsx:120-184`: twelve vertical-specific links all go to the generic `/solutions`.
130. L Blog pages and `/ai-voice-agent-software` have no internal links (orphan pages), and BlogIndex shows a duplicate copy of the RTO article.
131. L `FE/App.tsx:7971`, `UseCases.tsx:967`: the canonical isn't updated when the topic changes in-page.
132. L `public/llms.txt:12-17`: lists `/compare`, which is a redirect.
133. L "Free sandbox, no credit card" (`AiVoiceAgentSoftware.tsx:576`, `prerender-seo.js:312`, `Footer.tsx:60`) needs checking against the ₹1 trial.
134. L `FE/App.tsx:7873` vs `prerender-seo.js:33,48`: runtime and pre-rendered titles differ, and the How It Works title doesn't match its H1.
135. L `FE/App.tsx:7980`: `/login`, `/signup` and `/dashboard` are marked index,follow (should be noindex).
136. L `Footer.tsx:258`: the LinkedIn link carries the admin `?viewAsMember=true` parameter.
137. L `prerender-seo.js:503`: an internal model id ("gemini_2_5_flash_audio") is exposed in crawlable HTML.

## 6. Earlier in this session (indexing and enterprise review), still open
138. M About 90 `/voice-ai-index/*` pages are one template with the topic swapped (Google will likely not index them), and some titles imply SOC 2/ISO/PCI/HIPAA certification.
139. L 21 titles over 65 characters, 2 long descriptions, 5 thin pre-rendered pages, and every sitemap `lastmod` is the build date.
140. M `FE/DashCompanionCall.tsx:178`: uses `tom_holland_avatar.png` (a celebrity's likeness; legal risk).
141. M **V** `SV/controllers/CallController.ts:765-800`: `POST /calls/:id/transfer` reports "transfer initiated" but only writes metadata (same as #78).
142. L Dead code found by strict TypeScript:
    - an unreachable agent "detail" view in App.tsx, with a fake "Acme Corp" prompt and a Save button with no handler;
    - six unused page components inside App.tsx;
    - leftover state for concurrency/IP-allowlist/purchase;
    - 45 unused declarations on the server and 309 in the frontend (mostly imports);
    - 16 server handlers where not every path returns.
143. L `SV/providers/gemini/GeminiLiveProvider.ts:586,672`: the agent temperature is read but the model call hard-codes 0.5 (no UI control exists, so not user-visible).
