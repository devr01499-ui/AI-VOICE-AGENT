-- Migration: add_agent_direction
-- Adds direction column to agents table (inbound | outbound | both).

ALTER TABLE "agents"
  ADD COLUMN IF NOT EXISTS "direction" TEXT DEFAULT 'outbound';
