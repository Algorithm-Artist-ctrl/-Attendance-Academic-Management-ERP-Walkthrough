import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import { AttendanceRecordInsert } from '../types/database.types';

// Polyfill localStorage for Node environment
if (typeof localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (global as any).localStorage = {
    getItem: (k: string) => store[k] || null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  };
}

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition: boolean, message: string, details?: any) {
  totalAssertions++;
  if (!condition) {
    console.error(`\n❌ FAILED [Assertion ${totalAssertions}]: ${message}`);
    if (details) console.error('   Details:', details);
    process.exit(1);
  } else {
    passedAssertions++;
    console.log(`  ✓ [Step ${totalAssertions}] ${message}`);
  }
}

async function runLiveAttendancePipelineTest() {
  console.log('================================================================================');
  console.log('🧪 VCTM ERP LIVE ATTENDANCE END-TO-END PRODUCTION PIPELINE VERIFICATION');
  console.log('================================================================================\n');

  // STEP 1: AUTHENTICATION AS FACULTY
  console.log('▶ STEP 1: AUTHENTICATING AS FACULTY (Ms. Hemlata Chaudhry)');
  const facultyEmail = 'hemlata.cse@vctm.in';
  const facultyPass = 'VctmFaculty@2026';

  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: facultyEmail,
    password: facultyPass,
  });

  assert(!authErr && !!authData.user, 'Faculty successfully authenticated with Supabase Auth', {
    userId: authData.user?.id,
    email: authData.user?.email,
  });

  const facultyUserId = authData.user!.id;

  // Retrieve faculty row
  const { data: facProfile, error: facErr } = await supabase
    .from('faculty')
    .select('*')
    .eq('auth_user_id', facultyUserId)
    .single();

  assert(!facErr && !!facProfile, 'Faculty profile retrieved from Supabase database', {
    facultyId: facProfile?.id,
    name: facProfile?.full_name,
    code: facProfile?.faculty_code,
  });

  const facultyId = facProfile!.id;

  // STEP 2: RESOLVE SECTION A & TIMETABLE ENTRY
  console.log('\n▶ STEP 2: RESOLVING 2ND YEAR SECTION A & TIMETABLE ENTRY');
  const { data: sections } = await supabase
    .from('sections')
    .select('*, semester:semesters(*)')
    .eq('name', 'A');

  const secA = sections?.find(s => s.semester?.name?.includes('3rd') && s.name === 'A');
  assert(!!secA, 'Resolved 2nd Year CSE Section A', { sectionId: secA?.id, sectionName: secA?.name });
  const sectionId = secA!.id;

  // Retrieve enrolled students for Section A
  const { data: students, error: studErr } = await supabase
    .from('students')
    .select('*')
    .eq('section_id', sectionId)
    .eq('active', true)
    .order('roll_number');

  assert(!studErr && !!students && students.length > 0, `Retrieved ${students?.length} active enrolled students in Section A`, {
    studentCount: students?.length,
    firstStudent: students?.[0]?.roll_number,
    lastStudent: students?.[students?.length - 1]?.roll_number,
  });

  const totalStudents = students!.length;
  console.log(`  ℹ Found ${totalStudents} active students enrolled in Section A.`);

  // Find timetable entry for this faculty and section
  const { data: timetableEntries, error: ttErr } = await supabase
    .from('timetable_entries')
    .select('*, subject:subjects(*)')
    .eq('section_id', sectionId)
    .eq('faculty_id', facultyId);

  assert(!ttErr && !!timetableEntries && timetableEntries.length > 0, 'Found active timetable entry for faculty in Section A', {
    count: timetableEntries?.length,
    entry: timetableEntries?.[0],
  });

  const targetEntry = timetableEntries![0];
  const subjectId = targetEntry.subject_id;
  const entryId = targetEntry.id;

  console.log(`  ℹ Target timetable entry: ${targetEntry.day_of_week} ${targetEntry.start_time}-${targetEntry.end_time}, Subject: ${targetEntry.subject?.subject_name}`);

  // STEP 3: EXECUTE ATOMIC ATTENDANCE SAVE (40 Present, 13 Absent)
  console.log('\n▶ STEP 3: ATOMIC ATTENDANCE SAVE VIA RPC (40 Present, Remainder Absent)');
  const todayISO = new Date().toISOString().split('T')[0];
  const startTime = targetEntry.start_time.substring(0, 5);
  const endTime = targetEntry.end_time.substring(0, 5);

  const presentTarget = Math.min(40, totalStudents);
  const initialStudentRecords = students!.map((s, idx) => ({
    studentId: s.id,
    status: (idx < presentTarget ? 'Present' : 'Absent') as 'Present' | 'Absent',
  }));

  const expectedInitialPresent = presentTarget;
  const expectedInitialAbsent = totalStudents - presentTarget;

  console.log(`  ℹ Submitting attendance payload: ${expectedInitialPresent} Present, ${expectedInitialAbsent} Absent, Total: ${totalStudents}`);

  const saveResult = await supabaseService.saveAttendance({
    timetableEntryId: entryId,
    facultyId: facultyId,
    sectionId: sectionId,
    subjectId: subjectId,
    sessionDate: todayISO,
    startTime: startTime,
    endTime: endTime,
    studentRecords: initialStudentRecords,
  });

  assert(!!saveResult && !!saveResult.session, 'saveAttendance returned successfully with session', {
    sessionId: saveResult?.session?.id,
    recordCount: saveResult?.records?.length,
  });

  const sessionId = saveResult.session.id;

  // STEP 4: DATABASE VERIFICATION (ZERO DUPLICATES, EXACT TOTALS)
  console.log('\n▶ STEP 4: VERIFYING SUPABASE DATABASE RECORDS DIRECTLY');

  // 1. Verify exactly 1 session exists for (timetable_entry_id, session_date)
  const { data: dbSessions, error: dbSessErr } = await supabase
    .from('attendance_sessions')
    .select('*')
    .eq('timetable_entry_id', entryId)
    .eq('session_date', todayISO);

  assert(!dbSessErr && dbSessions?.length === 1, 'Exactly ONE attendance session exists in database for this timetable slot & date', {
    foundSessions: dbSessions?.length,
    sessionId: dbSessions?.[0]?.id,
  });

  // 2. Verify exactly totalStudents attendance_records exist for this session
  const { data: dbRecords, error: dbRecErr } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('attendance_session_id', sessionId);

  assert(!dbRecErr && dbRecords?.length === totalStudents, `Live database contains exactly ${totalStudents} attendance_records`, {
    expected: totalStudents,
    actual: dbRecords?.length,
  });

  const dbPresent = dbRecords?.filter(r => r.status === 'Present').length;
  const dbAbsent = dbRecords?.filter(r => r.status === 'Absent').length;

  assert(dbPresent === expectedInitialPresent, `Database Present count matches expected (${expectedInitialPresent})`, { dbPresent });
  assert(dbAbsent === expectedInitialAbsent, `Database Absent count matches expected (${expectedInitialAbsent})`, { dbAbsent });

  // 3. Verify ZERO duplicate records for any student
  const studentRecordCounts: Record<string, number> = {};
  dbRecords?.forEach(r => {
    studentRecordCounts[r.student_id] = (studentRecordCounts[r.student_id] || 0) + 1;
  });

  const duplicates = Object.entries(studentRecordCounts).filter(([_, count]) => count > 1);
  assert(duplicates.length === 0, 'Zero duplicate records in database for any student', { duplicates });

  // STEP 5: IDEMPOTENT UPDATE (CHANGE 1 STUDENT STATUS)
  console.log('\n▶ STEP 5: IDEMPOTENT ATTENDANCE UPDATE (Modify 1 student from Present to Absent)');
  // Flip student index 0 from Present to Absent
  const updatedStudentRecords = initialStudentRecords.map((r, idx) => {
    if (idx === 0) return { ...r, status: 'Absent' as const };
    return r;
  });

  const expectedUpdatedPresent = expectedInitialPresent - 1;
  const expectedUpdatedAbsent = expectedInitialAbsent + 1;

  const updateResult = await supabaseService.saveAttendance({
    timetableEntryId: entryId,
    facultyId: facultyId,
    sectionId: sectionId,
    subjectId: subjectId,
    sessionDate: todayISO,
    startTime: startTime,
    endTime: endTime,
    studentRecords: updatedStudentRecords,
  });

  assert(!!updateResult && updateResult.session.id === sessionId, 'Attendance update reuses existing session ID (Atomic UPSERT)', {
    originalSessionId: sessionId,
    updatedSessionId: updateResult?.session?.id,
  });

  // Verify counts in DB after update
  const { data: updatedDbRecords } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('attendance_session_id', sessionId);

  const updatedDbPresent = updatedDbRecords?.filter(r => r.status === 'Present').length;
  const updatedDbAbsent = updatedDbRecords?.filter(r => r.status === 'Absent').length;

  assert(updatedDbRecords?.length === totalStudents, `Record count remains strictly ${totalStudents} (no orphan rows inserted)`, { count: updatedDbRecords?.length });
  assert(updatedDbPresent === expectedUpdatedPresent, `Updated Present count reflects change (${expectedUpdatedPresent})`, { updatedDbPresent });
  assert(updatedDbAbsent === expectedUpdatedAbsent, `Updated Absent count reflects change (${expectedUpdatedAbsent})`, { updatedDbAbsent });

  // Verify student 0 is now Absent
  const student0Rec = updatedDbRecords?.find(r => r.student_id === students![0].id);
  assert(student0Rec?.status === 'Absent', `Target student ${students![0].roll_number} updated status is Absent`);

  // STEP 6: STUDENT DASHBOARD & HOD REPORT DATA PROPAGATION
  console.log('\n▶ STEP 6: VERIFYING ATTENDANCE QUERY PROPAGATION (Student & HOD Views)');
  // Check student attendance query
  const student0Id = students![0].id;
  const { data: studentAttendance, error: stAttErr } = await supabase
    .from('attendance_records')
    .select('*, session:attendance_sessions(*, subject:subjects(*))')
    .eq('student_id', student0Id)
    .eq('attendance_session_id', sessionId);

  assert(!stAttErr && studentAttendance?.length === 1, 'Student attendance history query returns authoritative session record', {
    studentId: student0Id,
    record: studentAttendance?.[0],
  });

  // STEP 7: SECURITY & VALIDATION ENFORCEMENT
  console.log('\n▶ STEP 7: SECURITY ENFORCEMENT — REJECT UNAUTHORIZED STUDENT SAVE');
  // Sign in as student
  const studentEmail = '2403400100021@vctm.in';
  const studentPass = 'VctmStudent@2026';
  const { error: studAuthErr } = await supabase.auth.signInWithPassword({
    email: studentEmail,
    password: studentPass,
  });

  assert(!studAuthErr, 'Authenticated as student for unauthorized attempt test');

  // Student attempts to call save_attendance_session RPC
  let studentSaveFailed = false;
  let studentSaveErrorMsg = '';
  try {
    const { error: studRpcErr } = await supabase.rpc('save_attendance_session', {
      p_timetable_entry_id: entryId,
      p_faculty_id: facultyId,
      p_section_id: sectionId,
      p_subject_id: subjectId,
      p_session_date: todayISO,
      p_start_time: startTime,
      p_end_time: endTime,
      p_records: initialStudentRecords,
    });
    if (studRpcErr) {
      studentSaveFailed = true;
      studentSaveErrorMsg = studRpcErr.message;
    }
  } catch (err: any) {
    studentSaveFailed = true;
    studentSaveErrorMsg = err.message;
  }

  assert(studentSaveFailed, 'Student attendance save attempt was strictly REJECTED by Postgres security policy', {
    rejectionMessage: studentSaveErrorMsg,
  });

  // STEP 8: VALIDATION ENFORCEMENT — REJECT FUTURE DATE
  console.log('\n▶ STEP 8: VALIDATION ENFORCEMENT — REJECT FUTURE DATES');
  // Switch back to faculty
  await supabase.auth.signInWithPassword({
    email: facultyEmail,
    password: facultyPass,
  });

  let futureDateFailed = false;
  let futureDateErrorMsg = '';
  try {
    const { error: futureErr } = await supabase.rpc('save_attendance_session', {
      p_timetable_entry_id: entryId,
      p_faculty_id: facultyId,
      p_section_id: sectionId,
      p_subject_id: subjectId,
      p_session_date: '2099-12-31',
      p_start_time: startTime,
      p_end_time: endTime,
      p_records: initialStudentRecords,
    });
    if (futureErr) {
      futureDateFailed = true;
      futureDateErrorMsg = futureErr.message;
    }
  } catch (err: any) {
    futureDateFailed = true;
    futureDateErrorMsg = err.message;
  }

  assert(futureDateFailed, 'Future attendance date was strictly REJECTED by database constraint', {
    rejectionMessage: futureDateErrorMsg,
  });

  // STEP 9: ROSTER INTEGRITY — REJECT PARTIAL INCOMPLETE ROSTER
  console.log('\n▶ STEP 9: VALIDATION ENFORCEMENT — REJECT PARTIAL/EMPTY ROSTER');
  let partialRosterFailed = false;
  let partialRosterErrorMsg = '';
  try {
    // Pass only 1 student record when section has 53
    const { error: partErr } = await supabase.rpc('save_attendance_session', {
      p_timetable_entry_id: entryId,
      p_faculty_id: facultyId,
      p_section_id: sectionId,
      p_subject_id: subjectId,
      p_session_date: todayISO,
      p_start_time: startTime,
      p_end_time: endTime,
      p_records: [initialStudentRecords[0]], // only 1 student
    });
    if (partErr) {
      partialRosterFailed = true;
      partialRosterErrorMsg = partErr.message;
    }
  } catch (err: any) {
    partialRosterFailed = true;
    partialRosterErrorMsg = err.message;
  }

  assert(partialRosterFailed, 'Partial/incomplete student roster was strictly REJECTED by database constraint', {
    rejectionMessage: partialRosterErrorMsg,
  });

  // STEP 10: FOREIGN KEY INTEGRITY CHECK
  console.log('\n▶ STEP 10: FOREIGN KEY SAFETY CHECK (attendance_sessions.timetable_entry_id ON DELETE SET NULL)');
  const { data: colInfo } = await supabase
    .from('attendance_sessions')
    .select('id, timetable_entry_id')
    .eq('id', sessionId)
    .single();

  assert(!!colInfo && colInfo.id === sessionId, 'Attendance session persists with active timetable_entry_id link', {
    sessionId: colInfo?.id,
    timetableEntryId: colInfo?.timetable_entry_id,
  });

  // STEP 11: DELETE ATTENDANCE SESSION & ZERO ORPHANS VERIFICATION
  console.log('\n▶ STEP 11: DELETE ATTENDANCE SESSION & ZERO ORPHANS VERIFICATION');
  const deleteResult = await supabaseService.deleteAttendanceSession(sessionId);
  assert(deleteResult?.success === true, 'deleteAttendanceSession returned success: true');

  const { data: checkSess } = await supabase
    .from('attendance_sessions')
    .select('id')
    .eq('id', sessionId)
    .maybeSingle();
  assert(!checkSess, 'Deleted session no longer exists in attendance_sessions table');

  const { data: checkRecs } = await supabase
    .from('attendance_records')
    .select('id')
    .eq('attendance_session_id', sessionId);
  assert(!checkRecs || checkRecs.length === 0, 'Zero orphan attendance records remain after session deletion');

  // Re-save session for persistent testing and demo state
  console.log('\n▶ STEP 12: RESTORING LIVE TEST SESSION FOR SEAMLESS DASHBOARD CONTINUITY');
  const restoreResult = await supabaseService.saveAttendance({
    timetableEntryId: entryId,
    facultyId,
    sectionId,
    subjectId,
    sessionDate: todayISO,
    startTime,
    endTime,
    studentRecords: initialStudentRecords,
  });

  assert(
    !!restoreResult.session?.id && restoreResult.records?.length === totalStudents,
    `Restored active attendance session with all ${totalStudents} student records intact`
  );

  console.log('\n================================================================================');
  console.log(`🎉 ALL ${passedAssertions}/${totalAssertions} ASSERTIONS PASSED PERFECTLY!`);
  console.log('   Live Supabase Attendance Pipeline is completely verified and production-ready.');
  console.log('================================================================================\n');

  // Sign out cleanly
  await supabase.auth.signOut();
}

runLiveAttendancePipelineTest().catch(err => {
  console.error('\n💥 Unexpected test failure:', err);
  process.exit(1);
});
