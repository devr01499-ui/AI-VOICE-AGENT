-- Additive, backward compatible: creates one new table; touches no existing table or row.
-- Rollback: DROP TABLE "notification_receipts";  (only loses per-user read/dismiss state for announcements)

-- CreateTable
CREATE TABLE "notification_receipts" (
    "id" TEXT NOT NULL,
    "alert_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "dismissed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_receipts_user_id_idx" ON "notification_receipts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_receipts_alert_id_user_id_key" ON "notification_receipts"("alert_id", "user_id");

-- AddForeignKey
ALTER TABLE "notification_receipts" ADD CONSTRAINT "notification_receipts_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "system_alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

