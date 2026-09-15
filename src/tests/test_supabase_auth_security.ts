import { supabase } from '../lib/supabase/supabaseClient';

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

// Helper simulating resolveUserEmail from AuthContext
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

// Helper simulating login from AuthContext
async function simulateLogin(identifier: string, password: string): Promise<{ success: boolean; error?: string; session?: any; user?: any }> {
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

  return { success: true, session: data.session, user: data.user };
}

// Helper simulating authoritative changePassword from AuthContext
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

  // 1. Authoritative re-authentication with current credentials
  const { error: verifyErr } = await supabase.auth.signInWithPassword({
    email: currentEmail,
    password: currentPassword,
  });
  if (verifyErr) {
    return { success: false, error: 'Current password is incorrect.' };
  }

  // 2. Real update via Supabase Auth
  const { error: authErr } = await supabase.auth.updateUser({ password: newPassword });
  if (authErr) {
    return { success: false, error: authErr.message || 'Failed to update password.' };
  }

  return { success: true };
}

async function runAuthSecuritySuite() {
  console.log('================================================================================');
  console.log('  VCTM ERP — SUPABASE AUTH SECURITY & EMAIL VERIFICATION AUDIT SUITE           ');
  console.log('  Testing Sole Authority Supabase Auth Against Live Production Cloud Database  ');
  console.log('================================================================================\n');

  // --- 1. IDENTIFIER RESOLUTION MATRIX ---
  console.log('--- 1. INSTITUTIONAL IDENTIFIER RESOLUTION ---');
  const resolvedRoll = await resolveUserEmail('2403400100021');
  assert(resolvedRoll === '2403400100021@vctm.in', `Student roll number resolved to ${resolvedRoll}`);

  const resolvedEmp = await resolveUserEmail('FAC-CSE-002');
  assert(resolvedEmp === 'hemlata.cse@vctm.in', `Faculty employee code resolved to ${resolvedEmp}`);

  const resolvedCode = await resolveUserEmail('HEM');
  assert(resolvedCode === 'hemlata.cse@vctm.in', `Faculty timetable code resolved to ${resolvedCode}`);

  const resolvedAdmin = await resolveUserEmail('admin');
  assert(resolvedAdmin === 'admin@vctm.in', `Admin keyword resolved to ${resolvedAdmin}`);

  const resolvedDirect = await resolveUserEmail('student@vctm.in');
  assert(resolvedDirect === 'student@vctm.in', `Direct email preserved: ${resolvedDirect}`);

  // --- 2. NORMAL LOGIN (WITHOUT FORCED EMAIL CONFIRMATION) ---
  console.log('\n--- 2. NORMAL LOGIN WITHOUT FORCED EMAIL VERIFICATION ---');

  // Student Normal Login
  const studLogin = await simulateLogin('2403400100021', 'VctmStudent@2026');
  assert(studLogin.success === true, 'Student login succeeded without blocking on email confirmation');
  assert(Boolean(studLogin.session?.access_token), 'Student received authentic Supabase JWT session');
  assert(studLogin.user?.id !== undefined, 'Student user object has Supabase Auth UID');
  await supabase.auth.signOut();

  // Faculty Normal Login
  const facLogin = await simulateLogin('FAC-CSE-002', 'VctmFaculty@2026');
  assert(facLogin.success === true, 'Faculty login succeeded without blocking on email confirmation');
  assert(Boolean(facLogin.session?.access_token), 'Faculty received authentic Supabase JWT session');
  await supabase.auth.signOut();

  // HOD Normal Login
  const hodLogin = await simulateLogin('wasim.cse@vctm.in', 'VctmHod@2026');
  assert(hodLogin.success === true, 'HOD login succeeded without blocking on email confirmation');
  await supabase.auth.signOut();

  // Admin Normal Login
  const adminLogin = await simulateLogin('admin', 'VctmAdmin@2026');
  assert(adminLogin.success === true, 'Admin login succeeded without blocking on email confirmation');
  await supabase.auth.signOut();

  // --- 3. REJECTION OF INVALID CREDENTIALS ---
  console.log('\n--- 3. REJECTION OF INVALID CREDENTIALS ---');
  const badPass = await simulateLogin('2403400100021', 'WrongPassword123');
  assert(badPass.success === false, 'Wrong password rejected by Supabase Auth');
  assert(badPass.error === 'Invalid email or password.', 'Generic security error returned');

  const emptyPass = await simulateLogin('2403400100021', '');
  assert(emptyPass.success === false, 'Empty password rejected immediately');

  const whitespacePass = await simulateLogin('2403400100021', '     ');
  assert(whitespacePass.success === false, 'Whitespace password rejected immediately');

  const nonExistent = await simulateLogin('nonexistent999@vctm.in', 'VctmStudent@2026');
  assert(nonExistent.success === false, 'Non-existent account rejected');

  // --- 4. AUTHORITATIVE PASSWORD CHANGE FLOW ---
  console.log('\n--- 4. SENSITIVE CREDENTIALS: PASSWORD CHANGE FLOW ---');
  const targetEmail = '2403400100021@vctm.in';
  const currentPass = 'VctmStudent@2026';
  const tempPass = 'VctmStudent@New2026';

  // 4.1 Re-authentication failure with wrong current password
  const changeBadCurrent = await simulateChangePassword(targetEmail, 'IncorrectOldPass', tempPass);
  assert(changeBadCurrent.success === false, 'Password change rejected when current password is incorrect');
  assert(changeBadCurrent.error === 'Current password is incorrect.', 'Proper error feedback on invalid current password');

  // 4.2 Too short new password (< 6 chars)
  const changeTooShort = await simulateChangePassword(targetEmail, currentPass, '12345');
  assert(changeTooShort.success === false, 'Password change rejected when new password < 6 characters');

  // 4.3 Same password rejected
  const changeSame = await simulateChangePassword(targetEmail, currentPass, currentPass);
  assert(changeSame.success === false, 'Password change rejected when new password is identical to current');

  // 4.4 Successful password change
  const changeOk = await simulateChangePassword(targetEmail, currentPass, tempPass);
  assert(changeOk.success === true, 'Password update in Supabase Auth succeeded');

  // Verify new password works
  const loginWithNew = await simulateLogin(targetEmail, tempPass);
  assert(loginWithNew.success === true, 'New password verified by successful sign-in');

  // Idempotently restore original password
  const restorePass = await simulateChangePassword(targetEmail, tempPass, currentPass);
  assert(restorePass.success === true, 'Original password successfully restored');

  // Verify original password is back
  const loginWithRestored = await simulateLogin(targetEmail, currentPass);
  assert(loginWithRestored.success === true, 'Original password verified active');
  await supabase.auth.signOut();

  // --- 5. PASSWORD RECOVERY INITIATION (FORGOT PASSWORD) ---
  console.log('\n--- 5. PASSWORD RECOVERY DISPATCH ---');
  const { error: resetErr } = await supabase.auth.resetPasswordForEmail(targetEmail, {
    redirectTo: 'https://vctm.in/reset-password',
  });
  assert(!resetErr || resetErr.message.includes('rate') || resetErr.status === 429, 'resetPasswordForEmail triggers cleanly with Supabase Auth');

  // --- 6. PRESERVATION OF INSTITUTIONAL RELATIONAL DATA ---
  console.log('\n--- 6. DATA & IDENTITY PRESERVATION AUDIT ---');

  // Check profiles count
  const { count: profileCount, error: profErr } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });
  assert(!profErr && (profileCount || 0) > 0, `Preserved ${profileCount} profiles in Supabase`);

  // Check students count
  const { count: studentCount, error: studErr } = await supabase
    .from('students')
    .select('*', { count: 'exact', head: true });
  assert(!studErr && (studentCount || 0) > 0, `Preserved ${studentCount} students in Supabase`);

  // Check faculty count
  const { count: facultyCount, error: facErr } = await supabase
    .from('faculty')
    .select('*', { count: 'exact', head: true });
  assert(!facErr && (facultyCount || 0) > 0, `Preserved ${facultyCount} faculty records in Supabase`);

  // Check timetable entries count
  const { count: ttCount, error: ttErr } = await supabase
    .from('timetable_entries')
    .select('*', { count: 'exact', head: true });
  assert(!ttErr && (ttCount || 0) > 0, `Preserved ${ttCount} timetable entries in Supabase`);

  // Check attendance records count
  const { count: attCount, error: attErr } = await supabase
    .from('attendance_records')
    .select('*', { count: 'exact', head: true });
  assert(!attErr && (attCount || 0) >= 0, `Preserved ${attCount} attendance records in Supabase`);

  console.log('\n================================================================================');
  console.log(`  🎉 ALL ${passedChecks}/${totalChecks} AUTHENTICATION & SECURITY CHECKS PASSED! 🎉`);
  console.log('================================================================================');
}

runAuthSecuritySuite().catch((err) => {
  console.error('\n❌ Unhandled error in Auth Security Suite:', err);
  process.exit(1);
});
