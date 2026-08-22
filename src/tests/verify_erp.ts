import { erpStorage } from '../lib/storage/erpStorage';
import { parseAndValidateStudentCSV } from '../lib/utils/csvParser';
import { supabaseService } from '../lib/services/supabaseService';
import { SEC_A_ID, SEC_B_ID, FAC_HEMLATA_ID, FAC_IMRAN_ID, FAC_ALOK_ID, SUB_DS_ID, SUB_COA_ID } from '../lib/storage/initialSeedData';

// Mock localStorage in Node.js environment
if (typeof localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (global as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k in store) delete store[k]; },
  };
}

function assert(condition: boolean, testName: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${testName}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${testName}`);
  }
}

async function runVerificationTests() {
  console.log('=====================================================');
  console.log('  RUNNING VCTM ERP AUTOMATED VERIFICATION SUITE');
  console.log('=====================================================\n');

  // Initialize fresh seed data
  erpStorage.init(true);

  // ----------------------------------------------------
  // TEST 1: Master Data Integrity
  // ----------------------------------------------------
  console.log('--- TEST 1: Master Data Initialization ---');
  const institution = erpStorage.getInstitution();
  assert(institution.code === '340', 'Institution code is 340 (VCTM Aligarh)');

  const departments = erpStorage.getDepartments();
  assert(departments.some(d => d.code === 'CSE'), 'CSE Department is initialized');

  const faculty = erpStorage.getFaculty();
  assert(faculty.length >= 11, 'All 11 faculty members (including HOD Wasim) initialized');
  assert(faculty.some(f => f.faculty_code === 'HEM' && f.full_name === 'Ms. Hemlata Chaudhary'), 'Ms. Hemlata Chaudhary mapped');
  assert(faculty.some(f => f.faculty_code === 'IRK' && f.full_name === 'Mr. Imran Raza Khan'), 'Mr. Imran Raza Khan mapped');

  const students = erpStorage.getStudents();
  const secAStudents = students.filter(s => s.section_id === SEC_A_ID);
  const secBStudents = students.filter(s => s.section_id === SEC_B_ID);
  assert(secAStudents.length === 53, 'Section A has exactly 53 students as per official document');
  assert(secBStudents.length === 53, 'Section B has exactly 53 students as per official document');
  assert(students.length === 106, 'Total students enrolled is 106');

  const timetable = erpStorage.getTimetable();
  assert(timetable.length >= 70, 'Complete Monday-Saturday timetable loaded for Sections A & B');

  // ----------------------------------------------------
  // TEST 2: Student Attendance Calculations
  // ----------------------------------------------------
  console.log('\n--- TEST 2: Student Attendance Calculations ---');
  const testStudent = secAStudents[0];
  const stats = erpStorage.calculateStudentAttendance(testStudent.id);
  assert(typeof stats.percentage === 'number', 'Student attendance percentage is calculated');
  assert(stats.totalLectures >= 1, 'Historical recorded lectures are counted');
  assert(stats.subjectStats.length === 10, 'All 10 curriculum subjects are tracked in statistics');

  // ----------------------------------------------------
  // TEST 3: Faculty Attendance Marking
  // ----------------------------------------------------
  console.log('\n--- TEST 3: Faculty Live Attendance Marking ---');
  const newDate = '2026-08-23';
  const saveResult = erpStorage.saveAttendanceSession({
    facultyId: FAC_ALOK_ID,
    sectionId: SEC_A_ID,
    subjectId: SUB_DS_ID,
    sessionDate: newDate,
    startTime: '11:30',
    endTime: '12:20',
    studentRecords: secAStudents.map((s, idx) => ({
      studentId: s.id,
      status: idx === 0 ? 'Absent' : 'Present',
      remarks: idx === 0 ? 'Late entry' : undefined,
    })),
  });

  assert(saveResult.session.status === 'completed', 'Attendance session completed and saved');
  assert(saveResult.records.length === 53, '53 attendance records inserted for Section A');

  // Verify student view reflects the update immediately
  const updatedStudentStats = erpStorage.calculateStudentAttendance(testStudent.id);
  assert(updatedStudentStats.totalLectures === stats.totalLectures + 1, 'Total lectures incremented for student');

  // ----------------------------------------------------
  // TEST 4: Attendance Correction & Audit Workflow
  // ----------------------------------------------------
  console.log('\n--- TEST 4: Attendance Correction & Audit Workflow ---');
  const absentRecord = saveResult.records.find(r => r.student_id === testStudent.id && r.status === 'Absent');
  assert(Boolean(absentRecord), 'Absent record identified for correction');

  const correction = erpStorage.submitCorrectionRequest({
    attendanceRecordId: absentRecord!.id,
    studentId: testStudent.id,
    requestedStatus: 'Present',
    reason: 'I was present in the class, was not called.',
  });
  assert(correction.status === 'pending', 'Correction request submitted with pending status');

  const reviewedCorrection = erpStorage.reviewCorrectionRequest({
    correctionId: correction.id,
    status: 'approved',
    reviewerFacultyId: FAC_ALOK_ID,
    reviewRemarks: 'Verified physical presence in lab register',
  });
  assert(reviewedCorrection.status === 'approved', 'Correction approved by faculty');

  const records = erpStorage.getAttendanceRecords();
  const mutatedRecord = records.find(r => r.id === absentRecord!.id);
  assert(mutatedRecord?.status === 'Present', 'Attendance record successfully changed to Present in database');

  const logs = erpStorage.getAuditLogs();
  assert(logs.some(l => l.action === 'CORRECTION_APPROVED'), 'Audit log created for attendance rectification');

  // ----------------------------------------------------
  // TEST 5: Timetable Conflict Detection Engine
  // ----------------------------------------------------
  console.log('\n--- TEST 5: Timetable Conflict Engine ---');
  const conflictingFacultyEntry = {
    section_id: SEC_B_ID,
    subject_id: SUB_COA_ID,
    faculty_id: 'fac-kuldeep-05',
    day_of_week: 'MON' as const,
    period_number: 1,
    start_time: '09:00',
    end_time: '09:50',
    room_number: 'Room A 009',
    lecture_type: 'Theory' as const,
    active: true,
  };
  const facultyConflict = erpStorage.checkTimetableConflict(conflictingFacultyEntry);
  assert(Boolean(facultyConflict && facultyConflict.type === 'faculty'), 'Faculty schedule collision successfully caught');

  const conflictingRoomEntry = {
    section_id: 'sec-new',
    subject_id: SUB_COA_ID,
    faculty_id: 'fac-new',
    day_of_week: 'MON' as const,
    period_number: 1,
    start_time: '09:00',
    end_time: '09:50',
    room_number: 'Room A 007',
    lecture_type: 'Theory' as const,
    active: true,
  };
  const roomConflict = erpStorage.checkTimetableConflict(conflictingRoomEntry);
  assert(Boolean(roomConflict && roomConflict.type === 'room'), 'Room double-booking collision successfully caught');

  // ----------------------------------------------------
  // TEST 6: Student CSV Bulk Importer Validation
  // ----------------------------------------------------
  console.log('\n--- TEST 6: CSV Bulk Importer Validation ---');
  const sampleCSV = `roll_number,full_name,admission_type,section,mentor
2503400100999,NEW STUDENT ONE,Regular,A,Ms. Hemlata Chaudhary
2503400100001,DUPLICATE ADITYA,Regular,A,Ms. Hemlata Chaudhary
,MISSING ROLL STUDENT,Regular,A,Ms. Hemlata Chaudhary`;

  const csvResult = await parseAndValidateStudentCSV(sampleCSV, {
    institutionId: institution.id,
    departmentId: 'dept-cse-01',
    programId: 'prog-btech-cse-01',
    sessionId: 'session-2026-2027',
    yearId: 'year-2nd-btech-01',
    semesterId: 'sem-3rd-odd-01',
    defaultSectionId: SEC_A_ID,
    sections: [{ id: SEC_A_ID, name: 'A' }, { id: SEC_B_ID, name: 'B' }],
    faculty: faculty.map(f => ({ id: f.id, full_name: f.full_name, employee_code: f.employee_code })),
    existingStudents: students,
  });

  assert(csvResult.validRows.length === 1, 'Exactly 1 valid student record parsed');
  assert(csvResult.invalidRows.length === 2, '2 invalid rows caught (1 duplicate roll, 1 missing roll)');

  // ----------------------------------------------------
  // TEST 7: Dynamic Academic Scaling
  // ----------------------------------------------------
  console.log('\n--- TEST 7: Dynamic Academic Scaling ---');
  const newDept = erpStorage.addDepartment({
    institution_id: institution.id,
    name: 'Mechanical Engineering',
    code: 'ME',
    active: true,
  });
  assert(erpStorage.getDepartments().some(d => d.code === 'ME'), 'New department created dynamically');

  // ----------------------------------------------------
  // TEST 8: Real Supabase Cloud Database Persistence
  // ----------------------------------------------------
  console.log('\n--- TEST 8: Real Supabase Cloud Database Live Persistence ---');
  const supabaseData = await supabaseService.fetchAllData();
  assert(Boolean(supabaseData && supabaseData.students.length >= 106), 'Loaded 106 official students from Supabase cloud');
  assert(Boolean(supabaseData && supabaseData.faculty.length >= 11), 'Loaded 11 official faculty members from Supabase cloud');
  assert(Boolean(supabaseData && supabaseData.timetable.length >= 70), 'Loaded complete weekly timetable from Supabase cloud');

  // ----------------------------------------------------
  // TEST 9: Section A vs Section B Zero Cross-Leakage Validation
  // ----------------------------------------------------
  console.log('\n--- TEST 9: Section A vs Section B Strict Isolation ---');
  const secA = supabaseData!.sections.find(s => s.name === 'A')!;
  const secB = supabaseData!.sections.find(s => s.name === 'B')!;

  assert(secA.room_number.includes('007'), 'Section A room is A-007');
  assert(secB.room_number.includes('006'), 'Section B room is A-006');

  // Verify Tarun Kushwah is in Section B
  const tarun = supabaseData!.students.find(s => s.roll_number === '2503400100057');
  assert(Boolean(tarun && tarun.section_id === secB.id), 'Tarun Kushwah (2503400100057) is strictly enrolled in Section B');

  // Verify Section A vs Section B subject-faculty assignments
  const dsSub = supabaseData!.subjects.find(s => s.subject_code === 'BCS301')!;
  const secADsAssign = supabaseData!.assignments.find(a => a.section_id === secA.id && a.subject_id === dsSub.id);
  const secBDsAssign = supabaseData!.assignments.find(a => a.section_id === secB.id && a.subject_id === dsSub.id);

  const secAFac = supabaseData!.faculty.find(f => f.id === secADsAssign?.faculty_id);
  const secBFac = supabaseData!.faculty.find(f => f.id === secBDsAssign?.faculty_id);

  assert(secAFac?.full_name === 'Mr. Alok Gupta', 'Section A Data Structure is taught by Mr. Alok Gupta');
  assert(secBFac?.full_name === 'Ms. Hemlata Chaudhary', 'Section B Data Structure is taught by Ms. Hemlata Chaudhary');

  console.log('\n=====================================================');
  console.log('  🎉 ALL 9 AUTOMATED VERIFICATION TESTS PASSED! 🎉');
  console.log('=====================================================\n');
}

runVerificationTests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
