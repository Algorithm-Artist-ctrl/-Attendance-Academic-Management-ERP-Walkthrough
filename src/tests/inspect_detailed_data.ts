import pg from 'pg';

const connectionString = 'postgresql://postgres:Tarun%40759977@db.obssoojzryqiudllnlkh.supabase.co:5432/postgres';

async function inspectDetailedData() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to PostgreSQL.\n');

    // 1. Sections
    const sections = await client.query('SELECT * FROM sections ORDER BY name;');
    console.log('--- SECTIONS ---');
    console.table(sections.rows);

    // 2. Faculty
    const faculty = await client.query('SELECT id, full_name, faculty_code, employee_code, designation FROM faculty ORDER BY full_name;');
    console.log('\n--- FACULTY ---');
    console.table(faculty.rows);

    // 3. Subjects
    const subjects = await client.query('SELECT id, subject_code, subject_name, lecture_type, credits FROM subjects ORDER BY subject_code;');
    console.log('\n--- SUBJECTS ---');
    console.table(subjects.rows);

    // 4. Assignments
    const assignments = await client.query(`
      SELECT fsa.id, s.name as section_name, sub.subject_code, sub.subject_name, f.full_name as faculty_name, f.faculty_code
      FROM faculty_subject_assignments fsa
      JOIN sections s ON s.id = fsa.section_id
      JOIN subjects sub ON sub.id = fsa.subject_id
      JOIN faculty f ON f.id = fsa.faculty_id
      ORDER BY s.name, sub.subject_code;
    `);
    console.log('\n--- FACULTY SUBJECT ASSIGNMENTS ---');
    console.table(assignments.rows);

    // 5. Timetable Count by Section
    const ttCount = await client.query(`
      SELECT s.name as section_name, count(*) as total_entries
      FROM timetable_entries te
      JOIN sections s ON s.id = te.section_id
      GROUP BY s.name;
    `);
    console.log('\n--- TIMETABLE ENTRIES COUNT BY SECTION ---');
    console.table(ttCount.rows);

    // Sample Timetable Entries
    const ttSample = await client.query(`
      SELECT s.name as section, te.day_of_week, te.period_number, te.start_time, te.end_time, te.room_number, sub.subject_code, f.full_name as faculty_name
      FROM timetable_entries te
      JOIN sections s ON s.id = te.section_id
      JOIN subjects sub ON sub.id = te.subject_id
      JOIN faculty f ON f.id = te.faculty_id
      WHERE te.day_of_week = 'MON'
      ORDER BY s.name, te.period_number;
    `);
    console.log('\n--- SAMPLE MONDAY TIMETABLE ---');
    console.table(ttSample.rows);

  } catch (err: any) {
    console.error('Postgres error:', err.message);
  } finally {
    await client.end();
  }
}

inspectDetailedData();
