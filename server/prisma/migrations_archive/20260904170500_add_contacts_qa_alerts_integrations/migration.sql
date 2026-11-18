-- AlterTable
ALTER TABLE "users" ALTER COLUMN "number_locked" SET NOT NULL,
ALTER COLUMN "minutes_remaining_seconds" SET NOT NULL;

-- CreateTable
CREATE TABLE "ScheduledCall" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "scheduledAtUtc" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "batchId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastAttemptAt" TIMESTAMP(3),
    "originCallId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "startAtUtc" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "pacingPerMinute" INTEGER NOT NULL DEFAULT 5,
    "maxConcurrent" INTEGER NOT NULL DEFAULT 2,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "totalContacts" INTEGER NOT NULL DEFAULT 0,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BatchCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "agent_id" TEXT,
    "call_id" TEXT,
    "phone_number" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'outbound',
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'delivered',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "name" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "last_contacted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qa_cohorts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "filter_config" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'idle',
    "average_score" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "pass_rate_pct" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "total_scored" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qa_cohorts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_qa_results" (
    "id" TEXT NOT NULL,
    "cohort_id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "overall_score" INTEGER NOT NULL DEFAULT 100,
    "passed" BOOLEAN NOT NULL DEFAULT true,
    "hallucination_flag" BOOLEAN NOT NULL DEFAULT false,
    "resolution_flag" BOOLEAN NOT NULL DEFAULT true,
    "latency_gap_ms" INTEGER NOT NULL DEFAULT 0,
    "flagged_issues" TEXT NOT NULL DEFAULT '[]',
    "evaluation_summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_qa_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "comparator" TEXT NOT NULL,
    "threshold_value" DOUBLE PRECISION NOT NULL,
    "evaluation_window_mins" INTEGER NOT NULL DEFAULT 60,
    "check_frequency_mins" INTEGER NOT NULL DEFAULT 5,
    "notification_email" TEXT,
    "notification_webhook_url" TEXT,
    "webhook_secret" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_evaluated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_incidents" (
    "id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'triggered',
    "trigger_value" DOUBLE PRECISION NOT NULL,
    "summary" TEXT NOT NULL,
    "triggered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "alert_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_integrations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" TEXT NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledCall_idempotencyKey_key" ON "ScheduledCall"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ScheduledCall_status_idx" ON "ScheduledCall"("status");

-- CreateIndex
CREATE INDEX "ScheduledCall_scheduledAtUtc_idx" ON "ScheduledCall"("scheduledAtUtc");

-- CreateIndex
CREATE INDEX "ScheduledCall_batchId_idx" ON "ScheduledCall"("batchId");

-- CreateIndex
CREATE INDEX "BatchCampaign_status_idx" ON "BatchCampaign"("status");

-- CreateIndex
CREATE INDEX "chat_messages_user_id_idx" ON "chat_messages"("user_id");

-- CreateIndex
CREATE INDEX "chat_messages_agent_id_idx" ON "chat_messages"("agent_id");

-- CreateIndex
CREATE INDEX "chat_messages_phone_number_idx" ON "chat_messages"("phone_number");

-- CreateIndex
CREATE INDEX "chat_messages_created_at_idx" ON "chat_messages"("created_at");

-- CreateIndex
CREATE INDEX "contacts_user_id_idx" ON "contacts"("user_id");

-- CreateIndex
CREATE INDEX "contacts_phone_number_idx" ON "contacts"("phone_number");

-- CreateIndex
CREATE INDEX "contacts_last_contacted_at_idx" ON "contacts"("last_contacted_at");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_user_id_phone_number_key" ON "contacts"("user_id", "phone_number");

-- CreateIndex
CREATE INDEX "qa_cohorts_user_id_idx" ON "qa_cohorts"("user_id");

-- CreateIndex
CREATE INDEX "call_qa_results_cohort_id_idx" ON "call_qa_results"("cohort_id");

-- CreateIndex
CREATE INDEX "call_qa_results_call_id_idx" ON "call_qa_results"("call_id");

-- CreateIndex
CREATE UNIQUE INDEX "call_qa_results_cohort_id_call_id_key" ON "call_qa_results"("cohort_id", "call_id");

-- CreateIndex
CREATE INDEX "alert_rules_user_id_idx" ON "alert_rules"("user_id");

-- CreateIndex
CREATE INDEX "alert_rules_enabled_idx" ON "alert_rules"("enabled");

-- CreateIndex
CREATE INDEX "alert_incidents_rule_id_idx" ON "alert_incidents"("rule_id");

-- CreateIndex
CREATE INDEX "alert_incidents_user_id_idx" ON "alert_incidents"("user_id");

-- CreateIndex
CREATE INDEX "alert_incidents_status_idx" ON "alert_incidents"("status");

-- CreateIndex
CREATE INDEX "user_integrations_user_id_idx" ON "user_integrations"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_integrations_user_id_type_key" ON "user_integrations"("user_id", "type");

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qa_cohorts" ADD CONSTRAINT "qa_cohorts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_qa_results" ADD CONSTRAINT "call_qa_results_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "qa_cohorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_qa_results" ADD CONSTRAINT "call_qa_results_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_incidents" ADD CONSTRAINT "alert_incidents_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "alert_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_incidents" ADD CONSTRAINT "alert_incidents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_integrations" ADD CONSTRAINT "user_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
