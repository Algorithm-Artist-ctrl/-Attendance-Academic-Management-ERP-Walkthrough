import { supabase } from '../src/lib/supabase/supabaseClient';

async function inspectCorrectionsOnly() {
  const { data: corrections, error: cErr } = await supabase
    .from('attendance_corrections')
    .select('*, student:students(*), record:attendance_records(*, session:attendance_sessions(*, subject:subjects(*), section:sections(*)))');
  
  console.log('--- ALL ATTENDANCE CORRECTIONS IN SUPABASE ---');
  console.log('Count:', corrections?.length, 'Error:', cErr);
  for (const c of corrections || []) {
    console.log({
      id: c.id,
      student_id: c.student_id,
      student_name: c.student?.full_name,
      status: c.status,
      requested_status: c.requested_status,
      reason: c.reason,
      session_faculty_id: c.record?.session?.faculty_id,
      session_section_name: c.record?.session?.section?.name,
      session_subject_code: c.record?.session?.subject?.subject_code,
      reviewed_by: c.reviewed_by
    });
  }
}

inspectCorrectionsOnly();
