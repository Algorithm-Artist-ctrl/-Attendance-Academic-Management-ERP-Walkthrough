import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.obssoojzryqiudllnlkh:Tarun%40759977@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres';

async function applyPerformanceIndexes() {
  console.log('Connecting to Supabase PostgreSQL...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected successfully.');

    const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '025_performance_composite_indexes_and_optimizations.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing Migration 025 (Performance Composite Indexes & Optimization)...');
    await client.query(sql);
    console.log('Migration 025 executed successfully!');

    // Verification query for the created indexes
    const indexesRes = await client.query(`
      SELECT indexname, tablename
      FROM pg_indexes 
      WHERE schemaname = 'public' 
        AND indexname IN (
          'idx_notifications_user_unread_created',
          'idx_notifications_student_unread_created',
          'idx_sessional_marks_student_sub_sec',
          'idx_timetable_section_faculty_active',
          'idx_attendance_records_student_session',
          'idx_attendance_sessions_sec_date_fac'
        )
      ORDER BY tablename, indexname;
    `);
    console.log('Verified newly created composite indexes:');
    console.table(indexesRes.rows);

  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyPerformanceIndexes();
