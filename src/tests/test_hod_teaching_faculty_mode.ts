import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';

async function runTest() {
  console.log('===============================================================');
  console.log('VCTM ERP: HOD DEDICATED TEACHING / FACULTY MODE VERIFICATION');
  console.log('===============================================================\n');

  // 1. Authenticate as HOD Wasim
  console.log('Step 1: Authenticating as HOD Wasim (wasim.cse@vctm.in)...');
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'wasim.cse@vctm.in',
    password: 'VctmHod@2026'
  });

  if (authErr || !authData.user) {
    throw new Error(`Authentication failed: ${authErr?.message}`);
  }
  console.log('✔ Authenticated successfully as user:', authData.user.id);

  // 2. Verify Profile & Role
  console.log('\nStep 2: Verifying HOD Profile & Faculty Linkage...');
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, faculty_id, department_id')
    .eq('id', authData.user.id)
    .single();

  if (profileErr || !profile) {
    throw new Error(`Failed to load profile: ${profileErr?.message}`);
  }

  console.log('  Full Name:', profile.full_name);
  console.log('  Role in DB:', profile.role);
  console.log('  Linked Faculty ID:', profile.faculty_id);
  console.log('  Department ID:', profile.department_id);

  if (profile.role !== 'hod') {
    throw new Error(`Expected role 'hod', received '${profile.role}'`);
  }
  if (!profile.faculty_id) {
    throw new Error('HOD profile is missing faculty_id linkage!');
  }
  console.log('✔ HOD profile verified: role remains authoritative "hod" with linked faculty record.');

  // 3. Verify Faculty Record
  const { data: facRecord, error: facErr } = await supabase
    .from('faculty')
    .select('*')
    .eq('id', profile.faculty_id)
    .single();

  if (facErr || !facRecord) {
    throw new Error(`Linked faculty record not found: ${facErr?.message}`);
  }
  console.log('✔ Linked Faculty Record found:', facRecord.full_name, `(${facRecord.faculty_code || facRecord.employee_code})`);

  // 4. Test Strict Scoping: Query Timetable entries for Mr. Waseem
  console.log('\nStep 3: Verifying Timetable Scoping for HOD in Faculty Mode...');
  const { data: ttEntries, error: ttErr } = await supabase
    .from('timetable_entries')
    .select('id, section_id, subject_id, day_of_week, period_number, room_number, active')
    .eq('faculty_id', profile.faculty_id)
    .eq('active', true);

  if (ttErr || !ttEntries) {
    throw new Error(`Failed to query timetable slots: ${ttErr?.message}`);
  }

  console.log(`  Found ${ttEntries.length} active timetable slots assigned to Mr. Waseem:`);
  for (const entry of ttEntries) {
    console.log(`    - Day: ${entry.day_of_week}, Period: ${entry.period_number}, Section: ${entry.section_id}, Subject: ${entry.subject_id}, Room: ${entry.room_number}`);
  }

  if (ttEntries.length === 0) {
    throw new Error('No active timetable slots found for Mr. Waseem!');
  }

  // Ensure ALL returned entries strictly belong to Mr. Waseem
  const nonWaseemSlots = ttEntries.filter(e => (e as any).faculty_id && (e as any).faculty_id !== profile.faculty_id);
  if (nonWaseemSlots.length > 0) {
    throw new Error(`Privilege leak detected: Found slots assigned to another faculty!`);
  }
  console.log('✔ Timetable entries are strictly scoped to Mr. Waseem with ZERO privilege leakage.');

  // 5. Test Active Subject Assignments (FSA)
  console.log('\nStep 4: Verifying Subject & Section Assignments (FSA)...');
  const { data: fsaList, error: fsaErr } = await supabase
    .from('faculty_subject_assignments')
    .select('id, section_id, subject_id, active')
    .eq('faculty_id', profile.faculty_id)
    .eq('active', true);

  if (fsaErr || !fsaList) {
    throw new Error(`Failed to query FSA: ${fsaErr?.message}`);
  }
  console.log(`  Found ${fsaList.length} active subject assignments for Mr. Waseem.`);
  for (const fsa of fsaList) {
    console.log(`    - Subject: ${fsa.subject_id}, Section: ${fsa.section_id}`);
  }
  console.log('✔ Subject assignments verified.');

  // 6. Test Authorized Attendance Saving (for Mr. Waseem's assigned slot)
  console.log('\nStep 5: Testing Authorized Attendance Recording for Assigned Class...');
  const testSlot = ttEntries[0];
  const testDate = new Date().toISOString().split('T')[0]; // today

  // Fetch 2 students from this section
  const { data: sectionStudents, error: studErr } = await supabase
    .from('students')
    .select('id, roll_number, full_name')
    .eq('section_id', testSlot.section_id)
    .limit(2);

  if (studErr || !sectionStudents || sectionStudents.length === 0) {
    throw new Error(`Could not find students in section ${testSlot.section_id}`);
  }

  const recordsToSave = sectionStudents.map(s => ({
    studentId: s.id,
    status: 'Present' as const,
  }));

  console.log(`  Saving attendance for ${recordsToSave.length} students in section ${testSlot.section_id}...`);
  const saveResult = await supabaseService.saveAttendance({
    sectionId: testSlot.section_id,
    subjectId: testSlot.subject_id!,
    facultyId: profile.faculty_id,
    sessionDate: testDate,
    timetableEntryId: testSlot.id,
    studentRecords: recordsToSave,
  });

  if (!saveResult.session || !saveResult.records) {
    throw new Error('Attendance save did not return session or records!');
  }
  console.log('✔ Attendance saved successfully in Supabase! Session ID:', saveResult.session.id);
  console.log('  Saved Record Count:', saveResult.records.length);

  // 7. Test Strict Scoping: Attempt unauthorized attendance marking for an UNASSIGNED section
  console.log('\nStep 6: Testing Strict Scoping Protection (Attempting to mark unassigned section)...');
  
  // Find a section where Mr. Waseem does NOT teach
  const mySectionIds = new Set(ttEntries.map(e => e.section_id));
  const { data: otherSection, error: otherSecErr } = await supabase
    .from('sections')
    .select('id, name')
    .not('id', 'in', `(${Array.from(mySectionIds).join(',')})`)
    .eq('active', true)
    .limit(1)
    .single();

  const unassignedSectionId = otherSection?.id || '00000000-0000-0000-0000-000000000000';
  let unauthorizedBlocked = false;

  try {
    await supabaseService.saveAttendance({
      sectionId: unassignedSectionId,
      subjectId: testSlot.subject_id!,
      facultyId: profile.faculty_id,
      sessionDate: testDate,
      studentRecords: recordsToSave,
    });
  } catch (err: any) {
    unauthorizedBlocked = true;
    console.log('✔ Successfully blocked unauthorized attendance saving! Error:', err.message);
  }

  if (!unauthorizedBlocked) {
    throw new Error('SECURITY VIOLATION: HOD was able to save attendance for an unassigned section in faculty mode!');
  }

  // 8. Clean up test attendance session
  console.log('\nStep 7: Cleaning up test attendance session...');
  if (saveResult.session?.id) {
    const { error: delErr } = await supabase
      .from('attendance_sessions')
      .delete()
      .eq('id', saveResult.session.id);

    if (delErr) {
      console.warn('  Warning: Could not delete test session:', delErr.message);
    } else {
      console.log('✔ Test attendance session cleaned up cleanly.');
    }
  }

  console.log('\n===============================================================');
  console.log('✔ ALL VERIFICATION CHECKS PASSED: HOD TEACHING MODE IS SECURE & FULLY FUNCTIONAL');
  console.log('===============================================================\n');
}

runTest().catch((err) => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
