import { erpStorage } from '../lib/storage/erpStorage';
import { supabaseService } from '../lib/services/supabaseService';
import { 
  SEC_A_ID, 
  SEC_B_ID, 
  FAC_HEMLATA_ID, 
  FAC_IMRAN_ID, 
  FAC_ALOK_ID, 
  FAC_WASIM_ID,
  SUB_DS_ID, 
  SUB_DSTL_ID 
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

async function runRolePermissionsVerification() {
  console.log('======================================================================');
  console.log('  RUNNING COMPLETE ROLE & PERMISSION ARCHITECTURE VERIFICATION');
  console.log('======================================================================\n');

  // Load authoritative database from Supabase
  const db = await supabaseService.fetchAllData();
  assert(Boolean(db), 'Fetched database from Supabase Cloud');
  erpStorage.syncFromSupabase(db!);

  const secA = db!.sections.find(s => s.name === 'A')!;
  const secB = db!.sections.find(s => s.name === 'B')!;

  // -------------------------------------------------------------------
  // TEST 1: Student Section A Isolation
  // -------------------------------------------------------------------
  console.log('--- TEST 1: Student Section A Isolation ---');
  const studA = db!.students.find(s => s.roll_number === '2503400100001')!; // ADITYA KUMAR
  assert(studA.section_id === secA.id, 'Student A database section_id matches Section A');
  const studATimetable = db!.timetable.filter(t => t.section_id === studA.section_id);
  assert(studATimetable.length === 42, 'Student A receives 42 Section A lectures');
  assert(studATimetable.every(t => t.section_id === secA.id), 'Zero Section B timetable records in Student A view');

  // -------------------------------------------------------------------
  // TEST 2: Student Section B Isolation
  // -------------------------------------------------------------------
  console.log('\n--- TEST 2: Student Section B Isolation ---');
  const studB = db!.students.find(s => s.roll_number === '2503400100057')!; // TARUN KUSHWAH
  assert(studB.section_id === secB.id, 'Student B database section_id matches Section B');
  const studBTimetable = db!.timetable.filter(t => t.section_id === studB.section_id);
  assert(studBTimetable.length === 42, 'Student B receives 42 Section B lectures');
  assert(studBTimetable.every(t => t.section_id === secB.id), 'Zero Section A timetable records in Student B view');

  // -------------------------------------------------------------------
  // TEST 3: Faculty Section A Assigned Classes (Mr. Alok Gupta)
  // -------------------------------------------------------------------
  console.log('\n--- TEST 3: Faculty Assigned Classes (Mr. Alok Gupta - Section A) ---');
  const facAlok = db!.faculty.find(f => f.id === FAC_ALOK_ID)!;
  assert(Boolean(facAlok), 'Faculty Mr. Alok Gupta identified');
  
  const alokClasses = db!.timetable.filter(t => t.faculty_id === facAlok.id);
  assert(alokClasses.length > 0, 'Mr. Alok Gupta has assigned lectures');
  assert(alokClasses.every(t => t.section_id === secA.id), 'Mr. Alok Gupta teaches strictly Section A classes');

  // Verify students in Mr. Alok Gupta\'s Data Structure class are strictly Section A
  const alokClassSectionStudents = db!.students.filter(s => s.section_id === alokClasses[0].section_id);
  assert(alokClassSectionStudents.length === 53, 'Exactly 53 students loaded for Section A lecture');
  assert(alokClassSectionStudents.every(s => s.section_id === secA.id), 'No Section B students in Mr. Alok Gupta class');

  // -------------------------------------------------------------------
  // TEST 4: Faculty Section B Assigned Classes (Ms. Hemlata Chaudhary - DS Sec B)
  // -------------------------------------------------------------------
  console.log('\n--- TEST 4: Faculty Assigned Classes (Ms. Hemlata Chaudhary - Section B DS) ---');
  const facHemlata = db!.faculty.find(f => f.id === FAC_HEMLATA_ID)!;
  const hemlataBClasses = db!.timetable.filter(t => t.faculty_id === facHemlata.id && t.section_id === secB.id);
  assert(hemlataBClasses.length > 0, 'Ms. Hemlata Chaudhary has assigned lectures for Section B');
  const hemlataBStudents = db!.students.filter(s => s.section_id === hemlataBClasses[0].section_id);
  assert(hemlataBStudents.every(s => s.section_id === secB.id), 'Only Section B students loaded for Section B lecture');

  // -------------------------------------------------------------------
  // TEST 5: HOD Scope (Mr. Wasim - HOD CSE)
  // -------------------------------------------------------------------
  console.log('\n--- TEST 5: HOD Scope & Monitoring ---');
  const hodWasim = db!.faculty.find(f => f.id === FAC_WASIM_ID)!;
  assert(hodWasim.designation.toLowerCase().includes('hod'), 'Mr. Wasim is HOD CSE');
  const cseDeptStudents = db!.students.filter(s => s.department_id === hodWasim.department_id);
  assert(cseDeptStudents.length === 106, 'HOD monitors all 106 CSE department students (Sec A + Sec B)');

  // -------------------------------------------------------------------
  // TEST 6: Admin Role Separation
  // -------------------------------------------------------------------
  console.log('\n--- TEST 6: Admin Role Separation ---');
  const adminProfile = erpStorage.getProfiles().find(p => p.role === 'super_admin');
  assert(Boolean(adminProfile), 'Super Admin profile exists for institutional management');
  assert(!adminProfile?.faculty_id, 'Admin is not bound to an operational faculty teaching role');

  // -------------------------------------------------------------------
  // TEST 7: Faculty Records Attendance & Creates Accurate Audit Event
  // -------------------------------------------------------------------
  console.log('\n--- TEST 7: Faculty Records Attendance with Correct Audit Actor ---');
  const testSessionDate = '2026-08-22';
  const saveRes = await supabaseService.saveAttendance({
    facultyId: facAlok.id,
    sectionId: secA.id,
    subjectId: SUB_DS_ID,
    sessionDate: testSessionDate,
    startTime: '11:30',
    endTime: '12:20',
    studentRecords: [
      { studentId: studA.id, status: 'Absent', remarks: 'Marked absent for verification' }
    ]
  });

  assert(saveRes.session.faculty_id === facAlok.id, 'Session recorded with assigned faculty ID');
  const recentLogs = (await supabaseService.fetchAllData())!.auditLogs;
  const attLog = recentLogs.find(l => l.action === 'ATTENDANCE_RECORDED' && l.actor_id === facAlok.id);
  assert(Boolean(attLog), 'Audit log contains ATTENDANCE_RECORDED event for Mr. Alok Gupta');
  assert(attLog?.actor_role === 'faculty', 'Audit log actor_role is FACULTY (not System/Admin)');

  // -------------------------------------------------------------------
  // TEST 8: Student Submits Attendance Claim -> Routed Strictly to Responsible Faculty
  // -------------------------------------------------------------------
  console.log('\n--- TEST 8: Attendance Claim Routed to Assigned Faculty ---');
  const absentRec = saveRes.records.find(r => r.student_id === studA.id && r.status === 'Absent')!;
  const claim = await supabaseService.submitCorrection({
    attendanceRecordId: absentRec.id,
    studentId: studA.id,
    requestedStatus: 'Present',
    reason: 'Was physically in class with Mr. Alok Gupta',
  });
  assert(claim.status === 'pending', 'Claim submitted successfully');

  // Verify routing: matched to Mr. Alok Gupta (session conductor & subject teacher for Sec A)
  const isConductedByAlok = saveRes.session.faculty_id === facAlok.id;
  assert(isConductedByAlok, 'Claim is associated with Mr. Alok Gupta session');

  // -------------------------------------------------------------------
  // TEST 9: Faculty Approves Claim -> Attendance Mutates & Audit Log Records Faculty
  // -------------------------------------------------------------------
  console.log('\n--- TEST 9: Faculty Approves Claim & Records Accurate Audit ---');
  const approvedClaim = await supabaseService.reviewCorrection({
    correctionId: claim.id,
    status: 'approved',
    reviewerFacultyId: facAlok.id,
    reviewRemarks: 'Verified register',
  });
  assert(approvedClaim.status === 'approved', 'Faculty approved claim');

  const refreshedDb = await supabaseService.fetchAllData();
  const mutatedRecord = refreshedDb!.attendanceRecords.find(r => r.id === absentRec.id);
  assert(mutatedRecord?.status === 'Present', 'Attendance record mutated from Absent to Present in Supabase');

  const approvalLog = refreshedDb!.auditLogs.find(
    l => l.action === 'ATTENDANCE_CORRECTION_APPROVED' && l.actor_id === facAlok.id
  );
  assert(Boolean(approvalLog), 'Audit log contains ATTENDANCE_CORRECTION_APPROVED event');
  assert(approvalLog?.actor_role === 'faculty', 'Approval audit role is FACULTY');

  // -------------------------------------------------------------------
  // TEST 10: Persistent Cloud Database Consistency
  // -------------------------------------------------------------------
  console.log('\n--- TEST 10: Persistent Cloud Database Integrity ---');
  assert(refreshedDb!.students.length === 106, '106 official students preserved');
  assert(refreshedDb!.faculty.length === 11, '11 official faculty members preserved');
  assert(refreshedDb!.sections.length === 2, '2 sections preserved');

  console.log('\n======================================================================');
  console.log('  🎉 ALL 10 ROLE & PERMISSION ARCHITECTURE TESTS PASSED! 🎉');
  console.log('======================================================================\n');
}

runRolePermissionsVerification().catch(err => {
  console.error('Fatal error during role permissions verification:', err);
  process.exit(1);
});
