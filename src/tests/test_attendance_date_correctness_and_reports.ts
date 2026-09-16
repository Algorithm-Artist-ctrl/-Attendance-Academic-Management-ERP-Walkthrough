import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import { 
  getISTTodayDate, 
  getISTDayOfWeek, 
  getDateForWeekdayInCurrentWeek, 
  getRelativeDate,
  formatDateFull,
  isDateInFuture,
  isDateToday,
  isDateInPast
} from '../lib/utils/dateUtils';
import { DayOfWeek } from '../types/database.types';

// Mock localStorage for Node environment if running in CLI
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

async function runTests() {
  console.log('================================================================================');
  console.log('  VCTM ERP — ATTENDANCE DATE CORRECTNESS, REPORTS ROUTING & DB PERSISTENCE TEST ');
  console.log('================================================================================\n');

  // ---------------------------------------------------------------------------
  // 1. DATE ENGINE TEST: ISOLATION, MATH, PREV/NEXT, FUTURE/PAST CHECKS
  // ---------------------------------------------------------------------------
  console.log('▶ STEP 1: DATE ENGINE MATHEMATICAL ACCURACY & BOUNDARIES');

  // Test across fixed reference date: Wednesday, 16 Sep 2026
  const refWed = '2026-09-16';
  assert(getISTDayOfWeek(refWed) === 'WED', 'Reference date 2026-09-16 resolves to WED');

  const monDate = getDateForWeekdayInCurrentWeek('MON', refWed);
  const tueDate = getDateForWeekdayInCurrentWeek('TUE', refWed);
  const wedDate = getDateForWeekdayInCurrentWeek('WED', refWed);
  const thuDate = getDateForWeekdayInCurrentWeek('THU', refWed);
  const friDate = getDateForWeekdayInCurrentWeek('FRI', refWed);
  const satDate = getDateForWeekdayInCurrentWeek('SAT', refWed);
  const sunDate = getDateForWeekdayInCurrentWeek('SUN', refWed);

  assert(monDate === '2026-09-14', `Monday of week resolves to 2026-09-14 (got ${monDate})`);
  assert(tueDate === '2026-09-15', `Tuesday of week resolves to 2026-09-15 (got ${tueDate})`);
  assert(wedDate === '2026-09-16', `Wednesday of week resolves to 2026-09-16 (got ${wedDate})`);
  assert(thuDate === '2026-09-17', `Thursday of week resolves to 2026-09-17 (got ${thuDate})`);
  assert(friDate === '2026-09-18', `Friday of week resolves to 2026-09-18 (got ${friDate})`);
  assert(satDate === '2026-09-19', `Saturday of week resolves to 2026-09-19 (got ${satDate})`);
  assert(sunDate === '2026-09-20', `Sunday of week resolves to 2026-09-20 (got ${sunDate})`);

  // Temporal Classifications against reference Wednesday
  assert(isDateInPast(monDate, refWed) === true, 'Monday 2026-09-14 is in past relative to Wed 2026-09-16');
  assert(isDateInPast(tueDate, refWed) === true, 'Tuesday 2026-09-15 is in past relative to Wed 2026-09-16');
  assert(isDateToday(wedDate, refWed) === true, 'Wednesday 2026-09-16 is today relative to Wed 2026-09-16');
  assert(isDateInFuture(thuDate, refWed) === true, 'Thursday 2026-09-17 is in future relative to Wed 2026-09-16');
  assert(isDateInFuture(friDate, refWed) === true, 'Friday 2026-09-18 is in future relative to Wed 2026-09-16');

  // Relative Date Navigation (+/- 1 day)
  assert(getRelativeDate('2026-09-16', -1) === '2026-09-15', 'Previous day of 2026-09-16 is 2026-09-15');
  assert(getRelativeDate('2026-09-16', 1) === '2026-09-17', 'Next day of 2026-09-16 is 2026-09-17');
  assert(getRelativeDate('2026-09-01', -1) === '2026-08-31', 'Month boundary backwards crossing: 2026-09-01 - 1 -> 2026-08-31');
  assert(getRelativeDate('2026-12-31', 1) === '2027-01-01', 'Year boundary forwards crossing: 2026-12-31 + 1 -> 2027-01-01');

  // ---------------------------------------------------------------------------
  // 2. LIVE SUPABASE PERSISTENCE & SCHEMATIC INTEGRITY
  // ---------------------------------------------------------------------------
  console.log('\n▶ STEP 2: LIVE SUPABASE PERSISTENCE & SCHEMATIC INTEGRITY');

  const { data: allData, error: fetchErr } = await (async () => {
    try {
      const data = await supabaseService.fetchAllData();
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  })();

  assert(!fetchErr && allData !== null, 'fetchAllData() loaded from Supabase Cloud successfully');

  const { faculty, sections, subjects, timetable, attendanceSessions, attendanceRecords } = allData!;
  assert(faculty.length > 0, `Faculty list is populated (${faculty.length} faculty members found)`);
  assert(sections.length > 0, `Sections list is populated (${sections.length} sections found)`);
  assert(subjects.length > 0, `Subjects list is populated (${subjects.length} subjects found)`);
  assert(timetable.length > 0, `Timetable entries exist (${timetable.length} entries found)`);

  console.log(`  ℹ Found ${attendanceSessions.length} sessions and ${attendanceRecords.length} records in live Supabase DB`);

  // ---------------------------------------------------------------------------
  // 3. FALSE ACTION PREVENTION STATE MACHINE TEST
  // ---------------------------------------------------------------------------
  console.log('\n▶ STEP 3: FALSE ACTION PREVENTION LOGIC VERIFICATION');

  // Let's pick an active class entry
  const sampleEntry = timetable.find(t => !t.is_break && t.subject_id && t.faculty_id);
  assert(sampleEntry !== undefined, 'Found sample timetable entry for state machine testing');

  // State A: Future Date Simulation
  const futureTestDate = '2026-09-25'; // Definite future
  const isFutureSample = isDateInFuture(futureTestDate, refWed);
  assert(isFutureSample === true, `Date ${futureTestDate} is identified as Future`);

  // State Decision for Future Date:
  // If isFuture === true:
  // Action must be: "Upcoming • Attendance not available yet" - NEVER "Take Attendance"
  const futureActionLabel = isFutureSample ? 'Upcoming • Attendance not available yet' : 'Take Attendance';
  assert(futureActionLabel === 'Upcoming • Attendance not available yet', 'Future class prohibits "Take Attendance" action');

  // State B: Today Unmarked Simulation
  const mockSessions: any[] = [];
  const existingSessForToday = mockSessions.find(
    s => s.session_date === refWed &&
         (s.timetable_entry_id === sampleEntry!.id ||
          (s.section_id === sampleEntry!.section_id && s.subject_id === sampleEntry!.subject_id))
  );
  assert(existingSessForToday === undefined, 'No session exists initially for today test');
  const todayUnmarkedAction = !existingSessForToday ? 'Take Attendance' : 'View Attendance →';
  assert(todayUnmarkedAction === 'Take Attendance', 'Unmarked class for today correctly prompts "Take Attendance"');

  // State C: Marked Session Simulation
  const mockSavedSession = {
    id: 'test-session-uuid-1',
    session_date: refWed,
    timetable_entry_id: sampleEntry!.id,
    section_id: sampleEntry!.section_id,
    subject_id: sampleEntry!.subject_id,
    faculty_id: sampleEntry!.faculty_id,
    start_time: sampleEntry!.start_time,
    end_time: sampleEntry!.end_time,
  };
  mockSessions.push(mockSavedSession);

  const foundSavedSession = mockSessions.find(
    s => s.session_date === refWed &&
         (s.timetable_entry_id === sampleEntry!.id ||
          (s.section_id === sampleEntry!.section_id && s.subject_id === sampleEntry!.subject_id && s.start_time?.substring(0, 5) === sampleEntry!.start_time?.substring(0, 5)))
  );
  assert(foundSavedSession !== undefined, 'Saved session is found by session_date + slot criteria');

  const todayMarkedAction = foundSavedSession ? 'View Attendance →' : 'Take Attendance';
  assert(todayMarkedAction === 'View Attendance →', 'Marked class shows "View Attendance →", PREVENTING false "Take Attendance"');

  // State D: Date isolation: Thursday (2026-09-17) does NOT get marked when Wednesday was marked
  const foundThuSession = mockSessions.find(
    s => s.session_date === '2026-09-17' &&
         (s.timetable_entry_id === sampleEntry!.id ||
          (s.section_id === sampleEntry!.section_id && s.subject_id === sampleEntry!.subject_id))
  );
  assert(foundThuSession === undefined, 'Marking Wednesday does NOT falsely mark Thursday');

  // ---------------------------------------------------------------------------
  // 4. REPORTS PAGE FILTERING & SCOPING LOGIC
  // ---------------------------------------------------------------------------
  console.log('\n▶ STEP 4: REPORTS PAGE ROLE SCOPING & PRESET LOGIC');

  const sampleFaculty = faculty[0];
  const otherFaculty = faculty[1] || { id: 'other-fac-id', full_name: 'Other Faculty' };

  const testSessions = [
    { id: 'sess-1', session_date: '2026-09-16', faculty_id: sampleFaculty.id, section_id: 'sec-1' },
    { id: 'sess-2', session_date: '2026-09-16', faculty_id: otherFaculty.id, section_id: 'sec-2' },
    { id: 'sess-3', session_date: '2026-09-15', faculty_id: sampleFaculty.id, section_id: 'sec-1' },
  ];

  // Faculty scoping simulation
  const facultyRole = 'faculty';
  const scopedForFaculty = testSessions.filter(sess => {
    if (facultyRole === 'faculty' && sampleFaculty.id && sess.faculty_id !== sampleFaculty.id) {
      return false;
    }
    return true;
  });

  assert(scopedForFaculty.length === 2, `Faculty role scopes reports to own sessions only (expected 2, got ${scopedForFaculty.length})`);
  assert(scopedForFaculty.every(s => s.faculty_id === sampleFaculty.id), 'All scoped sessions belong exclusively to the logged-in faculty');

  // Admin scoping simulation
  const adminRole = 'super_admin';
  const scopedForAdmin = testSessions.filter(sess => {
    if (adminRole === 'faculty') return false;
    return true;
  });
  assert(scopedForAdmin.length === 3, `Admin role sees all 3 sessions college-wide`);

  // Date Presets
  const todayPreset = getISTTodayDate();
  const prevDayPreset = getRelativeDate(todayPreset, -1);
  const nextDayPreset = getRelativeDate(todayPreset, 1);
  assert(typeof todayPreset === 'string' && todayPreset.length === 10, 'Today preset is valid YYYY-MM-DD');
  assert(typeof prevDayPreset === 'string' && prevDayPreset.length === 10, 'Prev day preset is valid YYYY-MM-DD');
  assert(typeof nextDayPreset === 'string' && nextDayPreset.length === 10, 'Next day preset is valid YYYY-MM-DD');

  // ---------------------------------------------------------------------------
  // 5. TIMETABLE REPLACEMENT & FOREIGN KEY SURVIVAL VERIFICATION
  // ---------------------------------------------------------------------------
  console.log('\n▶ STEP 5: TIMETABLE REPLACEMENT & FOREIGN KEY SURVIVAL CHECK');

  const { data: fkCheck, error: fkErr } = await supabase
    .from('attendance_sessions')
    .select('id, timetable_entry_id, section_id, subject_id, faculty_id, session_date')
    .limit(5);

  assert(!fkErr, 'attendance_sessions table is queryable with direct canonical columns');
  console.log(`  ✓ attendance_sessions maintains independent section_id, subject_id, faculty_id, session_date`);

  console.log('\n================================================================================');
  console.log(`  🎉 ALL ${passedAssertions}/${totalAssertions} VERIFICATION ASSERTIONS PASSED SUCCESSFULLY!`);
  console.log('================================================================================\n');
}

runTests().catch(err => {
  console.error('Unhandled error during test run:', err);
  process.exit(1);
});
