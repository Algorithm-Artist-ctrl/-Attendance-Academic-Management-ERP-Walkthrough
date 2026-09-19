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

async function check() {
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const facId = '4743eb90-0e7e-4ba6-875e-ee3348a1de72';
  const fsa = await client.query(`
    SELECT fsa.id, fsa.faculty_id, fsa.subject_id, fsa.section_id, fsa.active,
           sub.subject_name, sub.subject_code, sec.name as section_name, sec.room_number,
           ay.name as year_name, ay.year_number
    FROM faculty_subject_assignments fsa
    JOIN subjects sub ON sub.id = fsa.subject_id
    JOIN sections sec ON sec.id = fsa.section_id
    JOIN semesters sem ON sem.id = sec.semester_id
    JOIN academic_years ay ON ay.id = sem.academic_year_id
    WHERE fsa.faculty_id = $1;
  `, [facId]);
  console.log("Hemlata FSA:", fsa.rows);

  // Check Data Structure Lab in subjects
  const dsLab = await client.query(`
    SELECT * FROM subjects WHERE subject_name ILIKE '%Data Structure%' OR subject_name ILIKE '%DS LAB%';
  `);
  console.log("Data Structure subjects:", dsLab.rows);

  // Check Section B (2nd Year)
  const secB2nd = await client.query(`
    SELECT sec.*, sem.academic_year_id, ay.year_number, ay.name as year_name
    FROM sections sec
    JOIN semesters sem ON sem.id = sec.semester_id
    JOIN academic_years ay ON ay.id = sem.academic_year_id
    WHERE sec.name ILIKE '%B%' AND ay.year_number = 2;
  `);
  console.log("Section B 2nd Year:", secB2nd.rows);

  await client.end();
}

check().catch(console.error);
