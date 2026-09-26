import {
  buildNotificationEmail,
  sendEmailViaResend,
  fetchNotificationsForDelivery,
  dispatchNotificationEmails,
  dispatchNotificationEmailsByReference,
  recordDelivery,
} from '../../api/email-service.js';
import pg from 'pg';

try {
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile();
  }
} catch {}

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, desc: string) {
  totalTests++;
  if (condition) {
    console.log(`✅ [PASS] ${desc}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${desc}`);
    throw new Error(`Assertion failed: ${desc}`);
  }
}

async function runProductionVerification() {
  console.log('================================================================================');
  console.log('  VCTM ERP — PRODUCTION NOTIFICATION & EMAIL FLOW VERIFICATION                 ');
  console.log('================================================================================\n');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set in environment.');
  }

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  const createdNotificationIds: string[] = [];

  try {
    // -------------------------------------------------------------------------
    // 0. FETCH REAL INSTITUTIONAL ACCOUNTS FOR TESTING
    // -------------------------------------------------------------------------
    console.log('▶ STEP 0: Fetch Real Institutional Accounts for Flow Verification');

    const facultyRes = await pool.query(`
      SELECT f.id, f.full_name, f.email, f.auth_user_id, f.department_id 
      FROM public.faculty f 
      WHERE f.email LIKE '%@vctm%' OR f.email LIKE '%@%'
      LIMIT 3;
    `);
    assert(facultyRes.rows.length >= 2, 'Found at least 2 real faculty accounts for isolation testing');
    const facultyA = facultyRes.rows[0];
    const facultyB = facultyRes.rows[1];
    console.log(`  Faculty A: ${facultyA.full_name} (${facultyA.email})`);
    console.log(`  Faculty B: ${facultyB.full_name} (${facultyB.email})`);

    const studentRes = await pool.query(`
      SELECT s.id, s.full_name, s.email, s.auth_user_id, s.roll_number, s.section_id 
      FROM public.students s 
      LIMIT 2;
    `);
    assert(studentRes.rows.length >= 1, 'Found at least 1 real student account');
    const studentA = studentRes.rows[0];
    console.log(`  Student A: ${studentA.full_name} (${studentA.roll_number})`);

    const hodRes = await pool.query(`
      SELECT f.id, f.full_name, f.email, f.auth_user_id 
      FROM public.departments d
      JOIN public.faculty f ON f.id = d.hod_faculty_id
      LIMIT 1;
    `);
    assert(hodRes.rows.length >= 1, 'Found HOD faculty account');
    const hodUser = hodRes.rows[0];
    console.log(`  HOD: ${hodUser.full_name} (${hodUser.email})`);

    // -------------------------------------------------------------------------
    // FLOW A: STUDENT ACTION → FACULTY / COORDINATOR
    // -------------------------------------------------------------------------
    console.log('\n▶ FLOW A: Student Action → Faculty / Coordinator (e.g. Leave Application)');

    // 1. Coordinator in-app notification row
    const coordNotifRes = await pool.query(`
      INSERT INTO public.notifications (
        recipient_user_id, recipient_faculty_id, recipient_role,
        type, title, message, reference_type, is_read, email_status
      ) VALUES (
        $1, $2, 'faculty',
        'LEAVE_APPLICATION_SUBMITTED', 'New Leave Application Submitted',
        'Student has applied for medical leave awaiting your endorsement.',
        'leave_application', false, 'pending'
      ) RETURNING id;
    `, [facultyA.auth_user_id || null, facultyA.id]);
    const coordNotifId = coordNotifRes.rows[0].id;
    createdNotificationIds.push(coordNotifId);

    // 2. Student confirmation in-app notification row
    const studConfirmRes = await pool.query(`
      INSERT INTO public.notifications (
        recipient_user_id, recipient_student_id, recipient_role,
        type, title, message, reference_type, is_read, email_status
      ) VALUES (
        $1, $2, 'student',
        'LEAVE_APPLICATION_SUBMITTED', 'Leave Application Submitted',
        'Your leave request has been submitted and forwarded to your Class Coordinator.',
        'leave_application', false, 'skipped'
      ) RETURNING id;
    `, [studentA.auth_user_id || null, studentA.id]);
    const studConfirmId = studConfirmRes.rows[0].id;
    createdNotificationIds.push(studConfirmId);

    // Evaluate email delivery eligibility
    const deliveryCandidatesFlowA = await fetchNotificationsForDelivery([coordNotifId, studConfirmId]);
    assert(deliveryCandidatesFlowA.length === 2, 'Both notifications retrieved for delivery evaluation');

    const coordDelivery = deliveryCandidatesFlowA.find(c => c.notification_id === coordNotifId);
    assert(coordDelivery.can_send === true, 'Coordinator notification is eligible for email delivery (can_send = true)');
    assert(coordDelivery.recipient_role !== 'student', 'Coordinator is resolved as staff/faculty');
    assert(coordDelivery.recipient_email === facultyA.email, `Coordinator email resolved correctly to ${facultyA.email}`);

    const studDelivery = deliveryCandidatesFlowA.find(c => c.notification_id === studConfirmId);
    assert(studDelivery.can_send === false, 'Student notification is strictly excluded from email delivery (can_send = false)');
    assert(studDelivery.skip_reason === 'STUDENT_EMAIL_OUT_OF_SCOPE', 'Student skip reason is STUDENT_EMAIL_OUT_OF_SCOPE');

    // -------------------------------------------------------------------------
    // FLOW B: FACULTY ACTION → STUDENT
    // -------------------------------------------------------------------------
    console.log('\n▶ FLOW B: Faculty Action → Student (e.g. Attendance Correction / Assignment)');

    const claimActionRes = await pool.query(`
      INSERT INTO public.notifications (
        recipient_user_id, recipient_student_id, recipient_role,
        type, title, message, reference_type, is_read, email_status
      ) VALUES (
        $1, $2, 'student',
        'ATTENDANCE_CLAIM', 'Attendance Correction Approved',
        'Your attendance claim for Physics Class has been approved by your teacher.',
        'attendance_claim', false, 'skipped'
      ) RETURNING id;
    `, [studentA.auth_user_id || null, studentA.id]);
    const claimNotifId = claimActionRes.rows[0].id;
    createdNotificationIds.push(claimNotifId);

    const deliveryCandidatesFlowB = await fetchNotificationsForDelivery([claimNotifId]);
    assert(deliveryCandidatesFlowB.length === 1, 'Student claim notification retrieved for delivery evaluation');
    assert(deliveryCandidatesFlowB[0].can_send === false, 'Student receives ZERO email on claim approval');
    assert(deliveryCandidatesFlowB[0].skip_reason === 'STUDENT_EMAIL_OUT_OF_SCOPE', 'Enforces STUDENT_EMAIL_OUT_OF_SCOPE');

    // Verify student can read and update their notification in-app
    const verifyStudRead = await pool.query(`
      UPDATE public.notifications 
      SET is_read = true, read_at = now() 
      WHERE id = $1 
      RETURNING is_read;
    `, [claimNotifId]);
    assert(verifyStudRead.rows[0].is_read === true, 'Student notification is_read updated successfully');

    // -------------------------------------------------------------------------
    // FLOW C: COORDINATOR ACTION → HOD & STUDENT
    // -------------------------------------------------------------------------
    console.log('\n▶ FLOW C: Coordinator Action → HOD & Student (e.g. Leave Forwarded)');

    // 1. HOD notification
    const hodNotifRes = await pool.query(`
      INSERT INTO public.notifications (
        recipient_user_id, recipient_faculty_id, recipient_role,
        type, title, message, reference_type, is_read, email_status
      ) VALUES (
        $1, $2, 'hod',
        'LEAVE_FORWARDED_HOD', 'Leave Application Endorsed by Coordinator',
        'A leave request has been reviewed and forwarded for your final sanction.',
        'leave_application', false, 'pending'
      ) RETURNING id;
    `, [hodUser.auth_user_id || null, hodUser.id]);
    const hodNotifId = hodNotifRes.rows[0].id;
    createdNotificationIds.push(hodNotifId);

    // 2. Student status update notification
    const studForwardedRes = await pool.query(`
      INSERT INTO public.notifications (
        recipient_user_id, recipient_student_id, recipient_role,
        type, title, message, reference_type, is_read, email_status
      ) VALUES (
        $1, $2, 'student',
        'LEAVE_FORWARDED_HOD', 'Leave Forwarded to HOD',
        'Your leave request has been endorsed by your Coordinator and forwarded to HOD.',
        'leave_application', false, 'skipped'
      ) RETURNING id;
    `, [studentA.auth_user_id || null, studentA.id]);
    const studForwardedId = studForwardedRes.rows[0].id;
    createdNotificationIds.push(studForwardedId);

    const deliveryCandidatesFlowC = await fetchNotificationsForDelivery([hodNotifId, studForwardedId]);
    const hodDelivery = deliveryCandidatesFlowC.find(c => c.notification_id === hodNotifId);
    assert(hodDelivery.can_send === true, 'HOD notification is eligible for email delivery');
    assert(hodDelivery.recipient_email === hodUser.email, `HOD email resolved correctly to ${hodUser.email}`);

    const studFwdDelivery = deliveryCandidatesFlowC.find(c => c.notification_id === studForwardedId);
    assert(studFwdDelivery.can_send === false, 'Student receives NO email on leave forwarding');

    // -------------------------------------------------------------------------
    // FLOW D: HOD ACTION → FACULTY
    // -------------------------------------------------------------------------
    console.log('\n▶ FLOW D: HOD Action → Faculty (e.g. Department Meeting Notice)');

    const deptNoticeNotif = await pool.query(`
      INSERT INTO public.notifications (
        recipient_user_id, recipient_faculty_id, recipient_role,
        type, title, message, reference_type, is_read, email_status
      ) VALUES (
        $1, $2, 'faculty',
        'NOTICE', 'Department Faculty Meeting Tomorrow at 10 AM',
        'Mandatory meeting to review mid-term examination preparation.',
        'notice', false, 'pending'
      ) RETURNING id;
    `, [facultyA.auth_user_id || null, facultyA.id]);
    const deptNoticeId = deptNoticeNotif.rows[0].id;
    createdNotificationIds.push(deptNoticeId);

    const deliveryCandidatesFlowD = await fetchNotificationsForDelivery([deptNoticeId]);
    assert(deliveryCandidatesFlowD[0].can_send === true, 'Faculty member is eligible for notice email');
    assert(deliveryCandidatesFlowD[0].recipient_email === facultyA.email, 'Faculty email resolved correctly');

    // -------------------------------------------------------------------------
    // FLOW E: SUPER ADMIN ACTION → COORDINATOR ASSIGNMENT
    // -------------------------------------------------------------------------
    console.log('\n▶ FLOW E: Super Admin Action → Coordinator Assignment / Removal');

    const adminActionNotif = await pool.query(`
      INSERT INTO public.notifications (
        recipient_user_id, recipient_faculty_id, recipient_role,
        type, title, message, reference_type, is_read, email_status
      ) VALUES (
        $1, $2, 'faculty',
        'ACCOUNT_UPDATE', 'Assigned as Class Coordinator',
        'You have been appointed Class Coordinator for Computer Science & Engineering 2nd Year, Section A.',
        'class_coordinator', false, 'pending'
      ) RETURNING id;
    `, [facultyB.auth_user_id || null, facultyB.id]);
    const adminActionId = adminActionNotif.rows[0].id;
    createdNotificationIds.push(adminActionId);

    const deliveryCandidatesFlowE = await fetchNotificationsForDelivery([adminActionId]);
    assert(deliveryCandidatesFlowE[0].can_send === true, 'Faculty B coordinator assignment notification eligible for email');
    assert(deliveryCandidatesFlowE[0].recipient_email === facultyB.email, `Faculty B email resolved correctly to ${facultyB.email}`);

    // -------------------------------------------------------------------------
    // FLOW F: RECIPIENT TARGETING & PRIVACY ISOLATION
    // -------------------------------------------------------------------------
    console.log('\n▶ FLOW F: Recipient Targeting & Privacy Isolation (Faculty A vs Faculty B)');

    // Simulated Frontend Realtime target matcher from AcademicContext.tsx
    function checkRealtimeTarget(
      notif: any,
      curUser: { id?: string; student_id?: string; faculty_id?: string; role?: string }
    ) {
      const curUserId = curUser.id;
      const curStudentId = curUser.student_id;
      const curFacultyId = curUser.faculty_id;
      const curRole = curUser.role;

      const targetStudId = notif.recipient_student_id;
      const targetUserId = notif.recipient_user_id;
      const targetFacId = notif.recipient_faculty_id;
      const hasSpecificTarget = Boolean(targetStudId || targetUserId || targetFacId);

      if (hasSpecificTarget) {
        return (
          Boolean(targetStudId && curStudentId && targetStudId === curStudentId) ||
          Boolean(targetUserId && curUserId && targetUserId === curUserId) ||
          Boolean(targetFacId && curFacultyId && targetFacId === curFacultyId)
        );
      } else if (notif.recipient_role) {
        return Boolean(curRole && notif.recipient_role.toUpperCase() === curRole.toUpperCase());
      } else {
        return true;
      }
    }

    const targetedForFacultyA = {
      id: 'notif-targeted-fac-a',
      recipient_faculty_id: facultyA.id,
      recipient_user_id: facultyA.auth_user_id,
      recipient_role: 'faculty',
      title: 'Targeted for Faculty A Only',
    };

    const userFacultyAContext = { id: facultyA.auth_user_id, faculty_id: facultyA.id, role: 'faculty' };
    const userFacultyBContext = { id: facultyB.auth_user_id, faculty_id: facultyB.id, role: 'faculty' };

    assert(
      checkRealtimeTarget(targetedForFacultyA, userFacultyAContext) === true,
      'Targeted notification correctly matches Faculty A'
    );
    assert(
      checkRealtimeTarget(targetedForFacultyA, userFacultyBContext) === false,
      'Targeted notification is STRICTLY REJECTED by Faculty B (No privacy leak)'
    );

    // Database query condition isolation:
    // Verify that querying with recipient_faculty_id for Faculty B does NOT return Faculty A's targeted row
    const facBQuery = await pool.query(`
      SELECT id FROM public.notifications 
      WHERE (recipient_faculty_id = $1)
        OR (recipient_role = 'faculty' AND recipient_faculty_id IS NULL AND recipient_student_id IS NULL AND recipient_user_id IS NULL)
    `, [facultyB.id]);
    const facBNotifIds = facBQuery.rows.map(r => r.id);
    assert(
      !facBNotifIds.includes(coordNotifId),
      'Faculty B query cannot fetch Faculty A targeted notification row'
    );

    // -------------------------------------------------------------------------
    // FLOW G: MULTIPLE RAPID EVENTS (BATCHING & DEDUPLICATION)
    // -------------------------------------------------------------------------
    console.log('\n▶ FLOW G: Multiple Rapid Events (Batching, Zero Loss, No Duplicates)');

    const rapidBatchIds: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const ins = await pool.query(`
        INSERT INTO public.notifications (
          recipient_user_id, recipient_faculty_id, recipient_role,
          type, title, message, reference_type, is_read, email_status
        ) VALUES (
          $1, $2, 'faculty',
          'GENERAL', 'Rapid Event ' || $3,
          'Testing rapid notification dispatch #' || $3,
          'rapid_test', false, 'pending'
        ) RETURNING id;
      `, [facultyA.auth_user_id || null, facultyA.id, i]);
      rapidBatchIds.push(ins.rows[0].id);
      createdNotificationIds.push(ins.rows[0].id);
    }

    assert(rapidBatchIds.length === 5, '5 rapid notification events inserted successfully');

    const batchCandidates = await fetchNotificationsForDelivery(rapidBatchIds);
    assert(batchCandidates.length === 5, 'All 5 rapid notifications retrieved without omission');
    const uniqueCandidateIds = new Set(batchCandidates.map(c => c.notification_id));
    assert(uniqueCandidateIds.size === 5, 'Zero duplicates in batch resolution');

    // -------------------------------------------------------------------------
    // FLOW H: RESEND EMAIL ATOMIC DELIVERY & AUDIT LOGGING
    // -------------------------------------------------------------------------
    console.log('\n▶ FLOW H: Email Dispatcher Execution & Audit Logging');

    // Test recordDelivery function
    await recordDelivery({
      notificationId: adminActionId,
      status: 'sent',
      resendEmailId: 'test_resend_msg_' + Date.now(),
      errorMessage: null,
      recipientEmail: facultyB.email,
      recipientName: facultyB.full_name,
      recipientRole: 'faculty',
    });

    const deliveryAuditRes = await pool.query(`
      SELECT status, recipient_email, recipient_role, resend_email_id 
      FROM public.notification_email_deliveries 
      WHERE notification_id = $1;
    `, [adminActionId]);

    assert(deliveryAuditRes.rows.length === 1, 'Delivery record logged in notification_email_deliveries table');
    assert(deliveryAuditRes.rows[0].status === 'sent', 'Delivery record status is sent');
    assert(deliveryAuditRes.rows[0].recipient_email === facultyB.email, 'Delivery record recipient_email matches');
    assert(deliveryAuditRes.rows[0].recipient_role === 'faculty', 'Delivery record recipient_role matches');

    // Verify email_status updated on notifications table
    const notifStatusRes = await pool.query(`
      SELECT email_status FROM public.notifications WHERE id = $1;
    `, [adminActionId]);
    assert(notifStatusRes.rows[0].email_status === 'sent', 'Notifications table email_status transitioned to sent');

  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP TEST RECORDS
    // -------------------------------------------------------------------------
    console.log('\n▶ CLEANUP: Purging Temporary Test Notification Records');
    if (createdNotificationIds.length > 0) {
      await pool.query(`
        DELETE FROM public.notifications WHERE id = ANY($1::uuid[]);
      `, [createdNotificationIds]);
      console.log(`  Purged ${createdNotificationIds.length} temporary test records.`);
    }
    await pool.end();
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n================================================================================');
  console.log(`  ALL ${totalTests} PRODUCTION FLOW TESTS PASSED! (${passedTests}/${totalTests})`);
  console.log('================================================================================\n');
}

runProductionVerification().catch(err => {
  console.error('Fatal production verification error:', err);
  process.exit(1);
});
