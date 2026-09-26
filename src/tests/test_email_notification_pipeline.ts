import fs from 'fs';
import pg from 'pg';
import { fetchNotificationsForDelivery, recordDelivery, buildNotificationEmail } from '../../api/email-service.js';

let cs = process.env.DATABASE_URL || '';
if (!cs && fs.existsSync('.env')) {
  for (const line of fs.readFileSync('.env', 'utf-8').split('\n')) {
    if (line.startsWith('DATABASE_URL=')) cs = line.split('DATABASE_URL=')[1].trim().replace(/['"]/g, '');
  }
}

async function runPipelineTests() {
  console.log('====================================================');
  console.log('   VCTM ERP EMAIL NOTIFICATION PIPELINE E2E TEST   ');
  console.log('====================================================');

  const client = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
  await client.connect();

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`, detail || '');
      process.exitCode = 1;
    }
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Verify Database Schema (Migration 053 Columns & Tables)
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: Database Schema Verification ---');
    const cols = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'notifications' AND column_name IN ('email_status', 'email_sent_at', 'email_recipient', 'email_error');"
    );
    assert(cols.rows.length === 4, 'public.notifications has all 4 email delivery columns');

    const tbl = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_name = 'notification_email_deliveries' AND table_schema = 'public';"
    );
    assert(tbl.rows.length > 0, 'public.notification_email_deliveries table exists');

    const rpc = await client.query(
      "SELECT proname FROM pg_proc WHERE proname = 'get_notifications_for_email_delivery';"
    );
    assert(rpc.rows.length > 0, 'RPC get_notifications_for_email_delivery exists');

    // -------------------------------------------------------------
    // Test 2: Students STRICTLY EXCLUDED
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Student Notification Exclusion ---');
    // Find or create a student notification
    const studentNotifRes = await client.query(
      "SELECT id FROM public.notifications WHERE recipient_role = 'student' OR recipient_student_id IS NOT NULL LIMIT 1;"
    );

    let studentNotifId = studentNotifRes.rows[0]?.id;
    if (!studentNotifId) {
      const ins = await client.query(
        "INSERT INTO public.notifications (recipient_role, type, title, message) VALUES ('student', 'NOTICE', 'Test Student', 'Test') RETURNING id;"
      );
      studentNotifId = ins.rows[0].id;
    }

    const studentResolution = await fetchNotificationsForDelivery([studentNotifId]);
    assert(studentResolution.length > 0, 'Student notification resolved by preflight');
    const stRow = studentResolution[0];
    assert(stRow.can_send === false, 'Student notification can_send is strictly false');
    assert(stRow.skip_reason === 'STUDENT_EMAIL_OUT_OF_SCOPE', 'Student notification skip_reason is STUDENT_EMAIL_OUT_OF_SCOPE');
    assert(!stRow.recipient_email, 'Student notification recipient_email is null/empty');

    // -------------------------------------------------------------
    // Test 3: Exact Recipient Resolution for Faculty
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Exact Recipient Resolution for Faculty Members ---');
    
    // Test 3A: Dr. Abhishek Garg
    const abhishek = await client.query(
      "SELECT id, email, auth_user_id FROM public.faculty WHERE email = 'abhishek.cse@vctm.in' LIMIT 1;"
    );
    assert(abhishek.rows.length > 0, 'Faculty Dr. Abhishek Garg found in database');
    const abhishekId = abhishek.rows[0].id;
    const abhishekAuthUid = abhishek.rows[0].auth_user_id;

    // Create a temporary test notification for Dr. Abhishek Garg
    const abhishekNotif = await client.query(
      `INSERT INTO public.notifications (recipient_user_id, recipient_faculty_id, recipient_role, type, title, message)
       VALUES ($1, $2, 'faculty', 'NOTICE', 'Faculty Meeting Notice', 'Urgent department briefing at 3 PM.')
       RETURNING id;`,
      [abhishekAuthUid, abhishekId]
    );
    const abhishekNotifId = abhishekNotif.rows[0].id;

    const resAbhishek = await fetchNotificationsForDelivery([abhishekNotifId]);
    assert(resAbhishek.length > 0, 'Abhishek notification resolved');
    assert(resAbhishek[0].recipient_email === 'abhishek.cse@vctm.in', `Abhishek resolved exact email: ${resAbhishek[0].recipient_email}`);
    assert(resAbhishek[0].recipient_name.includes('Abhishek'), `Abhishek resolved exact name: ${resAbhishek[0].recipient_name}`);
    assert(resAbhishek[0].can_send === true, 'Abhishek notification can_send is true');

    // Test 3B: Dr. Naseem Ahamad Khan
    const naseem = await client.query(
      "SELECT id, email, auth_user_id FROM public.faculty WHERE email = 'naseem.math@vctm.in' LIMIT 1;"
    );
    if (naseem.rows.length > 0) {
      const naseemNotif = await client.query(
        `INSERT INTO public.notifications (recipient_user_id, recipient_faculty_id, recipient_role, type, title, message)
         VALUES ($1, $2, 'faculty', 'NOTICE', 'Math Syllabus Review', 'Please review the updated syllabus.')
         RETURNING id;`,
        [naseem.rows[0].auth_user_id, naseem.rows[0].id]
      );
      const resNaseem = await fetchNotificationsForDelivery([naseemNotif.rows[0].id]);
      assert(resNaseem[0].recipient_email === 'naseem.math@vctm.in', `Naseem resolved exact email: ${resNaseem[0].recipient_email}`);
      assert(resNaseem[0].can_send === true, 'Naseem notification can_send is true');
      // Clean up
      await client.query("DELETE FROM public.notifications WHERE id = $1", [naseemNotif.rows[0].id]);
    }

    // Test 3C: Mr. Imran Raza Khan
    const imran = await client.query(
      "SELECT id, email, auth_user_id FROM public.faculty WHERE email = 'wrongadvisor2006@gmail.com' LIMIT 1;"
    );
    if (imran.rows.length > 0) {
      const imranNotif = await client.query(
        `INSERT INTO public.notifications (recipient_user_id, recipient_faculty_id, recipient_role, type, title, message)
         VALUES ($1, $2, 'faculty', 'NOTICE', 'Discrete Structure Class', 'Class scheduled for Monday.')
         RETURNING id;`,
        [imran.rows[0].auth_user_id, imran.rows[0].id]
      );
      const resImran = await fetchNotificationsForDelivery([imranNotif.rows[0].id]);
      assert(resImran[0].recipient_email === 'wrongadvisor2006@gmail.com', `Imran resolved exact email: ${resImran[0].recipient_email}`);
      assert(resImran[0].can_send === true, 'Imran notification can_send is true');
      // Clean up
      await client.query("DELETE FROM public.notifications WHERE id = $1", [imranNotif.rows[0].id]);
    }

    // -------------------------------------------------------------
    // Test 4: Exact Recipient Resolution for HOD
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Exact Recipient Resolution for HOD ---');
    const hod = await client.query(
      "SELECT id, email, full_name FROM public.profiles WHERE role = 'hod' LIMIT 1;"
    );
    assert(hod.rows.length > 0, 'HOD profile found in database');
    const hodUserId = hod.rows[0].id;
    const hodExpectedEmail = hod.rows[0].email;

    const hodNotif = await client.query(
      `INSERT INTO public.notifications (recipient_user_id, recipient_role, type, title, message)
       VALUES ($1, 'hod', 'LEAVE_APPLICATION_SUBMITTED', 'Faculty Leave Application', 'Mr. Jitendra applied for 2 days leave.')
       RETURNING id;`,
      [hodUserId]
    );
    const resHod = await fetchNotificationsForDelivery([hodNotif.rows[0].id]);
    assert(resHod.length > 0, 'HOD notification resolved');
    assert(resHod[0].recipient_email === hodExpectedEmail, `HOD resolved exact email: ${resHod[0].recipient_email}`);
    assert(resHod[0].recipient_role === 'hod', `HOD resolved exact role: ${resHod[0].recipient_role}`);
    assert(resHod[0].can_send === true, 'HOD notification can_send is true');

    // -------------------------------------------------------------
    // Test 5: Exact Recipient Resolution for Super Admin
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Exact Recipient Resolution for Super Admin ---');
    const admin = await client.query(
      "SELECT id, email, full_name FROM public.profiles WHERE role = 'super_admin' LIMIT 1;"
    );
    assert(admin.rows.length > 0, 'Super Admin profile found in database');
    const adminUserId = admin.rows[0].id;
    const adminExpectedEmail = admin.rows[0].email;

    const adminNotif = await client.query(
      `INSERT INTO public.notifications (recipient_user_id, recipient_role, type, title, message)
       VALUES ($1, 'super_admin', 'NOTICE', 'Campus Security Alert', 'Scheduled database maintenance completed.')
       RETURNING id;`,
      [adminUserId]
    );
    const resAdmin = await fetchNotificationsForDelivery([adminNotif.rows[0].id]);
    assert(resAdmin.length > 0, 'Admin notification resolved');
    assert(resAdmin[0].recipient_email === adminExpectedEmail, `Super Admin resolved exact email: ${resAdmin[0].recipient_email}`);
    assert(resAdmin[0].recipient_role === 'super_admin', `Super Admin resolved exact role: ${resAdmin[0].recipient_role}`);
    assert(resAdmin[0].can_send === true, 'Super Admin notification can_send is true');

    // -------------------------------------------------------------
    // Test 6: Idempotency & Delivery Audit Recording
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Idempotency & Delivery Audit Verification ---');
    await recordDelivery({
      notificationId: abhishekNotifId,
      status: 'sent',
      resendEmailId: 're_mock_abc_123',
      recipientEmail: 'abhishek.cse@vctm.in',
      recipientName: 'Dr. Abhishek Garg',
      recipientRole: 'faculty',
    });

    const notifAfterSent = await client.query(
      "SELECT email_status, email_recipient, email_sent_at FROM public.notifications WHERE id = $1;",
      [abhishekNotifId]
    );
    assert(notifAfterSent.rows[0].email_status === 'sent', 'Parent notification status updated to sent');
    assert(notifAfterSent.rows[0].email_recipient === 'abhishek.cse@vctm.in', 'Parent notification email_recipient recorded');
    assert(notifAfterSent.rows[0].email_sent_at !== null, 'Parent notification email_sent_at recorded');

    const deliveryRow = await client.query(
      "SELECT * FROM public.notification_email_deliveries WHERE notification_id = $1;",
      [abhishekNotifId]
    );
    assert(deliveryRow.rows.length === 1, 'Delivery audit row created');
    assert(deliveryRow.rows[0].resend_email_id === 're_mock_abc_123', 'Resend message ID recorded');

    // Preflight after sent MUST report can_send = false and skip_reason = ALREADY_SENT
    const preflightAfterSent = await fetchNotificationsForDelivery([abhishekNotifId]);
    assert(preflightAfterSent[0].can_send === false, 'Duplicate dispatch preflight can_send is false');
    assert(preflightAfterSent[0].skip_reason === 'ALREADY_SENT', 'Duplicate dispatch preflight skip_reason is ALREADY_SENT');

    // -------------------------------------------------------------
    // Test 7: Email Content Builder (Information Only, Open VCTM ERP button)
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: Information-Only Email Template Formatting ---');
    const emailPayload = buildNotificationEmail({
      recipientName: 'Dr. Abhishek Garg',
      recipientRole: 'faculty',
      title: 'Official Academic Circular',
      message: 'Mid-term evaluation scores must be finalized by Friday.',
      notificationType: 'NOTICE',
    });
    assert(emailPayload.subject === 'VCTM ERP — New Notice: Official Academic Circular', 'Email subject properly formatted with type prefix');
    assert(emailPayload.html.includes('Dr. Abhishek Garg'), 'Email html contains recipient name');
    assert(emailPayload.html.includes('Mid-term evaluation scores must be finalized by Friday.'), 'Email html contains notice text');
    assert(!emailPayload.html.includes('<button'), 'Email html contains NO form action buttons');
    assert(emailPayload.html.includes('href="https://vctmerp.in"'), 'Email html contains Open VCTM ERP link to https://vctmerp.in');
    assert(emailPayload.html.includes('Open VCTM ERP'), 'Email html contains Open VCTM ERP button text');
    assert(!emailPayload.html.includes('approve') && !emailPayload.html.includes('reject'), 'Email contains NO bypass approval/rejection links');

    // Test dynamic subject prefixes
    const leavePayload = buildNotificationEmail({
      recipientName: 'Dr. Abhishek Garg',
      recipientRole: 'faculty',
      title: 'Leave request from Rahul',
      message: 'Applied for leave',
      notificationType: 'LEAVE_APPLICATION_SUBMITTED',
    });
    assert(leavePayload.subject === 'VCTM ERP — New Leave Application: Leave request from Rahul', 'Leave notification subject has New Leave Application prefix');

    const messagePayload = buildNotificationEmail({
      recipientName: 'Dr. Abhishek Garg',
      recipientRole: 'faculty',
      title: 'New message from Student',
      message: 'Query regarding lab test',
      notificationType: 'NEW_MESSAGE',
    });
    assert(messagePayload.subject === 'VCTM ERP — New Direct Message: New message from Student', 'Direct message subject has New Direct Message prefix');

    // Cleanup test notifications
    await client.query("DELETE FROM public.notifications WHERE id IN ($1, $2, $3);", [abhishekNotifId, hodNotif.rows[0].id, adminNotif.rows[0].id]);
    console.log('\nCleaned up temporary test notifications.');

    console.log('\n====================================================');
    console.log(`RESULTS: ${passed}/${total} TESTS PASSED`);
    console.log('====================================================');
    process.exit(passed === total ? 0 : 1);
  } finally {
    await client.end();
  }
}

runPipelineTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
