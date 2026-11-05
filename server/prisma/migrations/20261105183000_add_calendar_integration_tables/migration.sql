-- CreateTable: calendar_connections
CREATE TABLE IF NOT EXISTS "calendar_connections" (
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
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "calendar_connections_workspace_id_key" ON "calendar_connections"("workspace_id");

-- CreateTable: agent_scheduling_rules
CREATE TABLE IF NOT EXISTS "agent_scheduling_rules" (
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
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_scheduling_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "agent_scheduling_rules_agent_id_key" ON "agent_scheduling_rules"("agent_id");

-- CreateTable: calendar_bookings
CREATE TABLE IF NOT EXISTS "calendar_bookings" (
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
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "calendar_bookings_idempotency_key_key" ON "calendar_bookings"("idempotency_key");
CREATE INDEX IF NOT EXISTS "calendar_bookings_workspace_id_idx" ON "calendar_bookings"("workspace_id");
CREATE INDEX IF NOT EXISTS "calendar_bookings_agent_id_idx" ON "calendar_bookings"("agent_id");
CREATE INDEX IF NOT EXISTS "calendar_bookings_start_utc_idx" ON "calendar_bookings"("start_utc");
