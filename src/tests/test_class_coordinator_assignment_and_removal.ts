import fs from 'fs';
import pg from 'pg';
import { supabaseService } from '../lib/services/supabaseService';

let cs = process.env.DATABASE_URL || '';
if (!cs && fs.existsSync('.env')) {
  for (const line of fs.readFileSync('.env', 'utf-8').split('\n')) {
    if (line.startsWith('DATABASE_URL=')) cs = line.split('DATABASE_URL=')[1].trim().replace(/['"]/g, '');
  }
}

async function runCoordinatorTests() {
  console.log('======================================================================');
  console.log('  VCTM ERP — CLASS COORDINATOR ASSIGNMENT & REMOVAL E2E VERIFICATION  ');
  console.log('======================================================================\n');

  const client = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
  await client.connect();

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`, detail || '');
      process.exitCode = 1;
    }
  }

  try {
    // 0. Locate 2nd Year Section B and test faculty
    const secB = (await client.query(`
      SELECT s.id, s.name as section_name, ay.name as year_name
      FROM public.sections s
      JOIN public.semesters sem ON sem.id = s.semester_id
      JOIN public.academic_years ay ON ay.id = sem.academic_year_id
      WHERE ay.year_number = 2 AND s.name = 'B'
      LIMIT 1;
    `)).rows[0];

    assert(Boolean(secB), 'Resolved 2nd Year Section B in database');
    const secBId = secB.id;

    const secA = (await client.query(`
      SELECT s.id, s.name as section_name, ay.name as year_name
      FROM public.sections s
      JOIN public.semesters sem ON sem.id = s.semester_id
      JOIN public.academic_years ay ON ay.id = sem.academic_year_id
      WHERE ay.year_number = 4 AND s.name = 'A'
      LIMIT 1;
    `)).rows[0];
    const secAId = secA.id;

    // Faculty 1: Dr. Abhishek Garg
    const fac1 = (await client.query("SELECT id, full_name, email FROM public.faculty WHERE email = 'abhishek.cse@vctm.in' LIMIT 1;")).rows[0];
    assert(Boolean(fac1), 'Resolved Faculty 1 (Dr. Abhishek Garg)');

    // Faculty 2: Dr. Naseem Ahamad Khan
    const fac2 = (await client.query("SELECT id, full_name, email FROM public.faculty WHERE email = 'naseem.math@vctm.in' LIMIT 1;")).rows[0];
    assert(Boolean(fac2), 'Resolved Faculty 2 (Dr. Naseem Ahamad Khan)');

    // Set authenticated session as HOD (Wasim Akram - waseem.cse@vctm.in)
    await client.query("SELECT set_config('request.jwt.claims', $1, false);", [
      JSON.stringify({ sub: 'd97b0c91-91bd-4414-9c9a-315139e752c3', role: 'authenticated' })
    ]);

    // Clean initial state for secBId and secAId
    await client.query("UPDATE public.sections SET class_coordinator_id = NULL WHERE id IN ($1, $2);", [secBId, secAId]);
    await client.query("UPDATE public.class_coordinator_assignments SET active = false WHERE section_id IN ($1, $2);", [secBId, secAId]);

    // Helper to invoke atomic RPC with current session context
    async function execAssignCoord(facultyId: string, sectionId: string) {
      const res = await client.query("SELECT public.assign_class_coordinator_atomic($1, $2) as result;", [facultyId, sectionId]);
      const data = res.rows[0].result;
      return {
        success: data.success,
        replacedFacultyId: data.replaced_faculty_id,
        replacedFacultyName: data.replaced_faculty_name
      };
    }

    async function execRemoveCoord(facultyId: string, sectionId: string) {
      const res = await client.query("SELECT public.remove_class_coordinator_atomic($1, $2) as result;", [facultyId, sectionId]);
      const data = res.rows[0].result;
      return {
        success: data.success
      };
    }

    // ------------------------------------------------------------------
    // TEST 1: Assign Faculty 1 as Class Coordinator to 2nd Year Section B
    // ------------------------------------------------------------------
    console.log('\n--- TEST 1: Assign Coordinator to 2nd Year Section B ---');
    const assignRes1 = await execAssignCoord(fac1.id, secBId);
    assert(assignRes1.success === true, 'assign_class_coordinator_atomic returns success');

    const dbSecAfterAssign1 = (await client.query("SELECT class_coordinator_id FROM public.sections WHERE id = $1;", [secBId])).rows[0];
    assert(dbSecAfterAssign1.class_coordinator_id === fac1.id, `sections.class_coordinator_id correctly points to ${fac1.full_name}`);

    const dbCcaAfterAssign1 = (await client.query(
      "SELECT id, faculty_id, active FROM public.class_coordinator_assignments WHERE section_id = $1 AND active = true;",
      [secBId]
    )).rows;
    assert(dbCcaAfterAssign1.length === 1, 'Exactly 1 active class_coordinator_assignment exists');
    assert(dbCcaAfterAssign1[0].faculty_id === fac1.id, 'class_coordinator_assignments points to Faculty 1');

    const fetchCoords1 = await supabaseService.fetchClassCoordinatorAssignments(fac1.id);
    assert(fetchCoords1.some(c => c.section_id === secBId && c.active), 'fetchClassCoordinatorAssignments confirms active assignment in persistence cache');

    // ------------------------------------------------------------------
    // TEST 2: Remove Coordinator from 2nd Year Section B
    // ------------------------------------------------------------------
    console.log('\n--- TEST 2: Remove Coordinator from 2nd Year Section B ---');
    const removeRes1 = await execRemoveCoord(fac1.id, secBId);
    assert(removeRes1.success === true, 'remove_class_coordinator_atomic returns success');

    const dbSecAfterRemove1 = (await client.query("SELECT class_coordinator_id FROM public.sections WHERE id = $1;", [secBId])).rows[0];
    assert(dbSecAfterRemove1.class_coordinator_id === null, 'sections.class_coordinator_id is cleared to NULL');

    const dbCcaAfterRemove1 = (await client.query(
      "SELECT id, faculty_id, active FROM public.class_coordinator_assignments WHERE section_id = $1 AND active = true;",
      [secBId]
    )).rows;
    assert(dbCcaAfterRemove1.length === 0, 'No active class_coordinator_assignment exists for this section');

    const fetchCoordsAfterRemove = await supabaseService.fetchClassCoordinatorAssignments(fac1.id);
    assert(!fetchCoordsAfterRemove.some(c => c.section_id === secBId), 'fetchClassCoordinatorAssignments confirms assignment is inactive');

    // ------------------------------------------------------------------
    // TEST 3: Assign Different Faculty to Another Year + Section (Independence)
    // ------------------------------------------------------------------
    console.log('\n--- TEST 3: Multiple Independent Coordinator Assignments ---');
    // Assign Faculty 1 to Sec B
    await execAssignCoord(fac1.id, secBId);
    // Assign Faculty 2 to Sec A
    const assignRes2 = await execAssignCoord(fac2.id, secAId);
    assert(assignRes2.success === true, 'Assigned Faculty 2 to 4th Year Section A');

    const activeSecB = (await client.query("SELECT class_coordinator_id FROM public.sections WHERE id = $1;", [secBId])).rows[0];
    const activeSecA = (await client.query("SELECT class_coordinator_id FROM public.sections WHERE id = $1;", [secAId])).rows[0];
    assert(activeSecB.class_coordinator_id === fac1.id, 'Section B coordinator remains Faculty 1');
    assert(activeSecA.class_coordinator_id === fac2.id, 'Section A coordinator is Faculty 2');

    // Remove Section B coordinator; Section A MUST remain untouched
    await execRemoveCoord(fac1.id, secBId);
    const secAStillActive = (await client.query("SELECT class_coordinator_id FROM public.sections WHERE id = $1;", [secAId])).rows[0];
    assert(secAStillActive.class_coordinator_id === fac2.id, 'Unrelated Section A coordinator remains completely unaffected');

    // ------------------------------------------------------------------
    // TEST 4: Unauthorized Role Rejection in RPC
    // ------------------------------------------------------------------
    console.log('\n--- TEST 4: Unauthorized Role Enforcement ---');
    let rejected = false;
    let errorMsg = '';
    try {
      // Simulate an unprivileged student session context in postgres
      await client.query("SELECT set_config('request.jwt.claims', $1, false);", [
        JSON.stringify({ sub: '00000000-0000-0000-0000-000000000001', role: 'authenticated' })
      ]);
      await client.query("SELECT public.assign_class_coordinator_atomic($1, $2);", [fac1.id, secBId]);
    } catch (authErr: any) {
      rejected = true;
      errorMsg = authErr.message;
    } finally {
      // Restore HOD session context
      await client.query("SELECT set_config('request.jwt.claims', $1, false);", [
        JSON.stringify({ sub: 'd97b0c91-91bd-4414-9c9a-315139e752c3', role: 'authenticated' })
      ]);
    }
    assert(rejected === true, 'Unauthorized caller was rejected');
    assert(errorMsg.includes('Unauthorized'), `Error message contains Unauthorized: ${errorMsg}`);

    // ------------------------------------------------------------------
    // TEST 5: Duplicate Conflict Handling & Section Coordinator Replacement
    // ------------------------------------------------------------------
    console.log('\n--- TEST 5: Safe Coordinator Replacement & Uniqueness ---');
    // First, assign Faculty 1 to Sec B
    await execAssignCoord(fac1.id, secBId);

    // Now, assign Faculty 2 to the EXACT SAME section (Sec B)
    const replaceRes = await execAssignCoord(fac2.id, secBId);
    assert(replaceRes.success === true, 'Replacement assignment succeeded');
    assert(replaceRes.replacedFacultyId === fac1.id, `Correctly identified replaced faculty: ${replaceRes.replacedFacultyName}`);

    const secBUpdated = (await client.query("SELECT class_coordinator_id FROM public.sections WHERE id = $1;", [secBId])).rows[0];
    assert(secBUpdated.class_coordinator_id === fac2.id, 'Section B now points to new coordinator (Faculty 2)');

    const activeAssignments = (await client.query(
      "SELECT id, faculty_id, active FROM public.class_coordinator_assignments WHERE section_id = $1 AND active = true;",
      [secBId]
    )).rows;
    assert(activeAssignments.length === 1, 'Database constraint guarantees EXACTLY 1 active assignment for this section');
    assert(activeAssignments[0].faculty_id === fac2.id, 'The active assignment belongs to Faculty 2');

    const previousAssignment = (await client.query(
      "SELECT id, faculty_id, active FROM public.class_coordinator_assignments WHERE section_id = $1 AND faculty_id = $2;",
      [secBId, fac1.id]
    )).rows[0];
    assert(previousAssignment.active === false, 'Previous coordinator assignment was cleanly deactivated (active = false)');

    // Final cleanup: remove test assignment from secBId and secAId
    await execRemoveCoord(fac2.id, secBId);
    await execRemoveCoord(fac2.id, secAId);
    console.log('\nCleaned up test assignments.');

    console.log('\n======================================================================');
    console.log(`RESULTS: ${passed}/${total} TESTS PASSED`);
    console.log('======================================================================');
    process.exit(passed === total ? 0 : 1);
  } finally {
    await client.end();
  }
}

runCoordinatorTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
