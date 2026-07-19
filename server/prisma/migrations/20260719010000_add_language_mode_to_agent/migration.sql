-- AlterTable
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "language_mode" TEXT NOT NULL DEFAULT 'auto';
