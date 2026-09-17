import pg from 'pg';

const connectionString = process.env.DATABASE_URL || (process.env.SUPABASE_DB_PASSWORD
  ? 'postgresql://postgres.obssoojzryqiudllnlkh:' + encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) + '@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres'
  : '');

async function getIds() {
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const sess = await client.query("SELECT id, name FROM public.academic_sessions WHERE is_current = true LIMIT 1;");
  const depts = await client.query("SELECT id, name, code FROM public.departments LIMIT 2;");
  const progs = await client.query("SELECT id, name, code FROM public.programs LIMIT 2;");
  const sem7 = await client.query("SELECT id, name, academic_year_id FROM public.semesters WHERE semester_number = 7;");
  const sem5 = await client.query("SELECT id, name, academic_year_id FROM public.semesters WHERE semester_number = 5;");
  const sem3 = await client.query("SELECT id, name, academic_year_id FROM public.semesters WHERE semester_number = 3;");

  console.log('Session:', sess.rows[0]);
  console.log('Depts:', depts.rows);
  console.log('Programs:', progs.rows);
  console.log('Sem 7:', sem7.rows[0]);
  console.log('Sem 5:', sem5.rows[0]);
  console.log('Sem 3:', sem3.rows[0]);

  await client.end();
}

getIds().catch(console.error);
