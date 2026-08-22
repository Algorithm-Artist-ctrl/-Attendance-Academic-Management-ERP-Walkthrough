import pg from 'pg';

const connectionString = 'postgresql://postgres:Tarun%40759977@db.obssoojzryqiudllnlkh.supabase.co:5432/postgres';

async function findTarun() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();

    const res = await client.query(`
      SELECT st.id, st.roll_number, st.full_name, s.name as section_name, st.section_id, st.admission_type, f.full_name as mentor_name
      FROM students st
      JOIN sections s ON s.id = st.section_id
      LEFT JOIN faculty f ON f.id = st.mentor_faculty_id
      WHERE st.full_name ILIKE '%tarun%' OR st.roll_number ILIKE '%57%';
    `);
    console.log('Students matching Tarun or 57:');
    console.table(res.rows);

  } catch (err: any) {
    console.error('Postgres error:', err.message);
  } finally {
    await client.end();
  }
}

findTarun();
