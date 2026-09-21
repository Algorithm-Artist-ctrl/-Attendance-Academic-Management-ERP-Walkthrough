if (!process.env.DATABASE_URL && (process as any).loadEnvFile) {
  try { (process as any).loadEnvFile(); } catch {}
}
import pg from 'pg';

const connectionString = process.env.DATABASE_URL || '';

async function runTests() {
  console.log('🧪 Starting Group Messages Architecture Verification Tests...');
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  await client.connect();
  console.log('✅ Connected to database.');

  try {
    // 1. Pick an existing group to test with
    const groupRes = await client.query(`
      SELECT id, academic_year_id, section_id 
      FROM message_groups 
      LIMIT 1;
    `);

    if (groupRes.rows.length === 0) {
      throw new Error('No message group found in database to test.');
    }

    const testGroup = groupRes.rows[0];
    console.log(`📁 Using test group: ${testGroup.id}`);

    // Pick an existing user as sender
    const userRes = await client.query(`
      SELECT id, role, full_name 
      FROM profiles 
      WHERE role IN ('faculty', 'hod', 'super_admin') 
      LIMIT 1;
    `);
    const testUser = userRes.rows[0] || { id: '00000000-0000-0000-0000-000000000001', role: 'faculty', full_name: 'Test Faculty' };
    console.log(`👤 Using test sender: ${testUser.id} (${testUser.full_name}, ${testUser.role})`);

    const clientMsgId = `test-client-${Date.now()}`;
    const testMessageText = `E2E Automated Test Announcement ${Date.now()}`;
    const testTitle = 'Automated Verification Title';

    // Set authenticated user context session-wide
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [testUser.id]);

    // TEST 1: Send group message via RPC with client_message_id
    console.log('\n--- TEST 1: send_group_message RPC with client_message_id ---');
    const sendRes = await client.query(`
      SELECT send_group_message(
        p_academic_year_id := $1::uuid,
        p_section_id := $2::uuid,
        p_subject_id := NULL::uuid,
        p_message := $3::text,
        p_title := $4::text,
        p_attachment_url := NULL::text,
        p_attachment_name := NULL::text,
        p_attachment_type := NULL::text,
        p_attachment_size := NULL::integer,
        p_allow_student_replies := NULL::boolean,
        p_reply_to_message_id := NULL::uuid,
        p_client_message_id := $5::text
      ) AS result;
    `, [testGroup.academic_year_id, testGroup.section_id, testMessageText, testTitle, clientMsgId]);

    const sentMessageId = sendRes.rows[0].result.id;
    console.log(`✅ Sent message ID: ${sentMessageId}`);

    // Verify row in group_messages
    const msgCheck = await client.query(`
      SELECT id, group_id, message, title, client_message_id, is_deleted, created_at 
      FROM group_messages 
      WHERE id = $1;
    `, [sentMessageId]);

    if (msgCheck.rows.length === 0) throw new Error('Sent message not found in database!');
    const insertedRow = msgCheck.rows[0];
    console.log(`✅ Verified database persistence: "${insertedRow.message}" with client_token: "${insertedRow.client_message_id}"`);

    // TEST 2: Test Idempotency with same client_message_id
    console.log('\n--- TEST 2: Idempotency with Duplicate client_message_id ---');
    const dupRes = await client.query(`
      SELECT send_group_message(
        p_academic_year_id := $1::uuid,
        p_section_id := $2::uuid,
        p_subject_id := NULL::uuid,
        p_message := $3::text,
        p_title := $4::text,
        p_attachment_url := NULL::text,
        p_attachment_name := NULL::text,
        p_attachment_type := NULL::text,
        p_attachment_size := NULL::integer,
        p_allow_student_replies := NULL::boolean,
        p_reply_to_message_id := NULL::uuid,
        p_client_message_id := $5::text
      ) AS result;
    `, [testGroup.academic_year_id, testGroup.section_id, testMessageText, testTitle, clientMsgId]);

    if (dupRes.rows[0].result.id !== sentMessageId) {
      throw new Error(`Idempotency failed: expected ${sentMessageId}, got ${dupRes.rows[0].result.id}`);
    }
    console.log(`✅ Idempotency passed: returned identical row ID without duplicate insertion.`);

    // TEST 3: Edit group message
    console.log('\n--- TEST 3: edit_group_message RPC ---');
    const updatedText = `${testMessageText} [EDITED VERSION]`;
    const updatedTitle = `${testTitle} [UPDATED]`;
    const editRes = await client.query(`
      SELECT edit_group_message(
        p_message_id := $1::uuid,
        p_new_content := $2::text,
        p_new_title := $3::text
      ) AS result;
    `, [sentMessageId, updatedText, updatedTitle]);

    if (!editRes.rows[0].result) throw new Error('edit_group_message failed!');

    const editedCheck = await client.query(`
      SELECT message, title, edited_at FROM group_messages WHERE id = $1;
    `, [sentMessageId]);
    if (editedCheck.rows[0].message !== updatedText || !editedCheck.rows[0].edited_at) {
      throw new Error('Edited message text or edited_at not recorded properly!');
    }
    console.log(`✅ Edit passed: message updated to "${editedCheck.rows[0].message}", edited_at="${editedCheck.rows[0].edited_at}"`);

    // TEST 4: Send Reply Message
    console.log('\n--- TEST 4: reply_to_message_id in send_group_message ---');
    const replyText = 'This is a reply to the announcement';
    const replyRes = await client.query(`
      SELECT send_group_message(
        p_academic_year_id := $1::uuid,
        p_section_id := $2::uuid,
        p_subject_id := NULL::uuid,
        p_message := $3::text,
        p_title := NULL::text,
        p_attachment_url := NULL::text,
        p_attachment_name := NULL::text,
        p_attachment_type := NULL::text,
        p_attachment_size := NULL::integer,
        p_allow_student_replies := NULL::boolean,
        p_reply_to_message_id := $4::uuid,
        p_client_message_id := NULL::text
      ) AS result;
    `, [testGroup.academic_year_id, testGroup.section_id, replyText, sentMessageId]);

    const replyMsgId = replyRes.rows[0].result.id;
    const replyCheck = await client.query(`
      SELECT id, message, reply_to_message_id FROM group_messages WHERE id = $1;
    `, [replyMsgId]);
    if (replyCheck.rows[0].reply_to_message_id !== sentMessageId) {
      throw new Error('Reply message did not link to parent message properly!');
    }
    console.log(`✅ Reply passed: child message ${replyMsgId} linked to parent ${sentMessageId}`);

    // TEST 5: Delete for Me
    console.log('\n--- TEST 5: delete_group_message_for_me RPC ---');
    const deleteForMeRes = await client.query(`
      SELECT delete_group_message_for_me(
        p_message_id := $1::uuid
      ) AS success;
    `, [replyMsgId]);

    if (!deleteForMeRes.rows[0].success) throw new Error('delete_group_message_for_me failed!');

    const delCheck = await client.query(`
      SELECT deleted_by_users FROM group_messages WHERE id = $1;
    `, [replyMsgId]);
    if (!delCheck.rows[0].deleted_by_users || !delCheck.rows[0].deleted_by_users.includes(testUser.id)) {
      throw new Error('User ID not added to deleted_by_users array!');
    }
    console.log(`✅ Delete for me passed: user ID present in deleted_by_users.`);

    // TEST 6: Clear Group Chat For Me
    console.log('\n--- TEST 6: clear_group_chat_for_me RPC ---');
    const clearRes = await client.query(`
      SELECT clear_group_chat_for_me(
        p_group_id := $1::uuid
      ) AS success;
    `, [testGroup.id]);

    if (!clearRes.rows[0].success) throw new Error('clear_group_chat_for_me failed!');

    const memberCheck = await client.query(`
      SELECT cleared_at FROM group_member_read_state WHERE group_id = $1 AND user_id = $2;
    `, [testGroup.id, testUser.id]);
    if (!memberCheck.rows[0]?.cleared_at) {
      throw new Error('cleared_at was not set in group_member_read_state!');
    }
    console.log(`✅ Clear chat passed: cleared_at recorded as "${memberCheck.rows[0].cleared_at}"`);

    // TEST 7: Soft Delete For Everyone
    console.log('\n--- TEST 7: delete_group_message RPC (Soft Delete) ---');
    const softDelRes = await client.query(`
      SELECT delete_group_message(
        p_message_id := $1::uuid
      ) AS result;
    `, [sentMessageId]);

    if (!softDelRes.rows[0].result) throw new Error('delete_group_message failed!');

    const softDelCheck = await client.query(`
      SELECT is_deleted, deleted_at, message FROM group_messages WHERE id = $1;
    `, [sentMessageId]);
    if (!softDelCheck.rows[0].is_deleted || !softDelCheck.rows[0].deleted_at) {
      throw new Error('Soft delete flags not set!');
    }
    console.log(`✅ Soft delete passed: is_deleted=${softDelCheck.rows[0].is_deleted}, deleted_at=${softDelCheck.rows[0].deleted_at}`);

    // Cleanup test rows
    console.log('\n--- CLEANUP ---');
    await client.query(`
      DELETE FROM group_messages WHERE id IN ($1, $2);
    `, [sentMessageId, replyMsgId]);
    console.log('✅ Cleaned up test messages.');

    console.log('\n🎉 ALL 7 GROUP MESSAGING VERIFICATION TESTS PASSED SUCCESSFULLY!\n');
  } finally {
    await client.end();
  }
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
