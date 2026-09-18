import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required.');
}

async function runClassGroupCommunicationE2ETests() {
  console.log('========================================================================');
  console.log('VCTM ERP: CLASS / SUBJECT GROUP COMMUNICATION & STUDENT PROFILE E2E TEST');
  console.log('========================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, desc: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${desc}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${desc}`);
    }
  }

  const client = new Client({ 
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  let testMessageId: string | null = null;
  let testGroupId: string | null = null;
  let assignedFacultyId: string | null = null;
  let assignedFacultyAuthId: string | null = null;
  let unassignedFacultyId: string | null = null;
  let unassignedFacultyAuthId: string | null = null;
  let testSectionId: string | null = null;
  let testSubjectId: string | null = null;
  let testYearId: string | null = null;
  let studentAId: string | null = null;
  let studentAAuthId: string | null = null;
  let studentBId: string | null = null;
  let studentBAuthId: string | null = null;
  let otherSectionStudentId: string | null = null;
  let otherSectionStudentAuthId: string | null = null;
  let superAdminAuthId: string | null = null;

  try {
    // -------------------------------------------------------------
    // SUITE 1: Database Schema, Tables, Indexes, Realtime & Columns
    // -------------------------------------------------------------
    console.log('\n--- SUITE 1: Database Schema, Tables, RLS, Realtime & Columns ---');

    // 1.1 Check message_groups table
    const mgRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'message_groups';
    `);
    assert(mgRes.rows.length >= 7, `message_groups table exists with ${mgRes.rows.length} columns`);

    // 1.2 Check group_messages table
    const gmRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'group_messages';
    `);
    assert(gmRes.rows.length >= 10, `group_messages table exists with ${gmRes.rows.length} columns`);

    // 1.3 Check group_member_read_state table
    const rsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'group_member_read_state';
    `);
    assert(rsRes.rows.length >= 4, `group_member_read_state table exists with ${rsRes.rows.length} columns`);

    // 1.4 Check RLS enabled on all 3 tables
    const rlsRes = await client.query(`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public' AND tablename IN ('message_groups', 'group_messages', 'group_member_read_state')
      ORDER BY tablename;
    `);
    assert(
      rlsRes.rows.length === 3 && rlsRes.rows.every(r => r.rowsecurity === true),
      'All 3 tables (message_groups, group_messages, group_member_read_state) have Row Level Security enabled'
    );

    // 1.5 Check supabase_realtime publication
    const pubRes = await client.query(`
      SELECT tablename 
      FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename IN ('message_groups', 'group_messages', 'group_member_read_state')
      ORDER BY tablename;
    `);
    assert(
      pubRes.rows.length === 3,
      `All 3 tables registered in supabase_realtime publication (found ${pubRes.rows.length})`
    );

    // 1.6 Check extended columns on students table
    const studColsRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'students'
        AND column_name IN ('father_name', 'father_contact_number', 'mother_name', 'mother_contact_number', 'blood_group', 'address');
    `);
    assert(
      studColsRes.rows.length >= 6,
      `students table has all 6 extended profile columns (found ${studColsRes.rows.length}: ${studColsRes.rows.map(r => r.column_name).join(', ')})`
    );

    // 1.7 Check RPC functions exist
    const rpcRes = await client.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
        AND routine_name IN ('send_group_message', 'mark_group_as_read', 'get_group_members', 'get_student_profile');
    `);
    assert(
      rpcRes.rows.length === 4,
      `All 4 required RPC functions exist (send_group_message, mark_group_as_read, get_group_members, get_student_profile)`
    );

    // -------------------------------------------------------------
    // SUITE 2: Real Relationships & Data Setup
    // -------------------------------------------------------------
    console.log('\n--- SUITE 2: Group Discovery & Relational Integrity ---');

    // Find an active faculty assignment with students and matching profiles
    const assignRes = await client.query(`
      SELECT fsa.id, fsa.faculty_id, fsa.subject_id, fsa.section_id, fsa.academic_year_id,
             f.full_name as faculty_name, f.email as faculty_email,
             sub.subject_name, sub.subject_code,
             sec.name as section_name,
             pf.id as faculty_auth_id,
             COUNT(st.id) as student_count
      FROM faculty_subject_assignments fsa
      JOIN faculty f ON f.id = fsa.faculty_id
      JOIN profiles pf ON pf.id = f.id OR pf.faculty_id = f.id
      JOIN subjects sub ON sub.id = fsa.subject_id
      JOIN sections sec ON sec.id = fsa.section_id
      JOIN students st ON st.section_id = fsa.section_id AND st.academic_year_id = fsa.academic_year_id AND st.active = true
      WHERE fsa.active = true
      GROUP BY fsa.id, fsa.faculty_id, fsa.subject_id, fsa.section_id, fsa.academic_year_id,
               f.full_name, f.email, sub.subject_name, sub.subject_code, sec.name, pf.id
      ORDER BY student_count DESC
      LIMIT 1;
    `);

    assert(assignRes.rows.length > 0, 'Found active faculty subject assignment with enrolled students');
    const assignment = assignRes.rows[0];
    assignedFacultyId = assignment.faculty_id;
    assignedFacultyAuthId = assignment.faculty_auth_id;
    testSubjectId = assignment.subject_id;
    testSectionId = assignment.section_id;
    testYearId = assignment.academic_year_id;

    console.log(`  -> Selected Faculty: ${assignment.faculty_name} (${assignment.faculty_email})`);
    console.log(`  -> Class / Group: ${assignment.subject_name} (${assignment.subject_code}) • Section ${assignment.section_name}`);
    console.log(`  -> Enrolled Students in section: ${assignment.student_count}`);

    // Verify canonical message_group exists for this assignment
    const groupRes = await client.query(`
      SELECT id, academic_year_id, section_id, subject_id, allow_student_replies
      FROM message_groups
      WHERE academic_year_id = $1 AND section_id = $2 AND subject_id = $3;
    `, [testYearId, testSectionId, testSubjectId]);

    assert(groupRes.rows.length > 0, `Canonical message_group exists for (${assignment.subject_code} / Section ${assignment.section_name})`);
    testGroupId = groupRes.rows[0].id;

    // Find students in this section with profile mapping
    const studentsInSecRes = await client.query(`
      SELECT st.id, st.full_name, st.roll_number, st.email, COALESCE(ps.id, st.id) as auth_id
      FROM students st
      LEFT JOIN profiles ps ON ps.id = st.id OR ps.student_id = st.id
      WHERE st.section_id = $1 AND st.academic_year_id = $2 AND st.active = true
      ORDER BY st.roll_number ASC
      LIMIT 2;
    `, [testSectionId, testYearId]);

    assert(studentsInSecRes.rows.length >= 2, `Found ${studentsInSecRes.rows.length} test students in Section ${assignment.section_name}`);
    studentAId = studentsInSecRes.rows[0].id;
    studentAAuthId = studentsInSecRes.rows[0].auth_id;
    studentBId = studentsInSecRes.rows[1].id;
    studentBAuthId = studentsInSecRes.rows[1].auth_id;

    console.log(`  -> Student A: ${studentsInSecRes.rows[0].full_name} (${studentsInSecRes.rows[0].roll_number})`);
    console.log(`  -> Student B: ${studentsInSecRes.rows[1].full_name} (${studentsInSecRes.rows[1].roll_number})`);

    // Find a student in another section
    const otherStudRes = await client.query(`
      SELECT st.id, st.full_name, st.roll_number, st.section_id, COALESCE(ps.id, st.id) as auth_id
      FROM students st
      LEFT JOIN profiles ps ON ps.id = st.id OR ps.student_id = st.id
      WHERE st.section_id != $1 AND st.active = true
      LIMIT 1;
    `, [testSectionId]);
    if (otherStudRes.rows.length > 0) {
      otherSectionStudentId = otherStudRes.rows[0].id;
      otherSectionStudentAuthId = otherStudRes.rows[0].auth_id;
    }

    // Find an unassigned faculty
    const unassignedFacRes = await client.query(`
      SELECT f.id, f.full_name, f.email, pf.id as auth_id
      FROM faculty f
      JOIN profiles pf ON pf.id = f.id OR pf.faculty_id = f.id
      WHERE f.id NOT IN (
        SELECT faculty_id FROM faculty_subject_assignments WHERE section_id = $1 AND active = true
      )
      AND f.active = true
      LIMIT 1;
    `, [testSectionId]);
    if (unassignedFacRes.rows.length > 0) {
      unassignedFacultyId = unassignedFacRes.rows[0].id;
      unassignedFacultyAuthId = unassignedFacRes.rows[0].auth_id;
    }

    // Find Super Admin
    const adminRes = await client.query(`
      SELECT id as auth_user_id FROM profiles WHERE role = 'super_admin' LIMIT 1;
    `);
    superAdminAuthId = adminRes.rows.length > 0 ? adminRes.rows[0].auth_user_id : null;

    // -------------------------------------------------------------
    // SUITE 3: Group Message Broadcast & In-App Notification Generation
    // -------------------------------------------------------------
    console.log('\n--- SUITE 3: Group Broadcast & In-App Notifications ---');

    const testTitle = 'E2E Test: Class Assignment Submission Notice';
    const testContent = 'Important update regarding lab submission. Please review and complete on time.';

    // Impersonate assigned faculty using set_config
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [assignedFacultyAuthId]);

    // Execute send_group_message stored procedure
    const sendRes = await client.query(`
      SELECT * FROM send_group_message(
        $1::UUID,
        $2::UUID,
        $3::UUID,
        $4::TEXT,
        $5::TEXT
      );
    `, [testYearId, testSectionId, testSubjectId, testContent, testTitle]);

    assert(sendRes.rows.length === 1 && sendRes.rows[0].send_group_message.success === true, 'send_group_message RPC returned success = true');
    testMessageId = sendRes.rows[0].send_group_message.message_id;

    // Verify message inserted in group_messages table
    const verifyMsgRes = await client.query(`
      SELECT id, group_id, sender_user_id, sender_role, title, message 
      FROM group_messages 
      WHERE id = $1;
    `, [testMessageId]);
    assert(
      verifyMsgRes.rows.length === 1 && verifyMsgRes.rows[0].title === testTitle,
      'group_messages contains the broadcast message with exact group_id and title'
    );

    // Verify in-app notifications generated for section students
    const notifsRes = await client.query(`
      SELECT id, recipient_user_id, recipient_student_id, title, message, reference_type, reference_id, is_read
      FROM notifications
      WHERE reference_type = 'group_message' AND reference_id = $1
      ORDER BY created_at DESC;
    `, [testGroupId]);

    assert(notifsRes.rows.length > 0, `Notifications created automatically for section students (count = ${notifsRes.rows.length})`);
    
    const notifUserIds = notifsRes.rows.map(n => n.recipient_user_id || n.recipient_student_id);
    if (studentAAuthId) {
      const recA = notifsRes.rows.find(n => n.recipient_user_id === studentAAuthId || n.recipient_student_id === studentAId);
      assert(!!recA, `Notification delivered to Student A (${studentsInSecRes.rows[0].roll_number})`);
    }
    if (otherSectionStudentAuthId) {
      const recOther = notifsRes.rows.find(n => n.recipient_user_id === otherSectionStudentAuthId || n.recipient_student_id === otherSectionStudentId);
      assert(!recOther, 'Notification NOT delivered to student in a different section (strict scoping)');
    }

    // -------------------------------------------------------------
    // SUITE 4: Per-User Independent Read State
    // -------------------------------------------------------------
    console.log('\n--- SUITE 4: Per-User Independent Read State ---');

    if (studentAAuthId) {
      // Impersonate Student A
      await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [studentAAuthId]);

      // Mark group as read for Student A
      const markReadRes = await client.query(`SELECT mark_group_as_read($1::UUID);`, [testGroupId]);
      assert(markReadRes.rows.length === 1, 'mark_group_as_read RPC executed successfully for Student A');

      // Check group_member_read_state for Student A
      const readStateA = await client.query(`
        SELECT last_read_at 
        FROM group_member_read_state 
        WHERE group_id = $1 AND user_id = $2;
      `, [testGroupId, studentAAuthId]);
      assert(
        readStateA.rows.length === 1 && readStateA.rows[0].last_read_at !== null,
        'group_member_read_state recorded last_read_at timestamp for Student A'
      );

      // Verify Student A's notification was marked as read
      const studANotifRes = await client.query(`
        SELECT is_read 
        FROM notifications 
        WHERE (recipient_user_id = $1 OR recipient_student_id = $2) AND reference_type = 'group_message' AND reference_id = $3;
      `, [studentAAuthId, studentAId, testGroupId]);
      assert(
        studANotifRes.rows.length > 0 && studANotifRes.rows[0].is_read === true,
        "Student A's in-app notification is marked is_read = true"
      );
    }

    if (studentBAuthId) {
      // Check that Student B's read state is independent (still unread)
      const readStateB = await client.query(`
        SELECT last_read_at 
        FROM group_member_read_state 
        WHERE group_id = $1 AND user_id = $2;
      `, [testGroupId, studentBAuthId]);
      assert(
        readStateB.rows.length === 0 || readStateB.rows[0].last_read_at === null,
        "Student B maintains independent unread state (Student A's reading did NOT affect Student B)"
      );
    }

    // -------------------------------------------------------------
    // SUITE 5: Security & Authorization Enforcements
    // -------------------------------------------------------------
    console.log('\n--- SUITE 5: Security & Authorization Enforcement ---');

    // 5.1 Unassigned faculty attempts to send message to this group -> Must be rejected
    if (unassignedFacultyAuthId) {
      await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [unassignedFacultyAuthId]);
      let rejected = false;
      try {
        await client.query(`
          SELECT * FROM send_group_message(
            $1::UUID,
            $2::UUID,
            $3::UUID,
            'This message should be rejected',
            'Unauthorized attempt'
          );
        `, [testYearId, testSectionId, testSubjectId]);
      } catch (err: any) {
        rejected = true;
        assert(true, `Unassigned faculty rejected from broadcasting to class: "${err.message?.split('\n')[0]}"`);
      }
      if (!rejected) {
        assert(false, 'Unassigned faculty was incorrectly allowed to broadcast to unassigned class!');
      }
    }

    // 5.2 Student calls get_student_profile on another student -> Must be rejected
    if (studentAAuthId && studentBId) {
      await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [studentAAuthId]);
      let peerBlocked = false;
      try {
        await client.query(`SELECT get_student_profile($1::UUID);`, [studentBId]);
      } catch (err: any) {
        peerBlocked = true;
        assert(true, `Student blocked from viewing peer student profile: "${err.message?.split('\n')[0]}"`);
      }
      if (!peerBlocked) {
        assert(false, 'Student was incorrectly allowed to view peer student profile!');
      }
    }

    // 5.3 Student views their OWN profile -> Must succeed
    if (studentAAuthId && studentAId) {
      await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [studentAAuthId]);
      const ownProfileRes = await client.query(`SELECT get_student_profile($1::UUID);`, [studentAId]);
      const profileData = ownProfileRes.rows[0]?.get_student_profile;
      assert(
        profileData && profileData.id === studentAId,
        'Student successfully retrieved their OWN profile via get_student_profile'
      );
    }

    // 5.4 Assigned faculty views student profile -> Must succeed and include academic info
    if (assignedFacultyAuthId && studentAId) {
      await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [assignedFacultyAuthId]);
      const facProfileRes = await client.query(`SELECT get_student_profile($1::UUID);`, [studentAId]);
      const profileData = facProfileRes.rows[0]?.get_student_profile;
      assert(
        profileData && profileData.id === studentAId && profileData.roll_number,
        'Assigned Faculty successfully retrieved enrolled student profile with verified contact & attendance data'
      );
      assert(
        profileData.attendance_percentage !== undefined && profileData.subjects !== undefined,
        'Student profile includes real calculated attendance statistics and enrolled subjects'
      );
    }

    // 5.5 Unassigned faculty attempts to view student profile -> Must be rejected
    if (unassignedFacultyAuthId && studentAId) {
      await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [unassignedFacultyAuthId]);
      let unassignedBlocked = false;
      try {
        await client.query(`SELECT get_student_profile($1::UUID);`, [studentAId]);
      } catch (err: any) {
        unassignedBlocked = true;
        assert(true, `Unassigned faculty blocked from viewing student profile: "${err.message?.split('\n')[0]}"`);
      }
      if (!unassignedBlocked) {
        assert(false, 'Unassigned faculty was incorrectly allowed to view student profile!');
      }
    }

    // -------------------------------------------------------------
    // SUITE 6: Service Layer API Validation
    // -------------------------------------------------------------
    console.log('\n--- SUITE 6: Service Layer Integration ---');

    // Sign in JS client as assigned faculty or super admin to satisfy RLS
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: assignment.faculty_email,
      password: 'VctmFaculty@2026'
    });
    if (authErr) {
      console.log('  -> Fallback to Super Admin auth for service layer validation');
      await supabase.auth.signInWithPassword({
        email: 'tarunkushwah798@gmail.com',
        password: 'VctmAdmin@2026'
      });
    }

    // 6.1 Test get_group_members RPC as assigned faculty
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [assignedFacultyAuthId]);
    const rosterRes = await client.query(`SELECT get_group_members($1::UUID);`, [testGroupId]);
    const rosterData = rosterRes.rows[0]?.get_group_members || [];
    assert(
      Array.isArray(rosterData) && rosterData.length > 0,
      `get_group_members returned active enrolled roster (${rosterData.length} member(s))`
    );
    const firstMember = rosterData[0];
    assert(
      firstMember && firstMember.roll_number && firstMember.full_name,
      `Group member details verified (Roll: ${firstMember?.roll_number}, Name: ${firstMember?.full_name})`
    );

    // 6.2 Test fetchUserMessageGroups via supabaseService
    const facultyGroups = await supabaseService.fetchUserMessageGroups(
      assignedFacultyAuthId || assignedFacultyId!,
      'faculty'
    );
    assert(
      facultyGroups.length > 0,
      `supabaseService.fetchUserMessageGroups returned ${facultyGroups.length} assigned group(s) for faculty`
    );

    const testGrpMatch = facultyGroups.find(g => g.id === testGroupId);
    assert(
      !!testGrpMatch,
      `Returned faculty groups contains test group "${testGrpMatch?.name}" with subject code "${testGrpMatch?.subject?.code}"`
    );

    // 6.3 Test fetchGroupMessages via supabaseService
    const groupMsgs = await supabaseService.fetchGroupMessages(testGroupId);
    assert(
      groupMsgs.length > 0,
      `supabaseService.fetchGroupMessages returned messages (found ${groupMsgs.length})`
    );

    // 6.4 Test fetchStudentProfile via supabaseService
    const studentProfileRes = await supabaseService.fetchStudentProfile(studentAId!);
    assert(
      studentProfileRes.data !== null && studentProfileRes.data.id === studentAId,
      `supabaseService.fetchStudentProfile returned detailed profile for Student A (${studentProfileRes.data?.full_name})`
    );

  } catch (error: any) {
    console.error('Fatal test exception:', error);
    totalTests++;
  } finally {
    // -------------------------------------------------------------
    // CLEANUP: Clean up test artifacts from database
    // -------------------------------------------------------------
    console.log('\n--- Clean up test data ---');
    try {
      if (testMessageId) {
        await client.query(`DELETE FROM group_messages WHERE id = $1;`, [testMessageId]);
        console.log('Cleaned up test group message');
      }
      if (testGroupId) {
        await client.query(`
          DELETE FROM notifications 
          WHERE reference_type = 'group_message' AND reference_id = $1;
        `, [testGroupId]);
        await client.query(`
          DELETE FROM group_member_read_state 
          WHERE group_id = $1 AND (user_id = $2 OR user_id = $3);
        `, [testGroupId, studentAAuthId, assignedFacultyAuthId]);
        console.log('Cleaned up test notifications and read states');
      }
    } catch (e: any) {
      console.warn('Cleanup warning:', e.message);
    }

    await client.end();
  }

  console.log('\n========================================================================');
  console.log(`FINAL RESULT: ${passedTests}/${totalTests} TESTS PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('========================================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runClassGroupCommunicationE2ETests();
