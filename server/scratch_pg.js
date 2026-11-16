require('./scripts/lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL /* set by testDbGuard from TEST_DATABASE_URL; never hard-code a URL here */,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  const res = await client.query('SELECT * FROM "integration_audit_logs" ORDER BY "created_at" DESC LIMIT 5;');
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}

main().catch(console.error);
