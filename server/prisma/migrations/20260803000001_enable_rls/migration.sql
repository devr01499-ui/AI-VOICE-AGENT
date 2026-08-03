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
