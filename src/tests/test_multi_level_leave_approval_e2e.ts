if (!process.env.DATABASE_URL && (process as any).loadEnvFile) {
  try { (process as any).loadEnvFile(); } catch {}
}
import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import { generateApprovedLeavePdf } from '../lib/utils/leavePdfGenerator';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL || '';

// Polyfill localStorage for Node environment if needed
if (typeof localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (global as any).localStorage = {
    getItem: (k: string) => store[k] || null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  };
}

async function runLeaveWorkflowE2ETests() {
  console.log('========================================================================');
  console.log('VCTM ERP: MULTI-LEVEL LEAVE APPROVAL WORKFLOW E2E VERIFICATION SUITE');
  console.log('========================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, desc: string, errorDetail?: any) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${desc}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${desc}`);
      if (errorDetail) {
        console.error('   Error detail:', errorDetail);
      }
    }
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const createdLeaveIds: string[] = [];

  // Helper to query notifications as a specific authenticated user (enforcing RLS perspective)
  async function getNotificationsAsUser(userId: string, applicationId: string) {
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [userId]);
    await client.query(`SELECT set_config('role', 'authenticated', false);`);
    const res = await client.query(`
      SELECT * FROM public.notifications 
      WHERE recipient_user_id = $1 AND reference_id = $2
      ORDER BY created_at DESC;
    `, [userId, applicationId]);
    return res.rows;
  }

  // Helper to query audit logs as an authorized user
  async function getAuditLogsAsUser(userId: string, applicationId: string) {
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [userId]);
    await client.query(`SELECT set_config('role', 'authenticated', false);`);
    const res = await client.query(`
      SELECT * FROM public.leave_approval_audit_logs 
      WHERE application_id = $1
      ORDER BY created_at ASC;
    `, [applicationId]);
    return res.rows;
  }

  try {
    // -------------------------------------------------------------
    // SUITE 1: Direct Database & Schema Verification
    // -------------------------------------------------------------
    console.log('\n--- SUITE 1: Database Tables, RLS, Indexes & Realtime ---');

    // 1.1 Check leave_applications table columns
    const appColsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'leave_applications'
      ORDER BY ordinal_position;
    `);
    assert(appColsRes.rows.length >= 18, `leave_applications table exists with ${appColsRes.rows.length} columns`);

    // 1.2 Check leave_approval_audit_logs table columns
    const auditColsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'leave_approval_audit_logs'
      ORDER BY ordinal_position;
    `);
    assert(auditColsRes.rows.length >= 9, `leave_approval_audit_logs table exists with ${auditColsRes.rows.length} columns`);

    // 1.3 Check RLS enabled on both tables
    const rlsRes = await client.query(`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public' AND tablename IN ('leave_applications', 'leave_approval_audit_logs')
      ORDER BY tablename;
    `);
    assert(
      rlsRes.rows.length === 2 && rlsRes.rows.every(r => r.rowsecurity === true),
      'Both leave_applications and leave_approval_audit_logs have Row Level Security (RLS) enabled'
    );

    // 1.4 Check publication includes leave_applications
    const pubRes = await client.query(`
      SELECT tablename 
      FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'leave_applications';
    `);
    assert(
      pubRes.rows.length === 1,
      'leave_applications table is registered in supabase_realtime publication'
    );

    // 1.5 Check Security Definer RPC Functions
    const procRes = await client.query(`
      SELECT proname, prosecdef 
      FROM pg_proc 
      WHERE proname IN (
        'submit_leave_application',
        'coordinator_review_leave',
        'hod_review_leave'
      )
      ORDER BY proname;
    `);
    assert(
      procRes.rows.length === 3 && procRes.rows.every(r => r.prosecdef === true),
      'All 3 Leave RPC functions exist and are marked SECURITY DEFINER'
    );

    // -------------------------------------------------------------
    // SUITE 2: Relational Routing Resolution
    // -------------------------------------------------------------
    console.log('\n--- SUITE 2: Relational Routing: Student -> Class Coordinator -> HOD ---');

    // Fetch real student (Himanshu) and relations
    const studentRes = await client.query(`
      SELECT s.id, s.full_name, s.roll_number, s.department_id, s.academic_year_id, s.section_id,
             COALESCE(p.id, s.auth_user_id) as auth_user_id,
             d.name as department_name, d.hod_faculty_id,
             sec.name as section_name, sec.class_coordinator_id,
             f_coord.full_name as coordinator_name,
             f_hod.full_name as hod_name,
             COALESCE(p_coord.id, f_coord.auth_user_id) as coordinator_user_id,
             COALESCE(p_hod.id, f_hod.auth_user_id) as hod_user_id
      FROM students s
      JOIN departments d ON s.department_id = d.id
      JOIN sections sec ON s.section_id = sec.id
      LEFT JOIN faculty f_coord ON sec.class_coordinator_id = f_coord.id
      LEFT JOIN profiles p_coord ON (p_coord.faculty_id = f_coord.id OR p_coord.id = f_coord.auth_user_id)
      LEFT JOIN faculty f_hod ON d.hod_faculty_id = f_hod.id
      LEFT JOIN profiles p_hod ON (p_hod.faculty_id = f_hod.id OR p_hod.id = f_hod.auth_user_id)
      LEFT JOIN profiles p ON (p.student_id = s.id OR p.id = s.auth_user_id)
      WHERE sec.class_coordinator_id IS NOT NULL AND d.hod_faculty_id IS NOT NULL
      LIMIT 1;
    `);

    assert(studentRes.rows.length > 0, 'Found real student linked to active section coordinator and department HOD');
    const testStudent = studentRes.rows[0];
    console.log(`   Student: ${testStudent.full_name} (${testStudent.roll_number})`);
    console.log(`   Section: ${testStudent.section_name}, Coordinator: ${testStudent.coordinator_name}`);

    // Fetch an unauthorized faculty member (not the coordinator of section A)
    const unauthorizedFacultyRes = await client.query(`
      SELECT f.id, f.full_name, COALESCE(p.id, f.auth_user_id) as auth_user_id
      FROM faculty f
      LEFT JOIN profiles p ON (p.faculty_id = f.id OR p.id = f.auth_user_id)
      WHERE ($1::uuid IS NULL OR f.id != $1) AND ($2::uuid IS NULL OR f.id != $2)
      LIMIT 1;
    `, [testStudent.class_coordinator_id, testStudent.hod_faculty_id]);
    assert(unauthorizedFacultyRes.rows.length > 0, 'Found separate faculty member for negative authorization tests');
    const unauthorizedFaculty = unauthorizedFacultyRes.rows[0];
    console.log(`   Unauthorized Faculty for Section A: ${unauthorizedFaculty.full_name}`);

    // Test service layer resolveStudentCoordinatorAndHOD
    const routingResolution = await supabaseService.resolveStudentCoordinatorAndHOD(testStudent.id);
    assert(
      routingResolution.coordinator !== null &&
      routingResolution.coordinator?.id === testStudent.class_coordinator_id &&
      routingResolution.hod !== null &&
      routingResolution.hod?.id === testStudent.hod_faculty_id,
      'resolveStudentCoordinatorAndHOD accurately resolves section coordinator and department HOD'
    );

    // -------------------------------------------------------------
    // SUITE 3: Case 1 - Student Leave Submission
    // -------------------------------------------------------------
    console.log('\n--- SUITE 3: Case 1 - Student Leave Submission Workflow ---');

    // Impersonate Student in PostgreSQL session
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [testStudent.auth_user_id]);
    await client.query(`SELECT set_config('role', 'authenticated', false);`);

    const submitRes = await client.query(`
      SELECT public.submit_leave_application(
        'MEDICAL',
        '2026-10-01'::date,
        '2026-10-03'::date,
        3,
        'Viral fever and doctor advised 3 days complete bed rest.',
        NULL,
        'medical_cert.pdf'
      ) as app_data;
    `);

    const primaryApp = submitRes.rows[0]?.app_data;
    assert(Boolean(primaryApp && primaryApp.id), 'submit_leave_application RPC executed successfully');
    const primaryAppId = primaryApp.id;
    createdLeaveIds.push(primaryAppId);

    assert(primaryApp.status === 'PENDING_COORDINATOR', 'Initial application status is PENDING_COORDINATOR');
    assert(primaryApp.coordinator_id === testStudent.class_coordinator_id, 'Application coordinator_id routes to designated section coordinator');
    assert(primaryApp.hod_id === testStudent.hod_faculty_id, 'Application hod_id routes to designated department HOD');
    assert(primaryApp.application_number.startsWith('LV-2026-'), `Application number formatted officially: ${primaryApp.application_number}`);
    assert(primaryApp.verification_code.startsWith('VCTM-LV-2026-'), `Verification code generated: ${primaryApp.verification_code}`);

    // Audit log verification from student's perspective
    const auditLogs1 = await getAuditLogsAsUser(testStudent.auth_user_id, primaryAppId);
    assert(auditLogs1.length === 1 && auditLogs1[0].action === 'SUBMITTED', 'Audit log records SUBMITTED event with timestamp');

    // In-App Notification check: Coordinator notified from coordinator's perspective
    const coordNotifs = await getNotificationsAsUser(testStudent.coordinator_user_id, primaryAppId);
    assert(coordNotifs.length >= 1 && coordNotifs[0].type === 'LEAVE_APPLICATION_SUBMITTED', 'Class Coordinator received LEAVE_APPLICATION_SUBMITTED in-app notification');

    // In-App Notification check: HOD received NO notifications at this initial submission stage
    const hodPrematureNotifs = await getNotificationsAsUser(testStudent.hod_user_id, primaryAppId);
    assert(hodPrematureNotifs.length === 0, 'HOD received ZERO notifications on initial submission (strictly routed to Coordinator)');

    // -------------------------------------------------------------
    // SUITE 4: Case 2 - Coordinator Rejection Workflow
    // -------------------------------------------------------------
    console.log('\n--- SUITE 4: Case 2 - Coordinator Rejection & Immediate Termination ---');

    // Student submits a 2nd application to test coordinator rejection
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [testStudent.auth_user_id]);
    await client.query(`SELECT set_config('role', 'authenticated', false);`);

    const submitRejectRes = await client.query(`
      SELECT public.submit_leave_application(
        'DUTY',
        '2026-10-10'::date,
        '2026-10-11'::date,
        2,
        'Attending state level tech festival.',
        NULL,
        NULL
      ) as app_data;
    `);
    const rejectAppId = submitRejectRes.rows[0]?.app_data.id;
    createdLeaveIds.push(rejectAppId);

    // Coordinator reviews and REJECTS with reason
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [testStudent.coordinator_user_id]);
    await client.query(`SELECT set_config('role', 'authenticated', false);`);

    const coordRejectRes = await client.query(`
      SELECT public.coordinator_review_leave(
        $1::uuid,
        'REJECT',
        'Official invitation and event duty clearance form missing.'
      ) as app_data;
    `, [rejectAppId]);

    const rejectedApp = coordRejectRes.rows[0]?.app_data;
    assert(rejectedApp.status === 'REJECTED_BY_COORDINATOR', 'Status successfully changed to REJECTED_BY_COORDINATOR');
    assert(rejectedApp.rejected_by === testStudent.class_coordinator_id, 'rejected_by matches Coordinator faculty ID');
    assert(rejectedApp.rejection_reason === 'Official invitation and event duty clearance form missing.', 'rejection_reason accurately recorded');
    assert(rejectedApp.rejected_at !== null, 'rejected_at timestamp populated');

    // Verify HOD was NOT notified of rejected application
    const hodRejectCheck = await getNotificationsAsUser(testStudent.hod_user_id, rejectAppId);
    assert(hodRejectCheck.length === 0, 'HOD received NO notifications when Coordinator rejected application');

    // Verify Student received REJECT notification
    const studentRejectNotifs = await getNotificationsAsUser(testStudent.auth_user_id, rejectAppId);
    assert(
      studentRejectNotifs.length >= 1 && studentRejectNotifs[0].type === 'LEAVE_REJECTED',
      'Student received LEAVE_REJECTED notification containing coordinator remarks'
    );

    // Audit log check
    const rejectAuditRes = await getAuditLogsAsUser(testStudent.auth_user_id, rejectAppId);
    assert(
      rejectAuditRes.some(l => l.action === 'COORDINATOR_REJECTED'),
      'Audit log recorded action COORDINATOR_REJECTED with reason'
    );

    // -------------------------------------------------------------
    // SUITE 5: Case 3 - Coordinator Approval & Multi-Level Escalation to HOD
    // -------------------------------------------------------------
    console.log('\n--- SUITE 5: Case 3 - Coordinator Approval & Forwarding to HOD ---');

    // Coordinator approves primary application
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [testStudent.coordinator_user_id]);
    await client.query(`SELECT set_config('role', 'authenticated', false);`);

    const coordApproveRes = await client.query(`
      SELECT public.coordinator_review_leave(
        $1::uuid,
        'APPROVE',
        'Doctor prescription and medical fitness slip verified. Recommended.'
      ) as app_data;
    `, [primaryAppId]);

    const forwardedApp = coordApproveRes.rows[0]?.app_data;
    assert(forwardedApp.status === 'PENDING_HOD', 'Status is now PENDING_HOD (NOT directly APPROVED!)');
    assert(forwardedApp.coordinator_approved_by === testStudent.class_coordinator_id, 'coordinator_approved_by matches Coordinator faculty ID');
    assert(forwardedApp.coordinator_approved_at !== null, 'coordinator_approved_at timestamp is set');
    assert(forwardedApp.coordinator_remarks === 'Doctor prescription and medical fitness slip verified. Recommended.', 'coordinator_remarks preserved');

    // In-App Notification check: HOD receives LEAVE_FORWARDED_HOD
    const hodForwardedNotifs = await getNotificationsAsUser(testStudent.hod_user_id, primaryAppId);
    assert(
      hodForwardedNotifs.length >= 1 && hodForwardedNotifs[0].type === 'LEAVE_FORWARDED_HOD',
      'HOD received LEAVE_FORWARDED_HOD notification upon Coordinator approval'
    );

    // Student receives LEAVE_FORWARDED_HOD update notification
    const studentForwardedNotifs = await getNotificationsAsUser(testStudent.auth_user_id, primaryAppId);
    assert(
      studentForwardedNotifs.some(n => n.type === 'LEAVE_FORWARDED_HOD'),
      'Student received LEAVE_FORWARDED_HOD notification informing them leave was forwarded to HOD'
    );

    // -------------------------------------------------------------
    // SUITE 6: Case 4 - HOD Rejection Workflow
    // -------------------------------------------------------------
    console.log('\n--- SUITE 6: Case 4 - HOD Rejection Workflow ---');

    // Student submits a 3rd application to test HOD rejection
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [testStudent.auth_user_id]);
    await client.query(`SELECT set_config('role', 'authenticated', false);`);

    const submitApp3Res = await client.query(`
      SELECT public.submit_leave_application(
        'CASUAL',
        '2026-10-15'::date,
        '2026-10-25'::date,
        11,
        'Family vacation trip.',
        NULL,
        NULL
      ) as app_data;
    `);
    const hodRejectAppId = submitApp3Res.rows[0]?.app_data.id;
    createdLeaveIds.push(hodRejectAppId);

    // Coordinator approves 3rd application
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [testStudent.coordinator_user_id]);
    await client.query(`SELECT set_config('role', 'authenticated', false);`);

    await client.query(`
      SELECT public.coordinator_review_leave(
        $1::uuid,
        'APPROVE',
        'Forwarded to HOD for special leave quota review.'
      );
    `, [hodRejectAppId]);

    // HOD reviews and REJECTS
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [testStudent.hod_user_id]);
    await client.query(`SELECT set_config('role', 'authenticated', false);`);

    const hodRejectRes = await client.query(`
      SELECT public.hod_review_leave(
        $1::uuid,
        'REJECT',
        'Leave period coincides with Mid-Term assessments. Casual leave exceeding 3 days denied.'
      ) as app_data;
    `, [hodRejectAppId]);

    const hodRejectedApp = hodRejectRes.rows[0]?.app_data;
    assert(hodRejectedApp.status === 'REJECTED_BY_HOD', 'Status successfully changed to REJECTED_BY_HOD');
    assert(hodRejectedApp.rejected_by === testStudent.hod_faculty_id, 'rejected_by matches HOD faculty ID');
    assert(hodRejectedApp.rejection_reason.includes('Mid-Term assessments'), 'HOD rejection reason recorded properly');
    assert(hodRejectedApp.coordinator_approved_by === testStudent.class_coordinator_id, 'Prior Coordinator approval history remains intact');

    // Verify Student received REJECT notification
    const studentHodRejectNotifs = await getNotificationsAsUser(testStudent.auth_user_id, hodRejectAppId);
    assert(
      studentHodRejectNotifs.length >= 1 && studentHodRejectNotifs[0].type === 'LEAVE_REJECTED',
      'Student received LEAVE_REJECTED notification from HOD'
    );

    // -------------------------------------------------------------
    // SUITE 7: Case 5 - HOD Final Approval & Full Two-Tier Ledger
    // -------------------------------------------------------------
    console.log('\n--- SUITE 7: Case 5 - HOD Final Approval & Full Two-Tier Ledger ---');

    // HOD approves primary application
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [testStudent.hod_user_id]);
    await client.query(`SELECT set_config('role', 'authenticated', false);`);

    const hodApproveRes = await client.query(`
      SELECT public.hod_review_leave(
        $1::uuid,
        'APPROVE',
        'Medical grounds substantiated. Sanctioned subject to lab backlog clearance.'
      ) as app_data;
    `, [primaryAppId]);

    const approvedApp = hodApproveRes.rows[0]?.app_data;
    assert(approvedApp.status === 'APPROVED', 'Application status reached final APPROVED state');
    assert(approvedApp.hod_approved_by === testStudent.hod_faculty_id, 'hod_approved_by matches HOD faculty ID');
    assert(approvedApp.hod_approved_at !== null, 'hod_approved_at timestamp set');
    assert(approvedApp.coordinator_approved_by === testStudent.class_coordinator_id, 'coordinator_approved_by preserved intact in final record');
    assert(approvedApp.coordinator_approved_at !== null, 'coordinator_approved_at timestamp preserved intact');

    // In-App Notification check: Student receives LEAVE_APPROVED
    const studentApprovedNotifs = await getNotificationsAsUser(testStudent.auth_user_id, primaryAppId);
    assert(
      studentApprovedNotifs.some(n => n.type === 'LEAVE_APPROVED'),
      'Student received LEAVE_APPROVED official notification'
    );

    // Audit trail sequence check
    const fullAuditTrail = await getAuditLogsAsUser(testStudent.auth_user_id, primaryAppId);
    assert(fullAuditTrail.length === 3, `Full audit trail has 3 sequential entries (found ${fullAuditTrail.length})`);
    assert(
      fullAuditTrail[0]?.action === 'SUBMITTED' &&
      fullAuditTrail[1]?.action === 'COORDINATOR_APPROVED' &&
      fullAuditTrail[2]?.action === 'HOD_APPROVED',
      'Audit log actions follow exact sequence: SUBMITTED -> COORDINATOR_APPROVED -> HOD_APPROVED'
    );

    // -------------------------------------------------------------
    // SUITE 8: Security, Role Verification & Anti-Tampering Matrix
    // -------------------------------------------------------------
    console.log('\n--- SUITE 8: Anti-Tampering & Security Matrix ---');

    // 8.1 Unauthorized faculty (from another section) attempting to review Coordinator stage
    // Create a 4th application for security tests
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [testStudent.auth_user_id]);
    await client.query(`SELECT set_config('role', 'authenticated', false);`);

    const submitSecApp = await client.query(`
      SELECT public.submit_leave_application(
        'CASUAL',
        '2026-11-01'::date,
        '2026-11-02'::date,
        2,
        'Security test leave application.',
        NULL,
        NULL
      ) as app_data;
    `);
    const secAppId = submitSecApp.rows[0]?.app_data.id;
    createdLeaveIds.push(secAppId);

    // Attempt review with unauthorized faculty
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [unauthorizedFaculty.auth_user_id]);
    await client.query(`SELECT set_config('role', 'authenticated', false);`);

    let unauthCoordBlocked = false;
    try {
      await client.query(`
        SELECT public.coordinator_review_leave(
          $1::uuid,
          'APPROVE',
          'Unauthorized attempt'
        );
      `, [secAppId]);
    } catch (err: any) {
      unauthCoordBlocked = err.message.includes('Unauthorized') || err.message.includes('not designated');
    }
    assert(unauthCoordBlocked, 'Unauthorized faculty (not Section Coordinator) CANNOT review or approve Section A leave (RPC blocked)');

    // 8.2 Premature HOD approval on a fresh application (skipping Coordinator)
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [testStudent.hod_user_id]);
    await client.query(`SELECT set_config('role', 'authenticated', false);`);

    let prematureHodBlocked = false;
    try {
      await client.query(`
        SELECT public.hod_review_leave(
          $1::uuid,
          'APPROVE',
          'Premature HOD approval attempt'
        );
      `, [secAppId]);
    } catch (err: any) {
      prematureHodBlocked = err.message.includes('must be approved by the Class Coordinator first') || err.message.includes('PENDING_HOD');
    }
    assert(prematureHodBlocked, 'HOD CANNOT approve application while still PENDING_COORDINATOR (hierarchical enforcement intact)');

    // 8.3 Coordinator attempting review on already APPROVED application
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [testStudent.coordinator_user_id]);
    await client.query(`SELECT set_config('role', 'authenticated', false);`);

    let redundantCoordBlocked = false;
    try {
      await client.query(`
        SELECT public.coordinator_review_leave(
          $1::uuid,
          'APPROVE',
          'Redundant review attempt'
        );
      `, [primaryAppId]);
    } catch (err: any) {
      redundantCoordBlocked = err.message.includes('not in PENDING_COORDINATOR state');
    }
    assert(redundantCoordBlocked, 'Coordinator CANNOT review application after it has progressed past PENDING_COORDINATOR');

    // 8.4 Coordinator / HOD rejection without reason
    let missingReasonBlocked = false;
    try {
      await client.query(`
        SELECT public.coordinator_review_leave(
          $1::uuid,
          'REJECT',
          ' '
        );
      `, [secAppId]);
    } catch (err: any) {
      missingReasonBlocked = err.message.includes('rejection reason is required');
    }
    assert(missingReasonBlocked, 'Rejection WITHOUT reason is strictly blocked by stored procedure');

    // 8.5 Direct client UPDATE tampering attempt by Student
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [testStudent.auth_user_id]);
    await client.query(`SELECT set_config('role', 'authenticated', false);`);

    // Student tries direct SQL update to set status = 'APPROVED'
    const directTamperRes = await client.query(`
      UPDATE public.leave_applications
      SET status = 'APPROVED'
      WHERE id = $1;
    `, [secAppId]);

    // Re-query status
    const untamperedCheck = (await client.query(`
      SELECT status FROM public.leave_applications WHERE id = $1;
    `, [secAppId])).rows[0];
    assert(
      untamperedCheck.status === 'PENDING_COORDINATOR' && directTamperRes.rowCount === 0,
      'Direct client UPDATE tampering on leave_applications is completely blocked by RLS policy'
    );

    // -------------------------------------------------------------
    // SUITE 9: Case 6 - Official Approved Leave PDF Certificate Generation
    // -------------------------------------------------------------
    console.log('\n--- SUITE 9: Case 6 - Official Approved Leave PDF Certificate Generation ---');

    // Query full approved leave application record with joins
    await client.query(`SELECT set_config('role', 'postgres', false);`);
    const fullApprovedAppRow = (await client.query(`
      SELECT la.*,
             s.full_name as student_name, s.roll_number,
             d.name as department_name,
             ay.name as year_name,
             sec.name as section_name,
             f_coord.full_name as coordinator_name, f_coord.designation as coordinator_designation,
             f_hod.full_name as hod_name, f_hod.designation as hod_designation
      FROM public.leave_applications la
      JOIN public.students s ON s.id = la.student_id
      JOIN public.departments d ON d.id = la.department_id
      JOIN public.academic_years ay ON ay.id = la.academic_year_id
      JOIN public.sections sec ON sec.id = la.section_id
      LEFT JOIN public.faculty f_coord ON f_coord.id = la.coordinator_approved_by
      LEFT JOIN public.faculty f_hod ON f_hod.id = la.hod_approved_by
      WHERE la.id = $1;
    `, [primaryAppId])).rows[0];

    assert(fullApprovedAppRow.status === 'APPROVED', 'Application verified as APPROVED in database');

    try {
      const doc = await generateApprovedLeavePdf({
        application: fullApprovedAppRow,
        studentName: fullApprovedAppRow.student_name,
        rollNumber: fullApprovedAppRow.roll_number,
        departmentName: fullApprovedAppRow.department_name,
        yearName: fullApprovedAppRow.year_name,
        sectionName: fullApprovedAppRow.section_name,
        coordinatorName: fullApprovedAppRow.coordinator_name,
        coordinatorDesignation: fullApprovedAppRow.coordinator_designation,
        hodName: fullApprovedAppRow.hod_name,
        hodDesignation: fullApprovedAppRow.hod_designation
      });

      const pdfArrayBuffer = doc.output('arraybuffer');
      assert(
        pdfArrayBuffer.byteLength > 2000,
        `generateApprovedLeavePdf generated valid, non-empty PDF document (${pdfArrayBuffer.byteLength} bytes)`
      );
    } catch (err: any) {
      assert(false, `generateApprovedLeavePdf threw unexpected error: ${err.message}`, err);
    }

  } catch (err: any) {
    console.error('Fatal error during E2E test execution:', err);
    assert(false, `Unexpected error: ${err.message}`, err);
  } finally {
    // -------------------------------------------------------------
    // TEARDOWN: Clean up test applications & notifications
    // -------------------------------------------------------------
    console.log('\n--- CLEANUP & TEARDOWN ---');
    if (createdLeaveIds.length > 0) {
      console.log(`Cleaning up ${createdLeaveIds.length} test leave applications...`);
      await client.query(`SELECT set_config('role', 'postgres', false);`);

      await client.query(`
        DELETE FROM notifications 
        WHERE reference_id = ANY($1::uuid[]);
      `, [createdLeaveIds]);

      await client.query(`
        DELETE FROM leave_approval_audit_logs 
        WHERE application_id = ANY($1::uuid[]);
      `, [createdLeaveIds]);

      await client.query(`
        DELETE FROM leave_applications 
        WHERE id = ANY($1::uuid[]);
      `, [createdLeaveIds]);
      console.log('✅ Test data successfully purged from database.');
    }

    await client.end();
  }

  console.log('\n========================================================================');
  console.log(`FINAL RESULTS: ${passedTests} / ${totalTests} TESTS PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('========================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runLeaveWorkflowE2ETests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
