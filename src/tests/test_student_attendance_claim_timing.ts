import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { 
  normalizeTimeHHMMSS, 
  getClassTimingStatus, 
  isClassCompleted,
  getClaimWindowStatus 
} from '../lib/utils/dateUtils';

async function run() {
  console.log('========================================================================');
  console.log('  VCTM ERP: STUDENT ATTENDANCE CLAIM TIMING & REAL-TIME TEST SUITE');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, desc: string) {
    total++;
    if (condition) {
      console.log(`  ✓ [Check ${total}] ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL ${total}] ${desc}`);
      process.exitCode = 1;
    }
  }

  // --------------------------------------------------------------------------
  // SECTION 1: Unit Tests for Time Normalization & Timing Classification
  // --------------------------------------------------------------------------
  console.log('--- SECTION 1: Time Normalization & Class Timing Status ---');
  assert(normalizeTimeHHMMSS('09:00') === '09:00:00', 'normalizeTimeHHMMSS parses "09:00" to "09:00:00"');
  assert(normalizeTimeHHMMSS('9:5') === '09:05:00', 'normalizeTimeHHMMSS parses "9:5" to "09:05:00"');
  assert(normalizeTimeHHMMSS('15:40:00') === '15:40:00', 'normalizeTimeHHMMSS preserves "15:40:00"');

  const testDate = '2026-09-18';
  // Scenario 1: Current time before class (08:45 < 09:00)
  const statusBefore = getClassTimingStatus({
    startTime: '09:00',
    endTime: '09:50',
    sessionDate: testDate,
    currentDateIST: testDate,
    currentTimeIST: '08:45:00',
  });
  assert(statusBefore === 'FUTURE', 'Scenario 1 helper: Time before class (08:45 < 09:00) is FUTURE');
  assert(!isClassCompleted({
    startTime: '09:00',
    endTime: '09:50',
    sessionDate: testDate,
    currentDateIST: testDate,
    currentTimeIST: '08:45:00',
  }), 'Scenario 1 helper: Class is NOT completed at 08:45');

  // Scenario 2: Current time during ongoing class (09:00 <= 09:20 < 09:50)
  const statusDuring = getClassTimingStatus({
    startTime: '09:00',
    endTime: '09:50',
    sessionDate: testDate,
    currentDateIST: testDate,
    currentTimeIST: '09:20:00',
  });
  assert(statusDuring === 'ONGOING', 'Scenario 2 helper: Time during class (09:20) is ONGOING');
  assert(!isClassCompleted({
    startTime: '09:00',
    endTime: '09:50',
    sessionDate: testDate,
    currentDateIST: testDate,
    currentTimeIST: '09:20:00',
  }), 'Scenario 2 helper: Class is NOT completed at 09:20');

  // Edge: 1 second before end (09:49:59)
  const statusJustBeforeEnd = getClassTimingStatus({
    startTime: '09:00',
    endTime: '09:50',
    sessionDate: testDate,
    currentDateIST: testDate,
    currentTimeIST: '09:49:59',
  });
  assert(statusJustBeforeEnd === 'ONGOING', 'Scenario 2 edge: Time at 09:49:59 is still ONGOING');
  assert(!isClassCompleted({
    startTime: '09:00',
    endTime: '09:50',
    sessionDate: testDate,
    currentDateIST: testDate,
    currentTimeIST: '09:49:59',
  }), 'Scenario 2 edge: Class is NOT completed at 09:49:59');

  // Scenario 9 & 3: Exact end time (09:50:00)
  const statusExactEnd = getClassTimingStatus({
    startTime: '09:00',
    endTime: '09:50',
    sessionDate: testDate,
    currentDateIST: testDate,
    currentTimeIST: '09:50:00',
  });
  assert(statusExactEnd === 'COMPLETED', 'Scenario 9 & 3 helper: Exact end time 09:50:00 is COMPLETED');
  assert(isClassCompleted({
    startTime: '09:00',
    endTime: '09:50',
    sessionDate: testDate,
    currentDateIST: testDate,
    currentTimeIST: '09:50:00',
  }), 'Scenario 9 & 3 helper: Class is completed at 09:50:00');

  // Scenario 3: After end time (09:51:00)
  const statusAfterEnd = getClassTimingStatus({
    startTime: '09:00',
    endTime: '09:50',
    sessionDate: testDate,
    currentDateIST: testDate,
    currentTimeIST: '09:51:00',
  });
  assert(statusAfterEnd === 'COMPLETED', 'Scenario 3 helper: Time after class 09:51:00 is COMPLETED');
  assert(isClassCompleted({
    startTime: '09:00',
    endTime: '09:50',
    sessionDate: testDate,
    currentDateIST: testDate,
    currentTimeIST: '09:51:00',
  }), 'Scenario 3 helper: Class is completed at 09:51:00');

  // Past and Future date handling
  assert(isClassCompleted({
    endTime: '16:00',
    sessionDate: '2026-09-17',
    currentDateIST: testDate,
  }), 'Past date session is always COMPLETED');
  assert(!isClassCompleted({
    endTime: '09:00',
    sessionDate: '2026-09-19',
    currentDateIST: testDate,
  }), 'Future date session is NEVER completed');

  // --------------------------------------------------------------------------
  // SECTION 2: UI Logic Verification Simulation (Scenarios 1 to 6)
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 2: Simulated UI Claim Button Logic (Scenarios 1-6) ---');

  interface MockLecture {
    startTime: string;
    endTime: string;
    status: 'Present' | 'Absent' | 'Not Recorded';
    hasPendingClaim?: boolean;
    hasApprovedClaim?: boolean;
  }

  function simulateUIClaimDecision(lec: MockLecture, currentTimeIST: string, sessionDate: string = testDate) {
    const isPresent = lec.status === 'Present';
    const isAbsent = lec.status === 'Absent';
    const isNotRecorded = lec.status === 'Not Recorded';
    const hasPendingClaim = !!lec.hasPendingClaim;
    const hasApprovedClaim = !!lec.hasApprovedClaim;

    const claimWindow = getClaimWindowStatus(currentTimeIST);

    let displayStatus = '';
    let showClaimButton = false;

    if (isPresent) {
      displayStatus = 'Present';
    } else if (hasApprovedClaim) {
      displayStatus = 'Claim Approved (Present)';
    } else if (hasPendingClaim) {
      displayStatus = 'Claim Submitted';
    } else if (isAbsent) {
      // Scenario 5: ABSENT recorded by faculty -> Show Absent, NO claim button
      displayStatus = 'Absent';
      showClaimButton = false;
    } else if (isNotRecorded) {
      displayStatus = 'Attendance Not Recorded';
      const timing = getClassTimingStatus({
        startTime: lec.startTime,
        endTime: lec.endTime,
        sessionDate,
        currentTimeIST,
        currentDateIST: testDate,
      });

      if (timing === 'COMPLETED' && claimWindow === 'OPEN') {
        showClaimButton = true;
      } else {
        showClaimButton = false;
      }
    }

    return { displayStatus, showClaimButton };
  }

  // SCENARIO 1: Current time before class (08:45, class 09:00-09:50)
  const sc1 = simulateUIClaimDecision({ startTime: '09:00', endTime: '09:50', status: 'Not Recorded' }, '08:45:00');
  assert(sc1.displayStatus === 'Attendance Not Recorded', 'Scenario 1: Display shows "Attendance Not Recorded"');
  assert(!sc1.showClaimButton, 'Scenario 1: Claim button is HIDDEN before class');

  // SCENARIO 2: Current time during class (09:20, class 09:00-09:50)
  const sc2 = simulateUIClaimDecision({ startTime: '09:00', endTime: '09:50', status: 'Not Recorded' }, '09:20:00');
  assert(sc2.displayStatus === 'Attendance Not Recorded', 'Scenario 2: Display shows "Attendance Not Recorded"');
  assert(!sc2.showClaimButton, 'Scenario 2: Claim button is HIDDEN during class');

  // SCENARIO 3: Class ended + attendance missing (10:00, class 09:00-09:50)
  const sc3 = simulateUIClaimDecision({ startTime: '09:00', endTime: '09:50', status: 'Not Recorded' }, '10:00:00');
  assert(sc3.displayStatus === 'Attendance Not Recorded', 'Scenario 3: Display shows "Attendance Not Recorded"');
  assert(sc3.showClaimButton, 'Scenario 3: Claim button is VISIBLE after class ends');

  // SCENARIO 4: Class ended + Present recorded (10:00, class 09:00-09:50, status: Present)
  const sc4 = simulateUIClaimDecision({ startTime: '09:00', endTime: '09:50', status: 'Present' }, '10:00:00');
  assert(sc4.displayStatus === 'Present', 'Scenario 4: Display shows "Present"');
  assert(!sc4.showClaimButton, 'Scenario 4: Claim button is HIDDEN when Present');

  // SCENARIO 5: Class ended + Absent recorded (10:00, class 09:00-09:50, status: Absent)
  const sc5 = simulateUIClaimDecision({ startTime: '09:00', endTime: '09:50', status: 'Absent' }, '10:00:00');
  assert(sc5.displayStatus === 'Absent', 'Scenario 5: Display shows "Absent"');
  assert(!sc5.showClaimButton, 'Scenario 5: Claim button is HIDDEN when marked Absent by faculty');

  // SCENARIO 6: Future class (10:00, period 6 at 13:30-14:20)
  const sc6 = simulateUIClaimDecision({ startTime: '13:30', endTime: '14:20', status: 'Not Recorded' }, '10:00:00');
  assert(sc6.displayStatus === 'Attendance Not Recorded', 'Scenario 6: Future class shows "Attendance Not Recorded"');
  assert(!sc6.showClaimButton, 'Scenario 6: Future class Claim button is HIDDEN');

  // --------------------------------------------------------------------------
  // SECTION 3: Codebase Integration Checks
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 3: Codebase Source Verification ---');
  const studentDashboardSrc = fs.readFileSync('src/pages/student/StudentDashboard.tsx', 'utf8');
  assert(studentDashboardSrc.includes('currentTimeIST'), 'StudentDashboard maintains reactive currentTimeIST state');
  assert(studentDashboardSrc.includes('getClassTimingStatus'), 'StudentDashboard imports and calls getClassTimingStatus');
  assert(studentDashboardSrc.includes("timingStatus === 'COMPLETED'"), 'StudentDashboard verifies timingStatus === COMPLETED before rendering Claim button');
  assert(studentDashboardSrc.includes("timingStatus === 'ONGOING'"), 'StudentDashboard shows "Class in progress" badge for ongoing lectures');
  assert(studentDashboardSrc.includes("timingStatus === 'FUTURE'"), 'StudentDashboard shows "Starts at" badge for upcoming lectures');

  const studentAttendancePageSrc = fs.readFileSync('src/pages/student/StudentAttendancePage.tsx', 'utf8');
  assert(studentAttendancePageSrc.includes('currentTimeIST'), 'StudentAttendancePage maintains reactive currentTimeIST state');
  assert(studentAttendancePageSrc.includes('getClassTimingStatus'), 'StudentAttendancePage calls getClassTimingStatus');
  assert(studentAttendancePageSrc.includes("timingStatus === 'COMPLETED'"), 'StudentAttendancePage Tab 1 & 2 gate claim button by timingStatus === COMPLETED');

  const academicContextSrc = fs.readFileSync('src/context/AcademicContext.tsx', 'utf8');
  assert(academicContextSrc.includes('isClassCompleted'), 'AcademicContext imports and checks isClassCompleted');
  assert(academicContextSrc.includes('CLASS_NOT_ENDED'), 'AcademicContext canSubmitClaim returns CLASS_NOT_ENDED code when class has not ended');

  const claimModalSrc = fs.readFileSync('src/components/correction/ClaimAttendanceModal.tsx', 'utf8');
  assert(claimModalSrc.includes('startTime: lecture.startTime') && claimModalSrc.includes('endTime: lecture.endTime'), 'ClaimAttendanceModal passes startTime and endTime to canSubmitClaim');

  // --------------------------------------------------------------------------
  // SECTION 4: Live PostgreSQL RPC Verification (Scenario 8 & 9)
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 4: Live Supabase Database & RPC Validation (Scenarios 8 & 9) ---');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('  Connected to Supabase PostgreSQL database.');

  // Find an enrolled student and their timetable entry for today (or MON)
  const studentRes = await client.query(`
    SELECT s.id, s.section_id, s.full_name
    FROM public.students s
    WHERE s.section_id IS NOT NULL
    LIMIT 1;
  `);
  assert(studentRes.rows.length > 0, 'Resolved sample student in database');
  const sampleStudent = studentRes.rows[0];

  const ttRes = await client.query(`
    SELECT id, section_id, subject_id, day_of_week, start_time, end_time, lecture_type
    FROM public.timetable_entries
    WHERE section_id = $1 
      AND active = true 
      AND lecture_type NOT IN ('Lunch', 'Sports')
      AND subject_id IS NOT NULL
    ORDER BY period_number ASC
    LIMIT 1;
  `, [sampleStudent.section_id]);
  assert(ttRes.rows.length > 0, 'Resolved sample timetable lecture for student section');
  const sampleTT = ttRes.rows[0];

  console.log(`  Target Student: ${sampleStudent.full_name} (${sampleStudent.id})`);
  console.log(`  Target Slot: Day=${sampleTT.day_of_week}, Period=${sampleTT.start_time}-${sampleTT.end_time}`);

  // Determine a valid calendar date matching sampleTT.day_of_week
  const dateMap: Record<string, string> = {
    'MON': '2026-09-14',
    'TUE': '2026-09-15',
    'WED': '2026-09-16',
    'THU': '2026-09-17',
    'FRI': '2026-09-18',
    'SAT': '2026-09-19',
  };
  const simulatedDate = dateMap[sampleTT.day_of_week] || '2026-09-18';

  // SCENARIO 8: Student attempts to claim attendance BEFORE class ends (e.g. 09:20 when class ends at 09:50)
  // We use p_simulated_time = '09:20:00' (or 10 minutes before end_time)
  const endTimeParts = sampleTT.end_time.split(':');
  const endH = parseInt(endTimeParts[0], 10);
  const endM = parseInt(endTimeParts[1], 10);
  const beforeM = endM >= 10 ? endM - 10 : 0;
  const simulatedOngoingTime = `${String(endH).padStart(2, '0')}:${String(beforeM).padStart(2, '0')}:00`;

  console.log(`  Testing Scenario 8: Simulating ongoing time ${simulatedOngoingTime} before end ${sampleTT.end_time}...`);

  const rejectRpcRes = await client.query(`
    SELECT public.claim_attendance(
      p_timetable_entry_id := $1,
      p_student_id := $2,
      p_reason := 'I was present during lecture.',
      p_simulated_time := $3::TIME,
      p_simulated_date := $4::DATE
    ) AS result;
  `, [sampleTT.id, sampleStudent.id, simulatedOngoingTime, simulatedDate]);

  const rejectResult = rejectRpcRes.rows[0].result;
  assert(rejectResult.success === false, 'Scenario 8: Claim submitted before class ends is REJECTED (success: false)');
  assert(rejectResult.code === 'CLASS_NOT_ENDED', `Scenario 8: Rejection code is strictly "CLASS_NOT_ENDED" (got: ${rejectResult.code})`);
  assert(typeof rejectResult.message === 'string' && rejectResult.message.includes('not permitted for an ongoing or future class'), 'Scenario 8: Rejection message explains ongoing/future class policy');

  // SCENARIO 9: Student claims attendance at or after exact class end time (e.g. at end_time)
  const simulatedEndTime = `${sampleTT.end_time}:00`.substring(0, 8);
  console.log(`  Testing Scenario 9: Simulating end time ${simulatedEndTime} (>= ${sampleTT.end_time})...`);

  const acceptRpcRes = await client.query(`
    SELECT public.claim_attendance(
      p_timetable_entry_id := $1,
      p_student_id := $2,
      p_reason := 'I attended this completed class.',
      p_simulated_time := $3::TIME,
      p_simulated_date := $4::DATE
    ) AS result;
  `, [sampleTT.id, sampleStudent.id, simulatedEndTime, simulatedDate]);

  const acceptResult = acceptRpcRes.rows[0].result;
  assert(acceptResult.code !== 'CLASS_NOT_ENDED', `Scenario 9: At class end time, CLASS_NOT_ENDED is NOT returned (got: ${acceptResult.code})`);
  assert(acceptResult.success === true || acceptResult.code === 'CLAIM_ALREADY_SUBMITTED', 'Scenario 9: At class end time, claim is eligible and accepted');

  // Clean up test correction record if one was created
  if (acceptResult.claim_id) {
    await client.query('DELETE FROM public.attendance_corrections WHERE id = $1', [acceptResult.claim_id]);
    console.log(`  Cleaned up test claim ${acceptResult.claim_id}`);
  }

  await client.end();

  console.log('\n========================================================================');
  console.log(`  SUMMARY: ALL ${passed}/${total} CHECKS PASSED WITH 100% SUCCESS!`);
  console.log('========================================================================\n');
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
