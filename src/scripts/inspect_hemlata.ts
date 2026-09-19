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

async function inspect() {
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const facRes = await client.query(`
    SELECT f.id, f.full_name, f.email, f.designation, p.id as auth_id
    FROM faculty f
    LEFT JOIN profiles p ON p.id = f.auth_user_id
    WHERE f.full_name ILIKE '%Hemlata%' OR f.full_name ILIKE '%Chaudhary%';
  `);
  console.log("Faculty matches:", facRes.rows);

  if (facRes.rows.length > 0) {
    const fId = facRes.rows[0].id;
    const fsa = await client.query(`
      SELECT fsa.*, sub.subject_name, sub.subject_code, sec.name as section_name, sec.room_number,
             ay.name as year_name, ay.year_number
      FROM faculty_subject_assignments fsa
      JOIN subjects sub ON sub.id = fsa.subject_id
      JOIN sections sec ON sec.id = fsa.section_id
      JOIN semesters sem ON sem.id = sec.semester_id
      JOIN academic_years ay ON ay.id = sem.academic_year_id
      WHERE fsa.faculty_id = $1;
    `, [fId]);
    console.log("Hemlata assignments:", fsa.rows);

    const te = await client.query(`
      SELECT te.*, sub.subject_name, sec.name as section_name, sec.room_number
      FROM timetable_entries te
      JOIN subjects sub ON sub.id = te.subject_id
      JOIN sections sec ON sec.id = te.section_id
      WHERE te.faculty_id = $1;
    `, [fId]);
    console.log("Hemlata timetable entries:", te.rows);
  }

  // Also check all faculty names
  const allFac = await client.query(`
    SELECT id, full_name, email FROM faculty ORDER BY full_name LIMIT 15;
  `);
  console.log("All faculty sample:", allFac.rows);

  await client.end();
}

inspect().catch(console.error);
