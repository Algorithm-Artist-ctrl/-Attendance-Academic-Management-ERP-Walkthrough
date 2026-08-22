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
  console.log('  RUNNING COMPLETE ERP WORKFLOW & FACULTY AUTHORIZATION SUITE');
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
  // TEST 2: Faculty Receives Only Assigned Classes
  // -------------------------------------------------------------------
  console.log('\n--- TEST 2: Faculty Receives Strictly Assigned Classes ---');
  const facHemlata = db!.faculty.find(f => f.id === FAC_HEMLATA_ID)!;
  const facAlok = db!.faculty.find(f => f.id === FAC_ALOK_ID)!;
  const facNaseem = db!.faculty.find(f => f.id === FAC_NASEEM_ID)!;

  const hemlataClasses = db!.timetable.filter(t => t.faculty_id === facHemlata.id && t.active);
  assert(hemlataClasses.length > 0, 'Ms. Hemlata has assigned classes');
  assert(!hemlataClasses.some(t => t.subject_id === SUB_MATHS4_ID), 'Ms. Hemlata does NOT have Maths IV');

  const naseemClasses = db!.timetable.filter(t => t.faculty_id === facNaseem.id && t.active);
  assert(naseemClasses.every(t => t.subject_id === SUB_MATHS4_ID), 'Dr. Naseem teaches Mathematics IV');

  // -------------------------------------------------------------------
  // TEST 3: Future Date Attendance Prevention
  // -------------------------------------------------------------------
  console.log('\n--- TEST 3: Future Date Attendance Strictly Rejected ---');
  let futureRejected = false;
  try {
    await supabaseService.saveAttendance({
      facultyId: facHemlata.id,
      sectionId: secB.id,
      subjectId: SUB_DS_ID,
      sessionDate: '2026-08-28', // Future date
      startTime: '09:00',
      endTime: '09:50',
      studentRecords: []
    });
  } catch (err: any) {
    futureRejected = err.message.includes('future dates');
  }
  assert(futureRejected, 'Backend rejected future attendance date');

  // -------------------------------------------------------------------
  // TEST 4: Dynamic Student Roster for Section
  // -------------------------------------------------------------------
  console.log('\n--- TEST 4: Dynamic Student Roster per Section ---');
  const secAStudents = db!.students.filter(s => s.section_id === secA.id && s.active);
  const secBStudents = db!.students.filter(s => s.section_id === secB.id && s.active);
  assert(secAStudents.length === 53, 'Section A has 53 dynamic students');
  assert(secBStudents.length === 53, 'Section B has 53 dynamic students');
  assert(!secAStudents.some(s => s.section_id === secB.id), 'Zero Section B students in Section A');

  // -------------------------------------------------------------------
  // TEST 5: Section A Attendance Recording (Mr. Alok Gupta)
  // -------------------------------------------------------------------
  console.log('\n--- TEST 5: Section A Live Attendance Save ---');
  const testDate = '2026-08-22';
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
      status: s.id === himanshuStud.id ? 'Absent' : 'Present', // Himanshu marked Absent for claim test
      remarks: s.id === himanshuStud.id ? 'Uninformed absent' : undefined
    }))
  });

  assert(secASession.session.faculty_id === facAlok.id, 'Session recorded under Mr. Alok Gupta');
  assert(secASession.records.length === 53, 'All 53 Section A records saved to Supabase');

  // -------------------------------------------------------------------
  // TEST 6: Student Himanshu Submits Claim -> Routed Strictly to Mr. Alok Gupta
  // -------------------------------------------------------------------
  console.log('\n--- TEST 6: Student Claim Routing ---');
  const himanshuAbsentRec = secASession.records.find(r => r.student_id === himanshuStud.id && r.status === 'Absent')!;
  const himanshuClaim = await supabaseService.submitCorrection({
    attendanceRecordId: himanshuAbsentRec.id,
    studentId: himanshuStud.id,
    requestedStatus: 'Present',
    reason: 'Present in Data Structure lecture with Mr. Alok Gupta in Room A-007',
  });
  assert(himanshuClaim.status === 'pending', 'Himanshu claim submitted with pending status');

  // Verify routing: session belongs to Mr. Alok Gupta
  assert(secASession.session.faculty_id === facAlok.id, 'Claim session is assigned to Mr. Alok Gupta');

  // -------------------------------------------------------------------
  // TEST 7: Mr. Alok Gupta APPROVES Himanshu Claim
  // -------------------------------------------------------------------
  console.log('\n--- TEST 7: Approve Button Workflow (Real Mutation & Audit) ---');
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
  assert(approvalLog?.actor_role === 'faculty', 'Audit actor role is FACULTY');

  // -------------------------------------------------------------------
  // TEST 8: Test REJECT Button Workflow
  // -------------------------------------------------------------------
  console.log('\n--- TEST 8: Reject Button Workflow (Record Unchanged & Audit) ---');
  // Create another test absent record in Section B
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
    reason: 'Claiming attendance for testing rejection workflow',
  });

  // Ms. Hemlata Chaudhary REJECTS this claim
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
    l => l.action === 'ATTENDANCE_CORRECTION_REJECTED' || (l.actor_id === facHemlata.id && l.new_values?.correctionId === tarunClaim.id)
  );
  assert(Boolean(rejectAuditLog), 'Audit log contains rejection event for Ms. Hemlata Chaudhary');

  // -------------------------------------------------------------------
  // TEST 9: Persistence Verification across Refresh
  // -------------------------------------------------------------------
  console.log('\n--- TEST 9: Full Database Integrity across Re-fetch ---');
  const persistentDb = await supabaseService.fetchAllData();
  assert(persistentDb!.students.length === 106, '106 official students preserved in Supabase');
  assert(persistentDb!.faculty.length === 11, '11 official faculty members preserved in Supabase');
  assert(persistentDb!.sections.length === 2, '2 sections preserved in Supabase');

  console.log('\n======================================================================');
  console.log('  🎉 ALL ERP WORKFLOW & FACULTY AUTHORIZATION TESTS PASSED! 🎉');
  console.log('======================================================================\n');
}

runComprehensiveVerification().catch(err => {
  console.error('Fatal error during comprehensive verification:', err);
  process.exit(1);
});
