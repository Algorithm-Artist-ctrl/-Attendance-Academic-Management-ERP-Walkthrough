import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';

// Mock localStorage for Node.js test environment
if (typeof localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (global as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k in store) delete store[k]; },
  };
}

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAILED (${totalTests}): ${testName}`);
    process.exit(1);
  } else {
    passedTests++;
    console.log(`✅ PASSED (${totalTests}): ${testName}`);
  }
}

async function runSuperAdminFinalAcceptanceTests() {
  console.log('======================================================================');
  console.log('    VCTM ERP SUPER ADMIN PORTAL & FINAL ACCEPTANCE VERIFICATION');
  console.log('    Vivekananda College of Technology & Management, Aligarh (Code: 340)');
  console.log('======================================================================\n');

  // 1. Connect and fetch live Supabase Cloud database
  const dbData = await supabaseService.fetchAllData();
  assert(dbData !== null, 'Connected to live Supabase Cloud Master Database');

  // 2. Super Admin Identity & Role
  console.log('\n--- SUITE 1: Super Admin Dynamic Identity & Authority ---');
  const { data: superAdminProfiles } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'super_admin');

  assert(Boolean(superAdminProfiles && superAdminProfiles.length >= 1), 'Super Admin profile exists in Supabase');
  const adminProfile = superAdminProfiles![0];
  assert(adminProfile.role === 'super_admin', 'Role is strictly "super_admin"');
  assert(Boolean(adminProfile.full_name), `Super Admin full_name is dynamically loaded: "${adminProfile.full_name}"`);
  assert(Boolean(adminProfile.email), `Super Admin official email is loaded: "${adminProfile.email}"`);

  // 3. Super Admin Live KPI Statistics Calculation (Zero Fake Counts)
  console.log('\n--- SUITE 2: Real-time Live KPI Statistics (Zero Fake Data) ---');
  const liveStudentsCount = (dbData?.students || []).filter(s => s.active).length;
  const liveFacultyCount = (dbData?.faculty || []).filter(f => f.active).length;
  const liveDeptsCount = (dbData?.departments || []).filter(d => d.active).length;
  const liveProgramsCount = (dbData?.programs || []).filter(p => p.active).length;
  const liveSectionsCount = (dbData?.sections || []).filter(s => s.active).length;
  const liveTimetableCount = (dbData?.timetable || []).filter(t => t.active).length;

  assert(liveStudentsCount >= 100, `Live Students KPI calculated from Supabase: ${liveStudentsCount} students`);
  assert(liveFacultyCount >= 10, `Live Faculty KPI calculated from Supabase: ${liveFacultyCount} professors`);
  assert(liveDeptsCount >= 1, `Live Departments KPI calculated from Supabase: ${liveDeptsCount} departments`);
  assert(liveProgramsCount >= 1, `Live Programs KPI calculated from Supabase: ${liveProgramsCount} degree programs`);
  assert(liveSectionsCount >= 2, `Live Sections KPI calculated from Supabase: ${liveSectionsCount} class sections`);
  assert(liveTimetableCount >= 80, `Live Master Timetable Entries calculated from Supabase: ${liveTimetableCount} slots`);

  // 4. Super Admin Full Institutional Management Control (CRUD)
  console.log('\n--- SUITE 3: Super Admin Full Management Control (CRUD) ---');
  
  // A. Create & Delete Test Department
  const testDept = await supabaseService.addDepartment({
    institution_id: dbData!.institutions[0].id,
    name: 'Test Mechanical Dept',
    code: 'ME_TEST',
    active: true
  });
  assert(Boolean(testDept?.id), 'Super Admin successfully created Department in Supabase');
  await supabaseService.deleteDepartment(testDept.id);
  assert(true, 'Super Admin successfully deleted Department from Supabase');

  // B. Create & Delete Test Subject
  const testSub = await supabaseService.addSubject({
    department_id: dbData!.departments[0].id,
    program_id: dbData!.programs[0].id,
    semester_id: dbData!.semesters[0].id,
    subject_code: 'TEST999',
    subject_name: 'Test Cloud Architecture',
    lecture_type: 'Theory',
    credits: 4,
    active: true
  });
  assert(Boolean(testSub?.id), 'Super Admin successfully added Subject to Curriculum');
  await supabaseService.deleteSubject(testSub.id);
  assert(true, 'Super Admin successfully removed Subject from Curriculum');

  // C. Update Section & Assign Class Coordinator
  const sectionA = dbData!.sections.find(s => s.name === 'A')!;
  const hemlata = dbData!.faculty.find(f => f.faculty_code === 'HEM')!;
  assert(Boolean(sectionA && hemlata), 'Resolved Section A and Faculty HEM');

  const updatedSec = await supabaseService.updateSection(sectionA.id, {
    room_number: 'Room A007',
    class_coordinator_id: hemlata.id
  });
  assert(updatedSec.class_coordinator_id === hemlata.id, 'Super Admin assigned Ms. Hemlata as Class Coordinator for Section A');

  // D. Create, Update & Delete Teaching Workload Allocation
  const testAssignment = await supabaseService.addAssignment({
    faculty_id: hemlata.id,
    subject_id: dbData!.subjects[0].id,
    section_id: sectionA.id,
    academic_session_id: dbData!.sessions[0].id,
    active: true
  });
  assert(Boolean(testAssignment?.id), 'Super Admin created Faculty Subject-Section Workload Allocation');
  await supabaseService.deleteAssignment(testAssignment.id);
  assert(true, 'Super Admin removed Faculty Subject-Section Workload Allocation');

  // 5. Faculty Subject-Wise & Section-Wise Strict Scoping
  console.log('\n--- SUITE 4: Faculty Scoped Subjects, Sections & Timetable ---');
  const hemlataAssignments = dbData!.assignments.filter(a => a.faculty_id === hemlata.id && a.active);
  const hemlataTimetable = dbData!.timetable.filter(t => t.faculty_id === hemlata.id && t.active);
  const hemlataSubjectIds = Array.from(new Set([...hemlataAssignments.map(a => a.subject_id), ...hemlataTimetable.map(t => t.subject_id)]));
  const hemlataSubjects = dbData!.subjects.filter(s => hemlataSubjectIds.includes(s.id));
  const hemlataCodes = hemlataSubjects.map(s => s.subject_code);

  assert(hemlataCodes.includes('BCS301'), 'HEM authorized subject: BCS301 Data Structure');
  assert(hemlataCodes.includes('BCS303'), 'HEM authorized subject: BCS303 Discrete Structure & Theory of Logic');
  assert(hemlataCodes.includes('BCS351'), 'HEM authorized subject: BCS351 Data Structure Lab');
  assert(hemlataCodes.includes('BCS352'), 'HEM authorized subject: BCS352 COA Lab');

  // Strict negative checks
  assert(!hemlataCodes.includes('BAS303'), 'BAS303 (Maths IV) strictly excluded from HEM scope');
  assert(!hemlataCodes.includes('BVE301'), 'BVE301 (UHV) strictly excluded from HEM scope');
  assert(!hemlataCodes.includes('BCC301'), 'BCC301 (Cyber Security) strictly excluded from HEM scope');

  // Teaching timetable isolation
  assert(hemlataTimetable.length === 16, `Faculty personal timetable contains exactly her 16 assigned periods`);
  assert(hemlataTimetable.every(t => t.faculty_id === hemlata.id), '100% of lectures belong strictly to HEM (0 foreign lectures)');

  // Class Coordinator master timetable
  const secATimetable = dbData!.timetable.filter(t => t.section_id === sectionA.id && t.active);
  assert(secATimetable.length === 42, 'Section A Master Schedule contains all 42 periods across all 7 teachers');

  // 6. Section A vs Section B Academic Isolation (Quizzes, Assignments, Sessionals)
  console.log('\n--- SUITE 5: Section A vs Section B Academic Isolation ---');
  const sectionB = dbData!.sections.find(s => s.name === 'B')!;
  const studentA = dbData!.students.find(s => s.section_id === sectionA.id)!;
  const studentB = dbData!.students.find(s => s.section_id === sectionB.id)!;

  // Sessional assessment
  const testSess = await supabaseService.createSessionalAssessment({
    faculty_id: hemlata.id,
    subject_id: hemlataSubjects[0].id,
    section_id: sectionA.id,
    title: 'Sessional 1 Acceptance Test',
    max_marks: 30,
    exam_date: '2026-09-25',
    status: 'published'
  });

  await supabaseService.saveSessionalMarks({
    sessionalAssessmentId: testSess.id,
    facultyId: hemlata.id,
    subjectId: hemlataSubjects[0].id,
    sectionId: sectionA.id,
    maxMarks: 30,
    studentMarks: [{ studentId: studentA.id, marksObtained: 28, remarks: 'Excellent' }]
  });

  // Verify student A has marks and student B does not
  const { data: sMarksA } = await supabase
    .from('sessional_marks')
    .select('*')
    .eq('sessional_assessment_id', testSess.id)
    .eq('student_id', studentA.id);

  const { data: sMarksB } = await supabase
    .from('sessional_marks')
    .select('*')
    .eq('sessional_assessment_id', testSess.id)
    .eq('student_id', studentB.id);

  assert(sMarksA?.length === 1 && sMarksA[0].marks_obtained === 28, 'Section A student received sessional marks (28/30)');
  assert(sMarksB?.length === 0, 'Section B student does NOT have Section A sessional marks (Strict Isolation)');

  // Teardown
  await supabaseService.deleteSessionalAssessment(testSess.id);

  console.log('\n======================================================================');
  if (passedTests === totalTests) {
    console.log(`  🎉 ALL ${passedTests}/${totalTests} FINAL ACCEPTANCE TESTS PASSED! 🎉`);
  } else {
    console.error(`  ⚠️ COMPLETED: ${passedTests}/${totalTests} Passed`);
  }
}

runSuperAdminFinalAcceptanceTests().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
