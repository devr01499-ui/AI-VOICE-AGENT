-- Phase 5 (B8): full-text index for knowledge-base search.
-- Every Retrieval Inspector question and every knowledge-base lookup on a live call runs
-- to_tsvector('english', content) @@ websearch_to_tsquery(...) over the agent's chunks; without
-- this index Postgres recomputes the text vector of every chunk on every question.
-- Additive and safe to re-run. Rollback: DROP INDEX IF EXISTS "kb_chunks_content_fts_idx";
-- Note: Prisma cannot describe expression indexes in schema.prisma, so `prisma db push` neither
-- creates nor needs this index; it is created by `prisma migrate deploy` (see PRELAUNCH_NOTES P1).
CREATE INDEX IF NOT EXISTS "kb_chunks_content_fts_idx" ON "kb_chunks" USING gin (to_tsvector('english', "content"));
