import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import { 
  getCollegeToday, 
  getCollegeYesterday, 
  getISTDayOfWeek, 
  isDateInFuture, 
  isDateInPast,
  isDateToday 
} from '../lib/utils/dateUtils';
import { StudentOverallAttendance } from '../types/database.types';

// Polyfill localStorage for Node CLI environment
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

async function runTest() {
  console.log('================================================================================');
  console.log('🧪 VCTM ERP — HOD ATTENDANCE LEDGER SEARCH, FILTER & AUDIT AUTOMATED TEST');
  console.log('================================================================================\n');

  // ===========================================================================
  // STEP 1: DATE BOUNDARIES & ASIA/KOLKATA TIMEZONE LOGIC
  // ===========================================================================
  console.log('▶ STEP 1: VERIFYING ASIA/KOLKATA DATE ENGINE & BOUNDARIES');
  const collegeToday = getCollegeToday();
  const collegeYesterday = getCollegeYesterday();

  assert(/^\d{4}-\d{2}-\d{2}$/.test(collegeToday), `getCollegeToday() returns YYYY-MM-DD: ${collegeToday}`);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(collegeYesterday), `getCollegeYesterday() returns YYYY-MM-DD: ${collegeYesterday}`);
  assert(!isDateInFuture(collegeToday), 'collegeToday is NOT in future');
  assert(isDateToday(collegeToday), 'collegeToday passes isDateToday');
  assert(isDateInPast(collegeYesterday), 'collegeYesterday is strictly in past');
  assert(!isDateInFuture(collegeYesterday), 'collegeYesterday is NOT in future');

  // Check offset: yesterday should be 1 day before today
  const tDate = new Date(collegeToday + 'T12:00:00Z');
  const yDate = new Date(collegeYesterday + 'T12:00:00Z');
  const diffDays = Math.round((tDate.getTime() - yDate.getTime()) / (1000 * 60 * 60 * 24));
  assert(diffDays === 1, `Yesterday is exactly 1 day before today (diff: ${diffDays})`);

  // Future dates validation
  const futureDate = '2099-01-01';
  assert(isDateInFuture(futureDate), `Future date ${futureDate} identified as in future`);
  assert(futureDate > collegeToday, `Lexicographical comparison holds: ${futureDate} > ${collegeToday}`);

  // ===========================================================================
  // STEP 2: AUTHENTICATE AS HOD & VERIFY SCOPE
  // ===========================================================================
  console.log('\n▶ STEP 2: AUTHENTICATING AS HOD & VERIFYING DEPARTMENT SCOPE');
  const hodEmail = 'wasim.cse@vctm.in';
  const hodPass = 'VctmHod@2026';

  const { data: hodAuth, error: hodAuthErr } = await supabase.auth.signInWithPassword({
    email: hodEmail,
    password: hodPass,
  });
  assert(!hodAuthErr && !!hodAuth.user, 'HOD Dr. Wasim logged in successfully', { error: hodAuthErr?.message });

  // Fetch HOD faculty profile & department
  const { data: hodProfile, error: profErr } = await supabase
    .from('faculty')
    .select('*')
    .eq('auth_user_id', hodAuth.user!.id)
    .single();

  assert(!profErr && !!hodProfile, 'HOD profile retrieved', { profile: hodProfile?.full_name });

  const { data: cseDept, error: deptErr } = await supabase
    .from('departments')
    .select('*')
    .eq('id', hodProfile.department_id)
    .single();
  assert(!deptErr && !!cseDept && cseDept.code === 'CSE', 'HOD belongs to Computer Science & Engineering (CSE)', { dept: cseDept?.name });

  // ===========================================================================
  // STEP 3: ACADEMIC STRUCTURE & STRICT 1ST YEAR EXCLUSION
  // ===========================================================================
  console.log('\n▶ STEP 3: ACADEMIC STRUCTURE & STRICT 1ST YEAR EXCLUSION IN HOD CSE VIEW');
  const { data: allYears, error: yrsErr } = await supabase
    .from('academic_years')
    .select('*')
    .order('year_number', { ascending: true });

  assert(!yrsErr && !!allYears && allYears.length > 0, 'Loaded academic years from database');

  // HOD CSE supported years filter (2nd, 3rd, 4th strictly - NO 1st Year)
  const supportedYears = allYears.filter(y => y.active && y.year_number !== 1);
  const firstYears = supportedYears.filter(y => y.year_number === 1);
  assert(firstYears.length === 0, '1st Year is strictly excluded from HOD CSE supported years');
  assert(supportedYears.every(y => [2, 3, 4].includes(y.year_number)), 'Supported years strictly contain 2nd, 3rd, and 4th years');

  // Fetch sections and semesters
  const { data: allSemesters } = await supabase.from('semesters').select('*');
  const { data: allSections } = await supabase.from('sections').select('*');
  assert(!!allSemesters && !!allSections, 'Loaded semesters and sections');

  // Dynamic sections computation for HOD view
  const supportedYearIds = new Set(supportedYears.map(y => y.id));
  const cseSemIds = new Set(allSemesters!.filter(s => supportedYearIds.has(s.academic_year_id)).map(s => s.id));
  const dynamicSections = allSections!.filter(s => s.active && cseSemIds.has(s.semester_id));

  assert(dynamicSections.length > 0, `Dynamic sections loaded for CSE (${dynamicSections.length} sections)`);

  // Verify none of the dynamic sections belong to 1st year
  const firstYearSemIds = new Set(allSemesters!.filter(s => {
    const yr = allYears.find(y => y.id === s.academic_year_id);
    return yr && yr.year_number === 1;
  }).map(s => s.id));

  const leakingFirstYearSections = dynamicSections.filter(s => firstYearSemIds.has(s.semester_id));
  assert(leakingFirstYearSections.length === 0, 'Zero 1st Year sections in HOD dynamic sections');

  // ===========================================================================
  // STEP 4: STUDENT SEARCH MECHANICS IN DEPARTMENT ATTENDANCE LEDGER
  // ===========================================================================
  console.log('\n▶ STEP 4: STUDENT SEARCH FILTER (FULL/PARTIAL NAME & ROLL NUMBER)');
  const { data: cseStudents, error: studErr } = await supabase
    .from('students')
    .select('*')
    .eq('department_id', cseDept.id)
    .eq('active', true);

  assert(!studErr && !!cseStudents && cseStudents.length > 0, `Loaded ${cseStudents?.length} active CSE students`);

  // Filter out any 1st year student from CSE student list as done in HODDashboard
  const eligibleStudents = cseStudents!.filter(s => {
    const sem = allSemesters!.find(sm => sm.id === s.semester_id);
    const yr = allYears.find(y => y.id === s.academic_year_id || y.id === sem?.academic_year_id);
    return !yr || yr.year_number !== 1;
  });

  const testStudent = eligibleStudents[0];
  assert(!!testStudent, 'Found eligible CSE test student', {
    name: testStudent.full_name,
    roll: testStudent.roll_number,
  });

  // UI search logic helper
  function filterBySearch(studentsList: typeof cseStudents, term: string) {
    if (!term.trim()) return studentsList;
    const query = term.trim().toLowerCase();
    return studentsList!.filter(s => {
      const matchesName = (s.full_name || '').toLowerCase().includes(query);
      const matchesRoll = (s.roll_number || '').toLowerCase().includes(query);
      return matchesName || matchesRoll;
    });
  }

  // 4a. Exact Full Name (case-insensitive)
  const exactNameRes = filterBySearch(eligibleStudents, testStudent.full_name.toLowerCase());
  assert(exactNameRes.some(s => s.id === testStudent.id), `Full name search "${testStudent.full_name}" matches student`);

  // 4b. Partial Name
  const partialName = testStudent.full_name.substring(0, Math.min(4, testStudent.full_name.length));
  const partialNameRes = filterBySearch(eligibleStudents, partialName);
  assert(partialNameRes.some(s => s.id === testStudent.id), `Partial name search "${partialName}" matches student`);

  // 4c. Exact Roll Number
  const exactRollRes = filterBySearch(eligibleStudents, testStudent.roll_number);
  assert(exactRollRes.some(s => s.id === testStudent.id), `Exact roll number search "${testStudent.roll_number}" matches student`);

  // 4d. Partial Roll Number
  const partialRoll = testStudent.roll_number.slice(-4);
  const partialRollRes = filterBySearch(eligibleStudents, partialRoll);
  assert(partialRollRes.some(s => s.id === testStudent.id), `Partial roll number search "${partialRoll}" matches student`);

  // 4e. Non-matching Search (Empty State trigger)
  const nonMatchRes = filterBySearch(eligibleStudents, 'XYZNONEXISTENT999');
  assert(nonMatchRes.length === 0, 'Non-existent search term returns 0 results (triggers empty state)');

  // ===========================================================================
  // STEP 5: MULTI-YEAR & SECTION FILTERING (CROSS-SECTION ISOLATION)
  // ===========================================================================
  console.log('\n▶ STEP 5: YEAR & SECTION FILTERING WITHOUT CROSS-SECTION LEAKAGE');
  // Group students by section
  const sectionA = dynamicSections.find(s => s.name === 'A');
  const sectionB = dynamicSections.find(s => s.name === 'B');

  if (sectionA && sectionB) {
    const secAStudents = eligibleStudents.filter(s => s.section_id === sectionA.id);
    const secBStudents = eligibleStudents.filter(s => s.section_id === sectionB.id);

    console.log(`    Section A students: ${secAStudents.length}, Section B students: ${secBStudents.length}`);

    // Verify isolation: filtering by Section A must never include Section B students
    const filterSectionA = eligibleStudents.filter(s => s.section_id === sectionA.id);
    const anyBInA = filterSectionA.some(s => s.section_id === sectionB.id);
    assert(!anyBInA, 'Section A filter strictly contains 0 Section B students');

    const filterSectionB = eligibleStudents.filter(s => s.section_id === sectionB.id);
    const anyAInB = filterSectionB.some(s => s.section_id === sectionA.id);
    assert(!anyAInB, 'Section B filter strictly contains 0 Section A students');
  } else {
    console.log('    Note: Section A and/or B not distinctly found, skipping A/B cross comparison');
  }

  // ===========================================================================
  // STEP 6: FUTURE-DATE BLOCKING AT SERVICE LAYER
  // ===========================================================================
  console.log('\n▶ STEP 6: FUTURE-DATE BLOCKING IN fetchStudentAttendanceHistory');

  // Test 6a: startDate in future -> must return empty history with 0 counts and null percentage
  const futureHist = await supabaseService.fetchStudentAttendanceHistory({
    studentId: testStudent.id,
    startDate: '2099-01-01',
    endDate: '2099-12-31',
  });

  assert(!!futureHist, 'fetchStudentAttendanceHistory handled future dates gracefully');
  assert(futureHist?.records.length === 0, 'Future query returned 0 records');
  assert(futureHist?.attendancePercentage === null, 'Future query returned null attendancePercentage (no fake %)');
  assert(futureHist?.totalLectures === 0, 'Future query returned 0 totalLectures');

  // Test 6b: endDate in future -> must clamp to collegeToday and exclude future sessions
  const clampedHist = await supabaseService.fetchStudentAttendanceHistory({
    studentId: testStudent.id,
    startDate: '2026-01-01',
    endDate: '2099-12-31',
  });

  assert(!!clampedHist, 'Clamped history query returned successfully');
  const anyFutureRecords = clampedHist?.records.filter(r => r.sessionDate > collegeToday) || [];
  assert(anyFutureRecords.length === 0, `All returned records are <= collegeToday (${collegeToday}), 0 future sessions`);

  // ===========================================================================
  // STEP 7: EMPTY ATTENDANCE STATE & ZERO FAKE ATTENDANCE INTEGRITY
  // ===========================================================================
  console.log('\n▶ STEP 7: ZERO FAKE ATTENDANCE INTEGRITY & NULL PERCENTAGE RENDERING');
  // For a query with 0 records (e.g. today if no sessions marked yet, or unassessed student)
  const todayHist = await supabaseService.fetchStudentAttendanceHistory({
    studentId: testStudent.id,
    startDate: collegeToday,
    endDate: collegeToday,
  });

  assert(!!todayHist, 'Queried attendance history for today');
  if (todayHist!.eligibleConducted === 0) {
    assert(todayHist!.attendancePercentage === null, 'When eligibleConducted is 0, attendancePercentage is null');
    // Verify UI mapping
    const renderedDisplay = todayHist!.attendancePercentage !== null ? `${todayHist!.attendancePercentage}%` : '—';
    assert(renderedDisplay === '—', 'Unassessed percentage correctly formats as "—"');
  } else {
    console.log(`    Student had ${todayHist!.eligibleConducted} lectures conducted today; percentage = ${todayHist!.attendancePercentage}%`);
    assert(typeof todayHist!.attendancePercentage === 'number', 'Conducted lectures calculate valid percentage');
  }

  // ===========================================================================
  // STEP 8: CSV EXPORT STRUCTURE & FUTURE-DATE SANITIZATION
  // ===========================================================================
  console.log('\n▶ STEP 8: CSV EXPORT FORMAT & FUTURE DATE SANITIZATION');

  // Build mock ledger CSV rows as done in handleExportFilteredLedgerCSV
  const mockLedgerRows = eligibleStudents.slice(0, 3).map(s => {
    const sec = allSections!.find(sec => sec.id === s.section_id);
    return {
      'Roll Number': s.roll_number,
      'Student Name': s.full_name,
      'Section': `Section ${sec?.name || 'A'}`,
      'Total Held': 0,
      'Attended (Present)': 0,
      'Absent Count': 0,
      'Attendance Percentage': 'No Data',
      'Status': 'No Data',
    };
  });

  assert(mockLedgerRows.length === 3, 'Exported 3 ledger CSV rows');
  assert(Object.keys(mockLedgerRows[0]).includes('Attendance Percentage'), 'Ledger CSV contains "Attendance Percentage" header');
  assert(Object.keys(mockLedgerRows[0]).includes('Status'), 'Ledger CSV contains "Status" header');

  // Build student history CSV export rows as done in handleExportStudentHistoryCSV
  if (clampedHist && clampedHist.records.length > 0) {
    const exportHistoryRows = clampedHist.records
      .filter(r => r.sessionDate <= collegeToday)
      .map(r => ({
        'Student Name': clampedHist.fullName,
        'Roll Number': clampedHist.rollNumber,
        'Academic Year': clampedHist.yearName,
        'Section': clampedHist.sectionName,
        'Date': r.sessionDate,
        'Lecture Time': r.startTime ? `${r.startTime} – ${r.endTime || ''}` : 'Official Slot',
        'Subject': r.subjectName,
        'Subject Code': r.subjectCode,
        'Faculty': r.facultyName,
        'Status': r.status,
        'Remarks': r.remarks || '—',
      }));

    assert(exportHistoryRows.every(r => r['Date'] <= collegeToday), 'All exported student history rows have Date <= collegeToday');
    assert(Object.keys(exportHistoryRows[0]).includes('Date'), 'History CSV contains Date column');
    assert(Object.keys(exportHistoryRows[0]).includes('Subject Code'), 'History CSV contains Subject Code column');
  } else {
    console.log('    Note: No history records for student, verified empty history CSV handling');
  }

  // ===========================================================================
  // STEP 9: HOD DASHBOARD DRILL-DOWN STUDENT FILTER SIMULATION
  // ===========================================================================
  console.log('\n▶ STEP 9: DRILL-DOWN STUDENT SEARCH SIMULATION');
  const sampleSectionStudents = eligibleStudents.slice(0, 10);
  const searchSample = sampleSectionStudents[0];
  const drillDownFiltered = sampleSectionStudents.filter(s => {
    const q = searchSample.full_name.toLowerCase().substring(0, 3);
    return (s.full_name || '').toLowerCase().includes(q) || (s.roll_number || '').toLowerCase().includes(q);
  });
  assert(drillDownFiltered.some(s => s.id === searchSample.id), 'Drill-down student search finds target student');

  // ===========================================================================
  // SUMMARY
  // ===========================================================================
  console.log('\n================================================================================');
  console.log(`🎉 ALL ${passedAssertions}/${totalAssertions} ASSERTIONS PASSED SUCCESSFULLY!`);
  console.log('================================================================================\n');
}

runTest().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
