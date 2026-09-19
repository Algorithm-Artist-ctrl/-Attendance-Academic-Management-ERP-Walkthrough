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

async function debugPolicy() {
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const authId = '4743eb90-0e7e-4ba6-875e-ee3348a1de72';
  const groupId = '6030748c-af7e-42a3-afeb-518ec20c0809'; // Maths 4, Sec A

  const testMatch = await client.query(`
    SELECT 
      (public.current_user_role() = ANY (ARRAY['super_admin'::user_role, 'hod'::user_role])) as is_admin_or_hod,
      EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.faculty_subject_assignments fsa ON fsa.faculty_id = p.faculty_id
        WHERE p.id = $1
          AND fsa.section_id = mg.section_id
          AND fsa.subject_id = mg.subject_id
          AND fsa.active = true
      ) as matched_fsa,
      EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.timetable_entries te ON te.faculty_id = p.faculty_id
        WHERE p.id = $1
          AND te.section_id = mg.section_id
          AND te.subject_id = mg.subject_id
          AND te.active = true
      ) as matched_te
    FROM public.message_groups mg
    WHERE mg.id = $2;
  `, [authId, groupId]);

  console.log("Match breakdown for Maths IV Sec A:", testMatch.rows[0]);

  // Check what policies are on message_groups
  const pols = await client.query(`
    SELECT policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE tablename = 'message_groups';
  `);
  console.log("Policies on message_groups:", pols.rows);

  await client.end();
}

debugPolicy().catch(console.error);
