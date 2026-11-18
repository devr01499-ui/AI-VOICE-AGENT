-- Migration: 20261017010000_batch_idempotency_consent_and_position
-- Add idempotencyKey, consent, estimatedMinutes to batches
ALTER TABLE "batches" ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT;
ALTER TABLE "batches" ADD COLUMN IF NOT EXISTS "consent_confirmed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "batches" ADD COLUMN IF NOT EXISTS "consent_confirmed_by" TEXT;
ALTER TABLE "batches" ADD COLUMN IF NOT EXISTS "consent_confirmed_at" TIMESTAMP(3);
ALTER TABLE "batches" ADD COLUMN IF NOT EXISTS "estimated_minutes" INTEGER;

-- Partial unique index on idempotency_key
CREATE UNIQUE INDEX IF NOT EXISTS "batches_idempotency_key_unique" ON "batches"("idempotency_key") WHERE "idempotency_key" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "batches_idempotency_key_idx" ON "batches"("idempotency_key");

-- Add position, caller_phone_number to batch_recipients
ALTER TABLE "batch_recipients" ADD COLUMN IF NOT EXISTS "position" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "batch_recipients" ADD COLUMN IF NOT EXISTS "caller_phone_number" TEXT;

-- Foreign key and indexes for batch_recipients
CREATE INDEX IF NOT EXISTS "batch_recipients_batch_id_position_idx" ON "batch_recipients"("batch_id", "position");
CREATE INDEX IF NOT EXISTS "batch_recipients_call_id_idx" ON "batch_recipients"("call_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'batch_recipients_call_id_fkey'
  ) THEN
    ALTER TABLE "batch_recipients" 
    ADD CONSTRAINT "batch_recipients_call_id_fkey" 
    FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
