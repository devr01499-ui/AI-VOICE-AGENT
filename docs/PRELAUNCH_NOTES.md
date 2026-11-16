# Pre-launch notes (written 2026-11-16, before Phase 1)

Detail behind the summaries in PROGRESS.md. Everything here was established by reading code or running against a local throwaway database. Nothing connected to production.

## 1. Payment questions (answered from the code)

**a) Can a user without an active plan or without verified KYC get a number through the paid route?** No.
- `POST /numbers/create-order`, `/numbers/purchase` and `/numbers/plivo/purchase` all run `requireAuth`, `requireEditor`, `requireActivePlan`, and then `checkRequiredKycDocumentsVerified` before anything else (`server/src/routes/numbers.ts` L253-267, L315-345, L1198-1227).
- Caveat for Phase 7: `requireActivePlan` uses `isUserEntitled` (`middleware/planValidation.ts` L36-53), which also passes a free-type account that still has minutes left. That is looser than the rule "active paid subscription only".

**b) Can a plan be bought for less than the server price?** Not in normal operation, but the check fails open.
- `/billing/verify-plan` and `/billing/verify-plan-payment` share one handler (`routes/billing.ts` L52-136): signature check, then `BillingService.processPlanPurchase` (L217-341), which fetches the order and the payment from Razorpay and compares both amounts with the server-side plan price, plus order/payment match and the user in the notes.
- Weakness 1: both fetches sit in `try/catch` blocks that only log a warning when Razorpay cannot be reached (L255-258, L283-288). If the Razorpay API errors at that moment, a validly signed pair for a smaller amount would be accepted.
- Weakness 2: payment status `authorized` is accepted as well as `captured` (L265).
- Weakness 3: the user check is skipped when the order has no `userId` note (L245-246), and number orders are created without notes.
- The webhook path does reject on amount mismatch (`routes/razorpayWebhook.ts` L156-166).

**c) Can the same paymentId be used for two different purchases?** Yes, in one case.
- Plan purchases: no. `PaymentTransaction` has unique `orderId` and `paymentId` (`schema.prisma` L1082-1083) and `fulfillPlanPurchase` checks both inside a transaction.
- Number purchases do not record the payment in `PaymentTransaction`. The Vobiz path only keys on `orderId` in `PhoneNumberOrder`; the Plivo path has no payment record at all. So a payment already redeemed for a plan is accepted again by the paid number routes, and the amount is never checked there.
- Value gained today: one number, which the free `/numbers/claim` route gives anyway, and the account is then locked. Owner decision 2026-11-16: no hotfix; fix completely in Phase 6 with forged-signature, replay, amount-tampering and wrong-user tests.

## 2. Secrets in git

- Committed `.env` or key files: **no**. Only `Admin/.env.example`, `Frontend/.env.example`, `server/.env.example`, now and in all history.
- Hard-coded secrets inside tracked files: **yes**.
  - `server/check_bypass.js`, `server/check_policies.js`, `server/check_rls.js`, `server/enable_rls.js`, `server/scratch_pg.js` contained the production database URL including the current password. Removed from the files on 2026-11-16; the value remains in git history and the GitHub repository is public. **The owner must rotate the database password.**
  - `server/src/providers/gemini/GeminiLiveProvider.ts` L225 compares against one specific Google API key string. It does not match any key in `server/.env`. Owner should confirm that key is revoked; remove the literal in Phase 11 or 12.
  - `Admin/.env.example`, `Admin/src/lib/supabase.ts`, `Frontend/src/app/lib/supabaseClient.ts` contain the Supabase anon key. That key is public by design, but it makes Row Level Security the only protection, so the RLS review in Phase 12 matters.

## 3. Test secrets audit

Before the isolation change, guarded scripts loaded every secret in `server/.env`. Scripts that can reach a live service directly:
- Razorpay (9): `test_payment_gateway_security.js`, `test_plan_security.ts`, `test_compiled_order.js`, `test_e2e_verification.js`, `test_order_creation.js`, `test_order_verification.js`, `test_order_with_env.js`, `test_payment_replay.ts`, `test_refund_alert.js`.
- Email (4): `send-daily-report.ts`, `test_audit_logging_compliance.js`, `test_kyc_email_idempotency.ts`, `test_kyc_notification_resend.js`.
- Carriers (34): includes `test_vobiz_real.js/.ts`, `test_vobiz_inventory.ts`, `test_curl_vobiz.js`, `link_user_plivo_number.ts`, `migrateAdminVobizTrunk.ts`, `test_subaccount_race.js`, `test_subaccount_repair.js`, `test_number_assignment_failure.js`, `verify_kyc_fixes.js`, `probe_vobiz.js`, `test_vobiz*.js` in `server/`, and the local scratch files.
- Gemini (12): includes `eval_street_smart_live.ts`, `eval/run_eval_harness.ts`, `eval_rag_baseline.js`, `audit_reports.ts`, `test-latency.ts`, `test_turn_latency_measurement.js`, `verify_and_certify_all.ts`.
- Supabase admin (3): `audit_and_reset_mock_kyc.js`, `test_turn_latency_measurement.js`, `create-first-owner.ts`.

This list comes from a text search for SDKs, endpoints and key names; scripts that reach a service only through imported application code may be missing. The fix does not depend on the list: the guard now blanks 18 live-service keys for every guarded script before `.env` can load. `TEST_<NAME>` opts in to a sandbox value; live Razorpay keys and `NODE_ENV=production` are refused. With isolation on, `test:security`, `test:owasp`, `test:payment-security` and `test:street-smart` still pass on the local database.

Not covered: scripts that hard-code a credential, and the 18 unguarded scripts with no database or test naming (for example `server/probe_vobiz.js`, `scratch/check_vobiz_kyc_flow.js`).

## 4. Migrations and Render: two options

Facts: `prisma migrate deploy` on an empty database fails at `20260904170500_add_contacts_qa_alerts_integrations`; about 175 statements exist only in `schema.prisma`; `render.yaml` runs `prisma db push --skip-generate` in the build with `autoDeploy: true` on `main`.

Required end state for both options: Render deploys with `prisma migrate deploy`, never `db push`, and CI builds a clean empty database from the committed migrations.

Shared preparation (done by Claude in a later phase, fully offline):
1. Generate one baseline SQL file from the schema with no database connection: `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`.
2. Prepend `CREATE EXTENSION IF NOT EXISTS vector;` and append the Row Level Security statements from the existing `20260803000001_enable_rls` migration (`db push` and `migrate diff` do not carry RLS policies).
3. Move the 14 old migration folders to an archive folder outside `prisma/migrations`, and commit the baseline as the only migration.
4. Prove it: apply with `migrate deploy` to an empty local database, then run `migrate diff` between that database and `schema.prisma` and require an empty result. Add the same check to CI.

**Option A — keep the production database, mark the baseline as applied (recommended).**
- Owner runs, against production, a read-only drift check first: `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`. Empty output means production already equals the schema.
- If empty: owner runs `prisma migrate resolve --applied <baseline_name>`. This writes one row to `_prisma_migrations` and changes nothing else.
- If not empty: the output is the exact SQL difference. It becomes a second, reviewed migration before anything is marked applied.
- Then `render.yaml` changes to `prisma migrate deploy` in one small PR.
- Cost: owner runs two commands. Risk: low; nothing is dropped.

**Option B — recreate the production database from the baseline.**
- Owner resets the `public` schema and runs `prisma migrate deploy`.
- Guarantees production equals the migrations exactly.
- Cost: loses the owner account rows, KYC records, plan and minutes ledger, and the mapping to carrier sub-accounts and any number already bought at the carriers. Those carrier-side objects would then have no owner in the database and need manual cleanup. Supabase `auth` users are separate and would no longer match `public.users`.

**Recommendation: Option A.** It reaches the same end state without orphaning carrier sub-accounts or numbers, and the drift check tells us exactly what production looks like before anything is changed. Choose B only if the drift check shows differences too messy to reconcile.

Until this is done, do not change `render.yaml`, and treat every push to `main` as a production schema push.
