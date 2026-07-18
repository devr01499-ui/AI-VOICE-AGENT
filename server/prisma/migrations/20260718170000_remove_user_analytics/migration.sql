-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "total_minutes_consumed" DOUBLE PRECISION NOT NULL DEFAULT 0.0;

-- DropTable
DROP TABLE IF EXISTS "user_analytics";
