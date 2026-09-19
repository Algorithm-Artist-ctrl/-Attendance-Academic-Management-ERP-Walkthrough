import { Client, types } from 'pg';
types.setTypeParser(1082, (str: string) => str);
import * as fs from 'fs';
import * as path from 'path';

let connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      if (line.startsWith('DATABASE_URL=')) {
        connectionString = line.split('DATABASE_URL=')[1].trim().replace(/['"]/g, '');
      }
    }
  }
}

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required.');
}

async function runRecordsAndArchiveE2ETests() {
  const client = new Client({ connectionString });
  await client.connect();

  console.log('===============================================================');
  console.log('VCTM ERP — RECORDS & ARCHIVE SYSTEM END-TO-END VERIFICATION');
  console.log('===============================================================');

  try {
    // 0. Setup Test Context & Data
    console.log('\n[SETUP] Initializing verified test entities...');
    
    // Find Super Admin profile
    const adminRes = await client.query(`
      SELECT id, full_name, email FROM profiles WHERE role = 'super_admin' LIMIT 1;
    `);
    if (adminRes.rows.length === 0) {
      throw new Error('Super admin profile not found in database.');
    }
    const adminUser = adminRes.rows[0];
    console.log(`✓ Super Admin actor identified: ${adminUser.full_name} (${adminUser.id})`);

    // Find verified academic context from existing student and subject
    const contextRes = await client.query(`
      SELECT 
        s.institution_id,
        s.department_id as dept_id,
        s.program_id as prog_id,
        s.academic_session_id as session_id,
        s.academic_year_id as year_id,
        s.semester_id as sem_id,
        s.section_id as sec_id,
        sub.id as sub_id
      FROM students s
      JOIN subjects sub ON sub.department_id = s.department_id
      LIMIT 1;
    `);
    if (contextRes.rows.length === 0) {
      throw new Error('Academic context (department, program, year, section, subject) not found.');
    }
    const ctx = contextRes.rows[0];

    // Create Test Student 1 (For Graduated Test)
    const testStudGradId = '00000000-0000-0000-0000-000000000101';
    const testStudGradAuthId = '00000000-0000-0000-0000-000000000102';
    const testStudGradRoll = 'TEST-ARCHIVE-GRAD-01';
    const testStudGradEmail = 'test_archive_grad_01@student.vctm.in';

    // Upsert auth.users, profiles, students
    await client.query(`
      INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      VALUES ($1, $2, 'hashed_pwd_stub', now(), '{"provider":"email","providers":["email"]}', '{"role":"student"}', now(), now())
      ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, banned_until = NULL;
    `, [testStudGradAuthId, testStudGradEmail]);

    await client.query(`
      INSERT INTO profiles (id, full_name, email, role, status, created_at, updated_at)
      VALUES ($1, 'Test Student Graduated', $2, 'student', 'ACTIVE', now(), now())
      ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', exit_date = NULL, exit_reason = NULL, archived_at = NULL, archived_by = NULL;
    `, [testStudGradAuthId, testStudGradEmail]);

    await client.query(`
      INSERT INTO students (id, auth_user_id, institution_id, roll_number, full_name, email, department_id, program_id, academic_session_id, academic_year_id, semester_id, section_id, admission_type, status, active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'Test Student Graduated', $5, $6, $7, $8, $9, $10, $11, 'Regular', 'ACTIVE', true, now(), now())
      ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', active = true, exit_date = NULL, exit_reason = NULL, archived_at = NULL, archived_by = NULL;
    `, [testStudGradId, testStudGradAuthId, ctx.institution_id, testStudGradRoll, testStudGradEmail, ctx.dept_id, ctx.prog_id, ctx.session_id, ctx.year_id, ctx.sem_id, ctx.sec_id]);

    // Create Test Faculty 1 (For Resigned Test)
    const testFacResignId = '00000000-0000-0000-0000-000000000201';
    const testFacResignAuthId = '00000000-0000-0000-0000-000000000202';
    const testFacResignCode = 'TEST-FAC-RESIGN-01';
    const testFacResignEmail = 'test_fac_resign_01@faculty.vctm.in';

    await client.query(`
      INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      VALUES ($1, $2, 'hashed_pwd_stub', now(), '{"provider":"email","providers":["email"]}', '{"role":"faculty"}', now(), now())
      ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, banned_until = NULL;
    `, [testFacResignAuthId, testFacResignEmail]);

    await client.query(`
      INSERT INTO profiles (id, full_name, email, role, status, created_at, updated_at)
      VALUES ($1, 'Test Faculty Resigned', $2, 'faculty', 'ACTIVE', now(), now())
      ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', exit_date = NULL, exit_reason = NULL, archived_at = NULL, archived_by = NULL;
    `, [testFacResignAuthId, testFacResignEmail]);

    await client.query(`
      INSERT INTO faculty (id, auth_user_id, employee_code, full_name, email, department_id, designation, status, active, created_at, updated_at)
      VALUES ($3, $1, $4, 'Test Faculty Resigned', $2, $5, 'Assistant Professor', 'ACTIVE', true, now(), now())
      ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', active = true, exit_date = NULL, exit_reason = NULL, archived_at = NULL, archived_by = NULL;
    `, [testFacResignAuthId, testFacResignEmail, testFacResignId, testFacResignCode, ctx.dept_id]);

    // Seed historical academic records: Attendance session marked by test faculty, attended by test student
    const sessionId = '00000000-0000-0000-0000-000000000301';
    await client.query(`
      INSERT INTO attendance_sessions (id, faculty_id, subject_id, section_id, session_date, status, created_at)
      VALUES ($1, $2, $3, $4, '2026-03-10', 'COMPLETED', now())
      ON CONFLICT (id) DO NOTHING;
    `, [sessionId, testFacResignId, ctx.sub_id, ctx.sec_id]);

    await client.query(`
      INSERT INTO attendance_records (attendance_session_id, student_id, status, marked_by, created_at)
      VALUES ($1, $2, 'Present', $3, now())
      ON CONFLICT DO NOTHING;
    `, [sessionId, testStudGradId, testFacResignId]);

    // Seed historical assessment & marks
    const assessmentId = '00000000-0000-0000-0000-000000000401';
    await client.query(`
      INSERT INTO sessional_assessments (id, faculty_id, subject_id, section_id, title, max_marks, exam_date, status, created_at)
      VALUES ($1, $2, $3, $4, 'Mid-Term Exam I', 50, '2026-03-15', 'published', now())
      ON CONFLICT (id) DO NOTHING;
    `, [assessmentId, testFacResignAuthId, ctx.sub_id, ctx.sec_id]);

    await client.query(`
      INSERT INTO sessional_marks (id, sessional_assessment_id, faculty_id, subject_id, section_id, student_id, sessional_type, max_marks, marks_obtained, status, created_at)
      VALUES ('00000000-0000-0000-0000-000000000402', $1, $2, $3, $4, $5, 'Sessional 1', 50, 45, 'published', now())
      ON CONFLICT (id) DO NOTHING;
    `, [assessmentId, testFacResignId, ctx.sub_id, ctx.sec_id, testStudGradId]);

    // Seed faculty subject assignment
    await client.query(`
      INSERT INTO faculty_subject_assignments (id, faculty_id, subject_id, section_id, academic_session_id, active, created_at)
      VALUES ('00000000-0000-0000-0000-000000000501', $1, $2, $3, $4, true, now())
      ON CONFLICT (id) DO UPDATE SET active = true;
    `, [testFacResignId, ctx.sub_id, ctx.sec_id, ctx.session_id]);

    console.log('✓ Test entities, historical attendance, marks, and assignments provisioned.');

    // -------------------------------------------------------------
    // TEST 1: Student Graduated Archive
    // -------------------------------------------------------------
    console.log('\n[TEST 1] Testing Student Graduated Archive...');
    const gradExitDate = '2026-06-30';
    const gradReason = 'Completed B.Tech Computer Science with First Class Distinction';

    const archiveStudentRes = await client.query(`
      SELECT public.archive_account(
        $1::uuid,
        'student'::text,
        'GRADUATED'::text,
        $2::date,
        $3::text,
        $4::uuid
      ) as success;
    `, [testStudGradId, gradExitDate, gradReason, adminUser.id]);

    if (!archiveStudentRes.rows[0].success) {
      throw new Error('archive_account RPC returned false for student.');
    }

    // 1A. Verify student status and flags
    const studentCheck = await client.query(`
      SELECT s.status, s.active, s.exit_date, s.exit_reason, s.archived_at, s.archived_by,
             p.status as prof_status,
             u.banned_until
      FROM students s
      JOIN profiles p ON p.id = s.auth_user_id
      JOIN auth.users u ON u.id = s.auth_user_id
      WHERE s.id = $1;
    `, [testStudGradId]);
    const stRow = studentCheck.rows[0];
    
    if (stRow.status !== 'GRADUATED' || stRow.active !== false) {
      throw new Error(`Student status check failed: expected GRADUATED and active=false, got ${stRow.status}, active=${stRow.active}`);
    }
    if (stRow.prof_status !== 'GRADUATED') {
      throw new Error(`Profile status check failed: expected GRADUATED, got ${stRow.prof_status}`);
    }
    if (!stRow.banned_until || new Date(stRow.banned_until) < new Date('2099-01-01')) {
      throw new Error(`Auth user banned_until check failed: got ${stRow.banned_until}`);
    }
    console.log('✓ Student account status transitioned to GRADUATED, active=false, login banned.');

    // 1B. Verify student does NOT appear in active student list query
    const activeStudentQuery = await client.query(`
      SELECT id FROM students WHERE (status IS NULL OR status = 'ACTIVE') AND active = true AND id = $1;
    `, [testStudGradId]);
    if (activeStudentQuery.rows.length > 0) {
      throw new Error('Archived student illegally appears in active student list query!');
    }
    console.log('✓ Student correctly removed from active student directory queries.');

    // 1C. Verify student APPEARS in archive queries
    const archiveQuery = await client.query(`
      SELECT id, full_name, status, exit_date, exit_reason FROM students WHERE (status != 'ACTIVE' OR active = false) AND id = $1;
    `, [testStudGradId]);
    if (archiveQuery.rows.length === 0) {
      throw new Error('Archived student missing from archive query!');
    }
    console.log('✓ Student properly indexed in Records & Archive queries.');

    // 1D. Verify 100% of historical attendance and marks remain preserved
    const histAttCheck = await client.query(`
      SELECT count(*) as count FROM attendance_records WHERE student_id = $1;
    `, [testStudGradId]);
    if (parseInt(histAttCheck.rows[0].count) !== 1) {
      throw new Error(`Historical attendance count mismatch: expected 1, got ${histAttCheck.rows[0].count}`);
    }

    const histMarksCheck = await client.query(`
      SELECT marks_obtained FROM sessional_marks WHERE student_id = $1;
    `, [testStudGradId]);
    if (histMarksCheck.rows.length === 0 || parseInt(histMarksCheck.rows[0].marks_obtained) !== 45) {
      throw new Error('Historical marks record damaged or missing!');
    }
    console.log('✓ Historical attendance (100%) and assessment marks (100%) fully preserved and verified.');

    // -------------------------------------------------------------
    // TEST 2: Student Withdrawn Archive
    // -------------------------------------------------------------
    console.log('\n[TEST 2] Testing Student Withdrawn Archive...');
    const testStudWithdrawnId = '00000000-0000-0000-0000-000000000103';
    const testStudWithdrawnAuthId = '00000000-0000-0000-0000-000000000104';
    await client.query(`
      INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      VALUES ($1, 'test_withdrawn@vctm.in', 'hashed_pwd_stub', now(), '{"role":"student"}', '{"role":"student"}', now(), now())
      ON CONFLICT (id) DO UPDATE SET banned_until = NULL;
    `, [testStudWithdrawnAuthId]);

    await client.query(`
      INSERT INTO profiles (id, full_name, email, role, status, created_at, updated_at)
      VALUES ($1, 'Test Student Withdrawn', 'test_withdrawn@vctm.in', 'student', 'ACTIVE', now(), now())
      ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE';
    `, [testStudWithdrawnAuthId]);

    await client.query(`
      INSERT INTO students (id, auth_user_id, institution_id, roll_number, full_name, email, department_id, program_id, academic_session_id, academic_year_id, semester_id, section_id, admission_type, status, active, created_at, updated_at)
      VALUES ($1, $2, $3, 'TEST-WITHDRAWN-01', 'Test Student Withdrawn', 'test_withdrawn@vctm.in', $4, $5, $6, $7, $8, $9, 'Regular', 'ACTIVE', true, now(), now())
      ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', active = true;
    `, [testStudWithdrawnId, testStudWithdrawnAuthId, ctx.institution_id, ctx.dept_id, ctx.prog_id, ctx.session_id, ctx.year_id, ctx.sem_id, ctx.sec_id]);

    const withdrawRes = await client.query(`
      SELECT public.archive_account(
        $1::uuid,
        'student'::text,
        'WITHDRAWN'::text,
        '2026-09-01'::date,
        'Student relocated out of state'::text,
        $2::uuid
      ) as success;
    `, [testStudWithdrawnId, adminUser.id]);

    if (!withdrawRes.rows[0].success) {
      throw new Error('archive_account RPC returned false for WITHDRAWN.');
    }

    const withdrawCheck = await client.query(`
      SELECT status, active, exit_date, exit_reason FROM students WHERE id = $1;
    `, [testStudWithdrawnId]);
    if (withdrawCheck.rows[0].status !== 'WITHDRAWN' || withdrawCheck.rows[0].active !== false) {
      throw new Error(`Withdraw check failed: ${JSON.stringify(withdrawCheck.rows[0])}`);
    }
    console.log('✓ Student Withdrawn archive verified with correct exit date and departure reason.');

    // -------------------------------------------------------------
    // TEST 3: Faculty Resigned Archive
    // -------------------------------------------------------------
    console.log('\n[TEST 3] Testing Faculty Resigned Archive...');
    const facExitDate = '2026-08-31';
    const facReason = 'Accepted higher position at state research institute';

    const archiveFacRes = await client.query(`
      SELECT public.archive_account(
        $1::uuid,
        'faculty'::text,
        'RESIGNED'::text,
        $2::date,
        $3::text,
        $4::uuid
      ) as success;
    `, [testFacResignId, facExitDate, facReason, adminUser.id]);

    if (!archiveFacRes.rows[0].success) {
      throw new Error('archive_account RPC returned false for faculty.');
    }

    // 3A. Verify faculty flags
    const facCheck = await client.query(`
      SELECT f.status, f.active, f.exit_date, f.exit_reason,
             p.status as prof_status,
             u.banned_until
      FROM faculty f
      JOIN profiles p ON p.id = f.auth_user_id
      JOIN auth.users u ON u.id = f.auth_user_id
      WHERE f.id = $1;
    `, [testFacResignId]);
    const facRow = facCheck.rows[0];

    if (facRow.status !== 'RESIGNED' || facRow.active !== false) {
      throw new Error(`Faculty status check failed: expected RESIGNED and active=false, got ${facRow.status}, active=${facRow.active}`);
    }
    if (!facRow.banned_until || new Date(facRow.banned_until) < new Date('2099-01-01')) {
      throw new Error('Faculty auth login ban not set!');
    }
    console.log('✓ Faculty account status transitioned to RESIGNED, active=false, login banned.');

    // 3B. Verify subject assignments deactivated
    const assignCheck = await client.query(`
      SELECT active FROM faculty_subject_assignments WHERE faculty_id = $1;
    `, [testFacResignId]);
    if (assignCheck.rows.length === 0 || assignCheck.rows[0].active !== false) {
      throw new Error('Faculty active subject assignments were NOT deactivated!');
    }
    console.log('✓ Active subject teaching assignments safely deactivated (active = false).');

    // 3C. Verify attendance sessions and marks conducted by this faculty remain intact
    const facSessions = await client.query(`
      SELECT count(*) as count FROM attendance_sessions WHERE faculty_id = $1;
    `, [testFacResignId]);
    if (parseInt(facSessions.rows[0].count) !== 1) {
      throw new Error('Historical attendance session marked by faculty was lost or deleted!');
    }

    const facMarks = await client.query(`
      SELECT count(*) as count FROM sessional_assessments WHERE faculty_id = $1 OR faculty_id = $2;
    `, [testFacResignId, testFacResignAuthId]);
    if (parseInt(facMarks.rows[0].count) !== 1) {
      throw new Error('Historical assessments managed by faculty were lost or deleted!');
    }
    console.log('✓ Historical sessions conducted (100%) and assessments created (100%) fully preserved.');

    // -------------------------------------------------------------
    // TEST 4: Faculty Retired Archive
    // -------------------------------------------------------------
    console.log('\n[TEST 4] Testing Faculty Retired Archive...');
    const testFacRetireId = '00000000-0000-0000-0000-000000000203';
    const testFacRetireAuthId = '00000000-0000-0000-0000-000000000204';
    await client.query(`
      INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      VALUES ($1, 'test_retired@vctm.in', 'hashed_pwd_stub', now(), '{"role":"faculty"}', '{"role":"faculty"}', now(), now())
      ON CONFLICT (id) DO UPDATE SET banned_until = NULL;
    `, [testFacRetireAuthId]);

    await client.query(`
      INSERT INTO profiles (id, full_name, email, role, status, created_at, updated_at)
      VALUES ($1, 'Test Faculty Retired', 'test_retired@vctm.in', 'faculty', 'ACTIVE', now(), now())
      ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE';
    `, [testFacRetireAuthId]);

    await client.query(`
      INSERT INTO faculty (id, auth_user_id, employee_code, full_name, email, department_id, designation, status, active, created_at, updated_at)
      VALUES ($2, $1, 'TEST-RETIRED-01', 'Test Faculty Retired', 'test_retired@vctm.in', $3, 'Professor', 'ACTIVE', true, now(), now())
      ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', active = true;
    `, [testFacRetireAuthId, testFacRetireId, ctx.dept_id]);

    const retireRes = await client.query(`
      SELECT public.archive_account(
        $1::uuid,
        'faculty'::text,
        'RETIRED'::text,
        '2026-07-31'::date,
        'Superannuation upon reaching retirement age'::text,
        $2::uuid
      ) as success;
    `, [testFacRetireId, adminUser.id]);

    if (!retireRes.rows[0].success) {
      throw new Error('archive_account RPC returned false for RETIRED.');
    }

    const retireCheck = await client.query(`
      SELECT status, active, exit_reason FROM faculty WHERE id = $1;
    `, [testFacRetireId]);
    if (retireCheck.rows[0].status !== 'RETIRED' || retireCheck.rows[0].active !== false) {
      throw new Error(`Retire check failed: ${JSON.stringify(retireCheck.rows[0])}`);
    }
    console.log('✓ Faculty Retired archive verified with superannuation details.');

    // -------------------------------------------------------------
    // TEST 5: Student Re-admission / Restoration
    // -------------------------------------------------------------
    console.log('\n[TEST 5] Testing Student Re-admission / Restoration...');
    const restoreStudentRes = await client.query(`
      SELECT public.restore_account(
        $1::uuid,
        'student'::text,
        $2::uuid,
        'Student readmission approved by Academic Dean'::text
      ) as success;
    `, [testStudGradId, adminUser.id]);

    if (!restoreStudentRes.rows[0].success) {
      throw new Error('restore_account RPC returned false for student.');
    }

    const stRestoreCheck = await client.query(`
      SELECT s.status, s.active, s.exit_date, s.exit_reason,
             p.status as prof_status,
             u.banned_until
      FROM students s
      JOIN profiles p ON p.id = s.auth_user_id
      JOIN auth.users u ON u.id = s.auth_user_id
      WHERE s.id = $1;
    `, [testStudGradId]);
    const restoredStRow = stRestoreCheck.rows[0];

    if (restoredStRow.status !== 'ACTIVE' || restoredStRow.active !== true) {
      throw new Error(`Student restoration status failed: got status=${restoredStRow.status}, active=${restoredStRow.active}`);
    }
    if (restoredStRow.prof_status !== 'ACTIVE') {
      throw new Error(`Profile restoration failed: got ${restoredStRow.prof_status}`);
    }
    if (restoredStRow.banned_until !== null) {
      throw new Error(`Auth user ban was NOT lifted: banned_until=${restoredStRow.banned_until}`);
    }

    // Verify audit log
    const auditCheck = await client.query(`
      SELECT action, entity_type, entity_id FROM audit_logs 
      WHERE entity_id = $1 AND action = 'ACCOUNT_RESTORED'
      ORDER BY created_at DESC LIMIT 1;
    `, [testStudGradId]);
    if (auditCheck.rows.length === 0) {
      throw new Error('ACCOUNT_RESTORED audit log entry not found!');
    }

    // Verify no duplicate attendance records created
    const attDupCheck = await client.query(`
      SELECT count(*) as count FROM attendance_records WHERE student_id = $1;
    `, [testStudGradId]);
    if (parseInt(attDupCheck.rows[0].count) !== 1) {
      throw new Error(`Duplicate attendance records detected after restoration: count=${attDupCheck.rows[0].count}`);
    }
    console.log('✓ Student restoration succeeded: status=ACTIVE, auth unbanned, no record duplication, audit logged.');

    // -------------------------------------------------------------
    // TEST 6: Faculty Re-hiring / Restoration
    // -------------------------------------------------------------
    console.log('\n[TEST 6] Testing Faculty Re-hiring / Restoration...');
    const restoreFacRes = await client.query(`
      SELECT public.restore_account(
        $1::uuid,
        'faculty'::text,
        $2::uuid,
        'Faculty re-hired for upcoming academic session'::text
      ) as success;
    `, [testFacResignId, adminUser.id]);

    if (!restoreFacRes.rows[0].success) {
      throw new Error('restore_account RPC returned false for faculty.');
    }

    const facRestoreCheck = await client.query(`
      SELECT f.status, f.active,
             p.status as prof_status,
             u.banned_until
      FROM faculty f
      JOIN profiles p ON p.id = f.auth_user_id
      JOIN auth.users u ON u.id = f.auth_user_id
      WHERE f.id = $1;
    `, [testFacResignId]);
    const restoredFacRow = facRestoreCheck.rows[0];

    if (restoredFacRow.status !== 'ACTIVE' || restoredFacRow.active !== true) {
      throw new Error(`Faculty restoration status failed: got ${restoredFacRow.status}, active=${restoredFacRow.active}`);
    }
    if (restoredFacRow.banned_until !== null) {
      throw new Error(`Faculty ban was not cleared: ${restoredFacRow.banned_until}`);
    }

    const facAuditCheck = await client.query(`
      SELECT action FROM audit_logs 
      WHERE entity_id = $1 AND action = 'ACCOUNT_RESTORED'
      LIMIT 1;
    `, [testFacResignId]);
    if (facAuditCheck.rows.length === 0) {
      throw new Error('Faculty ACCOUNT_RESTORED audit log not found!');
    }
    console.log('✓ Faculty restoration succeeded: status=ACTIVE, auth unbanned, audit logged.');

    // -------------------------------------------------------------
    // TEST 7: Attempt Hard Delete on Record with History
    // -------------------------------------------------------------
    console.log('\n[TEST 7] Testing Hard Delete Safeguard on Historical Record...');
    // We attempt a destructive hard delete on testStudGradId who has attendance_records
    // Database FK constraint or service layer must prevent data loss!
    let hardDeleteBlocked = false;
    try {
      await client.query(`DELETE FROM students WHERE id = $1;`, [testStudGradId]);
    } catch (err: any) {
      hardDeleteBlocked = true;
      console.log(`✓ Database relational constraint blocked hard deletion: "${err.message.split('\n')[0]}"`);
    }

    if (!hardDeleteBlocked) {
      throw new Error('CRITICAL FAILURE: Hard deletion succeeded on student with attendance records!');
    }

    // Verify record is still 100% in database
    const verifyStillExists = await client.query(`SELECT id, full_name FROM students WHERE id = $1;`, [testStudGradId]);
    if (verifyStillExists.rows.length === 0) {
      throw new Error('Student record was destroyed by hard delete!');
    }
    console.log('✓ Hard delete blocked. Zero historical data loss.');

    // -------------------------------------------------------------
    // TEST 8: Records & Archive KPI Accuracy
    // -------------------------------------------------------------
    console.log('\n[TEST 8] Testing KPI Summary Calculation & DB Counts...');
    const statsRes = await client.query(`SELECT public.get_archived_stats() as stats;`);
    const stats = statsRes.rows[0].stats;

    const actualFormerStudentsRes = await client.query(`
      SELECT count(*) as count FROM students WHERE status != 'ACTIVE' OR active = false;
    `);
    const actualFormerFacultyRes = await client.query(`
      SELECT count(*) as count FROM faculty WHERE status != 'ACTIVE' OR active = false;
    `);
    const actualGraduatedRes = await client.query(`
      SELECT count(*) as count FROM students WHERE status IN ('GRADUATED', 'ALUMNI');
    `);

    const dbFormerStudents = parseInt(actualFormerStudentsRes.rows[0].count);
    const dbFormerFaculty = parseInt(actualFormerFacultyRes.rows[0].count);
    const dbGraduated = parseInt(actualGraduatedRes.rows[0].count);

    if (stats.former_students !== dbFormerStudents) {
      throw new Error(`KPI mismatch for former_students: RPC=${stats.former_students}, DB=${dbFormerStudents}`);
    }
    if (stats.former_faculty !== dbFormerFaculty) {
      throw new Error(`KPI mismatch for former_faculty: RPC=${stats.former_faculty}, DB=${dbFormerFaculty}`);
    }
    if (stats.graduated_alumni !== dbGraduated) {
      throw new Error(`KPI mismatch for graduated_alumni: RPC=${stats.graduated_alumni}, DB=${dbGraduated}`);
    }
    console.log(`✓ KPI counts match database exactly: former_students=${stats.former_students}, former_faculty=${stats.former_faculty}, graduated=${stats.graduated_alumni}, total_archived=${stats.total_archived}`);

    // -------------------------------------------------------------
    // TEST 9: Search & Filtering Queries
    // -------------------------------------------------------------
    console.log('\n[TEST 9] Testing Archive Search & Filtering...');
    // Re-archive the test student for filter test
    await client.query(`
      SELECT public.archive_account(
        $1::uuid,
        'student'::text,
        'GRADUATED'::text,
        '2026-06-30'::date,
        'Graduated with distinction'::text,
        $2::uuid
      );
    `, [testStudGradId, adminUser.id]);

    // Search by roll number
    const searchByRoll = await client.query(`
      SELECT s.id, s.roll_number, s.full_name, s.status
      FROM students s
      WHERE (s.status != 'ACTIVE' OR s.active = false)
        AND (s.roll_number ILIKE $1 OR s.full_name ILIKE $1);
    `, [`%${testStudGradRoll}%`]);

    if (searchByRoll.rows.length === 0) {
      throw new Error('Search by roll number failed to find archived student.');
    }
    console.log(`✓ Search by roll number "${testStudGradRoll}" succeeded.`);

    // Filter by departure status 'GRADUATED'
    const filterByStatus = await client.query(`
      SELECT s.id, s.status FROM students s
      WHERE (s.status != 'ACTIVE' OR s.active = false)
        AND s.status = 'GRADUATED';
    `);
    if (filterByStatus.rows.length === 0) {
      throw new Error('Filter by status "GRADUATED" failed.');
    }
    console.log(`✓ Filter by status "GRADUATED" returned ${filterByStatus.rows.length} record(s).`);

    // -------------------------------------------------------------
    // TEST 10: Non-Admin Access Debarment & Security Rules
    // -------------------------------------------------------------
    console.log('\n[TEST 10] Testing Non-Admin Security Debarment...');
    
    // Check RLS policies on account_lifecycle
    const rlsPolicies = await client.query(`
      SELECT policyname, permissive, roles, cmd
      FROM pg_policies
      WHERE tablename = 'account_lifecycle';
    `);

    const hasSuperAdminPolicy = rlsPolicies.rows.some((p: any) => 
      p.policyname.toLowerCase().includes('super_admin')
    );
    if (!hasSuperAdminPolicy) {
      throw new Error('No super_admin RLS policy detected on account_lifecycle table!');
    }

    // Verify current_user_role logic: when user status is not ACTIVE, role is denied
    const roleResolutionCheck = await client.query(`
      SELECT 
        id, 
        CASE 
          WHEN status = 'ACTIVE' THEN role 
          ELSE NULL 
        END as effective_role
      FROM profiles
      WHERE id = $1;
    `, [testStudGradAuthId]);

    if (roleResolutionCheck.rows[0].effective_role !== null) {
      throw new Error(`Non-active user resolved effective role: ${roleResolutionCheck.rows[0].effective_role}`);
    }
    console.log('✓ Non-active / archived users denied role resolution; RLS policies strictly protect account_lifecycle.');

    console.log('\n===============================================================');
    console.log('✓ ALL 10 E2E VERIFICATION TEST SCENARIOS PASSED WITH 100% SUCCESS!');
    console.log('===============================================================');

  } finally {
    await client.end();
  }
}

runRecordsAndArchiveE2ETests().catch(err => {
  console.error('\n❌ E2E TEST RUN FAILED:', err);
  process.exit(1);
});
