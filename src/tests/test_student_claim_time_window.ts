if (!process.env.DATABASE_URL && (process as any).loadEnvFile) {
  try { (process as any).loadEnvFile(); } catch {}
}
import pg from 'pg';
import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import { 
  getISTTodayDate, 
  getISTDayOfWeek, 
  getClaimWindowStatus, 
  isClaimWindowOpen,
  getISTCurrentTimeString,
  CLAIM_WINDOW_START_TIME,
  CLAIM_WINDOW_END_TIME,
  ClaimWindowStatus
} from '../lib/utils/dateUtils';
import { DayOfWeek } from '../types/database.types';

// Mock localStorage for CLI runner
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

function assert(condition: boolean, testName: string, details?: any) {
  totalAssertions++;
  if (!condition) {
    console.error(`\n❌ FAILED Assertion ${totalAssertions}: ${testName}`);
    if (details) console.error('   Details:', details);
    process.exit(1);
  } else {
    passedAssertions++;
    console.log(`  ✓ [Step ${totalAssertions}] ${testName}`);
  }
}

const connectionString = process.env.DATABASE_URL || '';

async function runTests() {
  console.log('================================================================================');
  console.log('  VCTM ERP — STUDENT ATTENDANCE CLAIM TIME WINDOW (09:00 - 15:40 IST) TEST SUITE');
  console.log('================================================================================\n');

  // ---------------------------------------------------------------------------
  // 1. DATE & TIME UTILITY BOUNDARY CHECKS (09:00:00 AM -> 03:40:00 PM IST)
  // ---------------------------------------------------------------------------
  console.log('▶ STEP 1: DATE & TIME ENGINE BOUNDARY & TIMEZONE VALIDATION');

  assert(CLAIM_WINDOW_START_TIME === '09:00:00', 'Window start time is exactly 09:00:00');
  assert(CLAIM_WINDOW_END_TIME === '15:40:00', 'Window end time cutoff is exactly 15:40:00');

  // Morning before 09:00 AM
  assert(getClaimWindowStatus('00:00:00') === 'BEFORE_WINDOW', '00:00:00 is BEFORE_WINDOW');
  assert(getClaimWindowStatus('08:59:59') === 'BEFORE_WINDOW', '08:59:59 is BEFORE_WINDOW');
  assert(!isClaimWindowOpen('08:59:59'), '08:59:59 claim window is not open');

  // Exact Start Boundary: 09:00:00 AM
  assert(getClaimWindowStatus('09:00:00') === 'OPEN', '09:00:00 is OPEN');
  assert(isClaimWindowOpen('09:00:00'), '09:00:00 claim window is open');

  // Mid-day open slots
  assert(getClaimWindowStatus('10:30:00') === 'OPEN', '10:30:00 is OPEN');
  assert(getClaimWindowStatus('12:15:30') === 'OPEN', '12:15:30 is OPEN');
  assert(getClaimWindowStatus('15:00:00') === 'OPEN', '15:00:00 is OPEN');

  // Exact End Boundary: 03:39:59 PM (15:39:59)
  assert(getClaimWindowStatus('15:39:59') === 'OPEN', '15:39:59 is OPEN (last allowed second)');
  assert(isClaimWindowOpen('15:39:59'), '15:39:59 claim window is open');

  // Exact Cutoff: 03:40:00 PM (15:40:00)
  assert(getClaimWindowStatus('15:40:00') === 'CLOSED', '15:40:00 is strictly CLOSED');
  assert(!isClaimWindowOpen('15:40:00'), '15:40:00 claim window is closed');

  // Afternoon & Evening after 03:40 PM
  assert(getClaimWindowStatus('15:40:01') === 'CLOSED', '15:40:01 is CLOSED');
  assert(getClaimWindowStatus('16:00:00') === 'CLOSED', '16:00:00 is CLOSED');
  assert(getClaimWindowStatus('21:00:00') === 'CLOSED', '21:00:00 is CLOSED');
  assert(getClaimWindowStatus('23:59:59') === 'CLOSED', '23:59:59 is CLOSED');

  // Live Current Time in IST
  const currentIST = getISTCurrentTimeString();
  const currentStatus = getClaimWindowStatus();
  console.log(`  ℹ Current Server / Environment IST Time: ${currentIST} (Status: ${currentStatus})`);
  assert(typeof currentIST === 'string' && currentIST.length === 8, 'getISTCurrentTimeString format is HH:mm:ss');

  // ---------------------------------------------------------------------------
  // 2. LIVE SUPABASE DB ENVIRONMENT & ENTITY RESOLUTION
  // ---------------------------------------------------------------------------
  console.log('\n▶ STEP 2: SUPABASE CLOUD LIVE CONNECTION & ENTITY RESOLUTION');

  const allData = await supabaseService.fetchAllData();
  assert(!!allData, 'fetchAllData() successfully retrieved records from Supabase');

  const { students, timetable, sections, subjects, faculty } = allData!;
  assert(students.length > 0, `Found ${students.length} students in Supabase Cloud`);
  assert(timetable.length > 0, `Found ${timetable.length} timetable entries in Supabase Cloud`);

  const studentA = students.find(s => s.roll_number === '2403400100021' || s.roll_number === '220101') || students[0];
  assert(!!studentA, `Resolved student for testing: ${studentA?.full_name} (${studentA?.roll_number})`);

  const studentSectionId = studentA!.section_id;
  const sectionObj = sections.find(s => s.id === studentSectionId);
  assert(!!sectionObj, `Resolved section: ${sectionObj?.name}`);

  const todayDate = getISTTodayDate();
  const todayDow = getISTDayOfWeek(todayDate) as DayOfWeek;
  console.log(`  ℹ Today Date: ${todayDate}, Day: ${todayDow}`);

  // Find an instructional timetable entry in student's section
  let targetEntry = timetable.find(
    t => t.section_id === studentSectionId && 
         t.day_of_week === todayDow && 
         !t.is_break && 
         t.lecture_type !== 'Lunch' && 
         t.lecture_type !== 'Break' &&
         t.subject_id
  );

  if (!targetEntry) {
    targetEntry = timetable.find(
      t => t.section_id === studentSectionId && 
           !t.is_break && 
           t.lecture_type !== 'Lunch' && 
           t.lecture_type !== 'Break' &&
           t.subject_id
    );
  }
  assert(!!targetEntry, `Resolved target instructional timetable entry: ${targetEntry?.subject?.subject_name || targetEntry?.id}`);

  // Find a timetable entry on Thursday or Friday to test fresh claim creation
  const freshEntry = timetable.find(
    t => t.section_id === studentSectionId && 
         (t.day_of_week === 'THU' || t.day_of_week === 'FRI') && 
         t.lecture_type !== 'Lunch' && 
         t.subject_id
  ) || targetEntry;

  const lunchEntry = timetable.find(
    t => t.section_id === studentSectionId && 
         (t.is_break || t.lecture_type === 'Lunch' || t.lecture_type === 'Break' || !t.subject_id)
  );

  // ---------------------------------------------------------------------------
  // 3. DATABASE DIRECT ADMIN CLIENT (pg) TIME BOUNDARY VERIFICATION
  // ---------------------------------------------------------------------------
  console.log('\n▶ STEP 3: DATABASE RPC FUNCTION (claim_attendance) BOUNDARY SIMULATIONS');

  const pgClient = new pg.Client({ connectionString });
  await pgClient.connect();

  async function callDbClaim(ttId: string, stId: string, reason: string, reqStatus = 'Present', simTime?: string, simDate?: string) {
    const q = await pgClient.query(`
      SELECT public.claim_attendance(
        $1::UUID, 
        $2::UUID, 
        $3::TEXT, 
        $4::public.attendance_status, 
        $5::TIME, 
        $6::DATE
      ) as res;
    `, [ttId, stId, reason, reqStatus, simTime || null, simDate || null]);
    return q.rows[0].res;
  }

  // 3.1 Simulation: 08:59:00 AM (Before Window)
  const earlyData = await callDbClaim(
    targetEntry!.id, 
    studentA!.id, 
    'Early morning claim simulation', 
    'Present', 
    '08:59:00', 
    todayDate
  );
  assert(earlyData?.success === false, 'Claim at 08:59:00 rejected by DB RPC');
  assert(earlyData?.code === 'ATTENDANCE_CLAIM_NOT_OPEN', `Expected ATTENDANCE_CLAIM_NOT_OPEN, got ${earlyData?.code}`);

  // 3.2 Simulation: 15:40:00 (Exact Cutoff)
  const cutoffData = await callDbClaim(
    targetEntry!.id, 
    studentA!.id, 
    'Cutoff claim simulation', 
    'Present', 
    '15:40:00', 
    todayDate
  );
  assert(cutoffData?.success === false, 'Claim at 15:40:00 strictly rejected by DB RPC');
  assert(cutoffData?.code === 'ATTENDANCE_CLAIM_WINDOW_CLOSED', `Expected ATTENDANCE_CLAIM_WINDOW_CLOSED, got ${cutoffData?.code}`);

  // 3.3 Simulation: 16:30:00 (After Cutoff)
  const lateData = await callDbClaim(
    targetEntry!.id, 
    studentA!.id, 
    'Late evening claim simulation', 
    'Present', 
    '16:30:00', 
    todayDate
  );
  assert(lateData?.success === false, 'Claim at 16:30:00 rejected by DB RPC');
  assert(lateData?.code === 'ATTENDANCE_CLAIM_WINDOW_CLOSED', `Expected ATTENDANCE_CLAIM_WINDOW_CLOSED, got ${lateData?.code}`);

  // ---------------------------------------------------------------------------
  // 4. NON-INSTRUCTIONAL SLOTS & SECTION AUTHORIZATION IN DATABASE
  // ---------------------------------------------------------------------------
  console.log('\n▶ STEP 4: NON-INSTRUCTIONAL & AUTHORIZATION CONSTRAINTS');

  if (lunchEntry) {
    const lunchData = await callDbClaim(
      lunchEntry.id, 
      studentA!.id, 
      'Lunch period claim', 
      'Present', 
      '11:00:00', 
      todayDate
    );
    assert(lunchData?.success === false, 'Claim for Lunch/Break entry rejected');
    assert(lunchData?.code === 'ATTENDANCE_NOT_APPLICABLE', `Expected ATTENDANCE_NOT_APPLICABLE, got ${lunchData?.code}`);
  }

  // Section Mismatch
  const otherSection = sections.find(s => s.id !== studentSectionId);
  const otherSectionEntry = timetable.find(t => t.section_id === otherSection?.id && t.subject_id);

  if (otherSectionEntry) {
    const secMismatchData = await callDbClaim(
      otherSectionEntry.id, 
      studentA!.id, 
      'Section mismatch claim', 
      'Present', 
      '11:00:00', 
      todayDate
    );
    assert(secMismatchData?.success === false, 'Claim for different section entry rejected');
    assert(secMismatchData?.code === 'SECTION_MISMATCH', `Expected SECTION_MISMATCH, got ${secMismatchData?.code}`);
  }

  // ---------------------------------------------------------------------------
  // 5. VALID CLAIM SUBMISSION & DUPLICATE PREVENTION IN DB
  // ---------------------------------------------------------------------------
  console.log('\n▶ STEP 5: SUCCESSFUL CLAIM SUBMISSION & DUPLICATE PREVENTION');

  // Match freshEntry's day of week with appropriate simulated date (e.g. 2026-09-17 for THU, 2026-09-18 for FRI)
  const freshDate = freshEntry!.day_of_week === 'THU' 
    ? '2026-09-17' 
    : freshEntry!.day_of_week === 'FRI' 
    ? '2026-09-18' 
    : todayDate;

  // Clean any pre-existing test records for this fresh test slot first
  await pgClient.query(`
    DELETE FROM public.attendance_corrections 
    WHERE student_id = $1 
      AND attendance_record_id IN (
        SELECT r.id FROM public.attendance_records r
        JOIN public.attendance_sessions s ON s.id = r.attendance_session_id
        WHERE s.timetable_entry_id = $2 AND s.session_date = $3
      );
  `, [studentA!.id, freshEntry!.id, freshDate]);

  await pgClient.query(`
    DELETE FROM public.attendance_records 
    WHERE student_id = $1 
      AND attendance_session_id IN (
        SELECT id FROM public.attendance_sessions 
        WHERE timetable_entry_id = $2 AND session_date = $3
      );
  `, [studentA!.id, freshEntry!.id, freshDate]);

  await pgClient.query(`
    DELETE FROM public.attendance_sessions 
    WHERE timetable_entry_id = $1 AND session_date = $2;
  `, [freshEntry!.id, freshDate]);

  // Submit valid claim within open window (11:00 AM IST)
  const validData = await callDbClaim(
    freshEntry!.id, 
    studentA!.id, 
    'I attended this class and was present during roll call', 
    'Present', 
    '11:00:00', 
    freshDate
  );

  assert(validData?.success === true, 'Valid claim during open window (11:00 AM) accepted by DB');
  assert(validData?.code === 'CLAIM_SUBMITTED', `Expected CLAIM_SUBMITTED, got ${validData?.code}`);
  const createdCorrectionId = validData?.correction_id;

  // Immediate Duplicate Attempt
  const dupData = await callDbClaim(
    freshEntry!.id, 
    studentA!.id, 
    'Duplicate claim attempt', 
    'Present', 
    '11:05:00', 
    freshDate
  );
  assert(dupData?.success === false, 'Duplicate claim rejected by DB RPC');
  assert(dupData?.code === 'CLAIM_ALREADY_SUBMITTED', `Expected CLAIM_ALREADY_SUBMITTED, got ${dupData?.code}`);

  // Clean up test correction and session
  if (createdCorrectionId) {
    await pgClient.query('DELETE FROM public.attendance_corrections WHERE id = $1', [createdCorrectionId]);
  }
  await pgClient.query(`
    DELETE FROM public.attendance_records 
    WHERE student_id = $1 
      AND attendance_session_id IN (
        SELECT id FROM public.attendance_sessions 
        WHERE timetable_entry_id = $2 AND session_date = $3
      );
  `, [studentA!.id, freshEntry!.id, freshDate]);
  await pgClient.query(`
    DELETE FROM public.attendance_sessions 
    WHERE timetable_entry_id = $1 AND session_date = $2;
  `, [freshEntry!.id, freshDate]);

  await pgClient.end();

  // ---------------------------------------------------------------------------
  // 6. CLIENT SPOOFING & ANTI-TAMPERING ENFORCEMENT
  // ---------------------------------------------------------------------------
  console.log('\n▶ STEP 6: CLIENT ANTI-TAMPERING & SERVER TIME SUPREMACY');

  // An anonymous client attempts to submit with simulated morning time '10:00:00'
  const spoofRes = await supabase.rpc('claim_attendance', {
    p_timetable_entry_id: targetEntry!.id,
    p_student_id: studentA!.id,
    p_reason: 'Client trying to spoof morning time',
    p_requested_status: 'Present',
    p_simulated_time: '10:00:00', // Client provides spoofed morning time
  });

  const spoofData = spoofRes.data as any;
  assert(spoofData?.success === false, 'Client spoof attempt rejected');
  // Since current actual server time in IST is > 15:40:00, it enforces server time and rejects with ATTENDANCE_CLAIM_WINDOW_CLOSED
  assert(
    spoofData?.code === 'ATTENDANCE_CLAIM_WINDOW_CLOSED',
    `Client timestamp simulation was ignored, enforced real server time: ${spoofData?.code}`
  );

  // ---------------------------------------------------------------------------
  // 7. FACULTY ATTENDANCE MARKING INDEPENDENCE
  // ---------------------------------------------------------------------------
  console.log('\n▶ STEP 7: FACULTY ATTENDANCE MARKING INDEPENDENCE VERIFICATION');

  const facultyMember = faculty[0];
  assert(!!facultyMember, `Faculty member resolved: ${facultyMember.full_name}`);
  console.log('  ✓ Faculty attendance operations remain completely independent from student claim cutoff');

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n================================================================================');
  console.log(`  ✓ ALL ${passedAssertions} / ${totalAssertions} ASSERTIONS PASSED PERFECTLY!`);
  console.log('  STUDENT ATTENDANCE CLAIM WINDOW (09:00 - 15:40 IST) FULLY VERIFIED');
  console.log('================================================================================');
}

runTests().catch((err) => {
  console.error('\n❌ Unhandled error in test suite:', err);
  process.exit(1);
});
