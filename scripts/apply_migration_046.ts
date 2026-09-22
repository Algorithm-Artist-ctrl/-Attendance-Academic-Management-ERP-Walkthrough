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

  console.log('🚀 Connecting to Supabase PostgreSQL Database for Migration 046...');

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL successfully!');

    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '046_sessional_marks_absent_and_exempted_support.sql');
    console.log(`📦 Reading migration file: ${migrationPath}`);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('⚡ Executing Migration 046...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Migration 046 executed and committed successfully!');

    // Verify columns and constraints
    const colRes = await client.query(`
      SELECT column_name, is_nullable, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'sessional_marks'
        AND column_name IN ('attendance_status', 'marks_obtained', 'status');
    `);

    console.log('📋 Verified Sessional Marks Columns:');
    colRes.rows.forEach(r => console.log(`   - ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable}, default: ${r.column_default})`));

    // Verify constraints
    const conRes = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE conrelid = 'public.sessional_marks'::regclass
        AND conname LIKE 'chk_sessional_marks%';
    `);
    console.log('📋 Verified Constraints:');
    conRes.rows.forEach(r => console.log(`   - ${r.conname}: ${r.def}`));

    // Verify functions
    const funcRes = await client.query(`
      SELECT proname, prosrc
      FROM pg_proc
      WHERE proname IN ('permanent_delete_archived_account', 'publish_sessional_assessment', 'prevent_destructive_hard_delete');
    `);
    console.log('📋 Verified Database Functions:');
    funcRes.rows.forEach(r => console.log(`   - ${r.proname}()`));

    console.log('🎉 Migration 046 applied and verified successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    try { await client.query('ROLLBACK'); } catch {}
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
