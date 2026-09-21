if (!process.env.DATABASE_URL && (process as any).loadEnvFile) {
  try { (process as any).loadEnvFile(); } catch {}
}
import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL || '';

async function runE2EVerification() {
  console.log('========================================================================');
  console.log('VCTM ERP: COMMUNICATION CENTER / MESSAGE BOX E2E INTEGRATION SUITE');
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

  let testConversationId: string | null = null;
  let testStudentId: string | null = null;
  let testFacultyId: string | null = null;
  let testSubjectId: string | null = null;
  let testStudentAuthId: string | null = null;
  let testFacultyAuthId: string | null = null;

  try {
    // -------------------------------------------------------------
    // SUITE 1: Direct Database & Schema Verification
    // -------------------------------------------------------------
    console.log('--- SUITE 1: Database Tables, RLS, Indexes & Realtime ---');

    // 1.1 Check conversations table
    const convColsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'conversations'
      ORDER BY ordinal_position;
    `);
    assert(convColsRes.rows.length >= 10, `conversations table exists with ${convColsRes.rows.length} columns`);

    // 1.2 Check messages table
    const msgColsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'messages'
      ORDER BY ordinal_position;
    `);
    assert(msgColsRes.rows.length >= 12, `messages table exists with ${msgColsRes.rows.length} columns`);

    // 1.3 Check RLS enabled on both tables
    const rlsRes = await client.query(`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public' AND tablename IN ('conversations', 'messages')
      ORDER BY tablename;
    `);
    assert(
      rlsRes.rows.length === 2 && rlsRes.rows.every(r => r.rowsecurity === true),
      'Both conversations and messages tables have Row Level Security (RLS) enabled'
    );

    // 1.4 Check publication includes both tables
    const pubRes = await client.query(`
      SELECT tablename 
      FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename IN ('conversations', 'messages')
      ORDER BY tablename;
    `);
    assert(
      pubRes.rows.length === 2,
      'Both conversations and messages tables are added to supabase_realtime publication'
    );

    // 1.5 Check Security Definer RPC Functions
    const procRes = await client.query(`
      SELECT proname, prosecdef 
      FROM pg_proc 
      WHERE proname IN (
        'get_or_create_conversation',
        'send_message',
        'mark_conversation_read',
        'update_conversation_status'
      )
      ORDER BY proname;
    `);
    assert(
      procRes.rows.length === 4 && procRes.rows.every(r => r.prosecdef === true),
      'All 4 communication RPC functions exist and are configured as SECURITY DEFINER'
    );

    // 1.6 Check notifications constraint includes NEW_MESSAGE and ISSUE_STATUS_UPDATE
    const notifCheckRes = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE conrelid = 'public.notifications'::regclass AND contype = 'c';
    `);
    const checkDef = notifCheckRes.rows.map(r => r.def).join(' ');
    assert(
      checkDef.includes('NEW_MESSAGE') && checkDef.includes('ISSUE_STATUS_UPDATE'),
      'notifications table constraint supports NEW_MESSAGE and ISSUE_STATUS_UPDATE types'
    );

    // -------------------------------------------------------------
    // SUITE 2: Relational Scoping & Eligible Faculty/Student Resolution
    // -------------------------------------------------------------
    console.log('\n--- SUITE 2: Relational Scoping & Eligibility Queries ---');

    // Find a real student from 3rd Year Section A
    const studentRes = await client.query(`
      SELECT s.id, s.roll_number, s.full_name, s.section_id, s.academic_year_id, s.auth_user_id, p.id as profile_user_id
      FROM public.students s
      LEFT JOIN public.profiles p ON p.student_id = s.id
      WHERE s.roll_number = '2403400100005' OR s.section_id IN (
        SELECT sec.id FROM public.sections sec 
        JOIN public.semesters sem ON sem.id = sec.semester_id
        JOIN public.academic_years ay ON ay.id = sem.academic_year_id
        WHERE ay.year_number = 3
      )
      LIMIT 1;
    `);

    assert(studentRes.rows.length > 0, 'Found real active 3rd Year student for communication test');
    const stuRow = studentRes.rows[0];
    testStudentId = stuRow.id;
    testStudentAuthId = stuRow.profile_user_id || stuRow.auth_user_id;

    console.log(`   Student: ${stuRow.full_name} (${stuRow.roll_number}), ID: ${testStudentId}`);

    // Query eligible faculty for this student using service method
    const eligibleFaculty = await supabaseService.fetchEligibleFacultyForStudent(testStudentId);
    assert(eligibleFaculty.length > 0, `fetchEligibleFacultyForStudent returned ${eligibleFaculty.length} assigned faculties`);

    const firstEligible = eligibleFaculty[0];
    testFacultyId = firstEligible.faculty_id;
    testSubjectId = firstEligible.subject_id;
    console.log(`   Assigned Faculty: ${firstEligible.faculty_name} (${firstEligible.faculty_designation})`);
    console.log(`   Subject: ${firstEligible.subject_name} (${firstEligible.subject_code})`);

    // Verify faculty's user id
    const facRes = await client.query(`
      SELECT f.id, f.full_name, f.auth_user_id, p.id as profile_user_id
      FROM public.faculty f
      LEFT JOIN public.profiles p ON p.faculty_id = f.id
      WHERE f.id = $1;
    `, [testFacultyId]);
    testFacultyAuthId = facRes.rows[0]?.profile_user_id || facRes.rows[0]?.auth_user_id;

    // Test eligible students for this faculty
    const eligibleStudents = await supabaseService.fetchEligibleStudentsForFaculty(testFacultyId);
    assert(eligibleStudents.length > 0, `fetchEligibleStudentsForFaculty returned ${eligibleStudents.length} students`);
    const containsStudent = eligibleStudents.some(s => s.student_id === testStudentId);
    assert(containsStudent, `Faculty's eligible student list includes student ${stuRow.roll_number}`);

    // -------------------------------------------------------------
    // SUITE 3: Conversation Creation & Message Flow
    // -------------------------------------------------------------
    console.log('\n--- SUITE 3: Conversation Creation & Message Flow ---');

    // Clean up any pre-existing test conversation between this student and faculty for this subject
    await client.query(`
      DELETE FROM public.conversations 
      WHERE student_id = $1 AND faculty_id = $2 AND subject_id = $3;
    `, [testStudentId, testFacultyId, testSubjectId]);

    // Set student auth context (session-level)
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [testStudentAuthId]);
    await client.query(`SELECT set_config('role', 'authenticated', false);`);

    // Create conversation using PostgreSQL function with student auth identity
    const createConvRes = await client.query(`
      SELECT public.get_or_create_conversation(
        $1::uuid,
        $2::uuid,
        'Attendance',
        'Discrepancy in Attendance for Lecture 3'
      ) as conv_data;
    `, [testFacultyId, testSubjectId]);

    const convData = createConvRes.rows[0]?.conv_data;
    assert(Boolean(convData && convData.id), 'get_or_create_conversation successfully created conversation');
    testConversationId = convData.id;
    assert(convData.status === 'OPEN', 'Initial conversation status is OPEN');
    assert(convData.category === 'Attendance', 'Conversation category preserved as Attendance');

    // Send initial message from student
    const sendMsgRes = await client.query(`
      SELECT public.send_message(
        $1::uuid,
        'Good morning Sir, I was present in class yesterday but my attendance shows unmarked.',
        NULL,
        NULL,
        NULL,
        NULL
      ) as msg_data;
    `, [testConversationId]);

    const msgData = sendMsgRes.rows[0]?.msg_data;
    assert(Boolean(msgData && msgData.id), 'send_message created new message record');
    assert(msgData.sender_role === 'student', 'Message sender_role set to student');
    assert(msgData.receiver_user_id === testFacultyAuthId, 'Message receiver_user_id correctly routes to faculty auth user ID');

    // Verify conversation last_message_at and preview updated
    const convAfterMsgRes = await client.query(`
      SELECT last_message_preview, last_message_at, status 
      FROM public.conversations 
      WHERE id = $1;
    `, [testConversationId]);
    assert(
      convAfterMsgRes.rows[0]?.last_message_preview?.includes('Good morning Sir'),
      'Conversation last_message_preview updated with sent text'
    );

    // Verify notification was created for faculty (reset role so superuser can query all notifications)
    await client.query('RESET ROLE;');
    const notifFacRes = await client.query(`
      SELECT * FROM public.notifications 
      WHERE recipient_user_id = $1 
        AND reference_type = 'conversation' 
        AND reference_id = $2
      ORDER BY created_at DESC 
      LIMIT 1;
    `, [testFacultyAuthId, testConversationId]);
    assert(notifFacRes.rows.length > 0, 'Notification generated for faculty upon receiving student message');
    assert(notifFacRes.rows[0]?.type === 'NEW_MESSAGE', 'Notification type is NEW_MESSAGE');

    // -------------------------------------------------------------
    // SUITE 4: Faculty Reply & Automatic Status Transition
    // -------------------------------------------------------------
    console.log('\n--- SUITE 4: Faculty Reply & Auto Status Transition ---');

    // Simulate faculty auth context
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [testFacultyAuthId]);
    await client.query(`SELECT set_config('role', 'authenticated', false);`);

    const facReplyRes = await client.query(`
      SELECT public.send_message(
        $1::uuid,
        'Hello, I will review the lecture attendance sheet and update it shortly.',
        NULL,
        NULL,
        NULL,
        NULL
      ) as msg_data;
    `, [testConversationId]);

    const facReplyData = facReplyRes.rows[0]?.msg_data;
    assert(Boolean(facReplyData && facReplyData.id), 'Faculty reply message created successfully');
    assert(facReplyData.sender_role === 'faculty', 'Faculty message sender_role set to faculty');

    // Verify conversation automatically transitioned from OPEN -> IN_PROGRESS
    const convAfterReplyRes = await client.query(`
      SELECT status FROM public.conversations WHERE id = $1;
    `, [testConversationId]);
    assert(
      convAfterReplyRes.rows[0]?.status === 'IN_PROGRESS',
      'Conversation status automatically transitioned from OPEN -> IN_PROGRESS upon faculty response'
    );

    // Verify student received notification of faculty reply (reset role to bypass student RLS)
    await client.query('RESET ROLE;');
    const notifStuRes = await client.query(`
      SELECT * FROM public.notifications 
      WHERE recipient_user_id = $1 
        AND reference_type = 'conversation' 
        AND reference_id = $2
      ORDER BY created_at DESC 
      LIMIT 1;
    `, [testStudentAuthId, testConversationId]);
    assert(notifStuRes.rows.length > 0, 'Notification generated for student upon faculty reply');

    // -------------------------------------------------------------
    // SUITE 5: Read Receipts & Status Lifecycle Resolution
    // -------------------------------------------------------------
    console.log('\n--- SUITE 5: Read Receipts & Issue Resolution ---');

    // Simulate student reading the conversation
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [testStudentAuthId]);
    await client.query(`SELECT set_config('role', 'authenticated', false);`);

    await client.query(`SELECT public.mark_conversation_read($1::uuid);`, [testConversationId]);

    // Check message read_at
    const readMsgRes = await client.query(`
      SELECT id, read_at 
      FROM public.messages 
      WHERE conversation_id = $1 AND receiver_user_id = $2;
    `, [testConversationId, testStudentAuthId]);
    assert(
      readMsgRes.rows.length > 0 && readMsgRes.rows.every(m => m.read_at !== null),
      'mark_conversation_read stamped non-null read_at timestamp on student received messages'
    );

    // Check notification is_read
    const notifReadRes = await client.query(`
      SELECT is_read 
      FROM public.notifications 
      WHERE recipient_user_id = $1 AND reference_type = 'conversation' AND reference_id = $2;
    `, [testStudentAuthId, testConversationId]);
    assert(
      notifReadRes.rows.length > 0 && notifReadRes.rows.every(n => n.is_read === true),
      'mark_conversation_read marked student notifications as read'
    );

    // Faculty marks issue as RESOLVED
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [testFacultyAuthId]);
    await client.query(`SELECT set_config('role', 'authenticated', false);`);

    const updateStatusRes = await client.query(`
      SELECT public.update_conversation_status($1::uuid, 'RESOLVED') as status_data;
    `, [testConversationId]);
    assert(
      updateStatusRes.rows[0]?.status_data?.status === 'RESOLVED',
      'Faculty updated conversation status to RESOLVED'
    );

    // Verify ISSUE_STATUS_UPDATE notification generated for student (reset role)
    await client.query('RESET ROLE;');
    const notifResolvedRes = await client.query(`
      SELECT * FROM public.notifications 
      WHERE recipient_user_id = $1 
        AND reference_type = 'conversation' 
        AND reference_id = $2
        AND type = 'ISSUE_STATUS_UPDATE'
      ORDER BY created_at DESC 
      LIMIT 1;
    `, [testStudentAuthId, testConversationId]);
    assert(notifResolvedRes.rows.length > 0, 'Notification generated with type ISSUE_STATUS_UPDATE for student');

    // -------------------------------------------------------------
    // SUITE 6: Relational Enforcement & Authorization Rejection
    // -------------------------------------------------------------
    console.log('\n--- SUITE 6: Authorization & Relational Enforcement ---');

    // Find a faculty who does NOT teach this student's section/subject
    const unassignedFacRes = await client.query(`
      SELECT f.id, f.full_name, p.id as profile_user_id
      FROM public.faculty f
      LEFT JOIN public.profiles p ON p.faculty_id = f.id
      WHERE NOT EXISTS (
        SELECT 1 FROM public.faculty_subject_assignments fsa 
        WHERE fsa.faculty_id = f.id AND fsa.section_id = $1
      ) AND NOT EXISTS (
        SELECT 1 FROM public.timetable_entries te 
        WHERE te.faculty_id = f.id AND te.section_id = $1
      )
      LIMIT 1;
    `, [stuRow.section_id]);

    if (unassignedFacRes.rows.length > 0) {
      const unassignedFacId = unassignedFacRes.rows[0].id;
      // Set student auth context
      await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [testStudentAuthId]);
      await client.query(`SELECT set_config('role', 'authenticated', false);`);

      let errorThrown = false;
      try {
        await client.query(`
          SELECT public.get_or_create_conversation(
            $1::uuid,
            $2::uuid,
            'General',
            'Unauthorized message'
          );
        `, [unassignedFacId, testSubjectId]);
      } catch (authErr: any) {
        errorThrown = true;
        assert(
          authErr.message.includes('only message faculty who are assigned') || authErr.message.includes('assigned to teach'),
          'get_or_create_conversation rejected messaging unassigned faculty with clear security error'
        );
      }
      if (!errorThrown) {
        assert(false, 'Expected authorization rejection for unassigned faculty was not thrown');
      }
    } else {
      console.log('   (Skipping unassigned faculty test: all available faculty are assigned to this section)');
    }

    // -------------------------------------------------------------
    // SUITE 7: Cleanup
    // -------------------------------------------------------------
    console.log('\n--- SUITE 7: Test Data Cleanup ---');
    if (testConversationId) {
      await client.query(`
        DELETE FROM public.conversations WHERE id = $1;
      `, [testConversationId]);
      console.log('   Cleaned up test conversation, messages, and associated notifications.');
    }

    console.log('\n========================================================================');
    console.log(`COMMUNICATION CENTER E2E TESTS: ${passedTests} / ${totalTests} PASSED`);
    console.log('========================================================================\n');

    if (passedTests === totalTests) {
      console.log('🎉 ALL COMMUNICATION CENTER TESTS PASSED PERFECTLY!');
    } else {
      throw new Error(`Some tests failed: ${passedTests}/${totalTests}`);
    }

  } finally {
    try {
      await client.end();
      console.log('Database connection closed cleanly.');
    } catch (err) {
      console.error('Error closing DB client:', err);
    }
  }
}

runE2EVerification().catch((err) => {
  console.error('E2E Verification Failed:', err);
  process.exit(1);
});
