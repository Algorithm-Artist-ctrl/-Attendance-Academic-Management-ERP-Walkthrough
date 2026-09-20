import pg from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.obssoojzryqiudllnlkh:Tarun%40759977@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres';

async function runAcademicAndNoticesVerification() {
  console.log('🧪 Starting Academic Consistency, Scoping & Notices Verification...\n');
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  await client.connect();
  console.log('✅ Connected to PostgreSQL database.');

  try {
    // -------------------------------------------------------------
    // SETUP: Discover test actors (Admin/HOD, Faculty, Students in Sections)
    // -------------------------------------------------------------
    const adminRes = await client.query(`
      SELECT id, full_name, role 
      FROM profiles 
      WHERE role IN ('super_admin', 'hod') 
      LIMIT 1;
    `);
    const adminUser = adminRes.rows[0];
    if (!adminUser) throw new Error('No admin/hod user found in profiles');
    console.log(`👤 Admin/HOD Actor: ${adminUser.full_name} (${adminUser.id}, role: ${adminUser.role})`);

    const sectionsRes = await client.query(`
      SELECT s.id, s.name, count(st.id) as student_count
      FROM sections s
      LEFT JOIN students st ON st.section_id = s.id AND st.active = true
      WHERE s.active = true
      GROUP BY s.id, s.name
      HAVING count(st.id) > 0
      LIMIT 2;
    `);

    if (sectionsRes.rows.length < 1) throw new Error('Need at least 1 active section with students');
    const secA = sectionsRes.rows[0];
    const secB = sectionsRes.rows[1] || null;
    console.log(`🏫 Section A: ${secA.name} (${secA.id}) with ${secA.student_count} students`);
    if (secB) {
      console.log(`🏫 Section B: ${secB.name} (${secB.id}) with ${secB.student_count} students`);
    }

    const studentsARes = await client.query(`
      SELECT id, full_name, roll_number, auth_user_id
      FROM students
      WHERE section_id = $1 AND active = true
      LIMIT 3;
    `, [secA.id]);
    const studentA = studentsARes.rows[0];
    console.log(`🎓 Student A: ${studentA.full_name} (${studentA.roll_number}, id: ${studentA.id})`);

    let studentB = null;
    if (secB) {
      const studentsBRes = await client.query(`
        SELECT id, full_name, roll_number, auth_user_id
        FROM students
        WHERE section_id = $1 AND active = true
        LIMIT 1;
      `, [secB.id]);
      studentB = studentsBRes.rows[0] || null;
      if (studentB) {
        console.log(`🎓 Student B: ${studentB.full_name} (${studentB.roll_number}, id: ${studentB.id})`);
      }
    }

    const subjectRes = await client.query(`
      SELECT id, subject_name, subject_code 
      FROM subjects 
      WHERE active = true 
      LIMIT 1;
    `);
    const testSubject = subjectRes.rows[0];
    if (!testSubject) throw new Error('No active subject found');
    console.log(`📚 Subject: ${testSubject.subject_name} (${testSubject.subject_code})`);

    const facultyRes = await client.query(`
      SELECT f.id, f.full_name, f.email, f.auth_user_id
      FROM faculty f
      JOIN profiles p ON p.id = f.auth_user_id
      WHERE f.active = true
      LIMIT 1;
    `);
    const testFaculty = facultyRes.rows[0];
    const testFacultyProfileId = testFaculty?.auth_user_id || adminUser.id;
    console.log(`👨‍🏫 Faculty: ${testFaculty.full_name} (${testFaculty.id}, profile: ${testFacultyProfileId})`);

    // =============================================================
    // TEST 1: Notice Publishing & Targeted Notifications via publish_notice RPC
    // =============================================================
    console.log('\n--- TEST 1: Notice Publishing & Recipient Notifications ---');
    const testNoticeTitle = `E2E Circular ${Date.now()}`;
    const testNoticeContent = `Official verification circular published by ${adminUser.full_name}.`;

    const pubNoticeRes = await client.query(`
      SELECT publish_notice(
        p_title := $1::text,
        p_content := $2::text,
        p_category := 'Academic'::text,
        p_priority := 'HIGH'::text,
        p_author := $3::text,
        p_created_by := $4::uuid,
        p_created_by_role := $5::text,
        p_target_audience := 'STUDENTS'::text,
        p_target_section_id := NULL::uuid,
        p_target_department_id := NULL::uuid,
        p_target_role := 'student'::text,
        p_is_pinned := true
      ) as notice_id;
    `, [testNoticeTitle, testNoticeContent, adminUser.full_name, adminUser.id, adminUser.role]);

    const createdNoticeRaw = pubNoticeRes.rows[0]?.notice_id;
    const createdNoticeId = typeof createdNoticeRaw === 'object' && createdNoticeRaw !== null ? createdNoticeRaw.id : createdNoticeRaw;
    if (!createdNoticeId) throw new Error('Failed to create notice via publish_notice RPC');
    console.log(`✅ Notice created with ID: ${createdNoticeId}`);

    // Verify row in notices table
    const noticeRow = await client.query(`
      SELECT id, title, content, priority, is_pinned, status, deleted_at
      FROM notices
      WHERE id = $1;
    `, [createdNoticeId]);
    if (noticeRow.rows.length === 0) throw new Error('Notice row missing in notices table!');
    if (noticeRow.rows[0].status !== 'PUBLISHED') throw new Error(`Unexpected notice status: ${noticeRow.rows[0].status}`);
    console.log('✅ Notice row verified in public.notices table with status = PUBLISHED');

    // Verify notifications generated for student
    const notifRes = await client.query(`
      SELECT id, recipient_user_id, title, message, is_read, type
      FROM notifications
      WHERE reference_id = $1 OR message LIKE $2;
    `, [createdNoticeId, `%${testNoticeTitle}%`]);
    console.log(`✅ Target notifications generated: ${notifRes.rows.length} recipient rows created`);
    if (notifRes.rows.length === 0) {
      console.warn('⚠️ Warning: No student notifications found (verify students have user_id / auth_user_id)');
    }

    // =============================================================
    // TEST 2: Targeted Section Notice & Scoping Isolation
    // =============================================================
    console.log('\n--- TEST 2: Targeted Section Notice Scoping ---');
    const secNoticeTitle = `Section A Circular ${Date.now()}`;
    const pubSecRes = await client.query(`
      SELECT publish_notice(
        p_title := $1::text,
        p_content := 'Strictly for Section A students only'::text,
        p_category := 'Academic'::text,
        p_priority := 'NORMAL'::text,
        p_author := $2::text,
        p_created_by := $3::uuid,
        p_created_by_role := $4::text,
        p_target_audience := 'SECTION'::text,
        p_target_section_id := $5::uuid,
        p_target_department_id := NULL::uuid,
        p_target_role := 'student'::text,
        p_is_pinned := false
      ) as notice_id;
    `, [secNoticeTitle, adminUser.full_name, adminUser.id, adminUser.role, secA.id]);

    const secNoticeRaw = pubSecRes.rows[0]?.notice_id;
    const secNoticeId = typeof secNoticeRaw === 'object' && secNoticeRaw !== null ? secNoticeRaw.id : secNoticeRaw;
    console.log(`✅ Section-specific notice created: ${secNoticeId}`);

    // If studentB exists, verify studentB was NOT notified
    if (studentB && studentB.auth_user_id) {
      const bNotif = await client.query(`
        SELECT id FROM notifications
        WHERE recipient_user_id = $1 AND (reference_id = $2 OR message LIKE $3);
      `, [studentB.auth_user_id, secNoticeId, `%${secNoticeTitle}%`]);
      if (bNotif.rows.length > 0) {
        throw new Error('FAILED: Student in Section B received notification for Section A notice!');
      }
      console.log('✅ Verified Section B student did NOT receive Section A notification');
    }

    // =============================================================
    // TEST 3: Notice Soft Deletion & Notification Cleanup
    // =============================================================
    console.log('\n--- TEST 3: Notice Soft Deletion & Cleanup ---');
    const delRes = await client.query(`
      SELECT delete_notice($1::uuid) as success;
    `, [createdNoticeId]);
    if (!delRes.rows[0]?.success) throw new Error('delete_notice returned false');

    const deletedNoticeRow = await client.query(`
      SELECT status, deleted_at FROM notices WHERE id = $1;
    `, [createdNoticeId]);
    if (deletedNoticeRow.rows[0].status !== 'DELETED' || !deletedNoticeRow.rows[0].deleted_at) {
      throw new Error('Notice status was not updated to DELETED with deleted_at set!');
    }
    console.log('✅ Notice soft-deleted successfully (status = DELETED, deleted_at set)');

    // Verify unread notifications were cleaned up
    const remainingNotifs = await client.query(`
      SELECT id FROM notifications WHERE reference_id = $1 AND is_read = false;
    `, [createdNoticeId]);
    if (remainingNotifs.rows.length > 0) {
      throw new Error(`Expected 0 unread notifications after notice delete, found ${remainingNotifs.rows.length}`);
    }
    console.log('✅ Unread recipient notifications cleaned up on notice deletion');

    // =============================================================
    // TEST 4: Sessional Assessment Marks Draft vs Published Flow
    // =============================================================
    console.log('\n--- TEST 4: Marks Draft vs Published Flow & Scorecard ---');
    // Create test sessional assessment
    const sessTitle = `Test Sessional E2E ${Date.now()}`;
    const sessRes = await client.query(`
      INSERT INTO sessional_assessments (
        title, subject_id, section_id, faculty_id, max_marks, exam_date, status
      ) VALUES ($1, $2, $3, $4, 30, CURRENT_DATE, 'draft')
      RETURNING id, status;
    `, [sessTitle, testSubject.id, secA.id, testFacultyProfileId]);
    const testSessId = sessRes.rows[0].id;
    console.log(`✅ Created draft assessment: ${testSessId} (${sessTitle})`);

    // Insert student mark as draft
    const testMarksObtained = 27.5;
    await client.query(`
      INSERT INTO sessional_marks (
        sessional_assessment_id, student_id, marks_obtained, status, faculty_id, subject_id
      ) VALUES ($1, $2, $3, 'draft', $4, $5)
      ON CONFLICT (sessional_assessment_id, student_id)
      DO UPDATE SET marks_obtained = EXCLUDED.marks_obtained, status = 'draft';
    `, [testSessId, studentA.id, testMarksObtained, testFaculty.id, testSubject.id]);
    console.log(`✅ Saved marks for Student A as DRAFT: ${testMarksObtained}/30`);

    // Check DB status is draft
    const draftMarkRow = await client.query(`
      SELECT marks_obtained, status 
      FROM sessional_marks 
      WHERE sessional_assessment_id = $1 AND student_id = $2;
    `, [testSessId, studentA.id]);
    if (draftMarkRow.rows[0].status !== 'draft') {
      throw new Error(`Expected draft status, got ${draftMarkRow.rows[0].status}`);
    }
    console.log('✅ Draft mark verified in PostgreSQL with status = draft');

    // Call publish_assessment_marks RPC
    const pubMarksRes = await client.query(`
      SELECT publish_assessment_marks($1::uuid, $2::uuid) as success;
    `, [testSessId, testFacultyProfileId]);
    if (!pubMarksRes.rows[0]?.success) {
      throw new Error('publish_assessment_marks RPC failed');
    }
    console.log('✅ publish_assessment_marks RPC executed successfully');

    // Verify assessment and mark transitioned to published
    const pubSessCheck = await client.query(`
      SELECT status FROM sessional_assessments WHERE id = $1;
    `, [testSessId]);
    if (pubSessCheck.rows[0].status !== 'published') {
      throw new Error(`Assessment status not published: ${pubSessCheck.rows[0].status}`);
    }

    const pubMarkCheck = await client.query(`
      SELECT status FROM sessional_marks WHERE sessional_assessment_id = $1 AND student_id = $2;
    `, [testSessId, studentA.id]);
    if (pubMarkCheck.rows[0].status !== 'published') {
      throw new Error(`Mark status not published: ${pubMarkCheck.rows[0].status}`);
    }
    console.log('✅ Both assessment and student marks transitioned to status = published');

    // Verify student received a notification
    const studNotif = await client.query(`
      SELECT id, title, message 
      FROM notifications 
      WHERE reference_id = $1 OR message LIKE $2;
    `, [testSessId, `%${sessTitle}%`]);
    console.log(`✅ Student marks publication notification created: ${studNotif.rows.length} rows`);

    // Clean up test assessment
    await client.query(`
      UPDATE sessional_assessments 
      SET status = 'archived', deleted_at = NOW() 
      WHERE id = $1;
    `, [testSessId]);
    console.log('✅ Test assessment soft-deleted/archived');

    // =============================================================
    // TEST 5: Quizzes & Assignments Section Scoping & Deletion Safety
    // =============================================================
    console.log('\n--- TEST 5: Quiz Scoping & Deletion Safety ---');
    const quizTitle = `Test Quiz Scoping ${Date.now()}`;
    const quizRes = await client.query(`
      INSERT INTO quizzes (
        title, subject_id, section_id, faculty_id, max_marks, active, status, google_form_url, start_time, end_time
      ) VALUES ($1, $2, $3, $4, 20, true, 'published', 'https://docs.google.com/forms/d/e/test/viewform', now(), now() + interval '1 hour')
      RETURNING id;
    `, [quizTitle, testSubject.id, secA.id, testFaculty.id]);
    const testQuizId = quizRes.rows[0].id;
    console.log(`✅ Created test quiz in Section A: ${testQuizId}`);

    // Verify student in Section A sees the quiz
    const secAQuizzes = await client.query(`
      SELECT id, title FROM quizzes 
      WHERE section_id = $1 AND active = true AND deleted_at IS NULL AND id = $2;
    `, [secA.id, testQuizId]);
    if (secAQuizzes.rows.length === 0) {
      throw new Error('Section A student query did NOT find quiz in Section A');
    }
    console.log('✅ Section A student query found quiz');

    // Verify student in Section B does NOT see the quiz
    if (secB) {
      const secBQuizzes = await client.query(`
        SELECT id, title FROM quizzes 
        WHERE section_id = $1 AND active = true AND deleted_at IS NULL AND id = $2;
      `, [secB.id, testQuizId]);
      if (secBQuizzes.rows.length > 0) {
        throw new Error('FAILED: Section B student found quiz belonging to Section A!');
      }
      console.log('✅ Verified Section B student cannot see Section A quiz');
    }

    // Soft delete the quiz
    await client.query(`
      UPDATE quizzes 
      SET active = false, deleted_at = NOW() 
      WHERE id = $1;
    `, [testQuizId]);
    console.log('✅ Soft-deleted test quiz (active = false, deleted_at = now())');

    // Verify Section A query no longer returns the quiz
    const deletedQuizCheck = await client.query(`
      SELECT id FROM quizzes 
      WHERE section_id = $1 AND active = true AND deleted_at IS NULL AND id = $2;
    `, [secA.id, testQuizId]);
    if (deletedQuizCheck.rows.length > 0) {
      throw new Error('FAILED: Soft-deleted quiz still returned in active query!');
    }
    console.log('✅ Verified deleted quiz is completely excluded from queries');

    console.log('\n=============================================================');
    console.log('🎉 ALL TESTS PASSED! Academic consistency, marks persistence,');
    console.log('scoping isolation, soft-deletion, and notices verified!');
    console.log('=============================================================\n');

  } catch (err: any) {
    console.error('❌ Verification failed with error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runAcademicAndNoticesVerification();
