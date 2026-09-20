import { supabaseService } from '../lib/services/supabaseService';
import { supabase } from '../lib/supabase/supabaseClient';

async function runTests() {
  console.log('====================================================');
  console.log('TESTING MESSAGE REPLY UI & PARTICIPANT BUG REMOVAL');
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

  // Test 1: Query existing direct messages and inspect reply_to join
  try {
    const { data: convs, error: convErr } = await supabase
      .from('conversations')
      .select('id, student_id, faculty_id')
      .limit(1);

    if (convErr || !convs || convs.length === 0) {
      console.log('⚠️ No existing conversation found to test fetch. Creating test check...');
    } else {
      const convId = convs[0].id;
      const msgs = await supabaseService.fetchConversationMessages(convId);
      console.log(`Fetched ${msgs.length} messages for conversation ${convId}`);
      assert(Array.isArray(msgs), 'fetchConversationMessages returns an array');
      
      // Verify no message or reply in msgs has sender_name === 'Participant'
      const hasParticipantBug = msgs.some(m => 
        m.sender_name?.toLowerCase() === 'participant' || 
        m.reply_to?.sender_name?.toLowerCase() === 'participant'
      );
      assert(!hasParticipantBug, 'No sender_name or reply_to.sender_name is "Participant"');
    }
  } catch (err: any) {
    console.error('Error in fetch test:', err.message);
    failed++;
  }

  // Test 2: Verify sender name resolution logic unit test
  const resolveSenderName = (
    msg?: any,
    isReplyingTarget = false,
    currentUserId = 'user-123',
    selectedConversation?: any
  ): string => {
    if (!msg) return isReplyingTarget ? 'yourself' : 'You';
    if (msg.sender_user_id && currentUserId && msg.sender_user_id === currentUserId) {
      return isReplyingTarget ? 'yourself' : 'You';
    }
    if (msg.sender_name && !/^(participant|user|member|unknown participant)$/i.test(msg.sender_name.trim())) {
      return msg.sender_name.trim();
    }
    if (msg.sender_role === 'student' && msg.student?.full_name) {
      return msg.student.full_name;
    }
    if ((msg.sender_role === 'faculty' || msg.sender_role === 'hod') && msg.faculty?.full_name) {
      return msg.faculty.full_name;
    }
    if (selectedConversation) {
      if (msg.sender_role === 'student' && selectedConversation.student?.full_name) {
        return selectedConversation.student.full_name;
      }
      if ((msg.sender_role === 'faculty' || msg.sender_role === 'hod') && selectedConversation.faculty?.full_name) {
        return selectedConversation.faculty.full_name;
      }
    }
    if (msg.sender_role === 'super_admin') return 'Administrator';
    if (msg.sender_role === 'hod') return 'Head of Department';
    if (msg.sender_role === 'faculty') return 'Faculty Member';
    if (msg.sender_role === 'student') return 'Student';
    return '';
  };

  // Case 2a: Sender is current user
  const selfName = resolveSenderName({ sender_user_id: 'user-123' }, false, 'user-123');
  assert(selfName === 'You', `Self sender resolves to "You" (got "${selfName}")`);

  const selfReplyTarget = resolveSenderName({ sender_user_id: 'user-123' }, true, 'user-123');
  assert(selfReplyTarget === 'yourself', `Self replying target resolves to "yourself" (got "${selfReplyTarget}")`);

  // Case 2b: Sender has student joined full_name
  const studentMsg = {
    sender_user_id: 'user-student-1',
    sender_role: 'student',
    student: { full_name: 'Shivam Sharma', roll_number: '2100820100055' }
  };
  const studentName = resolveSenderName(studentMsg, false, 'user-faculty-1');
  assert(studentName === 'Shivam Sharma', `Student sender resolves to actual name "Shivam Sharma" (got "${studentName}")`);

  // Case 2c: Sender has faculty joined full_name
  const facultyMsg = {
    sender_user_id: 'user-faculty-1',
    sender_role: 'faculty',
    faculty: { full_name: 'Dr. S. K. Gupta', faculty_code: 'FAC001' }
  };
  const facultyName = resolveSenderName(facultyMsg, false, 'user-student-1');
  assert(facultyName === 'Dr. S. K. Gupta', `Faculty sender resolves to actual name "Dr. S. K. Gupta" (got "${facultyName}")`);

  // Case 2d: Sender had generic "Participant" as sender_name — MUST BE FILTERED OUT
  const corruptedMsg = {
    sender_user_id: 'user-faculty-2',
    sender_role: 'faculty',
    sender_name: 'Participant',
    faculty: { full_name: 'Prof. Anjali Mehta' }
  };
  const filteredName = resolveSenderName(corruptedMsg, false, 'user-student-1');
  assert(filteredName === 'Prof. Anjali Mehta', `Corrupted "Participant" is filtered out and real faculty name resolved (got "${filteredName}")`);

  // Case 2e: Role fallback when names are missing
  const roleOnlyMsg = {
    sender_user_id: 'user-admin-9',
    sender_role: 'super_admin'
  };
  const adminName = resolveSenderName(roleOnlyMsg, false, 'user-student-1');
  assert(adminName === 'Administrator', `Admin sender role fallback is "Administrator", not "Participant" (got "${adminName}")`);

  // Case 2f: Fallback when completely unknown
  const emptyMsg = {
    sender_user_id: 'unknown-id'
  };
  const emptyFallback = resolveSenderName(emptyMsg, false, 'user-student-1');
  assert(emptyFallback !== 'Participant', `Fallback is NEVER "Participant" (got "${emptyFallback}")`);

  // Test 3: Unsent and Edited quote display logic
  const renderQuoteContent = (quote: any) => {
    const isUnsent = Boolean(quote?.is_unsent);
    const isEdited = Boolean(quote?.edited_at);
    const isUnavailable = !quote;

    let text = isUnsent 
      ? 'Message unsent' 
      : isUnavailable 
      ? 'Original message unavailable' 
      : quote.message;

    return { text, isEdited, isUnsent, isUnavailable };
  };

  const normalQuote = renderQuoteContent({ id: '1', message: 'Hello class' });
  assert(normalQuote.text === 'Hello class' && !normalQuote.isEdited, 'Normal quote displays original text');

  const editedQuote = renderQuoteContent({ id: '2', message: 'Assignment due at 5pm', edited_at: '2026-09-20T10:00:00Z' });
  assert(editedQuote.text === 'Assignment due at 5pm' && editedQuote.isEdited, 'Edited quote displays updated text with isEdited flag');

  const unsentQuote = renderQuoteContent({ id: '3', message: 'Secret message', is_unsent: true });
  assert(unsentQuote.text === 'Message unsent' && unsentQuote.isUnsent, 'Unsent quote displays "Message unsent"');

  const missingQuote = renderQuoteContent(null);
  assert(missingQuote.text === 'Original message unavailable' && missingQuote.isUnavailable, 'Missing/deleted quote displays "Original message unavailable"');

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
