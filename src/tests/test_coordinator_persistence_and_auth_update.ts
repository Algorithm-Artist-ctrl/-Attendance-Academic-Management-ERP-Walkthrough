import assert from 'node:assert';
import fs from 'node:fs';
import pg from 'pg';

let connectionString = process.env.DATABASE_URL || '';
if (!connectionString && fs.existsSync('.env')) {
  for (const line of fs.readFileSync('.env', 'utf-8').split('\n')) {
    if (line.startsWith('DATABASE_URL=')) {
      connectionString = line.split('DATABASE_URL=')[1].trim().replace(/['"]/g, '');
    }
  }
}

async function runTests() {
  console.log('======================================================================');
  console.log('VCTM ERP — CLASS COORDINATOR PERSISTENCE & AUTH CREDENTIALS TEST SUITE');
  console.log('======================================================================\n');

  assert(connectionString, 'DATABASE_URL is required to run live database verification');
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  await client.connect();

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Class Coordinator Atomic Removal Function
    // ------------------------------------------------------------------------
    console.log('▶ TEST 1: Verifying remove_class_coordinator_atomic persistence...');

    // Find Dr. Naseem and Section B
    const facRes = await client.query(
      "SELECT id, full_name FROM public.faculty WHERE full_name ILIKE '%Naseem%' LIMIT 1;"
    );
    assert(facRes.rows.length > 0, 'Dr. Naseem exists in faculty table');
    const naseemId = facRes.rows[0].id;

    const secRes = await client.query(
      "SELECT id, name, room_number, class_coordinator_id FROM public.sections WHERE name = 'B' AND room_number = 'A006' LIMIT 1;"
    );
    assert(secRes.rows.length > 0, 'Section B (A006) exists in sections table');
    const secBId = secRes.rows[0].id;

    // Simulate assigning Naseem as coordinator first to test clean atomic removal
    await client.query(
      `UPDATE public.sections SET class_coordinator_id = $1 WHERE id = $2;`,
      [naseemId, secBId]
    );
    await client.query(
      `DELETE FROM public.class_coordinator_assignments WHERE section_id = $1;`,
      [secBId]
    );
    await client.query(
      `INSERT INTO public.class_coordinator_assignments (faculty_id, section_id, active, updated_at)
       VALUES ($1, $2, true, NOW());`,
      [naseemId, secBId]
    );

    // Verify assigned
    const checkAssignedSec = await client.query(
      `SELECT class_coordinator_id FROM public.sections WHERE id = $1;`,
      [secBId]
    );
    assert.strictEqual(checkAssignedSec.rows[0].class_coordinator_id, naseemId, 'Section B has Naseem as coordinator');

    // Run remove_class_coordinator_atomic
    const removeRes = await client.query(
      `SELECT public.remove_class_coordinator_atomic($1, $2) AS result;`,
      [naseemId, secBId]
    );
    const resultJson = removeRes.rows[0].result;
    assert.strictEqual(resultJson.success, true, 'remove_class_coordinator_atomic returned success');

    // Verify sections.class_coordinator_id is NULL
    const checkClearedSec = await client.query(
      `SELECT class_coordinator_id FROM public.sections WHERE id = $1;`,
      [secBId]
    );
    assert.strictEqual(
      checkClearedSec.rows[0].class_coordinator_id,
      null,
      'sections.class_coordinator_id is guaranteed NULL in database'
    );

    // Verify class_coordinator_assignments is active = false
    const checkCca = await client.query(
      `SELECT active FROM public.class_coordinator_assignments WHERE section_id = $1 AND faculty_id = $2;`,
      [secBId, naseemId]
    );
    assert.strictEqual(
      checkCca.rows[0].active,
      false,
      'class_coordinator_assignments.active is guaranteed false in database'
    );

    console.log('✅ TEST 1 PASSED: Class coordinator atomic removal thoroughly persists in real DB.\n');

    // ------------------------------------------------------------------------
    // TEST 2: Real Supabase Auth & Profile Email Synchronization via RPC
    // ------------------------------------------------------------------------
    console.log('▶ TEST 2: Verifying admin_update_account_credentials RPC email & identity sync...');

    const originalEmail = 'naseem.math@vctm.in';
    const tempUpdatedEmail = 'dr.naseem.test@vctm.in';

    // Call admin_update_account_credentials with target faculty
    const updateRes = await client.query(
      `SELECT public.admin_update_account_credentials($1, $2, NULL, false, $3, $4, $5) AS res;`,
      [
        naseemId,
        tempUpdatedEmail,
        naseemId,
        'Super Admin Test',
        'super_admin'
      ]
    );
    const updateJson = updateRes.rows[0].res;
    assert.strictEqual(updateJson.success, true, 'admin_update_account_credentials returned success');
    assert.strictEqual(updateJson.email, tempUpdatedEmail, 'Returned email matches new email');

    // Verify auth.users
    const authCheck = await client.query(
      `SELECT email, raw_user_meta_data->>'email' AS meta_email FROM auth.users WHERE id = $1;`,
      [naseemId]
    );
    assert.strictEqual(authCheck.rows[0].email, tempUpdatedEmail, 'auth.users email updated in database');
    assert.strictEqual(authCheck.rows[0].meta_email, tempUpdatedEmail, 'auth.users user_metadata email updated');

    // Verify auth.identities
    const identCheck = await client.query(
      `SELECT identity_data->>'email' AS ident_email FROM auth.identities WHERE user_id = $1;`,
      [naseemId]
    );
    assert.strictEqual(identCheck.rows[0].ident_email, tempUpdatedEmail, 'auth.identities email updated');

    // Verify public.profiles
    const profCheck = await client.query(
      `SELECT email FROM public.profiles WHERE id = $1;`,
      [naseemId]
    );
    assert.strictEqual(profCheck.rows[0].email, tempUpdatedEmail, 'public.profiles email updated');

    // Verify public.faculty
    const facEmailCheck = await client.query(
      `SELECT email FROM public.faculty WHERE id = $1;`,
      [naseemId]
    );
    assert.strictEqual(facEmailCheck.rows[0].email, tempUpdatedEmail, 'public.faculty email updated');

    // Revert back to original email
    const revertRes = await client.query(
      `SELECT public.admin_update_account_credentials($1, $2, NULL, false, $3, $4, $5) AS res;`,
      [
        naseemId,
        originalEmail,
        naseemId,
        'Super Admin Test',
        'super_admin'
      ]
    );
    assert.strictEqual(revertRes.rows[0].res.success, true, 'Successfully reverted email to original');

    const revertedCheck = await client.query(
      `SELECT email FROM auth.users WHERE id = $1;`,
      [naseemId]
    );
    assert.strictEqual(revertedCheck.rows[0].email, originalEmail, 'Reverted email matches original');

    console.log('✅ TEST 2 PASSED: Real auth credentials, identities, profiles, and faculty records synchronize.\n');

    console.log('======================================================================');
    console.log('🎉 ALL PERSISTENCE AND AUTH CREDENTIAL TESTS PASSED SUCCESSFULLY!');
    console.log('======================================================================');
  } finally {
    await client.end();
  }
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
