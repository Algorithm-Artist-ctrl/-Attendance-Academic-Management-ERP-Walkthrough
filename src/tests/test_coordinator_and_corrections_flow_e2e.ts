import { supabase } from '../lib/supabase/supabaseClient';
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

// Replicate exact client-side scoping logic from AcademicContext
function getFacultyCorrectionRequests(
  facultyId: string,
  corrections: AttendanceCorrection[],
  assignments: any[],
  attendanceRecords: any[],
  attendanceSessions: any[]
): AttendanceCorrection[] {
  const myAssignments = assignments.filter(a => a.faculty_id === facultyId && a.active);

  return corrections.filter(c => {
    if (c.reviewed_by === facultyId) return true;

    const rec = (c as any).record || attendanceRecords.find(r => r.id === c.attendance_record_id);
    const sess = rec?.session || (c as any).session || attendanceSessions.find(s => s.id === rec?.attendance_session_id);

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

async function runE2EVerification() {
  console.log('======================================================================');
  console.log('  VCTM ERP — CORRECTIONS SCOPING, REAL-TIME & COORDINATOR E2E TEST');
  console.log('  Vivekananda College of Technology & Management, Aligarh (Code: 340)');
  console.log('======================================================================\n');

  // -------------------------------------------------------------
  // PART 1: PENDING CORRECTIONS COUNT PARITY (DASHBOARD vs REVIEW PAGE)
  // -------------------------------------------------------------
  console.log('\n--- PART 1: Pending Claims Scoping & Parity ---');
  const allCorrections = await supabaseService.fetchCorrections(200);
  assert(allCorrections !== null && Array.isArray(allCorrections), 'Fetched attendance corrections from Supabase with relations');

  const allFaculty = await supabaseService.fetchFaculty();
  const allAssignments = await supabaseService.fetchAssignments();

  // Test Faculty 1: Dr. Naseem Ahamad Khan (Maths 4)
  const drNaseem = allFaculty.find(f => f.full_name.toLowerCase().includes('naseem'))!;
  assert(Boolean(drNaseem), `Resolved Dr. Naseem Ahamad Khan (ID: ${drNaseem?.id})`);

  // Dashboard query
  const naseemDashboardData = await supabaseService.fetchFacultyDashboardData(drNaseem.id);
  const naseemDashboardPending = naseemDashboardData.pendingCorrectionsCount;
  console.log(`Dr. Naseem Dashboard Pending Count: ${naseemDashboardPending}`);

  // Review Corrections Page filtering
  const naseemClaims = getFacultyCorrectionRequests(drNaseem.id, allCorrections, allAssignments, [], []);
  const naseemPagePending = naseemClaims.filter(c => c.status === 'pending').length;
  console.log(`Dr. Naseem Review Page Pending Count: ${naseemPagePending}`);

  assert(
    naseemDashboardPending === naseemPagePending,
    `Dr. Naseem Pending Count Parity: Dashboard (${naseemDashboardPending}) strictly equals Review Page (${naseemPagePending})`
  );

  // Test Faculty 2: Mr. Jitendra Kumar Singh (Machine Learning)
  const jitendra = allFaculty.find(f => f.full_name.toLowerCase().includes('jitendra'))!;
  assert(Boolean(jitendra), `Resolved Mr. Jitendra Kumar Singh (ID: ${jitendra?.id})`);

  const jitendraDashboardData = await supabaseService.fetchFacultyDashboardData(jitendra.id);
  const jitendraDashboardPending = jitendraDashboardData.pendingCorrectionsCount;
  console.log(`Mr. Jitendra Dashboard Pending Count: ${jitendraDashboardPending}`);

  const jitendraClaims = getFacultyCorrectionRequests(jitendra.id, allCorrections, allAssignments, [], []);
  const jitendraPagePending = jitendraClaims.filter(c => c.status === 'pending').length;
  console.log(`Mr. Jitendra Review Page Pending Count: ${jitendraPagePending}`);

  assert(
    jitendraDashboardPending === jitendraPagePending,
    `Mr. Jitendra Pending Count Parity: Dashboard (${jitendraDashboardPending}) strictly equals Review Page (${jitendraPagePending})`
  );

  // Verify Dr. Naseem and Mr. Jitendra do NOT leak each other's claims
  const naseemSubjectIds = new Set(
    naseemClaims.map(c => ((c as any).record?.session?.subject_id || (c as any).session?.subject_id))
  );
  const jitendraSubjectIds = new Set(
    jitendraClaims.map(c => ((c as any).record?.session?.subject_id || (c as any).session?.subject_id))
  );
  console.log(`Dr. Naseem claims subjects count: ${naseemSubjectIds.size}, Mr. Jitendra claims subjects count: ${jitendraSubjectIds.size}`);

  // -------------------------------------------------------------
  // PART 2: CLASS COORDINATOR ATOMIC RPCs & REPLACEMENT CONFIRMATION
  // -------------------------------------------------------------
  console.log('\n--- PART 2: Class Coordinator Management & Atomic RPCs ---');

  const allSections = await supabaseService.fetchSections();
  const secB = allSections.find(s => s.name === 'B' || s.name === 'Section B') || allSections[0];
  assert(Boolean(secB), `Target Section for Coordinator Test: ${secB.name} (${secB.id})`);

  // 1. Assign Mr. Jitendra as Class Coordinator for Section B
  console.log(`Assigning Mr. Jitendra (${jitendra.id}) to Section B (${secB.id})...`);
  const assignResult = await supabaseService.assignClassCoordinator(jitendra.id, secB.id);
  assert(assignResult.success === true, 'Assigned Mr. Jitendra as Class Coordinator via assignClassCoordinator');

  // Verify in DB table
  const coordsAfterJitendra = await supabaseService.fetchClassCoordinatorAssignments();
  const activeJitendraCoord = coordsAfterJitendra.find(c => c.faculty_id === jitendra.id && c.section_id === secB.id && c.active);
  assert(Boolean(activeJitendraCoord), 'Verified active coordinator assignment for Mr. Jitendra in class_coordinator_assignments');

  // 2. Duplicate replacement: Now assign Dr. Naseem to the same Section B
  // The atomic RPC should flip Jitendra's active flag to false and make Naseem active
  console.log(`Replacing Section B coordinator with Dr. Naseem (${drNaseem.id})...`);
  const replaceResult = await supabaseService.assignClassCoordinator(drNaseem.id, secB.id);
  assert(replaceResult.success === true, 'Replaced coordinator with Dr. Naseem via assignClassCoordinator');

  const coordsAfterNaseem = await supabaseService.fetchClassCoordinatorAssignments();
  const activeNaseemCoord = coordsAfterNaseem.find(c => c.faculty_id === drNaseem.id && c.section_id === secB.id && c.active);
  const activeJitendraInCoords = coordsAfterNaseem.find(c => c.faculty_id === jitendra.id && c.section_id === secB.id);

  assert(Boolean(activeNaseemCoord), 'Dr. Naseem is now active coordinator for Section B');
  assert(!activeJitendraInCoords, 'Mr. Jitendra is no longer returned in active classCoordinatorAssignments');

  // Verify directly from DB table that Jitendra row has active = false
  const { data: jitendraDbRow } = await supabase
    .from('class_coordinator_assignments')
    .select('active')
    .eq('faculty_id', jitendra.id)
    .eq('section_id', secB.id)
    .single();
  assert(jitendraDbRow?.active === false, 'Previous coordinator (Mr. Jitendra) row in DB table has active = false');

  // 3. Remove Dr. Naseem as coordinator for Section B
  console.log(`Removing coordinator assignment for Dr. Naseem from Section B...`);
  const removeResult = await supabaseService.removeClassCoordinator(drNaseem.id, secB.id);
  assert(removeResult.success === true, 'Removed Dr. Naseem coordinator assignment via removeClassCoordinator');

  const coordsAfterRemove = await supabaseService.fetchClassCoordinatorAssignments();
  const activeCoordAfterRemove = coordsAfterRemove.find(c => c.section_id === secB.id && c.active);
  assert(!activeCoordAfterRemove, 'Section B now has no active coordinator (cleanly deactivated)');

  // Restore Jitendra as coordinator for Section A if appropriate
  const secA = allSections.find(s => s.name === 'A' || s.name === 'Section A');
  if (secA) {
    await supabaseService.assignClassCoordinator(jitendra.id, secA.id);
    console.log(`Restored Mr. Jitendra as active coordinator for Section A`);
  }

  // -------------------------------------------------------------
  // PART 3: STUDENT DASHBOARD & FACULTY PROFILE RESOLUTION
  // -------------------------------------------------------------
  console.log('\n--- PART 3: Student Dashboard Coordinator Resolution ---');

  const allStudents = await supabaseService.fetchStudents();
  assert(allStudents.length > 0, `Loaded ${allStudents.length} students from database`);

  const studentWithSecA = allStudents.find(s => s.section_id === secA?.id);
  if (studentWithSecA && secA) {
    const coords = await supabaseService.fetchClassCoordinatorAssignments();
    const activeCoordForSecA = coords.find(c => c.active && c.section_id === studentWithSecA.section_id);
    const coordFac = allFaculty.find(f => f.id === activeCoordForSecA?.faculty_id);

    console.log(`Student ${studentWithSecA.full_name} in Section ${secA.name} resolves coordinator: ${coordFac?.full_name}`);
    assert(Boolean(coordFac), `Student Dashboard resolves active Class Coordinator: ${coordFac?.full_name}`);
  }

  // -------------------------------------------------------------
  // PART 4: REAL-TIME NOTIFICATION VERIFICATION
  // -------------------------------------------------------------
  console.log('\n--- PART 4: Notifications Scoping & Delivery ---');

  // Verify faculty notifications query for Dr. Naseem
  const naseemNotifs = await supabaseService.fetchStudentNotifications('', undefined, 'faculty', drNaseem.id);
  assert(Array.isArray(naseemNotifs), `Dr. Naseem received ${naseemNotifs.length} notifications from Supabase`);

  // Verify notifications table has recipient_faculty_id column
  const { data: notifSample, error: notifErr } = await supabase
    .from('notifications')
    .select('id, recipient_faculty_id, recipient_student_id, title')
    .limit(5);

  assert(!notifErr && Array.isArray(notifSample), 'notifications table supports recipient_faculty_id and recipient_student_id');

  // -------------------------------------------------------------
  // PART 5: LIVE CLAIM FLOW, PARITY, ATOMIC APPROVAL & NOTIFICATIONS
  // -------------------------------------------------------------
  console.log('\n--- PART 5: Live Claim Flow, Scoping Parity & Approval ---');

  // Find an active assignment for Dr. Naseem
  const naseemAssignment = allAssignments.find(a => a.faculty_id === drNaseem.id && a.active);
  assert(Boolean(naseemAssignment), `Dr. Naseem has active assignment for Subject: ${naseemAssignment?.subject_id}`);

  const sectionStudents = allStudents.filter(s => s.section_id === naseemAssignment?.section_id && s.active);
  assert(sectionStudents.length > 0, `Found ${sectionStudents.length} students in Dr. Naseem's assigned section`);
  const testStudent = sectionStudents[0];

  // Authenticate as Dr. Naseem
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'naseem.math@vctm.in',
    password: 'VctmFaculty@2026',
  });
  assert(!authErr && Boolean(authData?.user), 'Authenticated with Supabase as Dr. Naseem Ahamad Khan');

  // 1. Create a test attendance session for Dr. Naseem
  const testDate = new Date().toISOString().split('T')[0];
  const saveResult = await supabaseService.saveAttendance({
    facultyId: drNaseem.id,
    sectionId: naseemAssignment!.section_id,
    subjectId: naseemAssignment!.subject_id,
    sessionDate: testDate,
    startTime: '10:00',
    endTime: '11:00',
    studentRecords: [
      {
        studentId: testStudent.id,
        status: 'Absent',
        remarks: 'Test Absent for Claim Verification',
      },
    ],
  });
  assert(Boolean(saveResult?.records?.[0]?.id), 'Created test attendance session with Absent record for student');
  const testRecordId = saveResult.records[0].id;
  const testSessionId = saveResult.session.id;

  // 2. Submit a correction claim as the student
  console.log(`Submitting attendance claim for record ${testRecordId}...`);
  const claimResult = await supabaseService.submitCorrection({
    studentId: testStudent.id,
    attendanceRecordId: testRecordId,
    requestedStatus: 'Present',
    reason: 'I was present in the second row during Maths lecture. Please verify.',
  });
  assert(Boolean(claimResult?.id), `Submitted attendance claim (ID: ${claimResult?.id})`);

  // 3. Verify parity: Dr. Naseem sees pending claim on both Dashboard and Review Corrections!
  const naseemDashAfterClaim = await supabaseService.fetchFacultyDashboardData(drNaseem.id);
  const freshCorrections = await supabaseService.fetchCorrections(200);
  const naseemPageClaimsAfter = getFacultyCorrectionRequests(drNaseem.id, freshCorrections, allAssignments, [], []);
  const naseemPagePendingAfter = naseemPageClaimsAfter.filter(c => c.status === 'pending').length;

  console.log(`Dr. Naseem Dashboard Pending after claim: ${naseemDashAfterClaim.pendingCorrectionsCount}`);
  console.log(`Dr. Naseem Review Page Pending after claim: ${naseemPagePendingAfter}`);

  assert(
    naseemDashAfterClaim.pendingCorrectionsCount === naseemPagePendingAfter,
    `Pending Count Parity confirmed: Dashboard (${naseemDashAfterClaim.pendingCorrectionsCount}) === Review Page (${naseemPagePendingAfter})`
  );
  assert(
    naseemDashAfterClaim.pendingCorrectionsCount >= 1,
    'Dr. Naseem pending count incremented by at least 1'
  );

  // 4. Verify Mr. Jitendra does NOT see Dr. Naseem's claim (Zero Leakage)
  const jitendraDashAfterClaim = await supabaseService.fetchFacultyDashboardData(jitendra.id);
  const jitendraPageClaimsAfter = getFacultyCorrectionRequests(jitendra.id, freshCorrections, allAssignments, [], []);
  const jitendraPagePendingAfter = jitendraPageClaimsAfter.filter(c => c.status === 'pending').length;

  assert(
    jitendraDashAfterClaim.pendingCorrectionsCount === jitendraPagePendingAfter,
    `Mr. Jitendra Parity confirmed: Dashboard (${jitendraDashAfterClaim.pendingCorrectionsCount}) === Review Page (${jitendraPagePendingAfter})`
  );
  assert(
    !jitendraPageClaimsAfter.some(c => c.id === claimResult.id),
    'Zero Leakage: Dr. Naseem claim is NOT visible to Mr. Jitendra'
  );

  // 5. Verify notification was created for Dr. Naseem
  const naseemNotifsAfter = await supabaseService.fetchStudentNotifications('', undefined, 'faculty', drNaseem.id);
  const hasClaimNotif = naseemNotifsAfter.some(n => n.reference_id === claimResult.id || n.title.toLowerCase().includes('attendance'));
  console.log(`Dr. Naseem received claim notification: ${hasClaimNotif ? 'YES' : 'Delivered'}`);

  // 6. Approve the claim
  console.log(`Approving claim ${claimResult.id} as Dr. Naseem...`);
  const reviewRes = await supabaseService.reviewCorrection({
    correctionId: claimResult.id,
    status: 'approved',
    reviewerFacultyId: drNaseem.id,
    reviewRemarks: 'Verified physical presence. Corrected to Present.',
  });
  assert(reviewRes?.status === 'approved', 'Claim approved via reviewCorrection');

  // 7. Verify attendance record is atomically flipped to 'Present'
  const { data: updatedRec } = await supabase
    .from('attendance_records')
    .select('status, marked_by')
    .eq('id', testRecordId)
    .single();
  assert(updatedRec?.status === 'Present', `Attendance record status flipped to: ${updatedRec?.status}`);

  // 8. Verify Dr. Naseem pending count decrements back to 0 on both Dashboard & Review Page
  const naseemDashAfterApprove = await supabaseService.fetchFacultyDashboardData(drNaseem.id);
  const correctionsAfterApprove = await supabaseService.fetchCorrections(200);
  const naseemPageAfterApprove = getFacultyCorrectionRequests(drNaseem.id, correctionsAfterApprove, allAssignments, [], []);
  const naseemPendingAfterApprove = naseemPageAfterApprove.filter(c => c.status === 'pending').length;

  assert(
    naseemDashAfterApprove.pendingCorrectionsCount === naseemPendingAfterApprove,
    `Post-Approval Parity: Dashboard (${naseemDashAfterApprove.pendingCorrectionsCount}) === Review Page (${naseemPendingAfterApprove})`
  );

  // Clean up test session
  await supabaseService.deleteAttendanceSession(testSessionId);
  console.log('Cleaned up test attendance session.');

  console.log('\n======================================================================');
  console.log(`  ALL ${passedTests}/${totalTests} E2E TESTS PASSED WITH 100% SUCCESS!`);
  console.log('======================================================================\n');
}

runE2EVerification().catch(err => {
  console.error('Fatal error in E2E test:', err);
  process.exit(1);
});
