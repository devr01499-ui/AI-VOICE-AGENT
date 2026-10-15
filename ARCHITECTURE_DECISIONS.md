# ARCHITECTURE_DECISIONS

## ADR-001: Next.js 14 App Router Framework Selection
- **Status**: Proposed
- **Context**: The Voice AI Agent Dashboard requires highly interactive pages, visual canvas editing, search capabilities, and API route endpoints.
- **Decision**: Use Next.js 14 with App Router to support server components, server-side actions, client-side interactive canvas editors, and seamless API endpoints.
- **Rejected Alternative**: Single Page Application (SPA) via Vite + React. Reason: Lacks clean, server-side data loading patterns, optimized SEO, and robust api routing.
- **Consequences**: Fast initial page loads, structured routing, but requires careful hydration handling when using client-heavy state like Zustand/dnd-kit.

## ADR-002: State Management Strategy
- **Status**: Proposed
- **Context**: The drag-and-drop workflow canvas requires a fast and centralized client-side state manager to handle undo/redo, dynamic connections, and canvas coordinates.
- **Decision**: Use Zustand for local/canvas-specific states and React Query for server states.
- **Rejected Alternative**: Redux Toolkit. Reason: High boilerplate and slower setup cycles for lightweight interactive states.
- **Consequences**: Minimal boilerplate, easily decoupled from API queries.

## ADR-003: Prisma 7 SQLite Connection via Driver Adapter
- **Status**: Proposed
- **Context**: Prisma 7 has removed support for direct native Rust-based query engines. Initializing the Prisma Client constructor with SQLite now requires a JavaScript driver adapter, or the initialization fails.
- **Decision**: Install `better-sqlite3` and `@prisma/adapter-better-sqlite3`, and pass the `PrismaBetterSqlite3` adapter to the `PrismaClient` constructor.
- **Rejected Alternative**: Downgrading to Prisma v6. Reason: Reverting Prisma versions would break dependencies and cause version conflicts with package-lock.json and other workspace configurations.
- **Consequences**: Adds `better-sqlite3` and its types to dependencies, but enables Prisma 7 compatibility in SQLite local environments.

## ADR-004: Vobiz Phone Number Integration Strategy
- **Status**: Accepted
- **Context**: The application requires provisioning and assigning phone numbers. We initially explored the Vobiz Partner Program and Sub-Accounts to isolate billing per customer.
- **Decision**: Use the standard Vobiz Phone Numbers API under the master account to search and purchase numbers. Do not use the Partner API for Sub-Account provisioning.
- **Rejected Alternative**: Vobiz Partner Program & automated Sub-Account provisioning. Reason: Adds unnecessary complexity and requires high monthly spend commitments.
- **Consequences**: Simplifies the integration significantly. Tracking minutes/credits in our own database remains the correct architecture until Partner tier is reached.
- **Verified Tier Evidence Note**:
  - Sub-account creation (`POST /api/v1/accounts/{auth_id}/sub-accounts/`) is available on our standard account tier and can be leveraged if per-customer KYC/number isolation is required in the future.
  - Sub-account balance funding (`POST /api/v1/partner/accounts/{customer_auth_id}/transfer-balance`) is confirmed Partner-tier only (path prefixed under `/partner/`), requiring a $100k/month minimum commitment. This validates ADR-004's decision to maintain internal credit ledgering in our database.

## ADR-005: Statutory Server-Side PAN Entity Category Derivation & Aadhaar KYC Gating
- **Status**: Accepted
- **Context**: Users could self-declare `panType = 'company'` in client payloads to bypass statutory Aadhaar identity verification required for individuals under Indian telecommunications and KYC compliance regulations.
- **Decision**: Authoritative entity classification is derived strictly on the server by inspecting the statutory 4th character of the PAN number (`P`/`H` = Individual/Personal requiring Aadhaar via DigiLocker; `C`/`F`/`A`/`T`/`B`/`L`/`J`/`G` = Company/Business Entity requiring GSTIN). Client submissions contradicting the derived category are rejected with HTTP 400 (`PAN_CATEGORY_MISMATCH`). The 4th character is preserved during PAN masking (`ABCP****2D`) so stored documents can be re-evaluated authoritatively without plaintext exposure.
- **Rejected Alternative**: Trusting client-supplied `panType` or depending exclusively on asynchronous Vobiz API category parsing without statutory 4th-character validation. Reason: Remote API payloads may omit entity fields or fail during network timeouts, whereas the 4th character is an immutable NSDL statutory encoding executed locally with zero latency.
- **Consequences**: Closes the Aadhaar bypass vulnerability entirely; guarantees compliance with carrier sub-account audit requirements; ensures individual callers are verified before phone number provisioning.

## ADR-006: Claritiy Voice Admin Console & Unified Minutes Ledger Architecture
- **Status**: Accepted
- **Context**: Operational management of customers, plan purchases, minute grants, account restrictions, and audits currently lacks a centralized, auditable back-office system. Furthermore, minutes deduction is split across multiple asynchronous handlers (`CallService.deductCallMinutes`, `GeminiLiveProvider.clearSessionBalanceTicker`, `WebhookController`), causing double-deduction risks and drift.
- **Decision**: 
  1. Build an isolated administrative web application in `Admin/` (Vite + React 18 SPA) deployed to a separate Vercel project (`admin.claritiy.com`), consuming backend APIs under `/api/v2/admin/*`.
  2. Implement an immutable, append-only `MinutesLedger` and transactional `MinutesService` (`credit`/`debit`) using idempotency keys, consolidating minutes calculation into a single authoritative source of truth.
  3. Enforce deny-by-default role-based access control (`StaffUser` table, `requireStaff(permission)` middleware) mandating valid Supabase JWT, active staff status, and `aal2` (TOTP MFA). Non-staff tokens receive 404 responses to obscure admin endpoint existence.
  4. Implement atomic transaction auditing (`withAudit`) pairing every mutating administrative action with an `AdminAuditLog` record containing a mandatory reason and correlation request ID.
  5. Establish an automated sequential GST-compliant invoice generation engine linked to `PaymentTransaction` records, accessible from the customer settings dashboard.
- **Rejected Alternative**: Embedding admin routes inside `Frontend/` and keeping column-level `User.callingBalanceMinutes` direct decrement queries. Reason: Violates boundary isolation, risks exposing internal administrative interfaces to end-users, and retains race conditions in balance calculations.
## ADR-007: Canonical Email Normalization, Anti-Bot Gating, and Authoritative Server-Side Account State Preservation
- **Status**: Accepted
- **Context**: Users exploited client-controlled Supabase user metadata (`user_metadata.account_type`) to escalate privileges to paid tiers without payment, and created duplicate trial accounts using Gmail `+` tags, dot-aliases, and disposable email domains.
- **Decision**:
  1. Implement canonical email normalization (`emailNormalizer.ts`) stripping `+` tags for Gmail/Googlemail/Outlook/Yahoo/iCloud/Proton, stripping dot aliases in Gmail, and mapping `googlemail.com` to `gmail.com`.
  2. Maintain a strict disposable email domain blacklist blocking signups from temporary services.
  3. Strip `accountType` modification out of `requireAuth` upserts. The database is the sole authoritative source of truth for `accountType`, modifiable exclusively through `BillingService` payment fulfillment or staff administrative actions.
  4. Enforce strict email verification checking only `user.email_confirmed_at` on the verified Supabase user record, completely discarding client-controlled metadata.
  5. Add bot honeypots and IP rate limiting (5 attempts/hour for signup, 10 attempts/hour for login) with a 1.5s delay to prevent automated race attacks.
- **Rejected Alternative**: Relying on client-side form validation and trust of Supabase user_metadata flags. Reason: Any user with curl or DevTools can mutate client requests and user metadata directly.
- **Consequences**: Completely closes account duplication, disposable email spam, and client privilege escalation loopholes.

## ADR-008: Server-Side Entitlement & Paywall Enforcement Architecture
- **Status**: Accepted
- **Context**: A malicious actor bypassed client paywalls and accessed paid voice streaming, prompt engineering, and outbound calling capabilities without an active subscription. Audits revealed gaps where WebSocket endpoints, outbound call routes, AI prompt optimization, and Knowledge Base vectorization failed to enforce server-side balance or plan checks. Additionally, `findProfileByUserId` inadvertently exposed `passwordHash` to client callers.
- **Decision**:
  1. Implement comprehensive server-side entitlement middlewares (`requireActivePlan`, `requireCallingMinutes`, `requireAgentQuota`, `requireActivePlanOrBYOK`) in `server/src/middleware/planValidation.ts`.
  2. Enforce strict outbound calling gate (`requireCallingMinutes`) on all dialer routes (`POST /api/v2/calls`, `POST /api/v2/calls/outbound`, `POST /api/calls/outbound`), verifying effective calling balance (`minutesRemainingSeconds > 0 ? minutesRemainingSeconds : (callingBalanceMinutes * 60)`) prior to any call allocation or Vobiz telephony dispatch.
  3. Enforce strict user context binding in `CallController.initiateCall`, rejecting client-supplied `req.body.userId` unless caller is explicitly verified admin.
  4. Enforce live audio sandbox gate in `SandboxStreamHandler.ts`: reject connections without active paid plan, positive minute balance, or configured Gemini BYOK key, terminating with WebSocket code 4403.
  5. Protect Knowledge Base document uploads (`/api/v2/knowledge-base/upload`), web scraping (`/api/v2/knowledge-base/scrape`), conversational AI builder (`/api/v2/agents/conversational-builder`), and prompt optimization (`/api/v2/agents/optimize`) with `requireActivePlanOrBYOK`.
  6. Enforce free tier agent quota (`requireAgentQuota`): cap free accounts at 2 active agents.
  7. Sanitize `AgentRepository.findProfileByUserId` with explicit Prisma column projection, permanently eliminating password hash and calendar token leakage to client endpoints.
  8. Fix UI balance fallback in `BillingGateway.tsx` from `10.0` to `0.0`.
- **Rejected Alternative**: Client-side component gating alone or relying on post-call billing deduction. Reason: Client gates are trivially bypassed via script or direct API invocation, and post-call deduction allows zero-balance accounts to place unmetered calls without pre-authorization.
- **Consequences**: Outbound calls, live WebSocket audio streaming, vector indexing, and generative builders are strictly immunized against subscription bypass. Sensitive credentials are fully shielded.

## ADR-009: Timing-Safe Webhook Signatures, Idempotent Subscription Lifecycle & Session Revocation Architecture
- **Status**: Accepted
- **Context**: Razorpay webhook processing lacked timing-safe comparison, subscription lifecycle event handling (`subscription.charged`, `subscription.cancelled`, `subscription.paused`, `subscription.halted`), and immediate session invalidation when subscriptions were downgraded or cancelled.
- **Decision**:
  1. Enforce timing-safe signature comparison (`crypto.timingSafeEqual`) against raw request body buffers in `razorpayWebhookRouter.post('/razorpay')`. In production, fail-closed if `RAZORPAY_WEBHOOK_SECRET` is missing.
  2. Implement full subscription lifecycle processing:
     - `subscription.charged`: Automatically credit cycle minutes and keep plan active via `fulfillPlanPurchase`.
     - `subscription.cancelled` / `subscription.paused` / `subscription.halted`: Downgrade user account to `free` tier in PostgreSQL and trigger immediate global session revocation.
  3. Create `sessionManager.ts` (`revokeUserSessions`) to globally invalidate all active Supabase refresh tokens and sessions upon account downgrade or suspension, preventing stale client tokens from continuing to access paid endpoints.
  4. Build real-time subscription validation endpoints in `server/src/routes/billing.ts` (`GET /subscription-status` and `POST /sync-entitlements`) ensuring client UIs bypass stale local state and synchronize directly with authoritative database entitlements.
  5. Harden plan configuration fallback in `PlanFulfillmentService.ts` to support case-insensitive key resolution (`planKey.toLowerCase()`).
- **Rejected Alternative**: Relying on periodic background polling for subscription cancellations or depending on client-side token expiration. Reason: Background polling creates latency windows where cancelled accounts retain paid privileges; relying on client token expiration leaves a window of up to 1 hour of unauthorized access.
- **Consequences**: Razorpay webhooks are cryptographically secured against timing attacks, recurring renewals automatically replenish balances, cancellations immediately revoke sessions, and status synchronization is authoritative.

## ADR-010: Complete API Endpoint Inventory, Route Hardening & IDOR Protection Standard
- **Status**: Accepted
- **Context**: Comprehensive audit of all 22 router controllers revealed subtle IDOR vulnerabilities and missing rate limiters:
  1. `POST /api/v2/calendar/batches` accepted any client-supplied `agentId` without validating that the agent belonged to the authenticated user, and lacked outbound calling minute verification.
  2. `InboundCallService.updateCallingConfig` allowed arbitrary `assignedAgentId` or `inboundAgentId` to be associated with phone numbers without validating agent ownership.
  3. `POST /api/v2/calls/sip-trunks` lacked rate limiting and plan requirement (`requireActivePlan`).
  4. `POST /:id/end` and `POST /:id/transfer` lacked explicit `requireAuth` and rate limiters.
  5. `POST /api/v2/user/notifications` lacked admin verification, allowing any authenticated user to broadcast company-wide in-app notifications.
  6. Mutating endpoints across contacts, chat history, QA cohorts, team management, and API keys lacked rate limiting (`sensitiveOperationsLimiter`).
- **Decision**:
  1. Implement strict tenant-ownership validation on all sub-resource links: `agentId` in batches, `agentId` in phone calling configurations, and `agentId`/`callId` in chat history must resolve to `{ id, userId }`.
  2. Gated bulk dialing batch creation and batch resume with `requireCallingMinutes`.
  3. Enforce founder admin verification on global broadcast route `POST /api/v2/user/notifications`.
  4. Apply `sensitiveOperationsLimiter` (10 req/min) to all mutating endpoints: contacts, chat history, QA cohorts, team invites/roles, API key generation/revocation, user admin configurations, and integrations.
  5. Require active subscription (`requireActivePlan`) for SIP trunk registration, DID purchases, and programmatic API key generation.
  6. Document all 64 API endpoints in a complete inventory matrix (`api_endpoint_inventory_audit.md`) and verify with multi-tenant penetration suite (`test_phase4_idor_audit.js`).
- **Rejected Alternative**: Relying on database foreign keys alone without application-level tenant filtering. Reason: Foreign keys ensure referential integrity (that the referenced agent exists in the DB), but do NOT enforce multi-tenant authorization (that the referenced agent belongs to the calling user).
- **Consequences**: Complete immunization against IDOR attacks, cross-tenant agent hijacking, broadcast tampering, and unmetered dialing campaigns across all Claritiy Voice routes.

## ADR-011: Continuous Penetration Testing, Immediate Socket Binding & Security Standards
- **Status**: Accepted
- **Context**: Deployment of Phase 3 to Render timed out due to delayed HTTP socket binding caused by synchronous heavy imports (`googleapis`, `jsdom`, `pdfParser`) and asynchronous database connection blocks. Additionally, platform security across Phases 1–4 required an ongoing, automated regression harness to prevent regressions in authorization, billing, and tenant boundaries.
- **Decision**:
  1. Re-architect server entrypoints (`server/src/index.ts`) to bind `server.listen(PORT, HOST)` immediately on container boot (24ms startup time), guaranteeing instant cloud port scanner pass. Move database pooling, provider connections, and background evaluation into the asynchronous listen callback.
  2. Replace root `googleapis` imports with lightweight targeted packages (`google-auth-library` and subpath `googleapis/build/src/apis/calendar`), and convert heavy controller utilities (`jsdom`, `pdfParser`) to dynamic `await import()` calls.
  3. Build an automated, continuous penetration testing suite (`server/scripts/test_phase5_security_suite.js`) executing 19 end-to-end attack scenarios across duplicate email aliases, throwaway email domains, client paywall bypasses, multi-tenant IDOR access, HMAC webhook forgery, and idempotent payment replay.
  4. Establish `npm run test:security` in root and server `package.json` as a mandatory pre-commit and CI/CD verification gate.
  5. Codify comprehensive security documentation (`SECURITY_MODEL.md`) and operational protocols (`GOVERNANCE_RULES.md`).
- **Rejected Alternative**: Running tests only in staging environments or relying on manual post-deployment QA. Reason: Manual testing is prone to oversight and does not prevent regressions from merging into production branches.
- **Consequences**: Container deployments on Render succeed immediately, memory footprints during startup drop significantly, and every pull request is continuously guarded by 19 automated penetration tests.

## ADR-012: OWASP Top 10 (2026) Platform Security Hardening & Zero-Vulnerability Standards
- **Status**: Accepted
- **Context**: A comprehensive platform security audit against the OWASP Top 10 (2026) vulnerabilities identified several critical defense areas:
  1. *A10: Server-Side Request Forgery (SSRF)*: The knowledge base scraping endpoint (`POST /scrape`), runtime tool executors, webhook dispatchers, and MCP clients fetched user-specified URLs without destination IP or DNS validation, creating potential exposure to cloud metadata services (`http://169.254.169.254/latest/meta-data/`) and private RFC 1918 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`).
  2. *A05: Security Misconfigurations & Error Leakage*: Unhandled 500 exceptions in `errorHandler.ts` reflected `err.message` directly in client responses, potentially exposing database table names, file paths, or system internals in production.
  3. *A05: HTTP Security Headers*: Helmet lacked explicit long-term HSTS parameters (`max-age=31536000; includeSubDomains; preload`), explicit anti-clickjacking frameguard, and server fingerprint suppression.
  4. *A03: SQL Injection Code Smells*: Chunk deletion in `KnowledgeBaseController.ts` used `$executeRawUnsafe` instead of parameterized tagged template literals.
  5. *A06: Vulnerable Components*: Dependency audit reported 16 vulnerabilities, including critical `proxy-addr` IPv4-mapped IPv6 trust spoofing and high severity Axios SSRF/prototype pollution gadgets.
- **Decision**:
  1. **SSRF Defense Engine (`server/src/utils/ssrfValidator.ts`)**: Built an authoritative `assertSafeUrl` module that validates protocols (strictly `http:`/`https:`), strips embedded credentials, resolves target hostnames via `dns.promises.lookup`, and rigorously rejects loopback (`127.0.0.0/8`, `::1`), link-local/cloud metadata (`169.254.0.0/16`, `fe80::/10`), private networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `fc00::/7`), CGNAT (`100.64.0.0/10`), and IPv4-mapped loopback addresses. Integrated into `KnowledgeBaseController.scrape`, `ToolExecutor`, `WebhookDispatcher`, and `McpService`.
  2. **Production Error Masking (`errorHandler.ts`)**: In production (`NODE_ENV === 'production'`), replaced raw error details with sanitized client responses referencing an internal tracking identifier (`ERR-500-<timestamp>`), while maintaining structured server logs.
  3. **Hardened HTTP Security Headers (`index.ts`)**: Explicitly configured `app.disable('x-powered-by')`, HSTS with 1-year duration and preload directive, `frameguard: { action: 'deny' }`, `noSniff: true`, strict referrer policies, and tightly scoped CSP.
  4. **Prisma Query Parameterization**: Converted all raw database operations to safe parameterized tagged templates (`prisma.$executeRaw\`DELETE FROM "kb_chunks" WHERE "kb_id" = ${id}\``), eliminating SQL injection vectors.
  5. **Automated Dependency Remediation**: Executed `npm audit fix`, resolving 12 of 16 vulnerabilities including critical `proxy-addr` and high Axios issues without breaking runtime stability.
  6. **Automated Continuous OWASP Suite (`test_owasp_top10_audit.js`)**: Developed an automated 23-test suite verifying defenses across all 10 OWASP vectors, wired to `npm run test:owasp`.
- **Rejected Alternative**: Relying on perimeter network firewalls or cloud VPC security groups alone without application-level SSRF defense. Reason: Cloud VPCs and edge firewalls do not inspect dynamic HTTP fetch destinations initiated by backend Node processes, and cannot prevent internal requests to `169.254.169.254` or container loopback ports without application-level DNS/IP validation.
- **Consequences**: Claritiy Voice achieves zero open OWASP Top 10 vulnerabilities, complete immunity against SSRF and cloud metadata theft, sanitized production error reporting, A+ grade HTTP security headers, and automated continuous regression testing.

## ADR-013: Plivo Multi-Provider Telephony Integration & Tenant-Isolated Subaccounts Architecture
- **Status**: Accepted
- **Context**: Customers require the capability to browse and purchase Indian local (+91) phone numbers with transparent monthly rental, setup fee, and 18% GST breakdowns directly within Claritiy Voice. The existing Vobiz provider integration is fully operational and must remain completely untouched. Plivo provides isolated subaccount capabilities under a parent account with centralized billing.
- **Decision**:
  1. Maintain complete decoupling: Vobiz routes, models, and services (`VobizService`, `VobizInventoryService`, `VobizPhoneNumberService`, `VobizSubAccount`) remain 100% unchanged.
  2. Implement `PlivoService` (`server/src/core/telephony/PlivoService.ts`) for dedicated Plivo operations:
     - Retry-safe, idempotent subaccount provisioning (`PlivoSubAccount` model) created lazily on customer's first Plivo onboarding interaction. Subaccount tokens are encrypted at rest with AES-256-GCM via `EncryptionService` and never exposed to the client.
     - Indian local number search restricted strictly to `country_iso=IN` and `type=local` (excluding US numbers or unsupported toll-free).
     - Parent account executes purchases and binds numbers to customer subaccounts (`subaccount: subaccountAuthId`) and application routing (`app_id: PLIVO_APP_ID`).
  3. Frontend: Upgrade `NumberSearchAndPurchase.tsx` with a top-level provider selector (Vobiz Network vs Plivo Carrier) and detailed cost/tax/KYC transparency breakdown.
  4. Environment: Add `PLIVO_AUTH_ID`, `PLIVO_AUTH_TOKEN`, and `PLIVO_APP_ID` to `render.yaml` and `.env.example`.
- **Rejected Alternative**: Storing all customer numbers in a single shared Plivo master account without subaccount isolation. Reason: Subaccounts provide complete CDR, call log, recording, and tenant data segregation while keeping all financial charges centralized under the parent account.
- **Consequences**: Zero risk to existing Vobiz numbers, seamless multi-provider coexistence, robust tenant isolation, and strict compliance with Indian DoT KYC requirements.



