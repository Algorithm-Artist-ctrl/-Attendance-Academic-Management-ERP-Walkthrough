import pg from 'pg';

const connectionString = process.env.DATABASE_URL || (process.env.SUPABASE_DB_PASSWORD
  ? 'postgresql://postgres.obssoojzryqiudllnlkh:' + encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) + '@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres'
  : '');

async function checkUnlinked() {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  await client.connect();

  console.log('--- STUDENT AUTH LINKAGE STATUS ---');
  const studStats = await client.query(`
    SELECT 
      ay.name as year_name,
      ay.year_number,
      count(*) as total_students,
      count(s.auth_user_id) as with_auth_user_id,
      count(*) - count(s.auth_user_id) as missing_auth_user_id,
      count(u.id) as valid_in_auth_users
    FROM public.students s
    JOIN public.academic_years ay ON ay.id = s.academic_year_id
    LEFT JOIN auth.users u ON u.id = s.auth_user_id
    WHERE s.active = true
    GROUP BY ay.name, ay.year_number
    ORDER BY ay.year_number;
  `);
  console.table(studStats.rows);

  console.log('--- FACULTY AUTH LINKAGE STATUS ---');
  const facStats = await client.query(`
    SELECT 
      count(*) as total_faculty,
      count(f.auth_user_id) as with_auth_user_id,
      count(*) - count(f.auth_user_id) as missing_auth_user_id,
      count(u.id) as valid_in_auth_users
    FROM public.faculty f
    LEFT JOIN auth.users u ON u.id = f.auth_user_id
    WHERE f.active = true;
  `);
  console.table(facStats.rows);

  console.log('--- UNLINKED FACULTY DETAILS ---');
  const unlinkedFac = await client.query(`
    SELECT f.id, f.employee_code, f.faculty_code, f.full_name, f.email, f.auth_user_id
    FROM public.faculty f
    WHERE f.active = true AND (f.auth_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = f.auth_user_id));
  `);
  console.table(unlinkedFac.rows);

  console.log('--- UNLINKED STUDENTS SAMPLE ---');
  const unlinkedStud = await client.query(`
    SELECT s.id, s.roll_number, s.full_name, s.email, ay.name as year_name, sec.name as section_name
    FROM public.students s
    JOIN public.academic_years ay ON ay.id = s.academic_year_id
    JOIN public.sections sec ON sec.id = s.section_id
    WHERE s.active = true AND (s.auth_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.auth_user_id))
    LIMIT 10;
  `);
  console.table(unlinkedStud.rows);

  await client.end();
}

checkUnlinked().catch(console.error);
