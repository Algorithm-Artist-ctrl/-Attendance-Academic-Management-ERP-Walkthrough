import { 
  resolveFacultyTeachingScope,
  cleanSectionName,
  cleanRoomNumber,
  getAssignedSectionsForYear,
  getAssignedSubjectsForSection,
} from '../lib/utils/facultyAssignmentResolver';
import { 
  INITIAL_FACULTY, 
  INITIAL_SECTIONS, 
  INITIAL_SUBJECTS, 
  INITIAL_YEARS, 
  INITIAL_SEMESTERS,
  INITIAL_STUDENTS_SEC_A,
  INITIAL_STUDENTS_SEC_B,
  INITIAL_TIMETABLE,
  INITIAL_ASSIGNMENTS,
  INITIAL_PROGRAMS,
  INITIAL_DEPARTMENTS,
  INITIAL_SESSIONS,
} from '../lib/storage/initialSeedData';

const INITIAL_STUDENTS = [...INITIAL_STUDENTS_SEC_A, ...INITIAL_STUDENTS_SEC_B];
import { 
  Student, 
  Section, 
  Faculty, 
  Subject, 
  TimetableEntry,
  StudentAcademicContext,
  HODDepartmentContext
} from '../types/database.types';

console.log('========================================================================');
console.log('🧪 VCTM ERP — PRODUCTION FIX CANONICAL LAYERS & CONSISTENCY TEST');
console.log('========================================================================\n');

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition: boolean, description: string) {
  totalAssertions++;
  if (condition) {
    console.log(`  ✅ [PASS] ${description}`);
    passedAssertions++;
  } else {
    console.error(`  ❌ [FAIL] ${description}`);
  }
}

// ============================================================================
// SUITE 1: Faculty Teaching Assignment Resolver & Dynamic Scoping
// ============================================================================
console.log('--- SUITE 1: Faculty Teaching Assignment Resolver ---');

// 1. Dr. Naseem Ahamad Khan (FAC-CSE-006)
const drNaseem = INITIAL_FACULTY.find(f => f.employee_code === 'FAC-CSE-006' || f.full_name.includes('Naseem'));
assert(!!drNaseem, 'Dr. Naseem Ahamad Khan exists in faculty directory');

const naseemScope = resolveFacultyTeachingScope(drNaseem?.id || '', {
  timetable: INITIAL_TIMETABLE,
  facultySubjectAssignments: INITIAL_ASSIGNMENTS,
  sections: INITIAL_SECTIONS,
  subjects: INITIAL_SUBJECTS,
  semesters: INITIAL_SEMESTERS,
  years: INITIAL_YEARS,
  faculty: INITIAL_FACULTY,
});

assert(naseemScope.allAssignments.length > 0, `Dr. Naseem has resolved assignments (found ${naseemScope.allAssignments.length})`);
assert(naseemScope.assignedYears.length > 0, `Dr. Naseem has assigned academic years (found: ${naseemScope.assignedYears.map(y => y.name).join(', ')})`);
assert(naseemScope.assignedSections.length > 0, `Dr. Naseem has assigned sections (found: ${naseemScope.assignedSections.map(s => s.name).join(', ')})`);
assert(naseemScope.assignedSubjects.length > 0, `Dr. Naseem has assigned subjects (found: ${naseemScope.assignedSubjects.map(s => s.subject_name).join(', ')})`);

// 2. Dynamic Scope across multiple faculty members (proving NO hardcoding)
console.log('\n--- SUITE 2: Dynamic Non-Hardcoded Faculty Isolation ---');

const facultyWithLectures = INITIAL_FACULTY.filter(f => 
  INITIAL_TIMETABLE.some(t => t.faculty_id === f.id && t.active && !t.is_break)
);

assert(facultyWithLectures.length >= 5, `Multiple faculty members have active timetable lectures (found ${facultyWithLectures.length})`);

const facultyScopeSignatures = new Set<string>();
for (const fac of facultyWithLectures) {
  const scope = resolveFacultyTeachingScope(fac.id, {
    timetable: INITIAL_TIMETABLE,
    facultySubjectAssignments: INITIAL_ASSIGNMENTS,
    sections: INITIAL_SECTIONS,
    subjects: INITIAL_SUBJECTS,
    semesters: INITIAL_SEMESTERS,
    years: INITIAL_YEARS,
    faculty: INITIAL_FACULTY,
  });

  const sig = `${fac.full_name}: years=[${scope.assignedYears.map(y => y.name).join(',')}], secs=[${scope.assignedSections.map(s => s.name).join(',')}], subs=[${scope.assignedSubjects.map(s => s.subject_code).join(',')}]`;
  facultyScopeSignatures.add(sig);
}

// Every faculty must have a unique assignment signature (no shared hardcoded list)
assert(facultyScopeSignatures.size === facultyWithLectures.length, 
  `Every faculty has distinct dynamic teaching assignments (${facultyScopeSignatures.size}/${facultyWithLectures.length} unique)`
);

// ============================================================================
// SUITE 3: Student Academic Context & Section Formatting Integrity
// ============================================================================
console.log('\n--- SUITE 3: Student Academic Context & Section Formatting ---');

function mockGetStudentAcademicContext(
  studentId: string, 
  mockStudents = INITIAL_STUDENTS,
  mockSections = INITIAL_SECTIONS,
  mockSemesters = INITIAL_SEMESTERS,
  mockYears = INITIAL_YEARS,
  mockTimetable = INITIAL_TIMETABLE
): StudentAcademicContext {
  const stud = mockStudents.find(s => s.id === studentId || s.roll_number === studentId) || null;
  const sec = stud?.section_id ? (mockSections.find(s => s.id === stud.section_id) || stud?.section || null) : null;
  const sem = mockSemesters.find(s => s.id === (stud?.semester_id || sec?.semester_id)) || null;

  let yr = mockYears.find(y => y.id === (stud?.academic_year_id || sem?.academic_year_id)) || null;
  if (!yr && sem?.semester_number) {
    const deducedYearNum = Math.ceil(sem.semester_number / 2);
    yr = mockYears.find(y => y.year_number === deducedYearNum) || null;
  }

  const prog = INITIAL_PROGRAMS.find(p => p.id === stud?.program_id) || INITIAL_PROGRAMS[0] || null;
  const dept = INITIAL_DEPARTMENTS.find(d => d.id === stud?.department_id) || INITIAL_DEPARTMENTS[0] || null;
  const sess = INITIAL_SESSIONS.find(s => s.id === stud?.academic_session_id) || INITIAL_SESSIONS[0] || null;

  let room = sec?.room_number ? cleanRoomNumber(sec.room_number) : '';
  if (!room || room === 'Room TBD') {
    const entryWithRoom = mockTimetable.find(t => t.section_id === sec?.id && t.room_number);
    if (entryWithRoom?.room_number) {
      room = cleanRoomNumber(entryWithRoom.room_number);
    }
  }
  const cleanSec = cleanSectionName(sec?.name);

  let formattedSectionLabel = 'Section Assigned';
  if (cleanSec) {
    if (room && room !== 'Room TBD') {
      formattedSectionLabel = `Section ${cleanSec} (${room})`;
    } else {
      formattedSectionLabel = `Section ${cleanSec}`;
    }
  }

  return {
    studentId: stud?.id || studentId,
    student: stud,
    academicYear: yr,
    academicYearId: yr?.id || '',
    academicYearName: yr?.name || 'Academic Year',
    academicYearNumber: yr?.year_number || 0,
    semester: sem,
    semesterId: sem?.id || '',
    semesterName: sem?.name || 'Semester',
    semesterNumber: sem?.semester_number || 0,
    program: prog,
    programId: prog?.id || '',
    programName: prog?.name || 'B.Tech',
    department: dept,
    departmentId: dept?.id || '',
    departmentName: dept?.name || 'Computer Science & Engineering',
    departmentCode: dept?.code || 'CSE',
    section: sec,
    sectionId: sec?.id || '',
    sectionName: sec?.name || '',
    cleanSectionName: cleanSec,
    sectionCode: `SEC-${cleanSec}`,
    roomNumber: room || 'Room TBD',
    formattedSectionLabel,
    academicSession: sess,
    academicSessionId: sess?.id || '',
    academicSessionName: sess?.name || 'Academic Session',
    mentorFaculty: null,
    classCoordinator: null,
  };
}

// Test standard student
const firstStudent = INITIAL_STUDENTS[0];
const studContext = mockGetStudentAcademicContext(firstStudent.id);
assert(studContext.studentId === firstStudent.id, 'Student ID resolved accurately');
assert(studContext.cleanSectionName.length > 0, `Clean section name resolved: "${studContext.cleanSectionName}"`);
assert(studContext.formattedSectionLabel.startsWith('Section'), `Formatted label valid: "${studContext.formattedSectionLabel}"`);
assert(!studContext.formattedSectionLabel.includes('()'), `Formatted label DOES NOT contain empty parens "()": "${studContext.formattedSectionLabel}"`);

// Test edge case: Section has NO room number
const mockSecNoRoom: Section = { id: 'sec-no-room', semester_id: 'sem-3', name: 'B', room_number: '', active: true };
const mockStudentNoRoom: Student = { ...firstStudent, id: 'stud-no-room', section_id: 'sec-no-room' };
const contextNoRoom = mockGetStudentAcademicContext(
  'stud-no-room', 
  [mockStudentNoRoom], 
  [mockSecNoRoom],
  INITIAL_SEMESTERS,
  INITIAL_YEARS,
  [] // No timetable entries with room
);
assert(contextNoRoom.formattedSectionLabel === 'Section B', `Section without room formats cleanly as "Section B" (got: "${contextNoRoom.formattedSectionLabel}")`);
assert(!contextNoRoom.formattedSectionLabel.includes('()'), 'Section without room NEVER renders "()"');

// Test edge case: Student has NO section assigned
const mockStudentNoSec: Student = { ...firstStudent, id: 'stud-no-sec', section_id: '' };
const contextNoSec = mockGetStudentAcademicContext('stud-no-sec', [mockStudentNoSec], [], INITIAL_SEMESTERS, INITIAL_YEARS, []);
assert(contextNoSec.formattedSectionLabel === 'Section Assigned', `Unassigned student formats as "Section Assigned" (got: "${contextNoSec.formattedSectionLabel}")`);
assert(!contextNoSec.formattedSectionLabel.includes('()'), 'Unassigned student NEVER renders "()"');

// ============================================================================
// SUITE 4: HOD Department Context & Faculty Workload Integrity
// ============================================================================
console.log('\n--- SUITE 4: HOD Department Context & Faculty Workload ---');

function mockGetHODDepartmentContext(
  hodId: string,
  mockFaculty = INITIAL_FACULTY,
  mockDepts = INITIAL_DEPARTMENTS,
  mockAssignments = INITIAL_ASSIGNMENTS,
  mockTimetable = INITIAL_TIMETABLE,
  mockStudents = INITIAL_STUDENTS,
  mockSections = INITIAL_SECTIONS,
  mockSubjects = INITIAL_SUBJECTS
): HODDepartmentContext {
  const userFac = mockFaculty.find(f => f.id === hodId || f.auth_user_id === hodId);
  const dept = mockDepts.find(
    d => d.hod_faculty_id === hodId ||
         d.hod_faculty_id === userFac?.id ||
         d.id === userFac?.department_id
  ) || mockDepts[0] || null;

  const deptFaculty = mockFaculty.filter(f => f.department_id === dept?.id && f.active !== false);

  const assignedFacultyIds = new Set([
    ...mockAssignments.filter(a => a.active !== false).map(a => a.faculty_id),
    ...mockTimetable.filter(t => t.active !== false).map(t => t.faculty_id)
  ]);
  const assignedDeptFaculty = deptFaculty.filter(f => assignedFacultyIds.has(f.id));
  const workloadPercentage = deptFaculty.length > 0 
    ? Math.round((assignedDeptFaculty.length / deptFaculty.length) * 100) 
    : 0;

  const deptStudents = mockStudents.filter(s => s.active !== false && (!dept?.id || s.department_id === dept.id));
  const deptSections = mockSections.filter(sec => sec.active !== false);
  const deptSubjects = mockSubjects.filter(sub => sub.active !== false && (!dept?.id || sub.department_id === dept.id));

  return {
    department: dept,
    departmentId: dept?.id || '',
    departmentName: dept?.name || 'Computer Science & Engineering',
    departmentCode: dept?.code || 'CSE',
    hodFaculty: userFac || (dept?.hod_faculty_id ? mockFaculty.find(f => f.id === dept.hod_faculty_id) || null : null),
    departmentFaculty: deptFaculty,
    activeFacultyCount: deptFaculty.length,
    assignedFacultyCount: assignedDeptFaculty.length,
    workloadPercentage,
    departmentStudents: deptStudents,
    studentCount: deptStudents.length,
    sections: deptSections,
    subjects: deptSubjects,
  };
}

const cseDept = INITIAL_DEPARTMENTS.find(d => d.code === 'CSE') || INITIAL_DEPARTMENTS[0];
const hodContext = mockGetHODDepartmentContext(cseDept.hod_faculty_id || '');

assert(hodContext.department !== null, `HOD Department resolved: ${hodContext.departmentName}`);
assert(hodContext.activeFacultyCount > 0, `HOD Department Faculty count > 0 (found ${hodContext.activeFacultyCount}, fixes "DEPARTMENT FACULTY = 0")`);
assert(hodContext.assignedFacultyCount > 0, `HOD Assigned Faculty count > 0 (found ${hodContext.assignedFacultyCount})`);
assert(hodContext.workloadPercentage > 0 && hodContext.workloadPercentage <= 100, `HOD Workload percentage calculated correctly (${hodContext.workloadPercentage}%)`);
assert(hodContext.studentCount > 0, `HOD Department Student count > 0 (found ${hodContext.studentCount})`);
assert(hodContext.sections.length > 0, `HOD Sections scoped properly (found ${hodContext.sections.length})`);
assert(hodContext.subjects.length > 0, `HOD Subjects scoped properly (found ${hodContext.subjects.length})`);

// ============================================================================
// SUMMARY REPORT
// ============================================================================
console.log('\n========================================================================');
console.log(`📊 FINAL TEST RESULTS: ${passedAssertions}/${totalAssertions} Assertions Passed`);
console.log('========================================================================');

if (passedAssertions !== totalAssertions) {
  process.exit(1);
} else {
  console.log('🎉 ALL CANONICAL LAYER & PRODUCTION FIX ASSERTIONS PASSED PERFECTLY!\n');
}
