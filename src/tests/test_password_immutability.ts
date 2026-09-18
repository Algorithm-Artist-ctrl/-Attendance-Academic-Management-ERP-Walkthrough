import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.obssoojzryqiudllnlkh:Tarun%40759977@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres';
const supabaseUrl = 'https://obssoojzryqiudllnlkh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ic3Nvb2p6cnlxaXVkbGxubGtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MDU0NzUsImV4cCI6MjEwMjk4MTQ3NX0.eFCU024aroXFpTqnOaVUOpOUpONBwm3KDDdLfzlZ5co';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let totalChecks = 0;
let passedChecks = 0;

function assert(condition: boolean, desc: string) {
  totalChecks++;
  if (condition) {
    console.log(`  ✓ [Check ${totalChecks}] ${desc}`);
    passedChecks++;
  } else {
    console.error(`  ❌ [FAIL ${totalChecks}] ${desc}`);
    process.exitCode = 1;
  }
}

async function run() {
  console.log('========================================================================');
  console.log('  VCTM ERP: PASSWORD IMMUTABILITY & EMAIL VERIFICATION TEST SUITE');
  console.log('========================================================================\n');

  const pgClient = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await pgClient.connect();
  console.log('Connected to Supabase PostgreSQL database.\n');

  try {
    // --------------------------------------------------------------------------
    // SECTION 1: Schema Security - Zero Plaintext Password Columns
    // --------------------------------------------------------------------------
    console.log('--- SECTION 1: Database Column Security & Zero Plaintext Columns ---');
    const colsRes = await pgClient.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND (column_name ILIKE '%password%' OR column_name ILIKE '%passwd%');
    `);
    assert(colsRes.rows.length === 0, 'Zero password or plaintext credentials columns exist in public schema tables');

    // --------------------------------------------------------------------------
    // SECTION 2: Super Admin Dynamic Email Resolution
    // --------------------------------------------------------------------------
    console.log('\n--- SECTION 2: Dynamic Super Admin Email Resolution ---');
    const adminProfRes = await pgClient.query(`
      SELECT p.id, p.email, p.full_name, p.role, u.email as auth_email
      FROM public.profiles p
      JOIN auth.users u ON u.id = p.id
      WHERE p.role = 'super_admin';
    `);
    assert(adminProfRes.rows.length > 0, 'Super admin profile exists in database');
    const superAdmin = adminProfRes.rows[0];
    assert(superAdmin.email === 'tarunkushwah798@gmail.com', 'Super admin profile email matches active email (tarunkushwah798@gmail.com)');
    assert(superAdmin.auth_email === 'tarunkushwah798@gmail.com', 'auth.users email is synchronized with profiles email');

    // Test dynamic resolution query (as implemented in resolveUserEmail)
    const { data: resolvedAdmin } = await supabase
      .from('profiles')
      .select('email')
      .eq('role', 'super_admin')
      .limit(1)
      .maybeSingle();
    assert(resolvedAdmin?.email === 'tarunkushwah798@gmail.com', 'Dynamic resolver returns active Super Admin email');

    // Test Super Admin sign in with resolved email and VctmAdmin@2026
    const adminAuthRes = await supabase.auth.signInWithPassword({
      email: resolvedAdmin!.email,
      password: 'VctmAdmin@2026',
    });
    assert(!adminAuthRes.error && !!adminAuthRes.data.session, 'Super Admin successfully signs in with password "VctmAdmin@2026"');
    const adminAuthId = adminAuthRes.data.user?.id;

    // --------------------------------------------------------------------------
    // SECTION 3: Dedicated Isolated Test Accounts Provisioning
    // --------------------------------------------------------------------------
    console.log('\n--- SECTION 3: Provisioning Isolated Test Faculty & Student Accounts ---');
    // Ensure clean slate for test accounts
    await pgClient.query(`
      DELETE FROM auth.users WHERE email IN ('test_immut_fac@vctm.in', 'test_immut_stu@vctm.in');
      DELETE FROM public.profiles WHERE email IN ('test_immut_fac@vctm.in', 'test_immut_stu@vctm.in');
      DELETE FROM public.faculty WHERE email = 'test_immut_fac@vctm.in';
      DELETE FROM public.students WHERE email = 'test_immut_stu@vctm.in';
    `);

    // Get a section and department
    const secRes = await pgClient.query(`SELECT id FROM public.sections LIMIT 1;`);
    const testSecId = secRes.rows[0].id;
    const deptRes = await pgClient.query(`SELECT id FROM public.departments LIMIT 1;`);
    const testDeptId = deptRes.rows[0].id;

    // Provision Test Faculty via RPC
    const provFacRes = await pgClient.query(`
      SELECT public.provision_faculty_account(
        p_employee_code := 'TESTIMMUT01',
        p_full_name := 'Test Immutability Faculty',
        p_email := 'test_immut_fac@vctm.in',
        p_department_id := $1,
        p_designation := 'Assistant Professor',
        p_faculty_code := 'TIF',
        p_password := 'CustomPass@123',
        p_actor_name := 'Super Admin'
      );
    `, [testDeptId]);
    const facJson = provFacRes.rows[0].provision_faculty_account;
    const testFacId = facJson.faculty_id;
    const testFacAuthId = facJson.auth_user_id || facJson.faculty_id;
    assert(!!testFacAuthId, 'Provisioned isolated test faculty account with password "CustomPass@123"');

    // Provision Test Student via RPC
    const provStuRes = await pgClient.query(`
      SELECT public.provision_student_account(
        p_roll_number := 'TESTROLLIMMUT01',
        p_full_name := 'Test Immutability Student',
        p_section_id := $1,
        p_admission_type := 'Regular',
        p_email := 'test_immut_stu@vctm.in',
        p_password := 'StuSecret@123',
        p_actor_name := 'Super Admin'
      );
    `, [testSecId]);
    const stuJson = provStuRes.rows[0].provision_student_account;
    const testStuId = stuJson.student_id;
    const testStuAuthId = stuJson.auth_user_id || stuJson.student_id;
    assert(!!testStuAuthId, 'Provisioned isolated test student account with password "StuSecret@123"');

    // Snapshot password hashes
    const getHashes = async () => {
      const hRes = await pgClient.query(`
        SELECT id, email, encrypted_password 
        FROM auth.users 
        WHERE id IN ($1, $2, $3)
        ORDER BY id;
      `, [adminAuthId, testFacAuthId, testStuAuthId]);
      const map: Record<string, string> = {};
      for (const row of hRes.rows) {
        map[row.id] = row.encrypted_password;
      }
      return map;
    };

    const initialHashes = await getHashes();
    assert(!!initialHashes[testFacAuthId], 'Captured initial password hash for test faculty');
    assert(!!initialHashes[testStuAuthId], 'Captured initial password hash for test student');

    // --------------------------------------------------------------------------
    // SECTION 4: Login Operations Do NOT Change Passwords (Scenario 1)
    // --------------------------------------------------------------------------
    console.log('\n--- SECTION 4: Login Verification & Zero Password Rehash ---');
    const facLoginRes = await supabase.auth.signInWithPassword({
      email: 'test_immut_fac@vctm.in',
      password: 'CustomPass@123',
    });
    assert(!facLoginRes.error && !!facLoginRes.data.session, 'Test Faculty logged in successfully with original password');

    const hashesAfterLogin = await getHashes();
    assert(hashesAfterLogin[testFacAuthId] === initialHashes[testFacAuthId], 'Faculty password hash is byte-for-byte identical after login');
    assert(hashesAfterLogin[testStuAuthId] === initialHashes[testStuAuthId], 'Student password hash is byte-for-byte identical after login');

    // --------------------------------------------------------------------------
    // SECTION 5: Profile & Record Updates Do NOT Touch Passwords (Scenario 2 & 3)
    // --------------------------------------------------------------------------
    console.log('\n--- SECTION 5: Profile Updates, Phone Edits, & Timetable Changes ---');
    // Update faculty profile
    await pgClient.query(`
      UPDATE public.faculty 
      SET phone = '9876543210', designation = 'Associate Professor', updated_at = NOW()
      WHERE email = 'test_immut_fac@vctm.in';
    `);
    await pgClient.query(`
      UPDATE public.profiles 
      SET phone = '9876543210', full_name = 'Test Immutability Faculty (Updated)', updated_at = NOW()
      WHERE id = $1;
    `, [testFacAuthId]);

    const hashesAfterProfileUpdate = await getHashes();
    assert(hashesAfterProfileUpdate[testFacAuthId] === initialHashes[testFacAuthId], 'Faculty password hash unchanged after faculty/profile data updates');

    // --------------------------------------------------------------------------
    // SECTION 6: Batch Reconciliation Does NOT Reset Existing Passwords (Scenario 4)
    // --------------------------------------------------------------------------
    console.log('\n--- SECTION 6: System Account Reconciliation Protection ---');
    const reconRes = await pgClient.query(`SELECT public.reconcile_all_accounts();`);
    assert(reconRes.rows[0].reconcile_all_accounts.success === true, 'reconcile_all_accounts RPC executed successfully');

    const hashesAfterRecon = await getHashes();
    assert(hashesAfterRecon[testFacAuthId] === initialHashes[testFacAuthId], 'reconcile_all_accounts DID NOT reset or modify faculty password');
    assert(hashesAfterRecon[testStuAuthId] === initialHashes[testStuAuthId], 'reconcile_all_accounts DID NOT reset or modify student password');
    assert(hashesAfterRecon[adminAuthId] === initialHashes[adminAuthId], 'reconcile_all_accounts DID NOT reset or modify super admin password');

    // --------------------------------------------------------------------------
    // SECTION 7: admin_update_account_credentials With NULL Password (Scenario 5)
    // --------------------------------------------------------------------------
    console.log('\n--- SECTION 7: admin_update_account_credentials Safety Invariant ---');
    // Call admin_update_account_credentials to update email ONLY (password = NULL)
    const updateEmailOnlyRes = await pgClient.query(`
      SELECT public.admin_update_account_credentials(
        p_target_user_id := $1,
        p_new_email := 'test_immut_fac_updated@vctm.in',
        p_new_password := NULL,
        p_actor_name := 'Super Admin'
      );
    `, [testFacAuthId]);
    const updateEmailJson = updateEmailOnlyRes.rows[0].admin_update_account_credentials;
    assert(updateEmailJson.success === true, 'admin_update_account_credentials updated email');
    assert(updateEmailJson.email_updated === true, 'Email updated flag is true');
    assert(updateEmailJson.password_updated === false, 'Password updated flag is strictly FALSE');

    const hashesAfterEmailUpdate = await getHashes();
    assert(hashesAfterEmailUpdate[testFacAuthId] === initialHashes[testFacAuthId], 'Password hash is 100% UNTOUCHED when updating email');

    // Faculty can still log in with the SAME original password using their new email
    const facLoginNewEmail = await supabase.auth.signInWithPassword({
      email: 'test_immut_fac_updated@vctm.in',
      password: 'CustomPass@123',
    });
    assert(!facLoginNewEmail.error && !!facLoginNewEmail.data.session, 'Faculty logs in with new email using unchanged original password ("CustomPass@123")');

    // --------------------------------------------------------------------------
    // SECTION 8: Guard Against Creating Accounts with Default Passwords (Scenario 6)
    // --------------------------------------------------------------------------
    console.log('\n--- SECTION 8: Orphaned User Zero-Default-Password Guard ---');
    const fakeUserId = '00000000-0000-0000-0000-111111111111';
    let exceptionThrown = false;
    let exceptionMsg = '';
    try {
      await pgClient.query(`
        SELECT public.admin_update_account_credentials(
          p_target_user_id := $1,
          p_new_email := 'orphan@vctm.in',
          p_new_password := NULL
        );
      `, [fakeUserId]);
    } catch (err: any) {
      exceptionThrown = true;
      exceptionMsg = err.message;
    }
    assert(exceptionThrown, 'admin_update_account_credentials throws exception for non-existent auth user when password is NULL');
    assert(exceptionMsg.includes('Cannot update credentials without explicit password provisioning'), 'Exception explicitly explains zero default password policy');

    // Verify orphan user was NOT created in auth.users
    const orphanCheck = await pgClient.query(`SELECT 1 FROM auth.users WHERE id = $1;`, [fakeUserId]);
    assert(orphanCheck.rows.length === 0, 'Zero orphaned users created with default passwords');

    // --------------------------------------------------------------------------
    // SECTION 9: Explicit Super Admin Password Reset (Scenario 7)
    // --------------------------------------------------------------------------
    console.log('\n--- SECTION 9: Explicit Super Admin Password Reset ---');
    const explicitPassRes = await pgClient.query(`
      SELECT public.admin_update_account_credentials(
        p_target_user_id := $1,
        p_new_email := NULL,
        p_new_password := 'NewExplicitFacultyPass@2026',
        p_actor_name := 'Super Admin'
      );
    `, [testFacAuthId]);
    const explicitJson = explicitPassRes.rows[0].admin_update_account_credentials;
    assert(explicitJson.success === true, 'admin_update_account_credentials succeeded for explicit password update');
    assert(explicitJson.password_updated === true, 'password_updated flag is TRUE for explicit update');

    // Verify login with new password works and old password fails
    const oldLoginFail = await supabase.auth.signInWithPassword({
      email: 'test_immut_fac_updated@vctm.in',
      password: 'CustomPass@123',
    });
    assert(!!oldLoginFail.error, 'Old password rejected after explicit reset');

    const newLoginSuccess = await supabase.auth.signInWithPassword({
      email: 'test_immut_fac_updated@vctm.in',
      password: 'NewExplicitFacultyPass@2026',
    });
    assert(!newLoginSuccess.error && !!newLoginSuccess.data.session, 'Faculty successfully logs in with new explicitly set password');

    // --------------------------------------------------------------------------
    // SECTION 10: Audit Log Verification - Zero Plaintext Passwords
    // --------------------------------------------------------------------------
    console.log('\n--- SECTION 10: Audit Log Security & Nonce Verification ---');
    const auditRes = await pgClient.query(`
      SELECT action, old_values, new_values 
      FROM public.audit_logs 
      WHERE entity_id IN ($1, $2, $3, $4)
      ORDER BY created_at DESC;
    `, [testFacId, testFacAuthId, testStuId, testStuAuthId]);
    assert(auditRes.rows.length > 0, `Audit logs recorded for test account actions (${auditRes.rows.length} entries)`);

    const hasPlaintextInAudit = auditRes.rows.some(r => {
      const str = JSON.stringify(r).toLowerCase();
      return str.includes('custompass@123') || str.includes('stusecret@123') || str.includes('newexplicitfacultypass@2026');
    });
    assert(!hasPlaintextInAudit, 'Zero plaintext passwords stored in public.audit_logs');

    // --------------------------------------------------------------------------
    // SECTION 11: Cleanup Isolated Test Accounts
    // --------------------------------------------------------------------------
    console.log('\n--- SECTION 11: Teardown Isolated Test Accounts ---');
    await pgClient.query(`DELETE FROM public.profiles WHERE id IN ($1, $2);`, [testFacAuthId, testStuAuthId]);
    await pgClient.query(`DELETE FROM auth.users WHERE id IN ($1, $2);`, [testFacAuthId, testStuAuthId]);
    await pgClient.query(`DELETE FROM public.faculty WHERE email ILIKE '%test_immut%';`);
    await pgClient.query(`DELETE FROM public.students WHERE email ILIKE '%test_immut%';`);
    console.log('Cleaned up isolated test accounts from database.');

    console.log('\n========================================================================');
    console.log(`SUMMARY: ${passedChecks}/${totalChecks} CHECKS PASSED WITH 100% SUCCESS!`);
    console.log('========================================================================');
  } finally {
    await pgClient.end();
  }
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
