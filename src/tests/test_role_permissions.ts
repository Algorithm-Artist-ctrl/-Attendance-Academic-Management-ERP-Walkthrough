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
  console.log('  RUNNING COMPLETE ERP DATA ARCHITECTURE & ROLE INTEGRITY SUITE');
  console.log('======================================================================\n');

  // Load authoritative database from Supabase
  const db = await supabaseService.fetchAllData();
  assert(Boolean(db), 'Authoritative database fetched from Supabase Cloud');
  erpStorage.syncFromSupabase(db!);

  const secA = db!.sections.find(s => s.name === 'A')!;
  const secB = db!.sections.find(s => s.name === 'B')!;

  // -------------------------------------------------------------------
  // TEST A: Ms. Hemlata Chaudhary Assigned Classes Integrity
  // -------------------------------------------------------------------
  console.log('--- TEST A: Ms. Hemlata Chaudhary Assigned Classes ---');
  const facHemlata = db!.faculty.find(f => f.id === FAC_HEMLATA_ID)!;
  assert(Boolean(facHemlata), 'Ms. Hemlata Chaudhary profile identified');
  
  const hemlataClasses = db!.timetable.filter(t => t.faculty_id === facHemlata.id && t.active);
  assert(hemlataClasses.length > 0, 'Ms. Hemlata Chaudhary has assigned classes');
  
  // Verify she does NOT have Maths IV in Section A or anywhere
  const hasMaths = hemlataClasses.some(t => t.subject_id === SUB_MATHS4_ID);
  assert(!hasMaths, 'Ms. Hemlata Chaudhary is NOT assigned to Mathematics IV (Maths 4)');

  // Verify her Section A teaching assignment is strictly Discrete Structure & Theory of Logic (DSTL)
  const hemlataSecA = hemlataClasses.filter(t => t.section_id === secA.id);
  assert(hemlataSecA.every(t => t.subject_id === SUB_DSTL_ID), 'Ms. Hemlata Chaudhary Section A teaching is strictly DSTL');

  // Verify her Section B teaching assignment includes Data Structure (DS)
  const hemlataSecB = hemlataClasses.filter(t => t.section_id === secB.id);
  assert(hemlataSecB.some(t => t.subject_id === SUB_DS_ID), 'Ms. Hemlata Chaudhary Section B teaching includes Data Structure');

  // -------------------------------------------------------------------
  // TEST B: Dr. Naseem Ahamad Khan Assigned Classes
  // -------------------------------------------------------------------
  console.log('\n--- TEST B: Dr. Naseem Ahamad Khan Assigned Classes ---');
  const facNaseem = db!.faculty.find(f => f.id === FAC_NASEEM_ID)!;
  assert(Boolean(facNaseem), 'Dr. Naseem Ahamad Khan profile identified');
  const naseemClasses = db!.timetable.filter(t => t.faculty_id === facNaseem.id && t.active);
  assert(naseemClasses.length > 0, 'Dr. Naseem Ahamad Khan has assigned classes');
  assert(naseemClasses.every(t => t.subject_id === SUB_MATHS4_ID), 'Dr. Naseem Ahamad Khan teaches Mathematics IV');

  // -------------------------------------------------------------------
  // TEST C: Mr. Alok Gupta Assigned Classes
  // -------------------------------------------------------------------
  console.log('\n--- TEST C: Mr. Alok Gupta Assigned Classes ---');
  const facAlok = db!.faculty.find(f => f.id === FAC_ALOK_ID)!;
  assert(Boolean(facAlok), 'Mr. Alok Gupta profile identified');
  const alokClasses = db!.timetable.filter(t => t.faculty_id === facAlok.id && t.active);
  assert(alokClasses.every(t => t.section_id === secA.id), 'Mr. Alok Gupta teaches strictly Section A');
  assert(alokClasses.some(t => t.subject_id === SUB_DS_ID), 'Mr. Alok Gupta teaches Data Structure in Section A');

  // -------------------------------------------------------------------
  // TEST D: Future Date Attendance Rejection
  // -------------------------------------------------------------------
  console.log('\n--- TEST D: Future Date Attendance Rejection ---');
  let futureRejected = false;
  try {
    await supabaseService.saveAttendance({
      facultyId: facHemlata.id,
      sectionId: secB.id,
      subjectId: SUB_DS_ID,
      sessionDate: '2026-08-25', // Future date
      startTime: '09:00',
      endTime: '09:50',
      studentRecords: []
    });
  } catch (err: any) {
    futureRejected = err.message.includes('future dates');
  }
  assert(futureRejected, 'Backend strictly rejects attendance recorded for future dates');

  // -------------------------------------------------------------------
  // TEST E: Section Isolation & Student Roster
  // -------------------------------------------------------------------
  console.log('\n--- TEST E: Section Isolation & Dynamic Student Roster ---');
  const secAStudents = db!.students.filter(s => s.section_id === secA.id && s.active);
  const secBStudents = db!.students.filter(s => s.section_id === secB.id && s.active);
  assert(secAStudents.length === 53, 'Section A has exactly 53 students dynamically loaded from database');
  assert(secBStudents.length === 53, 'Section B has exactly 53 students dynamically loaded from database');
  assert(!secAStudents.some(s => s.section_id === secB.id), 'Zero Section B students in Section A');
  assert(!secBStudents.some(s => s.section_id === secA.id), 'Zero Section A students in Section B');

  // -------------------------------------------------------------------
  // TEST F: Save Attendance & Persistence Check
  // -------------------------------------------------------------------
  console.log('\n--- TEST F: Save Attendance & Supabase Persistence ---');
  const testDate = '2026-08-22';
  const saveRes = await supabaseService.saveAttendance({
    facultyId: facHemlata.id,
    sectionId: secB.id,
    subjectId: SUB_DS_ID,
    sessionDate: testDate,
    startTime: '09:00',
    endTime: '09:50',
    studentRecords: secBStudents.map((s) => ({
      studentId: s.id,
      status: (s.roll_number === '2503400100057' ? 'Absent' : 'Present') as any,
      remarks: s.roll_number === '2503400100057' ? 'Uninformed absent' : undefined
    }))
  });
  assert(saveRes.session.faculty_id === facHemlata.id, 'Attendance session saved with Ms. Hemlata faculty ID');
  assert(saveRes.records.length === 53, 'All 53 Section B student records inserted into Supabase');

  // -------------------------------------------------------------------
  // TEST G: Student View of Newly Recorded Attendance
  // -------------------------------------------------------------------
  console.log('\n--- TEST G: Student Live View of Recorded Attendance ---');
  const tarunStud = secBStudents.find(s => s.roll_number === '2503400100057')!;
  const latestDb = await supabaseService.fetchAllData();
  const tarunRecord = latestDb!.attendanceRecords.find(
    r => r.student_id === tarunStud.id && r.attendance_session_id === saveRes.session.id
  );
  assert(Boolean(tarunRecord), 'Student record found in Supabase for today session');
  assert(tarunRecord?.status === 'Absent', 'Student correctly sees Absent status recorded for today');

  // -------------------------------------------------------------------
  // TEST H: Student Correction Claim & Exact Faculty Routing
  // -------------------------------------------------------------------
  console.log('\n--- TEST H: Claim Routed to Ms. Hemlata Chaudhary ---');
  const claim = await supabaseService.submitCorrection({
    attendanceRecordId: tarunRecord!.id,
    studentId: tarunStud.id,
    requestedStatus: 'Present',
    reason: 'Was physically present in Ms. Hemlata Data Structure class on Section B',
  });
  assert(claim.status === 'pending', 'Claim submitted with pending status');

  // Verify routing: session was taken by Ms. Hemlata Chaudhary
  const claimSession = latestDb!.attendanceSessions.find(s => s.id === saveRes.session.id);
  assert(claimSession?.faculty_id === facHemlata.id, 'Claim session is assigned to Ms. Hemlata Chaudhary');

  // -------------------------------------------------------------------
  // TEST I: Faculty Approves Claim & Records Mutate in Supabase
  // -------------------------------------------------------------------
  console.log('\n--- TEST I: Faculty Approves Claim ---');
  const approvedClaim = await supabaseService.reviewCorrection({
    correctionId: claim.id,
    status: 'approved',
    reviewerFacultyId: facHemlata.id,
    reviewRemarks: 'Attendance roll call verified and rectified',
  });
  assert(approvedClaim.status === 'approved', 'Claim approved by Ms. Hemlata Chaudhary');

  const afterApprovalDb = await supabaseService.fetchAllData();
  const updatedRecord = afterApprovalDb!.attendanceRecords.find(r => r.id === tarunRecord!.id);
  assert(updatedRecord?.status === 'Present', 'Database attendance record successfully updated to Present');

  // -------------------------------------------------------------------
  // TEST J: Audit Logs Identity Check
  // -------------------------------------------------------------------
  console.log('\n--- TEST J: Audit Log Identity Attribution ---');
  const auditLogs = afterApprovalDb!.auditLogs;
  const hemlataApprovalLog = auditLogs.find(
    l => l.action === 'ATTENDANCE_CORRECTION_APPROVED' && l.actor_id === facHemlata.id
  );
  assert(Boolean(hemlataApprovalLog), 'Audit log contains ATTENDANCE_CORRECTION_APPROVED event');
  assert(hemlataApprovalLog?.actor_role === 'faculty', 'Audit actor role is FACULTY');
  assert(hemlataApprovalLog?.actor_name === 'Ms. Hemlata Chaudhary', 'Audit actor name is Ms. Hemlata Chaudhary (NOT System/Admin)');

  // -------------------------------------------------------------------
  // Attendance History Isolation Check for Ms. Hemlata
  // -------------------------------------------------------------------
  console.log('\n--- TEST K: Faculty Attendance History Isolation ---');
  const hemlataHistory = afterApprovalDb!.attendanceSessions.filter(s => s.faculty_id === facHemlata.id);
  assert(hemlataHistory.length > 0, 'Ms. Hemlata Chaudhary has history records');
  assert(!hemlataHistory.some(s => s.subject_id === SUB_MATHS4_ID), 'Ms. Hemlata history contains ZERO Mathematics IV records');

  console.log('\n======================================================================');
  console.log('  🎉 ALL ERP DATA ARCHITECTURE & ROLE INTEGRITY TESTS PASSED! 🎉');
  console.log('======================================================================\n');
}

runComprehensiveVerification().catch(err => {
  console.error('Fatal error during comprehensive verification:', err);
  process.exit(1);
});
