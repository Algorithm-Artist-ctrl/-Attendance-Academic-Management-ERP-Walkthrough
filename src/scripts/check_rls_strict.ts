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

async function checkRLSStrict() {
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const authId = '4743eb90-0e7e-4ba6-875e-ee3348a1de72';

  await client.query('BEGIN');
  // Enable FORCE ROW LEVEL SECURITY so superuser also respects RLS during test
  await client.query('ALTER TABLE public.message_groups FORCE ROW LEVEL SECURITY;');
  await client.query(`SET LOCAL "request.jwt.claim.sub" = '${authId}';`);
  await client.query(`SET LOCAL "request.jwt.claim.role" = 'authenticated';`);

  const res = await client.query(`
    SELECT mg.id, sub.subject_name, sec.name as section_name, ay.year_number
    FROM message_groups mg
    JOIN subjects sub ON sub.id = mg.subject_id
    JOIN sections sec ON sec.id = mg.section_id
    JOIN academic_years ay ON ay.id = mg.academic_year_id;
  `);

  console.log(`With FORCE RLS, Hemlata sees ${res.rows.length} groups:`);
  for (const r of res.rows) {
    console.log(`- ${r.subject_name} (${r.section_name}, Year ${r.year_number})`);
  }

  await client.query('ROLLBACK');
  await client.end();
}

checkRLSStrict().catch(console.error);
