-- CreateTable: analysis_jobs
CREATE TABLE IF NOT EXISTS "analysis_jobs" (
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

-- CreateTable: call_results
CREATE TABLE IF NOT EXISTS "call_results" (
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
    "fields" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "evidence" JSONB NOT NULL DEFAULT '{}'::jsonb,
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

-- Unique & Relational Constraints
CREATE UNIQUE INDEX IF NOT EXISTS "analysis_jobs_call_id_key" ON "analysis_jobs"("call_id");
CREATE UNIQUE INDEX IF NOT EXISTS "call_results_call_id_key" ON "call_results"("call_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'analysis_jobs_call_id_fkey'
  ) THEN
    ALTER TABLE "analysis_jobs" ADD CONSTRAINT "analysis_jobs_call_id_fkey" 
      FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'call_results_call_id_fkey'
  ) THEN
    ALTER TABLE "call_results" ADD CONSTRAINT "call_results_call_id_fkey" 
      FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Indexes for Queue Polling & Filtering
CREATE INDEX IF NOT EXISTS "analysis_jobs_queue_idx" ON "analysis_jobs"("status", "next_run_at");
CREATE INDEX IF NOT EXISTS "analysis_jobs_workspace_status_idx" ON "analysis_jobs"("workspace_id", "status");

CREATE INDEX IF NOT EXISTS "call_results_workspace_id_idx" ON "call_results"("workspace_id");
CREATE INDEX IF NOT EXISTS "call_results_workspace_agent_idx" ON "call_results"("workspace_id", "agent_id");
CREATE INDEX IF NOT EXISTS "call_results_workspace_batch_idx" ON "call_results"("workspace_id", "batch_id");
CREATE INDEX IF NOT EXISTS "call_results_workspace_label_idx" ON "call_results"("workspace_id", "result_label");
CREATE INDEX IF NOT EXISTS "call_results_workspace_status_idx" ON "call_results"("workspace_id", "status");
CREATE INDEX IF NOT EXISTS "call_results_fields_gin_idx" ON "call_results" USING gin ("fields");
