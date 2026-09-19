import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required.');
}

async function runCommunicationScopingTests() {
  console.log('================================================================================');
  console.log('VCTM ERP: COMMUNICATION CENTER, GROUP MESSAGING & DIRECT MESSAGE SCOPING TESTS');
  console.log('================================================================================\n');

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

  let testSectionId: string | null = null;
  let otherSectionId: string | null = null;
  let testYearId: string | null = null;
  let testSubjectId: string | null = null;
  let assignedFacultyId: string | null = null;
  let assignedFacultyAuthId: string | null = null;
  let unassignedFacultyId: string | null = null;
  let unassignedFacultyAuthId: string | null = null;
  let studentAId: string | null = null;
  let studentAAuthId: string | null = null;
  let studentOtherId: string | null = null;
  let studentOtherAuthId: string | null = null;

  try {
    // -------------------------------------------------------------
    // SUITE 1: Database Schema & Nullable subject_id
    // -------------------------------------------------------------
    console.log('\n--- SUITE 1: Database Schema & Nullable subject_id ---');

    const colCheck = await client.query(`
      SELECT table_name, column_name, is_nullable 
      FROM information_schema.columns 
      WHERE table_name IN ('message_groups', 'conversations', 'messages')
        AND column_name = 'subject_id'
    `);

    const colMap: Record<string, string> = {};
    colCheck.rows.forEach(r => { colMap[r.table_name] = r.is_nullable; });

    assert(colMap['message_groups'] === 'YES', 'message_groups.subject_id is nullable (YES)');
    assert(colMap['conversations'] === 'YES', 'conversations.subject_id is nullable (YES)');
    assert(colMap['messages'] === 'YES', 'messages.subject_id is nullable (YES)');

    const idxCheck = await client.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'message_groups' 
        AND indexname IN ('unique_section_group_without_subject', 'unique_class_group_with_subject')
    `);
    assert(idxCheck.rows.length === 2, 'Partial unique indexes exist for message_groups (with and without subject)');

    // -------------------------------------------------------------
    // SUITE 2: Fetch Relational Matrix Data
    // -------------------------------------------------------------
    console.log('\n--- SUITE 2: Fetch Relational Matrix Data ---');

    // Find an active section with an assigned faculty teaching at least one subject
    const fsaRes = await client.query(`
      SELECT 
        fsa.faculty_id, COALESCE(p.id, f.auth_user_id) as faculty_auth_id, f.full_name as faculty_name,
        fsa.section_id, sec.name as section_name, sec.semester_id,
        fsa.subject_id, sub.subject_name,
        sem.academic_year_id, ay.name as year_name, ay.year_number
      FROM public.faculty_subject_assignments fsa
      JOIN public.faculty f ON f.id = fsa.faculty_id
      LEFT JOIN public.profiles p ON (p.faculty_id = f.id OR p.id = f.auth_user_id)
      JOIN public.sections sec ON sec.id = fsa.section_id
      JOIN public.subjects sub ON sub.id = fsa.subject_id
      JOIN public.semesters sem ON sem.id = sec.semester_id
      JOIN public.academic_years ay ON ay.id = sem.academic_year_id
      WHERE fsa.active = true
      LIMIT 1
    `);

    assert(fsaRes.rows.length > 0, 'Found active faculty subject assignment');
    const row = fsaRes.rows[0];
    assignedFacultyId = row.faculty_id;
    assignedFacultyAuthId = row.faculty_auth_id;
    testSectionId = row.section_id;
    testSubjectId = row.subject_id;
    testYearId = row.academic_year_id;

    // Find another section
    const otherSecRes = await client.query(`
      SELECT id, name FROM public.sections 
      WHERE id != $1 AND semester_id = $2
      LIMIT 1
    `, [testSectionId, row.semester_id]);
    if (otherSecRes.rows.length > 0) {
      otherSectionId = otherSecRes.rows[0].id;
    }

    // Find student in testSectionId
    const stuRes = await client.query(`
      SELECT s.id, s.full_name, s.roll_number, COALESCE(p.id, s.auth_user_id) as auth_id
      FROM public.students s
      LEFT JOIN public.profiles p ON (p.student_id = s.id OR p.id = s.auth_user_id)
      WHERE s.section_id = $1 AND s.active = true
      LIMIT 1
    `, [testSectionId]);
    if (stuRes.rows.length > 0) {
      studentAId = stuRes.rows[0].id;
      studentAAuthId = stuRes.rows[0].auth_id;
    }
    assert(studentAId !== null, `Found student in Section ${row.section_name}: ${stuRes.rows[0]?.full_name}`);

    // Find student in otherSectionId if exists
    if (otherSectionId) {
      const otherStuRes = await client.query(`
        SELECT s.id, s.full_name, s.roll_number, COALESCE(p.id, s.auth_user_id) as auth_id
        FROM public.students s
        LEFT JOIN public.profiles p ON (p.student_id = s.id OR p.id = s.auth_user_id)
        WHERE s.section_id = $1 AND s.active = true
        LIMIT 1
      `, [otherSectionId]);
      if (otherStuRes.rows.length > 0) {
        studentOtherId = otherStuRes.rows[0].id;
        studentOtherAuthId = otherStuRes.rows[0].auth_id;
      }
    }

    // Find unassigned faculty
    const unassRes = await client.query(`
      SELECT f.id, f.full_name, COALESCE(p.id, f.auth_user_id) as auth_id
      FROM public.faculty f
      LEFT JOIN public.profiles p ON (p.faculty_id = f.id OR p.id = f.auth_user_id)
      WHERE f.id != $1
        AND NOT EXISTS (
          SELECT 1 FROM public.faculty_subject_assignments fsa 
          WHERE fsa.faculty_id = f.id AND fsa.section_id = $2
        )
      LIMIT 1
    `, [assignedFacultyId, testSectionId]);
    if (unassRes.rows.length > 0) {
      unassignedFacultyId = unassRes.rows[0].id;
      unassignedFacultyAuthId = unassRes.rows[0].auth_id;
    }

    // -------------------------------------------------------------
    // SUITE 3: Section-Wide Group Announcement (subject_id = null)
    // -------------------------------------------------------------
    console.log('\n--- SUITE 3: Section-Wide Group Announcement (subject_id = null) ---');

    // Clean up previous test messages if any
    await client.query(`
      DELETE FROM public.group_messages 
      WHERE message LIKE '%TEST_SECTION_WIDE_ANNOUNCEMENT%'
    `);

    // Set auth context to simulate assigned faculty login
    await client.query("SELECT set_config('request.jwt.claim.sub', $1, false);", [assignedFacultyAuthId]);

    // Test send_group_message RPC directly with auth context of assigned faculty
    const rpcRes = await client.query(`
      SELECT public.send_group_message(
        p_academic_year_id := $1::uuid,
        p_section_id := $2::uuid,
        p_subject_id := NULL::uuid,
        p_message := 'TEST_SECTION_WIDE_ANNOUNCEMENT: Important update for the entire class.',
        p_title := 'All-Hands Class Announcement',
        p_allow_student_replies := false
      ) as result
    `, [testYearId, testSectionId]);

    const resObj = rpcRes.rows[0]?.result;
    assert(resObj?.success === true, 'send_group_message succeeded with subject_id = NULL');
    const sectionWideGroupId = resObj?.group_id;
    assert(sectionWideGroupId !== undefined, `Created/retrieved group ID: ${sectionWideGroupId}`);

    // Verify group in database has subject_id IS NULL
    const grpCheck = await client.query(`
      SELECT id, academic_year_id, section_id, subject_id, allow_student_replies 
      FROM public.message_groups 
      WHERE id = $1
    `, [sectionWideGroupId]);
    assert(grpCheck.rows[0]?.subject_id === null, 'Verified message_groups.subject_id IS NULL in database');

    // Verify notification was generated for enrolled student
    const notifCheck = await client.query(`
      SELECT id, recipient_student_id, title, message 
      FROM public.notifications 
      WHERE reference_id = $1 AND message LIKE '%TEST_SECTION_WIDE_ANNOUNCEMENT%'
    `, [sectionWideGroupId]);
    assert(notifCheck.rows.length > 0, `Generated ${notifCheck.rows.length} notification(s) for section students`);
    if (notifCheck.rows.length > 0) {
      console.log(`   Notification title: "${notifCheck.rows[0].title}"`);
      assert(!notifCheck.rows[0].title.includes('null'), 'Notification title does not contain "null"');
      assert(notifCheck.rows[0].title.startsWith('Section'), 'Notification title starts with "Section" for section announcement');
    }

    // Verify student from other section did NOT receive notification
    if (studentOtherId) {
      const otherNotif = notifCheck.rows.find(n => n.recipient_student_id === studentOtherId);
      assert(!otherNotif, 'Cross-section isolation: Student in other section did NOT receive the notification');
    }

    // -------------------------------------------------------------
    // SUITE 4: Subject-Specific Group Announcement
    // -------------------------------------------------------------
    console.log('\n--- SUITE 4: Subject-Specific Group Announcement ---');

    await client.query("SELECT set_config('request.jwt.claim.sub', $1, false);", [assignedFacultyAuthId]);

    const subRpcRes = await client.query(`
      SELECT public.send_group_message(
        p_academic_year_id := $1::uuid,
        p_section_id := $2::uuid,
        p_subject_id := $3::uuid,
        p_message := 'TEST_SUBJECT_ANNOUNCEMENT: Assignment 2 deadline extended.',
        p_title := 'Assignment Update',
        p_allow_student_replies := true
      ) as result
    `, [testYearId, testSectionId, testSubjectId]);

    const subResObj = subRpcRes.rows[0]?.result;
    assert(subResObj?.success === true, 'send_group_message succeeded with specific subject_id');
    const subjectGroupId = subResObj?.group_id;
    assert(subjectGroupId !== sectionWideGroupId, 'Subject group has distinct group_id from section group');

    const subGrpCheck = await client.query(`
      SELECT id, subject_id FROM public.message_groups WHERE id = $1
    `, [subjectGroupId]);
    assert(subGrpCheck.rows[0]?.subject_id === testSubjectId, 'Verified subject_id matches in message_groups');

    // -------------------------------------------------------------
    // SUITE 5: Student Deduplication in fetchEligibleStudentsForFaculty
    // -------------------------------------------------------------
    console.log('\n--- SUITE 5: Student Deduplication in fetchEligibleStudentsForFaculty ---');

    const eligibleStudents = await supabaseService.fetchEligibleStudentsForFaculty(assignedFacultyId);
    assert(eligibleStudents.length > 0, `fetchEligibleStudentsForFaculty returned ${eligibleStudents.length} student(s)`);

    // Verify each student appears ONLY ONCE
    const seenIds = new Set<string>();
    let duplicateCount = 0;
    eligibleStudents.forEach(s => {
      if (seenIds.has(s.student_id)) {
        duplicateCount++;
      }
      seenIds.add(s.student_id);
    });

    assert(duplicateCount === 0, `Zero duplicate students (tested ${eligibleStudents.length} students, duplicates: ${duplicateCount})`);
    assert(seenIds.size === eligibleStudents.length, `Distinct student IDs count (${seenIds.size}) equals array length (${eligibleStudents.length})`);

    const sampleStudent = eligibleStudents[0];
    if (sampleStudent) {
      console.log(`   Sample student: ${sampleStudent.student_name} (${sampleStudent.roll_number}) - Section: ${sampleStudent.section_name}, Year: ${sampleStudent.year_name}`);
      console.log(`   Assigned subjects count: ${sampleStudent.subjects?.length || 0}`);
      assert(sampleStudent.subjects !== undefined, 'Student has aggregated subjects array');
    }

    // -------------------------------------------------------------
    // SUITE 6: Direct Conversation Student-Based Identity & Faculty Initiation
    // -------------------------------------------------------------
    console.log('\n--- SUITE 6: Direct Conversation Student-Based Identity & Faculty Initiation ---');

    // Faculty initiating conversation with studentAId via get_or_create_conversation RPC
    await client.query("SELECT set_config('request.jwt.claim.sub', $1, false);", [assignedFacultyAuthId]);

    const convRpc = await client.query(`
      SELECT public.get_or_create_conversation(
        p_faculty_id := $1::uuid,
        p_subject_id := NULL::uuid,
        p_category := 'General',
        p_topic := 'Direct Discussion Initiation Test',
        p_student_id := $2::uuid
      ) as result
    `, [assignedFacultyId, studentAId]);

    const convResult = convRpc.rows[0]?.result;
    assert(convResult !== null && convResult?.id !== undefined, 'Faculty initiated conversation directly with student via RPC');
    const conversationId = convResult?.id;

    // Verify conversation record
    const convCheck = await client.query(`
      SELECT id, student_id, faculty_id, subject_id, section_id, status 
      FROM public.conversations 
      WHERE id = $1
    `, [conversationId]);

    assert(convCheck.rows[0]?.student_id === studentAId, 'Conversation matches student_id');
    assert(convCheck.rows[0]?.faculty_id === assignedFacultyId, 'Conversation matches faculty_id');

    // Send a message in the conversation
    const msgRpc = await client.query(`
      SELECT public.send_message(
        p_conversation_id := $1::uuid,
        p_message := 'Hello, this is a direct academic inquiry.'
      ) as result
    `, [conversationId]);

    assert(msgRpc.rows[0]?.result?.id !== undefined, 'Direct message successfully sent in student-faculty conversation');

    // -------------------------------------------------------------
    // SUITE 7: Academic Year Label Bug Check
    // -------------------------------------------------------------
    console.log('\n--- SUITE 7: Academic Year Label Bug Check ---');

    const yearsRes = await client.query(`
      SELECT id, year_number, name FROM public.academic_years ORDER BY year_number
    `);
    yearsRes.rows.forEach(y => {
      console.log(`   Year: number=${y.year_number}, name="${y.name}"`);
      assert(y.name.includes('Year'), `Academic year database name has correct string: "${y.name}"`);
    });

    // Clean up test records
    await client.query(`
      DELETE FROM public.group_messages WHERE message LIKE '%TEST_%'
    `);

  } catch (err) {
    console.error('Test execution error:', err);
    assert(false, `Unexpected exception: ${(err as any).message}`);
  } finally {
    await client.end();
  }

  console.log('\n================================================================================');
  console.log(`SUMMARY: ${passed} of ${total} tests passed.`);
  console.log('================================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runCommunicationScopingTests().catch(err => {
  console.error(err);
  process.exit(1);
});
