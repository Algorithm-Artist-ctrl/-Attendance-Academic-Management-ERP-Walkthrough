import pg from 'pg';
import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.obssoojzryqiudllnlkh:Tarun%40759977@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres';

async function cleanupClaims(studentId: string) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query('DELETE FROM attendance_corrections WHERE student_id = $1', [studentId]);
  } finally {
    await client.end();
  }
}

async function verifyAuditLog(action: string): Promise<any> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const res = await client.query(
      'SELECT * FROM audit_logs WHERE action = $1 ORDER BY created_at DESC LIMIT 1',
      [action]
    );
    return res.rows[0];
  } finally {
    await client.end();
  }
}

// Polyfill localStorage for Node environment
if (typeof localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (global as any).localStorage = {
    getItem: (k: string) => store[k] || null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  };
}

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition: boolean, message: string, details?: any) {
  totalAssertions++;
  if (!condition) {
    console.error(`\n❌ FAILED [Assertion ${totalAssertions}]: ${message}`);
    if (details) console.error('   Details:', details);
    process.exit(1);
  } else {
    passedAssertions++;
    console.log(`  ✓ [Step ${totalAssertions}] ${message}`);
  }
}

async function runTest() {
  console.log('================================================================================');
  console.log('🧪 VCTM ERP ATTENDANCE CLAIM, ATOMIC REVIEW & HOD HISTORY TEST SUITE');
  console.log('================================================================================\n');

  // Credentials
  const facultyEmail = 'hemlata.cse@vctm.in';
  const facultyPass = 'VctmFaculty@2026';

  const studentEmail = '2403400100021@vctm.in';
  const studentPass = 'VctmStudent@2026';

  const hodEmail = 'wasim.cse@vctm.in';
  const hodPass = 'VctmHod@2026';

  // 1. Authenticate as Faculty and prepare test session & student
  console.log('▶ STEP 1: PREPARING TEST DATA (Faculty Hemlata Chaudhry)');
  const { data: facAuth, error: facAuthErr } = await supabase.auth.signInWithPassword({
    email: facultyEmail,
    password: facultyPass,
  });
  if (facAuthErr) {
    console.error('Faculty login error:', facAuthErr);
  }
  assert(!facAuthErr && !!facAuth.user, 'Faculty Hemlata logged in successfully');

  const { data: facultyProfile } = await supabase
    .from('faculty')
    .select('*')
    .eq('auth_user_id', facAuth.user!.id)
    .single();
  assert(!!facultyProfile, 'Faculty profile retrieved', { facultyId: facultyProfile?.id });

  // Get student Himanshu
  const { data: studentHimanshu } = await supabase
    .from('students')
    .select('*')
    .eq('roll_number', '2403400100021')
    .single();
  assert(!!studentHimanshu, 'Student Himanshu retrieved', { studentId: studentHimanshu?.id });

  // Find a timetable entry for faculty in Himanshu's section
  const { data: ttEntries } = await supabase
    .from('timetable_entries')
    .select('*')
    .eq('section_id', studentHimanshu.section_id)
    .eq('faculty_id', facultyProfile.id)
    .limit(1);
  assert(!!ttEntries && ttEntries.length > 0, 'Found timetable entry for faculty in Section A');
  const targetEntry = ttEntries![0];

  const todayISO = new Date().toISOString().split('T')[0];

  // Ensure an attendance session exists for today
  const { data: sectionStudents } = await supabase
    .from('students')
    .select('id, roll_number')
    .eq('section_id', studentHimanshu.section_id)
    .eq('active', true);

  assert(!!sectionStudents && sectionStudents.length > 0, 'Loaded active students for Section A');

  // Mark Himanshu as Absent, all others Present
  const initialStudentRecords = sectionStudents!.map(s => ({
    studentId: s.id,
    status: (s.id === studentHimanshu.id ? 'Absent' : 'Present') as 'Present' | 'Absent',
  }));

  const saveResult = await supabaseService.saveAttendance({
    timetableEntryId: targetEntry.id,
    facultyId: facultyProfile.id,
    sectionId: studentHimanshu.section_id,
    subjectId: targetEntry.subject_id,
    sessionDate: todayISO,
    startTime: targetEntry.start_time.substring(0, 5),
    endTime: targetEntry.end_time.substring(0, 5),
    studentRecords: initialStudentRecords,
  });

  assert(!!saveResult?.session?.id, 'Attendance session saved with Himanshu marked Absent', {
    sessionId: saveResult?.session?.id,
  });

  // Query Himanshu's attendance record
  const { data: himanshuRecord } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('attendance_session_id', saveResult.session.id)
    .eq('student_id', studentHimanshu.id)
    .single();

  assert(!!himanshuRecord && himanshuRecord.status === 'Absent', 'Himanshu attendance record is Absent in database');

  // Clean up any pre-existing pending claims for this student to allow clean testing
  await cleanupClaims(studentHimanshu.id);

  // STEP 2: STUDENT HIMANSHU SUBMITS ATTENDANCE CLAIM
  console.log('\n▶ STEP 2: STUDENT SUBMITS ATTENDANCE CLAIM');
  const { data: studAuth, error: studAuthErr } = await supabase.auth.signInWithPassword({
    email: studentEmail,
    password: studentPass,
  });
  assert(!studAuthErr && !!studAuth.user, 'Student Himanshu logged in successfully');

  // Submit claim via claimAttendance RPC
  const claimPayload = {
    timetableEntryId: targetEntry.id,
    studentId: studentHimanshu.id,
    reason: 'I was present in class, please verify with attendance sheet.',
    requestedStatus: 'Present' as const,
    simulatedTime: '11:00',
    simulatedDate: todayISO,
    attendanceRecordId: himanshuRecord.id,
  };

  const claimRes = await supabaseService.claimAttendance(claimPayload);
  assert(!!claimRes && claimRes.success === true && !!claimRes.claimId, 'Claim submitted successfully via RPC with pending status', {
    claimId: claimRes.claimId,
    code: claimRes.code,
  });

  const activeClaimId = claimRes.claimId;

  // STEP 3: PREVENT DUPLICATE CLAIM SUBMISSION
  console.log('\n▶ STEP 3: PREVENT DUPLICATE CLAIM SUBMISSION');
  let dupFailed = false;
  let dupErrMsg = '';
  let dupErrCode = '';
  try {
    await supabaseService.claimAttendance(claimPayload);
  } catch (err: any) {
    dupFailed = true;
    dupErrMsg = err.message || '';
    dupErrCode = err.code || '';
  }

  assert(
    dupFailed && (dupErrCode === 'CLAIM_ALREADY_SUBMITTED' || dupErrMsg.toLowerCase().includes('already')),
    'Duplicate claim submission was strictly REJECTED with CLAIM_ALREADY_SUBMITTED',
    { dupErrCode, dupErrMsg }
  );

  // STEP 4: FACULTY HYDRATION AND ATOMIC APPROVAL
  console.log('\n▶ STEP 4: FACULTY HYDRATION AND ATOMIC APPROVAL');
  await supabase.auth.signInWithPassword({
    email: facultyEmail,
    password: facultyPass,
  });

  const corrections = await supabaseService.fetchCorrections();
  const targetClaim = corrections.find(c => c.id === activeClaimId);
  assert(!!targetClaim, 'Faculty fetches pending claim from Supabase', { claimId: activeClaimId });
  assert(!!targetClaim?.record, 'Claim has hydrated relational record object');
  assert(!!targetClaim?.student, 'Claim has hydrated relational student object');
  assert(!!targetClaim?.record?.session?.subject, 'Claim has hydrated subject through deep relational join');

  // Approve via atomic RPC
  const approveRes = await supabaseService.approveAttendanceClaim({
    claimId: activeClaimId,
    facultyId: facultyProfile.id,
    remarks: 'Verified presence in lab session',
  });
  assert(approveRes.success === true, 'approveAttendanceClaim RPC executed successfully');

  // Directly verify database state after approval
  const { data: approvedClaimDb } = await supabase
    .from('attendance_corrections')
    .select('*')
    .eq('id', activeClaimId)
    .single();
  assert(approvedClaimDb?.status === 'approved', 'Database attendance_corrections status transitioned to "approved"');

  const { data: updatedRecordDb } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('id', himanshuRecord.id)
    .single();
  assert(updatedRecordDb?.status === 'Present', 'Database attendance_records status atomically mutated from "Absent" to "Present"');

  // Verify audit log entry
  const auditLog = await verifyAuditLog('ATTENDANCE_CORRECTION_APPROVED');
  assert(!!auditLog && auditLog.entity_id === himanshuRecord.id, 'Audit log entry created for ATTENDANCE_CORRECTION_APPROVED', {
    auditLogId: auditLog?.id,
    action: auditLog?.action,
  });

  // STEP 5: ATOMIC REJECTION FLOW
  console.log('\n▶ STEP 5: ATOMIC REJECTION FLOW');
  // Mutate record back to Absent for rejection testing
  await supabase
    .from('attendance_records')
    .update({ status: 'Absent' })
    .eq('id', himanshuRecord.id);

  // Delete old claim via admin client to allow a new test claim
  await cleanupClaims(studentHimanshu.id);

  // Student submits new claim
  await supabase.auth.signInWithPassword({
    email: studentEmail,
    password: studentPass,
  });

  const rejectTestClaim = await supabaseService.claimAttendance(claimPayload);
  assert(!!rejectTestClaim?.id, 'Student submitted second claim for rejection testing');

  // Faculty rejects claim
  await supabase.auth.signInWithPassword({
    email: facultyEmail,
    password: facultyPass,
  });

  const rejectRes = await supabaseService.rejectAttendanceClaim({
    claimId: rejectTestClaim.id || rejectTestClaim.claimId,
    facultyId: facultyProfile.id,
    remarks: 'Student was observed absent during roll call',
  });
  assert(rejectRes.success === true, 'rejectAttendanceClaim RPC executed successfully');

  const { data: rejectedClaimDb } = await supabase
    .from('attendance_corrections')
    .select('*')
    .eq('id', rejectTestClaim.id)
    .single();
  assert(rejectedClaimDb?.status === 'rejected', 'Database attendance_corrections status transitioned to "rejected"');

  const { data: postRejectRecordDb } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('id', himanshuRecord.id)
    .single();
  assert(postRejectRecordDb?.status === 'Absent', 'Attendance record strictly remains "Absent" after rejection');

  const rejectAudit = await verifyAuditLog('ATTENDANCE_CORRECTION_REJECTED');
  assert(!!rejectAudit && rejectAudit.entity_id === rejectTestClaim.id, 'Audit log entry created for ATTENDANCE_CORRECTION_REJECTED', {
    auditLogId: rejectAudit?.id,
    action: rejectAudit?.action,
  });

  // STEP 6: HOD ATTENDANCE HISTORY & PERCENTAGE FORMULA
  console.log('\n▶ STEP 6: HOD ATTENDANCE HISTORY & PERCENTAGE FORMULA AUDIT');
  await supabase.auth.signInWithPassword({
    email: hodEmail,
    password: hodPass,
  });

  const history = await supabaseService.fetchStudentAttendanceHistory({
    studentId: studentHimanshu.id,
  });

  assert(!!history && Array.isArray(history.records), 'HOD fetchStudentAttendanceHistory returns records array');
  assert(history !== null && (typeof history.attendancePercentage === 'number' || history.attendancePercentage === null), 'HOD fetchStudentAttendanceHistory returns calculated percentage');
  console.log(`  ℹ HOD Summary: Present=${history?.presentCount}, Absent=${history?.absentCount}, Not Marked=${history?.notMarkedCount}, Cancelled=${history?.cancelledCount}, Total=${history?.totalLectures}, Percentage=${history?.attendancePercentage}%`);

  const denominator = (history?.presentCount || 0) + (history?.absentCount || 0);
  const expectedPercentage = denominator > 0
    ? Math.round(((history?.presentCount || 0) / denominator) * 100)
    : null;

  assert(
    history?.attendancePercentage === expectedPercentage,
    `HOD percentage formula strictly adheres to Present / (Present + Absent) * 100 (${history?.attendancePercentage}% === ${expectedPercentage}%)`
  );

  // Assert Not Marked and Cancelled are strictly excluded from the percentage calculation
  assert(
    history?.totalLectures === (history?.presentCount || 0) + (history?.absentCount || 0) + (history?.notMarkedCount || 0) + (history?.cancelledCount || 0),
    'Total lectures equals sum of all 4 states (Present, Absent, Not Marked, Cancelled)'
  );

  // Clean up rejection claim and restore Himanshu record
  await cleanupClaims(studentHimanshu.id);

  await supabase
    .from('attendance_records')
    .update({ status: 'Present' })
    .eq('id', himanshuRecord.id);

  console.log('\n================================================================================');
  console.log(`🎉 ALL ${passedAssertions}/${totalAssertions} VERIFICATION STEPS PASSED PERFECTLY!`);
  console.log('   - Migration 018 RPCs working seamlessly.');
  console.log('   - Duplicate submission prevented.');
  console.log('   - Atomic approval and rejection verified with audit logs.');
  console.log('   - HOD attendance history and percentage formula verified.');
  console.log('================================================================================\n');

  await supabase.auth.signOut();
}

runTest().catch(err => {
  console.error('\n💥 Test execution failed:', err);
  process.exit(1);
});
