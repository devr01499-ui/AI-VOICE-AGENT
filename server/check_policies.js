const { Client } = require('pg');

async function checkPolicies() {
  const client = new Client({
    connectionString: "postgres://postgres.elbgdgahyoyfbtuwsktx:MAstTJXkIPAV0ZFW@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=no-verify"
  });

  try {
    await client.connect();

    // Query RLS status for public tables
    const tablesQuery = await client.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public';
    `);

    // Query all RLS policies
    const policiesQuery = await client.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
      FROM pg_policies
      WHERE schemaname = 'public';
    `);

    console.log("=== TABLE RLS STATUS (pg_tables) ===");
    console.table(tablesQuery.rows);

    console.log("\n=== RLS POLICIES (pg_policies) ===");
    console.table(policiesQuery.rows);

  } catch (err) {
    console.error("Error connecting to db:", err);
  } finally {
    await client.end();
  }
}

checkPolicies();
