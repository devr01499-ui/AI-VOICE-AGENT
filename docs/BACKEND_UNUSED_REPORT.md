# Backend features that give no value to users

First version: 2026-11-17 (Phase 2). Built from a read-only search of every server route and service against all callers in `Frontend/src`, `Admin/src`, `server/scripts`, `scripts/`, `.github/workflows` and `e2e-call-harness`. Nothing has been deleted yet: removals happen in Phase 13, one revertable change per area, after build, tests and a `/live` boot check (CLAUDE.md §9). Items marked UNSURE are verified again before anything is removed.

Decisions: **REMOVE** = dead, no user value. **WIRE-UP** = real value for customers but no screen uses it yet. **KEEP** = needed (outside services call it, or a live feature uses it). **TEST/ADMIN-ONLY** = only scripts or the admin console use it.

## 1. Plain-language summary for the owner

Backend features customers can never reach and that give them nothing:
- **SIP trunking** (the drachtio SIP server, the trunk-creation route and its settings). The SIP screen was removed earlier, so nobody can create a trunk.
- **The old `/telephony/*` purchase and sub-account routes** and the file behind them (`vobiz.service.ts`). Number purchase and sub-accounts run through other code that is in use.
- **Chat history.** It is switched off by a feature flag and nothing ever writes chat messages.
- **Duplicate routes:** a second plan-verification route, a second "my numbers" route, a second Plivo purchase route, a second call-start route without the `/v2` prefix, a second CSV export route, a second report-correction route, a second calendar-disconnect route.
- **Diagnostics left in production:** a carrier probe and a Gemini debug route.
- **Integrations module:** the code is still in the server but never switched on (only Google Calendar is offered).
- **Unused helpers:** "optimize prompt", "update KB agents", "subscription status", "sync entitlements", "billing config", "blueprint by template".

Things that look unused but should be finished, because customers would benefit:
- **Invoices and GST:** invoices are really created after every payment, but customers cannot see or download them, and no screen collects a GSTIN.
- **Minutes overview:** a breakdown of minutes used and remaining exists on the server with no screen.
- **Bulk contact import**, **calendar booking reschedule**, **accepting a call report**.

Defects found during this search (not dead code, but broken):
- **Data retention does nothing.** Customers can save a retention period, but the clean-up job is never started, so no data is ever deleted. Compliance risk (DPDP). Phase 10.
- ~~KYC page calls three routes that do not exist~~ **Corrected in Phase 7:** all three exist (declared as path arrays, which the first static scan missed). `test:number-entitlement` now checks every KYC route the page calls.
- **Prompt editor "MCPs" are used only in the browser test call, never on real calls.** Phase 4.
- **Test Lab does not call an AI model**; it pattern-matches. Phase 3.

## 2. Routes and files

| Route or file | Who calls it | Decision | Reason / phase |
|---|---|---|---|
| `GET /billing/config` | nobody | REMOVE | Checkout pages get the key elsewhere (Phase 6 confirms it exposes only the public key id) |
| `POST /billing/gstin` | nobody | WIRE-UP | GST details for invoices; no screen; also needs a rate limiter (Phase 6) |
| `GET /billing/invoices`, `GET /billing/invoices/:id/download` | nobody | WIRE-UP | Invoices exist (`PlanFulfillmentService` → `InvoiceService`) but are invisible to customers (Phase 6) |
| `GET /billing/minutes-overview` | auth test script only | WIRE-UP | Minutes breakdown screen (Phase 6/9) |
| `GET /billing/subscription-status` | nobody | REMOVE (UNSURE) | Plan state comes from other calls |
| `POST /billing/sync-entitlements` | nobody | REMOVE | Never called |
| `POST /billing/verify-plan-payment` | nobody | REMOVE | Duplicate of `/billing/verify-plan` (same handler) — Phase 6 |
| `POST /api/calls/outbound` (no `/v2`) | nobody | REMOVE (UNSURE) | Legacy duplicate of the documented `/api/v2/calls/outbound` |
| `GET /calls/debug/gemini` | nobody | REMOVE | Admin-gated diagnostic |
| `GET /calls/:callId` | nobody | UNSURE | Not documented for API-key users; confirm before removing |
| `POST /calls/sip-trunks`, SIP provider, `drachtio-srf`, docker-compose drachtio service | nobody | REMOVE | SIP screen was removed; feature unreachable |
| `POST /contacts/import` | nobody | WIRE-UP | Bulk import would help customers (or remove) |
| `GET /numbers/vobiz-probe` | nobody | REMOVE | Diagnostic |
| `GET /numbers/mine` | nobody | REMOVE | Duplicate of `GET /numbers` |
| `GET /numbers/pending-activations`, `POST /numbers/:id/mark-funded-and-activate`, `PATCH /numbers/:id/activate` | test scripts only | TEST-ONLY | Admin console uses `/admin/numbers`; decide in Phase 7 |
| `POST /numbers/plivo/purchase` | nobody | REMOVE | Screen uses onboard/search/claim; also has the payment flaw in PRELAUNCH_NOTES §1 (Phase 6/7) |
| `GET /telephony/inventory`, `GET/POST /telephony/sub-accounts`, `POST /telephony/purchase`, `controllers/telephony.controller.ts`, `services/vobiz.service.ts` | auth test script only | **REMOVED (Phase 7)** | `/purchase` bought carrier numbers with company money: no payment, no KYC, no one-number limit, no DB record. Carrier webhook `/api/v2/telephony/webhook` kept. |
| `POST /agents/optimize` | nobody | REMOVE | Helper never called |
| `POST /agents/:agentId/test-lab` + `TestLabService.ts` | prompt editor | KEEP | Live, but heuristic only — rebuilt in Phase 3 |
| `McpService.ts` | browser test call only | KEEP | Must also be wired into real calls or removed (Phase 4) |
| `GET /calendar/batches/:id` | nobody | REMOVE | Imported in the frontend but never called |
| `POST /calendar/bookings/:id/reschedule` | nobody | WIRE-UP | Calendar screen only has cancel |
| `DELETE /calendar/` | nobody | REMOVE | Screen uses `/calendar/disconnect` |
| `POST /knowledge-base/:id/update-agents` | nobody | REMOVE | Screen uses assign/unassign (Phase 5) |
| `GET /reports/blueprints/:templateId` | nobody | REMOVE | |
| `GET /reports/export.csv` | nobody | REMOVE | Duplicate of `/reports/export/csv` |
| `POST /reports/:callId/correction` | audit script only | REMOVE | Duplicate of `/correct` |
| `POST /reports/:callId/accept` | nobody | WIRE-UP | No screen to accept a report (Phase 9) |
| `GET/POST /chat-history` | hidden screen only | REMOVE | Feature flag off; nothing writes chat messages |
| `POST /user/notifications` (founder announcement) | nobody | KEEP, WIRE-UP | Now the only way to post a company announcement (fixed in B2); add a button in the admin console |
| `routes/integrations.ts`, `controllers/IntegrationsController.ts` | imported, never mounted | REMOVE | `server/docs/removed-integrations.md` confirms removal |
| `services/DataRetentionJob.ts` | test script only | WIRE-UP (bug) | Never started at boot; retention setting has no effect (Phase 10) |
| Admin: `PATCH /staff/:id`, `PATCH /customers/:id/profile`, `POST /customers/:id/follow-ups`, `POST /customers/:id/kyc/reset`, `POST /calls/:id/terminate`, `POST /payments/:id/refund`, `PATCH /numbers/:id/activate` | no admin-console button | ADMIN, decide | Permissions exist, no buttons; owner decides which admin tools are wanted |
| `utils/audioConverter.ts` | `PipecatRunner` (live) and an old deprecated Gemini provider | KEEP | The deprecated provider path is UNSURE — check in Phase 13 |

## 3. Must keep (called by outside services)

| Route | Called by |
|---|---|
| `GET /live`, `/healthz`, `/health`, `/ready` | Render health check, e2e harness |
| `/webhooks/vobiz/answer`, `status`, `hangup` | Carrier (URLs set per call in `CallOrchestrator`) |
| `/webhooks/plivo/answer`, `status`, `hangup` | Carrier |
| `/webhooks/plivo/fallback` | Possibly set in the carrier dashboard — UNSURE, keep |
| `POST /webhooks/razorpay` | Payment provider |
| `POST /kyc/webhook/vobiz` | Carrier KYC |
| `POST /api/v2/telephony/webhook` | Nothing in the repo points at it — UNSURE, check carrier dashboards before removing |
| `GET /calendar/callback` | Google sign-in redirect |
| `POST /api/v2/calls/outbound` | Public API for API-key customers (documented on the Docs page) |

## 4. Frontend calls with no backend route
- `KycComplianceSettings.tsx` → `/api/v2/kyc/initiate-session`, `/api/v2/kyc/digilocker/initiate`, `/api/v2/kyc/digilocker/verify`: these return 404 (Phase 7).
- `/api/v2/sandbox/test-stream` is a WebSocket, not an HTTP route; its handler was not checked (Phase 3/4).

## 5. Phase 13 outcome (2026-11-18): what was removed, what was kept and why

Method:
- grep across Frontend, Admin, server scripts/tests, e2e, docs and workflows;
- an import graph from `server/src/index.ts` and from `Frontend/src/main.tsx`;
- a declared-vs-imported dependency check.

Each area is its own revertable commit on `chore/dead-code`. Typecheck, build and the affected suites passed after each.

**Removed (no user value, nothing calls it):**
- **Server routes:**
  - `GET /billing/config`, `GET /billing/subscription-status`, `POST /billing/sync-entitlements`;
  - `GET /calls/debug/gemini`, `POST /calls/sip-trunks`;
  - `GET /numbers/vobiz-probe`, `GET /numbers/mine`, `POST /numbers/plivo/purchase`;
  - `POST /agents/optimize`, `GET /calendar/batches/:id`, `DELETE /calendar`, `GET /reports/blueprints/:templateId`.
  - `/billing/verify-plan-payment` and the `/telephony/*` purchase routes had already been removed in Phases 6–7.
- **Server files:**
  - `routes/integrations.ts`, `controllers/IntegrationsController.ts`;
  - `providers/sip/SipProvider.ts`, plus the drachtio typings and the docker-compose drachtio service;
  - `core/provider-sdk/provider.errors.ts`, `core/telephony/TranscriptRecorder.ts`, `runtime/CallLifecycleManager.ts`, `runtime/ConversationStateManager.ts`, `utils/piiRedactor.ts`;
  - 19 scratch/probe files in `server/` (scratch*.ts, test-sip*, carrier probes, RLS check scripts, a migrate log).
- **Frontend:**
  - 51 files that are never imported: the unused shadcn `components/ui` kit, RoiCalculator, CompareTable, SolutionsTab, ImageWithFallback, `pages/Compare.tsx`;
  - unused helpers `optimizePrompt`, `fetchCalendarBatchDetail`, `getExportCsvUrl`, `fetchAuditLogs`/`ApiAuditLog`;
  - the leftover audit-log state in App.tsx.
- **Dependencies:**
  - 50 frontend packages: MUI/emotion, 25 Radix packages, recharts, puppeteer, react-router, react-dnd, react-hook-form, date-fns, sonner, vaul and others;
  - 4 server packages: better-sqlite3, @prisma/adapter-better-sqlite3, sip.js, drachtio-srf.
- **Root:** the Next.js template SVGs in `public/`, the stale `scripts/test_plan_security.ts`, and `scripts/test_pii_redaction.js` (it tested the removed module).

**Kept on purpose:**
- `POST /reports/:id/correction` and `GET /reports/export.csv`: contract aliases checked by the reports audit harness (`scripts/audit_reports.ts`, 28/28).
- `POST /api/calls/outbound` (no `/v2`): public API alias for API-key customers.
- Chat history (`/chat-history`, DashChatHistory): the owner chose to hide it, not delete it. Owner decision.
- `POST /knowledge-base/:id/update-agents`: used by the frontend API layer and by test_kb_rag.
- `GET /audit-logs` (server): audit writes and test_audit_logging_compliance use it.
- `lib/calendar/timezone.test.ts`: a real IST/DST suite, now wired as `test:timezone`.
- About 18 root `scripts/test_*` files:
  - every import still resolves and most are guarded;
  - they were not run here, because several call live carrier APIs or need a running server;
  - Phase 14 wires the passing ones into CI and removes the broken ones.
- WIRE-UP items stay open as product work: invoices/GST download, minutes overview, bulk contact import, booking reschedule, report accept.

**Plain-language list for the owner: backend features that gave customers nothing and are now gone**
- SIP trunking (its screen had already been removed).
- A Gemini debug page and a carrier probe.
- Duplicate "my numbers" and Plivo purchase routes.
- An unused prompt optimiser.
- An unused trio of billing config, status and sync routes.
- A batch-detail route the screen never opened.
- A duplicate calendar disconnect route.
- A blueprint-detail route.
- An integrations module that was never switched on.
- An unused design kit and 50 unused frontend libraries.
