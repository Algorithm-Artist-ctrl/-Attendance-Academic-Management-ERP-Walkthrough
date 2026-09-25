if (!process.env.DATABASE_URL && (process as any).loadEnvFile) {
  try { (process as any).loadEnvFile(); } catch {}
}
import fs from 'fs';
import path from 'path';
import pg from 'pg';

let connectionString = process.env.DATABASE_URL || '';
if (!connectionString && fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf-8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) {
      connectionString = line.split('DATABASE_URL=')[1].trim().replace(/['"]/g, '');
    }
  }
}

async function main() {
  if (!connectionString) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL database.');

    const migrationPath = path.join(
      process.cwd(),
      'supabase',
      'migrations',
      '054_fix_class_coordinator_and_auth_credentials.sql'
    );
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Applying Migration 054: Class Coordinator Persistence and Auth Credentials...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Migration 054 applied successfully.');

    // Verification
    const funcRes = await client.query(`
      SELECT proname, prosecdef 
      FROM pg_proc 
      WHERE proname IN ('remove_class_coordinator_atomic', 'admin_update_account_credentials');
    `);
    console.log('Verified RPC functions:');
    console.table(funcRes.rows);

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Failed to apply migration 054:', err);
    throw err;
  } finally {
    await client.end().catch(() => {});
    console.log('Database connection closed.');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
