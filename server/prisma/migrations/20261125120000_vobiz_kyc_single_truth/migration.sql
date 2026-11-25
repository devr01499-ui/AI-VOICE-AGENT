-- KYC single source of truth (fix/kyc-single-truth 2026-11-25): the carrier's last answer and its
-- per-document result are stored so the customer dashboard and the admin console show the same thing.
-- Additive and nullable: existing rows keep NULL until their next carrier check.
-- Rollback: ALTER TABLE "vobiz_sub_accounts" DROP COLUMN "kyc_checked_at", DROP COLUMN "kyc_verifications";
ALTER TABLE "vobiz_sub_accounts" ADD COLUMN "kyc_checked_at" TIMESTAMP(3),
ADD COLUMN "kyc_verifications" JSONB;
