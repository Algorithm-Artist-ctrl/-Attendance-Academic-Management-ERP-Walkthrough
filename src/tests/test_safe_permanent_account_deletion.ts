import pg from 'pg';

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('=== RUNNING SAFE PERMANENT ACCOUNT DELETION TEST SUITE ===\n');

  let passedTests = 0;
  let totalTests = 0;

  // --------------------------------------------------------------------------
  // TEST 1: Faculty With Attendance Records (Mayank Varshney scenario)
  // --------------------------------------------------------------------------
  totalTests++;
  console.log('--- TEST 1: Faculty with Student Attendance Records ---');
  await client.query('BEGIN');
  try {
    const mayankId = 'e659cb84-2903-4f98-884f-e4871be92d28';
    const actorId = '7adf0a3f-539f-4850-bed1-1dc43895fd85';

    // Verify initial attendance record exists
    const beforeAtt = await client.query(
      `SELECT id, student_id, marked_by, remarks FROM public.attendance_records WHERE marked_by = $1`,
      [mayankId]
    );
    console.log(`Found ${beforeAtt.rowCount} attendance records marked by Mayank Varshney.`);

    // Call RPC
    const rpcRes = await client.query(
      `SELECT public.permanent_delete_archived_account($1, 'faculty', $2) AS result`,
      [mayankId, actorId]
    );
    const result = rpcRes.rows[0].result;
    console.log('RPC execution result:', result);

    if (!result.success) {
      throw new Error(`RPC reported failure: ${JSON.stringify(result)}`);
    }

    // Verify faculty row is deleted
    const checkFac = await client.query(`SELECT id FROM public.faculty WHERE id = $1`, [mayankId]);
    if (checkFac.rowCount !== 0) {
      throw new Error('Faculty row was not deleted from public.faculty!');
    }
    console.log('✓ Faculty row successfully deleted from public.faculty.');

    // Verify Mukul Agrawal attendance record was NOT deleted and has NOT NULL marked_by
    const checkAtt = await client.query(
      `SELECT ar.id, ar.status, ar.marked_by, ar.remarks, f.full_name as marked_by_name
       FROM public.attendance_records ar
       JOIN public.faculty f ON f.id = ar.marked_by
       WHERE ar.id = '6a990722-2a79-4778-9609-c55124509ce7'`
    );
    if (checkAtt.rowCount === 0) {
      throw new Error('Mukul Agrawal attendance record was deleted! Academic history destroyed!');
    }
    const rec = checkAtt.rows[0];
    if (!rec.marked_by) {
      throw new Error('attendance_records.marked_by was nullified!');
    }
    if (rec.marked_by !== '00000000-0000-0000-0000-0000000000aa') {
      throw new Error(`Unexpected marked_by value: ${rec.marked_by}`);
    }
    console.log('✓ Student attendance record PRESERVED with intact marked_by FK:', rec);

    // Verify attendance session was NOT deleted
    const checkSess = await client.query(
      `SELECT ass.id, ass.faculty_id, f.full_name as faculty_name
       FROM public.attendance_sessions ass
       JOIN public.faculty f ON f.id = ass.faculty_id
       WHERE ass.id = '20142f83-2aab-4edf-bb37-37dee753a08f'`
    );
    if (checkSess.rowCount === 0) {
      throw new Error('Attendance session was deleted!');
    }
    console.log('✓ Attendance session PRESERVED under Institutional Archive:', checkSess.rows[0]);

    // Verify audit log entry
    const auditRes = await client.query(
      `SELECT action, entity_type, entity_id, new_values
       FROM public.audit_logs
       WHERE entity_id = $1 AND action = 'PERMANENT_DELETE'
       ORDER BY created_at DESC LIMIT 1`,
      [mayankId]
    );
    if (auditRes.rowCount === 0) {
      throw new Error('Audit log entry was not created!');
    }
    console.log('✓ Audit log entry created:', auditRes.rows[0].new_values);

    console.log('✓ TEST 1 PASSED: Faculty with attendance deleted safely without academic data loss.\n');
    passedTests++;
  } catch (err: any) {
    console.error('✗ TEST 1 FAILED:', err.message);
  } finally {
    await client.query('ROLLBACK');
    console.log('Test 1 transaction rolled back.\n');
  }

  // --------------------------------------------------------------------------
  // TEST 2: Faculty With Zero Dependencies (Test Faculty Retired)
  // --------------------------------------------------------------------------
  totalTests++;
  console.log('--- TEST 2: Faculty with Zero Dependencies ---');
  await client.query('BEGIN');
  try {
    const retiredId = '00000000-0000-0000-0000-000000000203';
    const actorId = '7adf0a3f-539f-4850-bed1-1dc43895fd85';

    const rpcRes = await client.query(
      `SELECT public.permanent_delete_archived_account($1, 'faculty', $2) AS result`,
      [retiredId, actorId]
    );
    const result = rpcRes.rows[0].result;
    console.log('RPC execution result:', result);

    if (!result.success) {
      throw new Error(`RPC reported failure: ${JSON.stringify(result)}`);
    }

    const checkFac = await client.query(`SELECT id FROM public.faculty WHERE id = $1`, [retiredId]);
    if (checkFac.rowCount !== 0) {
      throw new Error('Retired faculty row was not deleted!');
    }
    console.log('✓ Retired faculty row deleted completely.');

    console.log('✓ TEST 2 PASSED: Faculty with 0 dependencies deleted cleanly.\n');
    passedTests++;
  } catch (err: any) {
    console.error('✗ TEST 2 FAILED:', err.message);
  } finally {
    await client.query('ROLLBACK');
    console.log('Test 2 transaction rolled back.\n');
  }

  // --------------------------------------------------------------------------
  // TEST 3: Active Faculty Safeguard (Active account deletion rejected)
  // --------------------------------------------------------------------------
  totalTests++;
  console.log('--- TEST 3: Active Faculty Safety Guard ---');
  try {
    const activeFacId = 'd515287a-d613-49d6-a163-691dc6cfa74a'; // Dr. Abhishek Garg (ACTIVE)
    const actorId = '7adf0a3f-539f-4850-bed1-1dc43895fd85';

    let errorThrown = false;
    try {
      await client.query(
        `SELECT public.permanent_delete_archived_account($1, 'faculty', $2) AS result`,
        [activeFacId, actorId]
      );
    } catch (err: any) {
      errorThrown = true;
      if (!err.message.includes('Account is active')) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
      console.log('✓ Caught expected safety error:', err.message);
    }

    if (!errorThrown) {
      throw new Error('Active faculty account deletion was not blocked!');
    }

    console.log('✓ TEST 3 PASSED: Active accounts are strictly protected from permanent deletion.\n');
    passedTests++;
  } catch (err: any) {
    console.error('✗ TEST 3 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Archived Stats Calculation (Excludes ARCHIVED-SYSTEM actor)
  // --------------------------------------------------------------------------
  totalTests++;
  console.log('--- TEST 4: Archived Stats Calculation ---');
  try {
    const statsRes = await client.query(`SELECT public.get_archived_stats() AS stats`);
    const stats = statsRes.rows[0].stats;
    console.log('Stats returned:', stats);

    // Verify stats does not count ARCHIVED-SYSTEM
    const countCheck = await client.query(`
      SELECT count(*) as total
      FROM public.faculty
      WHERE (status != 'ACTIVE' OR active = false) AND employee_code != 'ARCHIVED-SYSTEM'
    `);
    const expectedFormerFaculty = parseInt(countCheck.rows[0].total, 10);
    if (stats.former_faculty !== expectedFormerFaculty) {
      throw new Error(
        `former_faculty in stats (${stats.former_faculty}) did not match expected count (${expectedFormerFaculty})!`
      );
    }

    console.log(`✓ former_faculty (${stats.former_faculty}) correctly excludes system archive actor.`);
    console.log('✓ TEST 4 PASSED: Archived stats accurate.\n');
    passedTests++;
  } catch (err: any) {
    console.error('✗ TEST 4 FAILED:', err.message);
  }

  console.log('==================================================');
  console.log(`TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('==================================================');

  await client.end();

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
