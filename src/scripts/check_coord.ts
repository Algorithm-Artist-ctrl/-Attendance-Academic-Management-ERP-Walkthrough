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

async function checkCoord() {
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const sec = await client.query(`
    SELECT s.id, s.name, s.class_coordinator_id, f.full_name as coordinator_name
    FROM sections s
    LEFT JOIN faculty f ON f.id = s.class_coordinator_id
    WHERE s.name = 'A';
  `);
  console.log("Section A coordinators:", sec.rows);

  // Check Hemlata's coordinations
  const hemlataCoord = await client.query(`
    SELECT s.id, s.name, ay.year_number
    FROM sections s
    JOIN semesters sem ON sem.id = s.semester_id
    JOIN academic_years ay ON ay.id = sem.academic_year_id
    WHERE s.class_coordinator_id = '4743eb90-0e7e-4ba6-875e-ee3348a1de72';
  `);
  console.log("Sections where Hemlata is coordinator:", hemlataCoord.rows);

  await client.end();
}

checkCoord().catch(console.error);
