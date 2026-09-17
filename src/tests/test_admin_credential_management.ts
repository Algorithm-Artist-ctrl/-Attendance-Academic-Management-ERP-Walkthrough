import http from "http";
import { createClient } from "@supabase/supabase-js";
import handleAdminAuth from "../../api/admin-auth";

const supabaseUrl = "https://obssoojzryqiudllnlkh.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ic3Nvb2p6cnlxaXVkbGxubGtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MDU0NzUsImV4cCI6MjEwMjk4MTQ3NX0.eFCU024aroXFpTqnOaVUOpOUpONBwm3KDDdLfzlZ5co";

function createFreshClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function run() {
  console.log("========================================================================");
  console.log("TEST: SUPER ADMIN REAL ACCOUNT CREDENTIAL MANAGEMENT (SUPABASE AUTH)");
  console.log("========================================================================\n");

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

  // Start local HTTP server for /api/auth endpoints
  const server = http.createServer((req, res) => {
    handleAdminAuth(req, res);
  });

  const PORT = 4589;
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  const baseUrl = `http://127.0.0.1:${PORT}`;

  try {
    // 1. Authenticate as Super Admin (Tarun Kushwah)
    console.log("--- 1. Authenticating Super Admin ---");
    const adminClient = createFreshClient();
    const { data: adminAuth, error: adminAuthErr } = await adminClient.auth.signInWithPassword({
      email: "admin@vctm.in",
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

    // 3. Locate Candidate Student for Real Credential Testing
    console.log("\n--- 3. Testing Student Credential Management Workflow ---");
    const { data: studentList } = await adminClient
      .from("students")
      .select("id, auth_user_id, roll_number, full_name, email, section_id, academic_year_id")
      .eq("active", true)
      .limit(5);

    assert(Array.isArray(studentList) && studentList.length > 0, "Found active student candidate list");
    const testStudent = studentList![0];
    console.log(`Selected Student: ${testStudent.full_name} (${testStudent.roll_number}) - ${testStudent.email}`);
    const origStudentEmail = testStudent.email;
    const studentAuthId = testStudent.auth_user_id || testStudent.id;
    const tempStudentEmail = `temp.${testStudent.roll_number.toLowerCase().replace(/[^a-z0-9]/g, "")}@student.vctm.in`;

    // 2C. Non-Admin (Student) token RBAC test:
    // Log in as student and verify they CANNOT invoke /api/auth/update-credentials
    const studentInitClient = createFreshClient();
    const { data: stuAuthData } = await studentInitClient.auth.signInWithPassword({
      email: origStudentEmail,
      password: "student123",
    });

    if (stuAuthData?.session?.access_token) {
      const studentToken = stuAuthData.session.access_token;
      const stuForbiddenRes = await fetch(`${baseUrl}/api/auth/update-credentials`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({
          target_user_id: studentAuthId,
          password: "HackedPass123!",
        }),
      });
      assert(stuForbiddenRes.status === 403, "API strictly rejects non-admin student caller with 403 Forbidden");
    }

    // 3A. Super Admin sets custom password via API
    const customPass = "StudentCustom@2026!";
    console.log(`Setting custom student password via API: ${customPass}...`);
    const apiUpdatePassRes = await fetch(`${baseUrl}/api/auth/update-credentials`, {
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
    });

    const passJson = await apiUpdatePassRes.json();
    assert(apiUpdatePassRes.status === 200 && passJson.success, "API update-credentials set custom password successfully");

    // Verify student can log in immediately with custom password
    const studentClient1 = createFreshClient();
    const { data: studentLogin1, error: studentLogin1Err } = await studentClient1.auth.signInWithPassword({
      email: origStudentEmail,
      password: customPass,
    });
    assert(!studentLogin1Err && !!studentLogin1.session, "Student logs in immediately with custom password");

    // 3B. Super Admin resets to institution default password ("student123")
    console.log("Resetting student password to default (student123)...");
    const apiUpdateDefPassRes = await fetch(`${baseUrl}/api/auth/update-credentials`, {
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
    });
    const defPassJson = await apiUpdateDefPassRes.json();
    assert(apiUpdateDefPassRes.status === 200 && defPassJson.success, "API update-credentials set default password successfully");

    // Verify student can log in immediately with default password
    const studentClient2 = createFreshClient();
    const { data: studentLogin2, error: studentLogin2Err } = await studentClient2.auth.signInWithPassword({
      email: origStudentEmail,
      password: "student123",
    });
    assert(!studentLogin2Err && !!studentLogin2.session, "Student logs in immediately with default password (student123)");

    // 3C. Super Admin updates Student Login Email
    console.log(`Updating student login email to: ${tempStudentEmail}...`);
    const apiUpdateEmailRes = await fetch(`${baseUrl}/api/auth/update-credentials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        target_user_id: studentAuthId,
        email: tempStudentEmail,
      }),
    });
    const emailJson = await apiUpdateEmailRes.json();
    assert(apiUpdateEmailRes.status === 200 && emailJson.success, "API update-credentials updated student email successfully");

    // Verify student can log in immediately with new email
    const studentClient3 = createFreshClient();
    const { data: studentLogin3, error: studentLogin3Err } = await studentClient3.auth.signInWithPassword({
      email: tempStudentEmail,
      password: "student123",
    });
    assert(!studentLogin3Err && !!studentLogin3.session, "Student logs in immediately with updated email");

    // Verify student records and relational integrity
    const { data: verifiedStudent } = await adminClient
      .from("students")
      .select("id, roll_number, email, section_id, academic_year_id")
      .eq("id", testStudent.id)
      .single();

    assert(verifiedStudent?.email === tempStudentEmail, "Student table email synchronized");
    assert(verifiedStudent?.section_id === testStudent.section_id, "Student section_id foreign key preserved");
    assert(verifiedStudent?.academic_year_id === testStudent.academic_year_id, "Student academic_year_id foreign key preserved");

    // 3D. Restore Student Original Email
    console.log(`Restoring student original email (${origStudentEmail})...`);
    const restoreStuEmailRes = await fetch(`${baseUrl}/api/auth/update-credentials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        target_user_id: studentAuthId,
        email: origStudentEmail,
      }),
    });
    assert(restoreStuEmailRes.status === 200, "Student original email restored");

    // 4. Testing Faculty Credential Management Workflow
    console.log("\n--- 4. Testing Faculty Credential Management Workflow ---");
    const { data: facultyList } = await adminClient
      .from("faculty")
      .select("id, auth_user_id, employee_code, full_name, email, department_id")
      .eq("active", true)
      .limit(5);

    assert(Array.isArray(facultyList) && facultyList.length > 0, "Found active faculty candidate list");
    const testFaculty = facultyList![0];
    console.log(`Selected Faculty: ${testFaculty.full_name} (${testFaculty.employee_code}) - ${testFaculty.email}`);
    const origFacultyEmail = testFaculty.email;
    const facultyAuthId = testFaculty.auth_user_id || testFaculty.id;
    const tempFacultyEmail = `temp.${testFaculty.employee_code.toLowerCase().replace(/[^a-z0-9]/g, "")}@vctm.in`;

    // 4A. Super Admin sets custom faculty password
    const customFacPass = "FacultyCustom@2026!";
    console.log(`Setting custom password for faculty: ${customFacPass}...`);
    const apiFacPassRes = await fetch(`${baseUrl}/api/auth/update-credentials`, {
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
    });
    const facPassJson = await apiFacPassRes.json();
    assert(apiFacPassRes.status === 200 && facPassJson.success, "API update-credentials set custom faculty password successfully");

    // Verify faculty login with custom password
    const facultyClient1 = createFreshClient();
    const { data: facLogin1, error: facLogin1Err } = await facultyClient1.auth.signInWithPassword({
      email: origFacultyEmail,
      password: customFacPass,
    });
    assert(!facLogin1Err && !!facLogin1.session, "Faculty logs in immediately with custom password");

    // 4B. Super Admin resets faculty default password ("faculty@123")
    console.log("Resetting faculty password to default (faculty@123)...");
    const apiFacDefPassRes = await fetch(`${baseUrl}/api/auth/update-credentials`, {
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
    });
    const facDefJson = await apiFacDefPassRes.json();
    assert(apiFacDefPassRes.status === 200 && facDefJson.success, "API update-credentials set default faculty password successfully");

    // Verify faculty login with default password
    const facultyClient2 = createFreshClient();
    const { data: facLogin2, error: facLogin2Err } = await facultyClient2.auth.signInWithPassword({
      email: origFacultyEmail,
      password: "faculty@123",
    });
    assert(!facLogin2Err && !!facLogin2.session, "Faculty logs in immediately with default password (faculty@123)");

    // 4C. Super Admin updates Faculty Email
    console.log(`Updating faculty email to: ${tempFacultyEmail}...`);
    const apiFacEmailRes = await fetch(`${baseUrl}/api/auth/update-credentials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        target_user_id: facultyAuthId,
        email: tempFacultyEmail,
      }),
    });
    const facEmailJson = await apiFacEmailRes.json();
    assert(apiFacEmailRes.status === 200 && facEmailJson.success, "API update-credentials updated faculty email successfully");

    // Verify faculty login with new email
    const facultyClient3 = createFreshClient();
    const { data: facLogin3, error: facLogin3Err } = await facultyClient3.auth.signInWithPassword({
      email: tempFacultyEmail,
      password: "faculty@123",
    });
    assert(!facLogin3Err && !!facLogin3.session, "Faculty logs in immediately with updated email");

    // Verify faculty department relation
    const { data: verifiedFaculty } = await adminClient
      .from("faculty")
      .select("id, employee_code, email, department_id")
      .eq("id", testFaculty.id)
      .single();

    assert(verifiedFaculty?.email === tempFacultyEmail, "Faculty table email synchronized");
    assert(verifiedFaculty?.department_id === testFaculty.department_id, "Faculty department_id preserved");

    // 4D. Restore Faculty Original Email
    console.log(`Restoring faculty original email (${origFacultyEmail})...`);
    const restoreFacEmailRes = await fetch(`${baseUrl}/api/auth/update-credentials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        target_user_id: facultyAuthId,
        email: origFacultyEmail,
      }),
    });
    assert(restoreFacEmailRes.status === 200, "Faculty original email restored");

    // 5. Email Conflict / Uniqueness Verification
    console.log("\n--- 5. Testing Email Uniqueness Enforcement ---");
    const duplicateRes = await fetch(`${baseUrl}/api/auth/update-credentials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        target_user_id: studentAuthId,
        email: "admin@vctm.in", // Existing admin email
      }),
    });
    const dupJson = await duplicateRes.json();
    assert(duplicateRes.status === 500 && dupJson.error?.includes("already registered"), "Duplicate email attempt is strictly rejected");

    // 6. Audit Logging Verification
    console.log("\n--- 6. Verifying Audit Log Entries & Zero Plaintext Password Storage ---");
    const { data: recentAuditLogs } = await adminClient
      .from("audit_logs")
      .select("*")
      .in("action", ["EMAIL_CHANGED", "PASSWORD_CHANGED", "DEFAULT_PASSWORD_SET"])
      .order("created_at", { ascending: false })
      .limit(10);

    assert(Array.isArray(recentAuditLogs) && recentAuditLogs.length >= 3, `Audit logs recorded: found ${recentAuditLogs?.length} credential change events`);

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

    assert(!anyPlaintextPasswordFound, "Strict Security Rule verified: ZERO plaintext passwords found in audit logs");

    console.log(`\n========================================================================`);
    console.log(`TEST SUMMARY: ${passed} / ${total} tests passed.`);
    console.log(`========================================================================`);

    if (passed === total) {
      console.log("🎉 ALL SUPER ADMIN CREDENTIAL MANAGEMENT TESTS PASSED!");
      process.exitCode = 0;
    } else {
      console.error(`❌ ${total - passed} test(s) failed!`);
      process.exitCode = 1;
    }
  } catch (err: any) {
    console.error("Test execution encountered an error:", err?.message || err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

run();
