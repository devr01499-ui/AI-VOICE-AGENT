-- Plan validity (owner decision 2026-11-19): a plan ends 30 days after purchase or when its minutes run out.
-- Additive and nullable: existing rows keep NULL (packs sold before this rule never time out).
-- Rollback: ALTER TABLE "users" DROP COLUMN "plan_expires_at";
ALTER TABLE "users" ADD COLUMN "plan_expires_at" TIMESTAMP(3);
