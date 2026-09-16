import { supabaseService } from '../lib/services/supabaseService';
import { supabase } from '../lib/supabase/supabaseClient';

async function runTests() {
  console.log('========================================================================');
  console.log('SUPER ADMIN ACCOUNT MANAGEMENT & AUTHENTICATION VERIFICATION TEST');
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

  try {
    // 1. Authenticate as Super Admin (Tarun Kushwah)
    console.log('--- Test 1: Authenticating as Super Admin (Tarun Kushwah) ---');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@vctm.in',
      password: 'VctmAdmin@2026',
    });

    assert(!authError && Boolean(authData.session), 'Super Admin successfully authenticated via Supabase Auth');
    const adminUser = authData.user;
    assert(adminUser?.email === 'admin@vctm.in', 'Authenticated session user is admin@vctm.in');

    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', adminUser?.id)
      .single();

    assert(adminProfile?.full_name === 'Tarun Kushwah', `Profile loaded: full_name is '${adminProfile?.full_name}'`);
    assert(adminProfile?.role === 'super_admin', 'Profile role is super_admin');
    assert(adminProfile?.status === 'ACTIVE', 'Admin profile status is ACTIVE');

    // Verify current_user_role() kernel function returns 'super_admin' for active admin
    const { data: roleCheck } = await supabase.rpc('current_user_role');
    assert(roleCheck === 'super_admin', `public.current_user_role() returns '${roleCheck}' for active Super Admin`);

    // 2. Test get_admin_account_directory() RPC
    console.log('\n--- Test 2: Testing get_admin_account_directory() RPC ---');
    const directory = await supabaseService.fetchAdminAccounts();
    assert(Array.isArray(directory) && directory.length > 0, `Unified directory returned ${directory.length} accounts`);
    
    // Ensure passwords or secret tokens are never returned
    const anyPasswordLeaked = directory.some((acc: any) => acc.password || acc.encrypted_password || acc.password_hash);
    assert(!anyPasswordLeaked, 'Zero password or credential fields leaked in directory query');

    // Ensure status and last_sign_in_at fields exist
    const hasStatusField = directory.every(acc => acc.status && ['ACTIVE', 'BLOCKED', 'ARCHIVED', 'PENDING', 'SUSPENDED'].includes(acc.status));
    assert(hasStatusField, 'All directory entries have valid AccountStatus');

    const adminEntry = directory.find(acc => acc.email === 'admin@vctm.in');
    assert(adminEntry?.role === 'super_admin', 'Admin entry in directory has role super_admin');
    assert(Boolean(adminEntry?.last_sign_in_at), `Admin entry has recorded last_sign_in_at: ${adminEntry?.last_sign_in_at}`);

    // 3. Test Student Account Blocking, RLS revocation & Auth Rejection
    console.log('\n--- Test 3: Testing Account Blocking, Session Cutoff & RLS Revocation ---');
    const testCandidate = directory.find(acc => acc.role === 'student' && acc.status === 'ACTIVE');
    assert(Boolean(testCandidate), `Found active student candidate: ${testCandidate?.full_name} (${testCandidate?.user_id})`);

    if (testCandidate) {
      const studentEmail = testCandidate.email;
      const studentPassword = 'VctmStudent@2026';

      // 3A. First verify student can authenticate while ACTIVE
      const studentClient = supabase;
      console.log(`Verifying student login before block for ${studentEmail}...`);
      const { data: preBlockAuth, error: preBlockErr } = await studentClient.auth.signInWithPassword({
        email: studentEmail,
        password: studentPassword,
      });
      assert(!preBlockErr && Boolean(preBlockAuth.session), 'Student login succeeds while account status is ACTIVE');

      // Re-authenticate as Super Admin
      await supabase.auth.signInWithPassword({
        email: 'admin@vctm.in',
        password: 'VctmAdmin@2026',
      });

      // 3B. Super Admin BLOCKS the student account
      console.log(`Blocking student account ${testCandidate.user_id}...`);
      const blockRes = await supabaseService.updateAccountStatus(
        testCandidate.user_id,
        'BLOCKED',
        adminProfile?.id,
        'Tarun Kushwah',
        'super_admin',
        'Security test: administrative block'
      );
      assert(blockRes.success, 'update_account_status RPC successfully blocked student account');

      // Verify profiles table
      const { data: blockedProfile } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', testCandidate.user_id)
        .single();
      assert(blockedProfile?.status === 'BLOCKED', 'profiles.status is now BLOCKED');

      // Verify linked students table
      const { data: blockedStudentRow } = await supabase
        .from('students')
        .select('status, active')
        .eq('auth_user_id', testCandidate.user_id)
        .maybeSingle();
      if (blockedStudentRow) {
        assert(blockedStudentRow.status === 'BLOCKED' && blockedStudentRow.active === false, 'students table has status=BLOCKED and active=false');
      }

      // Verify audit_logs table (now readable because caller is super_admin!)
      const { data: blockAuditLogs } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('action', 'ACCOUNT_BLOCKED')
        .order('created_at', { ascending: false })
        .limit(1);
      assert(blockAuditLogs && blockAuditLogs.length > 0, 'Audit log recorded for ACCOUNT_BLOCKED');
      assert(blockAuditLogs?.[0]?.new_values?.status === 'BLOCKED', 'Audit log payload contains status=BLOCKED');

      // 3C. Verify Kernel RLS Enforcement: current_user_role() returns NULL for BLOCKED users
      // Sign in as blocked student to test RLS
      const { data: blockedAuth } = await supabase.auth.signInWithPassword({
        email: studentEmail,
        password: studentPassword,
      });

      if (blockedAuth?.session) {
        // Authenticated in Supabase Auth, but kernel current_user_role() must return NULL
        const { data: blockedRole } = await supabase.rpc('current_user_role');
        assert(blockedRole === null, `Kernel RLS enforcement: current_user_role() returns NULL for blocked account (actual: ${blockedRole})`);
      }

      // 3D. Super Admin UNBLOCKS the student account
      await supabase.auth.signInWithPassword({
        email: 'admin@vctm.in',
        password: 'VctmAdmin@2026',
      });

      console.log(`Unblocking student account ${testCandidate.user_id}...`);
      const unblockRes = await supabaseService.updateAccountStatus(
        testCandidate.user_id,
        'ACTIVE',
        adminProfile?.id,
        'Tarun Kushwah',
        'super_admin',
        'Security test: unblocking account'
      );
      assert(unblockRes.success, 'update_account_status RPC successfully unblocked student account');

      const { data: unblockedProfile } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', testCandidate.user_id)
        .single();
      assert(unblockedProfile?.status === 'ACTIVE', 'profiles.status is restored to ACTIVE');

      // Verify audit_logs table for ACCOUNT_UNBLOCKED
      const { data: unblockAuditLogs } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('action', 'ACCOUNT_UNBLOCKED')
        .order('created_at', { ascending: false })
        .limit(1);
      assert(unblockAuditLogs && unblockAuditLogs.length > 0, 'Audit log recorded for ACCOUNT_UNBLOCKED');
      assert(unblockAuditLogs?.[0]?.new_values?.status === 'ACTIVE', 'Audit log payload contains status=ACTIVE');
    }

    // 4. Test Audit Logging for Password Reset and Security Events
    console.log('\n--- Test 4: Testing Security Event Audit Logging ---');
    const logRes = await supabaseService.recordAuditLog({
      actor_id: adminProfile?.id,
      actor_name: 'Tarun Kushwah',
      actor_role: 'super_admin',
      action: 'PASSWORD_RESET_REQUESTED',
      entity_type: 'USER_ACCOUNT',
      entity_id: testCandidate?.user_id,
      new_values: { email: 'student.test@vctm.in', note: 'Password reset dispatch tested' },
    });
    assert(logRes.success, 'recordAuditLog successfully inserted PASSWORD_RESET_REQUESTED audit record');

    const { data: verifyResetAudit } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('action', 'PASSWORD_RESET_REQUESTED')
      .order('created_at', { ascending: false })
      .limit(1);
    assert(verifyResetAudit && verifyResetAudit.length > 0, 'Verified PASSWORD_RESET_REQUESTED in audit_logs table');
    assert(!verifyResetAudit?.[0]?.new_values?.password, 'Zero plaintext password data stored in audit logs');

    // 5. Test Preserving Existing Users
    console.log('\n--- Test 5: Preserving Existing Critical Users ---');
    const { data: wasimProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', 'wasim.cse@vctm.in')
      .single();
    assert(wasimProfile?.role === 'hod', 'Wasim Akram retains role hod');
    assert(wasimProfile?.status === 'ACTIVE', 'Wasim Akram retains status ACTIVE');

    console.log('\n========================================================================');
    console.log(`TEST RESULTS: ${passed}/${total} assertions passed`);
    console.log('========================================================================');
  } catch (err) {
    console.error('Test execution failed with unexpected exception:', err);
    process.exitCode = 1;
  } finally {
    // Keep admin signed in
    await supabase.auth.signInWithPassword({
      email: 'admin@vctm.in',
      password: 'VctmAdmin@2026',
    }).catch(() => {});
  }
}

runTests();
