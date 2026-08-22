import { erpStorage } from '../lib/storage/erpStorage';
import { supabaseService } from '../lib/services/supabaseService';
import { 
  SEC_A_ID, 
  SEC_B_ID, 
  FAC_HEMLATA_ID, 
  FAC_IMRAN_ID, 
  FAC_ALOK_ID, 
  FAC_NASEEM_ID,
  FAC_WASIM_ID,
  SUB_DS_ID, 
  SUB_DSTL_ID,
  SUB_MATHS4_ID
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

function assert(condition: boolean, testName: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${testName}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${testName}`);
  }
}

async function runComprehensiveVerification() {
  console.log('======================================================================');
  console.log('  RUNNING COMPLETE ERP WORKFLOW, TIMETABLE & FACULTY INTEGRITY SUITE');
  console.log('======================================================================\n');

  // Load authoritative database from Supabase
  const db = await supabaseService.fetchAllData();
  assert(Boolean(db), 'Authoritative database fetched from Supabase Cloud');
  erpStorage.syncFromSupabase(db!);

  const secA = db!.sections.find(s => s.name === 'A')!;
  const secB = db!.sections.find(s => s.name === 'B')!;

  // -------------------------------------------------------------------
  // TEST 1: Admin-Published Timetable Stores Complete Lecture Attributes
  // -------------------------------------------------------------------
  console.log('--- TEST 1: Timetable Master Architecture ---');
  const sampleEntry = db!.timetable[0];
  assert(Boolean(sampleEntry.subject_id), 'Timetable stores subject_id');
  assert(Boolean(sampleEntry.faculty_id), 'Timetable stores faculty_id');
  assert(Boolean(sampleEntry.section_id), 'Timetable stores section_id');
  assert(Boolean(sampleEntry.room_number), 'Timetable stores room_number');
  assert(Boolean(sampleEntry.start_time), 'Timetable stores start_time');
  assert(Boolean(sampleEntry.end_time), 'Timetable stores end_time');
  assert(Boolean(sampleEntry.period_number), 'Timetable stores period_number');
  assert(Boolean(sampleEntry.day_of_week), 'Timetable stores day_of_week');

  // -------------------------------------------------------------------
  // TEST 2: Faculty Timetable Generation (Ms. Hemlata Chaudhary)
  // -------------------------------------------------------------------
  console.log('\n--- TEST 2: Ms. Hemlata Chaudhary Faculty Timetable ---');
  const facHemlata = db!.faculty.find(f => f.id === FAC_HEMLATA_ID)!;
  const hemlataEntries = db!.timetable.filter(t => t.faculty_id === facHemlata.id && t.active);
  assert(hemlataEntries.length > 0, 'Ms. Hemlata has published timetable entries');
  assert(!hemlataEntries.some(t => t.subject_id === SUB_MATHS4_ID), 'Zero Mathematics IV entries in Ms. Hemlata timetable');
  
  const hemlataSecA = hemlataEntries.filter(t => t.section_id === secA.id);
  assert(hemlataSecA.every(t => t.subject_id === SUB_DSTL_ID), 'Ms. Hemlata teaches strictly DSTL in Section A');
  
  const hemlataSecB = hemlataEntries.filter(t => t.section_id === secB.id);
  assert(hemlataSecB.some(t => t.subject_id === SUB_DS_ID), 'Ms. Hemlata teaches Data Structure in Section B');

  // -------------------------------------------------------------------
  // TEST 3: Faculty Timetable Generation (Dr. Naseem Ahamad Khan)
  // -------------------------------------------------------------------
  console.log('\n--- TEST 3: Dr. Naseem Ahamad Khan Faculty Timetable ---');
  const facNaseem = db!.faculty.find(f => f.id === FAC_NASEEM_ID)!;
  const naseemEntries = db!.timetable.filter(t => t.faculty_id === facNaseem.id && t.active);
  assert(naseemEntries.length > 0, 'Dr. Naseem has published timetable entries');
  assert(naseemEntries.every(t => t.subject_id === SUB_MATHS4_ID), 'Dr. Naseem teaches Mathematics IV');

  // -------------------------------------------------------------------
  // TEST 4: Faculty Timetable Generation (Mr. Alok Gupta)
  // -------------------------------------------------------------------
  console.log('\n--- TEST 4: Mr. Alok Gupta Faculty Timetable ---');
  const facAlok = db!.faculty.find(f => f.id === FAC_ALOK_ID)!;
  const alokEntries = db!.timetable.filter(t => t.faculty_id === facAlok.id && t.active);
  assert(alokEntries.length > 0, 'Mr. Alok Gupta has published timetable entries');
  assert(alokEntries.every(t => t.section_id === secA.id), 'Mr. Alok Gupta teaches strictly Section A');
  assert(alokEntries.some(t => t.subject_id === SUB_DS_ID), 'Mr. Alok Gupta teaches Data Structure in Section A');

  // -------------------------------------------------------------------
  // TEST 5: Student Timetable Isolation (Section A vs Section B)
  // -------------------------------------------------------------------
  console.log('\n--- TEST 5: Student Timetable Section Isolation ---');
  const studA = db!.students.find(s => s.roll_number === '2503400100001')!; // ADITYA KUMAR
  const studB = db!.students.find(s => s.roll_number === '2503400100057')!; // TARUN KUSHWAH
  
  const studATimetable = db!.timetable.filter(t => t.section_id === studA.section_id && t.active);
  const studBTimetable = db!.timetable.filter(t => t.section_id === studB.section_id && t.active);
  
  assert(studATimetable.length === 42, 'Student A receives exactly 42 Section A weekly lectures');
  assert(studBTimetable.length === 42, 'Student B receives exactly 42 Section B weekly lectures');
  assert(studATimetable.every(t => t.section_id === secA.id), 'Zero Section B entries in Student A view');
  assert(studBTimetable.every(t => t.section_id === secB.id), 'Zero Section A entries in Student B view');

  // -------------------------------------------------------------------
  // TEST 6: Live Attendance Recording & Read-Only Context Locking
  // -------------------------------------------------------------------
  console.log('\n--- TEST 6: Live Attendance Recording (Mr. Alok Gupta - Section A) ---');
  const testDate = '2026-08-22';
  const secAStudents = db!.students.filter(s => s.section_id === secA.id && s.active);
  const himanshuStud = secAStudents.find(s => s.full_name.toLowerCase().includes('himanshu') || s.roll_number === '2503400100021') || secAStudents[1];

  const secASession = await supabaseService.saveAttendance({
    facultyId: facAlok.id,
    sectionId: secA.id,
    subjectId: SUB_DS_ID,
    sessionDate: testDate,
    startTime: '11:30',
    endTime: '12:20',
    studentRecords: secAStudents.map(s => ({
      studentId: s.id,
      status: s.id === himanshuStud.id ? 'Absent' : 'Present',
      remarks: s.id === himanshuStud.id ? 'Uninformed absent' : undefined
    }))
  });

  assert(secASession.session.faculty_id === facAlok.id, 'Session recorded under Mr. Alok Gupta');
  assert(secASession.records.length === 53, 'All 53 Section A records saved to Supabase');

  // -------------------------------------------------------------------
  // TEST 7: Approve Button Workflow (Real Mutation & Audit)
  // -------------------------------------------------------------------
  console.log('\n--- TEST 7: Approve Button Workflow (Real Mutation & Audit) ---');
  const himanshuAbsentRec = secASession.records.find(r => r.student_id === himanshuStud.id && r.status === 'Absent')!;
  const himanshuClaim = await supabaseService.submitCorrection({
    attendanceRecordId: himanshuAbsentRec.id,
    studentId: himanshuStud.id,
    requestedStatus: 'Present',
    reason: 'Present in Data Structure lecture with Mr. Alok Gupta in Room A-007',
  });
  assert(himanshuClaim.status === 'pending', 'Himanshu claim submitted with pending status');

  const approvedClaim = await supabaseService.reviewCorrection({
    correctionId: himanshuClaim.id,
    status: 'approved',
    reviewerFacultyId: facAlok.id,
    reviewRemarks: 'Attendance discrepancy verified and rectified in database.',
  });
  assert(approvedClaim.status === 'approved', 'Correction status mutated to approved');

  const afterApproveDb = await supabaseService.fetchAllData();
  const himanshuUpdatedRec = afterApproveDb!.attendanceRecords.find(r => r.id === himanshuAbsentRec.id);
  assert(himanshuUpdatedRec?.status === 'Present', 'Attendance record mutated from Absent to Present in database');

  const approvalLog = afterApproveDb!.auditLogs.find(
    l => l.action === 'ATTENDANCE_CORRECTION_APPROVED' && l.actor_id === facAlok.id
  );
  assert(Boolean(approvalLog), 'Audit log recorded ATTENDANCE_CORRECTION_APPROVED event');
  assert(approvalLog?.actor_name === 'Mr. Alok Gupta', 'Audit actor is Mr. Alok Gupta (NOT System/Admin)');

  // -------------------------------------------------------------------
  // TEST 8: Reject Button Workflow (Record Unchanged & Audit)
  // -------------------------------------------------------------------
  console.log('\n--- TEST 8: Reject Button Workflow (Record Unchanged & Audit) ---');
  const secBStudents = db!.students.filter(s => s.section_id === secB.id && s.active);
  const tarunStud = secBStudents.find(s => s.roll_number === '2503400100057')!;
  const secBSession = await supabaseService.saveAttendance({
    facultyId: facHemlata.id,
    sectionId: secB.id,
    subjectId: SUB_DS_ID,
    sessionDate: testDate,
    startTime: '09:00',
    endTime: '09:50',
    studentRecords: secBStudents.map(s => ({
      studentId: s.id,
      status: s.id === tarunStud.id ? 'Absent' : 'Present',
      remarks: s.id === tarunStud.id ? 'Uninformed absent' : undefined
    }))
  });

  const tarunAbsentRec = secBSession.records.find(r => r.student_id === tarunStud.id && r.status === 'Absent')!;
  const tarunClaim = await supabaseService.submitCorrection({
    attendanceRecordId: tarunAbsentRec.id,
    studentId: tarunStud.id,
    requestedStatus: 'Present',
    reason: 'Testing rejection workflow',
  });

  const rejectedClaim = await supabaseService.reviewCorrection({
    correctionId: tarunClaim.id,
    status: 'rejected',
    reviewerFacultyId: facHemlata.id,
    reviewRemarks: 'Attendance roll call verified; absence confirmed.',
  });
  assert(rejectedClaim.status === 'rejected', 'Correction status mutated to rejected');

  const afterRejectDb = await supabaseService.fetchAllData();
  const tarunRecordAfterReject = afterRejectDb!.attendanceRecords.find(r => r.id === tarunAbsentRec.id);
  assert(tarunRecordAfterReject?.status === 'Absent', 'Original attendance status remains ABSENT');

  const rejectAuditLog = afterRejectDb!.auditLogs.find(
    l => l.action === 'ATTENDANCE_CORRECTION_REJECTED' && l.actor_id === facHemlata.id
  );
  assert(Boolean(rejectAuditLog), 'Audit log contains ATTENDANCE_CORRECTION_REJECTED event');
  assert(rejectAuditLog?.actor_name === 'Ms. Hemlata Chaudhary', 'Rejection audit actor is Ms. Hemlata Chaudhary');

  // -------------------------------------------------------------------
  // TEST 9: Persistence Verification across Refresh
  // -------------------------------------------------------------------
  console.log('\n--- TEST 9: Full Database Integrity across Re-fetch ---');
  const persistentDb = await supabaseService.fetchAllData();
  assert(persistentDb!.students.length === 106, '106 official students preserved in Supabase');
  assert(persistentDb!.faculty.length === 11, '11 official faculty members preserved in Supabase');
  assert(persistentDb!.sections.length === 2, '2 sections preserved in Supabase');

  console.log('\n======================================================================');
  console.log('  🎉 ALL ERP WORKFLOW, TIMETABLE & FACULTY INTEGRITY TESTS PASSED! 🎉');
  console.log('======================================================================\n');
}

runComprehensiveVerification().catch(err => {
  console.error('Fatal error during comprehensive verification:', err);
  process.exit(1);
});
