-- Migration: add_phone_number_vobiz_fields
-- Adds Vobiz-specific fields to the phone_numbers table additively.
-- All new columns are nullable or have defaults — zero risk to existing rows.

ALTER TABLE "phone_numbers"
  ADD COLUMN IF NOT EXISTS "region"              TEXT,
  ADD COLUMN IF NOT EXISTS "setup_fee"           DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS "currency"            TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS "aadhaar_required"    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "vobiz_number_id"     TEXT,
  ADD COLUMN IF NOT EXISTS "next_billing_date"   TIMESTAMP(3);
