-- Audit #80: store when a "schedule for later" campaign should start.
-- Additive and safe to re-run. Rollback: ALTER TABLE "batches" DROP COLUMN IF EXISTS "scheduled_at";
ALTER TABLE "batches" ADD COLUMN IF NOT EXISTS "scheduled_at" TIMESTAMP(3);
