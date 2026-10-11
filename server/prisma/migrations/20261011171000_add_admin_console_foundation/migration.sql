-- Additive columns to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "account_status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "suspended_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "suspended_reason" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "suspended_by_staff_id" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_seen_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "company_gstin" TEXT;

CREATE INDEX IF NOT EXISTS "users_created_at_idx" ON "users"("created_at");
CREATE INDEX IF NOT EXISTS "users_account_status_idx" ON "users"("account_status");
CREATE INDEX IF NOT EXISTS "users_last_seen_at_idx" ON "users"("last_seen_at");

-- Performance indexes on calls
CREATE INDEX IF NOT EXISTS "calls_user_id_created_at_idx" ON "calls"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "calls_status_created_at_idx" ON "calls"("status", "created_at");

-- Additive columns to payment_transactions
ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'self_serve';
ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "refunded_amount" DOUBLE PRECISION NOT NULL DEFAULT 0.0;
ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "invoice_no" TEXT;
ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "created_by_staff_id" TEXT;
ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "razorpay_link_id" TEXT;

CREATE INDEX IF NOT EXISTS "payment_transactions_status_idx" ON "payment_transactions"("status");

-- CreateTable: staff_users
CREATE TABLE IF NOT EXISTS "staff_users" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "staff_users_email_key" ON "staff_users"("email");
CREATE INDEX IF NOT EXISTS "staff_users_role_idx" ON "staff_users"("role");
CREATE INDEX IF NOT EXISTS "staff_users_status_idx" ON "staff_users"("status");

-- CreateTable: admin_settings
CREATE TABLE IF NOT EXISTS "admin_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable: admin_audit_logs
CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
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

CREATE INDEX IF NOT EXISTS "admin_audit_logs_customer_id_idx" ON "admin_audit_logs"("customer_id");
CREATE INDEX IF NOT EXISTS "admin_audit_logs_staff_id_idx" ON "admin_audit_logs"("staff_id");
CREATE INDEX IF NOT EXISTS "admin_audit_logs_action_idx" ON "admin_audit_logs"("action");
CREATE INDEX IF NOT EXISTS "admin_audit_logs_created_at_idx" ON "admin_audit_logs"("created_at");

-- CreateTable: minutes_ledger
CREATE TABLE IF NOT EXISTS "minutes_ledger" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "minutes_ledger_idempotency_key_key" ON "minutes_ledger"("idempotency_key");
CREATE INDEX IF NOT EXISTS "minutes_ledger_user_id_idx" ON "minutes_ledger"("user_id");
CREATE INDEX IF NOT EXISTS "minutes_ledger_reason_idx" ON "minutes_ledger"("reason");
CREATE INDEX IF NOT EXISTS "minutes_ledger_created_at_idx" ON "minutes_ledger"("created_at");

ALTER TABLE "minutes_ledger" ADD CONSTRAINT "minutes_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: plan_catalog
CREATE TABLE IF NOT EXISTS "plan_catalog" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "plan_catalog_key_key" ON "plan_catalog"("key");
CREATE INDEX IF NOT EXISTS "plan_catalog_active_idx" ON "plan_catalog"("active");
CREATE INDEX IF NOT EXISTS "plan_catalog_customer_user_id_idx" ON "plan_catalog"("customer_user_id");

-- CreateTable: customer_admin_profiles
CREATE TABLE IF NOT EXISTS "customer_admin_profiles" (
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

CREATE INDEX IF NOT EXISTS "customer_admin_profiles_assigned_staff_id_idx" ON "customer_admin_profiles"("assigned_staff_id");
CREATE INDEX IF NOT EXISTS "customer_admin_profiles_risk_level_idx" ON "customer_admin_profiles"("risk_level");

-- CreateTable: customer_notes
CREATE TABLE IF NOT EXISTS "customer_notes" (
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

CREATE INDEX IF NOT EXISTS "customer_notes_user_id_idx" ON "customer_notes"("user_id");
CREATE INDEX IF NOT EXISTS "customer_notes_created_at_idx" ON "customer_notes"("created_at");

-- CreateTable: follow_ups
CREATE TABLE IF NOT EXISTS "follow_ups" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "note" TEXT NOT NULL,
    "done_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "follow_ups_user_id_idx" ON "follow_ups"("user_id");
CREATE INDEX IF NOT EXISTS "follow_ups_staff_id_idx" ON "follow_ups"("staff_id");
CREATE INDEX IF NOT EXISTS "follow_ups_due_at_idx" ON "follow_ups"("due_at");

-- CreateTable: invoices
CREATE TABLE IF NOT EXISTS "invoices" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "invoices_invoice_number_key" ON "invoices"("invoice_number");
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_payment_transaction_id_key" ON "invoices"("payment_transaction_id");
CREATE INDEX IF NOT EXISTS "invoices_user_id_idx" ON "invoices"("user_id");
CREATE INDEX IF NOT EXISTS "invoices_created_at_idx" ON "invoices"("created_at");

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_transaction_id_fkey" FOREIGN KEY ("payment_transaction_id") REFERENCES "payment_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: payment_links
CREATE TABLE IF NOT EXISTS "payment_links" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "payment_links_razorpay_link_id_key" ON "payment_links"("razorpay_link_id");
CREATE INDEX IF NOT EXISTS "payment_links_user_id_idx" ON "payment_links"("user_id");
CREATE INDEX IF NOT EXISTS "payment_links_status_idx" ON "payment_links"("status");

-- CreateTable: daily_metrics
CREATE TABLE IF NOT EXISTS "daily_metrics" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "daily_metrics_date_key" ON "daily_metrics"("date");
