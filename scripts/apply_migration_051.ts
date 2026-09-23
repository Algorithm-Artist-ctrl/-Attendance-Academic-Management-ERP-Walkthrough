import fs from 'fs';
import path from 'path';
import pg from 'pg';

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected to Supabase PostgreSQL.');

  const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '051_safe_permanent_account_deletion.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Applying migration 051...');
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration 051 applied successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed and rolled back:', err);
    process.exit(1);
  }

  // Verification: check functions
  const checkFunc = await client.query(`
    SELECT proname, prorettype::regtype 
    FROM pg_proc 
    WHERE proname IN ('permanent_delete_archived_account', 'get_archived_stats');
  `);
  console.log('Verified functions:');
  console.table(checkFunc.rows);

  // Verification: check system archive actor
  const checkActor = await client.query(`
    SELECT id, full_name, employee_code, email, active, status
    FROM public.faculty
    WHERE id = '00000000-0000-0000-0000-0000000000aa';
  `);
  console.log('Verified system archive actor:');
  console.table(checkActor.rows);

  await client.end();
}

main().catch(console.error);
