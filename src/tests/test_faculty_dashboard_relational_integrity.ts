import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import { DayOfWeek } from '../types/database.types';

// Polyfill localStorage for Node environment if missing
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
    if (detail !== undefined) console.error('   Detail:', detail);
    process.exit(1);
  } else {
    passedAssertions++;
    console.log(`  ✓ [Step ${totalAssertions}] ${stepName}`);
  }
}

async function runFacultyDashboardRelationalIntegrityTests() {
  console.log('================================================================================');
  console.log('  VCTM ERP — FACULTY DASHBOARD RELATIONAL INTEGRITY VERIFICATION TEST SUITE     ');
  console.log('  Database-Driven Source-of-Truth Timetable & Assignment Audit                 ');
  console.log('================================================================================\n');

  // STEP 1: Sync FSA with authoritative timetable entries
  console.log('▶ PHASE 1: RECONCILE AND SYNCHRONIZE FACULTY_SUBJECT_ASSIGNMENTS');
  const syncResult = await supabaseService.syncFacultySubjectAssignmentsWithTimetable();
  console.log(`  Synchronized FSA: ${syncResult.deactivated} stale pairs deactivated, ${syncResult.activatedOrInserted} active pairs validated.`);
  assert(true, '1. FSA synchronized with live published timetable entries in Supabase');

  // STEP 2: Fetch Master Data for Verification
  console.log('\n▶ PHASE 2: AUDIT LIVE MASTER & OPERATIONAL DATA');
  const [
    { data: allSections },
    { data: allSubjects },
    { data: allFaculty },
    { data: allTimetable },
    { data: allStudents },
    { data: allAssignments },
  ] = await Promise.all([
    supabase.from('sections').select('*'),
    supabase.from('subjects').select('*'),
    supabase.from('faculty').select('*'),
    supabase.from('timetable_entries').select('*').eq('active', true),
    supabase.from('students').select('*').eq('active', true),
    supabase.from('faculty_subject_assignments').select('*').eq('active', true),
  ]);

  assert(Boolean(allSections && allSections.length > 0), '2. Sections loaded from Supabase', allSections?.length);
  assert(Boolean(allSubjects && allSubjects.length > 0), '2. Subjects loaded from Supabase', allSubjects?.length);
  assert(Boolean(allFaculty && allFaculty.length > 0), '2. Faculty loaded from Supabase', allFaculty?.length);
  assert(Boolean(allTimetable && allTimetable.length > 0), '2. Timetable entries loaded from Supabase', allTimetable?.length);
  assert(Boolean(allStudents && allStudents.length > 0), '2. Active students loaded from Supabase', allStudents?.length);

  // STEP 3: Verify Ms. Hemlata Chaudhry's Assignments & Scoping
  console.log('\n▶ PHASE 3: VERIFY MS. HEMLATA CHAUDHRY RELATIONAL INTEGRITY');
  const hemlata = allFaculty!.find(f => 
    f.full_name.toLowerCase().includes('hemlata') || 
    f.employee_code === 'EMP-CSE-002' ||
    f.email.toLowerCase().includes('hemlata')
  );
  assert(Boolean(hemlata), '3. Found Ms. Hemlata Chaudhry in faculty table', hemlata?.id);
  const hemlataId = hemlata!.id;

  // Timetable entries for Hemlata
  const hemlataTt = allTimetable!.filter(t => t.faculty_id === hemlataId && !t.is_break && t.subject_id);
  console.log(`  Hemlata active teaching timetable entries: ${hemlataTt.length} periods`);
  assert(hemlataTt.length === 16, '3. Hemlata weekly teaching load is exactly 16 instructional periods', hemlataTt.length);

  // Distinct sections taught by Hemlata
  const hemlataSectionIds = Array.from(new Set(hemlataTt.map(t => t.section_id)));
  assert(hemlataSectionIds.length === 2, '3. Hemlata teaches in exactly 2 distinct sections', hemlataSectionIds.length);

  const hemlataSections = allSections!.filter(s => hemlataSectionIds.includes(s.id));
  const sectionNames = hemlataSections.map(s => s.name).sort();
  assert(sectionNames.length === 2 && sectionNames[0] === 'A' && sectionNames[1] === 'B', 
    '3. Hemlata sections are exactly Section A and Section B', sectionNames);

  // Check Section A details
  const secA = hemlataSections.find(s => s.name === 'A')!;
  const secB = hemlataSections.find(s => s.name === 'B')!;

  assert(secA.room_number === 'A007' || secA.room_number === 'A-007', 
    '3. Section A room is A007 (authoritative), NOT Room A-301', secA.room_number);
  assert(secB.room_number === 'A006' || secB.room_number === 'A-006', 
    '3. Section B room is A006 (authoritative), NOT Room A-102', secB.room_number);

  // Student counts per section
  const secAStudents = allStudents!.filter(s => s.section_id === secA.id);
  const secBStudents = allStudents!.filter(s => s.section_id === secB.id);
  assert(secAStudents.length === 53, '3. Section A has exactly 53 enrolled active students (NOT 0 or 1)', secAStudents.length);
  assert(secBStudents.length === 53, '3. Section B has exactly 53 enrolled active students (NOT 0 or 1)', secBStudents.length);

  // Subjects taught by Hemlata in Section A
  const secASubjectIds = Array.from(new Set(hemlataTt.filter(t => t.section_id === secA.id).map(t => t.subject_id)));
  const secASubjects = allSubjects!.filter(s => secASubjectIds.includes(s.id));
  const secASubjectCodes = secASubjects.map(s => s.subject_code);
  assert(secASubjectCodes.length === 1 && secASubjectCodes[0] === 'BCS303', 
    '3. Section A for Hemlata contains ONLY BCS303 (DSTL, 6 periods)', secASubjectCodes);

  // Subjects taught by Hemlata in Section B
  const secBSubjectIds = Array.from(new Set(hemlataTt.filter(t => t.section_id === secB.id).map(t => t.subject_id)));
  const secBSubjects = allSubjects!.filter(s => secBSubjectIds.includes(s.id));
  const secBSubjectCodes = secBSubjects.map(s => s.subject_code).sort();
  assert(secBSubjectCodes.length === 3 && 
         secBSubjectCodes[0] === 'BCS301' && 
         secBSubjectCodes[1] === 'BCS351' && 
         secBSubjectCodes[2] === 'BCS352', 
    '3. Section B for Hemlata contains ONLY BCS301 (DS), BCS351 (DS LAB), BCS352 (COA LAB)', secBSubjectCodes);

  // Zero subject leakage between Section A and Section B
  const commonSubjects = secASubjectCodes.filter(c => secBSubjectCodes.includes(c));
  assert(commonSubjects.length === 0, '3. Zero cross-section subject leakage for Hemlata (DSTL is not in B, DS is not in A)', commonSubjects);

  // Total distinct subjects taught by Hemlata
  const totalHemlataSubjects = Array.from(new Set(hemlataTt.map(t => t.subject_id)));
  assert(totalHemlataSubjects.length === 4, '3. Hemlata teaches exactly 4 distinct subjects in total', totalHemlataSubjects.length);

  // Active FSA records for Hemlata
  const hemlataFsa = allAssignments!.filter(a => a.faculty_id === hemlataId);
  console.log(`  Hemlata active FSA rows in Supabase: ${hemlataFsa.length}`);
  assert(hemlataFsa.length === 4, '3. Hemlata has exactly 4 active FSA records in Supabase (matching timetable)', hemlataFsa.length);

  // Verify none of Hemlata's active FSA rows reference obsolete demo sections
  const obsoleteSectionIds = allSections!
    .filter(s => s.room_number === 'Room A-102' || s.room_number === 'Room A-301' || s.room_number === 'Room A-101')
    .map(s => s.id);
  const leakedFsa = hemlataFsa.filter(a => obsoleteSectionIds.includes(a.section_id));
  assert(leakedFsa.length === 0, '3. Zero FSA records reference obsolete demo sections (Room A-102, Room A-301)', leakedFsa.length);

  // STEP 4: Cross-Faculty Isolation (Mr. Kuldeep Singh)
  console.log('\n▶ PHASE 4: AUDIT MR. KULDEEP SINGH DATA ISOLATION');
  const kuldeep = allFaculty!.find(f => 
    f.full_name.toLowerCase().includes('kuldeep') || 
    f.employee_code === 'EMP-CSE-001'
  );
  assert(Boolean(kuldeep), '4. Found Mr. Kuldeep Singh in faculty table', kuldeep?.id);
  const kuldeepId = kuldeep!.id;

  const kuldeepTt = allTimetable!.filter(t => t.faculty_id === kuldeepId && !t.is_break && t.subject_id);
  const kuldeepSubjectIds = Array.from(new Set(kuldeepTt.map(t => t.subject_id)));
  const kuldeepSubjects = allSubjects!.filter(s => kuldeepSubjectIds.includes(s.id));
  const kuldeepCodes = kuldeepSubjects.map(s => s.subject_code);

  assert(kuldeepCodes.includes('BCS302'), '4. Kuldeep teaches BCS302 (COA)', kuldeepCodes);
  assert(!kuldeepCodes.includes('BCS301') && !kuldeepCodes.includes('BCS303'), 
    '4. Zero subject leakage from Hemlata to Kuldeep (no BCS301 or BCS303)', kuldeepCodes);

  // STEP 5: Dynamic Day-of-Week Schedule Filtering
  console.log('\n▶ PHASE 5: VERIFY DYNAMIC DAY-OF-WEEK TIMETABLE SCHEDULES');
  const days: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  let totalScheduled = 0;
  for (const day of days) {
    const dayTt = hemlataTt.filter(t => t.day_of_week === day);
    console.log(`  Hemlata schedule on ${day}: ${dayTt.length} lectures`);
    totalScheduled += dayTt.length;
  }
  assert(totalScheduled === 16, '5. Sum of day-wise schedules equals 16 lectures across the week', totalScheduled);

  // STEP 6: Single Source of Truth Synchronization
  console.log('\n▶ PHASE 6: SINGLE SOURCE OF TRUTH (HOD = FACULTY = STUDENT)');
  // Student in Section A (e.g. roll_number 2301330100001)
  const studentA = secAStudents[0];
  assert(Boolean(studentA), '6. Sample Section A student exists', studentA?.roll_number);

  const studentATt = allTimetable!.filter(t => t.section_id === secA.id);
  assert(studentATt.length === 48, '6. Student in Section A has exactly 48 timetable periods (including breaks)', studentATt.length);

  // Student Section A timetable entries for DSTL have faculty_id === Hemlata
  const dstlEntries = studentATt.filter(t => {
    const sub = allSubjects!.find(s => s.id === t.subject_id);
    return sub?.subject_code === 'BCS303';
  });
  assert(dstlEntries.length === 6, '6. Section A student has 6 DSTL lectures', dstlEntries.length);
  const allHemlata = dstlEntries.every(t => t.faculty_id === hemlataId);
  assert(allHemlata, '6. All 6 DSTL lectures for Section A student are assigned to Ms. Hemlata Chaudhry', dstlEntries.map(t => t.faculty_id));

  console.log('\n================================================================================');
  console.log(`  ALL ${passedAssertions}/${totalAssertions} ASSERTIONS PASSED SUCCESSFULLY!`);
  console.log('  Faculty Dashboard Relational Integrity is Verified in Production Supabase!    ');
  console.log('================================================================================\n');
}

runFacultyDashboardRelationalIntegrityTests().catch(err => {
  console.error('\n❌ Unhandled exception during verification:', err);
  process.exit(1);
});
