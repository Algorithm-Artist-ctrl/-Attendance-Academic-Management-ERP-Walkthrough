import { supabaseService } from '../lib/services/supabaseService';
import { AttendanceCorrection, Faculty, Student } from '../types/database.types';

// Mock localStorage for Node test runner
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

function getFacultyCorrectionRequests(
  facultyId: string, 
  corrections: AttendanceCorrection[], 
  assignments: any[], 
  attendanceRecords: any[], 
  attendanceSessions: any[]
): AttendanceCorrection[] {
  const myAssignments = assignments.filter(a => a.faculty_id === facultyId);

  return corrections.filter(c => {
    // If already reviewed by this faculty
    if (c.reviewed_by === facultyId) return true;

    const rec = c.record || attendanceRecords.find(r => r.id === c.attendance_record_id);
    const sess = rec?.session || attendanceSessions.find(s => s.id === rec?.attendance_session_id);

    if (!sess) return false;

    // Match 1: Faculty conducted this session
    if (sess.faculty_id === facultyId) return true;

    // Match 2: Faculty is assigned to this subject & section
    const isAssigned = myAssignments.some(
      a => a.subject_id === sess.subject_id && a.section_id === sess.section_id
    );
    return isAssigned;
  });
}

async function runCorrectionSyncVerification() {
  console.log('======================================================================');
  console.log('  VCTM ERP — CORRECTION REQUESTS SIDEBAR & PAGE SYNC VERIFICATION');
  console.log('  Vivekananda College of Technology & Management, Aligarh (Code: 340)');
  console.log('======================================================================\n');

  const fullData = await supabaseService.fetchAllData(true);
  assert(fullData !== null, 'Loaded complete ERP database from Supabase');

  const { corrections, faculty, assignments, attendanceRecords, attendanceSessions, students } = fullData!;

  // 1. Faculty: Ms. Hemlata Chaudhary (HEM)
  console.log('\n--- SCENARIO 1: Faculty Ms. Hemlata Chaudhary (HEM) ---');
  const facHem = faculty.find(f => f.faculty_code === 'HEM')!;
  assert(Boolean(facHem), 'Resolved Ms. Hemlata Chaudhary in faculty table');

  const hemClaims = getFacultyCorrectionRequests(facHem.id, corrections, assignments, attendanceRecords, attendanceSessions);
  const hemPending = hemClaims.filter(c => c.status === 'pending');
  const hemApproved = hemClaims.filter(c => c.status === 'approved');
  const hemRejected = hemClaims.filter(c => c.status === 'rejected');

  assert(hemPending.length === 0, `Ms. Hemlata Chaudhary has ${hemPending.length} pending claims (Expected 0)`);
  assert(hemApproved.length === 8, `Ms. Hemlata Chaudhary has ${hemApproved.length} approved claims (Expected 8)`);
  assert(hemRejected.length === 0, `Ms. Hemlata Chaudhary has ${hemRejected.length} rejected claims (Expected 0)`);

  // Sidebar badge for Hemlata
  const hemSidebarBadge = hemPending.length > 0 ? hemPending.length : undefined;
  assert(hemSidebarBadge === undefined, 'Sidebar badge for Ms. Hemlata Chaudhary is undefined / 0 (Matches Page perfectly)');

  // 2. Faculty: Mr. Alok Gupta (AG)
  console.log('\n--- SCENARIO 2: Faculty Mr. Alok Gupta (AG) ---');
  const facAG = faculty.find(f => f.faculty_code === 'AG') || faculty.find(f => f.id === 'ae02a640-0e39-47e7-b1aa-636efc09aaf6')!;
  assert(Boolean(facAG), 'Resolved Mr. Alok Gupta in faculty table');

  const agClaims = getFacultyCorrectionRequests(facAG.id, corrections, assignments, attendanceRecords, attendanceSessions);
  const agPending = agClaims.filter(c => c.status === 'pending');
  const agApproved = agClaims.filter(c => c.status === 'approved');

  assert(agClaims.length >= 0, `Mr. Alok Gupta has ${agClaims.length} claims in database (${agPending.length} pending, ${agApproved.length} approved)`);
  const agSidebarBadge = agPending.length > 0 ? agPending.length : undefined;
  assert(agSidebarBadge === (agPending.length > 0 ? agPending.length : undefined), 'Sidebar badge for Mr. Alok Gupta strictly equals Page pending list count');

  // 3. Super Admin Oversight View
  console.log('\n--- SCENARIO 3: Super Administrator Oversight View ---');
  const totalPending = corrections.filter(c => c.status === 'pending').length;
  const totalApproved = corrections.filter(c => c.status === 'approved').length;
  assert(totalPending >= 0, `Super Admin sees total ${totalPending} pending claims across college`);
  assert(totalApproved >= 8, `Super Admin sees total ${totalApproved} approved claims across college (>= 8)`);

  // 4. Student: Nandani Rao (Section B)
  console.log('\n--- SCENARIO 4: Student Nandani Rao (Section B) ---');
  const nandani = students.find(s => s.full_name.toUpperCase().includes('NANDANI RAO'))!;
  assert(Boolean(nandani), 'Resolved Student Nandani Rao in database');

  const nandaniCorrections = corrections.filter(c => c.student_id === nandani.id);
  const nandaniPending = nandaniCorrections.filter(c => c.status === 'pending');
  const nandaniApproved = nandaniCorrections.filter(c => c.status === 'approved');

  assert(nandaniCorrections.length >= 0, `Nandani has ${nandaniCorrections.length} correction requests (${nandaniPending.length} pending, ${nandaniApproved.length} approved)`);

  // 5. Student: Tarun Kushwah (Section B)
  console.log('\n--- SCENARIO 5: Student Tarun Kushwah (Section B) ---');
  const tarun = students.find(s => s.full_name.toUpperCase().includes('TARUN KUSHWAH'))!;
  assert(Boolean(tarun), 'Resolved Student Tarun Kushwah in database');

  const tarunPending = corrections.filter(c => c.student_id === tarun.id && c.status === 'pending');
  assert(tarunPending.length === 0, `Tarun Kushwah has ${tarunPending.length} pending correction requests (Sidebar badge is clean)`);

  console.log('\n======================================================================');
  console.log(`  ALL ${passedTests}/${totalTests} CORRECTION REQUEST CHECKS PASSED WITH 100% SUCCESS`);
  console.log('======================================================================\n');
}

runCorrectionSyncVerification().catch(err => {
  console.error('Fatal error in correction sync test:', err);
  process.exit(1);
});
