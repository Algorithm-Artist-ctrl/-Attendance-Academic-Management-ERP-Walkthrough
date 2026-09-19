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

  console.log("=== INSPECTING FACULTY ASSIGNMENTS & MESSAGE GROUPS ===");

  // Check Hemlata Chaudhary or faculty assignments
  const facRes = await client.query(`
    SELECT f.id, f.full_name, f.email, p.id as auth_id, f.department_id
    FROM faculty f
    LEFT JOIN profiles p ON p.id = f.auth_user_id
    WHERE f.full_name ILIKE '%Hemlata%' OR f.full_name ILIKE '%Chaudhary%'
    LIMIT 5;
  `);
  console.log("Faculty Hemlata query:", facRes.rows);

  const fsaRes = await client.query(`
    SELECT f.full_name as faculty_name, sub.subject_name, sub.subject_code, 
           sec.name as section_name, sec.room_number, ay.name as year_name, ay.year_number,
           fsa.faculty_id, fsa.section_id, fsa.subject_id, fsa.active
    FROM faculty_subject_assignments fsa
    JOIN faculty f ON f.id = fsa.faculty_id
    JOIN subjects sub ON sub.id = fsa.subject_id
    JOIN sections sec ON sec.id = fsa.section_id
    JOIN semesters sem ON sem.id = sec.semester_id
    JOIN academic_years ay ON ay.id = sem.academic_year_id
    WHERE fsa.active = true
    LIMIT 10;
  `);
  console.log("Sample Active Faculty Subject Assignments:", fsaRes.rows);

  // Check existing message_groups
  const mgRes = await client.query(`
    SELECT mg.id, sub.subject_name, sec.name as section_name, ay.year_number,
           f.full_name as faculty_name, mg.section_id, mg.subject_id, mg.created_by_faculty_id
    FROM message_groups mg
    LEFT JOIN subjects sub ON sub.id = mg.subject_id
    LEFT JOIN sections sec ON sec.id = mg.section_id
    LEFT JOIN academic_years ay ON ay.id = mg.academic_year_id
    LEFT JOIN faculty f ON f.id = mg.created_by_faculty_id
    LIMIT 10;
  `);
  console.log("Sample message_groups in database:", mgRes.rows);

  // Check count of active students in Section B
  const secB = await client.query(`
    SELECT sec.id, sec.name, count(s.id) as student_count
    FROM sections sec
    JOIN students s ON s.section_id = sec.id
    WHERE sec.name ILIKE '%B%' AND s.active = true AND (s.status = 'ACTIVE' OR s.status IS NULL)
    GROUP BY sec.id, sec.name;
  `);
  console.log("Section B active students count:", secB.rows);

  await client.end();
}

inspect().catch(console.error);
