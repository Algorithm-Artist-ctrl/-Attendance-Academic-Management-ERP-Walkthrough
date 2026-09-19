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

async function testInsideTx() {
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const authId = '4743eb90-0e7e-4ba6-875e-ee3348a1de72';

  await client.query('BEGIN');
  await client.query(`SET LOCAL "request.jwt.claim.sub" = '${authId}';`);
  await client.query(`SET LOCAL "request.jwt.claim.role" = 'authenticated';`);
  
  const roleCheck = await client.query(`SELECT auth.uid() as uid, public.current_user_role() as role;`);
  console.log("Inside TX with claim:", roleCheck.rows[0]);

  // Now query message_groups with RLS evaluated
  // We can test the exact RLS policy condition as a WHERE clause:
  const allowedGroups = await client.query(`
    SELECT mg.id, sub.subject_name, sec.name as section_name, ay.year_number,
           fsa.id as fsa_id, te.id as te_id
    FROM message_groups mg
    JOIN subjects sub ON sub.id = mg.subject_id
    JOIN sections sec ON sec.id = mg.section_id
    JOIN academic_years ay ON ay.id = mg.academic_year_id
    LEFT JOIN faculty_subject_assignments fsa ON (
      fsa.faculty_id = (SELECT p.faculty_id FROM profiles p WHERE p.id = auth.uid())
      AND fsa.section_id = mg.section_id
      AND (mg.subject_id IS NULL OR fsa.subject_id = mg.subject_id)
      AND fsa.active = true
    )
    LEFT JOIN timetable_entries te ON (
      te.faculty_id = (SELECT p.faculty_id FROM profiles p WHERE p.id = auth.uid())
      AND te.section_id = mg.section_id
      AND (mg.subject_id IS NULL OR te.subject_id = mg.subject_id)
      AND te.active = true
    )
    LEFT JOIN sections coord_sec ON (
      coord_sec.id = mg.section_id
      AND coord_sec.class_coordinator_id = (SELECT p.faculty_id FROM profiles p WHERE p.id = auth.uid())
    )
    WHERE (
      (public.current_user_role() = 'super_admin'::user_role)
      OR (public.current_user_role() = 'hod'::user_role AND mg.department_id = (SELECT p.department_id FROM profiles p WHERE p.id = auth.uid()))
      OR fsa.id IS NOT NULL
      OR te.id IS NOT NULL
      OR coord_sec.id IS NOT NULL
    );
  `);

  console.log(`Allowed groups for Hemlata strictly matching RLS: ${allowedGroups.rows.length}`);
  for (const r of allowedGroups.rows) {
    console.log(`- ${r.subject_name} (${r.section_name}, Year ${r.year_number}) [FSA: ${!!r.fsa_id}, TE: ${!!r.te_id}]`);
  }

  await client.query('ROLLBACK');
  await client.end();
}

testInsideTx().catch(console.error);
