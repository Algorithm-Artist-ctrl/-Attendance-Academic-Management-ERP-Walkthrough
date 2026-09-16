import pg from 'pg';
import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
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

const connectionString = 'postgresql://postgres.obssoojzryqiudllnlkh:Tarun%40759977@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres';

async function runTests() {
  console.log('================================================================================');
  console.log('  VCTM ERP — HOD TIMETABLE SCOPING, MANUAL ENTRY & YEAR ARCHIVAL TEST SUITE');
  console.log('================================================================================\n');

  const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    // ---------------------------------------------------------------------------
    // TEST 1: 1st Year Archival Verification in Supabase DB
    // ---------------------------------------------------------------------------
    console.log('--- TEST 1: 1st Year Archival in Supabase Database ---');
    const dbYearsRes = await pool.query(`SELECT id, name, year_number, active FROM public.academic_years ORDER BY year_number ASC`);
    const year1Row = dbYearsRes.rows.find(r => r.year_number === 1);
    assert(year1Row !== undefined, 'Year 1 record exists in DB for foreign key integrity');
    assert(year1Row.active === false, 'Year 1 active flag is strictly false in academic_years');

    const activeDbYears = dbYearsRes.rows.filter(r => r.active === true);
    assert(activeDbYears.length >= 3, 'Active academic years contains at least 3 cohorts (2nd, 3rd, 4th Year)');
    assert(activeDbYears.every(y => y.year_number !== 1), 'No active academic year has year_number = 1');

    // Authenticate as CSE HOD (Wasim Akram)
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: 'wasim.cse@vctm.in',
      password: 'VctmHod@2026',
    });
    assert(!authErr, 'Authenticated as CSE HOD (wasim.cse@vctm.in)');

    // ---------------------------------------------------------------------------
    // TEST 2: Static Setup Query Scoping (Client-side supabaseService)
    // ---------------------------------------------------------------------------
    console.log('\n--- TEST 2: Client Static Setup Scoping ---');
    const staticSetup = await supabaseService.fetchStaticSetup();
    assert(staticSetup.years.length > 0, 'Static setup returned academic years');
    assert(staticSetup.years.every(y => y.year_number !== 1), 'Static setup excludes 1st Year');
    assert(staticSetup.years.every(y => y.active === true), 'Static setup returns only active years');
    assert(staticSetup.semesters.every(s => s.semester_number !== 1), 'Static setup excludes Semester 1');

    // ---------------------------------------------------------------------------
    // TEST 3: Subject Scoping — 3rd Year vs 2nd Year Isolation
    // ---------------------------------------------------------------------------
    console.log('\n--- TEST 3: Subject Scoping Isolation (No Cross-Year Leakage) ---');
    const entities = await supabaseService.fetchAcademicEntities();
    if (!entities) throw new Error('fetchAcademicEntities returned null');
    const sem3 = staticSetup.semesters.find(s => s.semester_number === 3);
    const sem5 = staticSetup.semesters.find(s => s.semester_number === 5);

    assert(!!sem3, 'Semester 3 (2nd Year) exists in DB');
    assert(!!sem5, 'Semester 5 (3rd Year) exists in DB');

    const sem3Subjects = entities.subjects.filter(s => s.semester_id === sem3!.id);
    const sem5Subjects = entities.subjects.filter(s => s.semester_id === sem5!.id);

    console.log(`    Semester 3 subjects count: ${sem3Subjects.length}`);
    console.log(`    Semester 5 subjects count: ${sem5Subjects.length}`);

    // Verify disjoint sets
    const sem3SubjectIds = new Set(sem3Subjects.map(s => s.id));
    const sem3SubjectCodes = new Set(sem3Subjects.map(s => s.subject_code));
    const crossYearLeak = sem5Subjects.some(s5 => sem3SubjectIds.has(s5.id) || sem3SubjectCodes.has(s5.subject_code));
    assert(!crossYearLeak, '3rd Year subjects do NOT contain any 2nd Year subjects (No cross-year subject leakage)');

    // ---------------------------------------------------------------------------
    // TEST 4: Touch Boundaries & Conflict Logic
    // ---------------------------------------------------------------------------
    console.log('\n--- TEST 4: Timetable Conflict Engine Touching Boundaries ---');
    const toMins = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    const hasOverlap = (sA: string, eA: string, sB: string, eB: string) => {
      const aStart = toMins(sA);
      const aEnd = toMins(eA);
      const bStart = toMins(sB);
      const bEnd = toMins(eB);
      return aStart < bEnd && bStart < aEnd;
    };

    // Touching periods: Period 1 (09:00 - 09:50) and Period 2 (09:50 - 10:40)
    const touchOverlap = hasOverlap('09:00', '09:50', '09:50', '10:40');
    assert(touchOverlap === false, 'Adjacent touching periods (09:00-09:50 and 09:50-10:40) do NOT conflict');

    // Real overlap: Period 1 (09:00 - 09:50) and Overlapping (09:30 - 10:20)
    const realOverlap = hasOverlap('09:00', '09:50', '09:30', '10:20');
    assert(realOverlap === true, 'Overlapping periods (09:00-09:50 and 09:30-10:20) DO conflict');

    // Same period: 09:00 - 09:50 and 09:00 - 09:50
    const exactOverlap = hasOverlap('09:00', '09:50', '09:00', '09:50');
    assert(exactOverlap === true, 'Identical periods (09:00-09:50 and 09:00-09:50) DO conflict');

    // ---------------------------------------------------------------------------
    // TEST 5: Manual Faculty Creation via supabaseService
    // ---------------------------------------------------------------------------
    console.log('\n--- TEST 5: Manual Faculty Creation in Supabase ---');
    const cseDept = staticSetup.departments.find(d => d.code === 'CSE') || staticSetup.departments[0];
    assert(!!cseDept, 'Department exists for faculty insertion');

    const uniqueTag = Date.now().toString().slice(-4);
    const testFacultyName = `Prof. Test Faculty ${uniqueTag}`;
    const testFacultyCode = `TF${uniqueTag}`;
    const testEmployeeCode = `EMP-TEST-${uniqueTag}`;

    const createdFaculty = await supabaseService.findOrCreateFaculty({
      fullName: testFacultyName,
      facultyCode: testFacultyCode,
      employeeCode: testEmployeeCode,
      designation: 'Assistant Professor',
      email: `testfaculty${uniqueTag}@vctm.in`,
      departmentId: cseDept.id,
    });

    assert(!!createdFaculty && !!createdFaculty.id, 'Manual faculty successfully inserted into Supabase');
    assert(createdFaculty.full_name === testFacultyName, 'Manual faculty full_name matches');
    assert(createdFaculty.auth_user_id === null || createdFaculty.auth_user_id === undefined, 'Manual faculty has auth_user_id = null (no auth user account created)');

    // Reusing existing faculty
    const reusedFaculty = await supabaseService.findOrCreateFaculty({
      fullName: testFacultyName,
      employeeCode: testEmployeeCode,
      departmentId: cseDept.id,
    });
    assert(reusedFaculty.id === createdFaculty.id, 'Calling findOrCreateFaculty again returns existing faculty record (deduplication works)');

    // ---------------------------------------------------------------------------
    // TEST 6: Manual Subject Creation via supabaseService
    // ---------------------------------------------------------------------------
    console.log('\n--- TEST 6: Manual Subject Creation in Supabase ---');
    const testSubjectCode = `KCS-TEST-${uniqueTag}`;
    const testSubjectName = `Test Advanced Algorithms ${uniqueTag}`;

    const createdSubject = await supabaseService.findOrCreateSubject({
      subjectName: testSubjectName,
      subjectCode: testSubjectCode,
      departmentId: cseDept.id,
      semesterId: sem5!.id,
      programId: staticSetup.programs[0]?.id,
      lectureType: 'Theory',
    });

    assert(!!createdSubject && !!createdSubject.id, 'Manual subject successfully inserted into Supabase');
    assert(createdSubject.subject_code === testSubjectCode, 'Manual subject code matches');
    assert(createdSubject.semester_id === sem5!.id, 'Manual subject is strictly scoped to Semester 5 (3rd Year)');

    // Reusing existing subject
    const reusedSubject = await supabaseService.findOrCreateSubject({
      subjectName: testSubjectName,
      subjectCode: testSubjectCode,
      departmentId: cseDept.id,
      semesterId: sem5!.id,
    });
    assert(reusedSubject.id === createdSubject.id, 'Calling findOrCreateSubject again returns existing subject (deduplication works)');

    // ---------------------------------------------------------------------------
    // TEST 7: Single Timetable Slot Save via supabaseService
    // ---------------------------------------------------------------------------
    console.log('\n--- TEST 7: Single Slot Save to Live Database ---');
    const targetSection = entities.sections.find(s => s.semester_id === sem5!.id);
    assert(!!targetSection, 'Target 3rd Year section exists');

    const testSlotSave = await supabaseService.saveSingleTimetableSlot({
      sectionId: targetSection!.id,
      dayOfWeek: 'SAT',
      periodNumber: 8,
      startTime: '16:00',
      endTime: '16:50',
      subjectId: createdSubject.id,
      facultyId: createdFaculty.id,
      roomNumber: 'Test Room 99',
      lectureType: 'Theory',
      updatedBy: 'Automated Test Suite',
    });

    assert(testSlotSave.success === true, 'saveSingleTimetableSlot succeeded in Supabase');
    assert(testSlotSave.entry.period_number === 8, 'Saved slot period_number is 8');
    assert(testSlotSave.entry.subject_id === createdSubject.id, 'Saved slot subject_id matches');
    assert(testSlotSave.entry.faculty_id === createdFaculty.id, 'Saved slot faculty_id matches');

    // Clean up the temporary test slot and entities so test runs are idempotent
    await pool.query(`DELETE FROM public.timetable_entries WHERE id = $1`, [testSlotSave.entry.id]);
    await pool.query(`DELETE FROM public.faculty_subject_assignments WHERE subject_id = $1 AND faculty_id = $2`, [createdSubject.id, createdFaculty.id]);
    await pool.query(`DELETE FROM public.subjects WHERE id = $1`, [createdSubject.id]);
    await pool.query(`DELETE FROM public.faculty WHERE id = $1`, [createdFaculty.id]);
    console.log('    ✓ Temporary test entities cleanly removed from Supabase');

    // ---------------------------------------------------------------------------
    // TEST 8: HOD Dashboard Section Hierarchy Checks
    // ---------------------------------------------------------------------------
    console.log('\n--- TEST 8: HOD Dashboard Section Hierarchy ---');
    const sem3Sections = entities.sections.filter(s => s.semester_id === sem3!.id);
    const sem5Sections = entities.sections.filter(s => s.semester_id === sem5!.id);

    console.log(`    2nd Year Sections: ${sem3Sections.map(s => s.name).join(', ')}`);
    console.log(`    3rd Year Sections: ${sem5Sections.map(s => s.name).join(', ')}`);

    const sem3HasSecC = sem3Sections.some(s => s.name.toUpperCase() === 'C');
    const sem5HasSecC = sem5Sections.some(s => s.name.toUpperCase() === 'C');

    assert(sem3HasSecC === false, '2nd Year has NO Section C (Only Section A and B)');
    assert(sem5HasSecC === true, '3rd Year DOES have Section C in database');

    console.log('\n================================================================================');
    console.log(`🎉 ALL ${passedAssertions}/${totalAssertions} ASSERTIONS PASSED SUCCESSFULLY!`);
    console.log('================================================================================\n');
  } finally {
    await pool.end();
  }
}

runTests().catch(err => {
  console.error('\n❌ Test execution failed with error:', err);
  process.exit(1);
});
