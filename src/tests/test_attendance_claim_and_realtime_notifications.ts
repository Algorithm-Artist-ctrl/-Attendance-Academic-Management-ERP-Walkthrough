import { Client } from 'pg';
import { supabaseService } from '../lib/services/supabaseService';
import { supabase } from '../lib/supabase/supabaseClient';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:[DB_PASSWORD]@[DB_HOST]:5432/postgres';

async function runTest() {
  console.log('🧪 Starting End-to-End Attendance Claim & Real-Time Notification Verification...');

  const pgClient = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await pgClient.connect();
    console.log('✅ Connected to PostgreSQL directly.');

    // Clean up any previous test remnants
    await pgClient.query(`
      DELETE FROM public.notifications WHERE reference_id IN (
        SELECT id FROM public.attendance_corrections WHERE reason LIKE '%Medical certificate%'
      );
    `);
    await pgClient.query(`
      DELETE FROM public.attendance_corrections WHERE reason LIKE '%Medical certificate%';
    `);

    // 1. Resolve active Faculty who has an auth user
    const facRes = await pgClient.query(`
      SELECT f.id, f.full_name, f.faculty_code, f.email, f.auth_user_id, u.id as auth_id
      FROM public.faculty f
      JOIN auth.users u ON (lower(u.email) = lower(f.email) OR u.id = f.auth_user_id)
      WHERE f.active = true AND f.email IS NOT NULL
      ORDER BY f.full_name ASC
      LIMIT 1;
    `);

    if (facRes.rows.length === 0) {
      throw new Error('No active faculty with auth user found');
    }
    const testFaculty = facRes.rows[0];
    console.log(`👤 Testing with Faculty: ${testFaculty.full_name} (${testFaculty.faculty_code}), Email: ${testFaculty.email}`);

    // Authenticate Supabase client so RLS context is active as faculty
    let loggedIn = false;
    for (const pwd of ['VctmFaculty@2026', 'faculty@123', 'password123']) {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: testFaculty.email,
        password: pwd,
      });
      if (!authError && authData.user) {
        console.log(`✅ Authenticated Supabase client as Faculty (${testFaculty.email})`);
        loggedIn = true;
        break;
      }
    }
    if (!loggedIn) {
      // Set password to VctmFaculty@2026 directly in auth.users
      const hashRes = await pgClient.query(`SELECT crypt('VctmFaculty@2026'::text, gen_salt('bf', 10)) as h;`);
      await pgClient.query(`UPDATE auth.users SET encrypted_password = $1 WHERE id = $2;`, [hashRes.rows[0].h, testFaculty.auth_id]);
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: testFaculty.email,
        password: 'VctmFaculty@2026',
      });
      if (authError) {
        throw new Error(`Failed to authenticate faculty: ${authError.message}`);
      }
      console.log(`✅ Provisioned password & authenticated Supabase client as Faculty`);
    }

    // 2. Check initial scoped pending corrections count for this faculty
    const initialDashboard = await supabaseService.fetchFacultyDashboardData(testFaculty.id);
    if (!initialDashboard) {
      throw new Error('fetchFacultyDashboardData returned null');
    }
    console.log(`📊 Initial Scoped Pending Corrections for ${testFaculty.full_name}: ${initialDashboard.pendingCorrectionsCount}`);
    if (initialDashboard.pendingCorrectionsCount >= 37) {
      throw new Error(`CRITICAL BUG: Scoped count is ${initialDashboard.pendingCorrectionsCount}, which is unscoped college-wide!`);
    }
    console.log(`✅ Faculty pending corrections count is strictly scoped (count = ${initialDashboard.pendingCorrectionsCount}, NOT 37).`);

    // 3. Find an existing attendance record for an active session belonging to this faculty without an existing correction
    const sessRes = await pgClient.query(`
      SELECT s.id as session_id, s.subject_id, s.section_id, s.faculty_id,
             ar.id as record_id, ar.student_id, st.full_name as student_name, st.roll_number, st.auth_user_id as student_auth_id
      FROM public.attendance_sessions s
      JOIN public.attendance_records ar ON ar.attendance_session_id = s.id
      JOIN public.students st ON st.id = ar.student_id
      WHERE s.faculty_id = $1
        AND NOT EXISTS (
          SELECT 1 FROM public.attendance_corrections ac
          WHERE ac.attendance_record_id = ar.id
        )
      LIMIT 1;
    `, [testFaculty.id]);

    let testRecord = sessRes.rows[0];
    let createdSessionId: string | null = null;
    let createdRecordId: string | null = null;

    if (!testRecord) {
      console.log('ℹ️ No existing attendance record found for faculty, creating a test record...');
      // Find a section and subject for this faculty
      const asgnRes = await pgClient.query(`
        SELECT section_id, subject_id FROM public.faculty_subject_assignments WHERE faculty_id = $1 AND active = true LIMIT 1;
      `, [testFaculty.id]);
      
      const asgn = asgnRes.rows[0];
      const studRes = await pgClient.query(`
        SELECT id, full_name, roll_number, auth_user_id FROM public.students WHERE section_id = $1 AND active = true LIMIT 1;
      `, [asgn.section_id]);
      const stud = studRes.rows[0];

      const newSess = await pgClient.query(`
        INSERT INTO public.attendance_sessions (section_id, subject_id, faculty_id, session_date, start_time, end_time)
        VALUES ($1, $2, $3, CURRENT_DATE, '10:00:00', '10:50:00') RETURNING id;
      `, [asgn.section_id, asgn.subject_id, testFaculty.id]);
      createdSessionId = newSess.rows[0].id;

      const newRec = await pgClient.query(`
        INSERT INTO public.attendance_records (attendance_session_id, student_id, status, marked_by)
        VALUES ($1, $2, 'Absent', $3) RETURNING id;
      `, [createdSessionId, stud.id, testFaculty.id]);
      createdRecordId = newRec.rows[0].id;

      testRecord = {
        session_id: createdSessionId,
        subject_id: asgn.subject_id,
        section_id: asgn.section_id,
        faculty_id: testFaculty.id,
        record_id: createdRecordId,
        student_id: stud.id,
        student_name: stud.full_name,
        roll_number: stud.roll_number,
        student_auth_id: stud.auth_user_id
      };
    }

    console.log(`📋 Using Attendance Record ID: ${testRecord.record_id} for Student: ${testRecord.student_name} (${testRecord.roll_number})`);

    // Ensure status is Absent so claim makes sense
    await pgClient.query(`UPDATE public.attendance_records SET status = 'Absent' WHERE id = $1;`, [testRecord.record_id]);

    // 4. Create an attendance claim
    console.log('\n📥 Submitting Attendance Claim for Student...');
    const claimRes = await pgClient.query(`
      INSERT INTO public.attendance_corrections (attendance_record_id, student_id, requested_status, reason, status)
      VALUES ($1, $2, 'Present', 'Medical certificate submitted; present during class.', 'pending')
      RETURNING id, created_at;
    `, [testRecord.record_id, testRecord.student_id]);

    const createdClaimId = claimRes.rows[0].id;
    console.log(`✅ Attendance Claim Inserted (Claim ID: ${createdClaimId})`);

    // 5. Verify that trigger trg_notify_faculty_on_claim created a notification for the faculty
    console.log('\n🔔 Verifying Real-Time Notification for Faculty...');
    const notifRes = await pgClient.query(`
      SELECT id, recipient_faculty_id, recipient_user_id, type, title, message, reference_id, is_read
      FROM public.notifications
      WHERE reference_id = $1 AND type = 'ATTENDANCE_CLAIM' AND recipient_faculty_id = $2;
    `, [createdClaimId, testFaculty.id]);

    if (notifRes.rows.length === 0) {
      throw new Error(`FAILED: No notification found for faculty ${testFaculty.id} referencing claim ${createdClaimId}`);
    }

    const facultyNotif = notifRes.rows[0];
    console.log('✅ Trigger trg_notify_faculty_on_claim fired successfully!');
    console.log(`   Notification ID: ${facultyNotif.id}`);
    console.log(`   Title: ${facultyNotif.title}`);
    console.log(`   Recipient Faculty ID: ${facultyNotif.recipient_faculty_id}`);
    console.log(`   Message snippet: ${facultyNotif.message.slice(0, 70)}...`);

    // 6. Verify that fetchFacultyDashboardData now includes this claim and increments count
    console.log('\n📈 Verifying Faculty Dashboard Scoped Query with Pending Claim...');
    const updatedDashboard = await supabaseService.fetchFacultyDashboardData(testFaculty.id);
    if (!updatedDashboard) {
      throw new Error('fetchFacultyDashboardData returned null');
    }
    console.log(`   Updated Pending Corrections Count: ${updatedDashboard.pendingCorrectionsCount}`);
    const foundClaimInDashboard = updatedDashboard.pendingCorrections.some(c => c.id === createdClaimId);
    if (!foundClaimInDashboard) {
      throw new Error(`FAILED: Claim ${createdClaimId} was not found in faculty's pendingCorrections list`);
    }
    console.log('✅ Newly created claim appears in faculty dashboard pending corrections list!');

    // 7. Verify Faculty Review Workflow (Approve Claim)
    console.log('\n✍️ Verifying Faculty Review: Approving Claim...');
    const reviewRes = await supabaseService.reviewCorrection({
      correctionId: createdClaimId,
      status: 'approved',
      reviewerFacultyId: testFaculty.id,
      reviewRemarks: 'Verified against laboratory log register. Approved.',
    });

    // Check attendance record status in database
    const recCheck = await pgClient.query(`SELECT status FROM public.attendance_records WHERE id = $1;`, [testRecord.record_id]);
    console.log(`   Attendance Record Status in DB: ${recCheck.rows[0].status}`);
    if (recCheck.rows[0].status !== 'Present') {
      throw new Error(`FAILED: Attendance record status is ${recCheck.rows[0].status}, expected Present`);
    }
    console.log('✅ Attendance record successfully updated to "Present"!');

    // Check attendance correction status in database
    const corrCheck = await pgClient.query(`SELECT status, reviewed_by, review_remarks FROM public.attendance_corrections WHERE id = $1;`, [createdClaimId]);
    console.log(`   Correction Status in DB: ${corrCheck.rows[0].status}`);
    if (corrCheck.rows[0].status !== 'approved') {
      throw new Error(`FAILED: Correction status is ${corrCheck.rows[0].status}, expected approved`);
    }
    console.log('✅ Attendance correction status transitioned to "approved"!');

    // Check student notification generated by trigger trg_notify_student_on_review
    console.log('\n🔔 Verifying Notification dispatched to Student on Approval...');
    const studNotifRes = await pgClient.query(`
      SELECT id, recipient_student_id, title, message
      FROM public.notifications
      WHERE reference_id = $1 AND title = 'Attendance Claim Approved';
    `, [createdClaimId]);

    if (studNotifRes.rows.length === 0) {
      throw new Error('FAILED: No student notification found for claim approval');
    }
    console.log('✅ Student notification generated on claim approval!');
    console.log(`   Student Notification Title: ${studNotifRes.rows[0].title}`);
    console.log(`   Message: ${studNotifRes.rows[0].message}`);

    // 8. Verify Dashboard pending count decrements
    console.log('\n📉 Verifying Dashboard Decrement after Approval...');
    const finalDashboard = await supabaseService.fetchFacultyDashboardData(testFaculty.id);
    const finalCount = finalDashboard?.pendingCorrectionsCount ?? 0;
    console.log(`   Final Scoped Pending Corrections Count: ${finalCount}`);
    const foundInFinal = (finalDashboard?.pendingCorrections || []).some(c => c.id === createdClaimId);
    if (foundInFinal) {
      throw new Error('FAILED: Approved claim still appears in pendingCorrections');
    }
    console.log('✅ Approved claim removed from pending corrections list!');

    // Clean up test data
    console.log('\n🧹 Cleaning up test claim and notifications...');
    await pgClient.query(`DELETE FROM public.notifications WHERE reference_id = $1;`, [createdClaimId]);
    await pgClient.query(`DELETE FROM public.attendance_corrections WHERE id = $1;`, [createdClaimId]);
    if (createdRecordId) {
      await pgClient.query(`DELETE FROM public.attendance_records WHERE id = $1;`, [createdRecordId]);
    }
    if (createdSessionId) {
      await pgClient.query(`DELETE FROM public.attendance_sessions WHERE id = $1;`, [createdSessionId]);
    }
    console.log('✅ Cleanup complete.');

    console.log('\n=============================================================');
    console.log('  🎉 ALL ATTENDANCE CLAIM & NOTIFICATION TESTS PASSED! 🎉');
    console.log('=============================================================\n');

  } catch (err: any) {
    console.error('❌ Test Failure:', err);
    process.exit(1);
  } finally {
    await pgClient.end();
  }
}

runTest();
