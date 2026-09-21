if (!process.env.DATABASE_URL && (process as any).loadEnvFile) {
  try { (process as any).loadEnvFile(); } catch {}
}
import pg from 'pg';

const connectionString = process.env.DATABASE_URL || '';

async function checkPolicies() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL directly!');

    const res = await client.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public';
    `);

    console.log('Existing RLS Policies:');
    console.table(res.rows.map(r => ({
      table: r.tablename,
      policy: r.policyname,
      cmd: r.cmd,
      roles: r.roles
    })));

    const tablesRes = await client.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public';
    `);
    console.log('Tables Row Security Status:');
    console.table(tablesRes.rows);

  } catch (err: any) {
    console.error('Postgres error:', err.message);
  } finally {
    await client.end();
  }
}

checkPolicies();
