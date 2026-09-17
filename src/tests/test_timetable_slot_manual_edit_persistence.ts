import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';

async function main() {
  console.log('=== Starting Timetable Slot Manual Edit & Auto-Faculty Assignment Test ===');

  // 1. Sign in as HOD
  const { data: hodAuth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'wasim.cse@vctm.in',
    password: 'VctmHod@2026'
  });
  if (authErr || !hodAuth.user) {
    throw new Error(`HOD authentication failed: ${authErr?.message}`);
  }
  console.log('✔ Authenticated as HOD Wasim (ID:', hodAuth.user.id, ')');

  // 2. Query 4th Year Section A Tuesday Period 2
  const secId = '7b80ad81-10be-403a-a3a2-26ff7079b4df'; // Section A 4th Year
  const { data: initialSlot, error: fetchErr } = await supabase
    .from('timetable_entries')
    .select('*')
    .eq('section_id', secId)
    .eq('day_of_week', 'TUE')
    .eq('period_number', 2)
    .single();

  if (fetchErr || !initialSlot) {
    throw new Error(`Could not find 4th Year Section A TUE Period 2: ${fetchErr?.message}`);
  }
  console.log('✔ Initial Slot Found:', {
    id: initialSlot.id,
    day_of_week: initialSlot.day_of_week,
    period_number: initialSlot.period_number,
    subject_id: initialSlot.subject_id,
    faculty_id: initialSlot.faculty_id,
    room_number: initialSlot.room_number,
  });

  const originalFacultyId = initialSlot.faculty_id;
  const originalSubjectId = initialSlot.subject_id;

  // 3. Find another CSE faculty to test manual reassignment
  const { data: otherFaculty, error: facErr } = await supabase
    .from('faculty')
    .select('id, full_name')
    .neq('id', originalFacultyId)
    .limit(1)
    .single();

  if (facErr || !otherFaculty) {
    throw new Error(`Could not find second faculty: ${facErr?.message}`);
  }
  console.log('✔ Alternate Faculty chosen for manual test:', otherFaculty.full_name, `(${otherFaculty.id})`);

  // 4. Test Step A: Manually assign alternate faculty
  console.log('\n--- Test A: Manually assign alternate faculty ---');
  const saveResultA = await supabaseService.saveSingleTimetableSlot({
    slotId: initialSlot.id,
    sectionId: secId,
    dayOfWeek: 'TUE',
    periodNumber: 2,
    startTime: '09:50:00',
    endTime: '10:40:00',
    subjectId: originalSubjectId,
    facultyId: otherFaculty.id,
    roomNumber: 'A401',
    lectureType: 'Theory',
    updatedBy: 'HOD Wasim Test'
  });
  console.log('✔ Save result A success:', saveResultA.success);

  // Verify Supabase row in timetable_entries
  const { data: slotAfterA } = await supabase
    .from('timetable_entries')
    .select('*')
    .eq('id', initialSlot.id)
    .single();

  if (slotAfterA?.faculty_id !== otherFaculty.id) {
    throw new Error(`Expected faculty_id to be ${otherFaculty.id}, got ${slotAfterA?.faculty_id}`);
  }
  console.log('✔ Supabase persisted alternate faculty:', slotAfterA.faculty_id, `(Room: ${slotAfterA.room_number})`);

  // Verify faculty_subject_assignments has active row for otherFaculty
  const { data: assignA } = await supabase
    .from('faculty_subject_assignments')
    .select('*')
    .eq('section_id', secId)
    .eq('subject_id', originalSubjectId)
    .eq('faculty_id', otherFaculty.id)
    .eq('active', true)
    .maybeSingle();

  if (!assignA) {
    throw new Error(`Expected active assignment for alternate faculty ${otherFaculty.id}`);
  }
  console.log('✔ faculty_subject_assignments has active assignment for alternate faculty');

  // 5. Test Step B: Manually change faculty to Unassigned (null)
  console.log('\n--- Test B: Manually set faculty to Unassigned (null) ---');
  const saveResultB = await supabaseService.saveSingleTimetableSlot({
    slotId: initialSlot.id,
    sectionId: secId,
    dayOfWeek: 'TUE',
    periodNumber: 2,
    startTime: '09:50:00',
    endTime: '10:40:00',
    subjectId: originalSubjectId,
    facultyId: null, // Unassigned
    roomNumber: 'A401',
    lectureType: 'Theory',
    updatedBy: 'HOD Wasim Test'
  });
  console.log('✔ Save result B success:', saveResultB.success);

  // Verify Supabase row in timetable_entries has faculty_id = null
  const { data: slotAfterB } = await supabase
    .from('timetable_entries')
    .select('*')
    .eq('id', initialSlot.id)
    .single();

  if (slotAfterB?.faculty_id !== null) {
    throw new Error(`Expected faculty_id to be null, got ${slotAfterB?.faculty_id}`);
  }
  console.log('✔ Supabase successfully persisted NULL faculty_id for unassigned slot!');

  // Verify that otherFaculty is now deactivated since they no longer teach any slots for that section+subject
  const { data: assignAfterB } = await supabase
    .from('faculty_subject_assignments')
    .select('*')
    .eq('section_id', secId)
    .eq('subject_id', originalSubjectId)
    .eq('faculty_id', otherFaculty.id)
    .maybeSingle();

  if (assignAfterB && assignAfterB.active) {
    throw new Error(`Expected assignment for ${otherFaculty.id} to be deactivated, but it is still active`);
  }
  console.log('✔ faculty_subject_assignments correctly deactivated obsolete assignment for', otherFaculty.full_name);

  // 6. Test Step C: Restore Original Faculty (Waseem)
  console.log('\n--- Test C: Restore original faculty ---');
  const saveResultC = await supabaseService.saveSingleTimetableSlot({
    slotId: initialSlot.id,
    sectionId: secId,
    dayOfWeek: 'TUE',
    periodNumber: 2,
    startTime: '09:50:00',
    endTime: '10:40:00',
    subjectId: originalSubjectId,
    facultyId: originalFacultyId,
    roomNumber: 'A401',
    lectureType: 'Theory',
    updatedBy: 'HOD Wasim Test'
  });
  console.log('✔ Save result C success:', saveResultC.success);

  const { data: slotAfterC } = await supabase
    .from('timetable_entries')
    .select('*')
    .eq('id', initialSlot.id)
    .single();

  if (slotAfterC?.faculty_id !== originalFacultyId) {
    throw new Error(`Expected restored faculty_id to be ${originalFacultyId}, got ${slotAfterC?.faculty_id}`);
  }
  console.log('✔ Restored original faculty in Supabase:', slotAfterC.faculty_id);

  // 7. Verify atomic timetable replacement RPC works cleanly without PGRST203
  console.log('\n--- Test D: Verify replace_section_timetable RPC ---');
  const { data: allSlots } = await supabase
    .from('timetable_entries')
    .select('*')
    .eq('section_id', secId);

  const { data: rpcRes, error: rpcErr } = await supabase.rpc('replace_section_timetable', {
    p_section_id: secId,
    p_department_id: 'fe5bc365-7a68-4290-b05e-acfa274f748a',
    p_approved_by: 'HOD Wasim Test Verification',
    p_effective_from: '2026-09-18',
    p_source_type: 'VERIFICATION_TEST',
    p_source_url: null,
    p_entries: allSlots
  });

  if (rpcErr || !rpcRes?.success) {
    throw new Error(`RPC replace_section_timetable failed: ${rpcErr?.message || JSON.stringify(rpcRes)}`);
  }
  console.log('✔ Atomic replace_section_timetable RPC succeeded without PGRST203 error:', rpcRes);

  console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
}

main().catch(err => {
  console.error('❌ Test Failed:', err);
  process.exit(1);
});
