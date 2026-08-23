import { erpStorage } from '../lib/storage/erpStorage';
import { supabaseService } from '../lib/services/supabaseService';
import { 
  INST_ID,
  DEPT_CSE_ID,
  SEC_A_ID, 
  SEC_B_ID, 
  FAC_HEMLATA_ID, 
  FAC_IMRAN_ID, 
  FAC_ALOK_ID, 
  FAC_NASEEM_ID,
  FAC_WASIM_ID,
  SUB_DS_ID, 
  SUB_DSTL_ID,
  SUB_MATHS4_ID,
  SUB_COA_ID
} from '../lib/storage/initialSeedData';

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

let passedCount = 0;
let totalCount = 0;

function assert(condition: boolean, testName: string) {
  totalCount++;
  if (!condition) {
    console.error(`❌ FAILED (${totalCount}): ${testName}`);
    process.exit(1);
  } else {
    passedCount++;
    console.log(`✅ PASSED (${totalCount}): ${testName}`);
  }
}

async function runMasterERPVerification() {
  console.log('======================================================================');
  console.log('    VCTM ERP COMPLETE END-TO-END SYSTEM & FEATURE VERIFICATION');
  console.log('    Vivekananda College of Technology & Management, Aligarh (Code: 340)');
  console.log('======================================================================\n');

  // 1. Authoritative Supabase Cloud Connection & Sync
  console.log('--- SUITE 1: Supabase Cloud & Master Data Integrity ---');
  const db = await supabaseService.fetchAllData();
  assert(Boolean(db), 'Fetched complete authoritative database from Supabase Cloud');
  erpStorage.syncFromSupabase(db!);

  assert(db!.institutions.length >= 1 && db!.institutions[0].code === '340', 'Institution 340 (VCTM Aligarh) active');
  assert(db!.departments.length >= 1 && db!.departments[0].code === 'CSE', 'CSE Department active');
  assert(db!.sections.length === 2, 'Exactly 2 Sections (Section A & Section B) exist');
  assert(db!.students.length === 106, '106 official enrolled students preserved in Supabase (53 Sec A, 53 Sec B)');
  assert(db!.faculty.length === 11, '11 official faculty members preserved in Supabase');
  assert(db!.subjects.length === 10, 'All 10 B.Tech 3rd Semester curriculum subjects initialized');
  assert(db!.timetable.length === 84, 'Complete 84 weekly timetable entries published (42 Sec A, 42 Sec B)');

  // 2. Section A vs Section B Strict Isolation
  console.log('\n--- SUITE 2: Section A vs Section B Strict Isolation ---');
  const secA = db!.sections.find(s => s.name === 'A')!;
  const secB = db!.sections.find(s => s.name === 'B')!;
  assert(secA.room_number.includes('A 007') || secA.room_number.includes('A-007'), 'Section A assigned to Room A 007');
  assert(secB.room_number.includes('A 006') || secB.room_number.includes('A-006'), 'Section B assigned to Room A 006');

  const studA = db!.students.find(s => s.roll_number === '2503400100001')!; // ADITYA KUMAR
  const studB = db!.students.find(s => s.roll_number === '2503400100057')!; // TARUN KUSHWAH
  assert(studA.section_id === secA.id, 'Aditya Kumar strictly mapped to Section A in database');
  assert(studB.section_id === secB.id, 'Tarun Kushwah strictly mapped to Section B in database');

  const ttSecA = db!.timetable.filter(t => t.section_id === secA.id && t.active);
  const ttSecB = db!.timetable.filter(t => t.section_id === secB.id && t.active);
  assert(ttSecA.length === 42, 'Section A has exactly 42 weekly lectures');
  assert(ttSecB.length === 42, 'Section B has exactly 42 weekly lectures');

  // Cross-check Section A vs B faculty assignments
  const secA_DS = ttSecA.find(t => t.subject_id === SUB_DS_ID && t.day_of_week === 'MON');
  const secB_DS = ttSecB.find(t => t.subject_id === SUB_DS_ID && t.day_of_week === 'MON');
  assert(secA_DS?.faculty_id === FAC_ALOK_ID, 'Section A Data Structure taught by Mr. Alok Gupta');
  assert(secB_DS?.faculty_id === FAC_HEMLATA_ID, 'Section B Data Structure taught by Ms. Hemlata Chaudhary');

  const secA_DSTL = ttSecA.find(t => t.subject_id === SUB_DSTL_ID && t.day_of_week === 'MON');
  const secB_DSTL = ttSecB.find(t => t.subject_id === SUB_DSTL_ID && t.day_of_week === 'MON');
  assert(secA_DSTL?.faculty_id === FAC_HEMLATA_ID, 'Section A DSTL taught by Ms. Hemlata Chaudhary');
  assert(secB_DSTL?.faculty_id === FAC_IMRAN_ID, 'Section B DSTL taught by Mr. Imran Raza Khan');

  // 3. Faculty Multi-Section Timetable Integrity
  console.log('\n--- SUITE 3: Faculty Multi-Section Timetable Authority ---');
  const facHemlata = db!.faculty.find(f => f.id === FAC_HEMLATA_ID)!;
  const hemlataTT = db!.timetable.filter(t => t.faculty_id === facHemlata.id && t.active);
  assert(hemlataTT.length === 16, 'Ms. Hemlata Chaudhary has 16 weekly lectures');
  assert(hemlataTT.some(t => t.section_id === secA.id), 'Ms. Hemlata teaches in Section A');
  assert(hemlataTT.some(t => t.section_id === secB.id), 'Ms. Hemlata teaches in Section B');
  assert(!hemlataTT.some(t => t.subject_id === SUB_MATHS4_ID), 'Zero Maths IV lectures assigned to Ms. Hemlata');

  const facNaseem = db!.faculty.find(f => f.id === FAC_NASEEM_ID)!;
  const naseemTT = db!.timetable.filter(t => t.faculty_id === facNaseem.id && t.active);
  assert(naseemTT.every(t => t.subject_id === SUB_MATHS4_ID), 'Dr. Naseem teaches strictly Mathematics IV');

  // 4. Future Attendance Date Prevention
  console.log('\n--- SUITE 4: Future Attendance Prevention Rule ---');
  let futureBlocked = false;
  try {
    await supabaseService.saveAttendance({
      facultyId: facHemlata.id,
      sectionId: secB.id,
      subjectId: SUB_DS_ID,
      sessionDate: '2026-08-30', // Future date
      startTime: '09:00',
      endTime: '09:50',
      studentRecords: []
    });
  } catch (err: any) {
    futureBlocked = err.message.includes('future dates');
  }
  assert(futureBlocked, 'Backend validation strictly rejected future attendance date');

  // 5. Live Attendance Marking & Audit Logging
  console.log('\n--- SUITE 5: Live Attendance Marking & Audit Actor Fidelity ---');
  const testDate = '2026-08-22';
  const secAStudents = db!.students.filter(s => s.section_id === secA.id && s.active);
  const targetStudent = secAStudents[2]; // e.g. 3rd student marked Absent for claim test

  const savedSession = await supabaseService.saveAttendance({
    facultyId: FAC_ALOK_ID,
    sectionId: secA.id,
    subjectId: SUB_DS_ID,
    sessionDate: testDate,
    startTime: '11:30',
    endTime: '12:20',
    studentRecords: secAStudents.map(s => ({
      studentId: s.id,
      status: s.id === targetStudent.id ? 'Absent' : 'Present',
      remarks: s.id === targetStudent.id ? 'Uninformed absent' : undefined
    }))
  });

  assert(savedSession.session.faculty_id === FAC_ALOK_ID, 'Attendance session conducted under Mr. Alok Gupta');
  assert(savedSession.records.length === 53, 'All 53 student records saved to database');

  const absentRecord = savedSession.records.find(r => r.student_id === targetStudent.id && r.status === 'Absent')!;
  assert(Boolean(absentRecord), 'Target student recorded as Absent');

  // 6. Attendance Claim Workflow (Submit -> Route -> Approve)
  console.log('\n--- SUITE 6: Attendance Claim Adjudication Workflow ---');
  const claim = await supabaseService.submitCorrection({
    attendanceRecordId: absentRecord.id,
    studentId: targetStudent.id,
    requestedStatus: 'Present',
    reason: 'Present in Data Structure lecture with Mr. Alok Gupta in Room A-007'
  });
  assert(claim.status === 'pending', 'Attendance claim submitted with pending status');

  // Faculty Mr. Alok Gupta approves claim
  const approvedClaim = await supabaseService.reviewCorrection({
    correctionId: claim.id,
    status: 'approved',
    reviewerFacultyId: FAC_ALOK_ID,
    reviewRemarks: 'Attendance verified with roll call sheet; marked Present.'
  });
  assert(approvedClaim.status === 'approved', 'Claim status mutated to approved');

  const refreshedDb = await supabaseService.fetchAllData();
  const updatedStudentRec = refreshedDb!.attendanceRecords.find(r => r.id === absentRecord.id);
  assert(updatedStudentRec?.status === 'Present', 'Attendance record mutated from Absent to Present');

  const approvalAudit = refreshedDb!.auditLogs.find(
    l => l.action === 'ATTENDANCE_CORRECTION_APPROVED' && l.actor_id === FAC_ALOK_ID
  );
  assert(Boolean(approvalAudit), 'Audit log contains ATTENDANCE_CORRECTION_APPROVED');
  assert(approvalAudit?.actor_name === 'Mr. Alok Gupta', 'Audit actor is Mr. Alok Gupta (NOT Admin)');

  // 7. Unrecorded Lecture Attendance Claim Resolution
  console.log('\n--- SUITE 7: Unrecorded Lecture Claim Resolution ---');
  const secBStudents = db!.students.filter(s => s.section_id === secB.id && s.active);
  const sumantStudent = secBStudents.find(s => s.roll_number === '2503400100056')!;
  const unrecordedTT = db!.timetable.find(t => t.section_id === secB.id && t.subject_id === SUB_DS_ID && t.day_of_week === 'MON')!;

  const { sessionId: unrecSessId, recordId: unrecRecId } = await supabaseService.ensureAttendanceSessionAndRecord({
    timetableEntryId: unrecordedTT.id,
    sessionDate: '2026-08-23',
    subjectId: SUB_DS_ID,
    facultyId: FAC_HEMLATA_ID,
    sectionId: SEC_B_ID,
    studentId: sumantStudent.id,
    status: 'Absent'
  });
  assert(Boolean(unrecSessId) && Boolean(unrecRecId), 'Unrecorded lecture session and record auto-resolved');

  // 8. Timetable Collision Detection Engine
  console.log('\n--- SUITE 8: Timetable Collision Engine ---');
  // Faculty clash test: Same faculty assigned at same day/time in different rooms
  const facultyClash = erpStorage.checkTimetableConflict({
    day_of_week: 'MON',
    period_number: 1,
    start_time: '09:00',
    end_time: '09:50',
    faculty_id: FAC_HEMLATA_ID,
    room_number: 'Room A 007', // Trying to put Hemlata in Room A 007 during Period 1 when she is in Room A 006
    section_id: secA.id,
    subject_id: SUB_DSTL_ID,
    lecture_type: 'Theory',
    active: true
  });
  assert(Boolean(facultyClash), 'Faculty schedule collision successfully detected and blocked');

  // Room clash test: Same room assigned to 2 different classes at same period
  const roomClash = erpStorage.checkTimetableConflict({
    day_of_week: 'MON',
    period_number: 1,
    start_time: '09:00',
    end_time: '09:50',
    faculty_id: FAC_IMRAN_ID,
    room_number: 'Room No. A 006', // Room A 006 already has Section B DS
    section_id: secA.id,
    subject_id: SUB_DSTL_ID,
    lecture_type: 'Theory',
    active: true
  });
  assert(Boolean(roomClash), 'Room double-booking collision successfully detected and blocked');

  // 9. CSV Bulk Importer Validation Engine
  console.log('\n--- SUITE 9: CSV Bulk Importer Validation ---');
  const { parseAndValidateStudentCSV } = await import('../lib/utils/csvParser');
  const testCSV = `Roll Number,Full Name,Email,Section,Admission Type
2503400100999,Test New Student,test.student@vctm.in,A,Regular
2503400100001,Duplicate Aditya,duplicate@vctm.in,A,Regular
,Missing Roll Student,missing@vctm.in,A,Regular`;

  const parseResult = await parseAndValidateStudentCSV(testCSV, {
    institutionId: INST_ID,
    departmentId: DEPT_CSE_ID,
    programId: db!.programs[0].id,
    sessionId: db!.sessions[0].id,
    yearId: db!.years[0].id,
    semesterId: db!.semesters[0].id,
    defaultSectionId: secA.id,
    sections: db!.sections,
    faculty: db!.faculty,
    existingStudents: db!.students,
  });
  assert(parseResult.validRows.length === 1, 'CSV parser accepted exactly 1 valid new student row');
  assert(parseResult.invalidRows.length >= 2, 'CSV parser rejected duplicate roll and missing roll rows');

  // 10. Final Cloud Database Integrity
  console.log('\n--- SUITE 10: Final Supabase Cloud Persistence ---');
  const finalDb = await supabaseService.fetchAllData();
  assert(finalDb!.students.length === 106, 'Final verification: 106 official students intact in Supabase');
  assert(finalDb!.faculty.length === 11, 'Final verification: 11 official faculty members intact in Supabase');
  assert(finalDb!.timetable.length === 84, 'Final verification: 84 weekly timetable entries intact in Supabase');

  console.log('\n======================================================================');
  console.log(`  🎉 ALL ${passedCount}/${totalCount} SYSTEM & FEATURE VERIFICATION TESTS PASSED! 🎉`);
  console.log('======================================================================\n');
}

runMasterERPVerification().catch(err => {
  console.error('Fatal error during master verification:', err);
  process.exit(1);
});
