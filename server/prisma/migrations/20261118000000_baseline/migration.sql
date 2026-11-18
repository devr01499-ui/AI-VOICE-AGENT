-- Baseline (M0, 2026-11-18): the complete schema in one migration, generated offline with
--   prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
-- plus the statements schema.prisma cannot express (vector extension, expression index, RLS).
-- The previous 17 migrations could not build an empty database (they failed at
-- 20260904170500); they are kept for history in prisma/migrations_archive/.
-- Production: do NOT run this. Follow PRELAUNCH_NOTES §4 Option A (drift check, then
-- prisma migrate resolve --applied 20261118000000_baseline).
-- RLS policies call Supabase auth.uid(); a plain Postgres (CI) needs a stub auth.uid() first.

CREATE EXTENSION IF NOT EXISTS vector;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "account_type" TEXT NOT NULL DEFAULT 'free',
    "billing_balance" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "contact_number" TEXT,
    "gemini_api_key" TEXT,
    "google_calendar_tokens" TEXT,
    "calling_balance_minutes" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "minutes_remaining_seconds" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "total_minutes_consumed" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "number_locked" BOOLEAN NOT NULL DEFAULT false,
    "data_retention_days" INTEGER,
    "allowed_ip_ranges" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "max_concurrent_calls" INTEGER DEFAULT 10,
    "has_consented_terms" BOOLEAN NOT NULL DEFAULT false,
    "account_status" TEXT NOT NULL DEFAULT 'active',
    "suspended_at" TIMESTAMP(3),
    "suspended_reason" TEXT,
    "suspended_by_staff_id" TEXT,
    "last_seen_at" TIMESTAMP(3),
    "company_gstin" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default API Key',
    "scopes" TEXT NOT NULL DEFAULT '[]',
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "agent_type" TEXT NOT NULL DEFAULT 'conversational',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "agent_config" TEXT NOT NULL DEFAULT '{}',
    "workspace_id" TEXT,
    "model" TEXT,
    "voice_name" TEXT,
    "system_voice" TEXT NOT NULL DEFAULT 'Puck',
    "language_mode" TEXT NOT NULL DEFAULT 'auto',
    "industry" TEXT DEFAULT 'auto',
    "direction" TEXT DEFAULT 'outbound',
    "temperature" DOUBLE PRECISION DEFAULT 0.7,
    "system_prompt" TEXT,
    "first_message" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "flow_graph" TEXT,
    "is_pii_redaction_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_versions" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "agent_config" TEXT NOT NULL,
    "changelog" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calls" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "batch_id" TEXT,
    "recipient_phone_number" TEXT NOT NULL,
    "from_phone_number" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "call_direction" TEXT NOT NULL DEFAULT 'outbound',
    "start_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),
    "duration_seconds" INTEGER,
    "telemetry_id" TEXT,
    "provider_call_sid" TEXT,
    "user_data" TEXT NOT NULL DEFAULT '{}',
    "webhook_url" TEXT,
    "recording_url" TEXT,
    "sentiment" TEXT,
    "summary" TEXT,
    "recording_enabled" BOOLEAN NOT NULL DEFAULT true,
    "max_duration" INTEGER NOT NULL DEFAULT 1800,
    "end_reason" TEXT,
    "ended_by" TEXT,
    "end_detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "executions" (
    "id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "transcript" TEXT NOT NULL DEFAULT '[]',
    "recording_url" TEXT,
    "sentiment_score" DOUBLE PRECISION,
    "outcome" TEXT,
    "cost_breakdown" TEXT NOT NULL DEFAULT '{}',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_numbers" (
    "id" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "assigned_agent_id" TEXT,
    "country_code" TEXT NOT NULL,
    "region" TEXT,
    "type" TEXT NOT NULL DEFAULT 'local',
    "telephony_provider" TEXT NOT NULL,
    "capabilities" TEXT NOT NULL DEFAULT '["voice"]',
    "status" TEXT NOT NULL DEFAULT 'active',
    "kyc_status" TEXT NOT NULL DEFAULT 'pending',
    "monthly_cost" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "setup_fee" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "aadhaar_required" BOOLEAN NOT NULL DEFAULT false,
    "vobiz_number_id" TEXT,
    "plivo_number_id" TEXT,
    "plivo_sub_auth_id" TEXT,
    "next_billing_date" TIMESTAMP(3),
    "purchased_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_bases" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content_text" TEXT NOT NULL,
    "size_chars" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "progress" INTEGER NOT NULL DEFAULT 100,
    "error_message" TEXT,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_bases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_knowledge_bases" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "kb_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_knowledge_bases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kb_chunks" (
    "id" TEXT NOT NULL,
    "kb_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(3072),
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kb_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "from_phone_number_id" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "status_reason" TEXT,
    "locked_by" TEXT,
    "locked_at" TIMESTAMP(3),
    "idempotency_key" TEXT,
    "consent_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "consent_confirmed_by" TEXT,
    "consent_confirmed_at" TIMESTAMP(3),
    "estimated_minutes" INTEGER,
    "total_recipients" INTEGER NOT NULL DEFAULT 0,
    "completed_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "schedule_config" TEXT NOT NULL DEFAULT '{}',
    "throttle_config" TEXT NOT NULL DEFAULT '{}',
    "retry_config" TEXT NOT NULL DEFAULT '{}',
    "dial_mode" TEXT NOT NULL DEFAULT 'sequential',
    "inter_call_delay_seconds" INTEGER NOT NULL DEFAULT 10,
    "next_dispatch_at" TIMESTAMP(3),
    "consent_list_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_recipients" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "phone_number" TEXT NOT NULL,
    "caller_phone_number" TEXT,
    "user_data" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "call_id" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMP(3),
    "last_error" TEXT,
    "last_error_code" TEXT,

    CONSTRAINT "batch_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sub_accounts" (
    "id" TEXT NOT NULL,
    "parent_user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "api_key_hash" TEXT,
    "quota_limits" TEXT NOT NULL DEFAULT '{}',
    "current_usage" TEXT NOT NULL DEFAULT '{}',
    "billing_mode" TEXT NOT NULL DEFAULT 'parent_pays',
    "webhook_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sub_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vobiz_sub_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "auth_id" TEXT NOT NULL,
    "auth_token" TEXT NOT NULL,
    "kyc_mode" TEXT NOT NULL DEFAULT 'customer_use',
    "kyc_status" TEXT NOT NULL DEFAULT 'pending',
    "business_type" TEXT NOT NULL DEFAULT 'individual',
    "kyc_calls_blocked" BOOLEAN NOT NULL DEFAULT true,
    "kyc_verified_at" TIMESTAMP(3),
    "wallet_funded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vobiz_sub_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plivo_sub_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "auth_id" TEXT NOT NULL,
    "auth_token" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plivo_sub_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_documents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "pan_number" TEXT,
    "pan_type" TEXT DEFAULT 'personal',
    "full_name" TEXT,
    "dob" TEXT,
    "gstin" TEXT,
    "gst_cert_url" TEXT,
    "aadhaar_number" TEXT,
    "aadhaar_doc_url" TEXT,
    "vobiz_reference" TEXT,
    "failure_reason" TEXT,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_consents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "email" TEXT NOT NULL,
    "full_name" TEXT,
    "terms_and_conditions" BOOLEAN NOT NULL DEFAULT true,
    "terms_of_use" BOOLEAN NOT NULL DEFAULT true,
    "privacy_policy" BOOLEAN NOT NULL DEFAULT true,
    "consent_version" TEXT NOT NULL DEFAULT 'v1.0',
    "ip_address" TEXT,
    "user_agent" TEXT,
    "consented_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret_key" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" TEXT NOT NULL,
    "webhook_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "http_status" INTEGER,
    "response_time_ms" INTEGER,
    "error_message" TEXT,
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "delivered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sip_trunks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sip_uri" TEXT NOT NULL,
    "username" TEXT,
    "password" TEXT,
    "outbound_proxy" TEXT,
    "codecs" TEXT NOT NULL DEFAULT '["PCMU","PCMA"]',
    "dtmf_mode" TEXT NOT NULL DEFAULT 'rfc2833',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sip_trunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_configs" (
    "id" TEXT NOT NULL,
    "phone_number_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "business_hours" TEXT NOT NULL DEFAULT '{}',
    "outside_hours_action" TEXT NOT NULL DEFAULT 'voicemail',
    "voicemail_config" TEXT NOT NULL DEFAULT '{}',
    "call_routing" TEXT NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbound_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_sessions" (
    "id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "vobiz_call_uuid" TEXT,
    "openai_session_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'initializing',
    "voice_config" TEXT NOT NULL DEFAULT '{}',
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "latency_avg_ms" DOUBLE PRECISION,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "voice_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcript_segments" (
    "id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "speaker" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "start_time" DOUBLE PRECISION NOT NULL,
    "end_time" DOUBLE PRECISION,
    "sequence_number" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transcript_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_events" (
    "id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_credentials" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider_type" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_tested_at" TIMESTAMP(3),
    "health_status" TEXT NOT NULL DEFAULT 'unknown',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "provider_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runtime_metrics" (
    "id" TEXT NOT NULL,
    "call_id" TEXT,
    "metric_type" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '{}',
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "runtime_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "transcript" TEXT NOT NULL DEFAULT '[]',
    "user_sentiment" TEXT,
    "recording_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_number_orders" (
    "id" TEXT NOT NULL,
    "internal_organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "selected_number" TEXT NOT NULL,
    "vobiz_number_id" TEXT,
    "price_snapshot" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "payment_status" TEXT NOT NULL DEFAULT 'pending',
    "provider_status" TEXT NOT NULL DEFAULT 'pending',
    "order_status" TEXT NOT NULL DEFAULT 'created',
    "idempotency_key" TEXT NOT NULL,
    "provider_request_id" TEXT,
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phone_number_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_audit_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "user_id" TEXT,
    "provider" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "internal_resource_id" TEXT,
    "provider_resource_id" TEXT,
    "request_id" TEXT,
    "status" TEXT NOT NULL,
    "error_code" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgrammaticPage" (
    "id" TEXT NOT NULL,
    "templateType" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "variableData" JSONB NOT NULL,
    "title" TEXT NOT NULL,
    "metaDescription" TEXT NOT NULL,
    "h1" TEXT NOT NULL,
    "bodyContent" TEXT NOT NULL,
    "faqItems" JSONB NOT NULL,
    "schemaMarkup" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notionPageId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "gscImpressions" INTEGER DEFAULT 0,
    "gscClicks" INTEGER DEFAULT 0,
    "gscAvgPosition" DOUBLE PRECISION,
    "gscLastSynced" TIMESTAMP(3),

    CONSTRAINT "ProgrammaticPage_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "calendar_connections" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google',
    "google_email" TEXT NOT NULL,
    "encrypted_tokens" TEXT NOT NULL,
    "scopes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'healthy',
    "last_checked_at" TIMESTAMP(3),
    "last_error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_scheduling_rules" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "calendar_connection_id" TEXT,
    "time_zone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "working_days" TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
    "working_hours" TEXT NOT NULL DEFAULT '{"start":"09:00","end":"17:00"}',
    "appointment_minutes" INTEGER NOT NULL DEFAULT 30,
    "buffer_before_after_minutes" INTEGER NOT NULL DEFAULT 10,
    "min_notice_minutes" INTEGER NOT NULL DEFAULT 120,
    "max_days_ahead" INTEGER NOT NULL DEFAULT 30,
    "max_bookings_per_day" INTEGER NOT NULL DEFAULT 8,
    "blackout_dates" TEXT NOT NULL DEFAULT '[]',
    "treat_all_day_events_as_busy" BOOLEAN NOT NULL DEFAULT true,
    "allowed_calendars" TEXT NOT NULL DEFAULT '["primary"]',
    "attendee_mode" TEXT NOT NULL DEFAULT 'invite_caller',
    "add_meet_link" BOOLEAN NOT NULL DEFAULT false,
    "instructions" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_scheduling_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_bookings" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "call_id" TEXT,
    "calendar_connection_id" TEXT,
    "google_event_id" TEXT,
    "calendar_id" TEXT NOT NULL DEFAULT 'primary',
    "start_utc" TIMESTAMP(3) NOT NULL,
    "end_utc" TIMESTAMP(3) NOT NULL,
    "time_zone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "caller_name" TEXT,
    "caller_phone" TEXT,
    "caller_email" TEXT,
    "notes" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_bookings_pkey" PRIMARY KEY ("id")
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
    "opted_out_at" TIMESTAMP(3),
    "opt_out_reason" TEXT,
    "consent_date" TIMESTAMP(3),
    "consent_channel" TEXT,
    "consent_wording" TEXT,
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

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "plan_name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'completed',
    "source" TEXT NOT NULL DEFAULT 'self_serve',
    "refunded_amount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "invoice_no" TEXT,
    "created_by_staff_id" TEXT,
    "razorpay_link_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "workspace_owner_id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'invited',
    "last_login_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "staff_email" TEXT NOT NULL,
    "staff_role" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "reason" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "request_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "minutes_ledger" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "delta_seconds" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "ref_type" TEXT,
    "ref_id" TEXT,
    "note" TEXT,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "balance_after_seconds" DOUBLE PRECISION NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "minutes_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_catalog" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_inr" DOUBLE PRECISION NOT NULL,
    "minutes" DOUBLE PRECISION NOT NULL,
    "account_type" TEXT NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "customer_user_id" TEXT,
    "validity_days" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_admin_profiles" (
    "user_id" TEXT NOT NULL,
    "assigned_staff_id" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "risk_level" TEXT NOT NULL DEFAULT 'none',
    "risk_note" TEXT,
    "lifecycle_override" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_admin_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "customer_notes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "staff_email" TEXT,
    "body" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_ups" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "note" TEXT NOT NULL,
    "done_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "payment_transaction_id" TEXT,
    "amount_inr" DOUBLE PRECISION NOT NULL,
    "gst_rate" DOUBLE PRECISION NOT NULL DEFAULT 18.0,
    "gst_amount_inr" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "subtotal_inr" DOUBLE PRECISION NOT NULL,
    "buyer_gstin" TEXT,
    "buyer_name" TEXT NOT NULL,
    "buyer_email" TEXT NOT NULL,
    "seller_gstin" TEXT,
    "plan_key" TEXT NOT NULL,
    "plan_name" TEXT NOT NULL,
    "minutes_credited" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'paid',
    "pdf_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_links" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan_key" TEXT,
    "custom_plan_id" TEXT,
    "amount_inr" DOUBLE PRECISION NOT NULL,
    "minutes" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'created',
    "razorpay_link_id" TEXT NOT NULL,
    "short_url" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_by_staff_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_metrics" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "new_signups_count" INTEGER NOT NULL DEFAULT 0,
    "active_customers_7d" INTEGER NOT NULL DEFAULT 0,
    "calls_dialed_count" INTEGER NOT NULL DEFAULT 0,
    "calls_connected_count" INTEGER NOT NULL DEFAULT 0,
    "billed_minutes_total" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "revenue_inr_total" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_alerts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "type" TEXT NOT NULL DEFAULT 'FAILED_PROVISIONING',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "metadata" TEXT DEFAULT '{}',
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_alerts_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "analysis_jobs" (
    "id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "agent_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "locked_at" TIMESTAMP(3),
    "locked_by" TEXT,
    "next_run_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT,
    "last_error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_email_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "documentId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resendId" TEXT,

    CONSTRAINT "kyc_email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_results" (
    "id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "agent_id" TEXT,
    "batch_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "result_label" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION NOT NULL,
    "summary" TEXT,
    "sentiment" TEXT,
    "fields" JSONB NOT NULL DEFAULT '{}',
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "blueprint_version" TEXT,
    "prompt_version" TEXT,
    "model" TEXT,
    "review_status" TEXT NOT NULL DEFAULT 'unreviewed',
    "corrected_by" TEXT,
    "corrected_at" TIMESTAMP(3),
    "correction_notes" TEXT,
    "input_hash" TEXT,
    "language" TEXT,
    "transcript_quality" TEXT,
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "total_tokens" INTEGER,
    "latency_ms" INTEGER,
    "error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_lab_runs" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "average_score" INTEGER NOT NULL,
    "persona_count" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "results" TEXT NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_lab_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE INDEX "users_account_status_idx" ON "users"("account_status");

-- CreateIndex
CREATE INDEX "users_last_seen_at_idx" ON "users"("last_seen_at");

-- CreateIndex
CREATE INDEX "team_members_owner_id_idx" ON "team_members"("owner_id");

-- CreateIndex
CREATE INDEX "team_members_member_id_idx" ON "team_members"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_owner_id_member_id_key" ON "team_members"("owner_id", "member_id");

-- CreateIndex
CREATE INDEX "api_keys_key_hash_idx" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_user_id_idx" ON "api_keys"("user_id");

-- CreateIndex
CREATE INDEX "agents_user_id_idx" ON "agents"("user_id");

-- CreateIndex
CREATE INDEX "agents_status_idx" ON "agents"("status");

-- CreateIndex
CREATE INDEX "agents_created_at_idx" ON "agents"("created_at");

-- CreateIndex
CREATE INDEX "agent_versions_agent_id_idx" ON "agent_versions"("agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_versions_agent_id_version_key" ON "agent_versions"("agent_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "calls_provider_call_sid_key" ON "calls"("provider_call_sid");

-- CreateIndex
CREATE INDEX "calls_agent_id_idx" ON "calls"("agent_id");

-- CreateIndex
CREATE INDEX "calls_user_id_idx" ON "calls"("user_id");

-- CreateIndex
CREATE INDEX "calls_status_idx" ON "calls"("status");

-- CreateIndex
CREATE INDEX "calls_batch_id_idx" ON "calls"("batch_id");

-- CreateIndex
CREATE INDEX "calls_created_at_idx" ON "calls"("created_at");

-- CreateIndex
CREATE INDEX "calls_user_id_created_at_idx" ON "calls"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "calls_status_created_at_idx" ON "calls"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "executions_call_id_key" ON "executions"("call_id");

-- CreateIndex
CREATE INDEX "executions_call_id_idx" ON "executions"("call_id");

-- CreateIndex
CREATE UNIQUE INDEX "phone_numbers_phone_number_key" ON "phone_numbers"("phone_number");

-- CreateIndex
CREATE INDEX "phone_numbers_user_id_idx" ON "phone_numbers"("user_id");

-- CreateIndex
CREATE INDEX "phone_numbers_assigned_agent_id_idx" ON "phone_numbers"("assigned_agent_id");

-- CreateIndex
CREATE INDEX "knowledge_bases_user_id_idx" ON "knowledge_bases"("user_id");

-- CreateIndex
CREATE INDEX "agent_knowledge_bases_agent_id_idx" ON "agent_knowledge_bases"("agent_id");

-- CreateIndex
CREATE INDEX "agent_knowledge_bases_kb_id_idx" ON "agent_knowledge_bases"("kb_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_knowledge_bases_agent_id_kb_id_key" ON "agent_knowledge_bases"("agent_id", "kb_id");

-- CreateIndex
CREATE INDEX "kb_chunks_kb_id_idx" ON "kb_chunks"("kb_id");

-- CreateIndex
CREATE INDEX "batches_user_id_idx" ON "batches"("user_id");

-- CreateIndex
CREATE INDEX "batches_agent_id_idx" ON "batches"("agent_id");

-- CreateIndex
CREATE INDEX "batches_from_phone_number_id_idx" ON "batches"("from_phone_number_id");

-- CreateIndex
CREATE INDEX "batches_status_idx" ON "batches"("status");

-- CreateIndex
CREATE INDEX "batches_idempotency_key_idx" ON "batches"("idempotency_key");

-- CreateIndex
CREATE INDEX "batch_recipients_batch_id_idx" ON "batch_recipients"("batch_id");

-- CreateIndex
CREATE INDEX "batch_recipients_batch_id_position_idx" ON "batch_recipients"("batch_id", "position");

-- CreateIndex
CREATE INDEX "batch_recipients_status_idx" ON "batch_recipients"("status");

-- CreateIndex
CREATE INDEX "batch_recipients_call_id_idx" ON "batch_recipients"("call_id");

-- CreateIndex
CREATE INDEX "sub_accounts_parent_user_id_idx" ON "sub_accounts"("parent_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "vobiz_sub_accounts_user_id_key" ON "vobiz_sub_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "plivo_sub_accounts_user_id_key" ON "plivo_sub_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "plivo_sub_accounts_auth_id_key" ON "plivo_sub_accounts"("auth_id");

-- CreateIndex
CREATE INDEX "plivo_sub_accounts_auth_id_idx" ON "plivo_sub_accounts"("auth_id");

-- CreateIndex
CREATE INDEX "kyc_documents_user_id_idx" ON "kyc_documents"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_documents_user_id_document_type_key" ON "kyc_documents"("user_id", "document_type");

-- CreateIndex
CREATE INDEX "user_consents_user_id_idx" ON "user_consents"("user_id");

-- CreateIndex
CREATE INDEX "user_consents_email_idx" ON "user_consents"("email");

-- CreateIndex
CREATE INDEX "webhooks_user_id_idx" ON "webhooks"("user_id");

-- CreateIndex
CREATE INDEX "webhooks_event_type_idx" ON "webhooks"("event_type");

-- CreateIndex
CREATE INDEX "webhook_logs_webhook_id_idx" ON "webhook_logs"("webhook_id");

-- CreateIndex
CREATE INDEX "webhook_logs_delivered_at_idx" ON "webhook_logs"("delivered_at");

-- CreateIndex
CREATE INDEX "sip_trunks_user_id_idx" ON "sip_trunks"("user_id");

-- CreateIndex
CREATE INDEX "inbound_configs_phone_number_id_idx" ON "inbound_configs"("phone_number_id");

-- CreateIndex
CREATE INDEX "inbound_configs_agent_id_idx" ON "inbound_configs"("agent_id");

-- CreateIndex
CREATE INDEX "voice_sessions_call_id_idx" ON "voice_sessions"("call_id");

-- CreateIndex
CREATE INDEX "voice_sessions_agent_id_idx" ON "voice_sessions"("agent_id");

-- CreateIndex
CREATE INDEX "voice_sessions_status_idx" ON "voice_sessions"("status");

-- CreateIndex
CREATE INDEX "transcript_segments_call_id_idx" ON "transcript_segments"("call_id");

-- CreateIndex
CREATE INDEX "transcript_segments_call_id_sequence_number_idx" ON "transcript_segments"("call_id", "sequence_number");

-- CreateIndex
CREATE INDEX "call_events_call_id_idx" ON "call_events"("call_id");

-- CreateIndex
CREATE INDEX "call_events_call_id_event_type_idx" ON "call_events"("call_id", "event_type");

-- CreateIndex
CREATE INDEX "provider_credentials_user_id_idx" ON "provider_credentials"("user_id");

-- CreateIndex
CREATE INDEX "provider_credentials_provider_type_idx" ON "provider_credentials"("provider_type");

-- CreateIndex
CREATE INDEX "runtime_metrics_metric_type_idx" ON "runtime_metrics"("metric_type");

-- CreateIndex
CREATE INDEX "runtime_metrics_call_id_idx" ON "runtime_metrics"("call_id");

-- CreateIndex
CREATE INDEX "runtime_metrics_recorded_at_idx" ON "runtime_metrics"("recorded_at");

-- CreateIndex
CREATE UNIQUE INDEX "call_sessions_call_id_key" ON "call_sessions"("call_id");

-- CreateIndex
CREATE INDEX "call_sessions_user_id_idx" ON "call_sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "phone_number_orders_idempotency_key_key" ON "phone_number_orders"("idempotency_key");

-- CreateIndex
CREATE INDEX "phone_number_orders_user_id_idx" ON "phone_number_orders"("user_id");

-- CreateIndex
CREATE INDEX "phone_number_orders_idempotency_key_idx" ON "phone_number_orders"("idempotency_key");

-- CreateIndex
CREATE INDEX "integration_audit_logs_user_id_idx" ON "integration_audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "integration_audit_logs_provider_operation_idx" ON "integration_audit_logs"("provider", "operation");

-- CreateIndex
CREATE UNIQUE INDEX "ProgrammaticPage_slug_key" ON "ProgrammaticPage"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProgrammaticPage_notionPageId_key" ON "ProgrammaticPage"("notionPageId");

-- CreateIndex
CREATE INDEX "ProgrammaticPage_status_idx" ON "ProgrammaticPage"("status");

-- CreateIndex
CREATE INDEX "ProgrammaticPage_category_idx" ON "ProgrammaticPage"("category");

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
CREATE UNIQUE INDEX "calendar_connections_workspace_id_key" ON "calendar_connections"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_scheduling_rules_agent_id_key" ON "agent_scheduling_rules"("agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_bookings_idempotency_key_key" ON "calendar_bookings"("idempotency_key");

-- CreateIndex
CREATE INDEX "calendar_bookings_workspace_id_idx" ON "calendar_bookings"("workspace_id");

-- CreateIndex
CREATE INDEX "calendar_bookings_agent_id_idx" ON "calendar_bookings"("agent_id");

-- CreateIndex
CREATE INDEX "calendar_bookings_start_utc_idx" ON "calendar_bookings"("start_utc");

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
CREATE INDEX "contacts_opted_out_at_idx" ON "contacts"("opted_out_at");

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

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_order_id_key" ON "payment_transactions"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_payment_id_key" ON "payment_transactions"("payment_id");

-- CreateIndex
CREATE INDEX "payment_transactions_user_id_idx" ON "payment_transactions"("user_id");

-- CreateIndex
CREATE INDEX "payment_transactions_status_idx" ON "payment_transactions"("status");

-- CreateIndex
CREATE INDEX "audit_logs_workspace_owner_id_idx" ON "audit_logs"("workspace_owner_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs"("actor_user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "staff_users_email_key" ON "staff_users"("email");

-- CreateIndex
CREATE INDEX "staff_users_role_idx" ON "staff_users"("role");

-- CreateIndex
CREATE INDEX "staff_users_status_idx" ON "staff_users"("status");

-- CreateIndex
CREATE INDEX "admin_audit_logs_customer_id_idx" ON "admin_audit_logs"("customer_id");

-- CreateIndex
CREATE INDEX "admin_audit_logs_staff_id_idx" ON "admin_audit_logs"("staff_id");

-- CreateIndex
CREATE INDEX "admin_audit_logs_action_idx" ON "admin_audit_logs"("action");

-- CreateIndex
CREATE INDEX "admin_audit_logs_created_at_idx" ON "admin_audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "minutes_ledger_idempotency_key_key" ON "minutes_ledger"("idempotency_key");

-- CreateIndex
CREATE INDEX "minutes_ledger_user_id_idx" ON "minutes_ledger"("user_id");

-- CreateIndex
CREATE INDEX "minutes_ledger_reason_idx" ON "minutes_ledger"("reason");

-- CreateIndex
CREATE INDEX "minutes_ledger_created_at_idx" ON "minutes_ledger"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "plan_catalog_key_key" ON "plan_catalog"("key");

-- CreateIndex
CREATE INDEX "plan_catalog_active_idx" ON "plan_catalog"("active");

-- CreateIndex
CREATE INDEX "plan_catalog_customer_user_id_idx" ON "plan_catalog"("customer_user_id");

-- CreateIndex
CREATE INDEX "customer_admin_profiles_assigned_staff_id_idx" ON "customer_admin_profiles"("assigned_staff_id");

-- CreateIndex
CREATE INDEX "customer_admin_profiles_risk_level_idx" ON "customer_admin_profiles"("risk_level");

-- CreateIndex
CREATE INDEX "customer_notes_user_id_idx" ON "customer_notes"("user_id");

-- CreateIndex
CREATE INDEX "customer_notes_created_at_idx" ON "customer_notes"("created_at");

-- CreateIndex
CREATE INDEX "follow_ups_user_id_idx" ON "follow_ups"("user_id");

-- CreateIndex
CREATE INDEX "follow_ups_staff_id_idx" ON "follow_ups"("staff_id");

-- CreateIndex
CREATE INDEX "follow_ups_due_at_idx" ON "follow_ups"("due_at");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_payment_transaction_id_key" ON "invoices"("payment_transaction_id");

-- CreateIndex
CREATE INDEX "invoices_user_id_idx" ON "invoices"("user_id");

-- CreateIndex
CREATE INDEX "invoices_created_at_idx" ON "invoices"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_links_razorpay_link_id_key" ON "payment_links"("razorpay_link_id");

-- CreateIndex
CREATE INDEX "payment_links_user_id_idx" ON "payment_links"("user_id");

-- CreateIndex
CREATE INDEX "payment_links_status_idx" ON "payment_links"("status");

-- CreateIndex
CREATE UNIQUE INDEX "daily_metrics_date_key" ON "daily_metrics"("date");

-- CreateIndex
CREATE INDEX "system_alerts_user_id_idx" ON "system_alerts"("user_id");

-- CreateIndex
CREATE INDEX "system_alerts_type_is_resolved_idx" ON "system_alerts"("type", "is_resolved");

-- CreateIndex
CREATE INDEX "notification_receipts_user_id_idx" ON "notification_receipts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_receipts_alert_id_user_id_key" ON "notification_receipts"("alert_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "analysis_jobs_call_id_key" ON "analysis_jobs"("call_id");

-- CreateIndex
CREATE INDEX "analysis_jobs_status_next_run_at_idx" ON "analysis_jobs"("status", "next_run_at");

-- CreateIndex
CREATE INDEX "analysis_jobs_workspace_id_status_idx" ON "analysis_jobs"("workspace_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_email_logs_userId_eventType_documentId_key" ON "kyc_email_logs"("userId", "eventType", "documentId");

-- CreateIndex
CREATE UNIQUE INDEX "call_results_call_id_key" ON "call_results"("call_id");

-- CreateIndex
CREATE INDEX "call_results_workspace_id_idx" ON "call_results"("workspace_id");

-- CreateIndex
CREATE INDEX "call_results_workspace_id_agent_id_idx" ON "call_results"("workspace_id", "agent_id");

-- CreateIndex
CREATE INDEX "call_results_workspace_id_batch_id_idx" ON "call_results"("workspace_id", "batch_id");

-- CreateIndex
CREATE INDEX "call_results_workspace_id_result_label_idx" ON "call_results"("workspace_id", "result_label");

-- CreateIndex
CREATE INDEX "call_results_workspace_id_status_idx" ON "call_results"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "call_results_fields_gin_idx" ON "call_results" USING GIN ("fields");

-- CreateIndex
CREATE INDEX "test_lab_runs_agent_id_user_id_created_at_idx" ON "test_lab_runs"("agent_id", "user_id", "created_at");

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_versions" ADD CONSTRAINT "agent_versions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executions" ADD CONSTRAINT "executions_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_assigned_agent_id_fkey" FOREIGN KEY ("assigned_agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_bases" ADD CONSTRAINT "knowledge_bases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_knowledge_bases" ADD CONSTRAINT "agent_knowledge_bases_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_knowledge_bases" ADD CONSTRAINT "agent_knowledge_bases_kb_id_fkey" FOREIGN KEY ("kb_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_chunks" ADD CONSTRAINT "kb_chunks_kb_id_fkey" FOREIGN KEY ("kb_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_from_phone_number_id_fkey" FOREIGN KEY ("from_phone_number_id") REFERENCES "phone_numbers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_recipients" ADD CONSTRAINT "batch_recipients_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_recipients" ADD CONSTRAINT "batch_recipients_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_accounts" ADD CONSTRAINT "sub_accounts_parent_user_id_fkey" FOREIGN KEY ("parent_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vobiz_sub_accounts" ADD CONSTRAINT "vobiz_sub_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plivo_sub_accounts" ADD CONSTRAINT "plivo_sub_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_configs" ADD CONSTRAINT "inbound_configs_phone_number_id_fkey" FOREIGN KEY ("phone_number_id") REFERENCES "phone_numbers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_configs" ADD CONSTRAINT "inbound_configs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_sessions" ADD CONSTRAINT "voice_sessions_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_sessions" ADD CONSTRAINT "voice_sessions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcript_segments" ADD CONSTRAINT "transcript_segments_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_events" ADD CONSTRAINT "call_events_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_credentials" ADD CONSTRAINT "provider_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_scheduling_rules" ADD CONSTRAINT "agent_scheduling_rules_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_scheduling_rules" ADD CONSTRAINT "agent_scheduling_rules_calendar_connection_id_fkey" FOREIGN KEY ("calendar_connection_id") REFERENCES "calendar_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_bookings" ADD CONSTRAINT "calendar_bookings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_bookings" ADD CONSTRAINT "calendar_bookings_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_bookings" ADD CONSTRAINT "calendar_bookings_calendar_connection_id_fkey" FOREIGN KEY ("calendar_connection_id") REFERENCES "calendar_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "minutes_ledger" ADD CONSTRAINT "minutes_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_transaction_id_fkey" FOREIGN KEY ("payment_transaction_id") REFERENCES "payment_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_receipts" ADD CONSTRAINT "notification_receipts_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "system_alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_jobs" ADD CONSTRAINT "analysis_jobs_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_results" ADD CONSTRAINT "call_results_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Expression index schema.prisma cannot describe (from 20261117140000) ───
CREATE INDEX IF NOT EXISTS "kb_chunks_content_fts_idx" ON "kb_chunks" USING gin (to_tsvector('english', "content"));

-- ─── Row Level Security (from 20260803000001_enable_rls; policies use Supabase auth.uid()) ───
-- Enable RLS on team_members
ALTER TABLE "team_members" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can access their teams" ON "team_members";
CREATE POLICY "Users can access their teams" ON "team_members"
FOR ALL
USING (auth.uid()::text = owner_id OR auth.uid()::text = member_id)
WITH CHECK (auth.uid()::text = owner_id OR auth.uid()::text = member_id);

-- Re-apply existing RLS to ensure they are tracked by this new baseline
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only access their own data" ON "users";
CREATE POLICY "Users can only access their own data" ON "users"
FOR ALL
USING (auth.uid()::text = id)
WITH CHECK (auth.uid()::text = id);

ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only access their own data" ON "api_keys";
CREATE POLICY "Users can only access their own data" ON "api_keys"
FOR ALL
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

ALTER TABLE "agents" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only access their own data" ON "agents";
CREATE POLICY "Users can only access their own data" ON "agents"
FOR ALL
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

ALTER TABLE "calls" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only access their own data" ON "calls";
CREATE POLICY "Users can only access their own data" ON "calls"
FOR ALL
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

ALTER TABLE "phone_numbers" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only access their own data" ON "phone_numbers";
CREATE POLICY "Users can only access their own data" ON "phone_numbers"
FOR ALL
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

ALTER TABLE "knowledge_bases" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only access their own data" ON "knowledge_bases";
CREATE POLICY "Users can only access their own data" ON "knowledge_bases"
FOR ALL
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

ALTER TABLE "batches" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only access their own data" ON "batches";
CREATE POLICY "Users can only access their own data" ON "batches"
FOR ALL
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

ALTER TABLE "webhooks" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only access their own data" ON "webhooks";
CREATE POLICY "Users can only access their own data" ON "webhooks"
FOR ALL
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

ALTER TABLE "sip_trunks" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only access their own data" ON "sip_trunks";
CREATE POLICY "Users can only access their own data" ON "sip_trunks"
FOR ALL
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

ALTER TABLE "provider_credentials" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only access their own data" ON "provider_credentials";
CREATE POLICY "Users can only access their own data" ON "provider_credentials"
FOR ALL
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

ALTER TABLE "call_sessions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only access their own data" ON "call_sessions";
CREATE POLICY "Users can only access their own data" ON "call_sessions"
FOR ALL
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

ALTER TABLE "sub_accounts" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only access their own data" ON "sub_accounts";
CREATE POLICY "Users can only access their own data" ON "sub_accounts"
FOR ALL
USING (auth.uid()::text = parent_user_id)
WITH CHECK (auth.uid()::text = parent_user_id);
