-- Audit #79: a separate inbound switch per number, so turning inbound off no longer blocks outbound.
-- Additive and safe to re-run. Rollback: ALTER TABLE "phone_numbers" DROP COLUMN IF EXISTS "inbound_enabled";
ALTER TABLE "phone_numbers" ADD COLUMN IF NOT EXISTS "inbound_enabled" BOOLEAN NOT NULL DEFAULT true;
-- Only the old inbound switch ever set status 'inactive': restore those numbers to active with inbound off.
UPDATE "phone_numbers" SET "status" = 'active', "inbound_enabled" = false WHERE "status" = 'inactive';
