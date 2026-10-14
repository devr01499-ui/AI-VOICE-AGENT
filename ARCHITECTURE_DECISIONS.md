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




