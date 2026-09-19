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

async function checkStudents() {
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const secB = '233957c0-4fef-42c6-8285-40ebf73ea6b7';
  const st = await client.query(`
    SELECT s.id, s.academic_year_id, sec.semester_id, sem.academic_year_id as sem_year_id
    FROM students s
    JOIN sections sec ON sec.id = s.section_id
    JOIN semesters sem ON sem.id = sec.semester_id
    WHERE s.section_id = $1;
  `, [secB]);

  console.log(`Total students in Section B: ${st.rows.length}`);
  const matchCount = st.rows.filter(r => r.academic_year_id === r.sem_year_id).length;
  console.log(`Students with matching academic_year_id: ${matchCount}/${st.rows.length}`);

  await client.end();
}

checkStudents().catch(console.error);
