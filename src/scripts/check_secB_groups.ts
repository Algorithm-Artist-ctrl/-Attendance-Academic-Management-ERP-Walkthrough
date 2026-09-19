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

  const mg = await client.query(`
    SELECT mg.*, sub.subject_name, sec.name as section_name, ay.name as year_name
    FROM message_groups mg
    LEFT JOIN subjects sub ON sub.id = mg.subject_id
    LEFT JOIN sections sec ON sec.id = mg.section_id
    LEFT JOIN academic_years ay ON ay.id = mg.academic_year_id
    WHERE mg.section_id = '233957c0-4fef-42c6-8285-40ebf73ea6b7';
  `);
  console.log("Existing message_groups for Section B (2nd Year):", mg.rows);

  await client.end();
}

check().catch(console.error);
