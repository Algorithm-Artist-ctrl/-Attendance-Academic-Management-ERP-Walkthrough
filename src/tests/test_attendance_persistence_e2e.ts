import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';

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

async function runAttendancePersistenceE2ETest() {
  console.log('================================================================================');
  console.log('🧪 VCTM ERP 2ND YEAR SECTION A ATTENDANCE PERSISTENCE E2E SUITE (TESTS A - J)');
  console.log('================================================================================\n');

  // STEP 1: AUTHENTICATION AS DR. NASEEM AHAMAD KHAN
  console.log('▶ STEP 1: Authenticating as Faculty Dr. Naseem Ahamad Khan...');
  const facultyEmail = 'naseem.math@vctm.in';
  const facultyPass = 'VctmFaculty@2026';

  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: facultyEmail,
    password: facultyPass,
  });

  assert(!authErr && !!authData.user, 'Dr. Naseem successfully authenticated with Supabase Auth', {
    userId: authData.user?.id,
    email: authData.user?.email,
  });

  const facultyUserId = authData.user!.id;

  // Retrieve faculty record
  const { data: facultyRow, error: facErr } = await supabase
    .from('faculty')
    .select('*')
    .eq('auth_user_id', facultyUserId)
    .single();

  assert(!facErr && !!facultyRow, 'Faculty profile retrieved from database', {
    facultyId: facultyRow?.id,
    name: facultyRow?.full_name,
  });

  const facultyId = facultyRow.id;

  // STEP 2: RESOLVE SECTION A & TIMETABLE ENTRY
  console.log('\n▶ STEP 2: Resolving 2nd Year Section A & Mathematics IV slot...');
  const sectionAId = 'fc93a413-c18d-4e72-9624-146767bc286b';
  const { data: sectionA, error: secErr } = await supabase
    .from('sections')
    .select('*, semester:semesters(*)')
    .eq('id', sectionAId)
    .single();

  assert(!secErr && !!sectionA, '2nd Year Section A retrieved', {
    sectionId: sectionA?.id,
    sectionName: sectionA?.name,
  });

  // Subject: Mathematics IV (BAS303)
  const { data: mathSubject, error: subErr } = await supabase
    .from('subjects')
    .select('*')
    .eq('subject_code', 'BAS303')
    .single();

  assert(!subErr && !!mathSubject, 'Mathematics IV (BAS303) subject retrieved', {
    subjectId: mathSubject?.id,
    code: mathSubject?.subject_code,
  });

  const subjectId = mathSubject.id;

  // Timetable entry: Wednesday Period 2 (09:50-10:40)
  const { data: ttEntry, error: ttErr } = await supabase
    .from('timetable_entries')
    .select('*')
    .eq('section_id', sectionAId)
    .eq('subject_id', subjectId)
    .eq('day_of_week', 'WED')
    .eq('period_number', 2)
    .single();

  assert(!ttErr && !!ttEntry, 'Wednesday Period 2 Timetable Entry retrieved', {
    ttId: ttEntry?.id,
    day: ttEntry?.day_of_week,
    time: `${ttEntry?.start_time} - ${ttEntry?.end_time}`,
  });

  const timetableEntryId = ttEntry.id;
  const sessionDate = '2026-09-16'; // Wednesday 16/09/2026

  // Fetch active students enrolled in Section A
  const { data: sectionStudents, error: stuErr } = await supabase
    .from('students')
    .select('id, full_name, roll_number, active')
    .eq('section_id', sectionAId)
    .eq('active', true)
    .order('roll_number', { ascending: true });

  assert(!stuErr && !!sectionStudents && sectionStudents.length >= 50, 'Active students enrolled in Section A loaded', {
    count: sectionStudents?.length,
  });

  const totalEnrolled = sectionStudents!.length;
  console.log(`  Total enrolled active students in Section A: ${totalEnrolled}`);

  // PRE-CLEANUP: Remove any existing test session for this exact slot and date
  const { data: existingSessions } = await supabase
    .from('attendance_sessions')
    .select('id')
    .eq('section_id', sectionAId)
    .eq('session_date', sessionDate)
    .eq('subject_id', subjectId);

  if (existingSessions && existingSessions.length > 0) {
    for (const es of existingSessions) {
      await supabase.from('attendance_records').delete().eq('attendance_session_id', es.id);
      await supabase.from('attendance_sessions').delete().eq('id', es.id);
    }
  }

  // TEST A: EMPTY CLASS BASELINE
  console.log('\n▶ TEST A: Empty Class Baseline (Zero Records, 0% Progress)...');
  const { data: sessionsAfterClean } = await supabase
    .from('attendance_sessions')
    .select('*')
    .eq('section_id', sectionAId)
    .eq('session_date', sessionDate)
    .eq('subject_id', subjectId);

  assert(!sessionsAfterClean || sessionsAfterClean.length === 0, 'No session exists initially for 16/09/2026');

  // TEST B: MARK 1 STUDENT PRESENT & SAVE (PARTIAL ATTENDANCE)
  console.log('\n▶ TEST B: Mark 1 Student Present, Leave Rest Unmarked & Save...');
  const firstStudent = sectionStudents![0];
  const partialRecords = sectionStudents!.map((s, idx) => ({
    studentId: s.id,
    status: (idx === 0 ? 'Present' : 'Unmarked') as ('Present' | 'Unmarked'),
  }));

  const saveResultB = await supabaseService.saveAttendance({
    timetableEntryId,
    facultyId,
    sectionId: sectionAId,
    subjectId,
    sessionDate,
    startTime: '09:50',
    endTime: '10:40',
    studentRecords: partialRecords,
  });

  assert(!!saveResultB?.session?.id, 'Session created and returned successfully by saveAttendance');
  const sessionId = saveResultB.session.id;

  // Direct database verification for Test B
  const { data: recordsInDbB } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('attendance_session_id', sessionId);

  assert(recordsInDbB?.length === 1, 'Exactly 1 record persisted in attendance_records', {
    expected: 1,
    actual: recordsInDbB?.length,
  });

  assert(recordsInDbB![0].student_id === firstStudent.id && recordsInDbB![0].status === 'Present', 
    'Persisted record correctly matches marked student and Present status', {
      studentId: recordsInDbB![0].student_id,
      status: recordsInDbB![0].status,
    }
  );

  const presentCountInDbB = recordsInDbB!.filter(r => r.status === 'Present').length;
  const absentCountInDbB = recordsInDbB!.filter(r => r.status === 'Absent').length;

  assert(
    presentCountInDbB === 1 && 
    absentCountInDbB === 0 && 
    saveResultB.stats.present_count === 1 && 
    saveResultB.stats.absent_count === 0, 
    'Session records and RPC stats accurately reflect 1 Present and 0 Absent', {
      present: presentCountInDbB,
      absent: absentCountInDbB,
      rpcPresent: saveResultB.stats.present_count,
      rpcAbsent: saveResultB.stats.absent_count,
    }
  );

  // TEST C: REFRESH / RELOAD DATA FROM SUPABASE
  console.log('\n▶ TEST C: Refresh / Reload Verification from Supabase...');
  const fetchResultC = await supabaseService.fetchAttendance();
  const foundSessionC = fetchResultC.attendanceSessions.find(s => s.id === sessionId);
  const foundRecordsC = fetchResultC.attendanceRecords.filter(r => r.attendance_session_id === sessionId);

  assert(!!foundSessionC, 'Session retrieved via fetchAttendance()');
  assert(foundRecordsC.length === 1, 'Single Present record retrieved via fetchAttendance()');
  assert(foundRecordsC[0].student_id === firstStudent.id && foundRecordsC[0].status === 'Present', 
    'Retrieved record has student and Present status intact'
  );

  // TEST D: MARK REMAINING 53 STUDENTS ABSENT & UPDATE
  console.log('\n▶ TEST D: Mark Remaining Students Absent & Save Complete Sheet...');
  const fullRecords = sectionStudents!.map((s, idx) => ({
    studentId: s.id,
    status: (idx === 0 ? 'Present' : 'Absent') as ('Present' | 'Absent'),
  }));

  const saveResultD = await supabaseService.saveAttendance({
    timetableEntryId,
    facultyId,
    sectionId: sectionAId,
    subjectId,
    sessionDate,
    startTime: '09:50',
    endTime: '10:40',
    studentRecords: fullRecords,
  });

  assert(saveResultD.session.id === sessionId, 'Existing session was updated in-place without creating duplicate', {
    originalSessionId: sessionId,
    updatedSessionId: saveResultD.session.id,
  });

  const { data: recordsInDbD } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('attendance_session_id', sessionId);

  assert(recordsInDbD?.length === totalEnrolled, `All ${totalEnrolled} active students now have records in database`, {
    expected: totalEnrolled,
    actual: recordsInDbD?.length,
  });

  const presentCountD = recordsInDbD!.filter(r => r.status === 'Present').length;
  const absentCountD = recordsInDbD!.filter(r => r.status === 'Absent').length;

  assert(presentCountD === 1 && absentCountD === totalEnrolled - 1, 
    `Exact breakdown verified: 1 Present, ${totalEnrolled - 1} Absent, 0 Unmarked (100% complete)`, {
      present: presentCountD,
      absent: absentCountD,
    }
  );

  // TEST E: SESSION RELINK & TIMETABLE ENTRY INTEGRITY
  console.log('\n▶ TEST E: Foreign Key & Relational Integrity Verification...');
  const { data: sessionWithJoins } = await supabase
    .from('attendance_sessions')
    .select('*, section:sections(name), subject:subjects(subject_code), faculty:faculty(full_name)')
    .eq('id', sessionId)
    .single();

  assert(sessionWithJoins?.timetable_entry_id === timetableEntryId, 'Linked timetable_entry_id matches exactly');
  assert(sessionWithJoins?.section?.name === 'A' || sessionWithJoins?.section?.name?.includes('A'), 'Linked section matches Section A');
  assert(sessionWithJoins?.subject?.subject_code === 'BAS303', 'Linked subject matches BAS303');
  assert(sessionWithJoins?.faculty?.full_name?.includes('Naseem'), 'Linked faculty matches Dr. Naseem');

  // TEST F: SECTION ISOLATION (SECTION B ISOLATED)
  console.log('\n▶ TEST F: Section Isolation Verification...');
  const sectionBId = '233957c0-4fef-42c6-8285-40ebf73ea6b7';
  const { data: sectionBStudents } = await supabase
    .from('students')
    .select('id')
    .eq('section_id', sectionBId);

  const sectionBStudentIds = new Set(sectionBStudents?.map(s => s.id) || []);
  const recordsInSessionA = recordsInDbD || [];
  const contaminatedWithSecB = recordsInSessionA.some(r => sectionBStudentIds.has(r.student_id));

  assert(!contaminatedWithSecB, 'Zero students from Section B are present in Section A session records');

  const { data: sectionBWithTtA } = await supabase
    .from('attendance_sessions')
    .select('*')
    .eq('section_id', sectionBId)
    .eq('timetable_entry_id', timetableEntryId);

  assert(!sectionBWithTtA || sectionBWithTtA.length === 0, 
    'Section B is completely isolated: 0 sessions created with Section A timetable entry'
  );

  // TEST G: DATE ISOLATION (ANOTHER DATE HAS ZERO RECORDS FOR THIS ENTRY)
  console.log('\n▶ TEST G: Date Isolation Verification...');
  const otherDate = '2026-09-17';
  const { data: otherDateSessions } = await supabase
    .from('attendance_sessions')
    .select('*')
    .eq('section_id', sectionAId)
    .eq('session_date', otherDate)
    .eq('subject_id', subjectId);

  assert(!otherDateSessions || otherDateSessions.length === 0, 
    `Date 2026-09-17 is completely isolated: 0 sessions exist for alternate date`
  );

  // TEST H: DUPLICATE SAVE PREVENTION
  console.log('\n▶ TEST H: Duplicate Save Prevention...');
  const saveResultH = await supabaseService.saveAttendance({
    timetableEntryId,
    facultyId,
    sectionId: sectionAId,
    subjectId,
    sessionDate,
    startTime: '09:50',
    endTime: '10:40',
    studentRecords: fullRecords,
  });

  assert(saveResultH.session.id === sessionId, 'Re-saving the same sheet reused existing session ID');

  const { data: allMatchingSessions } = await supabase
    .from('attendance_sessions')
    .select('id')
    .eq('section_id', sectionAId)
    .eq('session_date', sessionDate)
    .eq('subject_id', subjectId);

  assert(allMatchingSessions?.length === 1, 'Exactly 1 session row exists in database (zero duplicate sessions)', {
    count: allMatchingSessions?.length,
  });

  // TEST I: ERROR HANDLING & VALIDATION GUARDS
  console.log('\n▶ TEST I: Error Handling & Security Validation Guards...');
  
  // Future date rejection
  let futureDateThrew = false;
  try {
    await supabaseService.saveAttendance({
      timetableEntryId,
      facultyId,
      sectionId: sectionAId,
      subjectId,
      sessionDate: '2099-01-01',
      startTime: '09:50',
      endTime: '10:40',
      studentRecords: [{ studentId: firstStudent.id, status: 'Present' }],
    });
  } catch (err: any) {
    futureDateThrew = true;
    console.log(`  ✓ Future date correctly rejected with: "${err.message}"`);
  }
  assert(futureDateThrew, 'Future attendance date submission was rejected');

  // Invalid student rejection
  let invalidStudentThrew = false;
  try {
    await supabaseService.saveAttendance({
      timetableEntryId,
      facultyId,
      sectionId: sectionAId,
      subjectId,
      sessionDate,
      startTime: '09:50',
      endTime: '10:40',
      studentRecords: [{ studentId: '00000000-0000-0000-0000-000000000000', status: 'Present' }],
    });
  } catch (err: any) {
    invalidStudentThrew = true;
    console.log(`  ✓ Un-enrolled student correctly rejected with: "${err.message}"`);
  }
  assert(invalidStudentThrew, 'Un-enrolled student submission was rejected');

  // TEST J: AUDIT LOG VERIFICATION (AS AUTHORIZED CENTRAL ADMINISTRATOR)
  console.log('\n▶ TEST J: Audit Trail Verification (Authenticating as Administrator)...');
  await supabase.auth.signInWithPassword({
    email: 'admin@vctm.in',
    password: 'VctmAdmin@2026',
  });

  const { data: auditLogs } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('entity_id', sessionId)
    .eq('action', 'ATTENDANCE_RECORDED')
    .order('created_at', { ascending: false });

  assert(!!auditLogs && auditLogs.length > 0, 'Audit trail logged in audit_logs table for attendance saves', {
    logCount: auditLogs?.length,
    lastAction: auditLogs?.[0]?.action,
    actorName: auditLogs?.[0]?.actor_name,
    loggedSessionDate: auditLogs?.[0]?.new_values?.sessionDate,
    loggedPresent: auditLogs?.[0]?.new_values?.presentCount,
  });

  console.log('\n================================================================================');
  console.log(`🎉 ALL ${passedAssertions}/${totalAssertions} ASSERTIONS PASSED SUCCESSFULLY!`);
  console.log('VCTM ERP ATTENDANCE PERSISTENCE ENGINE FULLY VERIFIED ON LIVE SUPABASE');
  console.log('================================================================================');
}

runAttendancePersistenceE2ETest().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
