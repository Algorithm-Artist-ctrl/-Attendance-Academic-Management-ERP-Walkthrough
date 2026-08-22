import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://obssoojzryqiudllnlkh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ic3Nvb2p6cnlxaXVkbGxubGtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MDU0NzUsImV4cCI6MjEwMjk4MTQ3NX0.eFCU024aroXFpTqnOaVUOpOUpONBwm3KDDdLfzlZ5co';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAttendanceFlow() {
  console.log('--- Testing Attendance Read/Write to Supabase ---');

  // 1. Fetch faculty, subject, section, and students
  const { data: faculty } = await supabase.from('faculty').select('*').limit(1);
  const { data: subjects } = await supabase.from('subjects').select('*').limit(1);
  const { data: sections } = await supabase.from('sections').select('*').limit(1);
  const { data: students } = await supabase.from('students').select('*').eq('section_id', sections![0].id).limit(5);

  console.log(`Fetched 1 faculty (${faculty![0].full_name}), 1 subject (${subjects![0].subject_name}), 1 section (${sections![0].name}), 5 students.`);

  // 2. Insert test attendance session (let Supabase gen_random_uuid or pass crypto.randomUUID())
  const { data: sessionData, error: sessError } = await supabase
    .from('attendance_sessions')
    .insert({
      faculty_id: faculty![0].id,
      section_id: sections![0].id,
      subject_id: subjects![0].id,
      session_date: new Date().toISOString().split('T')[0],
      start_time: '09:00',
      end_time: '09:50',
      status: 'completed',
      marked_at: new Date().toISOString()
    })
    .select();

  if (sessError) {
    console.error('❌ Insert attendance_sessions error:', sessError);
    return;
  }
  const createdSession = sessionData![0];
  console.log('✅ Inserted attendance_session successfully:', createdSession);

  // 3. Insert attendance records
  const recordsToInsert = students!.map((s, idx) => ({
    attendance_session_id: createdSession.id,
    student_id: s.id,
    status: idx === 0 ? 'Absent' : 'Present',
    marked_by: faculty![0].id,
    marked_at: new Date().toISOString()
  }));

  const { data: recordsData, error: recError } = await supabase
    .from('attendance_records')
    .insert(recordsToInsert)
    .select();

  if (recError) {
    console.error('❌ Insert attendance_records error:', recError);
    return;
  }
  console.log(`✅ Inserted ${recordsData?.length} attendance_records successfully!`);

  // 4. Test Correction Request
  const { data: corrData, error: corrError } = await supabase
    .from('attendance_corrections')
    .insert({
      attendance_record_id: recordsData![0].id,
      student_id: students![0].id,
      requested_status: 'Present',
      reason: 'Was present in lecture Room A-007, marked absent by mistake.',
      status: 'pending'
    })
    .select();

  if (corrError) {
    console.error('❌ Insert attendance_corrections error:', corrError);
    return;
  }
  console.log('✅ Inserted attendance_corrections successfully:', corrData);

  // 5. Test Audit Log
  const { data: auditData, error: auditError } = await supabase
    .from('audit_logs')
    .insert({
      actor_id: faculty![0].id,
      actor_name: faculty![0].full_name,
      actor_role: 'faculty',
      action: 'ATTENDANCE_RECORDED',
      entity_type: 'attendance_session',
      entity_id: createdSession.id,
      new_values: { presentCount: 4, absentCount: 1 }
    })
    .select();

  if (auditError) {
    console.error('❌ Insert audit_logs error:', auditError);
    return;
  }
  console.log('✅ Inserted audit_logs successfully:', auditData);
}

testAttendanceFlow();
