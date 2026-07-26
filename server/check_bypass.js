const { Client } = require('pg');

async function checkBypass() {
  const client = new Client({
    connectionString: "postgres://postgres.elbgdgahyoyfbtuwsktx:MAstTJXkIPAV0ZFW@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=no-verify"
  });

  try {
    await client.connect();

    // Who am I?
    const userRes = await client.query('SELECT current_user;');
    const currentUser = userRes.rows[0].current_user;
    console.log("Connected as role:", currentUser);

    // Check rolbypassrls and rolsuper
    const roleRes = await client.query(`SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = $1;`, [currentUser]);
    console.log("Role attributes:");
    console.table(roleRes.rows);

    // Check table owners
    const ownerRes = await client.query(`
      SELECT tablename, tableowner 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tableowner = $1;
    `, [currentUser]);
    
    console.log(`\nTables owned by ${currentUser} (owners bypass RLS by default):`);
    console.log(`Count: ${ownerRes.rows.length}`);
    if (ownerRes.rows.length > 0) {
      console.log(`Example tables owned: ${ownerRes.rows.slice(0, 3).map(r => r.tablename).join(', ')}...`);
    }

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

checkBypass();
