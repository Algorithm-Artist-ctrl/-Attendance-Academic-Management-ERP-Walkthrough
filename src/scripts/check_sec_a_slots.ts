import pg from 'pg';

const connectionString = process.env.DATABASE_URL || (process.env.SUPABASE_DB_PASSWORD
  ? 'postgresql://postgres.obssoojzryqiudllnlkh:' + encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) + '@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres'
  : '');

async function checkSecASlots() {
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const secASlots = await client.query(`
    SELECT t.day_of_week, t.period_number, t.start_time, t.end_time, s.subject_code, f.faculty_code, t.lecture_type, t.room_number
    FROM public.timetable_entries t
    LEFT JOIN public.subjects s ON s.id = t.subject_id
    LEFT JOIN public.faculty f ON f.id = t.faculty_id
    WHERE t.section_id = 'e982c5f1-3312-4c6f-a49b-71b55928d11c'
    ORDER BY t.day_of_week, t.period_number;
  `);
  console.log(`Found ${secASlots.rows.length} slots for 3rd Year Section A:`);
  console.table(secASlots.rows.slice(0, 16));

  await client.end();
}

checkSecASlots().catch(console.error);
