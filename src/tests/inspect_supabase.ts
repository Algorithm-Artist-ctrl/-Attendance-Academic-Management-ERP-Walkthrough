import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://obssoojzryqiudllnlkh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ic3Nvb2p6cnlxaXVkbGxubGtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MDU0NzUsImV4cCI6MjEwMjk4MTQ3NX0.eFCU024aroXFpTqnOaVUOpOUpONBwm3KDDdLfzlZ5co';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('Testing Supabase Cloud Connection...');
  
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
    'user_profiles'
  ];

  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact' })
        .limit(2);

      if (error) {
        console.log(`❌ Table [${table}]: Error -> ${error.message} (code: ${error.code})`);
      } else {
        console.log(`✅ Table [${table}]: Exists with ${data?.length || 0} sample rows (Total: ${count !== null ? count : 'N/A'})`);
        if (data && data.length > 0) {
          console.log(`   Sample columns:`, Object.keys(data[0]));
        }
      }
    } catch (e: any) {
      console.log(`💥 Table [${table}]: Exception -> ${e.message}`);
    }
  }
}

testConnection();
