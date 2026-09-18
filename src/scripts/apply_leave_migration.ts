import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.obssoojzryqiudllnlkh:Tarun%40759977@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres';

async function applyLeaveMigration() {
  console.log('Connecting to Supabase PostgreSQL...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected successfully.');

    const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '024_multi_level_leave_approval_system.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing Migration 024 (Multi-Level Leave Approval Workflow)...');
    await client.query(sql);
    console.log('Migration 024 executed successfully!');

    // Verification queries
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('leave_applications', 'leave_approval_audit_logs');
    `);
    console.log('Verified tables:', tables.rows.map(r => r.table_name));

    const procs = await client.query(`
      SELECT proname, prosecdef 
      FROM pg_proc 
      WHERE proname IN ('submit_leave_application', 'coordinator_review_leave', 'hod_review_leave');
    `);
    console.log('Verified RPC functions:', procs.rows);

    const coordinators = await client.query(`
      SELECT cca.id, s.name as section, ay.year_number, f.full_name as coordinator
      FROM public.class_coordinator_assignments cca
      JOIN public.sections s ON s.id = cca.section_id
      JOIN public.semesters sem ON sem.id = s.semester_id
      JOIN public.academic_years ay ON ay.id = sem.academic_year_id
      JOIN public.faculty f ON f.id = cca.faculty_id
      WHERE cca.active = true
      ORDER BY ay.year_number, s.name;
    `);
    console.log('Active Section Coordinators:');
    console.table(coordinators.rows);

  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyLeaveMigration();
