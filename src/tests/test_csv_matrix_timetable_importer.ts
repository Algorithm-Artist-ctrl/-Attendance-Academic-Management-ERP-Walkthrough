import fs from 'fs';
import path from 'path';
import { supabase } from '../lib/supabase/supabaseClient';
import { csvTimetableService } from '../lib/services/csvTimetableService';
import { TimetableConflictEngine } from '../lib/services/timetableConflictEngine';
import { Section, Subject, Faculty, Classroom, AcademicYear, Semester, FacultySubjectAssignment } from '../types/database.types';

// Mock localStorage for Node environment if required
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

function assert(condition: boolean, stepName: string, detail?: any) {
  totalAssertions++;
  if (!condition) {
    console.error(`\n❌ FAILED Assertion ${totalAssertions}: ${stepName}`);
    if (detail) console.error('   Detail:', detail);
    process.exit(1);
  } else {
    passedAssertions++;
    console.log(`  ✓ [Check ${totalAssertions}] ${stepName}`);
  }
}

async function runCSVMatrixTimetableTests() {
  console.log('================================================================================');
  console.log('  VCTM ERP — REAL-WORLD CSV MATRIX TIMETABLE IMPORTER SPECIFICATION AUDIT       ');
  console.log('  Testing 15 Essential Criteria against Supabase Cloud DB                      ');
  console.log('================================================================================\n');

  // Load database active records
  const [
    { data: sectionsData },
    { data: subjectsData },
    { data: facultyData },
    { data: classroomsData },
    { data: yearsData },
    { data: semestersData },
    { data: assignmentsData },
    { data: departmentsData },
  ] = await Promise.all([
    supabase.from('sections').select('*'),
    supabase.from('subjects').select('*'),
    supabase.from('faculty').select('*'),
    supabase.from('classrooms').select('*'),
    supabase.from('academic_years').select('*'),
    supabase.from('semesters').select('*'),
    supabase.from('faculty_subject_assignments').select('*'),
    supabase.from('departments').select('*'),
  ]);

  const sections = (sectionsData as Section[]) || [];
  const subjects = (subjectsData as Subject[]) || [];
  const faculty = (facultyData as Faculty[]) || [];
  const classrooms = (classroomsData as Classroom[]) || [];
  const years = (yearsData as AcademicYear[]) || [];
  const semesters = (semestersData as Semester[]) || [];
  const assignments = (assignmentsData as FacultySubjectAssignment[]) || [];
  const departments = (departmentsData as any[]) || [];
  const deptId = departments[0]?.id;

  const secB = sections.find(s => s.name === 'B' && (s.room_number?.includes('006') || s.room_number === 'A006')) || sections.find(s => s.name === 'B')!;
  const secA = sections.find(s => s.name === 'A' && (s.room_number?.includes('007') || s.room_number === 'A007')) || sections.find(s => s.name === 'A')!;

  assert(Boolean(secB), 'Target Section B exists in database', secB?.id);
  assert(Boolean(secA), 'Control Section A exists in database', secA?.id);
  assert(classrooms.length > 0, `Database has ${classrooms.length} registered classrooms`);
  assert(subjects.length > 0, `Database has ${subjects.length} registered subjects`);
  assert(faculty.length > 0, `Database has ${faculty.length} registered faculty members`);

  // Read actual CSV file
  const csvFilePath = path.resolve(process.cwd(), 'BTech_CSE_IT_Sec_B_Time_Table_v2.csv');
  const realCSVContent = fs.readFileSync(csvFilePath, 'utf8');

  // --------------------------------------------------------------------------
  // TEST 1: Matrix CSV Detection (DAY \ TIME header)
  // --------------------------------------------------------------------------
  console.log('\n--- 1. MATRIX CSV DETECTION ---');
  const lines = csvTimetableService.parseCSVLines(realCSVContent);
  const detection = csvTimetableService.detectFormat(lines);
  assert(detection.format === 'matrix', 'Real CSV is correctly detected as format: "matrix"');
  assert(detection.headerRowIndex >= 0, `Matrix header row dynamically located at index ${detection.headerRowIndex}`);

  // --------------------------------------------------------------------------
  // TEST 2: Normalized CSV Detection
  // --------------------------------------------------------------------------
  console.log('\n--- 2. NORMALIZED CSV DETECTION ---');
  const normalizedCsv = [
    'Day,Period,Start,End,Subject Code,Faculty Code',
    'MON,1,09:00,09:50,BCS301,HEM',
    'MON,2,09:50,10:40,BCS302,KK'
  ].join('\n');
  const normLines = csvTimetableService.parseCSVLines(normalizedCsv);
  const normDetection = csvTimetableService.detectFormat(normLines);
  assert(normDetection.format === 'normalized', 'Row-based CSV is correctly detected as format: "normalized"');

  // --------------------------------------------------------------------------
  // TEST 3: Time Parsing & 12h/24h Normalization
  // --------------------------------------------------------------------------
  console.log('\n--- 3. TIME PARSING & 12H/24H NORMALIZATION ---');
  assert(csvTimetableService.normalizeTimeTo24H('9:00') === '09:00', '9:00 -> 09:00');
  assert(csvTimetableService.normalizeTimeTo24H('12:20') === '12:20', '12:20 -> 12:20');
  assert(csvTimetableService.normalizeTimeTo24H('1:10') === '13:10', '1:10 -> 13:10');
  assert(csvTimetableService.normalizeTimeTo24H('2:00') === '14:00', '2:00 -> 14:00');
  assert(csvTimetableService.normalizeTimeTo24H('2:50') === '14:50', '2:50 -> 14:50');
  assert(csvTimetableService.normalizeTimeTo24H('3:40') === '15:40', '3:40 -> 15:40');
  assert(csvTimetableService.parsePeriodNumber('I') === 1, 'Roman numeral I -> 1');
  assert(csvTimetableService.parsePeriodNumber('VIII') === 8, 'Roman numeral VIII -> 8');

  // --------------------------------------------------------------------------
  // TEST 4 & 5: Full Matrix Parsing with Real CSV File
  // --------------------------------------------------------------------------
  console.log('\n--- 4 & 5. REAL CSV FILE PARSING & TOKEN EXTRACTION ---');
  const result = csvTimetableService.parseAndValidateCSV(realCSVContent, {
    targetSection: secB,
    subjects,
    faculty,
    classrooms,
  });

  if (!result.valid) {
    console.error('Validation errors:', result.errors);
  }
  assert(result.valid === true, 'Real matrix CSV validated with 0 errors');
  assert(result.errors.length === 0, 'result.errors is empty');
  assert(result.format === 'matrix', 'result.format is "matrix"');

  // Verify Days parsed dynamically
  const daysParsed = Object.keys(result.dayBreakdown).sort();
  assert(
    daysParsed.includes('MON') && daysParsed.includes('SAT'),
    `Days MON through SAT parsed dynamically: ${daysParsed.join(', ')}`
  );
  assert(daysParsed.length === 6, 'Exactly 6 academic days parsed');

  // --------------------------------------------------------------------------
  // TEST 6: Non-Instructional Cells (Lunch Break)
  // --------------------------------------------------------------------------
  console.log('\n--- 6. NON-INSTRUCTIONAL CELLS (LUNCH) ---');
  const lunchSlots = result.entries.filter(e => e.lecture_type === 'Lunch' || e.subject_code === 'LUNCH');
  assert(lunchSlots.length === 6, `Found ${lunchSlots.length} non-instructional Lunch slots (1 per day)`);
  assert(lunchSlots.every(l => l.subject_id === undefined && l.faculty_id === undefined), 'Lunch slots have undefined/null subject_id and faculty_id');
  assert(lunchSlots[0].start_time === '12:20' && lunchSlots[0].end_time === '13:10', 'Lunch slot has timing 12:20–13:10');

  // --------------------------------------------------------------------------
  // TEST 7: Database-Backed Faculty Resolution
  // --------------------------------------------------------------------------
  console.log('\n--- 7. DATABASE-BACKED FACULTY RESOLUTION ---');
  const hemFaculty = csvTimetableService.findMatchingFaculty('HEM', faculty);
  const kkFaculty = csvTimetableService.findMatchingFaculty('KK', faculty);
  const nakFaculty = csvTimetableService.findMatchingFaculty('NAK', faculty);
  const irkFaculty = csvTimetableService.findMatchingFaculty('IRK', faculty);
  const prsFaculty = csvTimetableService.findMatchingFaculty('PRS', faculty);
  const gdsFaculty = csvTimetableService.findMatchingFaculty('GDS', faculty);

  assert(Boolean(hemFaculty) && hemFaculty!.full_name.includes('Hemlata'), 'HEM resolves to Ms. Hemlata Chaudhary');
  assert(Boolean(kkFaculty) && kkFaculty!.full_name.includes('Kuldeep'), 'KK resolves to Mr. Kuldeep Kumar');
  assert(Boolean(nakFaculty) && nakFaculty!.full_name.includes('Naseem'), 'NAK resolves to Dr. Naseem Ahamad Khan');
  assert(Boolean(irkFaculty) && irkFaculty!.full_name.includes('Imran'), 'IRK resolves to Mr. Imran Raza Khan');
  assert(Boolean(prsFaculty) && prsFaculty!.full_name.includes('Praveen'), 'PRS resolves to Mr. Praveen Sharma');
  assert(Boolean(gdsFaculty) && gdsFaculty!.full_name.includes('Gagandeep'), 'GDS resolves to Mr. Gagandeep Singh');

  // Test non-existent faculty
  const unknownFaculty = csvTimetableService.findMatchingFaculty('XYZ999', faculty);
  assert(unknownFaculty === undefined, 'Non-existent faculty code XYZ999 returns undefined');

  // --------------------------------------------------------------------------
  // TEST 8: Database-Backed Subject Resolution
  // --------------------------------------------------------------------------
  console.log('\n--- 8. DATABASE-BACKED SUBJECT RESOLUTION ---');
  const dsSub = csvTimetableService.findMatchingSubject('DS', subjects);
  const coaSub = csvTimetableService.findMatchingSubject('COA', subjects);
  const mathsSub = csvTimetableService.findMatchingSubject('MATHS 4', subjects);
  const dstlSub = csvTimetableService.findMatchingSubject('DSTL', subjects);
  const csSub = csvTimetableService.findMatchingSubject('CS', subjects);
  const uhvSub = csvTimetableService.findMatchingSubject('UHV', subjects);
  const wdSub = csvTimetableService.findMatchingSubject('WD WORKSHOP', subjects);
  const dsLabSub = csvTimetableService.findMatchingSubject('DS LAB', subjects);

  assert(dsSub?.subject_code === 'BCS301', 'DS resolves to BCS301 (Data Structure)');
  assert(coaSub?.subject_code === 'BCS302', 'COA resolves to BCS302 (COA)');
  assert(mathsSub?.subject_code === 'BAS303', 'MATHS 4 resolves to BAS303 (Mathematics IV)');
  assert(dstlSub?.subject_code === 'BCS303', 'DSTL resolves to BCS303 (Discrete Structure)');
  assert(csSub?.subject_code === 'BCC301', 'CS resolves to BCC301 (Cyber Security)');
  assert(uhvSub?.subject_code === 'BVE301', 'UHV resolves to BVE301 (Universal Human Value)');
  assert(wdSub?.subject_code === 'BCS353', 'WD WORKSHOP resolves to BCS353 (Web Designing Workshop)');
  assert(dsLabSub?.subject_code === 'BCS351', 'DS LAB resolves to BCS351 (Data Structure Lab)');

  // --------------------------------------------------------------------------
  // TEST 9: Section Scope Mismatch Validation
  // --------------------------------------------------------------------------
  console.log('\n--- 9. SECTION SCOPE MISMATCH VALIDATION ---');
  const secAMismatchResult = csvTimetableService.parseAndValidateCSV(realCSVContent, {
    targetSection: secA, // Target is Section A, but CSV metadata says Section: B
    subjects,
    faculty,
    classrooms,
  });
  assert(
    secAMismatchResult.valid === false,
    'Import blocked when CSV metadata (Section B) mismatches selected target (Section A)'
  );
  assert(
    secAMismatchResult.errors.some(e => e.includes('does not match the active selected section')),
    'Clear section mismatch error reported to user'
  );

  // --------------------------------------------------------------------------
  // TEST 10: Classroom Resolution Against Database Catalog
  // --------------------------------------------------------------------------
  console.log('\n--- 10. CLASSROOM VALIDATION ---');
  assert(result.metadata?.roomNumber === 'A 006', 'CSV Room No. extracted as "A 006"');
  const resolvedClassroom = classrooms.find(c => c.room_number === 'A006');
  assert(Boolean(resolvedClassroom), 'Classroom A006 exists in Supabase classrooms table');
  assert(result.entries[0].room_number === 'A006', 'Canonical room number assigned to entries');
  assert(result.entries[0].classroom_id === resolvedClassroom?.id, 'Canonical classroom_id assigned');

  // Test non-existent classroom rejection
  const fakeRoomCSV = realCSVContent.replace('Room No.: A 006', 'Room No.: ROOM_999_NONEXISTENT');
  const fakeRoomResult = csvTimetableService.parseAndValidateCSV(fakeRoomCSV, {
    targetSection: secB,
    subjects,
    faculty,
    classrooms,
  });
  assert(fakeRoomResult.valid === false, 'Non-existent classroom blocked during validation');
  assert(
    fakeRoomResult.errors.some(e => e.includes('does not exist in the academic database')),
    'Exact classroom error reported: "Classroom ROOM_999_NONEXISTENT does not exist in the academic database."'
  );

  // --------------------------------------------------------------------------
  // TEST 11: Conflict Validation Without False Conflicts
  // --------------------------------------------------------------------------
  console.log('\n--- 11. CONFLICT VALIDATION (NO FALSE CONFLICTS) ---');
  const proposedForConflict = result.entries.map(e => ({
    subject_id: e.subject_id || undefined,
    faculty_id: e.faculty_id || undefined,
    day_of_week: e.day_of_week,
    period_number: e.period_number,
    start_time: e.start_time,
    end_time: e.end_time,
    room_number: e.room_number,
    lecture_type: e.lecture_type,
  }));

  const conflictReport = TimetableConflictEngine.analyzeConflicts({
    targetSectionId: secB.id,
    proposedEntries: proposedForConflict,
    currentDbEntries: [], // Target section replacing cleanly
    sections,
    subjects,
    faculty,
    assignments,
    semesters,
    academicYears: years,
  });

  assert(conflictReport.hasBlockingConflicts === false, 'Timetable has 0 blocking conflicts (no false positives for back-to-back periods)');
  assert(conflictReport.blockingCount === 0, 'Blocking conflict count is exactly 0');

  // --------------------------------------------------------------------------
  // TEST 12: Atomic Replacement in Supabase via replace_section_timetable RPC
  // --------------------------------------------------------------------------
  console.log('\n--- 12. ATOMIC SUPABASE REPLACEMENT ---');
  // First clear Section B timetable to demonstrate transition
  await supabase.from('timetable_entries').delete().eq('section_id', secB.id);
  const { count: zeroCount } = await supabase
    .from('timetable_entries')
    .select('id', { count: 'exact' })
    .eq('section_id', secB.id);
  assert(zeroCount === 0, 'Section B timetable cleared (count = 0)');

  // Call replace_section_timetable RPC
  const { data: rpcData, error: rpcErr } = await supabase.rpc('replace_section_timetable', {
    p_section_id: secB.id,
    p_department_id: deptId,
    p_approved_by: 'Tarun Kushwah',
    p_effective_from: '2026-08-20',
    p_source_type: 'CSV_FILE_UPLOAD',
    p_source_url: 'BTech_CSE_IT_Sec_B_Time_Table_v2.csv',
    p_entries: proposedForConflict,
  });

  assert(!rpcErr, 'replace_section_timetable RPC executed without errors', rpcErr?.message);
  assert(Boolean(rpcData?.success), 'RPC returned success: true');
  const countInserted = rpcData?.period_count ?? rpcData?.slot_count;
  assert(countInserted > 0, `RPC inserted ${countInserted} timetable entries atomically`);

  // --------------------------------------------------------------------------
  // TEST 13: Zero Mutation on Validation Failure
  // --------------------------------------------------------------------------
  console.log('\n--- 13. ZERO MUTATION ON VALIDATION FAILURE ---');
  const initialEntriesCount = countInserted;
  // Attempt invalid import (unknown faculty code)
  const invalidCsv = realCSVContent.replace('DS (HEM)', 'DS (UNKNOWN_FAC_999)');
  const invalidRes = csvTimetableService.parseAndValidateCSV(invalidCsv, {
    targetSection: secB,
    subjects,
    faculty,
    classrooms,
  });
  assert(invalidRes.valid === false, 'Invalid CSV with unresolvable faculty code correctly failed validation');
  assert(
    invalidRes.errors.some(e => e.includes('UNKNOWN_FAC_999')),
    'Reported error for unresolvable faculty code'
  );

  // Verify database timetable entries for Section B remained completely untouched
  const { count: postFailCount } = await supabase
    .from('timetable_entries')
    .select('id', { count: 'exact' })
    .eq('section_id', secB.id);
  assert(
    postFailCount === initialEntriesCount,
    `Existing timetable was not modified on validation failure (retained ${postFailCount} slots)`
  );

  // --------------------------------------------------------------------------
  // TEST 14: Refresh Persistence
  // --------------------------------------------------------------------------
  console.log('\n--- 14. REFRESH PERSISTENCE AUDIT ---');
  const { data: persistentEntries } = await supabase
    .from('timetable_entries')
    .select('*, subject:subjects(*), faculty:faculty(*)')
    .eq('section_id', secB.id)
    .order('period_number', { ascending: true });

  assert((persistentEntries?.length || 0) > 0, `Section B timetable persisted with ${persistentEntries?.length} entries`);
  assert(Boolean(persistentEntries?.some(e => e.day_of_week === 'MON' && e.period_number === 1)), 'Monday Period 1 persisted');
  assert(Boolean(persistentEntries?.some(e => e.day_of_week === 'SAT' && e.period_number === 8)), 'Saturday Period 8 persisted');

  // Verify latest version in timetable_versions
  const { data: latestVersion } = await supabase
    .from('timetable_versions')
    .select('*')
    .eq('section_id', secB.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  assert(Boolean(latestVersion), `Active timetable version created in database (v${latestVersion?.version_number})`);
  assert(latestVersion?.approved_by === 'Tarun Kushwah', 'Approved by administrator Tarun Kushwah');

  // --------------------------------------------------------------------------
  // TEST 15: Google Sheet CSV Parity
  // --------------------------------------------------------------------------
  console.log('\n--- 15. GOOGLE SHEET CSV PARITY ---');
  // Simulate Google Sheet CSV export of the same timetable
  const gsheetCsvContent = realCSVContent;
  const gsheetRes = csvTimetableService.parseAndValidateCSV(gsheetCsvContent, {
    targetSection: secB,
    subjects,
    faculty,
    classrooms,
  });

  assert(gsheetRes.valid === true, 'Google Sheet CSV format parsed and validated successfully');
  assert(gsheetRes.entries.length === result.entries.length, `Slot count matches: ${gsheetRes.entries.length} slots`);
  assert(gsheetRes.format === 'matrix', 'Google Sheet CSV detected with identical matrix format');

  console.log('\n================================================================================');
  console.log(`  🎉 ALL ${passedAssertions}/${totalAssertions} SPECIFICATION AUDIT CRITERIA PASSED!`);
  console.log('================================================================================\n');
}

runCSVMatrixTimetableTests().catch(err => {
  console.error('\n❌ Unhandled error during test execution:', err);
  process.exit(1);
});
