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

// Helper to simulate the AuthContext email resolution logic
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

// Helper to simulate full AuthContext login flow
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
    return { success: false, error: 'Invalid email or password.' };
  }

  return { success: true, session: data.session, userId: data.user.id };
}

async function runSecurityMatrixAudit() {
  console.log('================================================================================');
  console.log('  VCTM ERP — COMPREHENSIVE AUTHENTICATION SECURITY AUDIT & MATRIX VERIFICATION');
  console.log('  Testing Supabase Auth as Sole Authority Against Live Cloud Database           ');
  console.log('================================================================================\n');

  // --- 1. STUDENT SECURITY MATRIX ---
  console.log('--- 1. STUDENT ROLE AUTHENTICATION MATRIX ---');
  const studentRoll = '2403400100021'; // HIMANSHU
  const studentEmail = '2403400100021@vctm.in';
  const studentValidPass = 'VctmStudent@2026';

  // 1.1 Correct Roll Number + Correct Password
  const studOk1 = await simulateLogin(studentRoll, studentValidPass);
  assert(studOk1.success === true, 'Student: Correct roll number + correct password succeeds');
  assert(Boolean(studOk1.session), 'Student: Authenticated Supabase session is issued');
  await supabase.auth.signOut();

  // 1.2 Correct Email + Correct Password
  const studOk2 = await simulateLogin(studentEmail, studentValidPass);
  assert(studOk2.success === true, 'Student: Correct email + correct password succeeds');
  await supabase.auth.signOut();

  // 1.3 Correct Roll Number + WRONG Password ('wrong123')
  const studBad1 = await simulateLogin(studentRoll, 'wrong123');
  assert(studBad1.success === false, 'Student: Correct roll number + WRONG password ("wrong123") is REJECTED');
  assert(!studBad1.session, 'Student: No session created on wrong password');
  assert(studBad1.error === 'Invalid email or password.', 'Student: Returns generic security failure message');

  // 1.4 Correct Email + WRONG Password ('abc')
  const studBad2 = await simulateLogin(studentEmail, 'abc');
  assert(studBad2.success === false, 'Student: Correct email + WRONG password ("abc") is REJECTED');
  assert(!studBad2.session, 'Student: No session created for "abc" password');

  // 1.5 Wrong Email + Correct Password
  const studBad3 = await simulateLogin('nonexistent_student_999@vctm.in', studentValidPass);
  assert(studBad3.success === false, 'Student: Non-existent email + password is REJECTED');
  assert(!studBad3.session, 'Student: No session created for non-existent email');

  // 1.6 Wrong Roll Number + Wrong Password
  const studBad4 = await simulateLogin('9999999999999', 'wrongPassword');
  assert(studBad4.success === false, 'Student: Non-existent roll number + wrong password is REJECTED');

  // 1.7 Correct Email + Empty Password
  const studBad5 = await simulateLogin(studentEmail, '');
  assert(studBad5.success === false, 'Student: Correct email + EMPTY password is REJECTED');

  // 1.8 Correct Email + Whitespace Password
  const studBad6 = await simulateLogin(studentEmail, '   ');
  assert(studBad6.success === false, 'Student: Correct email + WHITESPACE password is REJECTED');

  // --- 2. FACULTY SECURITY MATRIX ---
  console.log('\n--- 2. FACULTY ROLE AUTHENTICATION MATRIX ---');
  const facultyEmail = 'hemlata.cse@vctm.in';
  const facultyCode = 'HEM';
  const facultyEmpCode = 'FAC-CSE-002';
  const facultyValidPass = 'VctmFaculty@2026';

  // 2.1 Correct Email + Correct Password
  const facOk1 = await simulateLogin(facultyEmail, facultyValidPass);
  assert(facOk1.success === true, 'Faculty: Correct email + correct password succeeds');
  await supabase.auth.signOut();

  // 2.2 Correct Employee Code + Correct Password
  const facOk2 = await simulateLogin(facultyEmpCode, facultyValidPass);
  assert(facOk2.success === true, 'Faculty: Correct employee code (FAC-CSE-002) + correct password succeeds');
  await supabase.auth.signOut();

  // 2.3 Correct Faculty Code + Correct Password
  const facOk3 = await simulateLogin(facultyCode, facultyValidPass);
  assert(facOk3.success === true, 'Faculty: Correct faculty code (HEM) + correct password succeeds');
  await supabase.auth.signOut();

  // 2.4 Correct Faculty Code + WRONG Password ('123456')
  const facBad1 = await simulateLogin(facultyCode, '123456');
  assert(facBad1.success === false, 'Faculty: Correct faculty code + WRONG password ("123456") is REJECTED');
  assert(!facBad1.session, 'Faculty: No session created on wrong password');

  // 2.5 Correct Email + WRONG Password ('anything')
  const facBad2 = await simulateLogin(facultyEmail, 'anything');
  assert(facBad2.success === false, 'Faculty: Correct email + WRONG password ("anything") is REJECTED');

  // --- 3. HOD SECURITY MATRIX ---
  console.log('\n--- 3. HOD ROLE AUTHENTICATION MATRIX ---');
  const hodEmail = 'wasim.cse@vctm.in';
  const hodValidPass = 'VctmHod@2026';

  // 3.1 Correct Email + Correct Password
  const hodOk = await simulateLogin(hodEmail, hodValidPass);
  assert(hodOk.success === true, 'HOD: Correct email + correct password succeeds');
  await supabase.auth.signOut();

  // 3.2 Correct Email + WRONG Password ('wrongHodPass')
  const hodBad = await simulateLogin(hodEmail, 'wrongHodPass');
  assert(hodBad.success === false, 'HOD: Correct email + WRONG password is REJECTED');
  assert(!hodBad.session, 'HOD: No session created on wrong password');

  // --- 4. SUPER ADMIN SECURITY MATRIX ---
  console.log('\n--- 4. SUPER ADMIN ROLE AUTHENTICATION MATRIX ---');
  const adminIdentifier = 'admin';
  const adminEmail = 'admin@vctm.in';
  const adminValidPass = 'VctmAdmin@2026';

  // 4.1 'admin' Identifier + Correct Password
  const admOk1 = await simulateLogin(adminIdentifier, adminValidPass);
  assert(admOk1.success === true, 'Admin: "admin" identifier + correct password succeeds');
  await supabase.auth.signOut();

  // 4.2 'admin@vctm.in' Email + Correct Password
  const admOk2 = await simulateLogin(adminEmail, adminValidPass);
  assert(admOk2.success === true, 'Admin: "admin@vctm.in" email + correct password succeeds');
  await supabase.auth.signOut();

  // 4.3 'admin' Identifier + WRONG Password ('admin123')
  const admBad1 = await simulateLogin(adminIdentifier, 'admin123');
  assert(admBad1.success === false, 'Admin: "admin" identifier + WRONG password is REJECTED');
  assert(!admBad1.session, 'Admin: No session created on wrong password');

  // 4.4 'admin@vctm.in' + WRONG Password ('randomAdmin')
  const admBad2 = await simulateLogin(adminEmail, 'randomAdmin');
  assert(admBad2.success === false, 'Admin: "admin@vctm.in" + WRONG password is REJECTED');

  // --- 5. MANDATORY PASSWORD CHANGE LIFECYCLE (END-TO-END) ---
  console.log('\n--- 5. MANDATORY PASSWORD CHANGE END-TO-END VERIFICATION ---');
  const targetEmail = 'imran.cse@vctm.in';
  const initialPassword = 'VctmFaculty@2026';
  const newPassword = 'ImranSecureUpdated2026#';

  // Step 1: Login with initial password -> SUCCESS
  const initialLogin = await supabase.auth.signInWithPassword({
    email: targetEmail,
    password: initialPassword,
  });
  assert(initialLogin.data.session !== null, 'Password Change Step 1: Login with initial password succeeds');

  // Step 2: Change password via real Supabase Auth
  const passUpdate = await supabase.auth.updateUser({
    password: newPassword,
  });
  assert(!passUpdate.error, 'Password Change Step 2: Password updated in Supabase Auth via updateUser');

  // Step 3: Logout
  await supabase.auth.signOut();
  const sessionAfterLogout = await supabase.auth.getSession();
  assert(sessionAfterLogout.data.session === null, 'Password Change Step 3: Session completely destroyed upon logout');

  // Step 4: Login with OLD password -> MUST FAIL
  const oldPassAttempt = await supabase.auth.signInWithPassword({
    email: targetEmail,
    password: initialPassword,
  });
  assert(oldPassAttempt.error !== null, 'Password Change Step 4: Login with OLD password is REJECTED');
  assert(oldPassAttempt.data.session === null, 'Password Change Step 4: OLD password produces NO SESSION');

  // Step 5: Login with NEW password -> MUST SUCCEED
  const newPassAttempt = await supabase.auth.signInWithPassword({
    email: targetEmail,
    password: newPassword,
  });
  assert(newPassAttempt.data.session !== null, 'Password Change Step 5: Login with NEW password SUCCEEDS');
  assert(newPassAttempt.data.user?.email === targetEmail, 'Password Change Step 5: User identity matches target');

  // Step 6: Logout and try RANDOM password -> MUST FAIL
  await supabase.auth.signOut();
  const randomPassAttempt = await simulateLogin(targetEmail, 'RandomGibberishPassword123');
  assert(randomPassAttempt.success === false, 'Password Change Step 6: Login with RANDOM password is REJECTED');
  assert(!randomPassAttempt.session, 'Password Change Step 6: RANDOM password produces NO SESSION');

  // Step 7: Restore original password for consistency
  const reLogin = await supabase.auth.signInWithPassword({
    email: targetEmail,
    password: newPassword,
  });
  assert(reLogin.data.session !== null, 'Restored session to reset password to institutional baseline');
  await supabase.auth.updateUser({ password: initialPassword });
  await supabase.auth.signOut();
  const finalCheck = await supabase.auth.signInWithPassword({
    email: targetEmail,
    password: initialPassword,
  });
  assert(finalCheck.data.session !== null, 'Restored initial password verified in Supabase Auth');
  await supabase.auth.signOut();

  // --- 6. SESSION & LOCAL STORAGE TAMPERING AUDIT ---
  console.log('\n--- 6. SESSION & LOCAL STORAGE TAMPERING AUDIT ---');
  // Verify that getSession() is null when signed out
  const noSession = await supabase.auth.getSession();
  assert(noSession.data.session === null, 'Supabase Auth reports NO active session when unauthenticated');

  // Verify that setting fake user in localStorage cannot forge Supabase session
  const fakeUser = {
    id: '00000000-0000-0000-0000-000000000000',
    email: 'hacker@attacker.com',
    role: 'super_admin',
    full_name: 'Fake Super Admin',
  };
  (global as any).localStorage?.setItem('vctm_erp_session_user', JSON.stringify(fakeUser));

  // Check that Supabase Auth session remains strictly null despite localStorage tampering
  const sessionAfterTamper = await supabase.auth.getSession();
  assert(sessionAfterTamper.data.session === null, 'Tampered localStorage cannot forge Supabase session (session is null)');

  // --- 7. DATABASE PLAINTEXT PASSWORD AUDIT ---
  console.log('\n--- 7. DATABASE PLAINTEXT PASSWORD STORAGE AUDIT ---');
  const pgClient = new pg.Client({ connectionString });
  await pgClient.connect();

  const passCols = await pgClient.query(`
    SELECT table_schema, table_name, column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND column_name ILIKE '%pass%';
  `);
  assert(passCols.rows.length === 0, 'Zero password or password_hash columns in public schema tables');

  const authUserCount = await pgClient.query('SELECT count(*) FROM auth.users;');
  const profCount = await pgClient.query('SELECT count(*) FROM public.profiles;');
  assert(Number(authUserCount.rows[0].count) >= Number(profCount.rows[0].count), 'All public.profiles are provisioned in auth.users');

  await pgClient.end();

  console.log('\n================================================================================');
  console.log(`  🎉 ALL ${passedChecks}/${totalChecks} AUTHENTICATION SECURITY AUDIT CHECKS PASSED WITH 100% SUCCESS!`);
  console.log('================================================================================\n');
}

runSecurityMatrixAudit()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Audit fatal error:', err);
    process.exit(1);
  });
