-- CreateTable
CREATE TABLE IF NOT EXISTS "agent_knowledge_bases" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "kb_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_knowledge_bases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "agent_knowledge_bases_agent_id_kb_id_key" ON "agent_knowledge_bases"("agent_id", "kb_id");
CREATE INDEX IF NOT EXISTS "agent_knowledge_bases_agent_id_idx" ON "agent_knowledge_bases"("agent_id");
CREATE INDEX IF NOT EXISTS "agent_knowledge_bases_kb_id_idx" ON "agent_knowledge_bases"("kb_id");

-- AddForeignKey
ALTER TABLE "agent_knowledge_bases" ADD CONSTRAINT "agent_knowledge_bases_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_knowledge_bases" ADD CONSTRAINT "agent_knowledge_bases_kb_id_fkey" FOREIGN KEY ("kb_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data migration: populate agent_knowledge_bases with existing knowledge_bases relations
INSERT INTO "agent_knowledge_bases" ("id", "agent_id", "kb_id", "created_at")
SELECT 
  md5("id" || "agent_id"), "agent_id", "id", NOW()
FROM "knowledge_bases"
WHERE "agent_id" IS NOT NULL
ON CONFLICT DO NOTHING;

-- DropForeignKey
ALTER TABLE "knowledge_bases" DROP CONSTRAINT IF EXISTS "knowledge_bases_agent_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "knowledge_bases_agent_id_idx";

-- AlterTable
ALTER TABLE "knowledge_bases" DROP COLUMN "agent_id";
