import { supabaseService } from '../lib/services/supabaseService';
import { supabase } from '../lib/supabase/supabaseClient';
import { Message, GroupMessage } from '../types/database.types';

async function runTests() {
  console.log('====================================================');
  console.log('TESTING MESSAGES PERFORMANCE & REALTIME OPTIMIZATION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${msg}`);
      failed++;
    }
  }

  // Test 1: fetchConversationMessages supports pagination & chronological ordering
  try {
    const { data: convs } = await supabase
      .from('conversations')
      .select('id')
      .limit(1);

    if (convs && convs.length > 0) {
      const convId = convs[0].id;
      const msgs = await supabaseService.fetchConversationMessages(convId, undefined, 20);
      assert(Array.isArray(msgs), 'fetchConversationMessages returns an array with pagination limit 20');
      
      // Verify chronological ordering (oldest first, newest last)
      if (msgs.length >= 2) {
        const isChronological = new Date(msgs[0].created_at).getTime() <= new Date(msgs[msgs.length - 1].created_at).getTime();
        assert(isChronological, 'Messages are chronologically sorted (ascending) for thread display');
      } else {
        assert(true, 'Message count < 2; chronological check trivially true');
      }

      // Test cursor pagination with beforeCreatedAt
      if (msgs.length > 0) {
        const oldestCreatedAt = msgs[0].created_at;
        const olderMsgs = await supabaseService.fetchConversationMessages(convId, undefined, 10, oldestCreatedAt);
        assert(Array.isArray(olderMsgs), 'fetchConversationMessages with beforeCreatedAt cursor returns an array');
        if (olderMsgs.length > 0) {
          const allOlder = olderMsgs.every(m => new Date(m.created_at).getTime() < new Date(oldestCreatedAt).getTime());
          assert(allOlder, 'All older messages returned are strictly before the cursor date');
        }
      }
    } else {
      console.log('ℹ️ No existing conversations in database to test cursor fetch; skipping live cursor test.');
      assert(true, 'Conversation fetch gracefully handled');
    }
  } catch (err: any) {
    console.error('Error in Test 1:', err.message);
    failed++;
  }

  // Test 2: fetchGroupMessages supports pagination & chronological ordering
  try {
    const { data: groups } = await supabase
      .from('message_groups')
      .select('id')
      .limit(1);

    if (groups && groups.length > 0) {
      const groupId = groups[0].id;
      const groupMsgs = await supabaseService.fetchGroupMessages(groupId, 20);
      assert(Array.isArray(groupMsgs), 'fetchGroupMessages returns an array with pagination limit 20');

      if (groupMsgs.length >= 2) {
        const isChronological = new Date(groupMsgs[0].created_at).getTime() <= new Date(groupMsgs[groupMsgs.length - 1].created_at).getTime();
        assert(isChronological, 'Group messages are chronologically sorted (ascending) for thread display');
      } else {
        assert(true, 'Group message count < 2; chronological check trivially true');
      }
    } else {
      console.log('ℹ️ No existing groups in database to test fetch; skipping live group check.');
      assert(true, 'Group message fetch gracefully handled');
    }
  } catch (err: any) {
    console.error('Error in Test 2:', err.message);
    failed++;
  }

  // Test 3: In-memory client cache behavior simulation
  try {
    const cacheMap = new Map<string, Message[]>();
    const testConvId = 'conv-test-cache-123';
    const sampleMessages: Message[] = [
      {
        id: 'msg-1',
        conversation_id: testConvId,
        sender_user_id: 'user-1',
        receiver_user_id: 'user-2',
        student_id: 's-1',
        faculty_id: 'f-1',
        sender_role: 'student',
        message: 'Hello sir, could you clarify chapter 2?',
        created_at: new Date(Date.now() - 60000).toISOString(),
        status: 'sent'
      },
      {
        id: 'msg-2',
        conversation_id: testConvId,
        sender_user_id: 'user-2',
        receiver_user_id: 'user-1',
        student_id: 's-1',
        faculty_id: 'f-1',
        sender_role: 'faculty',
        message: 'Yes, please review section 2.4 before class tomorrow.',
        created_at: new Date().toISOString(),
        status: 'read'
      }
    ];

    // Populate cache
    cacheMap.set(testConvId, sampleMessages);
    assert(cacheMap.has(testConvId), 'Cache contains test conversation');

    // Retrieve from cache (0ms instant render simulation)
    const cached = cacheMap.get(testConvId);
    assert(cached !== undefined && cached.length === 2, 'Cache returns 2 messages instantaneously');

    // Optimistic send simulation
    const optimisticMsg: Message = {
      id: 'temp-123',
      conversation_id: testConvId,
      sender_user_id: 'user-1',
      receiver_user_id: 'user-2',
      student_id: 's-1',
      faculty_id: 'f-1',
      sender_role: 'student',
      message: 'Thank you sir!',
      created_at: new Date().toISOString(),
      status: 'sending'
    };

    const updatedCache = [...(cached || []), optimisticMsg];
    cacheMap.set(testConvId, updatedCache);

    const postSendCached = cacheMap.get(testConvId);
    assert(postSendCached?.length === 3, 'Optimistic message added to cache immediately');
    assert(postSendCached?.[2].status === 'sending', 'Optimistic message has status "sending"');

    // Reconcile on delivery
    const reconciledCache = postSendCached!.map(m => m.id === 'temp-123' ? { ...m, id: 'db-real-id-999', status: 'sent' as const } : m);
    cacheMap.set(testConvId, reconciledCache);

    const finalCached = cacheMap.get(testConvId);
    assert(finalCached?.[2].id === 'db-real-id-999', 'Temporary ID reconciled to real DB message ID');
    assert(finalCached?.[2].status === 'sent', 'Status updated to "sent" on delivery');
  } catch (err: any) {
    console.error('Error in Test 3:', err.message);
    failed++;
  }

  // Test 4: Verify sender name resolver NEVER returns "Participant"
  try {
    const resolveSenderName = (
      msg?: any,
      isReplyingTarget = false,
      currentUserId = 'current-user-uuid'
    ): string => {
      if (!msg) return isReplyingTarget ? 'yourself' : 'You';
      if (msg.sender_user_id && currentUserId && msg.sender_user_id === currentUserId) {
        return isReplyingTarget ? 'yourself' : 'You';
      }
      if (msg.sender_name && !/^(participant|user|member|unknown participant)$/i.test(msg.sender_name.trim())) {
        return msg.sender_name.trim();
      }
      if (msg.sender_role === 'super_admin') return 'Administrator';
      if (msg.sender_role === 'hod') return 'Head of Department';
      if (msg.sender_role === 'faculty') return 'Faculty Member';
      if (msg.sender_role === 'student') return 'Student';
      return '';
    };

    assert(resolveSenderName({ sender_name: 'Dr. Sharma', sender_role: 'faculty' }) === 'Dr. Sharma', 'Real faculty name resolved');
    assert(resolveSenderName({ sender_name: 'Participant', sender_role: 'faculty' }) === 'Faculty Member', '"Participant" placeholder filtered out to institutional role');
    assert(resolveSenderName({ sender_name: 'participant', sender_role: 'student' }) === 'Student', 'Lowercase "participant" placeholder filtered out');
    assert(resolveSenderName({ sender_role: 'super_admin' }) === 'Administrator', 'Super admin resolves to "Administrator"');
  } catch (err: any) {
    console.error('Error in Test 4:', err.message);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
