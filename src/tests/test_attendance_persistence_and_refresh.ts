import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import { AttendanceStatus } from '../types/database.types';

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

async function runAttendancePersistenceTest() {
  console.log('================================================================================');
  console.log('🧪 VCTM ERP: FACULTY ATTENDANCE PERSISTENCE & FULL-RANGE REFRESH SUITE');
  console.log('================================================================================\n');

  const testSessionIdsToCleanup: string[] = [];

  try {
    // --------------------------------------------------------------------------
    // STEP 1: AUTHENTICATE AS FACULTY
    // --------------------------------------------------------------------------
    console.log('▶ STEP 1: AUTHENTICATING AS FACULTY (Ms. Hemlata Chaudhry)');
    const facultyEmail = 'hemlata.cse@vctm.in';
    const facultyPass = 'faculty@123';

    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: facultyEmail,
      password: facultyPass,
    });

    assert(!authErr && !!authData.user, 'Faculty authenticated with Supabase Auth', {
      userId: authData.user?.id,
      email: authData.user?.email,
      error: authErr?.message,
    });

    const facultyUserId = authData.user!.id;

    // Retrieve faculty profile
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

    // --------------------------------------------------------------------------
    // STEP 2: VERIFY PAGINATED FULL-RANGE REFRESH (>1,000 RECORDS)
    // --------------------------------------------------------------------------
    console.log('\n▶ STEP 2: VERIFYING PAGINATED FULL-RANGE REFRESH (NO 1,000-ROW CUTOFF)');
    const { attendanceSessions, attendanceRecords } = await supabaseService.fetchAttendance();

    console.log(`   Database returned ${attendanceRecords.length} attendance records and ${attendanceSessions.length} sessions.`);
    assert(
      attendanceRecords.length > 1000,
      `fetchAttendance() successfully fetches ALL records past 1,000 rows (Fetched: ${attendanceRecords.length})`,
      { count: attendanceRecords.length }
    );
    assert(
      attendanceSessions.length >= 40,
      `fetchAttendance() retrieved all active sessions (Fetched: ${attendanceSessions.length})`,
      { count: attendanceSessions.length }
    );

    // Verify fetchOperationalData also fetches complete attendance
    const opData = await supabaseService.fetchOperationalData();
    assert(
      !!opData && opData.attendanceRecords.length > 1000,
      `fetchOperationalData() returns full attendance records without truncation (Fetched: ${opData?.attendanceRecords.length})`
    );

    // --------------------------------------------------------------------------
    // STEP 3: DIRECT SESSION FETCH CAPABILITY
    // --------------------------------------------------------------------------
    console.log('\n▶ STEP 3: VERIFYING TARGETED SESSION FETCH CAPABILITY');
    const sampleSession = attendanceSessions.find(s => {
      const recs = attendanceRecords.filter(r => r.attendance_session_id === s.id);
      return recs.length > 0;
    });
    assert(!!sampleSession, 'Found an existing attendance session with records');

    if (sampleSession) {
      const directRecords = await supabaseService.fetchSessionAttendanceRecords(sampleSession.id);
      const cachedRecords = attendanceRecords.filter(r => r.attendance_session_id === sampleSession.id);
      assert(
        directRecords.length === cachedRecords.length && directRecords.length > 0,
        `fetchSessionAttendanceRecords correctly retrieves all ${directRecords.length} records for session directly from DB`,
        { directCount: directRecords.length, cachedCount: cachedRecords.length }
      );
    }

    // --------------------------------------------------------------------------
    // STEP 4: RECORD ATTENDANCE FOR AN ASSIGNED CLASS (e.g. 2nd Year Section A)
    // --------------------------------------------------------------------------
    console.log('\n▶ STEP 4: RECORDING ATTENDANCE FOR AN ASSIGNED CLASS');
    // Find an active class assigned to this faculty
    const { data: assignedClass, error: classErr } = await supabase
      .from('timetable_entries')
      .select('*, section:sections(*), subject:subjects(*)')
      .eq('faculty_id', facultyId)
      .eq('active', true)
      .limit(1)
      .single();

    assert(!classErr && !!assignedClass, 'Found active timetable class assigned to faculty', {
      subject: assignedClass?.subject?.subject_name,
      section: assignedClass?.section?.name,
    });

    const secA = assignedClass.section;
    const subjA = assignedClass.subject;
    const ttA = assignedClass;

    // Get active students for this section
    const { data: studentsA } = await supabase
      .from('students')
      .select('*')
      .eq('section_id', secA.id)
      .eq('active', true)
      .order('roll_number', { ascending: true });

    assert(!!studentsA && studentsA.length >= 3, `Section ${secA.name} has enrolled students (count: ${studentsA?.length})`);

    const todayISO = new Date().toISOString().split('T')[0];
    const stu1 = studentsA![0];
    const stu2 = studentsA![1];
    const stu3 = studentsA![2];

    // Mark stu1 = Present, stu2 = Absent, stu3 = Unmarked
    const payloadRecordsA = [
      { studentId: stu1.id, status: 'Present' as AttendanceStatus },
      { studentId: stu2.id, status: 'Absent' as AttendanceStatus },
      { studentId: stu3.id, status: 'Unmarked' as const },
    ];

    const saveResultA = await supabaseService.saveAttendance({
      timetableEntryId: ttA?.id,
      facultyId,
      sectionId: secA!.id,
      subjectId: subjA!.id,
      sessionDate: todayISO,
      startTime: '09:00:00',
      endTime: '09:50:00',
      studentRecords: payloadRecordsA,
    });

    assert(!!saveResultA?.session?.id, 'saveAttendance returned valid session ID', {
      sessionId: saveResultA?.session?.id,
    });

    assert(
      saveResultA.stats.record_count > 0,
      `saveAttendance stats returned valid saved record count (${saveResultA.stats.record_count} total records in session)`,
      saveResultA.stats
    );

    // --------------------------------------------------------------------------
    // STEP 5: DIRECT DATABASE VERIFICATION (EXPECTED VS ACTUAL IN POSTGRES)
    // --------------------------------------------------------------------------
    console.log('\n▶ STEP 5: VERIFYING SAVED RECORDS DIRECTLY IN DATABASE');
    const { data: dbRecordsA, error: dbErrA } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('attendance_session_id', saveResultA.session.id);

    assert(!dbErrA && !!dbRecordsA, 'Direct database query for session records succeeded');

    const dbStu1 = dbRecordsA!.find(r => r.student_id === stu1.id);
    const dbStu2 = dbRecordsA!.find(r => r.student_id === stu2.id);
    const dbStu3 = dbRecordsA!.find(r => r.student_id === stu3.id);

    assert(dbStu1?.status === 'Present', `Student 1 is persisted as "Present" in DB`);
    assert(dbStu2?.status === 'Absent', `Student 2 is persisted as "Absent" in DB`);
    assert(dbStu3 === undefined, `Student 3 (Unmarked) has ZERO rows in database`);

    // --------------------------------------------------------------------------
    // STEP 6: RE-FETCH & VERIFY ZERO-RESET TO UNMARKED
    // --------------------------------------------------------------------------
    console.log('\n▶ STEP 6: VERIFYING RE-FETCH & UI STATE RECONSTRUCTION');
    const refetched = await supabaseService.fetchAttendance();
    const sessionInRefetched = refetched.attendanceSessions.find(s => s.id === saveResultA.session.id);
    assert(!!sessionInRefetched, 'Saved session found in full refetched attendanceSessions');

    const recordsInRefetched = refetched.attendanceRecords.filter(r => r.attendance_session_id === saveResultA.session.id);
    assert(
      recordsInRefetched.length === dbRecordsA!.length,
      `Full refetched attendanceRecords contains all ${recordsInRefetched.length} records for the newly saved session (NOT truncated!)`,
      { count: recordsInRefetched.length }
    );

    // Simulate UI reconstruction in TakeAttendancePage:
    const reconstructedMap: Record<string, string> = {};
    studentsA!.forEach(s => {
      const found = recordsInRefetched.find(r => r.student_id === s.id);
      reconstructedMap[s.id] = found ? found.status : 'Unmarked';
    });

    assert(
      reconstructedMap[stu1.id] === 'Present',
      `UI Reconstruction: Student 1 displays "Present" upon reopening (DID NOT return to Unmarked)`
    );
    assert(
      reconstructedMap[stu2.id] === 'Absent',
      `UI Reconstruction: Student 2 displays "Absent" upon reopening (DID NOT return to Unmarked)`
    );

    // --------------------------------------------------------------------------
    // STEP 7: UPDATE / EDIT EXISTING ATTENDANCE SESSION
    // --------------------------------------------------------------------------
    console.log('\n▶ STEP 7: UPDATING EXISTING ATTENDANCE (ABSENT -> PRESENT)');
    // Change Student 2 from Absent to Present
    const updatePayload = [
      { studentId: stu1.id, status: 'Present' as AttendanceStatus },
      { studentId: stu2.id, status: 'Present' as AttendanceStatus }, // mutated!
      { studentId: stu3.id, status: 'Unmarked' as const },
    ];

    const prevPresentCount = saveResultA.stats.present_count;

    const updateResult = await supabaseService.saveAttendance({
      timetableEntryId: ttA?.id,
      facultyId,
      sectionId: secA!.id,
      subjectId: subjA!.id,
      sessionDate: todayISO,
      startTime: '09:00:00',
      endTime: '09:50:00',
      studentRecords: updatePayload,
    });

    assert(
      updateResult.session.id === saveResultA.session.id,
      'Same session updated atomically (no duplicate session created)'
    );
    assert(
      updateResult.stats.present_count >= prevPresentCount,
      `Updated session stats reflect mutation from Absent to Present (Present: ${updateResult.stats.present_count})`,
      updateResult.stats
    );

    const directUpdatedRecords = await supabaseService.fetchSessionAttendanceRecords(saveResultA.session.id);
    const updatedStu2 = directUpdatedRecords.find(r => r.student_id === stu2.id);
    assert(updatedStu2?.status === 'Present', 'Student 2 status was successfully updated in DB from Absent to Present');

    // --------------------------------------------------------------------------
    // STEP 8: MULTIPLE LECTURES ON SAME DATE (DISTINCT SLOTS)
    // --------------------------------------------------------------------------
    console.log('\n▶ STEP 8: MULTIPLE LECTURES ON SAME DATE WITH DISTINCT SLOTS');
    // Save attendance for a second period (11:30 - 12:20) on same date
    const secondSlotResult = await supabaseService.saveAttendance({
      facultyId,
      sectionId: secA!.id,
      subjectId: subjA!.id,
      sessionDate: todayISO,
      startTime: '11:30:00',
      endTime: '12:20:00',
      studentRecords: [
        { studentId: stu1.id, status: 'Absent' as AttendanceStatus },
        { studentId: stu2.id, status: 'Absent' as AttendanceStatus },
      ],
    });

    assert(
      secondSlotResult.session.id !== saveResultA.session.id,
      'Second lecture period on same date creates a DISTINCT attendance session',
      { session1: saveResultA.session.id, session2: secondSlotResult.session.id }
    );
    testSessionIdsToCleanup.push(secondSlotResult.session.id);

    // Verify first session's records are untouched
    const firstSessionCheck = await supabaseService.fetchSessionAttendanceRecords(saveResultA.session.id);
    const secondSessionCheck = await supabaseService.fetchSessionAttendanceRecords(secondSlotResult.session.id);

    const firstStu1 = firstSessionCheck.find(r => r.student_id === stu1.id);
    const firstStu2 = firstSessionCheck.find(r => r.student_id === stu2.id);
    assert(
      firstStu1?.status === 'Present' && firstStu2?.status === 'Present',
      'First lecture period records for stu1 and stu2 remain untouched (both Present)'
    );
    assert(
      secondSessionCheck.every(r => r.status === 'Absent'),
      'Second lecture period records are distinct (all Absent)'
    );

    // --------------------------------------------------------------------------
    // STEP 9: VERIFY MULTI-YEAR COMPATIBILITY (3RD YEAR / 4TH YEAR)
    // --------------------------------------------------------------------------
    console.log('\n▶ STEP 9: VERIFYING MULTI-YEAR COMPATIBILITY');
    const { data: allSections } = await supabase
      .from('sections')
      .select('*, semester:semesters(*, academic_year:academic_years(*))')
      .eq('active', true);

    const yearSet = new Set(allSections?.map(s => s.semester?.academic_year?.year_number).filter(Boolean));
    console.log(`   Active academic years found in system: ${Array.from(yearSet).sort().join(', ')}`);
    assert(yearSet.size >= 2, `System has multi-year sections configured (${yearSet.size} years active)`);

  } finally {
    // --------------------------------------------------------------------------
    // CLEANUP TEST SESSIONS
    // --------------------------------------------------------------------------
    console.log('\n▶ CLEANUP: REMOVING TEST SESSIONS CREATED DURING RUN');
    for (const sId of testSessionIdsToCleanup) {
      try {
        await supabaseService.deleteAttendanceSession(sId);
        console.log(`   Cleaned up test session: ${sId}`);
      } catch (err: any) {
        console.warn(`   Failed to delete test session ${sId}:`, err.message);
      }
    }
  }

  console.log('\n================================================================================');
  console.log(`🎉 ALL ${passedAssertions} / ${totalAssertions} ASSERTIONS PASSED SUCCESSFULLY!`);
  console.log('================================================================================\n');
}

runAttendancePersistenceTest().catch(err => {
  console.error('\n❌ Unhandled error in attendance persistence test:', err);
  process.exit(1);
});
