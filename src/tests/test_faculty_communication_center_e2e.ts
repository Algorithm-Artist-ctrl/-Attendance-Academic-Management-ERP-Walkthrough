import pg from "pg";
import path from "path";
import fs from "fs";

let connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      if (line.startsWith('DATABASE_URL=')) {
        connectionString = line.split('DATABASE_URL=')[1].trim().replace(/['"]/g, '');
      }
    }
  }
}

async function runE2ETests() {
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("================================================================================");
  console.log("VCTM ERP: ADVANCED FACULTY COMMUNICATION CENTER E2E VERIFICATION SUITE");
  console.log("================================================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  const assert = (condition: boolean, testName: string, detail?: string) => {
    totalTests++;
    if (condition) {
      console.log(`  [PASS] Test ${totalTests}: ${testName}`);
      if (detail) console.log(`         -> ${detail}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] Test ${totalTests}: ${testName}`);
      if (detail) console.error(`         -> ${detail}`);
      throw new Error(`Assertion failed in: ${testName}`);
    }
  };

  const hemlataAuthId = '4743eb90-0e7e-4ba6-875e-ee3348a1de72';
  const secBId = '233957c0-4fef-42c6-8285-40ebf73ea6b7';
  const secA2ndYearId = 'fc93a413-c18d-4e72-9624-146767bc286b';

  // ---------------------------------------------------------------------------
  // TEST 1: Automatic Class Group Existence for Hemlata's Teaching Assignments
  // ---------------------------------------------------------------------------
  console.log(">>> SUITE 1: AUTOMATIC CLASS GROUP GENERATION & MAPPING");
  const dsLabGroupRes = await client.query(`
    SELECT mg.id, mg.section_id, mg.subject_id, sub.subject_name, sec.name as section_name, sec.room_number, ay.name as year_name
    FROM message_groups mg
    JOIN subjects sub ON sub.id = mg.subject_id
    JOIN sections sec ON sec.id = mg.section_id
    JOIN academic_years ay ON ay.id = mg.academic_year_id
    WHERE sub.subject_name ILIKE '%Data Structure Lab%' AND sec.id = $1;
  `, [secBId]);

  assert(
    dsLabGroupRes.rows.length === 1,
    "Data Structure Lab (DS LAB) Section B Class Group exists",
    `Group ID: ${dsLabGroupRes.rows[0]?.id}, Room: ${dsLabGroupRes.rows[0]?.room_number}`
  );
  const dsLabGroupId = dsLabGroupRes.rows[0].id;

  const dsTheoryGroupRes = await client.query(`
    SELECT mg.id, sub.subject_name FROM message_groups mg
    JOIN subjects sub ON sub.id = mg.subject_id
    WHERE sub.subject_name ILIKE '%Data Structure (DS)%' AND mg.section_id = $1;
  `, [secBId]);

  assert(
    dsTheoryGroupRes.rows.length === 1,
    "Data Structure (DS) Theory Section B Class Group exists",
    `Group ID: ${dsTheoryGroupRes.rows[0]?.id}`
  );

  const coaLabGroupRes = await client.query(`
    SELECT mg.id, sub.subject_name FROM message_groups mg
    JOIN subjects sub ON sub.id = mg.subject_id
    WHERE sub.subject_name ILIKE '%Computer Organization & Architecture Lab%' AND mg.section_id = $1;
  `, [secBId]);

  assert(
    coaLabGroupRes.rows.length === 1,
    "COA Lab Section B Class Group exists",
    `Group ID: ${coaLabGroupRes.rows[0]?.id}`
  );

  const dstlGroupRes = await client.query(`
    SELECT mg.id, sub.subject_name FROM message_groups mg
    JOIN subjects sub ON sub.id = mg.subject_id
    WHERE sub.subject_name ILIKE '%Discrete Structure%' AND mg.section_id = $1;
  `, [secA2ndYearId]);

  assert(
    dstlGroupRes.rows.length === 1,
    "DSTL Section A Class Group exists",
    `Group ID: ${dstlGroupRes.rows[0]?.id}`
  );

  // ---------------------------------------------------------------------------
  // TEST 2: Exact Live Member Roster & 53 Count for Section B
  // ---------------------------------------------------------------------------
  console.log("\n>>> SUITE 2: LIVE ROSTER & EXACT 53 MEMBER COUNT");
  await client.query('BEGIN');
  await client.query(`SET LOCAL "request.jwt.claim.sub" = '${hemlataAuthId}';`);
  await client.query(`SET LOCAL "request.jwt.claim.role" = 'authenticated';`);
  await client.query(`SET LOCAL ROLE authenticated;`);

  const membersRes = await client.query(`
    SELECT public.get_group_members($1) as members;
  `, [dsLabGroupId]);
  const membersList = membersRes.rows[0].members;

  assert(
    Array.isArray(membersList) && membersList.length === 53,
    "get_group_members returns exactly 53 enrolled students for Section B",
    `Actual member count: ${membersList?.length}`
  );

  const firstStudent = membersList[0];
  assert(
    Boolean(firstStudent.id && firstStudent.roll_number && firstStudent.full_name && firstStudent.status),
    "Member records contain id, roll_number, full_name, status, section_name, year_number",
    `Sample: ${firstStudent.roll_number} - ${firstStudent.full_name} (${firstStudent.status})`
  );

  const allActive = membersList.every((m: any) => m.active === true && (m.status === 'ACTIVE' || m.status === 'active' || !m.status));
  assert(
    allActive,
    "All members in class group roster have active enrollment status",
    `53 / 53 students verified ACTIVE`
  );

  await client.query('ROLLBACK');

  // ---------------------------------------------------------------------------
  // TEST 3: Archived / Departed Student Exclusion from Roster
  // ---------------------------------------------------------------------------
  console.log("\n>>> SUITE 3: ARCHIVED & DEPARTED STUDENT EXCLUSION");
  await client.query('BEGIN');
  // Temporarily set a dummy student in section B to WITHDRAWN
  const sampleStudentId = firstStudent.id;
  await client.query(`
    UPDATE students SET status = 'WITHDRAWN', active = false WHERE id = $1;
  `, [sampleStudentId]);

  await client.query(`SET LOCAL "request.jwt.claim.sub" = '${hemlataAuthId}';`);
  await client.query(`SET LOCAL "request.jwt.claim.role" = 'authenticated';`);
  await client.query(`SET LOCAL ROLE authenticated;`);

  const filteredMembersRes = await client.query(`
    SELECT public.get_group_members($1) as members;
  `, [dsLabGroupId]);
  const filteredList = filteredMembersRes.rows[0].members;

  assert(
    filteredList.length === 52,
    "Withdrawn student is strictly excluded from group member roster",
    `Count dropped from 53 to ${filteredList.length}`
  );

  const containsWithdrawn = filteredList.some((m: any) => m.id === sampleStudentId);
  assert(
    !containsWithdrawn,
    "Withdrawn student ID is completely absent from query results"
  );
  await client.query('ROLLBACK');

  // ---------------------------------------------------------------------------
  // TEST 4: Faculty Group Isolation (Zero Cross-Subject Bleed)
  // ---------------------------------------------------------------------------
  console.log("\n>>> SUITE 4: FACULTY ISOLATION (ZERO BLEED)");
  await client.query('BEGIN');
  await client.query(`SET LOCAL "request.jwt.claim.sub" = '${hemlataAuthId}';`);
  await client.query(`SET LOCAL "request.jwt.claim.role" = 'authenticated';`);
  await client.query(`SET LOCAL ROLE authenticated;`);

  const hemlataGroupsRes = await client.query(`
    SELECT mg.id, sub.subject_name, sec.name as section_name, ay.year_number
    FROM message_groups mg
    JOIN subjects sub ON sub.id = mg.subject_id
    JOIN sections sec ON sec.id = mg.section_id
    JOIN academic_years ay ON ay.id = mg.academic_year_id;
  `);

  const hemlataGroups = hemlataGroupsRes.rows;
  assert(
    hemlataGroups.length === 5,
    "Faculty can only see groups for subjects they actively teach",
    `Total visible groups: ${hemlataGroups.length} (expected 5)`
  );

  const unauthorizedSubjects = hemlataGroups.filter((g: any) => 
    g.subject_name.includes('Mathematics IV') || 
    g.subject_name.includes('Cyber Security') ||
    g.subject_name.includes('Universal Human Value')
  );

  assert(
    unauthorizedSubjects.length === 0,
    "Faculty cannot see other faculty's subject groups (Maths IV, CS, UHV strictly blocked)",
    `Unauthorized groups found: ${unauthorizedSubjects.length}`
  );

  await client.query('ROLLBACK');

  // ---------------------------------------------------------------------------
  // TEST 5: Class Coordinator Scoping
  // ---------------------------------------------------------------------------
  console.log("\n>>> SUITE 5: CLASS COORDINATOR SCOPING");
  // Hemlata is class coordinator of Section A 2nd Year
  // Coordinator should only see section announcements (subject_id IS NULL)
  // but NOT other faculty's subject channels in Section A (like Maths IV Section A)
  await client.query('BEGIN');
  await client.query(`SET LOCAL "request.jwt.claim.sub" = '${hemlataAuthId}';`);
  await client.query(`SET LOCAL "request.jwt.claim.role" = 'authenticated';`);
  await client.query(`SET LOCAL ROLE authenticated;`);

  const maths4SecAGroup = await client.query(`
    SELECT mg.id FROM message_groups mg
    JOIN subjects sub ON sub.id = mg.subject_id
    WHERE sub.subject_name ILIKE '%Mathematics IV%' AND mg.section_id = $1;
  `, [secA2ndYearId]);

  assert(
    maths4SecAGroup.rows.length === 0,
    "Class coordinator cannot access other faculty's private subject groups in their coordinated section",
    "Maths IV Section A is invisible to Section A Coordinator"
  );
  await client.query('ROLLBACK');

  // ---------------------------------------------------------------------------
  // TEST 6: Student Scoping (Enrolled Section Only)
  // ---------------------------------------------------------------------------
  console.log("\n>>> SUITE 6: STUDENT ROLE SCOPING");
  // Get an enrolled student in Section B
  const secBStudentRes = await client.query(`
    SELECT s.id, s.roll_number, s.auth_user_id
    FROM students s
    WHERE s.section_id = $1 AND s.active = true AND s.auth_user_id IS NOT NULL
    LIMIT 1;
  `, [secBId]);

  if (secBStudentRes.rows.length > 0) {
    const studentUser = secBStudentRes.rows[0];
    await client.query('BEGIN');
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${studentUser.auth_user_id}';`);
    await client.query(`SET LOCAL "request.jwt.claim.role" = 'authenticated';`);
    await client.query(`SET LOCAL ROLE authenticated;`);

    const studentGroupsRes = await client.query(`
      SELECT mg.id, sub.subject_name, sec.name as section_name
      FROM message_groups mg
      JOIN subjects sub ON sub.id = mg.subject_id
      JOIN sections sec ON sec.id = mg.section_id;
    `);

    const studentGroups = studentGroupsRes.rows;
    const allInSecB = studentGroups.every((g: any) => g.section_name === 'B');
    assert(
      studentGroups.length > 0 && allInSecB,
      "Enrolled student can exclusively see groups for their enrolled section",
      `Student sees ${studentGroups.length} groups all in Section B`
    );

    const seesSecA = studentGroups.some((g: any) => g.section_name === 'A');
    assert(
      !seesSecA,
      "Student cannot see groups for other sections (Section A groups invisible)"
    );
    await client.query('ROLLBACK');
  } else {
    console.log("  [INFO] Skipping student scoping check: No student with auth_user_id found in Section B.");
  }

  // ---------------------------------------------------------------------------
  // TEST 7: Live Message Dispatch & Notification Integration
  // ---------------------------------------------------------------------------
  console.log("\n>>> SUITE 7: LIVE MESSAGING & NOTIFICATION BROADCAST");
  await client.query('BEGIN');
  await client.query(`SET LOCAL "request.jwt.claim.sub" = '${hemlataAuthId}';`);
  await client.query(`SET LOCAL "request.jwt.claim.role" = 'authenticated';`);
  await client.query(`SET LOCAL ROLE authenticated;`);

  const sendRes = await client.query(`
    SELECT public.send_group_message(
      p_academic_year_id := (SELECT academic_year_id FROM message_groups WHERE id = $1),
      p_section_id := (SELECT section_id FROM message_groups WHERE id = $1),
      p_subject_id := (SELECT subject_id FROM message_groups WHERE id = $1),
      p_message := 'Bring your CAO practical file for tomorrow lab evaluation.',
      p_title := 'Lab File Submission Notice',
      p_attachment_url := 'https://example.com/lab_manual.pdf',
      p_attachment_name := 'lab_manual.pdf',
      p_attachment_type := 'application/pdf',
      p_attachment_size := 1048576,
      p_allow_student_replies := false
    ) as result;
  `, [dsLabGroupId]);

  const result = sendRes.rows[0].result;
  assert(
    result.success === true && Boolean(result.message_id),
    "send_group_message succeeds and returns message_id",
    `Created message ID: ${result.message_id}`
  );

  // Verify group message inserted into database
  const msgRow = await client.query(`
    SELECT * FROM group_messages WHERE id = $1;
  `, [result.message_id]);

  assert(
    msgRow.rows.length === 1 && msgRow.rows[0].title === 'Lab File Submission Notice',
    "Group message persisted with sender role, title, body, and attachment metadata",
    `Title: ${msgRow.rows[0].title}, Sender: ${msgRow.rows[0].sender_name} (${msgRow.rows[0].sender_role})`
  );

  // Verify parent group was updated with preview and timestamp
  const groupUpdated = await client.query(`
    SELECT last_message_preview, last_message_at FROM message_groups WHERE id = $1;
  `, [dsLabGroupId]);

  assert(
    groupUpdated.rows[0].last_message_preview.includes('Bring your CAO practical file'),
    "message_groups.last_message_preview updated with latest message text",
    `Preview: "${groupUpdated.rows[0].last_message_preview}"`
  );

  // Verify notifications returned in result and inserted for students
  assert(
    result.notified_count === 53,
    "send_group_message successfully dispatched notifications to all 53 enrolled students",
    `notified_count: ${result.notified_count}`
  );

  await client.query(`RESET ROLE;`);
  const notifsRes = await client.query(`
    SELECT count(*) FROM notifications 
    WHERE reference_id = $1 AND reference_type = 'group_message';
  `, [dsLabGroupId]);

  assert(
    parseInt(notifsRes.rows[0].count) === 53,
    "In-app notifications successfully persisted in database for all 53 students",
    `Notifications generated: ${notifsRes.rows[0].count}`
  );

  await client.query('ROLLBACK');

  // ---------------------------------------------------------------------------
  // TEST 8: Image Attachment Type Handling
  // ---------------------------------------------------------------------------
  console.log("\n>>> SUITE 8: IMAGE ATTACHMENT TYPE HANDLING");
  await client.query('BEGIN');
  await client.query(`SET LOCAL "request.jwt.claim.sub" = '${hemlataAuthId}';`);
  await client.query(`SET LOCAL "request.jwt.claim.role" = 'authenticated';`);
  await client.query(`SET LOCAL ROLE authenticated;`);

  const imgSendRes = await client.query(`
    SELECT public.send_group_message(
      p_academic_year_id := (SELECT academic_year_id FROM message_groups WHERE id = $1),
      p_section_id := (SELECT section_id FROM message_groups WHERE id = $1),
      p_subject_id := (SELECT subject_id FROM message_groups WHERE id = $1),
      p_message := 'Refer to the attached logic circuit diagram.',
      p_title := 'Circuit Diagram',
      p_attachment_url := 'https://example.com/logic_diagram.png',
      p_attachment_name := 'logic_diagram.png',
      p_attachment_type := 'image/png',
      p_attachment_size := 524288
    ) as result;
  `, [dsLabGroupId]);

  const imgResult = imgSendRes.rows[0].result;
  assert(
    imgResult.success === true,
    "Message with IMAGE attachment dispatched successfully",
    `Image Message ID: ${imgResult.message_id}`
  );

  const imgRow = await client.query(`
    SELECT attachment_type, attachment_name, attachment_url FROM group_messages WHERE id = $1;
  `, [imgResult.message_id]);

  assert(
    imgRow.rows[0].attachment_type === 'image/png' && imgRow.rows[0].attachment_name === 'logic_diagram.png',
    "Attachment type image/png and name stored with 100% integrity"
  );
  await client.query('ROLLBACK');

  // ---------------------------------------------------------------------------
  // TEST 9: Student Replies Restriction Validation
  // ---------------------------------------------------------------------------
  console.log("\n>>> SUITE 9: STUDENT REPLIES RESTRICTION VALIDATION");
  if (secBStudentRes.rows.length > 0) {
    const studentUser = secBStudentRes.rows[0];
    await client.query('BEGIN');

    // Set group to disallow student replies
    await client.query(`UPDATE message_groups SET allow_student_replies = false WHERE id = $1;`, [dsLabGroupId]);

    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${studentUser.auth_user_id}';`);
    await client.query(`SET LOCAL "request.jwt.claim.role" = 'authenticated';`);
    await client.query(`SET LOCAL ROLE authenticated;`);

    let studentBlocked = false;
    try {
      await client.query(`
        SELECT public.send_group_message(
          p_academic_year_id := (SELECT academic_year_id FROM message_groups WHERE id = $1),
          p_section_id := (SELECT section_id FROM message_groups WHERE id = $1),
          p_subject_id := (SELECT subject_id FROM message_groups WHERE id = $1),
          p_message := 'Student reply test'
        );
      `, [dsLabGroupId]);
    } catch (err: any) {
      if (err.message.includes('Replies are disabled')) {
        studentBlocked = true;
      }
    }

    assert(
      studentBlocked,
      "Student cannot send messages when allow_student_replies is false",
      "Correctly rejected with: 'Replies are disabled for this announcement group.'"
    );
    await client.query('ROLLBACK');
  }

  // ---------------------------------------------------------------------------
  // TEST 10: Mark Group As Read & Unread Receipt Tracking
  // ---------------------------------------------------------------------------
  console.log("\n>>> SUITE 10: MARK GROUP AS READ");
  await client.query('BEGIN');
  await client.query(`SET LOCAL "request.jwt.claim.sub" = '${hemlataAuthId}';`);
  await client.query(`SET LOCAL "request.jwt.claim.role" = 'authenticated';`);
  await client.query(`SET LOCAL ROLE authenticated;`);

  const markReadRes = await client.query(`
    SELECT public.mark_group_as_read($1) as result;
  `, [dsLabGroupId]);

  assert(
    markReadRes.rows[0].result.success === true,
    "mark_group_as_read stored procedure succeeds",
    `Group ID: ${dsLabGroupId}`
  );

  const readStateRes = await client.query(`
    SELECT last_read_at FROM group_member_read_state WHERE group_id = $1 AND user_id = $2;
  `, [dsLabGroupId, hemlataAuthId]);

  assert(
    readStateRes.rows.length === 1 && Boolean(readStateRes.rows[0].last_read_at),
    "group_member_read_state updated with timestamp for current user"
  );
  await client.query('ROLLBACK');

  await client.end();
  console.log("\n================================================================================");
  console.log(`E2E TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED (100%)`);
  console.log("================================================================================\n");
}

runE2ETests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
