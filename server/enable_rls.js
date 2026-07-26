const { Client } = require('pg');

const tablesWithUserId = [
  'api_keys',
  'agents',
  'calls',
  'phone_numbers',
  'knowledge_bases',
  'batches',
  'webhooks',
  'sip_trunks',
  'provider_credentials',
  'call_sessions'
];

async function applyRLS() {
  const client = new Client({
    connectionString: "postgres://postgres.elbgdgahyoyfbtuwsktx:MAstTJXkIPAV0ZFW@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=no-verify"
  });

  try {
    await client.connect();

    console.log("Enabling RLS on 'users' table...");
    await client.query(`ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;`);
    await client.query(`
      DROP POLICY IF EXISTS "Users can only access their own data" ON "users";
      CREATE POLICY "Users can only access their own data" ON "users"
      FOR ALL
      USING (auth.uid()::text = id)
      WITH CHECK (auth.uid()::text = id);
    `);

    for (const table of tablesWithUserId) {
      console.log(`Enabling RLS on '${table}' table...`);
      await client.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
      await client.query(`
        DROP POLICY IF EXISTS "Users can only access their own data" ON "${table}";
        CREATE POLICY "Users can only access their own data" ON "${table}"
        FOR ALL
        USING (auth.uid()::text = user_id)
        WITH CHECK (auth.uid()::text = user_id);
      `);
    }
    
    console.log("Enabling RLS on 'sub_accounts' table...");
    await client.query(`ALTER TABLE "sub_accounts" ENABLE ROW LEVEL SECURITY;`);
    await client.query(`
      DROP POLICY IF EXISTS "Users can only access their own data" ON "sub_accounts";
      CREATE POLICY "Users can only access their own data" ON "sub_accounts"
      FOR ALL
      USING (auth.uid()::text = parent_user_id)
      WITH CHECK (auth.uid()::text = parent_user_id);
    `);

    console.log("Successfully applied RLS and strict policies to all primary user tables.");
  } catch (err) {
    console.error("Error applying RLS:", err);
  } finally {
    await client.end();
  }
}

applyRLS();
