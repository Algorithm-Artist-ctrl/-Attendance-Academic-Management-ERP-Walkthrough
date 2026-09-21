if (!process.env.DATABASE_URL && (process as any).loadEnvFile) {
  try { (process as any).loadEnvFile(); } catch {}
}
import http from "http";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import handleAdminAuth from "../../api/admin-auth";

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const connectionString = process.env.DATABASE_URL || '';

function createFreshClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Timeout helper: wraps any promise with a hard timeout to prevent indefinite hanging
async function withTimeout<T>(promise: Promise<T>, ms = 15000, desc = "Operation"): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`TEST TIMEOUT: ${desc} exceeded ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

type TestStatus = 'PASS' | 'FAIL' | 'SKIPPED' | 'TIMEOUT';

interface TestRecord {
  name: string;
  status: TestStatus;
  detail?: string;
}

const testResults: TestRecord[] = [];

function recordResult(status: TestStatus, name: string, detail?: string) {
  testResults.push({ name, status, detail });
  const prefix = `[${status}]`;
  if (status === 'PASS') {
    console.log(`${prefix} ${name}${detail ? ` (${detail})` : ''}`);
  } else if (status === 'SKIPPED') {
    console.log(`${prefix} ${name} — ${detail || 'Skipped'}`);
  } else {
    console.error(`${prefix} ${name}${detail ? `: ${detail}` : ''}`);
  }
}

function assert(condition: boolean, msg: string, failureDetail?: string) {
  if (condition) {
    recordResult('PASS', msg);
  } else {
    recordResult('FAIL', msg, failureDetail);
  }
}

async function run() {
  console.log("========================================================================");
  console.log("TEST: SUPER ADMIN REAL ACCOUNT CREDENTIAL MANAGEMENT (SUPABASE AUTH)");
  console.log("========================================================================\n");

  let exitCode = 1;
  let server: http.Server | null = null;
  let studentAuthId: string | undefined;
  let studentId: string | undefined;
  let facultyAuthId: string | undefined;
  let facultyId: string | undefined;

  // Cleanup helper for guaranteed teardown
  async function performCleanup() {
    try {
      const pgClient = new pg.Client({
        connectionString,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000,
      });
      await pgClient.connect();
      if (studentAuthId) {
        await pgClient.query('DELETE FROM public.audit_logs WHERE actor_id = $1 OR entity_id = $1', [studentAuthId]);
        await pgClient.query('DELETE FROM public.students WHERE auth_user_id = $1', [studentAuthId]);
        await pgClient.query('DELETE FROM public.profiles WHERE id = $1', [studentAuthId]);
        await pgClient.query('DELETE FROM auth.identities WHERE user_id = $1', [studentAuthId]);
        await pgClient.query('DELETE FROM auth.users WHERE id = $1', [studentAuthId]);
      }
      if (facultyAuthId) {
        await pgClient.query('DELETE FROM public.audit_logs WHERE actor_id = $1 OR entity_id = $1', [facultyAuthId]);
        await pgClient.query('DELETE FROM public.faculty WHERE auth_user_id = $1', [facultyAuthId]);
        await pgClient.query('DELETE FROM public.profiles WHERE id = $1', [facultyAuthId]);
        await pgClient.query('DELETE FROM auth.identities WHERE user_id = $1', [facultyAuthId]);
        await pgClient.query('DELETE FROM auth.users WHERE id = $1', [facultyAuthId]);
      }
      await pgClient.query("DELETE FROM public.students WHERE roll_number = 'TESTMGMTSTU01'");
      await pgClient.query("DELETE FROM public.faculty WHERE employee_code = 'TESTMGMTFAC01'");
      await pgClient.end();
    } catch (cleanErr) {
      console.warn("Teardown notice:", cleanErr);
    }
  }

  // Global safety timeout: automatically abort and clean up if suite exceeds 60s
  const GLOBAL_TIMEOUT_MS = 60_000;
  const globalTimer = setTimeout(async () => {
    console.error(`\n❌ [TIMEOUT] Global test suite exceeded maximum duration of ${GLOBAL_TIMEOUT_MS / 1000}s!`);
    if (server) {
      try {
        server.closeAllConnections?.();
        server.close();
      } catch {}
    }
    await performCleanup();
    process.exit(1);
  }, GLOBAL_TIMEOUT_MS);
  globalTimer.unref();

  // Start local HTTP server for /api/auth endpoints
  server = http.createServer((req, res) => {
    handleAdminAuth(req, res);
  });

  const PORT = 4589;
  await new Promise<void>((resolve) => server!.listen(PORT, resolve));
  const baseUrl = `http://127.0.0.1:${PORT}`;

  try {
    // 1. Authenticate as Super Admin (Tarun Kushwah)
    console.log("--- 1. Authenticating Super Admin ---");
    const adminClient = createFreshClient();
    const { data: adminProf } = await adminClient
      .from("profiles")
      .select("email")
      .eq("role", "super_admin")
      .limit(1)
      .maybeSingle();
    const adminEmail = adminProf?.email || "tarunkushwah798@gmail.com";
    const { data: adminAuth, error: adminAuthErr } = await adminClient.auth.signInWithPassword({
      email: adminEmail,
      password: "VctmAdmin@2026",
    });

    assert(!adminAuthErr && !!adminAuth.session, `Super Admin authenticated successfully (${adminAuth.user?.email})`);
    const adminToken = adminAuth.session?.access_token || "";

    // 2. Security Check: Unauthorized & Non-Admin API Rejection
    console.log("\n--- 2. Testing API Security & Role Restrictions ---");
    
    // 2A. Request without token
    const noTokenRes = await fetch(`${baseUrl}/api/auth/update-credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_user_id: "00000000-0000-0000-0000-000000000000",
        password: "password123",
      }),
    });
    assert(noTokenRes.status === 401, "API rejects unauthenticated request without token (401)");

    // 2B. Request with invalid token
    const invalidTokenRes = await fetch(`${baseUrl}/api/auth/update-credentials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer invalid.jwt.token",
      },
      body: JSON.stringify({
        target_user_id: "00000000-0000-0000-0000-000000000000",
        password: "password123",
      }),
    });
    assert(invalidTokenRes.status === 401, "API rejects invalid JWT token (401)");

    // 3. Provision Dedicated Test Student for Real Credential Testing
    console.log("\n--- 3. Testing Student Credential Management Workflow ---");
    const { data: secRow } = await withTimeout(adminClient.from("sections").select("id").limit(1).single(), 10000, "Fetch Section");
    const testSecId = secRow?.id;
    const { data: deptRow } = await withTimeout(adminClient.from("departments").select("id").limit(1).single(), 10000, "Fetch Department");
    const testDeptId = deptRow?.id;

    const { data: provStuRes, error: provStuErr } = await withTimeout(
      adminClient.rpc("provision_student_account", {
        p_roll_number: "TESTMGMTSTU01",
        p_full_name: "Test Admin Mgmt Student",
        p_section_id: testSecId,
        p_admission_type: "Regular",
        p_email: "test_admin_mgmt_stu@student.vctm.in",
        p_password: "student123",
        p_actor_name: "Super Admin",
      }),
      10000,
      "Provision student"
    );

    if (provStuErr || !provStuRes?.student_id) {
      throw new Error(`Failed to provision test student: ${provStuErr?.message || "No student returned"}`);
    }

    studentId = provStuRes.student_id;
    const origStudentEmail = "test_admin_mgmt_stu@student.vctm.in";
    studentAuthId = provStuRes.auth_user_id || provStuRes.student_id;

    // Generate unique run-specific temporary email guaranteed to be unused
    const runTimestamp = Date.now();
    const runRandom = Math.random().toString(36).substring(2, 7);
    let tempStudentEmail = `temp.testmgmtstu01_${runTimestamp}_${runRandom}@student.vctm.in`;

    // Pre-flight check: ensure tempStudentEmail does not collide
    const { data: existingStu } = await adminClient.from("students").select("id").eq("email", tempStudentEmail).maybeSingle();
    if (existingStu) {
      tempStudentEmail = `temp.testmgmtstu01_${Date.now()}_${Math.random().toString(36).substring(2, 7)}@student.vctm.in`;
    }

    // 2C. Non-Admin (Student) token RBAC test:
    const studentInitClient = createFreshClient();
    const { data: stuAuthData, error: stuAuthErr } = await withTimeout(
      studentInitClient.auth.signInWithPassword({
        email: origStudentEmail,
        password: "student123",
      }),
      10000,
      "Student Initial Signin"
    );

    if (stuAuthData?.session?.access_token) {
      const studentToken = stuAuthData.session.access_token;
      const stuForbiddenRes = await withTimeout(
        fetch(`${baseUrl}/api/auth/update-credentials`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${studentToken}`,
          },
          body: JSON.stringify({
            target_user_id: studentAuthId,
            password: "HackedPass123!",
          }),
        }),
        10000,
        "Student Forbidden API Test"
      );
      assert(stuForbiddenRes.status === 403, "API strictly rejects non-admin student caller with 403 Forbidden", `Status was ${stuForbiddenRes.status}`);
    } else {
      assert(false, "API strictly rejects non-admin student caller with 403 Forbidden", stuAuthErr?.message || "Student initial login failed");
    }

    // 3A. Super Admin sets custom password via API
    const customPass = "StudentCustom@2026!";
    console.log(`Setting custom student password via API: ${customPass}...`);
    const apiUpdatePassRes = await withTimeout(
      fetch(`${baseUrl}/api/auth/update-credentials`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          target_user_id: studentAuthId,
          password: customPass,
          is_default_password: false,
        }),
      }),
      15000,
      "Update custom student password"
    );

    const passJson = await apiUpdatePassRes.json();
    assert(apiUpdatePassRes.status === 200 && passJson.success, "API update-credentials set custom password successfully", passJson.error || `Status: ${apiUpdatePassRes.status}`);

    // Verify student can log in immediately with custom password
    const studentClient1 = createFreshClient();
    const { data: studentLogin1, error: studentLogin1Err } = await withTimeout(
      studentClient1.auth.signInWithPassword({
        email: origStudentEmail,
        password: customPass,
      }),
      10000,
      "Student login with custom password"
    );
    assert(!studentLogin1Err && !!studentLogin1?.session, "Student logs in immediately with custom password", studentLogin1Err?.message);

    // 3B. Super Admin resets to institution default password ("student123")
    console.log("Resetting student password to default (student123)...");
    const apiUpdateDefPassRes = await withTimeout(
      fetch(`${baseUrl}/api/auth/update-credentials`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          target_user_id: studentAuthId,
          password: "student123",
          is_default_password: true,
        }),
      }),
      15000,
      "Reset default student password"
    );
    const defPassJson = await apiUpdateDefPassRes.json();
    assert(apiUpdateDefPassRes.status === 200 && defPassJson.success, "API update-credentials set default password successfully", defPassJson.error || `Status: ${apiUpdateDefPassRes.status}`);

    // Verify student can log in immediately with default password
    const studentClient2 = createFreshClient();
    const { data: studentLogin2, error: studentLogin2Err } = await withTimeout(
      studentClient2.auth.signInWithPassword({
        email: origStudentEmail,
        password: "student123",
      }),
      10000,
      "Student login with default password"
    );
    assert(!studentLogin2Err && !!studentLogin2?.session, "Student logs in immediately with default password (student123)", studentLogin2Err?.message);

    // 3C. Super Admin updates Student Login Email
    console.log(`Updating student login email to: ${tempStudentEmail}...`);
    let stuEmailUpdated = false;
    let stuEmailErr: string | undefined;
    try {
      const apiUpdateEmailRes = await withTimeout(
        fetch(`${baseUrl}/api/auth/update-credentials`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            target_user_id: studentAuthId,
            email: tempStudentEmail,
          }),
        }),
        15000,
        "Update student login email"
      );
      const emailJson = await apiUpdateEmailRes.json();
      if (apiUpdateEmailRes.status === 200 && emailJson.success) {
        stuEmailUpdated = true;
        recordResult("PASS", "API update-credentials updated student email successfully");
      } else {
        stuEmailErr = emailJson.error || `Status: ${apiUpdateEmailRes.status}`;
        recordResult("FAIL", "API update-credentials updated student email successfully", stuEmailErr);
      }
    } catch (err: any) {
      stuEmailErr = err?.message || String(err);
      if (stuEmailErr?.includes("TEST TIMEOUT")) {
        recordResult("TIMEOUT", "API update-credentials updated student email successfully", stuEmailErr);
      } else {
        recordResult("FAIL", "API update-credentials updated student email successfully", stuEmailErr);
      }
    }

    // Dependent Test: Verify student can log in immediately with new email
    if (!stuEmailUpdated) {
      recordResult("SKIPPED", "Student logs in immediately with updated email", "Skipped because email update failed");
    } else {
      const studentClient3 = createFreshClient();
      const { data: studentLogin3, error: studentLogin3Err } = await withTimeout(
        studentClient3.auth.signInWithPassword({
          email: tempStudentEmail,
          password: "student123",
        }),
        10000,
        "Student login with updated email"
      );
      assert(!studentLogin3Err && !!studentLogin3?.session, "Student logs in immediately with updated email", studentLogin3Err?.message);
    }

    // Dependent Test: Verify student records and relational integrity
    if (!stuEmailUpdated) {
      recordResult("SKIPPED", "Student table email synchronized", "Skipped because email update failed");
      recordResult("SKIPPED", "Student section_id foreign key preserved", "Skipped because email update failed");
    } else {
      const { data: verifiedStudent } = await withTimeout(
        adminClient
          .from("students")
          .select("id, auth_user_id, roll_number, email, section_id")
          .eq("id", studentId)
          .single(),
        10000,
        "Fetch verified student"
      );

      const isEmailSynced = verifiedStudent?.email === tempStudentEmail;
      const isAuthUserMatched = verifiedStudent?.auth_user_id === studentAuthId;

      assert(
        Boolean(isEmailSynced && isAuthUserMatched),
        "Student table email synchronized",
        `Expected email: ${tempStudentEmail}, Actual: ${verifiedStudent?.email}, Auth UUID match: ${isAuthUserMatched}`
      );

      assert(
        verifiedStudent?.section_id === testSecId,
        "Student section_id foreign key preserved",
        `Expected section_id: ${testSecId}, Actual: ${verifiedStudent?.section_id}`
      );
    }

    // 3D. Restore Student Original Email
    console.log(`Restoring student original email (${origStudentEmail})...`);
    try {
      const restoreStuEmailRes = await withTimeout(
        fetch(`${baseUrl}/api/auth/update-credentials`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            target_user_id: studentAuthId,
            email: origStudentEmail,
          }),
        }),
        15000,
        "Restore student email"
      );
      const restoreStuJson = await restoreStuEmailRes.json();
      assert(restoreStuEmailRes.status === 200 && restoreStuJson.success, "Student original email restored", restoreStuJson.error || `Status: ${restoreStuEmailRes.status}`);
    } catch (err: any) {
      assert(false, "Student original email restored", err?.message);
    }

    // 4. Provision Dedicated Test Faculty for Real Credential Testing
    console.log("\n--- 4. Testing Faculty Credential Management Workflow ---");
    const { data: provFacRes, error: provFacErr } = await withTimeout(
      adminClient.rpc("provision_faculty_account", {
        p_employee_code: "TESTMGMTFAC01",
        p_full_name: "Test Admin Mgmt Faculty",
        p_email: "test_admin_mgmt_fac@faculty.vctm.in",
        p_department_id: testDeptId,
        p_designation: "Assistant Professor",
        p_faculty_code: "TMF",
        p_password: "faculty@123",
        p_actor_name: "Super Admin",
      }),
      10000,
      "Provision faculty"
    );

    if (provFacErr || !provFacRes?.faculty_id) {
      throw new Error(`Failed to provision test faculty: ${provFacErr?.message || "No faculty returned"}`);
    }

    facultyId = provFacRes.faculty_id;
    const origFacultyEmail = "test_admin_mgmt_fac@faculty.vctm.in";
    facultyAuthId = provFacRes.auth_user_id || provFacRes.faculty_id;
    let tempFacultyEmail = `temp.testmgmtfac01_${runTimestamp}_${runRandom}@faculty.vctm.in`;

    // Pre-flight check: ensure tempFacultyEmail does not collide
    const { data: existingFac } = await adminClient.from("faculty").select("id").eq("email", tempFacultyEmail).maybeSingle();
    if (existingFac) {
      tempFacultyEmail = `temp.testmgmtfac01_${Date.now()}_${Math.random().toString(36).substring(2, 7)}@faculty.vctm.in`;
    }

    // 4A. Super Admin sets custom faculty password
    const customFacPass = "FacultyCustom@2026!";
    console.log(`Setting custom password for faculty: ${customFacPass}...`);
    const apiFacPassRes = await withTimeout(
      fetch(`${baseUrl}/api/auth/update-credentials`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          target_user_id: facultyAuthId,
          password: customFacPass,
          is_default_password: false,
        }),
      }),
      15000,
      "Update custom faculty password"
    );
    const facPassJson = await apiFacPassRes.json();
    assert(apiFacPassRes.status === 200 && facPassJson.success, "API update-credentials set custom faculty password successfully", facPassJson.error || `Status: ${apiFacPassRes.status}`);

    // Verify faculty login with custom password
    const facultyClient1 = createFreshClient();
    const { data: facLogin1, error: facLogin1Err } = await withTimeout(
      facultyClient1.auth.signInWithPassword({
        email: origFacultyEmail,
        password: customFacPass,
      }),
      10000,
      "Faculty login with custom password"
    );
    assert(!facLogin1Err && !!facLogin1?.session, "Faculty logs in immediately with custom password", facLogin1Err?.message);

    // 4B. Super Admin resets faculty default password ("faculty@123")
    console.log("Resetting faculty password to default (faculty@123)...");
    const apiFacDefPassRes = await withTimeout(
      fetch(`${baseUrl}/api/auth/update-credentials`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          target_user_id: facultyAuthId,
          password: "faculty@123",
          is_default_password: true,
        }),
      }),
      15000,
      "Reset default faculty password"
    );
    const facDefJson = await apiFacDefPassRes.json();
    assert(apiFacDefPassRes.status === 200 && facDefJson.success, "API update-credentials set default faculty password successfully", facDefJson.error || `Status: ${apiFacDefPassRes.status}`);

    // Verify faculty login with default password
    const facultyClient2 = createFreshClient();
    const { data: facLogin2, error: facLogin2Err } = await withTimeout(
      facultyClient2.auth.signInWithPassword({
        email: origFacultyEmail,
        password: "faculty@123",
      }),
      10000,
      "Faculty login with default password"
    );
    assert(!facLogin2Err && !!facLogin2?.session, "Faculty logs in immediately with default password (faculty@123)", facLogin2Err?.message);

    // 4C. Super Admin updates Faculty Email
    console.log(`Updating faculty email to: ${tempFacultyEmail}...`);
    let facEmailUpdated = false;
    let facEmailErr: string | undefined;
    try {
      const apiFacEmailRes = await withTimeout(
        fetch(`${baseUrl}/api/auth/update-credentials`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            target_user_id: facultyAuthId,
            email: tempFacultyEmail,
          }),
        }),
        15000,
        "Update faculty email"
      );
      const facEmailJson = await apiFacEmailRes.json();
      if (apiFacEmailRes.status === 200 && facEmailJson.success) {
        facEmailUpdated = true;
        recordResult("PASS", "API update-credentials updated faculty email successfully");
      } else {
        facEmailErr = facEmailJson.error || `Status: ${apiFacEmailRes.status}`;
        recordResult("FAIL", "API update-credentials updated faculty email successfully", facEmailErr);
      }
    } catch (err: any) {
      facEmailErr = err?.message || String(err);
      if (facEmailErr?.includes("TEST TIMEOUT")) {
        recordResult("TIMEOUT", "API update-credentials updated faculty email successfully", facEmailErr);
      } else {
        recordResult("FAIL", "API update-credentials updated faculty email successfully", facEmailErr);
      }
    }

    // Dependent Test: Verify faculty login with new email
    if (!facEmailUpdated) {
      recordResult("SKIPPED", "Faculty logs in immediately with updated email", "Skipped because email update failed");
    } else {
      const facultyClient3 = createFreshClient();
      const { data: facLogin3, error: facLogin3Err } = await withTimeout(
        facultyClient3.auth.signInWithPassword({
          email: tempFacultyEmail,
          password: "faculty@123",
        }),
        10000,
        "Faculty login with updated email"
      );
      assert(!facLogin3Err && !!facLogin3?.session, "Faculty logs in immediately with updated email", facLogin3Err?.message);
    }

    // Dependent Test: Verify faculty department relation and table sync
    if (!facEmailUpdated) {
      recordResult("SKIPPED", "Faculty table email synchronized", "Skipped because email update failed");
      recordResult("SKIPPED", "Faculty department_id preserved", "Skipped because email update failed");
    } else {
      const { data: verifiedFaculty } = await withTimeout(
        adminClient
          .from("faculty")
          .select("id, auth_user_id, employee_code, email, department_id")
          .eq("id", facultyId)
          .single(),
        10000,
        "Fetch verified faculty"
      );

      const isFacEmailSynced = verifiedFaculty?.email === tempFacultyEmail;
      const isFacAuthIdMatched = verifiedFaculty?.auth_user_id === facultyAuthId;

      assert(
        Boolean(isFacEmailSynced && isFacAuthIdMatched),
        "Faculty table email synchronized",
        `Expected email: ${tempFacultyEmail}, Actual: ${verifiedFaculty?.email}, Auth UUID match: ${isFacAuthIdMatched}`
      );

      assert(
        verifiedFaculty?.department_id === testDeptId,
        "Faculty department_id preserved",
        `Expected dept: ${testDeptId}, Actual: ${verifiedFaculty?.department_id}`
      );
    }

    // 4D. Restore Faculty Original Email
    console.log(`Restoring faculty original email (${origFacultyEmail})...`);
    try {
      const restoreFacEmailRes = await withTimeout(
        fetch(`${baseUrl}/api/auth/update-credentials`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            target_user_id: facultyAuthId,
            email: origFacultyEmail,
          }),
        }),
        15000,
        "Restore faculty email"
      );
      const restoreFacJson = await restoreFacEmailRes.json();
      assert(restoreFacEmailRes.status === 200 && restoreFacJson.success, "Faculty original email restored", restoreFacJson.error || `Status: ${restoreFacEmailRes.status}`);
    } catch (err: any) {
      assert(false, "Faculty original email restored", err?.message);
    }

    // 5. Email Conflict / Uniqueness Verification
    console.log("\n--- 5. Testing Email Uniqueness Enforcement ---");
    const duplicateRes = await withTimeout(
      fetch(`${baseUrl}/api/auth/update-credentials`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          target_user_id: studentAuthId,
          email: adminEmail, // Existing Super Admin email
        }),
      }),
      15000,
      "Duplicate email rejection check"
    );
    const dupJson = await duplicateRes.json();
    const isDupRejected = duplicateRes.status === 500 && (
      dupJson.error?.includes("already registered") ||
      dupJson.error?.includes("already in use")
    );
    assert(isDupRejected, "Duplicate email attempt is strictly rejected", `Status: ${duplicateRes.status}, Error: ${dupJson.error}`);

    // 6. Audit Logging Verification
    console.log("\n--- 6. Verifying Audit Log Entries & Zero Plaintext Password Storage ---");
    const { data: recentAuditLogs } = await withTimeout(
      adminClient
        .from("audit_logs")
        .select("*")
        .in("action", ["EMAIL_CHANGED", "PASSWORD_CHANGED", "DEFAULT_PASSWORD_SET"])
        .order("created_at", { ascending: false })
        .limit(10),
      10000,
      "Fetch audit logs"
    );

    assert(
      Array.isArray(recentAuditLogs) && recentAuditLogs.length >= 3,
      `Audit logs recorded: found ${recentAuditLogs?.length} credential change events`,
      `Found ${recentAuditLogs?.length || 0} events`
    );

    // Verify that NO plaintext passwords exist anywhere in audit log entries
    const anyPlaintextPasswordFound = recentAuditLogs?.some(log => {
      const logStr = JSON.stringify(log).toLowerCase();
      return (
        logStr.includes("studentcustom@2026!") ||
        logStr.includes("facultycustom@2026!") ||
        logStr.includes("student123") ||
        logStr.includes("faculty@123")
      );
    });

    assert(!anyPlaintextPasswordFound, "Strict Security Rule verified: ZERO plaintext passwords found in audit logs", "Plaintext password found in audit log!");

    // Compute Summary
    const passedCount = testResults.filter(t => t.status === "PASS").length;
    const failedCount = testResults.filter(t => t.status === "FAIL").length;
    const skippedCount = testResults.filter(t => t.status === "SKIPPED").length;
    const timeoutCount = testResults.filter(t => t.status === "TIMEOUT").length;
    const totalCount = testResults.length;

    console.log(`\n========================================================================`);
    console.log(`TEST SUMMARY:`);
    console.log(`Total Tests: ${totalCount}`);
    console.log(`Passed:      ${passedCount}`);
    console.log(`Failed:      ${failedCount}`);
    console.log(`Skipped:     ${skippedCount}`);
    console.log(`Timeouts:    ${timeoutCount}`);
    console.log(`========================================================================`);

    if (failedCount === 0 && timeoutCount === 0 && passedCount > 0) {
      console.log("🎉 ALL SUPER ADMIN CREDENTIAL MANAGEMENT TESTS PASSED!");
      exitCode = 0;
    } else {
      console.error(`❌ Test suite finished with ${failedCount} failure(s) and ${timeoutCount} timeout(s).`);
      exitCode = 1;
    }
  } catch (err: any) {
    console.error("\nTest execution encountered an error:", err?.message || err);
    exitCode = 1;
  } finally {
    clearTimeout(globalTimer);
    try {
      await performCleanup();
    } catch (e) {
      console.warn("Cleanup warning:", e);
    }
    if (server) {
      try {
        server.closeAllConnections?.();
        server.close();
      } catch {}
    }
    process.exit(exitCode);
  }
}

run();
