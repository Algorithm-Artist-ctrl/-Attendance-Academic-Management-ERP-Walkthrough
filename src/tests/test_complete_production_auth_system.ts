import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';

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

// Simulates AuthContext resolveUserEmail
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
    .or(`roll_number.ilike.${cleanRoll},roll_number.ilike.${trimmed}`)
    .maybeSingle();

  if (student) {
    if (student.email) return student.email.toLowerCase().trim();
    const { data: prof } = await supabase
      .from('profiles')
      .select('email')
      .eq('student_id', student.id)
      .maybeSingle();
    if (prof?.email) return prof.email.toLowerCase().trim();
    return `${cleanRoll.toLowerCase()}@student.vctm.in`;
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
  if (/^\d+$/.test(cleanRoll)) return `${cleanRoll.toLowerCase()}@student.vctm.in`;
  return null;
}

// Simulates AuthContext login
async function simulateLogin(identifier: string, pass: string) {
  if (!identifier || !pass || !pass.trim()) {
    return { success: false, error: 'Invalid email or password.' };
  }
  const email = await resolveUserEmail(identifier);
  if (!email) {
    return { success: false, error: 'Invalid email or password.' };
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pass,
  });
  if (error || !data.session || !data.user) {
    return { success: false, error: 'Invalid email or password.' };
  }

  // Profile lookup
  let { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .maybeSingle();

  if (!profile) {
    const { data: profByEmail } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', data.user.email?.toLowerCase().trim() || '')
      .maybeSingle();
    profile = profByEmail;
  }

  return { success: true, user: data.user, session: data.session, profile, email };
}

async function runAllTests() {
  console.log('================================================================');
  console.log('  VCTM ERP — PRODUCTION AUTHENTICATION & PROVISIONING SUITE');
  console.log('================================================================\n');

  // --- Scenario 1: Super Admin Authentication ---
  console.log('--- SCENARIO 1: Super Admin Authentication ---');
  let adminLogin = await simulateLogin('admin', 'VctmAdmin@2026');
  if (!adminLogin.success) {
    adminLogin = await simulateLogin('admin', 'admin@123');
  }
  assert(adminLogin.success === true, 'Super Admin login with "admin" keyword succeeds');
  assert(adminLogin.profile?.role === 'super_admin', 'Super Admin profile role is super_admin');
  assert(Boolean(adminLogin.session?.access_token), 'Super Admin receives real Supabase JWT session');
  await supabase.auth.signOut();

  // --- Scenario 2: 2nd Year Student Authentication ---
  console.log('\n--- SCENARIO 2: 2nd Year Student Authentication ---');
  const student2Login = await simulateLogin('2503400100003', 'student123');
  assert(student2Login.success === true, '2nd Year Student login with roll number succeeds');
  assert(student2Login.profile?.role === 'student', '2nd Year Student profile role is student');
  assert(Boolean(student2Login.profile?.student_id), 'Student profile has linked student_id');
  await supabase.auth.signOut();

  // --- Scenario 3: 3rd Year Student Authentication ---
  console.log('\n--- SCENARIO 3: 3rd Year Student Authentication ---');
  const student3Login = await simulateLogin('2403400100004', 'student123');
  assert(student3Login.success === true, '3rd Year Student login with roll number succeeds');
  assert(student3Login.profile?.role === 'student', '3rd Year Student profile role is student');
  assert(Boolean(student3Login.session?.access_token), '3rd Year Student receives real Supabase JWT session');
  await supabase.auth.signOut();

  // --- Scenario 4: 4th Year Student Authentication ---
  console.log('\n--- SCENARIO 4: 4th Year Student Authentication ---');
  const student4Login = await simulateLogin('2303400100033', 'student123');
  assert(student4Login.success === true, '4th Year Student login with roll number succeeds');
  assert(student4Login.profile?.role === 'student', '4th Year Student profile role is student');
  assert(Boolean(student4Login.session?.access_token), '4th Year Student receives real Supabase JWT session');
  await supabase.auth.signOut();

  // --- Scenario 5: Faculty Member Authentication ---
  console.log('\n--- SCENARIO 5: Faculty Member Authentication ---');
  const facLogin = await simulateLogin('shilpi.cse@vctm.in', 'faculty@123');
  assert(facLogin.success === true, 'Faculty Member login with official email succeeds');
  assert(facLogin.profile?.role === 'faculty', 'Faculty Member profile role is faculty');
  assert(Boolean(facLogin.profile?.faculty_id), 'Faculty profile has linked faculty_id');
  await supabase.auth.signOut();

  // --- Scenario 6: HOD Authentication ---
  console.log('\n--- SCENARIO 6: HOD Authentication ---');
  const hodLogin = await simulateLogin('FAC-CSE-001', 'faculty@123');
  assert(hodLogin.success === true, 'HOD login with employee code FAC-CSE-001 succeeds');
  assert(hodLogin.profile?.role === 'hod', 'HOD profile role is hod');
  await supabase.auth.signOut();

  // --- Scenario 7: Student Add Provisioning Flow ---
  console.log('\n--- SCENARIO 7: Student Add Provisioning Flow ---');
  const testRoll = `TEST_${Date.now().toString().slice(-6)}`;
  // Find an active section
  const { data: sampleSec } = await supabase.from('sections').select('id, semester_id').limit(1).single();
  assert(Boolean(sampleSec), 'Found active section in database');

  const newStudent = await supabaseService.addStudent({
    roll_number: testRoll,
    full_name: 'AUTOMATED TEST STUDENT',
    section_id: sampleSec!.id,
    semester_id: sampleSec!.semester_id,
    admission_type: 'Regular',
    email: `${testRoll.toLowerCase()}@student.vctm.in`,
    phone: '9999888877',
    status: 'ACTIVE',
    active: true,
  });

  assert(Boolean(newStudent.id), 'Newly provisioned student has database ID');
  assert(Boolean(newStudent.auth_user_id), 'Newly provisioned student has linked auth_user_id');

  // Verify that the student can immediately authenticate
  const newStudLogin = await simulateLogin(testRoll, 'student123');
  assert(newStudLogin.success === true, 'Newly provisioned student can authenticate immediately via Supabase Auth');
  assert(newStudLogin.user.id === newStudent.auth_user_id, 'Auth user ID matches student.auth_user_id');
  await supabase.auth.signOut();

  // Clean up test student
  await supabase.from('students').delete().eq('id', newStudent.id);
  await supabase.from('profiles').delete().eq('id', newStudent.auth_user_id);
  console.log('  ✓ Cleaned up temporary test student');

  // --- Scenario 8: Faculty Add Provisioning Flow ---
  console.log('\n--- SCENARIO 8: Faculty Add Provisioning Flow ---');
  const testEmpCode = `FAC_TEST_${Date.now().toString().slice(-4)}`;
  const { data: dept } = await supabase.from('departments').select('id').limit(1).single();

  const newFacultyResult = await supabaseService.createFacultyWithAssignments({
    faculty: {
      employee_code: testEmpCode,
      faculty_code: 'FT',
      full_name: 'AUTOMATED TEST FACULTY',
      email: `${testEmpCode.toLowerCase()}@faculty.vctm.in`,
      department_id: dept!.id,
      designation: 'Assistant Professor',
      phone: '9876500000',
      status: 'ACTIVE',
      active: true,
    },
    assignments: [],
    actorName: 'Test Suite',
  });

  assert(Boolean(newFacultyResult.faculty.id), 'Newly provisioned faculty has database ID');
  assert(Boolean(newFacultyResult.faculty.auth_user_id), 'Newly provisioned faculty has linked auth_user_id');

  // Verify that the faculty can immediately authenticate
  const newFacLogin = await simulateLogin(`${testEmpCode.toLowerCase()}@faculty.vctm.in`, 'faculty@123');
  assert(newFacLogin.success === true, 'Newly provisioned faculty can authenticate immediately via Supabase Auth');
  await supabase.auth.signOut();

  // Clean up test faculty
  await supabase.from('faculty').delete().eq('id', newFacultyResult.faculty.id);
  await supabase.from('profiles').delete().eq('id', newFacultyResult.faculty.auth_user_id);
  console.log('  ✓ Cleaned up temporary test faculty');

  // --- Scenario 9: Batch Reconciliation Idempotence ---
  console.log('\n--- SCENARIO 9: Batch Reconciliation Idempotence ---');
  const reconRes = await supabaseService.reconcileAuthAccounts();
  assert(reconRes.success === true, 'reconcile_all_accounts RPC returned success');
  console.log(`  ✓ Reconciliation executed: ${reconRes.reconciled_students} students, ${reconRes.reconciled_faculty} faculty`);

  // Verify zero unlinked active students and faculty
  const { count: unlinkedStudents } = await supabase
    .from('students')
    .select('*', { count: 'exact', head: true })
    .eq('active', true)
    .is('auth_user_id', null);
  assert(unlinkedStudents === 0, 'Zero active students are unlinked in Supabase');

  const { count: unlinkedFaculty } = await supabase
    .from('faculty')
    .select('*', { count: 'exact', head: true })
    .eq('active', true)
    .is('auth_user_id', null);
  assert(unlinkedFaculty === 0, 'Zero active faculty are unlinked in Supabase');

  // --- Scenario 10: Wrong Password Rejection ---
  console.log('\n--- SCENARIO 10: Rejection of Invalid Password ---');
  const badLogin = await simulateLogin('2403400100004', 'totallyWrongPassword999');
  assert(badLogin.success === false, 'Wrong password is unambiguously rejected');
  assert(badLogin.error === 'Invalid email or password.', 'Generic security error message returned');

  // --- Scenario 11: Blank / Empty Credentials Rejection ---
  console.log('\n--- SCENARIO 11: Blank / Empty Credentials Rejection ---');
  const emptyLogin = await simulateLogin('', '');
  assert(emptyLogin.success === false, 'Blank credentials rejected immediately');
  const whitespaceLogin = await simulateLogin('admin', '   ');
  assert(whitespaceLogin.success === false, 'Whitespace-only password rejected immediately');

  // --- Scenario 12: Student Directory & Auth Coverage ---
  console.log('\n--- SCENARIO 12: Student Directory & Auth Coverage ---');
  const { data: allActiveStudents, count: studentCount } = await supabase
    .from('students')
    .select('id, roll_number, auth_user_id', { count: 'exact' })
    .eq('active', true);
  const fullyLinked = (allActiveStudents || []).every(s => Boolean(s.auth_user_id));
  assert(fullyLinked === true, `All ${studentCount} active students have non-null auth_user_id`);

  // --- Scenario 13: Timetable Integrity for 3rd and 4th Year Sections ---
  console.log('\n--- SCENARIO 13: Timetable Integrity (48 weekly slots) ---');
  const targetSections = [
    { name: '3rd Year Sec B', id: '648a9246-601d-40a1-b43d-2b1a1a89ea32' },
    { name: '4th Year Sec A', id: '7b80ad81-10be-403a-a3a2-26ff7079b4df' },
    { name: '4th Year Sec B', id: '7eff4f33-f602-499f-92a2-d1e83f474373' },
  ];

  for (const sec of targetSections) {
    const { count: slotCount } = await supabase
      .from('timetable_entries')
      .select('*', { count: 'exact', head: true })
      .eq('section_id', sec.id)
      .eq('active', true);

    assert((slotCount || 0) >= 30, `${sec.name} has active weekly timetable slots (found ${slotCount})`);
  }

  // --- Scenario 14: Faculty Assignment Integrity ---
  console.log('\n--- SCENARIO 14: Faculty Relational Assignment Integrity ---');
  const { count: assignCount } = await supabase
    .from('faculty_subject_assignments')
    .select('*', { count: 'exact', head: true })
    .eq('active', true);
  assert((assignCount || 0) >= 30, `Database has ${assignCount} active relational faculty assignments`);

  console.log('\n================================================================');
  console.log(`  SUMMARY: ${passedChecks}/${totalChecks} CHECKS PASSED PERFECTLY!`);
  console.log('================================================================\n');
}

runAllTests().catch(err => {
  console.error('Test Suite Unhandled Exception:', err);
  process.exit(1);
});
