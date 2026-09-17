/**
 * Comprehensive Verification Suite:
 * Timetable Section Isolation, Self-Conflict Elimination & Auto-Faculty Assignment Removal
 */
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';
import { TimetableConflictEngine } from '../lib/services/timetableConflictEngine';

// Parse .env manually
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        process.env[match[1]] = value.trim();
      }
    }
  }
}
loadEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://vckcfsulnswrcnjgtyuv.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTimetableIsolationTests() {
  console.log('===============================================================');
  console.log('TIMETABLE SECTION ISOLATION & CONFLICT ENGINE TEST SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, title: string, details?: any) {
    if (condition) {
      console.log(`PASS: ${title}`);
      passed++;
    } else {
      console.error(`FAIL: ${title}`);
      if (details) console.error('   Details:', details);
      failed++;
    }
  }

  try {
    // -----------------------------------------------------------------
    // TEST 1: Database State - 3rd Year Section A must have 0 active slots
    // -----------------------------------------------------------------
    console.log('\n--- TEST 1: Database Verification for 3rd Year Section A ---');
    const { data: secAData } = await supabase
      .from('sections')
      .select('id, name, semesters(name, academic_years(name))')
      .eq('name', 'A');

    const thirdYearSecA = (secAData || []).find((s: any) => 
      s.semesters?.academic_years?.name?.includes('3rd') || s.semesters?.name?.includes('5')
    );

    assert(!!thirdYearSecA, 'Found 3rd Year (Sem 5) Section A in database');

    if (thirdYearSecA) {
      const { data: activeSlotsA, error: errA } = await supabase
        .from('timetable_entries')
        .select('*')
        .eq('section_id', thirdYearSecA.id)
        .eq('active', true);

      assert(!errA, 'Queried timetable_entries for 3rd Year Section A without error');
      assert((activeSlotsA || []).length === 0, `3rd Year Section A has 0 active timetable records (Actual: ${(activeSlotsA || []).length})`);
    }

    // -----------------------------------------------------------------
    // TEST 2: Self-Conflict Exclusion on Existing Slot
    // -----------------------------------------------------------------
    console.log('\n--- TEST 2: Self-Conflict Exclusion ---');
    const { data: secBSlots } = await supabase
      .from('timetable_entries')
      .select('*')
      .eq('active', true)
      .limit(10);

    const testSlot = secBSlots && secBSlots.length > 0 ? secBSlots[0] : null;
    assert(!!testSlot, 'Found at least one existing timetable slot to test self-conflict exclusion');

    if (testSlot) {
      const report = TimetableConflictEngine.analyzeConflicts({
        targetSectionId: testSlot.section_id,
        proposedEntries: [
          {
            id: testSlot.id,
            section_id: testSlot.section_id,
            subject_id: testSlot.subject_id,
            faculty_id: testSlot.faculty_id,
            day_of_week: testSlot.day_of_week,
            period_number: testSlot.period_number,
            start_time: testSlot.start_time,
            end_time: testSlot.end_time,
            room_number: testSlot.room_number,
            lecture_type: testSlot.lecture_type,
          }
        ],
        currentDbEntries: secBSlots || [],
      });

      assert(
        report.blockingCount === 0,
        `Editing existing slot ${testSlot.id} (${testSlot.day_of_week} Period ${testSlot.period_number}) does NOT produce self-conflict (Blocking: ${report.blockingCount})`
      );
    }

    // -----------------------------------------------------------------
    // TEST 3: Lunch Break Common Area Exemption
    // -----------------------------------------------------------------
    console.log('\n--- TEST 3: Lunch Break Room Collision Exemption ---');
    const dummyLunchEntry1 = {
      id: 'lunch-sec-b-mon-p5',
      section_id: 'sec-b-id',
      day_of_week: 'MON' as const,
      period_number: 5,
      start_time: '12:20',
      end_time: '13:10',
      room_number: 'Refectory / Break',
      lecture_type: 'Lunch' as const,
      subject_id: null,
      faculty_id: null,
    };

    const dummyLunchEntryOtherSec = {
      id: 'lunch-sec-a-mon-p5',
      section_id: 'sec-a-id',
      day_of_week: 'MON' as const,
      period_number: 5,
      start_time: '12:20',
      end_time: '13:10',
      room_number: 'Refectory / Break',
      lecture_type: 'Lunch' as const,
      subject_id: null,
      faculty_id: null,
      active: true,
    };

    const lunchConflictReport = TimetableConflictEngine.analyzeConflicts({
      targetSectionId: 'sec-b-id',
      proposedEntries: [dummyLunchEntry1],
      currentDbEntries: [dummyLunchEntryOtherSec as any],
    });

    assert(
      lunchConflictReport.blockingCount === 0,
      `Period 5 Lunch in 'Refectory / Break' does NOT collide with another section's lunch break (Blocking: ${lunchConflictReport.blockingCount})`
    );

    // -----------------------------------------------------------------
    // TEST 4: Boundary Time Overlap Verification
    // -----------------------------------------------------------------
    console.log('\n--- TEST 4: Boundary Time Overlap Verification ---');
    const slotPeriod1 = {
      id: 'slot-p1',
      section_id: 'sec-b-id',
      day_of_week: 'MON' as const,
      period_number: 1,
      start_time: '09:00',
      end_time: '09:50',
      room_number: '101',
      lecture_type: 'Theory' as const,
      subject_id: 'sub-1',
      faculty_id: 'fac-1',
    };

    const slotPeriod2 = {
      id: 'slot-p2',
      section_id: 'sec-other-id',
      day_of_week: 'MON' as const,
      period_number: 2,
      start_time: '09:50',
      end_time: '10:40',
      room_number: '101',
      lecture_type: 'Theory' as const,
      subject_id: 'sub-2',
      faculty_id: 'fac-1',
      active: true,
    };

    const boundaryReport = TimetableConflictEngine.analyzeConflicts({
      targetSectionId: 'sec-b-id',
      proposedEntries: [slotPeriod1],
      currentDbEntries: [slotPeriod2 as any],
    });

    assert(
      boundaryReport.blockingCount === 0,
      `Adjacent boundary periods (09:00-09:50 and 09:50-10:40) do NOT produce false conflicts (Blocking: ${boundaryReport.blockingCount})`
    );

    // -----------------------------------------------------------------
    // TEST 5: Disambiguated Section Naming in Conflict Engine
    // -----------------------------------------------------------------
    console.log('\n--- TEST 5: Disambiguated Section Naming ---');
    const { data: facultyList } = await supabase
      .from('faculty')
      .select('id, full_name')
      .ilike('full_name', '%Waseem%');

    const waseem = facultyList && facultyList.length > 0 ? facultyList[0] : null;
    assert(!!waseem, `Found faculty Mr. Waseem in DB: ${waseem?.full_name}`);

    if (waseem) {
      const { data: waseemSlots } = await supabase
        .from('timetable_entries')
        .select('*, sections(name, semesters(academic_years(name)))')
        .eq('faculty_id', waseem.id)
        .eq('active', true);

      assert(!!waseemSlots && waseemSlots.length > 0, `Mr. Waseem has active slots in DB (${waseemSlots?.length || 0} slots)`);

      if (waseemSlots && waseemSlots.length > 0) {
        const slot = waseemSlots[0];
        const yrName = slot.sections?.semesters?.academic_years?.name || '4th Year';
        const secName = slot.sections?.name || 'A';

        const conflictingSlot = {
          id: 'new-sec-b-slot',
          section_id: 'sec-b-test-id',
          day_of_week: slot.day_of_week,
          period_number: slot.period_number,
          start_time: slot.start_time,
          end_time: slot.end_time,
          room_number: '202',
          lecture_type: 'Theory' as const,
          subject_id: 'sub-new',
          faculty_id: waseem.id,
        };

        const conflictReport = TimetableConflictEngine.analyzeConflicts({
          targetSectionId: 'sec-b-test-id',
          proposedEntries: [conflictingSlot],
          currentDbEntries: [slot],
          sections: [
            {
              id: 'sec-b-test-id',
              name: 'B',
              semester_id: 'sem-5',
              active: true,
            } as any,
            {
              id: slot.section_id,
              name: secName,
              semester_id: 'sem-7',
              active: true,
            } as any
          ],
          semesters: [
            {
              id: 'sem-7',
              name: 'Semester 7',
              academic_year_id: 'yr-4',
            } as any
          ],
          academicYears: [
            {
              id: 'yr-4',
              name: yrName,
            } as any
          ],
        });

        assert(conflictReport.blockingCount > 0, 'Genuine faculty collision correctly flagged as blocking');
        const conflictItem = conflictReport.conflicts[0];
        const hasYearName = conflictItem?.message?.includes(yrName);
        assert(
          hasYearName,
          `Conflict message disambiguates section with year (${yrName}): "${conflictItem?.message}"`
        );
      }
    }

    // -----------------------------------------------------------------
    // TEST 6: Static Code Verification - Auto-Faculty Assignment Removal
    // -----------------------------------------------------------------
    console.log('\n--- TEST 6: Static Code Audit for Auto-Assignment Removal ---');
    const managerSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/pages/admin/TimetableManagerPage.tsx'),
      'utf-8'
    );

    const hasScopedFacultyDefaultInOpen = managerSource.includes('scopedFaculty[0]?.id');
    assert(!hasScopedFacultyDefaultInOpen, 'handleOpenSlotEditor does NOT default to scopedFaculty[0]?.id');

    const hasScopedSubjectDefaultInOpen = managerSource.includes('scopedSubjects[0]?.id');
    assert(!hasScopedSubjectDefaultInOpen, 'handleOpenSlotEditor does NOT default to scopedSubjects[0]?.id');

    const hasExplicitSubjectCheck = managerSource.includes('Please select a subject course for this lecture period.');
    assert(hasExplicitSubjectCheck, 'handleSaveSlotModal enforces explicit subject selection');

    const hasExplicitFacultyCheck = managerSource.includes('Please select a faculty professor for this lecture period.');
    assert(hasExplicitFacultyCheck, 'handleSaveSlotModal enforces explicit faculty selection');

  } catch (err: any) {
    console.error('Unexpected error during test execution:', err);
    failed++;
  }

  console.log('\n===============================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTimetableIsolationTests();
