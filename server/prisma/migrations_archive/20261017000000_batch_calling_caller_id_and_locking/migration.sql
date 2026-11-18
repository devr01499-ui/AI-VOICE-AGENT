-- AlterTable
ALTER TABLE "batches" ADD COLUMN IF NOT EXISTS "from_phone_number_id" TEXT;
ALTER TABLE "batches" ADD COLUMN IF NOT EXISTS "status_reason" TEXT;
ALTER TABLE "batches" ADD COLUMN IF NOT EXISTS "locked_by" TEXT;
ALTER TABLE "batches" ADD COLUMN IF NOT EXISTS "locked_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "batch_recipients" ADD COLUMN IF NOT EXISTS "last_error" TEXT;
ALTER TABLE "batch_recipients" ADD COLUMN IF NOT EXISTS "last_error_code" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "batches_from_phone_number_id_idx" ON "batches"("from_phone_number_id");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'batches_from_phone_number_id_fkey'
  ) THEN
    ALTER TABLE "batches" ADD CONSTRAINT "batches_from_phone_number_id_fkey" FOREIGN KEY ("from_phone_number_id") REFERENCES "phone_numbers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
