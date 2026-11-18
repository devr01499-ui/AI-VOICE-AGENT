-- Additive, backward compatible: creates one new table; touches no existing table or row.
-- Rollback: DROP TABLE "test_lab_runs";  (only loses saved Test Lab history)

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
CREATE INDEX "test_lab_runs_agent_id_user_id_created_at_idx" ON "test_lab_runs"("agent_id", "user_id", "created_at");

