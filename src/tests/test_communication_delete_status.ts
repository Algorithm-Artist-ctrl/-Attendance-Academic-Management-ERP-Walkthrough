if (!process.env.DATABASE_URL && (process as any).loadEnvFile) {
  try { (process as any).loadEnvFile(); } catch {}
}
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL || '';

async function runVerification() {
  console.log('========================================================================');
  console.log('VCTM ERP: COMMUNICATION CENTER DELETE & STATUS VERIFICATION SUITE');
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

  let testStudentUserId: string | null = null;
  let testFacultyUserId: string | null = null;
  let testStudentId: string | null = null;
  let testFacultyId: string | null = null;
  let testDepartmentId: string | null = null;
  let testAcademicYearId: string | null = null;
  let testSectionId: string | null = null;
  let testSubjectId: string | null = null;
  const setAuthUser = async (userId: string) => {
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [userId]);
    await client.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false);`);
    await client.query(`SELECT set_config('request.jwt.claims', $1, false);`, [JSON.stringify({ sub: userId, role: 'authenticated' })]);
  };

  try {
    // -------------------------------------------------------------
    // SUITE 1: Schema & Functions Verification
    // -------------------------------------------------------------
    console.log('--- SUITE 1: Schema & Function Verification ---');

    // 1.1 Check conversation_user_settings columns
    const colsRes = await client.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'conversation_user_settings'
        AND column_name IN ('is_hidden', 'hidden_at')
      ORDER BY column_name;
    `);
    assert(colsRes.rows.length === 2, 'conversation_user_settings has is_hidden and hidden_at columns');
    const isHiddenCol = colsRes.rows.find(r => r.column_name === 'is_hidden');
    assert(isHiddenCol?.data_type === 'boolean', 'is_hidden column is boolean');

    // 1.2 Check RPC functions
    const rpcRes = await client.query(`
      SELECT DISTINCT proname, prosecdef 
      FROM pg_proc 
      WHERE proname IN ('delete_conversation_for_me', 'delete_message_group', 'send_message')
      ORDER BY proname;
    `);
    assert(rpcRes.rows.length === 3, 'All 3 RPC functions exist (delete_conversation_for_me, delete_message_group, send_message)');
    assert(rpcRes.rows.every(r => r.prosecdef === true), 'All communication delete & message functions have SECURITY DEFINER');

    // -------------------------------------------------------------
    // SETUP: Resolve or Create Test Users & Academic Context
    // -------------------------------------------------------------
    console.log('\n--- SETUP: Resolving Test Participants ---');

    // Find a student
    const stuRes = await client.query(`
      SELECT s.id as student_id, s.auth_user_id, p.id as profile_user_id
      FROM students s
      JOIN profiles p ON p.id = s.auth_user_id
      WHERE s.active = true AND s.auth_user_id IS NOT NULL
      LIMIT 1;
    `);
    if (stuRes.rows.length > 0) {
      testStudentId = stuRes.rows[0].student_id;
      testStudentUserId = stuRes.rows[0].auth_user_id;
    }

    // Find a faculty member
    const facRes = await client.query(`
      SELECT f.id as faculty_id, f.auth_user_id, f.department_id, p.id as profile_user_id
      FROM faculty f
      JOIN profiles p ON p.id = f.auth_user_id
      WHERE f.active = true AND f.auth_user_id IS NOT NULL
      LIMIT 1;
    `);
    if (facRes.rows.length > 0) {
      testFacultyId = facRes.rows[0].faculty_id;
      testFacultyUserId = facRes.rows[0].auth_user_id;
      testDepartmentId = facRes.rows[0].department_id;
    }

    // Find section, year, subject
    const secRes = await client.query(`SELECT id FROM sections LIMIT 1;`);
    testSectionId = secRes.rows[0]?.id || null;

    const yrRes = await client.query(`SELECT id FROM academic_years LIMIT 1;`);
    testAcademicYearId = yrRes.rows[0]?.id || null;

    const subRes = await client.query(`SELECT id FROM subjects LIMIT 1;`);
    testSubjectId = subRes.rows[0]?.id || null;

    assert(Boolean(testStudentUserId && testFacultyUserId), 'Test student and faculty participants resolved');

    // -------------------------------------------------------------
    // SUITE 2: Direct Conversation Status & Delete Lifecycle
    // -------------------------------------------------------------
    console.log('\n--- SUITE 2: Direct Conversation Status & Delete Lifecycle ---');

    // Clean up any existing conversation between these two
    await client.query(`
      DELETE FROM conversations 
      WHERE student_id = $1 AND faculty_id = $2;
    `, [testStudentId, testFacultyId]);

    // 2.1 Create a General Direct Conversation
    const createConvRes = await client.query(`
      INSERT INTO conversations (
        student_id, faculty_id, subject_id, section_id, academic_year_id,
        category, subject_topic, status, last_message_preview, last_message_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        'General', 'Project Discussion', 'OPEN', 'Initial greeting', now()
      )
      RETURNING id;
    `, [testStudentId, testFacultyId, testSubjectId, testSectionId, testAcademicYearId]);

    const convId = createConvRes.rows[0].id;
    assert(Boolean(convId), `Direct conversation created with ID: ${convId}`);

    // Insert an initial message
    await client.query(`
      INSERT INTO messages (
        conversation_id, sender_user_id, receiver_user_id, student_id, faculty_id, sender_role, message
      ) VALUES (
        $1, $2, $3, $4, $5, 'student', 'Hello Professor'
      );
    `, [convId, testStudentUserId, testFacultyUserId, testStudentId, testFacultyId]);

    // 2.2 Faculty sends a message via send_message RPC
    // Verify status DOES NOT advance to IN_PROGRESS because category is 'General'
    await setAuthUser(testFacultyUserId);

    await client.query(`
      SELECT public.send_conversation_message(
        p_conversation_id := $1::uuid,
        p_message := $2::text
      );
    `, [convId, 'Hello student, how are you?']);

    const convStatusCheck = await client.query(`
      SELECT category, status FROM conversations WHERE id = $1;
    `, [convId]);
    assert(convStatusCheck.rows[0].category === 'General', 'Conversation category is General');
    assert(convStatusCheck.rows[0].status === 'OPEN', 'Status remained OPEN (not erroneously set to IN_PROGRESS for General category)');

    // 2.3 Student calls delete_conversation_for_me
    // Simulate student calling delete_conversation_for_me
    await setAuthUser(testStudentUserId);

    await client.query(`
      SELECT public.delete_conversation_for_me($1::uuid);
    `, [convId]);

    // Check conversation_user_settings for student
    const studentSettings = await client.query(`
      SELECT is_hidden, hidden_at, cleared_at
      FROM conversation_user_settings
      WHERE conversation_id = $1 AND user_id = $2;
    `, [convId, testStudentUserId]);

    assert(studentSettings.rows.length === 1, 'conversation_user_settings row created for student');
    assert(studentSettings.rows[0].is_hidden === true, 'Student conversation is marked is_hidden = true');
    assert(Boolean(studentSettings.rows[0].hidden_at), 'Student conversation hidden_at is recorded');

    // Conversation should still exist in DB for faculty
    const convStillExists = await client.query(`
      SELECT id FROM conversations WHERE id = $1;
    `, [convId]);
    assert(convStillExists.rows.length === 1, 'Conversation still exists in DB because faculty has not deleted it');

    // 2.4 Faculty sends another message -> Should automatically UNHIDE for student
    await setAuthUser(testFacultyUserId);

    await client.query(`
      SELECT public.send_conversation_message(
        p_conversation_id := $1::uuid,
        p_message := $2::text
      );
    `, [convId, 'Follow up message to test un-hiding']);

    const studentSettingsAfterMsg = await client.query(`
      SELECT is_hidden
      FROM conversation_user_settings
      WHERE conversation_id = $1 AND user_id = $2;
    `, [convId, testStudentUserId]);
    assert(studentSettingsAfterMsg.rows[0].is_hidden === false, 'New incoming message successfully unhides conversation (is_hidden = false)');

    // 2.5 Both sides delete -> Conversation should be permanently purged
    // Student deletes again
    await setAuthUser(testStudentUserId);
    await client.query(`SELECT public.delete_conversation_for_me($1::uuid);`, [convId]);

    // Faculty also deletes
    await setAuthUser(testFacultyUserId);
    await client.query(`SELECT public.delete_conversation_for_me($1::uuid);`, [convId]);

    const convPurged = await client.query(`
      SELECT id FROM conversations WHERE id = $1;
    `, [convId]);
    assert(convPurged.rows.length === 0, 'Conversation row permanently purged from DB after both participants deleted it');

    // Messages should also be cascade deleted
    const msgsPurged = await client.query(`
      SELECT id FROM messages WHERE conversation_id = $1;
    `, [convId]);
    assert(msgsPurged.rows.length === 0, 'All conversation messages cascade deleted cleanly');

    // -------------------------------------------------------------
    // SUITE 3: Class / Subject Group Deletion & Security
    // -------------------------------------------------------------
    console.log('\n--- SUITE 3: Message Group Deletion & Authorization ---');

    // Clean up any lingering test section or group from earlier runs
    await client.query(`DELETE FROM sections WHERE name = 'TEST-COMM-DELETE';`);

    const semRes = await client.query(`SELECT id FROM semesters LIMIT 1;`);
    const testSemesterId = semRes.rows[0]?.id || null;

    const testSecRes = await client.query(`
      INSERT INTO sections (name, semester_id)
      VALUES ('TEST-COMM-DELETE', $1)
      RETURNING id;
    `, [testSemesterId]);
    const tempSectionId = testSecRes.rows[0].id;

    // 3.1 Create a test group
    const createGroupRes = await client.query(`
      INSERT INTO message_groups (
        department_id, academic_year_id, section_id, subject_id,
        created_by_faculty_id, allow_student_replies, last_message_preview, last_message_at
      ) VALUES (
        $1, $2, $3, $4,
        $5, true, 'Test Group Announcement', now()
      )
      RETURNING id;
    `, [testDepartmentId, testAcademicYearId, tempSectionId, testSubjectId, testFacultyId]);

    const testGroupId = createGroupRes.rows[0].id;
    assert(Boolean(testGroupId), `Test message group created with ID: ${testGroupId}`);

    // Insert group message
    const grpMsgRes = await client.query(`
      INSERT INTO group_messages (
        group_id, sender_user_id, sender_role, sender_name, message
      ) VALUES (
        $1, $2, 'faculty', 'Test Faculty', 'Welcome to the class group'
      )
      RETURNING id;
    `, [testGroupId, testFacultyUserId]);
    assert(grpMsgRes.rows.length === 1, 'Group message created');

    // Insert group member read state
    await client.query(`
      INSERT INTO group_member_read_state (group_id, user_id, last_read_at)
      VALUES ($1, $2, now());
    `, [testGroupId, testStudentUserId]);

    // 3.2 Student attempts to delete the group -> MUST BE REJECTED
    await setAuthUser(testStudentUserId);

    let studentBlocked = false;
    try {
      await client.query(`SELECT public.delete_message_group($1::uuid);`, [testGroupId]);
    } catch (err: any) {
      studentBlocked = true;
    }
    assert(studentBlocked, 'Student deletion attempt strictly rejected by delete_message_group RPC (403)');

    // Group must still exist
    const grpStillExists = await client.query(`
      SELECT id FROM message_groups WHERE id = $1;
    `, [testGroupId]);
    assert(grpStillExists.rows.length === 1, 'Group intact after unauthorized student delete attempt');

    // 3.3 Creator faculty calls delete_message_group -> MUST SUCCEED
    await setAuthUser(testFacultyUserId);

    const delRes = await client.query(`
      SELECT public.delete_message_group($1::uuid);
    `, [testGroupId]);
    assert(Boolean(delRes), 'delete_message_group succeeded for creator faculty');

    // Group must be deleted
    const grpDeleted = await client.query(`
      SELECT id FROM message_groups WHERE id = $1;
    `, [testGroupId]);
    assert(grpDeleted.rows.length === 0, 'Message group deleted from message_groups table');

    // Cascaded children must also be deleted
    const childMsgs = await client.query(`
      SELECT id FROM group_messages WHERE group_id = $1;
    `, [testGroupId]);
    assert(childMsgs.rows.length === 0, 'Child group_messages cascade deleted');

    const childReadState = await client.query(`
      SELECT * FROM group_member_read_state WHERE group_id = $1;
    `, [testGroupId]);
    assert(childReadState.rows.length === 0, 'Child group_member_read_state cascade deleted');

    // Audit log should record GROUP_DELETED
    const auditRes = await client.query(`
      SELECT action, entity_type, entity_id
      FROM audit_logs
      WHERE action = 'GROUP_DELETED' AND entity_id = $1;
    `, [testGroupId]);
    assert(auditRes.rows.length > 0, 'GROUP_DELETED action recorded in audit_logs');

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    try {
      await client.query(`DELETE FROM sections WHERE name = 'TEST-COMM-DELETE';`);
    } catch {}
    await client.end();
  }

  console.log('\n========================================================================');
  console.log(`📊 FINAL TEST RESULTS: ${passedTests}/${totalTests} Assertions Passed`);
  console.log('========================================================================');

  if (passedTests === totalTests && totalTests > 0) {
    console.log('🎉 ALL COMMUNICATION DELETE & STATUS TESTS PASSED PERFECTLY!\n');
    process.exit(0);
  } else {
    console.error(`💥 SOME TESTS FAILED (${totalTests - passedTests} failures)`);
    process.exit(1);
  }
}

runVerification();
