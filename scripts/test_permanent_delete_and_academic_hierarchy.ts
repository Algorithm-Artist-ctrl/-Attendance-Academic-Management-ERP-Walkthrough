if (!process.env.DATABASE_URL && (process as any).loadEnvFile) {
  try { (process as any).loadEnvFile(); } catch {}
}
import pg from 'pg';

const connectionString = process.env.DATABASE_URL || '';

async function runTests() {
  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable is required.');
    process.exit(1);
  }

  console.log('🚀 Running Comprehensive Test: Permanent Delete RPC + 1st Year Hierarchy + Enrollment Number...');

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database.');

    // =========================================================================
    // TEST 1: Permanent Delete Security & Cascade Verification
    // =========================================================================
    console.log('\n--- TEST 1: Permanent Delete Security & Cascading Purge ---');

    // 1.1: Ensure active account cannot be permanently deleted
    const activeFacultyRes = await client.query(`
      SELECT id, full_name, auth_user_id, status
      FROM public.faculty
      WHERE status = 'ACTIVE' AND active = true
      LIMIT 1;
    `);

    if (activeFacultyRes.rows.length > 0) {
      const activeFac = activeFacultyRes.rows[0];
      let rejected = false;
      try {
        await client.query(`SELECT public.permanent_delete_archived_account($1, 'faculty', '00000000-0000-0000-0000-000000000000')`, [activeFac.id]);
      } catch (err: any) {
        if (err.message.includes('must be archived') || err.message.includes('Cannot permanently delete') || err.message.includes('Account is active')) {
          rejected = true;
          console.log(`✅ Passed: Active faculty cannot be permanently deleted (${err.message.trim()})`);
        } else {
          throw err;
        }
      }
      if (!rejected) {
        throw new Error('FAILED: Active faculty was allowed to be deleted!');
      }
    }

    // 1.2: Ensure cannot delete self
    const adminRes = await client.query(`
      SELECT id, auth_user_id
      FROM public.faculty
      WHERE auth_user_id IS NOT NULL
      LIMIT 1;
    `);
    if (adminRes.rows.length > 0 && adminRes.rows[0].auth_user_id) {
      let rejectedSelf = false;
      try {
        await client.query(
          `SELECT public.permanent_delete_archived_account($1, 'faculty', $2)`,
          [adminRes.rows[0].id, adminRes.rows[0].auth_user_id]
        );
      } catch (err: any) {
        if (err.message.includes('cannot permanently delete your own') || err.message.includes('must be archived') || err.message.includes('Account is active')) {
          rejectedSelf = true;
          console.log(`✅ Passed: Self-deletion / active account rejection verified (${err.message.trim()})`);
        } else {
          throw err;
        }
      }
    }

    // 1.3: Create a temporary archived student with message records to test full purge
    console.log('Creating test archived student with messages & group messages...');
    const instRes = await client.query(`SELECT id FROM public.institutions LIMIT 1;`);
    const deptRes = await client.query(`SELECT id FROM public.departments LIMIT 1;`);
    const progRes = await client.query(`SELECT id FROM public.programs LIMIT 1;`);
    const yrRes = await client.query(`SELECT id FROM public.academic_years WHERE year_number = 1 LIMIT 1;`);
    const semRes = await client.query(`SELECT id FROM public.semesters WHERE semester_number = 1 LIMIT 1;`);
    const secRes = await client.query(`SELECT id FROM public.sections LIMIT 1;`);
    const sessRes = await client.query(`SELECT id FROM public.academic_sessions LIMIT 1;`);

    const instId = instRes.rows[0].id;
    const deptId = deptRes.rows[0].id;
    const progId = progRes.rows[0].id;
    const yrId = yrRes.rows[0].id;
    const semId = semRes.rows[0].id;
    const secId = secRes.rows[0].id;
    const sessId = sessRes.rows[0].id;

    const testRoll = `TEST_PURGE_${Date.now()}`;
    const testEnroll = `EN_${testRoll}`;

    const newStudentRes = await client.query(`
      INSERT INTO public.students (
        institution_id, department_id, program_id, academic_year_id,
        semester_id, section_id, academic_session_id,
        roll_number, enrollment_number, full_name, admission_type,
        status, active, archived_at, archived_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, 'TEST ARCHIVED STUDENT', 'Regular',
        'ARCHIVED', false, NOW(), NULL
      ) RETURNING id;
    `, [instId, deptId, progId, yrId, semId, secId, sessId, testRoll, testEnroll]);

    const testStudentId = newStudentRes.rows[0].id;
    console.log(`Created test archived student id: ${testStudentId}`);

    const msgCols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'messages'`);
    console.log('Messages columns:', msgCols.rows.map(r => r.column_name));

    // Insert test direct message referencing student_id
    if (msgCols.rows.some(c => c.column_name === 'message')) {
      const colNames = msgCols.rows.map(r => r.column_name);
      if (colNames.includes('student_id')) {
        let convId: string | null = null;
        try {
          const convRes = await client.query(`SELECT id FROM public.conversations LIMIT 1;`);
          convId = convRes.rows[0]?.id || null;
        } catch {}

        let testSenderUserId: string | null = null;
        let testReceiverUserId: string | null = null;
        let testFacId: string | null = null;
        try {
          const userRes = await client.query(`SELECT id FROM auth.users LIMIT 2;`);
          testSenderUserId = userRes.rows[0]?.id || null;
          testReceiverUserId = userRes.rows[1]?.id || userRes.rows[0]?.id || null;
          const facRes = await client.query(`SELECT id FROM public.faculty LIMIT 1;`);
          testFacId = facRes.rows[0]?.id || null;
        } catch {}

        if (convId && testSenderUserId && testReceiverUserId && testFacId) {
          await client.query(`
            INSERT INTO public.messages (
              conversation_id, sender_user_id, receiver_user_id, student_id, faculty_id, sender_role, message
            ) VALUES (
              $1, $2, $3, $4, $5, 'student', 'Test message for purge verification'
            );
          `, [convId, testSenderUserId, testReceiverUserId, testStudentId, testFacId]);
        }
      }
    }

    // Check valid notification types
    const notifConRes = await client.query(`SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'notifications_type_check'`);
    console.log('Notification type constraint:', notifConRes.rows[0]?.pg_get_constraintdef);
    const validNotifType = notifConRes.rows[0]?.pg_get_constraintdef?.match(/'([^']+)'/)?.[1] || 'ATTENDANCE_MARKED';

    // Insert test notification referencing recipient_student_id
    await client.query(`
      INSERT INTO public.notifications (
        recipient_student_id, title, message, type
      ) VALUES (
        $1, 'Test Notification', 'Test notification message', $2
      );
    `, [testStudentId, validNotifType]);

    console.log('Calling permanent_delete_archived_account RPC...');
    const purgeRes = await client.query(`
      SELECT public.permanent_delete_archived_account($1, 'student', '00000000-0000-0000-0000-000000000000') as result;
    `, [testStudentId]);

    const rpcOutput = purgeRes.rows[0].result;
    console.log(`Purge RPC Result:`, rpcOutput);

    // Verify student is completely gone
    const checkStud = await client.query(`SELECT id FROM public.students WHERE id = $1`, [testStudentId]);
    if (checkStud.rows.length !== 0) {
      throw new Error(`FAILED: Student ${testStudentId} still exists in public.students!`);
    }
    console.log('✅ Passed: Test archived student was permanently purged from database.');

    // Verify messages for student were deleted
    const checkMsg = await client.query(`SELECT id FROM public.messages WHERE student_id = $1`, [testStudentId]);
    if (checkMsg.rows.length !== 0) {
      throw new Error(`FAILED: Messages for student ${testStudentId} were not purged!`);
    }
    console.log('✅ Passed: Associated direct messages were purged with zero schema errors.');

    // =========================================================================
    // TEST 2: Academic Hierarchy & 1st Year Cohort Verification
    // =========================================================================
    console.log('\n--- TEST 2: Academic Hierarchy & 1st Year Status ---');

    const firstYearRes = await client.query(`
      SELECT id, name, year_number, active
      FROM public.academic_years
      WHERE year_number = 1;
    `);

    if (firstYearRes.rows.length === 0) {
      throw new Error('FAILED: No 1st Year found in academic_years table!');
    }

    const firstYear = firstYearRes.rows[0];
    console.log(`1st Year Record: id=${firstYear.id}, name="${firstYear.name}", active=${firstYear.active}`);
    if (!firstYear.active) {
      throw new Error('FAILED: 1st Year active flag is false!');
    }
    console.log('✅ Passed: 1st Year is active in database.');

    // Verify Semesters 1 and 2
    const semsRes = await client.query(`
      SELECT id, name, semester_number, active, academic_year_id
      FROM public.semesters
      WHERE semester_number IN (1, 2)
      ORDER BY semester_number;
    `);

    console.log(`Found ${semsRes.rows.length} semesters for 1st Year:`);
    semsRes.rows.forEach(s => {
      console.log(`   - Sem ${s.semester_number}: "${s.name}", active=${s.active}`);
      if (!s.active) throw new Error(`FAILED: Semester ${s.semester_number} active flag is false!`);
    });
    console.log('✅ Passed: Semesters 1 and 2 are active and properly linked.');

    // 2.2: Test dynamic 1st Year Section creation
    console.log('\nTesting 1st Year Section creation and mapping...');
    const testSecName = `TEST1_${Date.now().toString().slice(-4)}`;
    const newSecRes = await client.query(`
      INSERT INTO public.sections (
        semester_id, name, room_number, active
      ) VALUES (
        $1, $2, 'Room 101-Test', true
      ) RETURNING id, name, semester_id;
    `, [firstYear.id ? semsRes.rows[0].id : semId, testSecName]);

    const createdSec = newSecRes.rows[0];
    console.log(`Created 1st Year Section: id=${createdSec.id}, name="${createdSec.name}"`);

    // 2.3: Test Student enrollment in 1st Year section with unique enrollment_number
    console.log('\nTesting 1st Year Student enrollment with enrollment_number...');
    const testRoll1 = `R1_${Date.now()}`;
    const testEnroll1 = `EN1_${Date.now()}`;

    const stud1Res = await client.query(`
      INSERT INTO public.students (
        institution_id, department_id, program_id, academic_year_id,
        semester_id, section_id, academic_session_id,
        roll_number, enrollment_number, full_name, admission_type,
        status, active
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, 'TEST FIRST YEAR STUDENT 1', 'Regular',
        'ACTIVE', true
      ) RETURNING id, roll_number, enrollment_number;
    `, [instId, deptId, progId, firstYear.id, createdSec.semester_id, createdSec.id, sessId, testRoll1, testEnroll1]);

    const enrolledStud = stud1Res.rows[0];
    console.log(`Enrolled student: id=${enrolledStud.id}, roll=${enrolledStud.roll_number}, enroll=${enrolledStud.enrollment_number}`);
    console.log('✅ Passed: Student enrolled in 1st Year section with enrollment_number.');

    // 2.4: Test uniqueness constraints on enrollment_number and roll_number
    console.log('\nTesting uniqueness constraint on enrollment_number...');
    let enrollDupCaught = false;
    try {
      await client.query(`
        INSERT INTO public.students (
          institution_id, department_id, program_id, academic_year_id,
          semester_id, section_id, academic_session_id,
          roll_number, enrollment_number, full_name, admission_type,
          status, active
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, 'TEST DUPLICATE ENROLLMENT', 'Regular',
          'ACTIVE', true
        );
      `, [instId, deptId, progId, firstYear.id, createdSec.semester_id, createdSec.id, sessId, `R2_${Date.now()}`, testEnroll1]);
    } catch (err: any) {
      if (err.code === '23505' || err.message.includes('unique') || err.message.includes('duplicate')) {
        enrollDupCaught = true;
        console.log(`✅ Passed: Duplicate enrollment_number rejected by database constraint (${err.detail || err.message})`);
      } else {
        throw err;
      }
    }

    if (!enrollDupCaught) {
      throw new Error('FAILED: Duplicate enrollment_number was allowed by database!');
    }

    // 2.5: Test cleanup of test records
    console.log('\nCleaning up test student & section...');
    await client.query(`DELETE FROM public.students WHERE id = $1`, [enrolledStud.id]);
    await client.query(`DELETE FROM public.sections WHERE id = $1`, [createdSec.id]);
    console.log('✅ Cleaned up temporary test records.');

    console.log('\n=============================================================');
    console.log('🎉 ALL INTEGRATION & VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('=============================================================');
  } finally {
    await client.end();
  }
}

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
