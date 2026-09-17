import fs from 'fs';
import path from 'path';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL || (process.env.SUPABASE_DB_PASSWORD
  ? 'postgresql://postgres.obssoojzryqiudllnlkh:' + encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) + '@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres'
  : '');

async function main() {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL database.');

    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '015_production_auth_provisioning_and_reconciliation.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Applying migration 015...');
    await client.query(sql);
    console.log('Migration 015 applied successfully.');

    // Lightweight verification of required database functions
    const funcsRes = await client.query(`
      SELECT proname 
      FROM pg_proc 
      WHERE proname IN ('provision_student_account', 'provision_faculty_account', 'reconcile_all_accounts');
    `);

    const verifiedFuncs = funcsRes.rows.map(r => r.proname);
    if (verifiedFuncs.length >= 3) {
      console.log('Verified required database functions.');
    } else {
      console.warn(`Warning: Only verified ${verifiedFuncs.length}/3 functions: ${verifiedFuncs.join(', ')}`);
    }

    // Optional lightweight verification of Semester 7 subjects
    const s7Res = await client.query(`
      SELECT count(*) as count 
      FROM public.subjects 
      WHERE semester_id = 'a6815eb1-4be1-4c8c-af17-6fb3dbf436ed';
    `);
    const s7Count = parseInt(s7Res.rows[0]?.count || '0', 10);
    if (s7Count >= 6) {
      console.log(`Verified Semester 7 subjects (${s7Count} active subjects).`);
    }

    console.log('Migration 015 completed successfully.');
  } finally {
    try {
      await client.end();
      console.log('Database connection closed.');
    } catch (closeErr) {
      console.error('Error closing database connection:', closeErr);
    }
  }
}

main()
  .then(() => {
    process.exitCode = 0;
  })
  .catch((error) => {
    console.error('Migration failed with error:', error?.message || error);
    process.exitCode = 1;
  });
