-- Admin "force sign-out" (fix/admin-panel 2026-11-23): sessions signed in before this time are refused.
-- Additive and nullable: existing rows keep NULL (no session is affected).
-- Rollback: ALTER TABLE "users" DROP COLUMN "sessions_revoked_at";
ALTER TABLE "users" ADD COLUMN "sessions_revoked_at" TIMESTAMP(3);
