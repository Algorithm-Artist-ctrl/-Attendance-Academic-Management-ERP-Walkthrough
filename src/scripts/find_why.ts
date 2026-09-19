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

async function findWhy() {
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const authId = '4743eb90-0e7e-4ba6-875e-ee3348a1de72';
  // Check AI in Year 4 (which Hemlata definitely does NOT teach)
  const aiGroup = '9f5b1d76-4ae3-412f-bb02-641a44905494';

  const res = await client.query(`
    SELECT 
      (auth.role() = 'service_role') as cond_service_role,
      (public.current_user_role() = 'super_admin') as cond_super_admin,
      ((public.current_user_role() = 'hod') AND (mg.department_id = (SELECT p.department_id FROM profiles p WHERE p.id = $1))) as cond_hod,
      EXISTS (
        SELECT 1 FROM profiles p
        JOIN faculty_subject_assignments fsa ON fsa.faculty_id = p.faculty_id
        WHERE p.id = $1
          AND fsa.section_id = mg.section_id
          AND (mg.subject_id IS NULL OR fsa.subject_id = mg.subject_id)
          AND fsa.active = true
      ) as cond_fsa,
      EXISTS (
        SELECT 1 FROM profiles p
        JOIN timetable_entries te ON te.faculty_id = p.faculty_id
        WHERE p.id = $1
          AND te.section_id = mg.section_id
          AND (mg.subject_id IS NULL OR te.subject_id = mg.subject_id)
          AND te.active = true
      ) as cond_te,
      EXISTS (
        SELECT 1 FROM profiles p
        JOIN sections sec ON sec.class_coordinator_id = p.faculty_id
        WHERE p.id = $1 AND sec.id = mg.section_id
      ) as cond_coord,
      EXISTS (
        SELECT 1 FROM students s
        WHERE ((s.auth_user_id = $1) OR (s.id = (SELECT p.student_id FROM profiles p WHERE p.id = $1)))
          AND s.section_id = mg.section_id
          AND s.academic_year_id = mg.academic_year_id
          AND s.active = true
      ) as cond_student
    FROM message_groups mg
    WHERE mg.id = $2;
  `, [authId, aiGroup]);

  console.log("Evaluation of conditions on AI Year 4 group:", res.rows[0]);

  // Check Hemlata's role returned by current_user_role()
  await client.query(`SET LOCAL "request.jwt.claim.sub" = '${authId}';`);
  const roleCheck = await client.query(`SELECT public.current_user_role() as role;`);
  console.log("current_user_role() for Hemlata:", roleCheck.rows[0]);

  await client.end();
}

findWhy().catch(console.error);
