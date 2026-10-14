# CLARITIY VOICE — COMPREHENSIVE SECURITY MODEL & ARCHITECTURAL SPECIFICATION

**Document Version**: 2.0 (Post-Security Audit Hardening)  
**Classification**: Engineering Standard & Governance Contract  
**Authority**: Mandatory for all developers, PR reviewers, and automated CI/CD pipelines.

---

## 1. Architectural Philosophy & Zero-Trust Core

Claritiy Voice enforces an uncompromising **Zero-Trust & Server-Authoritative Architecture**:
1. **Zero Client Trust**: No client-side state, local storage, cookie claims, or HTTP headers (`x-user-tier`, `x-client-paywall-bypassed`, etc.) are ever trusted for authentication, billing authorization, quota checks, or identity derivation.
2. **Authoritative Persistence Layer**: The PostgreSQL database (managed via Prisma 7 with connection pooling) is the single source of truth for user roles (`accountType`), subscription status, remaining minute balances (`minutesRemainingSeconds`), and resource ownership.
3. **Compound Tenant Isolation (Anti-IDOR)**: Every read, update, delete, or association operation against user-owned resources (Agents, Calls, Numbers, Batches, QA Cohorts, CRM Contacts, API Keys) MUST be bounded by a compound query `where: { id: resourceId, userId: authenticatedUserId }`.
4. **Immediate Container Availability**: Cloud web services bind their listening port (`server.listen`) within milliseconds of startup before executing remote database pools or provider warmups.

---

## 2. Authentication & Identity Integrity (Phase 1)

### 2.1 Canonical Email Normalization (`emailNormalizer.ts`)
To eliminate duplicate trial accounts and email aliasing exploits:
- **Case & Whitespace Invariance**: All emails are trimmed and converted to lowercase before database query or persistence.
- **Gmail & Googlemail Canonicalization**:
  - `googlemail.com` is automatically mapped to `gmail.com`.
  - All periods (`.`) within the local part of Gmail addresses are stripped (`user.name@gmail.com` -> `username@gmail.com`).
  - All `+tag` suffixes are stripped across Gmail, Googlemail, Outlook, Hotmail, Live, Yahoo, iCloud, and Proton (`user+trial1@gmail.com` -> `user@gmail.com`).
- **Database Unique Constraint**: A PostgreSQL unique index on `canonicalEmail` ensures identical physical mailboxes cannot create multiple accounts.

### 2.2 Disposable Domain Defense & Bot Gating
- **Blacklist Enforcement**: Real-time evaluation against a blacklist of 60+ throwaway email providers (`10minutemail.com`, `temp-mail.org`, `guerrillamail.com`, etc.).
- **Fail-Closed Signup Policy**: Any registration attempt matching disposable domain patterns is rejected with HTTP 400 (`DISPOSABLE_EMAIL_REJECTED`).
- **Bot Rate Limiting & Honeypots**:
  - Auth endpoints are rate-limited (`authLimiter`: 5 signups/hour per IP, 10 logins/hour per IP).
  - Invisible honeypot inputs silently trap automated scraping bots and script submissions.

### 2.3 Verified Email Requirement
- Feature gating and workspace access mandate verified email confirmation (`user.email_confirmed_at`). Client-controlled metadata in JWT payloads is ignored in favor of direct Supabase Auth administrative confirmation.

---

## 3. Paywall & Entitlement Enforcement Architecture (Phase 2)

### 3.1 Server-Side Entitlement Middlewares (`planValidation.ts`)
Every chargeable or premium action is gated by strict, non-bypassable Express middleware:
- **`requireCallingMinutes`**: Mandates `effectiveRemainingSeconds > 0` before initiating any outbound PSTN call (`POST /api/v2/calls`, `POST /api/v2/calls/outbound`), or launching batch dialing campaigns (`POST /batches`, `POST /batches/:id/resume`). Free accounts with 0 balance receive HTTP 402 (`INSUFFICIENT_CALLING_MINUTES`).
- **`requireActivePlan`**: Enforces paid tier (`startup`, `growth`, `enterprise`) or positive calling minutes on metered services (SIP trunk creation, phone number purchasing, team member invitations, API key provisioning).
- **`requireActivePlanOrBYOK`**: Protects generative AI features (Knowledge Base PDF parsing, website scraping, AI conversational builder, prompt optimization). Free users must either upgrade or configure a personal Gemini API key (`BYOK`).
- **`requireAgentQuota`**: Enforces a strict quota cap of 2 active agents on free tier workspaces.

### 3.2 WebSocket Live Audio Sandbox Gate (`SandboxStreamHandler.ts`)
- WebSocket upgrades to `/ws/sandbox` require cryptographically verified Supabase tokens.
- On connection, `isUserEntitled()` validates entitlement in real time. Accounts with 0 balance and without BYOK keys are terminated with WebSocket close code `4403` (`ACTIVE_PLAN_REQUIRED`).

### 3.3 Sensitive Credential Shielding (`AgentRepository.ts`)
- `findProfileByUserId` uses explicit Prisma column selection, permanently excluding sensitive hashes (`passwordHash`, `googleCalendarTokens`, OAuth tokens) from API responses.

---

## 4. Payment Integrity, Webhook Cryptography & Session Revocation (Phase 3)

### 4.1 Timing-Safe Webhook Verification (`razorpayWebhook.ts`)
- Razorpay webhook callbacks are verified using `crypto.timingSafeEqual` comparing HMAC-SHA256 digests against `req.rawBody`.
- In production, missing `RAZORPAY_WEBHOOK_SECRET` fails closed immediately with HTTP 500, rejecting all unauthenticated requests.

### 4.2 Idempotent Ledger Fulfillment (`PlanFulfillmentService.ts`)
- Every plan fulfillment records a transactional `PaymentTransaction` with a unique database constraint on `paymentId`.
- Duplicate or replayed webhook events return HTTP 200 idempotently (`alreadyProcessed: true`) with zero double-crediting of minutes.

### 4.3 Subscription Lifecycle & Global Session Revocation (`sessionManager.ts`)
- **`subscription.charged`**: Automatically renews billing cycle minutes and preserves active plan state.
- **`subscription.cancelled` / `subscription.paused` / `subscription.halted`**: Immediately updates user `accountType` to `free` in PostgreSQL and invokes `revokeUserSessions(userId)`:
  - Calls `supabaseAdmin.auth.admin.signOut(userId, 'global')` to invalidate all active refresh tokens.
  - Updates `user.sessionInvalidatedAt` in PostgreSQL, causing any subsequent request with a stale JWT to be rejected with HTTP 401 (`SESSION_REVOKED`).

---

## 5. Multi-Tenant IDOR Protection & Endpoint Inventory (Phase 4)

### 5.1 The IDOR Prevention Rule
Developers are strictly forbidden from writing queries of the form:
```ts
// VULNERABLE: Lacks tenant isolation
const agent = await prisma.agent.findUnique({ where: { id: req.params.id } });
```
All queries against multi-tenant models must be structured as:
```ts
// SECURE: Enforces compound tenant ownership
const agent = await prisma.agent.findFirst({
  where: { id: req.params.id, userId: req.userId },
});
if (!agent) {
  return res.status(404).json({ success: false, error: 'Resource not found' });
}
```

### 5.2 Covered Multi-Tenant Boundaries
1. **Outbound Batches**: `POST /batches` verifies `where: { id: agentId, userId }`.
2. **Phone Number Config**: `assignedAgentId` and `inboundAgentId` must belong to the caller's workspace.
3. **Supervisor Call Interventions**: `POST /:id/end` and `POST /:id/transfer` require authenticated session and call ownership.
4. **CRM Contacts & Chat Logs**: Mutating actions verify `userId` ownership.
5. **System Notifications**: `POST /api/v2/user/notifications` is gated strictly behind verified founder admin status (`accountType === 'admin' || email === ADMIN_EMAIL`).

---

## 6. Continuous Automated Penetration Suite (Phase 5)

Continuous security compliance is enforced via `npm run test:security`:
- **Script**: `server/scripts/test_phase5_security_suite.js`
- **Scope**: 19 automated tests validating email normalization, throwaway rejection, client paywall bypass immunity, IDOR isolation across tenants, HMAC timing-safe webhook defense, payment replay immunity, and alerting triggers.
- **CI/CD Requirement**: Must pass with 100% coverage (0 failures) on every deployment.

---

## 7. Security Incident Response & Audit Checklist (Phase 6)

### 7.1 Pre-Deployment Security Review Checklist
Before releasing any new route or feature involving payments, subscriptions, or resources:
- [ ] Is every mutating endpoint protected with `requireAuth` or `requireAuthOrApiKey`?
- [ ] Is rate limiting attached (`sensitiveOperationsLimiter` or `authLimiter`)?
- [ ] Are all database lookups compound-filtered by `userId`?
- [ ] Are plan requirements (`requireActivePlan`, `requireCallingMinutes`) enforced on metered actions?
- [ ] Are raw password hashes, tokens, or encryption keys omitted from API JSON responses?
- [ ] Does `npm run test:security` pass with 100% assertions?

### 7.2 Incident Logging Protocol (`ERROR_LOG.md`)
Every security anomaly or system failure must be logged with:
`Symptom -> Root Cause -> Fix -> Prevention Rule`.
