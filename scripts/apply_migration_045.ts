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

  console.log('🚀 Connecting to Supabase PostgreSQL Database for Migration 045...');

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL successfully!');

    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '045_performance_and_durable_sync_indexes.sql');
    console.log(`📦 Reading migration file: ${migrationPath}`);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('⚡ Executing Migration 045...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Migration 045 executed and committed successfully!');

    // Verify indexes
    const indexRes = await client.query(`
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
        AND indexname IN (
          'idx_attendance_sessions_fac_date',
          'idx_attendance_sessions_sec_sub_date',
          'idx_attendance_records_sess_student',
          'idx_attendance_records_student_recent',
          'idx_group_messages_idempotency',
          'idx_sessional_marks_student_assessment'
        );
    `);

    console.log('📋 Verified Performance Indexes:');
    indexRes.rows.forEach(r => console.log(`   - [${r.tablename}] ${r.indexname}`));

    console.log('🎉 Migration 045 applied and verified successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    try { await client.query('ROLLBACK'); } catch {}
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
