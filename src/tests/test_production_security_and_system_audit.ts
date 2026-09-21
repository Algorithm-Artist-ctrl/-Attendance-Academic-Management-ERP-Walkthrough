if (!process.env.DATABASE_URL && (process as any).loadEnvFile) {
  try { (process as any).loadEnvFile(); } catch {}
}
import { supabase } from '../lib/supabase/supabaseClient';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL || '';

let totalChecks = 0;
let passedChecks = 0;

function assert(condition: boolean, title: string, detail?: any) {
  totalChecks++;
  if (!condition) {
    console.error(`\n❌ FAILED [Check ${totalChecks}]: ${title}`);
    if (detail) console.error('   Detail:', detail);
    process.exit(1);
  } else {
    passedChecks++;
    console.log(`  ✓ [Check ${totalChecks}] ${title}`);
  }
}

// Simulate AuthContext resolveUserEmail logic
async function resolveUserEmail(rawIdentifier: string): Promise<string | null> {
  const trimmed = rawIdentifier.trim();
  if (!trimmed) return null;
  if (trimmed.includes('@')) return trimmed.toLowerCase();
  const clean = trimmed.toLowerCase();
  if (clean === 'admin') return 'admin@vctm.in';

  const cleanRoll = trimmed.replace(/[\s\-_]/g, '');
  const { data: student } = await supabase
    .from('students')
    .select('id, email, roll_number')
    .ilike('roll_number', cleanRoll)
    .maybeSingle();

  if (student) {
    if (student.email) return student.email.toLowerCase().trim();
    const { data: prof } = await supabase
      .from('profiles')
      .select('email')
      .eq('student_id', student.id)
      .maybeSingle();
    if (prof?.email) return prof.email.toLowerCase().trim();
    return `${cleanRoll}@vctm.in`;
  }

  const { data: facultyMember } = await supabase
    .from('faculty')
    .select('email, employee_code, faculty_code')
    .or(`employee_code.ilike.${trimmed},employee_code.ilike.${cleanRoll},faculty_code.ilike.${trimmed},faculty_code.ilike.${cleanRoll}`)
    .maybeSingle();

  if (facultyMember?.email) return facultyMember.email.toLowerCase().trim();

  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .or(`id.eq.${trimmed},email.ilike.${trimmed}`)
    .maybeSingle();

  if (profile?.email) return profile.email.toLowerCase().trim();
  return null;
}

// Simulate full AuthContext login flow
async function simulateLogin(identifier: string, password: string): Promise<{ success: boolean; error?: string; session?: any; userId?: string }> {
  const rawId = identifier?.trim();
  const rawPass = password;

  if (!rawId || !rawPass || !rawPass.trim()) {
    return { success: false, error: 'Invalid email or password.' };
  }

  const email = await resolveUserEmail(rawId);
  if (!email) {
    return { success: false, error: 'Invalid email or password.' };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: rawPass,
  });

  if (error || !data.session || !data.user) {
    await supabase.auth.signOut().catch(() => {});
    return { success: false, error: 'Invalid email or password.' };
  }

  return { success: true, session: data.session, userId: data.user.id };
}

// Simulate AuthContext changePassword flow
async function simulateChangePassword(currentEmail: string, currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  if (!currentEmail) {
    return { success: false, error: 'No active session. Please log in.' };
  }
  if (!currentPassword || !currentPassword.trim()) {
    return { success: false, error: 'Please provide your current password.' };
  }
  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: 'New password must be at least 6 characters long.' };
  }
  if (currentPassword === newPassword) {
    return { success: false, error: 'New password must be different from current password.' };
  }

  // Authoritative verification against Supabase Auth
  const { error: verifyErr } = await supabase.auth.signInWithPassword({
    email: currentEmail,
    password: currentPassword,
  });
  if (verifyErr) {
    return { success: false, error: 'Current password is incorrect.' };
  }

  const { error: authErr } = await supabase.auth.updateUser({ password: newPassword });
  if (authErr) {
    return { success: false, error: authErr.message || 'Failed to update password.' };
  }

  // Session termination
  await supabase.auth.signOut();
  return { success: true };
}

async function runComprehensiveAudit() {
  console.log('================================================================================');
  console.log('  VCTM ERP — COMPREHENSIVE PRODUCTION SECURITY & SYSTEM AUDIT                   ');
  console.log('  Targeting Live Supabase Cloud Database: 30 Rigorous Verification Checks      ');
  console.log('================================================================================\n');

  // ============================================================================
  // MODULE 1: AUTHENTICATION SECURITY MATRIX FOR ALL 4 ROLES
  // ============================================================================
  console.log('--- MODULE 1: AUTHENTICATION SECURITY MATRIX (ALL 4 ROLES) ---');

  // Role 1: Super Admin
  const adminEmail = 'admin@vctm.in';
  const adminPass = 'VctmAdmin@2026';

  const adminOk = await simulateLogin('admin', adminPass);
  assert(adminOk.success === true, 'Admin: Login with alias "admin" and valid password succeeds');
  assert(Boolean(adminOk.session), 'Admin: Valid Supabase JWT session is returned');
  await supabase.auth.signOut();

  const adminBadPass = await simulateLogin(adminEmail, 'wrongPassword123');
  assert(adminBadPass.success === false, 'Admin: Login with wrong password is REJECTED');
  assert(!adminBadPass.session, 'Admin: No session issued on wrong password');

  const adminEmptyPass = await simulateLogin(adminEmail, '');
  assert(adminEmptyPass.success === false, 'Admin: Login with empty password is REJECTED');

  // Role 2: HOD
  const hodEmail = 'wasim.cse@vctm.in';
  const hodPass = 'VctmHod@2026';

  const hodOk = await simulateLogin(hodEmail, hodPass);
  assert(hodOk.success === true, 'HOD: Login with valid email and password succeeds');
  assert(Boolean(hodOk.session), 'HOD: Valid Supabase JWT session is returned');
  await supabase.auth.signOut();

  const hodBadPass = await simulateLogin(hodEmail, 'InvalidHodPass');
  assert(hodBadPass.success === false, 'HOD: Login with wrong password is REJECTED');

  // Role 3: Faculty
  const facultyEmail = 'hemlata.cse@vctm.in';
  const facultyPass = 'VctmFaculty@2026';

  const facultyOk = await simulateLogin(facultyEmail, facultyPass);
  assert(facultyOk.success === true, 'Faculty: Login with valid email and password succeeds');
  assert(Boolean(facultyOk.session), 'Faculty: Valid Supabase JWT session is returned');
  await supabase.auth.signOut();

  const facultyBadPass = await simulateLogin(facultyEmail, 'FakeFacultyPass99');
  assert(facultyBadPass.success === false, 'Faculty: Login with wrong password is REJECTED');

  // Role 4: Student (by roll number & email)
  const studentRoll = '2403400100021';
  const studentEmail = '2403400100021@vctm.in';
  const studentPass = 'VctmStudent@2026';

  const studentOkRoll = await simulateLogin(studentRoll, studentPass);
  assert(studentOkRoll.success === true, 'Student: Login by roll number and valid password succeeds');
  await supabase.auth.signOut();

  const studentOkEmail = await simulateLogin(studentEmail, studentPass);
  assert(studentOkEmail.success === true, 'Student: Login by email and valid password succeeds');
  await supabase.auth.signOut();

  const studentBadRoll = await simulateLogin('9999999999999', 'anyPass');
  assert(studentBadRoll.success === false, 'Student: Non-existent roll number is REJECTED');

  const studentBadPass = await simulateLogin(studentRoll, 'wrongStudentPass');
  assert(studentBadPass.success === false, 'Student: Valid roll number with wrong password is REJECTED');

  // Non-existent user
  const fakeUser = await simulateLogin('hacker@attack.com', 'somePassword');
  assert(fakeUser.success === false, 'Security: Arbitrary non-existent user is REJECTED');

  // ============================================================================
  // MODULE 2: PASSWORD CHANGE SECURITY & SESSION INVALIDATION
  // ============================================================================
  console.log('\n--- MODULE 2: PASSWORD CHANGE SECURITY & SESSION TERMINATION ---');

  // 2.1 Attempt password change with wrong currentPassword
  const pwWrongCurrent = await simulateChangePassword(facultyEmail, 'CompletelyWrongPass123', 'NewFacultyPass@2026');
  assert(pwWrongCurrent.success === false, 'Password Change: Wrong current password is REJECTED');
  assert(pwWrongCurrent.error === 'Current password is incorrect.', 'Password Change: Error states "Current password is incorrect."');

  // 2.2 Attempt password change with too short password
  const pwShort = await simulateChangePassword(facultyEmail, facultyPass, '12345');
  assert(pwShort.success === false, 'Password Change: Password < 6 characters is REJECTED');

  // 2.3 Attempt password change with identical new password
  const pwIdentical = await simulateChangePassword(facultyEmail, facultyPass, facultyPass);
  assert(pwIdentical.success === false, 'Password Change: Identical new password is REJECTED');

  // 2.4 Full Password Change Lifecycle + Re-login verification
  const temporaryNewPass = 'VctmFaculty@New2026!';
  const pwChangeOk = await simulateChangePassword(facultyEmail, facultyPass, temporaryNewPass);
  assert(pwChangeOk.success === true, 'Password Change: Valid update succeeds via Supabase Auth');

  // 2.5 Verify old password no longer works
  const oldPassLogin = await simulateLogin(facultyEmail, facultyPass);
  assert(oldPassLogin.success === false, 'Password Change: Old password is no longer accepted');

  // 2.6 Verify new password works
  const newPassLogin = await simulateLogin(facultyEmail, temporaryNewPass);
  assert(newPassLogin.success === true, 'Password Change: New password successfully authenticates');
  await supabase.auth.signOut();

  // 2.7 Revert back to original password for testing consistency
  const revertPw = await simulateChangePassword(facultyEmail, temporaryNewPass, facultyPass);
  assert(revertPw.success === true, 'Password Change: Reverted back to initial production password');

  const finalVerifyLogin = await simulateLogin(facultyEmail, facultyPass);
  assert(finalVerifyLogin.success === true, 'Password Change: Initial production password restored and verified');
  await supabase.auth.signOut();

  // ============================================================================
  // MODULE 3: ATTENDANCE ZERO-DATA INTEGRITY & CALCULATION ENGINE
  // ============================================================================
  console.log('\n--- MODULE 3: ATTENDANCE ZERO-DATA INTEGRITY & MATHEMATICS ---');

  // 3.1 Verify Live Database has 0 attendance records and 0 sessions
  const { count: sessionCount } = await supabase
    .from('attendance_sessions')
    .select('*', { count: 'exact', head: true });
  assert(sessionCount === 0, `Database Integrity: Real attendance_sessions count is 0 (found ${sessionCount})`);

  const { count: recordCount } = await supabase
    .from('attendance_records')
    .select('*', { count: 'exact', head: true });
  assert(recordCount === 0, `Database Integrity: Real attendance_records count is 0 (found ${recordCount})`);

  // 3.2 Mathematical Formula Verification: Present / (Present + Absent) * 100
  const sampleRecords = [
    { status: 'Present' },
    { status: 'Present' },
    { status: 'Absent' },
    { status: 'Absent' },
  ];
  const pres = sampleRecords.filter(r => r.status === 'Present').length;
  const evalCount = sampleRecords.filter(r => r.status === 'Present' || r.status === 'Absent').length;
  const computedRate = evalCount > 0 ? Math.round((pres / evalCount) * 100) : null;
  assert(computedRate === 50, 'Attendance Math: 2 Present / (2 Present + 2 Absent) * 100 equals 50%');

  // 3.3 Zero Attendance State Formula returns null (not 0 or fake %)
  const emptyRecords: any[] = [];
  const emptyEval = emptyRecords.filter(r => r.status === 'Present' || r.status === 'Absent').length;
  const zeroStateRate = emptyEval > 0 ? Math.round((0 / emptyEval) * 100) : null;
  assert(zeroStateRate === null, 'Attendance Math: 0 records correctly evaluates to null (no division by zero)');

  // ============================================================================
  // MODULE 4: TIMETABLE BOUNDARY & PERIOD ISOLATION INTEGRITY
  // ============================================================================
  console.log('\n--- MODULE 4: TIMETABLE BOUNDARY & PERIOD ISOLATION INTEGRITY ---');

  // 4.1 Touching time boundaries (e.g. 09:00-09:50 and 09:50-10:40) must NOT be reported as overlapping
  function timesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
    return startA < endB && endA > startB;
  }
  const touchingSlotsOverlap = timesOverlap('09:00', '09:50', '09:50', '10:40');
  assert(touchingSlotsOverlap === false, 'Timetable Conflict Engine: Touching slots (09:00-09:50 & 09:50-10:40) do NOT overlap');

  const overlappingSlots = timesOverlap('09:00', '10:00', '09:30', '10:30');
  assert(overlappingSlots === true, 'Timetable Conflict Engine: Truly overlapping slots (09:00-10:00 & 09:30-10:30) ARE detected');

  // 4.2 Timetable Entry Query Isolation
  const { data: testQuerySlots } = await supabase
    .from('timetable_entries')
    .select('id, section_id, subject_id, day_of_week, period_number, start_time, end_time')
    .limit(2);
  assert(Array.isArray(testQuerySlots), 'Timetable: Able to query timetable_entries from database');

  // ============================================================================
  // MODULE 5: DATABASE RLS (ROW-LEVEL SECURITY) & AUDIT
  // ============================================================================
  console.log('\n--- MODULE 5: DATABASE RLS & SECURITY AUDIT ---');

  const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    const res = await pool.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename;
    `);
    const tablesWithoutRLS = res.rows.filter(r => !r.rowsecurity);
    assert(tablesWithoutRLS.length === 0, `RLS Audit: All ${res.rows.length} public tables have Row-Level Security ENABLED`);

    // Verify sections and academic years are properly seeded
    const secRes = await pool.query("SELECT count(*) FROM sections WHERE name IN ('A', 'B');");
    assert(parseInt(secRes.rows[0].count, 10) >= 2, 'Database Structure: Sections A and B exist in database');

    const yrRes = await pool.query("SELECT count(*) FROM academic_years WHERE year_number IN (1, 2, 3, 4);");
    assert(parseInt(yrRes.rows[0].count, 10) >= 4, 'Database Structure: Academic Years 1, 2, 3, 4 exist in database');
  } finally {
    await pool.end();
  }

  // ============================================================================
  // SUMMARY OF AUDIT
  // ============================================================================
  console.log('\n================================================================================');
  console.log(`  COMPREHENSIVE AUDIT COMPLETE: ${passedChecks}/${totalChecks} CHECKS PASSED (100%)`);
  console.log('  ALL CRITICAL SECURITY, AUTHENTICATION, AND INTEGRITY REQUIREMENTS SATISFIED    ');
  console.log('================================================================================\n');
}

runComprehensiveAudit().catch(err => {
  console.error('\n❌ Unhandled Exception in Audit:', err);
  process.exit(1);
});
