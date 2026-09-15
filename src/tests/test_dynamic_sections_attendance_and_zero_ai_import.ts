import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import { studentSyncService } from '../lib/services/studentSyncService';
import { csvTimetableService } from '../lib/services/csvTimetableService';
import { Section, AttendanceStatus } from '../types/database.types';

async function runDynamicSectionAndAttendanceTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING DYNAMIC SECTIONS, ATTENDANCE & ZERO-AI IMPORT TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${details ? `: ${details}` : ''}`);
      failed++;
    }
  }

  try {
    // ── 1. Fetch reference semester for tests ──
    const { data: sems, error: sErr } = await supabase
      .from('semesters')
      .select('*')
      .order('semester_number');
    
    assert(!sErr && sems && sems.length > 0, 'Test 1: Semesters loaded from Supabase', `Found ${sems?.length} semesters`);
    const targetSem = sems?.[0];
    if (!targetSem) throw new Error('No semesters found in database.');

    // ── 2. Test Dynamic Section Addition & Deduplication ──
    const testSecName = `TEST_DYN_${Date.now().toString().slice(-4)}`;
    const createdSec = await supabaseService.addSection({
      semester_id: targetSem.id,
      name: testSecName,
      room_number: 'Room 999',
      active: true,
    });

    assert(!!createdSec && createdSec.name === testSecName, 'Test 2: Dynamic section created in Supabase', `Created ID: ${createdSec?.id}`);

    // Test deduplication
    const duplicateSec = await supabaseService.addSection({
      semester_id: targetSem.id,
      name: testSecName,
      room_number: 'Room 999-dup',
      active: true,
    });

    assert(duplicateSec.id === createdSec.id, 'Test 3: Duplicate section creation safely returns existing record', `Expected ${createdSec.id}, got ${duplicateSec.id}`);

    // ── 3. Test Soft-Archiving vs Hard Delete ──
    // First, delete empty section -> should delete cleanly
    await supabaseService.deleteSection(createdSec.id);
    const { data: checkDeleted } = await supabase
      .from('sections')
      .select('*')
      .eq('id', createdSec.id)
      .maybeSingle();

    assert(!checkDeleted, 'Test 4: Section without referencing records deleted from database');

    // ── 4. Test Zero AI Student CSV Validation & Detection of New Sections ──
    const csvWithNewSection = `roll_no,name,email,department,year,section,admission_type
TEST_9901,Zero AI Student 1,test9901@student.vctm.in,CSE,1,NEW_SEC_K,Regular
TEST_9902,Zero AI Student 2,test9902@student.vctm.in,CSE,1,NEW_SEC_K,Regular`;

    const validationReport = await studentSyncService.validateStudentsCSV(csvWithNewSection);
    assert(validationReport.totalRows === 2, 'Test 5: PapaParse parsed 2 rows deterministically without AI');
    assert(
      validationReport.detectedNewSections.some(s => s.sectionName === 'NEW_SEC_K'),
      'Test 6: Detected new section NEW_SEC_K in validation report',
      JSON.stringify(validationReport.detectedNewSections)
    );

    // ── 5. Test syncStudents with createMissingSections: true ──
    const syncResult = await studentSyncService.syncStudents(
      { csvContent: csvWithNewSection },
      { createMissingSections: true, performedBy: 'Test Runner' }
    );

    assert(syncResult.success, 'Test 7: Student sync executed with zero AI dependency');
    assert(syncResult.added === 2, 'Test 8: Both students added to database', `Added: ${syncResult.added}`);

    // Verify section NEW_SEC_K was auto-created in database
    const { data: autoCreatedSec } = await supabase
      .from('sections')
      .select('*')
      .eq('name', 'NEW_SEC_K')
      .maybeSingle();

    assert(!!autoCreatedSec && autoCreatedSec.active, 'Test 9: Section NEW_SEC_K automatically created in database');

    // ── 6. Test Idempotent Student Update (no duplicate IDs) ──
    const csvUpdatedStudent = `roll_no,name,email,department,year,section,admission_type
TEST_9901,Zero AI Student 1 Updated,test9901@student.vctm.in,CSE,1,NEW_SEC_K,Regular`;

    const updateResult = await studentSyncService.syncStudents(
      { csvContent: csvUpdatedStudent },
      { performedBy: 'Test Runner' }
    );

    assert(updateResult.updated === 1, 'Test 10: Existing student updated by roll number without ID change');

    // Verify student records in database
    const { data: checkStudent } = await supabase
      .from('students')
      .select('*')
      .eq('roll_number', 'TEST_9901')
      .single();

    assert(
      checkStudent?.full_name === 'ZERO AI STUDENT 1 UPDATED',
      'Test 11: Student record in Supabase reflected updated name',
      `Full name: ${checkStudent?.full_name}`
    );

    // ── 7. Test Soft-Archiving of Section with Existing Students ──
    if (autoCreatedSec) {
      const deleteResult = await supabaseService.deleteSection(autoCreatedSec.id);
      assert((deleteResult as any)?.archived === true, 'Test 12: Section with referencing students was safely soft-archived (active: false)');

      const { data: archivedSec } = await supabase
        .from('sections')
        .select('*')
        .eq('id', autoCreatedSec.id)
        .single();

      assert(archivedSec?.active === false, 'Test 13: Section marked active = false to preserve historical students');
    }

    // ── 8. Test Timetable Section Mismatch Protection ──
    const targetSectionA: Section = {
      id: 'section-a-mock-id',
      semester_id: targetSem.id,
      name: 'A',
      room_number: 'Room A-101',
      active: true,
    };

    const matrixCSVSectionB = `VCTM College of Technology and Management
B.Tech Computer Science and Engineering
Section: B | Academic Session: 2026-2027 | Semester: 3rd
Day,Period 1 (09:00 - 09:50),Period 2 (09:50 - 10:40)
MON,BCS301 - Dr. S. K. Gupta - Room B-201,BCS302 - Er. Rohit Singh - Room B-201`;

    const mismatchValidation = csvTimetableService.parseAndValidateCSV(matrixCSVSectionB, {
      targetSection: targetSectionA,
      subjects: [],
      faculty: [],
      classrooms: [],
    });

    assert(mismatchValidation.valid === false, 'Test 14: CSV with Section B rejected when targeting Section A');
    assert(
      mismatchValidation.detectedSectionMismatch?.csvSection?.toUpperCase().replace(/SECTION/i, '').trim() === 'B' &&
      mismatchValidation.detectedSectionMismatch?.targetSection === 'A',
      'Test 15: detectedSectionMismatch correctly flagged CSV section B vs target section A',
      JSON.stringify(mismatchValidation.detectedSectionMismatch)
    );

    // ── 9. Cleanup Test Records ──
    await supabase.from('students').delete().in('roll_number', ['TEST_9901', 'TEST_9902']);
    if (autoCreatedSec) {
      await supabase.from('sections').delete().eq('id', autoCreatedSec.id);
    }
    console.log('🧹 Cleaned up temporary test students and test section.');

  } catch (err: any) {
    console.error('Fatal test execution error:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runDynamicSectionAndAttendanceTests();
