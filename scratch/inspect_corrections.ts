import { supabase } from '../src/lib/supabase/supabaseClient';

async function inspect() {
  const { data: corrections, error: cErr } = await supabase.from('attendance_corrections').select('*, student:students(*), record:attendance_records(*, session:attendance_sessions(*, subject:subjects(*), section:sections(*)))');
  console.log('--- ALL ATTENDANCE CORRECTIONS IN SUPABASE ---');
  console.log('Count:', corrections?.length, 'Error:', cErr);
  console.log(JSON.stringify(corrections, null, 2));

  const { data: facs } = await supabase.from('faculty').select('*');
  console.log('\n--- ALL FACULTY IN SUPABASE ---');
  console.log(facs?.map(f => ({ id: f.id, full_name: f.full_name, email: f.email, code: f.faculty_code })));

  const { data: profiles } = await supabase.from('profiles').select('*');
  console.log('\n--- ALL PROFILES IN SUPABASE ---');
  console.log(profiles?.map(p => ({ id: p.id, full_name: p.full_name, email: p.email, role: p.role })));
}

inspect();
