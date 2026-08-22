import pg from 'pg';

const connectionString = 'postgresql://postgres:Tarun%40759977@db.obssoojzryqiudllnlkh.supabase.co:5432/postgres';

async function enableRealtime() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    console.log('Enabling supabase_realtime publication on tables...');

    const tables = [
      'attendance_sessions',
      'attendance_records',
      'attendance_corrections',
      'audit_logs',
      'students',
      'faculty',
      'timetable_entries',
      'subjects',
      'sections',
      'departments'
    ];

    for (const table of tables) {
      try {
        await client.query(`ALTER PUBLICATION supabase_realtime ADD TABLE public.${table};`);
        console.log(`✅ Added ${table} to supabase_realtime publication`);
      } catch (err: any) {
        if (err.message.includes('already in publication')) {
          console.log(`ℹ️ ${table} is already in supabase_realtime publication`);
        } else {
          console.error(`Error on ${table}:`, err.message);
        }
      }
    }

  } catch (err: any) {
    console.error('Realtime setup error:', err.message);
  } finally {
    await client.end();
  }
}

enableRealtime();
