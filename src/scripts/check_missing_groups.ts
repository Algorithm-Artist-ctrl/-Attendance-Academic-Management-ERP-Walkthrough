import pg from "pg";
import path from "path";
import fs from "fs";

let connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      if (line.startsWith('DATABASE_URL=')) {
        connectionString = line.split('DATABASE_URL=')[1].trim().replace(/['"]/g, '');
      }
    }
  }
}

async function checkMissing() {
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Active assignments without message_group
  const missing = await client.query(`
    SELECT fsa.id, f.full_name as faculty_name, sub.subject_name, sec.name as section_name, ay.name as year_name,
           fsa.section_id, fsa.subject_id, sem.academic_year_id
    FROM faculty_subject_assignments fsa
    JOIN faculty f ON f.id = fsa.faculty_id
    JOIN subjects sub ON sub.id = fsa.subject_id
    JOIN sections sec ON sec.id = fsa.section_id
    JOIN semesters sem ON sem.id = sec.semester_id
    JOIN academic_years ay ON ay.id = sem.academic_year_id
    WHERE fsa.active = true
      AND NOT EXISTS (
        SELECT 1 FROM message_groups mg
        WHERE mg.section_id = fsa.section_id
          AND mg.subject_id = fsa.subject_id
          AND mg.academic_year_id = sem.academic_year_id
      );
  `);
  console.log(`Missing message_groups for active FSA count: ${missing.rows.length}`);
  if (missing.rows.length > 0) {
    console.log("Sample missing:", missing.rows.slice(0, 5));
  }

  // Also check timetable entries without message_group
  const missingTe = await client.query(`
    SELECT te.id, f.full_name as faculty_name, sub.subject_name, sec.name as section_name, ay.name as year_name
    FROM timetable_entries te
    JOIN faculty f ON f.id = te.faculty_id
    JOIN subjects sub ON sub.id = te.subject_id
    JOIN sections sec ON sec.id = te.section_id
    JOIN semesters sem ON sem.id = sec.semester_id
    JOIN academic_years ay ON ay.id = sem.academic_year_id
    WHERE te.active = true
      AND NOT EXISTS (
        SELECT 1 FROM message_groups mg
        WHERE mg.section_id = te.section_id
          AND mg.subject_id = te.subject_id
          AND mg.academic_year_id = sem.academic_year_id
      );
  `);
  console.log(`Missing message_groups for active timetable entries count: ${missingTe.rows.length}`);

  await client.end();
}

checkMissing().catch(console.error);
