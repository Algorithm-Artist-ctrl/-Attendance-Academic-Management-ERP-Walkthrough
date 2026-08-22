import pg from 'pg';

const connectionString = 'postgresql://postgres:Tarun%40759977@db.obssoojzryqiudllnlkh.supabase.co:5432/postgres';

async function checkAuthAndProfiles() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();

    const authUsers = await client.query(`
      SELECT id, email, role, created_at FROM auth.users;
    `);
    console.log('auth.users count:', authUsers.rows.length);
    console.table(authUsers.rows);

    const profilesRes = await client.query(`
      SELECT * FROM public.profiles;
    `);
    console.log('public.profiles count:', profilesRes.rows.length);
    console.table(profilesRes.rows);

  } catch (err: any) {
    console.error('Postgres error:', err.message);
  } finally {
    await client.end();
  }
}

checkAuthAndProfiles();
