import { Client } from 'pg';
import fs from 'fs';

let connectionString = process.env.DATABASE_URL;
if (!connectionString && fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  const match = envContent.match(/^DATABASE_URL\s*=\s*(.*)$/m);
  if (match) {
    connectionString = match[1].trim().replace(/^["']|["']$/g, '');
  }
}

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required.');
}

async function runVerificationTests() {
  console.log('========================================================================');
  console.log('  TEST SUITE: Super Admin Academic Management & Bulk Student Promotion');
  console.log('========================================================================\n');

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Verify check_section_references RPC
    // -------------------------------------------------------------------------
    console.log('TEST 1: Verifying check_section_references RPC on existing active section...');
    const secRes = await client.query(`
      SELECT s.id, s.name, sem.name as sem_name, (
        SELECT COUNT(*) FROM public.students st WHERE st.section_id = s.id
      ) as actual_students
      FROM public.sections s
      JOIN public.semesters sem ON sem.id = s.semester_id
      LIMIT 1;
    `);

    if (secRes.rows.length === 0) {
      throw new Error('No section found for testing.');
    }

    const testSec = secRes.rows[0];
    console.log(`Testing section "${testSec.name}" (${testSec.sem_name}), actual student count: ${testSec.actual_students}`);

    const rpcRes = await client.query(`SELECT public.check_section_references($1) as result;`, [testSec.id]);
    const refData = rpcRes.rows[0].result;
    console.log('RPC check_section_references output:', JSON.stringify(refData));

    if (refData.student_count !== parseInt(testSec.actual_students, 10)) {
      throw new Error(`Mismatch in student_count: expected ${testSec.actual_students}, got ${refData.student_count}`);
    }

    if (parseInt(testSec.actual_students, 10) > 0 && refData.can_hard_delete !== false) {
      throw new Error('Safeguard check failed: section with students should have can_hard_delete = false');
    }
    console.log('✅ TEST 1 PASSED: check_section_references correctly audits relational references!\n');

    // -------------------------------------------------------------------------
    // TEST 2: Test check_section_references on a newly created empty section
    // -------------------------------------------------------------------------
    console.log('TEST 2: Verifying check_section_references on a newly created empty section...');
    const insertEmptySec = await client.query(`
      INSERT INTO public.sections (id, semester_id, name, room_number, active)
      VALUES (gen_random_uuid(), (SELECT id FROM public.semesters LIMIT 1), 'TEST_TEMP', 'ROOM-999', true)
      RETURNING id, name;
    `);
    const emptySecId = insertEmptySec.rows[0].id;

    const rpcEmptyRes = await client.query(`SELECT public.check_section_references($1) as result;`, [emptySecId]);
    const emptyRefData = rpcEmptyRes.rows[0].result;
    console.log('Empty section references result:', JSON.stringify(emptyRefData));

    if (emptyRefData.total_references !== 0 || emptyRefData.can_hard_delete !== true) {
      throw new Error('Empty section should have total_references = 0 and can_hard_delete = true');
    }

    // Clean up temporary section
    await client.query(`DELETE FROM public.sections WHERE id = $1;`, [emptySecId]);
    console.log('✅ TEST 2 PASSED: Empty sections can be safely hard deleted without references!\n');

    // -------------------------------------------------------------------------
    // TEST 3: Verify promote_students_bulk RPC Transaction and History Recording
    // -------------------------------------------------------------------------
    console.log('TEST 3: Verifying atomic promote_students_bulk RPC...');
    
    // Find a student to perform a controlled promotion test
    const studRes = await client.query(`
      SELECT id, full_name, roll_number, academic_year_id, semester_id, section_id, academic_session_id, status
      FROM public.students 
      ORDER BY id
      LIMIT 1;
    `);

    if (studRes.rows.length === 0) {
      throw new Error('No students found for promotion test.');
    }

    const testStudent = studRes.rows[0];
    const initialStudentId = testStudent.id;
    const initialRollNumber = testStudent.roll_number;
    console.log(`Selected Student: ${testStudent.full_name} (${testStudent.roll_number})`);
    console.log(`Initial Year: ${testStudent.academic_year_id}, Section: ${testStudent.section_id}`);

    // Get an alternate or target section
    const targetSecRes = await client.query(`
      SELECT id, semester_id FROM public.sections WHERE id <> $1 AND active = true LIMIT 1;
    `, [testStudent.section_id]);

    if (targetSecRes.rows.length === 0) {
      throw new Error('No target section found for testing.');
    }
    const targetSection = targetSecRes.rows[0];

    // Clean any previous test history for this student
    await client.query(`DELETE FROM public.student_academic_history WHERE student_id = $1;`, [initialStudentId]);

    // Build payload
    const testPayload = {
      source_academic_year_id: testStudent.academic_year_id,
      target_academic_year_id: testStudent.academic_year_id,
      source_academic_session_id: testStudent.academic_session_id,
      target_academic_session_id: testStudent.academic_session_id,
      target_semester_id: targetSection.semester_id,
      notes: 'Automated E2E Test Promotion Batch',
      students: [
        {
          student_id: testStudent.id,
          action: 'PROMOTE',
          target_section_id: targetSection.id,
          target_semester_id: targetSection.semester_id,
          target_academic_year_id: testStudent.academic_year_id,
          remarks: 'E2E Promotion Test to Target Section'
        }
      ]
    };

    const promoRpcRes = await client.query(`
      SELECT public.promote_students_bulk($1, NULL, 'Test Super Admin') as result;
    `, [JSON.stringify(testPayload)]);

    const promoResult = promoRpcRes.rows[0].result;
    console.log('promote_students_bulk RPC returned:', JSON.stringify(promoResult));

    if (!promoResult.success || promoResult.promoted_count !== 1) {
      throw new Error('promote_students_bulk did not succeed or promoted_count !== 1');
    }

    // Verify student was updated in place and permanent identity was preserved
    const afterStudRes = await client.query(`
      SELECT id, full_name, roll_number, section_id, semester_id, status 
      FROM public.students 
      WHERE id = $1;
    `, [initialStudentId]);

    const updatedStudent = afterStudRes.rows[0];
    console.log(`Updated Student Section: ${updatedStudent.section_id}, Expected: ${targetSection.id}`);

    if (updatedStudent.id !== initialStudentId) {
      throw new Error('CRITICAL: Student ID was altered during promotion!');
    }
    if (updatedStudent.roll_number !== initialRollNumber) {
      throw new Error('CRITICAL: Student roll_number was altered during promotion!');
    }
    if (updatedStudent.section_id !== targetSection.id) {
      throw new Error(`Student section was not updated to ${targetSection.id}`);
    }

    // Verify history logs created in student_academic_history
    const historyRes = await client.query(`
      SELECT id, promotion_action, promotion_batch_id, remarks, created_at
      FROM public.student_academic_history
      WHERE student_id = $1
      ORDER BY created_at DESC, (CASE WHEN promotion_action = 'INITIAL_ENROLLMENT' THEN 1 ELSE 0 END) ASC;
    `, [initialStudentId]);

    console.log(`Student Academic History records count: ${historyRes.rows.length}`);
    console.table(historyRes.rows);

    const latestHistory = historyRes.rows[0];
    if (latestHistory.promotion_action !== 'PROMOTED') {
      throw new Error(`Latest history promotion_action should be PROMOTED, got ${latestHistory.promotion_action}`);
    }
    if (latestHistory.promotion_batch_id !== promoResult.batch_id) {
      throw new Error(`History batch ID mismatch: expected ${promoResult.batch_id}, got ${latestHistory.promotion_batch_id}`);
    }

    // Verify batch audit record in promotion_batches
    const batchRes = await client.query(`
      SELECT id, batch_number, total_students, promoted_count, performed_by_name, created_at
      FROM public.promotion_batches
      WHERE id = $1;
    `, [promoResult.batch_id]);

    if (batchRes.rows.length === 0) {
      throw new Error('Promotion batch record was not inserted into promotion_batches');
    }
    console.log('Verified promotion_batches record:', JSON.stringify(batchRes.rows[0]));

    // Revert student to original section to keep database pristine
    await client.query(`
      UPDATE public.students
      SET section_id = $1, semester_id = $2
      WHERE id = $3;
    `, [testStudent.section_id, testStudent.semester_id, initialStudentId]);
    console.log('Reverted student placement to original section for cleanliness.');

    console.log('✅ TEST 3 PASSED: promote_students_bulk executed atomically, updated placement, and logged full academic history!\n');

    // -------------------------------------------------------------------------
    // TEST 4: Verify Student Graduation Status Constraint & Promotion
    // -------------------------------------------------------------------------
    console.log('TEST 4: Verifying Final-Year Graduation handling & status constraint...');
    const gradPayload = {
      source_academic_year_id: testStudent.academic_year_id,
      notes: 'Graduation Test',
      students: [
        {
          student_id: testStudent.id,
          action: 'GRADUATE',
          remarks: 'Completed Bachelor of Technology'
        }
      ]
    };

    const gradRpcRes = await client.query(`
      SELECT public.promote_students_bulk($1, NULL, 'Test Super Admin') as result;
    `, [JSON.stringify(gradPayload)]);

    const gradResult = gradRpcRes.rows[0].result;
    console.log('Graduation RPC result:', JSON.stringify(gradResult));

    if (gradResult.graduated_count !== 1) {
      throw new Error('Graduation RPC did not record graduated_count = 1');
    }

    const checkGradStatus = await client.query(`
      SELECT status FROM public.students WHERE id = $1;
    `, [initialStudentId]);

    if (checkGradStatus.rows[0].status !== 'GRADUATED') {
      throw new Error(`Student status should be GRADUATED, got ${checkGradStatus.rows[0].status}`);
    }

    // Revert student status back to ACTIVE
    await client.query(`
      UPDATE public.students SET status = 'ACTIVE' WHERE id = $1;
    `, [initialStudentId]);
    console.log('Reverted student status back to ACTIVE.');

    console.log('✅ TEST 4 PASSED: Student Graduation status updated and validated against constraint!\n');

    console.log('========================================================================');
    console.log('  🎉 ALL ACADEMIC MANAGEMENT & PROMOTION TESTS PASSED (100% SUCCESS) 🎉');
    console.log('========================================================================\n');
  } catch (err: any) {
    console.error('❌ Test failed with error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('Database connection closed cleanly.');
  }
}

runVerificationTests();
