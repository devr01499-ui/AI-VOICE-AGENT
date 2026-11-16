# CODEMAP — where each issue lives (built Phase 0, 2026-11-16, at commit 549955a)
Line numbers drift after edits: re-`grep -n` the symbol before trusting a range. FE = `Frontend/src/app`, S = `server/src`. "LEAD" = spotted while mapping, NOT yet verified by running.
Sizes: App.tsx 8378 · SinglePromptStudio.tsx 4636 · VisualFlowCanvas.tsx 1648 · AuthGateway.tsx 823 · api.ts 1133 · S/routes/agents.ts 1181 · kyc.ts 1433 · numbers.ts 1282 · S/index.ts 831 · schema.prisma 1414 · GeminiLiveProvider.ts 1332 · AudioStreamHandler.ts 1164.

## F1 First-load flash
- `Frontend/scripts/prerender-seo.js` L325-376 `injectMetadata` (builds #root content L361-369, injects L371); page list L30-151; write loop L378-429
- `Frontend/index.html` L17 empty #root; `Frontend/src/main.tsx` L11-14 `createRoot` (no hydrate); `Frontend/vercel.json` L32-34 SPA rewrite
- FE/App.tsx L7851 `authLoading`; L7853-7894 initial `useState<Page>` + pathMap #1 (L7856-7884); L7913-7973 popstate + pathMap #2; L7976-8008 `handleNavigate` + reverse pathMap #3
- FE/App.tsx L8257-8302 session bootstrap; L8304-8318 dashboard branch (`ProtectedRoute.tsx` L20 spinner); L8340-8373 `AnimatePresence mode="wait"` + Suspense fallback L8349; dashboard's own AnimatePresence L7279-7301; second popstate L6907-6927
- LEAD: every SPA route is served the home-prerendered `dist/index.html`, so `/dashboard` paints home content before React replaces it.

## F2 Auth
- FE/components/auth/AuthGateway.tsx: mode from URL L218-227; recovery detect L246-268; signup L270-339 (`emailRedirectTo` L315); submit/validation L341-387 (forgot L371-372, reset L377); Google OAuth L389-411 (`redirectTo` L393); phone input ~L547
- FE/App.tsx L7868 `/auth/callback`→dashboard; FE/lib/supabaseClient.ts L1-16. No `/reset-password` route (handled in AuthGateway).
- S/middleware/auth.ts `requireAuth` L21-228 (verify L52, duplicate email L100-116, User upsert L123-141, workspace derived L144-154); S/utils/auth.ts L7
- S/routes/user.ts `/validate-signup` L411-480, `/consent` L485; S/utils/emailNormalizer.ts
- S/middleware/rateLimiter.ts: general L35, sensitive L46, webhook L64, signup L81, login L98 (defined, unused), IP delay L119
- LEADS: no phone validation on client or server; `/api/v2/user` is mounted behind `requireAuth` (S/index.ts L336) yet holds pre-signup routes — signup may 401.

## B1 Templates modal / Create Agent
- FE/App.tsx: `AGENT_TEMPLATES_SEED` L772; `DashAgents` L1543; `applyTemplate` L2513-2545; create modal L2547-2790 (wrapper `max-w-6xl` L2549, card grid L2648-2730, cards L2700-2720, preview `w-80` L2731-2757); agents list L2792; detail view L2212-2240; dashboard wrapper `max-w-[1600px]` L7280

## B2 Notification bell
- FE/App.tsx L6621-6824 `NotificationBellDropdown` (poll L6636-6650, read L6670, mark-all L6677, clear L6684), mounted L7275; calls `apiClient` (api.ts L875) directly
- S/routes/user.ts: GET `/notifications` L129, POST `/:id/read` L142, `/mark-all-read` L155, DELETE `/clear-all` L168, POST create L182. Single delete: MISSING
- S/services/NotificationService.ts L18-157; storage = `SystemAlert` (schema L1317-1332, `isResolved` = read)
- LEAD: global alerts (userId null) can never be marked read.

## B3 Prompt Coach
- S/types/promptCoach.ts L1-65; S/utils/playbooks.ts `PLAYBOOKS` L66-562, `generatePlaybookPrompt` L563-668, `reviewPromptQuality` L669-792
- S/routes/agents.ts `/playbooks` L1049-1061, `/prompt-coach/generate` L1062-1117, `/prompt-coach/review` L1118-1143 (template-based, no LLM call today)
- FE/api.ts L649-755; SinglePromptStudio.tsx state L664-676, handlers L689-757, button L2121-2129, modal L4297-4499

## B4 Remove "Review QA" + "Auto-detect"
- Review QA: SinglePromptStudio.tsx button L2130-2140, handler L760-772, modal L4500-end; api.ts L737; agents.ts L1118-1143. KEEP `reviewPromptQuality` (used by generate, playbooks.ts L652)
- Auto-detect industry UI: SinglePromptStudio.tsx L274-288, L2038, L2727, L2739-2745; AgentConfigPanel.tsx L38, L371, L384
- Auto-detect server: S/utils/systemInstructionBuilder.ts `detectIndustry` L144, `resolveEffectiveIndustry` L187-230 (runtime use L294-295); agents.ts L22, L315, L400, L611, L787
- KEEP (unrelated): AgentConfigPanel.tsx L350 language "Auto-detect (multilingual)"; audioConverter.ts L210 codec detection
- Tests touching it: server/scripts/test_section_g_matrix.ts, test_street_smart_intelligence.ts L118-135, test_street_smart_regression.ts L160-166

## B5 Test Lab
- S/services/TestLabService.ts L88-238 (`runSimulation` is heuristic, no LLM); agents.ts L1144-1181; api.ts L757-790; SinglePromptStudio.tsx state L684-687, handler L774-789, tab L3543-3550, panel L3673-3770

## B6 Prompt-based agent editor (SinglePromptStudio.tsx, column L2284-3514)
- Functions L2288-2356 (modal L3806-4087) · Knowledge Base L2357-2415 · Scheduling L2416-2632 · Intelligence/Style L2633-2751 · Speech L2752-2864 · Transcription L2865-2908 · Call Settings L2909-3100 · Post-Call L3101-3192 (modal L4088-4195) · Security & Fallback L3193-3298 · Webhooks L3299-3437 · MCPs L3438-3514 (modal L4196-4296)
- Save path: `getStudioPayload` L1480-1577, `validateStudio` L1579, `handleSave` L1592; mounted App.tsx L6961-6975; api.ts `createAgent` L288, `updateAgent` L363
- Server: agents.ts POST L502-629, PUT `/:agentId` L630-805 (body has no schema); `Agent` model schema L116-161 (`agentConfig` JSON string L123), `AgentKnowledgeBase` L307-320, `AgentSchedulingRule` L852-877
- Runtime readers: systemInstructionBuilder.ts `buildFinalSystemInstruction` L239-467; S/core/orchestrator/CallOrchestrator.ts L376-417, L606-608; GeminiLiveProvider.ts L131, L614-639; CallService.ts L499-507; WebhookDispatcher.ts L36; McpService.ts L28-190
- LEADS: `securityFallback` has no server reader; MCP is read only by SandboxStreamHandler.ts, not the live-call path.

## B7 Conversational-format builder
- FE/components/agents/VisualFlowCanvas.tsx: node types L97-200, edges L299-335, compile L361, save/publish L673-705, palette L842-907, inspector L930+; mounted App.tsx L7053-7060
- FE/components/agents/flowCompiler.ts L70; ConversationalBuilder.tsx L21 (→ agents.ts L73-192); AgentConfigPanel.tsx L192-215
- Server: S/core/orchestrator/FlowCompiler.ts L57-266 (compiles flow to a prompt; no node-by-node executor); CallOrchestrator.ts L376-402; SandboxStreamHandler.ts L202-221

## B8 Knowledge Base / RAG inspector
- FE/App.tsx `DashKnowledge` L4531-5039 (`runQueryTest` L4584-4605, inspector L4853-5038); api.ts L591-646 (`testKBQuery` L636)
- S/routes/knowledgeBase.ts L8-16; S/controllers/KnowledgeBaseController.ts upload L16, scrape L148, reindex L352, `testQuery` L379-465
- S/services/KnowledgeBaseService.ts L12-131; HybridSearchService.ts `search` L83; S/utils/embedding.ts L37, L81-84, L159; documentChunker.ts L35
- Limits: S/config/plans.ts L5-11, L135; enforced only for maxDocuments/maxFileSizeMb (controller L58-73, L236-242). LEAD: storage/chunk/per-agent limits unenforced.

## B9 Numbers / KYC / carrier activation
- S/services/KycVerificationService.ts L95, L222, approval email L172-215; S/routes/kyc.ts emails L100, L245, routes L363-1308
- PhoneNumberActivationService.ts L16; VobizSubAccountService.ts (`syncKycStatus` L402); S/core/telephony/PlivoService.ts (subaccount L63, purchase L288)
- S/routes/numbers.ts search L192, create-order L253, purchase L315-506, claim L507, Plivo L1046-1282; S/routes/telephony.ts L10-19
- Vobiz files: vobiz.service.ts (only telephony.controller.ts) · VobizIntegrationService.ts (base class) · VobizInventoryService.ts · VobizPhoneNumberService.ts (numbers.ts) · core/telephony/VobizService.ts (call placement)
- FE: App.tsx `DashNumbers` L4270-4530 (`handlePurchase` L4309-4376 looks dead, `completeNumberPurchase` L4378); live flow FE/components/numbers/NumberSearchAndPurchase.tsx; FE/components/kyc/KycComplianceSettings.tsx

## B10 Batch calling
- S/services/BatchService.ts: counters L44-137, calling window L211-255, `processBatch` L277-717 (concurrency L386-397, retry L399-403, dialer loop L417-700, claim L553), `recoverStaleBatches` L728-771; boot recovery S/index.ts L729-745
- Routes are in S/routes/calendar.ts: GET L895, L958, POST `/batches` L1059-1333 (consent L1112, opt-out filter L1160-1186, dedupe L1197-1215), pause L1334, resume L1381, cancel L1439
- FE/App.tsx `DashBatch` L3025-3627 (CSV parse L3101-3165, launch L3196); api.ts L788-830
- LEADS: no national DND registry check; `ALLOW_OFFHOURS_BATCH_CALLS` bypasses calling hours.

## B11 Calling Configuration
- FE/components/calling/DashCallingConfig.tsx (318 lines): `loadData` L34-55, `handleUpdate` L59-80; rendered App.tsx L7282
- S/routes/numbers.ts GET L945-1000, POST L1001-1045; agents.ts GET L42

## B12 Data pages
- Call History: App.tsx `DashCallLogs` L3628-4269 → S/routes/calls.ts L44-209 · Contacts: FE/components/contacts/DashContacts.tsx → routes/contacts.ts
- Analytics: components/analytics/DashAnalytics.tsx → routes/analytics.ts · Live Monitoring: components/monitoring/DashLiveMonitoring.tsx → calls.ts `/live` L210, WS upgrade index.ts L530-610
- AI QA: components/qa/DashAIQualityAssurance.tsx → routes/qa.ts · Reports: components/reports/ReportsHome.tsx, CallResultDrawer.tsx → routes/reports.ts (list L57, summary L225, csv L503)
- Alerting: components/alerting/DashAlerting.tsx → routes/alerting.ts, services/AlertEvaluator.ts. `server/scripts/audit_reports.ts` exists; REPORTS_PM_FIX_PROMPT.md not in repo.

## B13 Billing
- S/services/BillingService.ts: number order L26, plan order L85, `verifyPayment` L151-186, refund L188, `processPlanPurchase` L217 (orders.fetch L231, payments.fetch L263)
- S/routes/billing.ts: create-plan-order L14, `handlePlanVerification` L52, `/verify-plan` L135, `/verify-plan-payment` L136, `/config` L142, minutes-overview L157, invoices L230/L245, `/gstin` L274, subscription-status L300, sync-entitlements L375 (no limiter from `/config` down)
- S/routes/razorpayWebhook.ts L40 (HMAC L46-67, replay cache L15-32, events L120-417); S/config/plans.ts L28; PlanFulfillmentService.ts L22; MinutesService.ts `debit` L121-216; AccountEnforcementService.ts L38-156; InvoiceService.ts L18
- FE: pages/Pricing.tsx L58-160; components/settings/BillingGateway.tsx L23-77; App.tsx L4347-4378
- LEAD (check first in Phase 6): `/numbers/create-order` (numbers.ts L269) takes cost from the request body and `/purchase` (L376) checks signature only — possible underpayment.

## B14 Call recording
- Schema `recordingUrl` L198, L234, L700; writers WebhookController.ts L146-163, PipecatRunner.ts L174-178
- Readers: CallService.ts L242-256, L462-474 (signed URL); calls.ts L145-177 and reports.ts L142/197/526/621 (raw value); CallRepository.ts L41/61
- FE: CallResultDrawer.tsx L265-269; App.tsx L3832, L4220-4222 (native `<audio>`, no player component)
- LEAD: S/services/DataRetentionJob.ts is never started and deletes DB rows only.

## B15 Latency / voice
- S/core/pipeline/PipecatRunner.ts (192 lines); S/websockets/AudioStreamHandler.ts; S/providers/gemini/GeminiLiveProvider.ts (VAD L125-147, L627-684; voice map L599-668); S/runtime/TurnAggregator.ts
- Models: S/utils/modelResolver.ts L15-18; fallback use GeminiLiveProvider.ts L402-406, L863-866, hardcoded L232, L1273; env.ts L85
- Timing: S/utils/CallTimingTracker.ts (357 lines); personas S/config/voicePersonas.ts L56-80; `hangupCarrierLeg` S/core/telephony/carrierHangup.ts L100

## S7 Security plumbing (Phase 12)
- S/index.ts: helmet L88-122, CORS L136-158, parsers L160-166, general limiter L324, mounts L330-353, admin gate L356-366, error handler L383, WS auth L530-610, listen L664-756, shutdown L758-808
- S/middleware/auth.ts L21/L230/L247; requireStaff.ts L41 (MFA L115-118); S/utils/ssrfValidator.ts L148, L240; S/config/env.ts L14-143
- CI: `.github/workflows/call-path-e2e.yml`, `deploy-render.yml` (no typecheck/build/test workflow yet)
