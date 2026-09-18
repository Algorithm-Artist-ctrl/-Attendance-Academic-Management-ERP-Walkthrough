import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

let connectionString = process.env.DATABASE_URL;
if (!connectionString && fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  const match = envContent.match(/^DATABASE_URL\s*=\s*(.*)$/m);
  if (match) {
    connectionString = match[1].trim().replace(/^["']|["']$/g, '');
  }
}

if (!connectionString) {
  throw new Error('DATABASE_URL is not set in process.env or .env file.');
}

async function applyMigration028() {
  console.log('Connecting to Supabase PostgreSQL...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    console.log('Connected successfully to database.');

    const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '028_performance_composite_indexes.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing Migration 028 (Performance Composite Indexes)...');
    await client.query(sql);
    console.log('Migration 028 executed successfully!');

    // Verify created indexes
    const indexRes = await client.query(`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'idx_attendance_sessions_faculty_date',
          'idx_attendance_records_session_status',
          'idx_students_roll_number_lookup',
          'idx_faculty_employee_code_lookup',
          'idx_students_section_active',
          'idx_sessional_marks_assessment_student',
          'idx_attendance_corrections_created'
        )
      ORDER BY tablename, indexname;
    `);
    console.log('Verified created indexes:');
    console.table(indexRes.rows);

  } catch (err: any) {
    console.error('Error applying migration 028:', err.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }
}

applyMigration028();
