const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgres://postgres.elbgdgahyoyfbtuwsktx:MAstTJXkIPAV0ZFW@aws-1-us-east-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  const res = await client.query('SELECT * FROM "integration_audit_logs" ORDER BY "created_at" DESC LIMIT 5;');
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}

main().catch(console.error);
