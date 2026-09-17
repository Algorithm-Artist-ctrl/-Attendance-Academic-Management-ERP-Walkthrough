import pg from 'pg';

const connectionString = process.env.DATABASE_URL || (process.env.SUPABASE_DB_PASSWORD
  ? 'postgresql://postgres.obssoojzryqiudllnlkh:' + encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) + '@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres'
  : '');

async function checkTT() {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  await client.connect();

  console.log('--- SUBJECTS BY SEMESTER ---');
  const subs = await client.query(`
    SELECT sem.semester_number, sem.name as sem_name, ay.name as year_name, count(sub.id) as subject_count
    FROM public.semesters sem
    JOIN public.academic_years ay ON ay.id = sem.academic_year_id
    LEFT JOIN public.subjects sub ON sub.semester_id = sem.id AND sub.active = true
    GROUP BY sem.semester_number, sem.name, ay.name, ay.year_number
    ORDER BY ay.year_number, sem.semester_number;
  `);
  console.table(subs.rows);

  console.log('--- TIMETABLE ENTRIES BY SECTION ---');
  const tt = await client.query(`
    SELECT 
      ay.name as year_name,
      sem.name as sem_name,
      s.id as section_id,
      s.name as section_name,
      s.room_number,
      count(t.id) as slot_count
    FROM public.sections s
    JOIN public.semesters sem ON sem.id = s.semester_id
    JOIN public.academic_years ay ON ay.id = sem.academic_year_id
    LEFT JOIN public.timetable_entries t ON t.section_id = s.id AND t.active = true
    WHERE s.active = true
    GROUP BY ay.name, sem.name, s.id, s.name, s.room_number, ay.year_number
    ORDER BY ay.year_number, s.name;
  `);
  console.table(tt.rows);

  console.log('--- SEMESTER 5 SUBJECTS ---');
  const sem5Subs = await client.query(`
    SELECT id, subject_code, subject_name, lecture_type 
    FROM public.subjects 
    WHERE semester_id IN (SELECT id FROM public.semesters WHERE semester_number = 5)
    ORDER BY subject_code;
  `);
  console.table(sem5Subs.rows);

  console.log('--- SEMESTER 7 SUBJECTS ---');
  const sem7Subs = await client.query(`
    SELECT id, subject_code, subject_name, lecture_type 
    FROM public.subjects 
    WHERE semester_id IN (SELECT id FROM public.semesters WHERE semester_number = 7)
    ORDER BY subject_code;
  `);
  console.table(sem7Subs.rows);

  await client.end();
}

checkTT().catch(console.error);
