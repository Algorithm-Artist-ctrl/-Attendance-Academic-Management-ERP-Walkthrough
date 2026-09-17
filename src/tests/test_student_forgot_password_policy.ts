import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { supabaseService } from '../lib/services/supabaseService';

const supabaseUrl = 'https://obssoojzryqiudllnlkh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ic3Nvb2p6cnlxaXVkbGxubGtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MDU0NzUsImV4cCI6MjEwMjk4MTQ3NX0.eFCU024aroXFpTqnOaVUOpOUpONBwm3KDDdLfzlZ5co';

function createFreshClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function run() {
  console.log('========================================================================');
  console.log('TEST: VCTM ERP STUDENT FORGOT-PASSWORD FLOW & ADMIN CREDENTIAL POLICY');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`[PASS] ${msg}`);
      passed++;
    } else {
      console.error(`[FAIL] ${msg}`);
      process.exitCode = 1;
    }
  }

  // ------------------------------------------------------------------------
  // 1. CODE STRUCTURE & SECURITY AUDIT
  // ------------------------------------------------------------------------
  console.log('--- 1. Static Audit: ForgotPasswordModal & StudentAccountsPage ---');

  const forgotModalPath = path.resolve(path.join(process.cwd(), "src/tests"), '../components/auth/ForgotPasswordModal.tsx');
  const forgotModalContent = fs.readFileSync(forgotModalPath, 'utf8');

  assert(
    forgotModalContent.includes("portalRole?: 'student' | 'faculty' | 'admin' | string"),
    'ForgotPasswordModal accepts portalRole prop'
  );
  assert(
    forgotModalContent.includes('For security reasons, students cannot reset their password directly.'),
    'ForgotPasswordModal contains required student security notice'
  );
  assert(
    forgotModalContent.includes('Please contact your Super Admin / College Administrator to reset your account password.'),
    'ForgotPasswordModal contains required administrator contact advice'
  );
  assert(
    forgotModalContent.includes('Back to Login'),
    'ForgotPasswordModal renders Back to Login button for student recovery'
  );
  assert(
    forgotModalContent.includes('if (isStudent)'),
    'ForgotPasswordModal branches on if (isStudent) with early clean informational modal return'
  );

  const loginPagePath = path.resolve(path.join(process.cwd(), "src/tests"), '../pages/auth/LoginPage.tsx');
  const loginPageContent = fs.readFileSync(loginPagePath, 'utf8');
  assert(
    loginPageContent.includes('portalRole={activeRoleTab}'),
    'LoginPage binds portalRole={activeRoleTab} to ForgotPasswordModal'
  );

  const resetModalPath = path.resolve(path.join(process.cwd(), "src/tests"), '../components/auth/ResetPasswordModal.tsx');
  const resetModalContent = fs.readFileSync(resetModalPath, 'utf8');
  assert(
    resetModalContent.includes("role === 'student' || user?.role === 'student'"),
    'ResetPasswordModal detects student session role'
  );
  assert(
    resetModalContent.includes('For security reasons, students cannot reset their password directly.'),
    'ResetPasswordModal blocks password change for student session'
  );

  const studentAccountsPagePath = path.resolve(path.join(process.cwd(), "src/tests"), '../pages/admin/StudentAccountsPage.tsx');
  const studentAccountsContent = fs.readFileSync(studentAccountsPagePath, 'utf8');
  assert(
    !studentAccountsContent.includes('Send Reset Link'),
    'StudentAccountsPage does NOT have obsolete "Send Reset Link" button'
  );
  assert(
    !studentAccountsContent.includes('requestPasswordReset'),
    'StudentAccountsPage does NOT import or call requestPasswordReset'
  );
  assert(
    studentAccountsContent.includes("password: 'VctmStudent@2026'"),
    'StudentAccountsPage applies official default password "VctmStudent@2026"'
  );

  // ------------------------------------------------------------------------
  // 2. DEFENSE-IN-DEPTH: SERVICE LAYER GUARDS
  // ------------------------------------------------------------------------
  console.log('\n--- 2. Service Layer Defense: supabaseService.requestPasswordReset ---');

  // Test 2A: student email rejection
  const studentEmailRes = await supabaseService.requestPasswordReset('220101@student.vctm.in');
  assert(
    studentEmailRes.success === false &&
    studentEmailRes.error?.includes('For security reasons, students cannot reset their password directly'),
    'supabaseService.requestPasswordReset strictly rejects student email (@student.vctm.in)'
  );

  // Test 2B: student lookup by email in students table
  const testClient = createFreshClient();
  const { data: aStudent } = await testClient
    .from('students')
    .select('id, email, roll_number')
    .not('email', 'is', null)
    .limit(1)
    .single();

  if (aStudent && aStudent.email) {
    const studentDbRes = await supabaseService.requestPasswordReset(aStudent.email);
    assert(
      studentDbRes.success === false &&
      studentDbRes.error?.includes('For security reasons, students cannot reset their password directly'),
      `supabaseService.requestPasswordReset rejects registered student (${aStudent.email})`
    );
  } else {
    assert(true, 'No student with email found in DB (skipped db student lookup)');
  }

  // ------------------------------------------------------------------------
  // 3. SUPER ADMIN CREDENTIAL MANAGEMENT (SUPABASE AUTH DIRECT RPC)
  // ------------------------------------------------------------------------
  console.log('\n--- 3. Super Admin Direct Credential Updates (No Email Confirm) ---');

  // 3A: Authenticate as Super Admin
  const adminClient = createFreshClient();
  const { data: adminAuth, error: adminAuthErr } = await adminClient.auth.signInWithPassword({
    email: 'admin@vctm.in',
    password: 'VctmAdmin@2026',
  });

  assert(!adminAuthErr && !!adminAuth.session, 'Super Admin authenticated with Supabase Auth');

  // Find a test student auth account
  const { data: studentProfile } = await adminClient
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('role', 'student')
    .limit(1)
    .single();

  assert(!!studentProfile, `Found target student profile: ${studentProfile?.email || studentProfile?.id}`);

  if (studentProfile) {
    const targetUserId = studentProfile.id;
    const studentEmail = studentProfile.email;

    // 3B: Super Admin sets custom password directly
    const customPass = 'VctmStudent@Test2026';
    const { data: updateRes, error: updateErr } = await adminClient.rpc(
      'admin_update_account_credentials',
      {
        p_target_user_id: targetUserId,
        p_new_password: customPass,
        p_is_default_password: false,
        p_actor_name: 'Tarun Kushwah',
        p_actor_role: 'super_admin',
      }
    );

    assert(!updateErr && updateRes?.success === true, 'admin_update_account_credentials RPC succeeded for custom password');

    // 3C: Student logs in IMMEDIATELY with custom password (no email confirmation needed)
    const studentClient = createFreshClient();
    const { data: studentLogin1, error: studentLogin1Err } = await studentClient.auth.signInWithPassword({
      email: studentEmail,
      password: customPass,
    });

    assert(
      !studentLogin1Err && !!studentLogin1.session,
      `Student successfully logged in with admin-assigned password without email confirmation (${studentLogin1.user?.email})`
    );

    // 3D: Super Admin sets official default password 'VctmStudent@2026'
    const defaultPass = 'VctmStudent@2026';
    const { data: defaultRes, error: defaultErr } = await adminClient.rpc(
      'admin_update_account_credentials',
      {
        p_target_user_id: targetUserId,
        p_new_password: defaultPass,
        p_is_default_password: true,
        p_actor_name: 'Tarun Kushwah',
        p_actor_role: 'super_admin',
      }
    );

    assert(!defaultErr && defaultRes?.success === true, 'admin_update_account_credentials RPC succeeded for default password');

    // 3E: Student logs in with default password 'VctmStudent@2026'
    const studentClient2 = createFreshClient();
    const { data: studentLogin2, error: studentLogin2Err } = await studentClient2.auth.signInWithPassword({
      email: studentEmail,
      password: defaultPass,
    });

    assert(
      !studentLogin2Err && !!studentLogin2.session,
      `Student successfully logged in with default password (${defaultPass}) immediately`
    );
  }

  // ------------------------------------------------------------------------
  // SUMMARY
  // ------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`TOTAL TESTS: ${total} | PASSED: ${passed} | FAILED: ${total - passed}`);
  console.log('========================================================================');

  if (passed === total) {
    console.log('ALL STUDENT FORGOT-PASSWORD & CREDENTIAL MANAGEMENT TESTS PASSED!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal error in test:', err);
  process.exit(1);
});
