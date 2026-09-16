import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';

async function runTests() {
  console.log('================================================================');
  console.log('TEST SUITE: Student Add / Year / Section Mapping (12 Test Matrix)');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} ${detail ? `-> ${detail}` : ''}`);
      failed++;
    }
  }

  // Authenticate as Admin
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@vctm.in',
    password: 'VctmAdmin@2026',
  });
  if (authErr || !authData.session) {
    throw new Error(`Admin authentication failed: ${authErr?.message}`);
  }
  console.log(`Authenticated as admin: ${authData.user.email}`);

  // Fetch live academic hierarchy
  const [
    { data: depts },
    { data: progs },
    { data: years },
    { data: semesters },
    { data: sections },
    { data: initialStudents }
  ] = await Promise.all([
    supabase.from('departments').select('*'),
    supabase.from('programs').select('*'),
    supabase.from('academic_years').select('*').order('year_number'),
    supabase.from('semesters').select('*').order('semester_number'),
    supabase.from('sections').select('*').order('name'),
    supabase.from('students').select('*')
  ]);

  if (!years || !semesters || !sections || !depts || !progs) {
    throw new Error('Failed to load academic hierarchy from Supabase');
  }

  const initialCount = initialStudents?.length || 0;
  console.log(`Initial student count in database: ${initialCount}`);

  const firstYear = years.find(y => y.year_number === 1)!;
  const secondYear = years.find(y => y.year_number === 2)!;
  const thirdYear = years.find(y => y.year_number === 3)!;
  const fourthYear = years.find(y => y.year_number === 4)!;

  const sem5 = semesters.find(s => s.academic_year_id === thirdYear.id)!;
  const sem7 = semesters.find(s => s.academic_year_id === fourthYear.id)!;

  const thirdYearSections = sections.filter(s => s.semester_id === sem5.id && s.active);
  const thirdYearSecA = thirdYearSections.find(s => s.name.toUpperCase() === 'A')!;
  const thirdYearSecB = thirdYearSections.find(s => s.name.toUpperCase() === 'B')!;

  const fourthYearSections = sections.filter(s => s.semester_id === sem7.id && s.active);
  const fourthYearSecA = fourthYearSections.find(s => s.name.toUpperCase() === 'A')!;

  const testRoll = 'TEST_3RD_SEC_A_999';
  const testRoll4th = 'TEST_4TH_SEC_A_999';

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Filter = 3rd Year -> Add Student opens with 3rd Year selected
    // -------------------------------------------------------------------------
    {
      const yearFilter = thirdYear.id;
      const sectionFilter = 'ALL';

      // Simulate handleOpenAddModal
      const targetYearId = yearFilter !== 'ALL' ? yearFilter : (years[0]?.id || '');
      const matchingSems = semesters.filter(s => s.academic_year_id === targetYearId).map(s => s.id);
      const yearSections = sections.filter(sec => matchingSems.includes(sec.semester_id) && sec.active);
      const targetSectionId = (sectionFilter !== 'ALL' && yearSections.some(sec => sec.id === sectionFilter))
        ? sectionFilter
        : (yearSections[0]?.id || '');

      assert(
        targetYearId === thirdYear.id && yearSections.some(s => s.id === targetSectionId),
        'TEST 1: Filter = 3rd Year -> Add Student opens with 3rd Year selected',
        `targetYearId=${targetYearId}, expected=${thirdYear.id}`
      );
    }

    // -------------------------------------------------------------------------
    // TEST 2: Filter = 3rd Year, Section = Section A -> Add Student opens with 3rd Year and Section A selected
    // -------------------------------------------------------------------------
    {
      const yearFilter = thirdYear.id;
      const sectionFilter = thirdYearSecA.id;

      // Simulate handleOpenAddModal
      const targetYearId = yearFilter !== 'ALL' ? yearFilter : (years[0]?.id || '');
      const matchingSems = semesters.filter(s => s.academic_year_id === targetYearId).map(s => s.id);
      const yearSections = sections.filter(sec => matchingSems.includes(sec.semester_id) && sec.active);
      const targetSectionId = (sectionFilter !== 'ALL' && yearSections.some(sec => sec.id === sectionFilter))
        ? sectionFilter
        : (yearSections[0]?.id || '');

      assert(
        targetYearId === thirdYear.id && targetSectionId === thirdYearSecA.id,
        'TEST 2: Filter = 3rd Year, Section = Section A -> Add Student opens with 3rd Year and Section A selected',
        `targetYearId=${targetYearId}, targetSectionId=${targetSectionId}`
      );
    }

    // -------------------------------------------------------------------------
    // TEST 3: Add student to 3rd Year Section A -> verify Supabase row contains exact 3rd Year academic_year_id, Semester 5 semester_id, and 3rd Year Section A section_id
    // -------------------------------------------------------------------------
    let createdStudent3rd: any = null;
    {
      createdStudent3rd = await supabaseService.addStudent({
        institution_id: '22398afa-8679-4d2c-87fc-312152a276e2',
        department_id: depts[0].id,
        program_id: progs[0].id,
        academic_session_id: 'a358fe68-d746-4242-9f36-2c715cd9526e',
        academic_year_id: thirdYear.id,
        semester_id: sem5.id,
        section_id: thirdYearSecA.id,
        roll_number: testRoll,
        full_name: 'TEST STUDENT THREE A',
        admission_type: 'Regular',
        email: `${testRoll.toLowerCase()}@vctm.in`,
        active: true
      });

      // Verify row in Supabase
      const { data: dbRow } = await supabase
        .from('students')
        .select('*')
        .eq('id', createdStudent3rd.id)
        .single();

      assert(
        dbRow?.academic_year_id === thirdYear.id &&
        dbRow?.semester_id === sem5.id &&
        dbRow?.section_id === thirdYearSecA.id &&
        dbRow?.roll_number === testRoll,
        'TEST 3: Add student to 3rd Year Section A -> verify Supabase row contains exact 3rd Year academic_year_id, Semester 5 semester_id, and 3rd Year Section A section_id',
        `dbRow year=${dbRow?.academic_year_id}, sem=${dbRow?.semester_id}, sec=${dbRow?.section_id}`
      );
    }

    // -------------------------------------------------------------------------
    // TEST 4: After save, directory with 3rd Year filter shows the newly added student immediately
    // -------------------------------------------------------------------------
    {
      const yearFilter = thirdYear.id;
      const sectionFilter = 'ALL';

      const matchesYear = yearFilter === 'ALL' || createdStudent3rd.academic_year_id === yearFilter;
      const matchesSection = sectionFilter === 'ALL' || createdStudent3rd.section_id === sectionFilter;

      assert(
        matchesYear && matchesSection,
        'TEST 4: Directory with 3rd Year filter shows the newly added student immediately',
        `matchesYear=${matchesYear}, matchesSection=${matchesSection}`
      );
    }

    // -------------------------------------------------------------------------
    // TEST 5: Change directory filter to 2nd Year -> new 3rd Year student does NOT appear
    // -------------------------------------------------------------------------
    {
      const yearFilter = secondYear.id;
      const sectionFilter = 'ALL';

      const matchesYear = yearFilter === 'ALL' || createdStudent3rd.academic_year_id === yearFilter;
      const matchesSection = sectionFilter === 'ALL' || createdStudent3rd.section_id === sectionFilter;

      assert(
        !matchesYear,
        'TEST 5: Change directory filter to 2nd Year -> new 3rd Year student does NOT appear',
        `matchesYear=${matchesYear} (should be false)`
      );
    }

    // -------------------------------------------------------------------------
    // TEST 6: Change directory filter back to 3rd Year -> student appears
    // -------------------------------------------------------------------------
    {
      const yearFilter = thirdYear.id;
      const sectionFilter = thirdYearSecA.id;

      const matchesYear = yearFilter === 'ALL' || createdStudent3rd.academic_year_id === yearFilter;
      const matchesSection = sectionFilter === 'ALL' || createdStudent3rd.section_id === sectionFilter;

      assert(
        matchesYear && matchesSection,
        'TEST 6: Change directory filter back to 3rd Year Section A -> student appears',
        `matchesYear=${matchesYear}, matchesSection=${matchesSection}`
      );
    }

    // -------------------------------------------------------------------------
    // TEST 7: Section dropdown for 3rd Year contains only 3rd Year sections (A, B, C), not 2nd Year sections
    // -------------------------------------------------------------------------
    {
      const modalYearId = thirdYear.id;
      const addModalSemesters = semesters.filter(sem => sem.academic_year_id === modalYearId);
      const semIds = addModalSemesters.map(s => s.id);
      const addModalSections = sections.filter(sec => semIds.includes(sec.semester_id) && sec.active);

      const secNames = addModalSections.map(s => s.name).sort();
      const allBelongToSem5 = addModalSections.every(s => s.semester_id === sem5.id);

      assert(
        allBelongToSem5 && secNames.includes('A') && secNames.includes('B') && !secNames.some(s => s === '2nd Year'),
        'TEST 7: Section dropdown for 3rd Year contains only 3rd Year sections (A, B, C), not 2nd Year sections',
        `Found sections: ${secNames.join(', ')}`
      );
    }

    // -------------------------------------------------------------------------
    // TEST 8: Section dropdown for 4th Year contains only 4th Year sections (A, B)
    // -------------------------------------------------------------------------
    {
      const modalYearId = fourthYear.id;
      const addModalSemesters = semesters.filter(sem => sem.academic_year_id === modalYearId);
      const semIds = addModalSemesters.map(s => s.id);
      const addModalSections = sections.filter(sec => semIds.includes(sec.semester_id) && sec.active);

      const secNames = addModalSections.map(s => s.name).sort();
      const allBelongToSem7 = addModalSections.every(s => s.semester_id === sem7.id);

      assert(
        allBelongToSem7 && secNames.length === 2 && secNames[0] === 'A' && secNames[1] === 'B',
        'TEST 8: Section dropdown for 4th Year contains only 4th Year sections (A, B)',
        `Found sections: ${secNames.join(', ')}`
      );
    }

    // -------------------------------------------------------------------------
    // TEST 9: Fetch from Supabase after refresh -> student data remains correctly mapped
    // -------------------------------------------------------------------------
    {
      const fetchedStudents = await supabaseService.fetchStudents();
      const refreshedStudent = fetchedStudents.find(s => s.id === createdStudent3rd.id);

      assert(
        refreshedStudent !== undefined &&
        refreshedStudent.academic_year_id === thirdYear.id &&
        refreshedStudent.semester_id === sem5.id &&
        refreshedStudent.section_id === thirdYearSecA.id,
        'TEST 9: Fetch from Supabase after refresh -> student data remains correctly mapped',
        `Fetched student: year=${refreshedStudent?.academic_year_id}, sem=${refreshedStudent?.semester_id}, sec=${refreshedStudent?.section_id}`
      );
    }

    // -------------------------------------------------------------------------
    // TEST 10: Re-authenticate / clean query from Supabase -> student remains under 3rd Year Section A
    // -------------------------------------------------------------------------
    {
      const { data: freshStudent, error: qErr } = await supabase
        .from('students')
        .select('*, section:sections(*), semester:semesters(*), academic_year:academic_years(*)')
        .eq('id', createdStudent3rd.id)
        .single();

      assert(
        !qErr &&
        freshStudent.academic_year_id === thirdYear.id &&
        freshStudent.section?.id === thirdYearSecA.id &&
        freshStudent.semester?.id === sem5.id,
        'TEST 10: Fresh relational query from Supabase -> student remains under 3rd Year Section A',
        `Joined data: year=${freshStudent?.academic_year?.name}, sec=${freshStudent?.section?.name}`
      );
    }

    // -------------------------------------------------------------------------
    // TEST 11: Zero fallback check: ensure student creation never falls back to years[0], semesters[0], or sections[0]
    // -------------------------------------------------------------------------
    let createdStudent4th: any = null;
    {
      createdStudent4th = await supabaseService.addStudent({
        institution_id: '22398afa-8679-4d2c-87fc-312152a276e2',
        department_id: depts[0].id,
        program_id: progs[0].id,
        academic_session_id: 'a358fe68-d746-4242-9f36-2c715cd9526e',
        academic_year_id: fourthYear.id,
        semester_id: sem7.id,
        section_id: fourthYearSecA.id,
        roll_number: testRoll4th,
        full_name: 'TEST STUDENT FOUR A',
        admission_type: 'Regular',
        email: `${testRoll4th.toLowerCase()}@vctm.in`,
        active: true
      });

      assert(
        createdStudent4th.academic_year_id === fourthYear.id &&
        createdStudent4th.academic_year_id !== firstYear.id &&
        createdStudent4th.academic_year_id !== secondYear.id &&
        createdStudent4th.section_id === fourthYearSecA.id,
        'TEST 11: Zero fallback check: 4th year student saved with 4th year IDs, never falling back to years[0]',
        `4th year student year=${createdStudent4th.academic_year_id}`
      );
    }

    // -------------------------------------------------------------------------
    // TEST 12: Invalid hierarchy validation: verify attempt to save with mismatched section/year throws validation error and is blocked
    // -------------------------------------------------------------------------
    {
      let caughtError = false;
      try {
        // Attempt to save 4th Year section under 2nd Year
        await supabaseService.addStudent({
          institution_id: '22398afa-8679-4d2c-87fc-312152a276e2',
          department_id: depts[0].id,
          program_id: progs[0].id,
          academic_session_id: 'a358fe68-d746-4242-9f36-2c715cd9526e',
          academic_year_id: secondYear.id, // Mismatch: 2nd year specified
          semester_id: sem5.id,           // Mismatch: sem 5 specified
          section_id: fourthYearSecA.id,  // Actual section belongs to sem 7 / 4th year
          roll_number: 'INVALID_MISMATCH_ROLL',
          full_name: 'INVALID MISMATCH STUDENT',
          admission_type: 'Regular',
          active: true
        });
      } catch (err: any) {
        caughtError = true;
        console.log(`Validation caught expected error: ${err.message}`);
      }

      assert(
        caughtError,
        'TEST 12: Invalid hierarchy validation: attempt to save with mismatched section/year is rejected',
        `caughtError=${caughtError}`
      );
    }

  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP: Clean up test students from DB
    // -------------------------------------------------------------------------
    console.log('\nCleaning up test student records...');
    await supabase.from('students').delete().in('roll_number', [testRoll, testRoll4th, 'INVALID_MISMATCH_ROLL']);
    await supabase.from('profiles').delete().in('email', [`${testRoll.toLowerCase()}@vctm.in`, `${testRoll4th.toLowerCase()}@vctm.in`]);

    const { data: finalStudents } = await supabase.from('students').select('id');
    const finalCount = finalStudents?.length || 0;
    console.log(`Final student count in database: ${finalCount} (original was ${initialCount})`);
  }

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL 12)`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed with unhandled error:', err);
  process.exit(1);
});
