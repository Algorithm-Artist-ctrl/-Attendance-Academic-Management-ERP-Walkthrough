import fs from 'fs';
import path from 'path';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.obssoojzryqiudllnlkh:Tarun%40759977@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres';

async function applyMigration() {
  console.log('🚀 Connecting to Supabase PostgreSQL Database for Migration 042...');

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL successfully!');

    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '042_performance_indexes_and_optimizations.sql');
    console.log(`📦 Reading migration file: ${migrationPath}`);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('⚡ Executing Migration 042...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Migration 042 executed and committed successfully!');

    // Verification of new indexes
    const indexNames = [
      'idx_quizzes_sec_subj_active',
      'idx_assignments_sec_subj_active',
      'idx_sessional_assessments_sec_subj_act',
      'idx_sessional_marks_assessment_roster',
      'idx_notifications_bell_unread',
      'idx_notices_feed',
      'idx_group_messages_active_stream',
      'idx_timetable_sec_act',
      'idx_timetable_fac_act'
    ];

    const res = await client.query(`
      SELECT tablename, indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' AND indexname = ANY($1::text[])
      ORDER BY tablename, indexname;
    `, [indexNames]);

    console.log(`📋 Verified ${res.rows.length}/${indexNames.length} new indexes created in PostgreSQL:`);
    res.rows.forEach(r => console.log(`   - [${r.tablename}] ${r.indexname}`));

    if (res.rows.length === indexNames.length) {
      console.log('🎉 All Migration 042 indexes verified successfully!');
    } else {
      console.warn('⚠️ Some indexes could not be verified.');
    }
  } catch (err: any) {
    console.error('❌ Migration 042 Failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
