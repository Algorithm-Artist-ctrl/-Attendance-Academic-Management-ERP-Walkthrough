if (!process.env.DATABASE_URL && (process as any).loadEnvFile) {
  try { (process as any).loadEnvFile(); } catch {}
}
import fs from 'fs';
import path from 'path';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL || '';

async function applyMigration() {
  if (!connectionString) {
    console.error('DATABASE_URL environment variable is required.');
    process.exit(1);
  }

  console.log('🚀 Connecting to Supabase PostgreSQL Database for Migration 047...');

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL successfully!');

    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '047_fix_permanent_delete_cascade_and_first_year.sql');
    console.log(`📦 Reading migration file: ${migrationPath}`);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('⚡ Executing Migration 047...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Migration 047 executed and committed successfully!');

    // Verify student enrollment_number column
    const colRes = await client.query(`
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_name = 'students' AND column_name = 'enrollment_number';
    `);
    console.log('📋 Verified Students Enrollment Number:');
    colRes.rows.forEach(r => console.log(`   - ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable})`));

    // Verify 1st Year is active
    const yearRes = await client.query(`
      SELECT id, name, year_number, active
      FROM public.academic_years
      WHERE year_number = 1;
    `);
    console.log('📋 Verified 1st Year Status:');
    yearRes.rows.forEach(r => console.log(`   - ${r.name} (Year ${r.year_number}): active = ${r.active}`));

    // Verify permanent_delete_archived_account function
    const funcRes = await client.query(`
      SELECT proname, prosrc
      FROM pg_proc
      WHERE proname = 'permanent_delete_archived_account';
    `);
    console.log('📋 Verified Function:');
    funcRes.rows.forEach(r => {
      const hasSenderUserId = r.prosrc.includes('sender_user_id');
      const hasOldSenderId = r.prosrc.includes('sender_id');
      console.log(`   - ${r.proname}: has sender_user_id = ${hasSenderUserId}, has sender_id = ${hasOldSenderId}`);
    });

    console.log('🎉 Migration 047 applied and verified successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    try { await client.query('ROLLBACK'); } catch {}
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
