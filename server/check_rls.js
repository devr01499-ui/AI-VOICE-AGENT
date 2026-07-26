const { Client } = require('pg');

async function checkRLS() {
  const client = new Client({
    connectionString: "postgres://postgres.elbgdgahyoyfbtuwsktx:MAstTJXkIPAV0ZFW@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=no-verify"
  });

  try {
    await client.connect();

    // Query RLS status for public tables
    const tablesQuery = await client.query(`
      SELECT relname as table_name, relrowsecurity as rls_enabled 
      FROM pg_class 
      WHERE relkind = 'r' 
      AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
    `);

    // Query all RLS policies
    const policiesQuery = await client.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
      FROM pg_policies
      WHERE schemaname = 'public';
    `);

    console.log("=== TABLE RLS STATUS ===");
    console.table(tablesQuery.rows);

    console.log("\n=== RLS POLICIES ===");
    console.table(policiesQuery.rows);

  } catch (err) {
    console.error("Error connecting to db:", err);
  } finally {
    await client.end();
  }
}

checkRLS();
