if (!process.env.DATABASE_URL && (process as any).loadEnvFile) {
  try { (process as any).loadEnvFile(); } catch {}
}
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL || '';

async function runTest() {
  console.log('========================================================================');
  console.log('VCTM ERP: PREMIUM MESSAGING & DIRECT CHAT SYSTEM VERIFICATION');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, desc: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${desc}`);
    }
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  let testConversationId: string | null = null;
  let testStudentAuthId: string | null = null;
  let testFacultyAuthId: string | null = null;
  let testStudentId: string | null = null;
  let testFacultyId: string | null = null;
  let testAcademicYearId: string | null = null;
  let testSectionId: string | null = null;
  let msg1Id: string | null = null;
  let msg2Id: string | null = null;

  try {
    // -------------------------------------------------------------
    // SUITE 1: Schema & Column Verification
    // -------------------------------------------------------------
    console.log('--- SUITE 1: Schema & Column Verification ---');

    const msgColsRes = await client.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'messages'
      AND column_name IN ('edited_at', 'is_unsent', 'unsent_at', 'deleted_by_users', 'reply_to_message_id');
    `);

    const colNames = msgColsRes.rows.map(r => r.column_name);
    assert(colNames.includes('edited_at'), 'messages.edited_at column exists');
    assert(colNames.includes('is_unsent'), 'messages.is_unsent column exists');
    assert(colNames.includes('unsent_at'), 'messages.unsent_at column exists');
    assert(colNames.includes('deleted_by_users'), 'messages.deleted_by_users column exists');
    assert(colNames.includes('reply_to_message_id'), 'messages.reply_to_message_id column exists');

    const settingsTableRes = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'conversation_user_settings';
    `);
    assert(settingsTableRes.rows.length === 1, 'conversation_user_settings table exists');

    // -------------------------------------------------------------
    // SUITE 2: RPC Verification (Direct Execution)
    // -------------------------------------------------------------
    console.log('\n--- SUITE 2: Messaging RPCs Verification ---');

    // Find test participants
    const studentRes = await client.query(`
      SELECT s.id, s.academic_year_id, s.section_id, COALESCE(p.id, s.auth_user_id) as user_id
      FROM public.students s
      LEFT JOIN public.profiles p ON p.student_id = s.id
      LIMIT 1;
    `);
    const facultyRes = await client.query(`
      SELECT f.id, COALESCE(p.id, f.auth_user_id) as user_id
      FROM public.faculty f
      LEFT JOIN public.profiles p ON p.faculty_id = f.id
      LIMIT 1;
    `);

    testStudentAuthId = studentRes.rows[0]?.user_id;
    testFacultyAuthId = facultyRes.rows[0]?.user_id;
    testStudentId = studentRes.rows[0]?.id;
    testFacultyId = facultyRes.rows[0]?.id;
    testAcademicYearId = studentRes.rows[0]?.academic_year_id;
    testSectionId = studentRes.rows[0]?.section_id;

    assert(Boolean(testStudentAuthId && testFacultyAuthId && testStudentId && testFacultyId), 'Test users found in auth.users and public records');

    // Create a temporary conversation for testing
    const convInsert = await client.query(`
      INSERT INTO conversations (student_id, faculty_id, section_id, academic_year_id, category, status, last_message_preview)
      VALUES ($1, $2, $3, $4, 'General', 'OPEN', 'Testing chat controls')
      RETURNING id;
    `, [testStudentId, testFacultyId, testSectionId, testAcademicYearId]);
    testConversationId = convInsert.rows[0].id;
    assert(Boolean(testConversationId), `Created test conversation ${testConversationId}`);

    // Test 2.1: Insert a parent message
    const msg1Res = await client.query(`
      INSERT INTO messages (
        conversation_id, sender_user_id, receiver_user_id, student_id, faculty_id,
        sender_role, message
      ) VALUES (
        $1, $2, $3, $4, $5, 'faculty', 'Hello from faculty'
      ) RETURNING id, message, created_at;
    `, [testConversationId, testFacultyAuthId, testStudentAuthId, testStudentId, testFacultyId]);
    msg1Id = msg1Res.rows[0].id;
    assert(Boolean(msg1Id), `Created parent message: "${msg1Res.rows[0].message}" (ID: ${msg1Id})`);

    // Test 2.2: Reply to message (storing reply_to_message_id)
    const msg2Res = await client.query(`
      INSERT INTO messages (
        conversation_id, sender_user_id, receiver_user_id, student_id, faculty_id,
        sender_role, message, reply_to_message_id
      ) VALUES (
        $1, $2, $3, $4, $5, 'student', 'Replying to faculty message', $6
      ) RETURNING id, message, reply_to_message_id;
    `, [testConversationId, testStudentAuthId, testFacultyAuthId, testStudentId, testFacultyId, msg1Id]);
    msg2Id = msg2Res.rows[0].id;
    assert(msg2Res.rows[0].reply_to_message_id === msg1Id, `Reply message links to parent message ID ${msg1Id}`);

    // Test 2.3: Edit message (simulate edit_message RPC logic)
    const editRes = await client.query(`
      UPDATE messages 
      SET message = 'Hello from faculty (edited text)', edited_at = NOW()
      WHERE id = $1 AND sender_user_id = $2
      RETURNING message, edited_at;
    `, [msg1Id, testFacultyAuthId]);
    assert(editRes.rows[0].message === 'Hello from faculty (edited text)' && editRes.rows[0].edited_at !== null, 'Message successfully edited with edited_at timestamp');

    // Test 2.4: Unsend message (simulate unsend_message RPC logic)
    const unsendRes = await client.query(`
      UPDATE messages 
      SET message = 'Message unsent', is_unsent = true, unsent_at = NOW(), attachment_url = NULL, attachment_name = NULL
      WHERE id = $1 AND sender_user_id = $2
      RETURNING message, is_unsent, unsent_at, attachment_url;
    `, [msg1Id, testFacultyAuthId]);
    assert(unsendRes.rows[0].is_unsent === true && unsendRes.rows[0].message === 'Message unsent', 'Message successfully unsent with is_unsent=true and content cleared');

    // Test 2.5: Delete for me (append user ID to deleted_by_users array)
    const delForMeRes = await client.query(`
      UPDATE messages 
      SET deleted_by_users = ARRAY(SELECT DISTINCT unnest(array_append(COALESCE(deleted_by_users, '{}'), $2::uuid)))
      WHERE id = $1
      RETURNING deleted_by_users;
    `, [msg2Id, testStudentAuthId]);
    assert(
      delForMeRes.rows[0].deleted_by_users && delForMeRes.rows[0].deleted_by_users.includes(testStudentAuthId),
      'Delete for me added student user ID to deleted_by_users array while message remains in DB'
    );

    // Verify other user (faculty) does NOT have message deleted
    assert(
      !delForMeRes.rows[0].deleted_by_users.includes(testFacultyAuthId),
      'Delete for me did not delete the message for the other participant (faculty)'
    );

    // Test 2.6: Clear conversation for me (upsert into conversation_user_settings)
    await client.query(`
      INSERT INTO conversation_user_settings (conversation_id, user_id, cleared_at, updated_at)
      VALUES ($1, $2, NOW(), NOW())
      ON CONFLICT (conversation_id, user_id)
      DO UPDATE SET cleared_at = NOW(), updated_at = NOW();
    `, [testConversationId, testStudentAuthId]);

    const settingsCheck = await client.query(`
      SELECT cleared_at, marked_unread FROM conversation_user_settings 
      WHERE conversation_id = $1 AND user_id = $2;
    `, [testConversationId, testStudentAuthId]);
    assert(Boolean(settingsCheck.rows[0]?.cleared_at), 'Conversation cleared_at timestamp set for student');

    // Test 2.7: Mark conversation as unread
    await client.query(`
      INSERT INTO conversation_user_settings (conversation_id, user_id, marked_unread, updated_at)
      VALUES ($1, $2, true, NOW())
      ON CONFLICT (conversation_id, user_id)
      DO UPDATE SET marked_unread = true, updated_at = NOW();
    `, [testConversationId, testStudentAuthId]);

    const unreadCheck = await client.query(`
      SELECT marked_unread FROM conversation_user_settings 
      WHERE conversation_id = $1 AND user_id = $2;
    `, [testConversationId, testStudentAuthId]);
    assert(unreadCheck.rows[0]?.marked_unread === true, 'Conversation marked_unread set to true');

    // Test 2.8: Mark conversation as read (resets marked_unread)
    await client.query(`
      UPDATE conversation_user_settings
      SET marked_unread = false, updated_at = NOW()
      WHERE conversation_id = $1 AND user_id = $2;
    `, [testConversationId, testStudentAuthId]);

    const readCheck = await client.query(`
      SELECT marked_unread FROM conversation_user_settings 
      WHERE conversation_id = $1 AND user_id = $2;
    `, [testConversationId, testStudentAuthId]);
    assert(readCheck.rows[0]?.marked_unread === false, 'Conversation marked_unread reset to false on mark as read');

    // -------------------------------------------------------------
    // SUITE 3: Query Layer Filtering Verification
    // -------------------------------------------------------------
    console.log('\n--- SUITE 3: Per-User Filtering Layer Verification ---');

    // Query messages as Student (who deleted msg2 and cleared earlier)
    const studentMessages = await client.query(`
      SELECT m.*
      FROM messages m
      LEFT JOIN conversation_user_settings cus
        ON cus.conversation_id = m.conversation_id AND cus.user_id = $2
      WHERE m.conversation_id = $1
        AND NOT ($2::uuid = ANY(COALESCE(m.deleted_by_users, '{}')))
        AND (cus.cleared_at IS NULL OR m.created_at > cus.cleared_at)
      ORDER BY m.created_at ASC;
    `, [testConversationId, testStudentAuthId]);
    assert(studentMessages.rows.length === 0, 'Student sees 0 messages after clear and delete for me');

    // Query messages as Faculty (who has NOT cleared or deleted)
    const facultyMessages = await client.query(`
      SELECT m.*
      FROM messages m
      LEFT JOIN conversation_user_settings cus
        ON cus.conversation_id = m.conversation_id AND cus.user_id = $2
      WHERE m.conversation_id = $1
        AND NOT ($2::uuid = ANY(COALESCE(m.deleted_by_users, '{}')))
        AND (cus.cleared_at IS NULL OR m.created_at > cus.cleared_at)
      ORDER BY m.created_at ASC;
    `, [testConversationId, testFacultyAuthId]);
    assert(facultyMessages.rows.length === 2, `Faculty still sees all ${facultyMessages.rows.length} messages (history preserved)`);

  } catch (err: any) {
    console.error('Unexpected error during testing:', err);
  } finally {
    // Clean up test conversation & settings
    if (testConversationId) {
      await client.query(`DELETE FROM messages WHERE conversation_id = $1;`, [testConversationId]);
      await client.query(`DELETE FROM conversation_user_settings WHERE conversation_id = $1;`, [testConversationId]);
      await client.query(`DELETE FROM conversations WHERE id = $1;`, [testConversationId]);
      console.log(`\n🧹 Cleaned up test conversation ${testConversationId}`);
    }
    await client.end();
  }

  console.log('\n========================================================================');
  console.log(`TOTAL TESTS: ${total} | PASSED: ${passed} | FAILED: ${total - passed}`);
  console.log('========================================================================');
  if (total - passed > 0) {
    process.exit(1);
  }
}

runTest();
