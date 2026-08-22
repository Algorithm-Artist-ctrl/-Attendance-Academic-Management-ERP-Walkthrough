import pg from 'pg';

const connectionString = 'postgresql://postgres:Tarun%40759977@db.obssoojzryqiudllnlkh.supabase.co:5432/postgres';

async function setupRLSPolicies() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL directly!');

    const tables = [
      'institutions',
      'departments',
      'programs',
      'academic_sessions',
      'academic_years',
      'semesters',
      'sections',
      'subjects',
      'faculty',
      'faculty_subject_assignments',
      'students',
      'timetable_entries',
      'attendance_sessions',
      'attendance_records',
      'attendance_corrections',
      'audit_logs',
      'profiles'
    ];

    for (const table of tables) {
      console.log(`Setting up policies for table: ${table}...`);
      
      // Drop restrictive old policies
      await client.query(`
        DO $$
        DECLARE
          r RECORD;
        BEGIN
          FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = '${table}')
          LOOP
            EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.' || quote_ident('${table}');
          END LOOP;
        END $$;
      `);

      // Create permissive policies for anon & authenticated
      await client.query(`
        CREATE POLICY "Allow select on ${table}" ON public.${table}
          FOR SELECT TO anon, authenticated USING (true);
      `);

      await client.query(`
        CREATE POLICY "Allow insert on ${table}" ON public.${table}
          FOR INSERT TO anon, authenticated WITH CHECK (true);
      `);

      await client.query(`
        CREATE POLICY "Allow update on ${table}" ON public.${table}
          FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
      `);

      await client.query(`
        CREATE POLICY "Allow delete on ${table}" ON public.${table}
          FOR DELETE TO anon, authenticated USING (true);
      `);
    }

    console.log('🎉 All table RLS policies successfully updated for anon and authenticated access!');

  } catch (err: any) {
    console.error('Postgres error:', err.message);
  } finally {
    await client.end();
  }
}

setupRLSPolicies();
