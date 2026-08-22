import pg from 'pg';

const connectionString = 'postgresql://postgres:Tarun%40759977@db.obssoojzryqiudllnlkh.supabase.co:5432/postgres';

async function inspectStudents() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();

    const sections = await client.query('SELECT id, name, room_number FROM sections;');
    console.log('Sections:');
    console.table(sections.rows);

    const studentsBySec = await client.query(`
      SELECT s.name as section_name, count(*) as count, min(st.roll_number) as min_roll, max(st.roll_number) as max_roll
      FROM students st
      JOIN sections s ON s.id = st.section_id
      GROUP BY s.name;
    `);
    console.log('Students by Section:');
    console.table(studentsBySec.rows);

    const sampleA = await client.query(`
      SELECT st.id, st.roll_number, st.full_name, s.name as section_name, st.section_id, st.email
      FROM students st
      JOIN sections s ON s.id = st.section_id
      WHERE s.name = 'A'
      LIMIT 3;
    `);
    console.log('Sample Section A students:');
    console.table(sampleA.rows);

    const sampleB = await client.query(`
      SELECT st.id, st.roll_number, st.full_name, s.name as section_name, st.section_id, st.email
      FROM students st
      JOIN sections s ON s.id = st.section_id
      WHERE s.name = 'B'
      LIMIT 3;
    `);
    console.log('Sample Section B students:');
    console.table(sampleB.rows);

  } catch (err: any) {
    console.error('Postgres error:', err.message);
  } finally {
    await client.end();
  }
}

inspectStudents();
