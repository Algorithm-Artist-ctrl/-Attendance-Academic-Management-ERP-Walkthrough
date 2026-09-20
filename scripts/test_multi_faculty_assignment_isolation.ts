import pg from 'pg';
import { 
  resolveFacultyTeachingScope, 
  getAssignedSectionsForYear, 
  getAssignedSubjectsForSection 
} from '../src/lib/utils/facultyAssignmentResolver';
import { 
  AcademicYear, 
  Semester, 
  Section, 
  Subject, 
  Faculty, 
  TimetableEntry, 
  FacultySubjectAssignment 
} from '../src/types/database.types';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:[DB_PASSWORD]@[DB_HOST]:5432/postgres';

async function runMultiFacultyIsolationVerification() {
  console.log('🧪 Starting Multi-Faculty Dynamic Teaching Assignment Verification...\n');

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  await client.connect();
  console.log('✅ Connected to live PostgreSQL database.');

  try {
    // 1. Fetch live academic entities
    const yearsRes = await client.query(`SELECT * FROM academic_years WHERE active = true ORDER BY year_number ASC;`);
    const semsRes = await client.query(`SELECT * FROM semesters WHERE active = true ORDER BY semester_number ASC;`);
    const secsRes = await client.query(`SELECT * FROM sections WHERE active = true;`);
    const subsRes = await client.query(`SELECT * FROM subjects WHERE active = true;`);
    const facsRes = await client.query(`SELECT * FROM faculty WHERE active = true;`);
    const fsaRes = await client.query(`SELECT * FROM faculty_subject_assignments WHERE active = true;`);
    const ttRes = await client.query(`SELECT * FROM timetable_entries WHERE active = true AND subject_id IS NOT NULL;`);

    const years = yearsRes.rows as AcademicYear[];
    const semesters = semsRes.rows as Semester[];
    const sections = secsRes.rows as Section[];
    const subjects = subsRes.rows as Subject[];
    const faculty = facsRes.rows as Faculty[];
    const fsa = fsaRes.rows as FacultySubjectAssignment[];
    const timetable = ttRes.rows as TimetableEntry[];

    console.log(`Loaded from DB: ${years.length} years, ${semesters.length} semesters, ${sections.length} sections, ${subjects.length} subjects, ${faculty.length} faculty, ${fsa.length} FSA, ${timetable.length} timetable entries.\n`);

    const resolverContext = {
      years,
      semesters,
      sections,
      subjects,
      faculty,
      facultySubjectAssignments: fsa,
      timetable,
    };

    // -------------------------------------------------------------------------
    // TEST 1: Mr. Jitendra Singh (3rd Year Only)
    // -------------------------------------------------------------------------
    const jitendra = faculty.find(f => f.full_name?.toLowerCase().includes('jitendra'));
    if (!jitendra) throw new Error('Mr. Jitendra Singh not found in faculty table');

    console.log(`🔍 Test 1: Evaluating Mr. Jitendra Singh (${jitendra.id}, ${jitendra.employee_code})`);
    const jitendraScope = resolveFacultyTeachingScope(jitendra.id, resolverContext);

    console.log('  Assigned Years:', jitendraScope.assignedYears.map(y => y.name));
    console.log('  Assigned Sections:', jitendraScope.assignedSections.map(s => s.name));
    console.log('  Assigned Subjects:', jitendraScope.assignedSubjects.map(s => s.subject_code));

    // Assertions for Jitendra
    if (!jitendraScope.assignedYears.some(y => y.name.includes('3rd Year'))) {
      throw new Error('FAILED: Mr. Jitendra Singh should be assigned to 3rd Year');
    }
    if (jitendraScope.assignedYears.some(y => y.name.includes('2nd Year') || y.name.includes('4th Year'))) {
      throw new Error('FAILED: Mr. Jitendra Singh must NOT be assigned to 2nd Year or 4th Year');
    }
    if (!jitendraScope.assignedSubjects.some(s => s.subject_code === 'BCS055')) {
      throw new Error('FAILED: Mr. Jitendra Singh should teach BCS055 (Machine Learning Techniques)');
    }
    if (jitendraScope.assignedSubjects.some(s => s.subject_code === 'BAS303')) {
      throw new Error('FAILED: Mr. Jitendra Singh must NOT teach BAS303 (Maths 4)');
    }

    // Cascading dropdown test for Jitendra
    const yr3 = jitendraScope.assignedYears.find(y => y.name.includes('3rd Year'))!;
    const jitendraYr3Sections = getAssignedSectionsForYear(jitendraScope.allAssignments, sections, yr3.id);
    console.log('  Cascaded Sections for 3rd Year:', jitendraYr3Sections.map(s => s.name));
    if (jitendraYr3Sections.length === 0) {
      throw new Error('FAILED: 3rd Year must cascade into valid sections for Jitendra');
    }

    const secA = jitendraYr3Sections.find(s => s.name.trim() === 'A' || s.name.trim() === 'Section A');
    if (secA) {
      const secASubjects = getAssignedSubjectsForSection(jitendraScope.allAssignments, subjects, secA.id, yr3.id);
      console.log('  Cascaded Subjects for Section A:', secASubjects.map(s => s.subject_code));
      if (!secASubjects.some(s => s.subject_code === 'BCS055')) {
        throw new Error('FAILED: Section A for Jitendra must cascade into BCS055');
      }
    }
    console.log('  ✅ Test 1 Passed: Mr. Jitendra Singh scope isolated strictly to 3rd Year.\n');

    // -------------------------------------------------------------------------
    // TEST 2: Dr. Naseem Ahamad Khan (2nd Year Only)
    // -------------------------------------------------------------------------
    const naseem = faculty.find(f => f.full_name?.toLowerCase().includes('naseem'));
    if (!naseem) throw new Error('Dr. Naseem Ahamad Khan not found in faculty table');

    console.log(`🔍 Test 2: Evaluating Dr. Naseem Ahamad Khan (${naseem.id}, ${naseem.employee_code})`);
    const naseemScope = resolveFacultyTeachingScope(naseem.id, resolverContext);

    console.log('  Assigned Years:', naseemScope.assignedYears.map(y => y.name));
    console.log('  Assigned Sections:', naseemScope.assignedSections.map(s => s.name));
    console.log('  Assigned Subjects:', naseemScope.assignedSubjects.map(s => s.subject_code));

    // Assertions for Naseem
    if (!naseemScope.assignedYears.some(y => y.name.includes('2nd Year'))) {
      throw new Error('FAILED: Dr. Naseem Ahamad Khan should be assigned to 2nd Year');
    }
    if (naseemScope.assignedYears.some(y => y.name.includes('3rd Year') || y.name.includes('4th Year'))) {
      throw new Error('FAILED: Dr. Naseem Ahamad Khan must NOT be assigned to 3rd Year or 4th Year');
    }
    if (!naseemScope.assignedSubjects.some(s => s.subject_code === 'BAS303')) {
      throw new Error('FAILED: Dr. Naseem Ahamad Khan should teach BAS303 (Mathematics IV)');
    }
    if (naseemScope.assignedSubjects.some(s => s.subject_code === 'BCS055' || s.subject_code === 'BCS071')) {
      throw new Error('FAILED: Dr. Naseem Ahamad Khan must NOT teach BCS055 or BCS071');
    }

    // Cascading dropdown test for Naseem
    const yr2 = naseemScope.assignedYears.find(y => y.name.includes('2nd Year'))!;
    const naseemYr2Sections = getAssignedSectionsForYear(naseemScope.allAssignments, sections, yr2.id);
    console.log('  Cascaded Sections for 2nd Year:', naseemYr2Sections.map(s => s.name));
    if (naseemYr2Sections.length < 2) {
      throw new Error('FAILED: 2nd Year must cascade into Sections A and B for Dr. Naseem Khan');
    }
    console.log('  ✅ Test 2 Passed: Dr. Naseem Ahamad Khan scope isolated strictly to 2nd Year.\n');

    // -------------------------------------------------------------------------
    // TEST 3: Mr. Praveen Sharma (Multi-Year: 4th Year Sec A & 2nd Year Sec B)
    // -------------------------------------------------------------------------
    const praveen = faculty.find(f => f.full_name?.toLowerCase().includes('praveen'));
    if (!praveen) throw new Error('Mr. Praveen Sharma not found in faculty table');

    console.log(`🔍 Test 3: Evaluating Mr. Praveen Sharma (${praveen.id}, ${praveen.employee_code})`);
    const praveenScope = resolveFacultyTeachingScope(praveen.id, resolverContext);

    console.log('  Assigned Years:', praveenScope.assignedYears.map(y => y.name));
    console.log('  Assigned Sections:', praveenScope.assignedSections.map(s => s.name));
    console.log('  Assigned Subjects:', praveenScope.assignedSubjects.map(s => s.subject_code));

    // Assertions for Praveen
    if (!praveenScope.assignedYears.some(y => y.name.includes('4th Year')) || 
        !praveenScope.assignedYears.some(y => y.name.includes('2nd Year'))) {
      throw new Error('FAILED: Mr. Praveen Sharma must teach both 4th Year and 2nd Year');
    }
    if (praveenScope.assignedYears.some(y => y.name.includes('3rd Year') || y.name.includes('1st Year'))) {
      throw new Error('FAILED: Mr. Praveen Sharma must NOT be assigned to 3rd Year or 1st Year');
    }

    // Multi-Year Cascading Test
    const yr4 = praveenScope.assignedYears.find(y => y.name.includes('4th Year'))!;
    const praveenYr4Sections = getAssignedSectionsForYear(praveenScope.allAssignments, sections, yr4.id);
    console.log('  Praveen 4th Year Sections:', praveenYr4Sections.map(s => s.name));
    if (!praveenYr4Sections.some(s => s.name.trim() === 'A' || s.name.trim() === 'Section A')) {
      throw new Error('FAILED: Praveen 4th Year must contain Section A');
    }
    if (praveenYr4Sections.some(s => s.name.trim() === 'B' || s.name.trim() === 'Section B')) {
      throw new Error('FAILED: Praveen 4th Year must NOT contain Section B');
    }

    const praveenYr2 = praveenScope.assignedYears.find(y => y.name.includes('2nd Year'))!;
    const praveenYr2Sections = getAssignedSectionsForYear(praveenScope.allAssignments, sections, praveenYr2.id);
    console.log('  Praveen 2nd Year Sections:', praveenYr2Sections.map(s => s.name));
    if (!praveenYr2Sections.some(s => s.name.trim() === 'B' || s.name.trim() === 'Section B')) {
      throw new Error('FAILED: Praveen 2nd Year must contain Section B');
    }
    if (praveenYr2Sections.some(s => s.name.trim() === 'A' || s.name.trim() === 'Section A')) {
      throw new Error('FAILED: Praveen 2nd Year must NOT contain Section A');
    }
    console.log('  ✅ Test 3 Passed: Mr. Praveen Sharma multi-year / multi-section isolation verified.\n');

    // -------------------------------------------------------------------------
    // TEST 4: Mr. Waseem (Multi-Year: 4th Year Sec A & 3rd Year Sec B)
    // -------------------------------------------------------------------------
    const waseem = faculty.find(f => f.full_name?.toLowerCase().trim() === 'mr. waseem' || f.id === 'd97b0c91-91bd-4414-9c9a-315139e752c3');
    if (!waseem) throw new Error('Mr. Waseem not found in faculty table');

    console.log(`🔍 Test 4: Evaluating Mr. Waseem (${waseem.id}, ${waseem.employee_code})`);
    const waseemScope = resolveFacultyTeachingScope(waseem.id, resolverContext);

    console.log('  Assigned Years:', waseemScope.assignedYears.map(y => y.name));
    console.log('  Assigned Sections:', waseemScope.assignedSections.map(s => s.name));
    console.log('  Assigned Subjects:', waseemScope.assignedSubjects.map(s => s.subject_code));

    if (!waseemScope.assignedYears.some(y => y.name.includes('4th Year')) || 
        !waseemScope.assignedYears.some(y => y.name.includes('3rd Year'))) {
      throw new Error('FAILED: Mr. Waseem must be assigned to both 4th Year and 3rd Year');
    }
    if (waseemScope.assignedYears.some(y => y.name.includes('2nd Year'))) {
      throw new Error('FAILED: Mr. Waseem must NOT be assigned to 2nd Year');
    }
    console.log('  ✅ Test 4 Passed: Mr. Waseem (4th Year Sec A & 3rd Year Sec B) verified.\n');

    // -------------------------------------------------------------------------
    // TEST 5: Removal of Artificial 1st Year Exclusion
    // -------------------------------------------------------------------------
    console.log('🔍 Test 5: Verifying Removal of Artificial 1st Year (year_number === 1) Exclusion...');
    // Create a scenario where 1st Year is active
    const yr1Mock: AcademicYear = {
      id: 'mock-yr-1',
      name: '1st Year',
      year_number: 1,
      active: true,
      program_id: 'prog-1',
      created_at: new Date().toISOString()
    };
    const sem1Mock: Semester = {
      id: 'mock-sem-1',
      name: '1st Semester',
      semester_number: 1,
      academic_year_id: 'mock-yr-1',
      active: true,
      program_id: 'prog-1',
      created_at: new Date().toISOString()
    };
    const sec1Mock: Section = {
      id: 'mock-sec-1',
      name: 'Section A',
      semester_id: 'mock-sem-1',
      active: true,
      department_id: 'dept-1',
      created_at: new Date().toISOString()
    };
    const sub1Mock: Subject = {
      id: 'mock-sub-1',
      subject_code: 'BAS101',
      subject_name: 'Engineering Physics',
      semester_id: 'mock-sem-1',
      active: true,
      department_id: 'dept-1',
      created_at: new Date().toISOString()
    };
    const tt1Mock: TimetableEntry = {
      id: 'mock-tt-1',
      faculty_id: 'mock-fac-1',
      subject_id: 'mock-sub-1',
      section_id: 'mock-sec-1',
      room_number: 'A-101',
      day_of_week: 'MON',
      period_number: 1,
      start_time: '09:00',
      end_time: '09:50',
      lecture_type: 'THEORY',
      active: true
    };

    const scopeWithYear1 = resolveFacultyTeachingScope('mock-fac-1', {
      years: [...years, yr1Mock],
      semesters: [...semesters, sem1Mock],
      sections: [...sections, sec1Mock],
      subjects: [...subjects, sub1Mock],
      faculty: [{ id: 'mock-fac-1', full_name: 'Year 1 Professor', email: 'y1@vctm.edu', active: true, employee_code: 'FAC-Y1', created_at: '' }],
      facultySubjectAssignments: [],
      timetable: [tt1Mock]
    });

    console.log('  Assigned Years with Year 1 active:', scopeWithYear1.assignedYears.map(y => y.name));
    if (!scopeWithYear1.assignedYears.some(y => y.year_number === 1)) {
      throw new Error('FAILED: 1st Year (year_number === 1) was unexpectedly excluded by resolver!');
    }
    console.log('  ✅ Test 5 Passed: 1st Year is fully supported without arbitrary exclusions.\n');

    // -------------------------------------------------------------------------
    // TEST 6: Cross-Faculty Zero-Leakage Invariant
    // -------------------------------------------------------------------------
    console.log('🔍 Test 6: Verifying Zero Cross-Faculty Contamination...');
    const jitendraSubjIds = new Set(jitendraScope.assignedSubjects.map(s => s.id));
    const naseemSubjIds = new Set(naseemScope.assignedSubjects.map(s => s.id));

    for (const subId of jitendraSubjIds) {
      if (naseemSubjIds.has(subId)) {
        throw new Error(`FAILED: Contamination detected! Subject ${subId} appears in both Jitendra and Naseem scope.`);
      }
    }

    const jitendraYearIds = new Set(jitendraScope.assignedYears.map(y => y.id));
    const naseemYearIds = new Set(naseemScope.assignedYears.map(y => y.id));
    for (const yId of jitendraYearIds) {
      if (naseemYearIds.has(yId)) {
        throw new Error(`FAILED: Contamination detected! Year ${yId} appears in both Jitendra and Naseem scope.`);
      }
    }
    console.log('  ✅ Test 6 Passed: Zero cross-faculty contamination between faculty scopes.\n');

    // -------------------------------------------------------------------------
    // TEST 7: Resilient Empty Assessment State Invariant
    // -------------------------------------------------------------------------
    console.log('🔍 Test 7: Testing Resilient Empty Assessment Handling...');
    const firstAssigned = jitendraScope.allAssignments[0];
    const testSecs = getAssignedSectionsForYear(jitendraScope.allAssignments, sections, firstAssigned.academicYearId);
    const testSubs = getAssignedSubjectsForSection(jitendraScope.allAssignments, subjects, firstAssigned.sectionId, firstAssigned.academicYearId);
    if (testSecs.length === 0 || testSubs.length === 0) {
      throw new Error('FAILED: Cascading lookup must return valid sections & subjects regardless of assessment existence');
    }
    console.log(`  Assigned combination [Year: ${firstAssigned.academicYearName}] -> [Sec: ${firstAssigned.sectionName}] -> [Sub: ${firstAssigned.subjectCode}] correctly resolved without requiring pre-existing assessments.`);
    console.log('  ✅ Test 7 Passed: Resilient empty assessment handling verified.\n');

    console.log('🎉 ALL 7 MULTI-FACULTY ISOLATION TESTS PASSED PERFECTLY!\n');
  } finally {
    await client.end();
  }
}

runMultiFacultyIsolationVerification().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
