-- Enable RLS on users table
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only access their own data" ON "users";
CREATE POLICY "Users can only access their own data" ON "users"
FOR ALL
USING (auth.uid()::text = id)
WITH CHECK (auth.uid()::text = id);

-- Enable RLS on api_keys table
ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only access their own data" ON "api_keys";
CREATE POLICY "Users can only access their own data" ON "api_keys"
FOR ALL
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

-- Enable RLS on agents table
ALTER TABLE "agents" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only access their own data" ON "agents";
CREATE POLICY "Users can only access their own data" ON "agents"
FOR ALL
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

-- Enable RLS on calls table
ALTER TABLE "calls" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only access their own data" ON "calls";
CREATE POLICY "Users can only access their own data" ON "calls"
FOR ALL
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

-- Enable RLS on phone_numbers table
ALTER TABLE "phone_numbers" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only access their own data" ON "phone_numbers";
CREATE POLICY "Users can only access their own data" ON "phone_numbers"
FOR ALL
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

-- Enable RLS on knowledge_bases table
ALTER TABLE "knowledge_bases" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only access their own data" ON "knowledge_bases";
CREATE POLICY "Users can only access their own data" ON "knowledge_bases"
FOR ALL
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

-- Enable RLS on batches table
ALTER TABLE "batches" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only access their own data" ON "batches";
CREATE POLICY "Users can only access their own data" ON "batches"
FOR ALL
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

-- Enable RLS on webhooks table
ALTER TABLE "webhooks" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only access their own data" ON "webhooks";
CREATE POLICY "Users can only access their own data" ON "webhooks"
FOR ALL
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

-- Enable RLS on sip_trunks table
ALTER TABLE "sip_trunks" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only access their own data" ON "sip_trunks";
CREATE POLICY "Users can only access their own data" ON "sip_trunks"
FOR ALL
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

-- Enable RLS on provider_credentials table
ALTER TABLE "provider_credentials" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only access their own data" ON "provider_credentials";
CREATE POLICY "Users can only access their own data" ON "provider_credentials"
FOR ALL
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

-- Enable RLS on call_sessions table
ALTER TABLE "call_sessions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only access their own data" ON "call_sessions";
CREATE POLICY "Users can only access their own data" ON "call_sessions"
FOR ALL
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

-- Enable RLS on sub_accounts table
ALTER TABLE "sub_accounts" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only access their own data" ON "sub_accounts";
CREATE POLICY "Users can only access their own data" ON "sub_accounts"
FOR ALL
USING (auth.uid()::text = parent_user_id)
WITH CHECK (auth.uid()::text = parent_user_id);
