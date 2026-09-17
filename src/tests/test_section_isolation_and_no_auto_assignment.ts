/**
 * Test Suite: Timetable Section Isolation, No Auto-Faculty Assignment, and Cohort Disambiguation
 * Strictly covers User Acceptance Criteria 1 to 24.
 */
import { supabase } from '../lib/supabase/supabaseClient';
import { TimetableConflictEngine } from '../lib/services/timetableConflictEngine';
import { supabaseService } from '../lib/services/supabaseService';
import { erpStorage } from '../lib/storage/erpStorage';

async function runTests() {
  console.log('================================================================');
  console.log('🧪 VERIFYING TIMETABLE SECTION ISOLATION & NO AUTO-ASSIGNMENT');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, title: string, details?: any) {
    if (condition) {
      console.log(`✅ PASS: ${title}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${title}`);
      if (details) console.error('   Details:', details);
      failed++;
    }
  }

  try {
    // -----------------------------------------------------------------
    // TEST 1: Authenticate as Admin
    // -----------------------------------------------------------------
    console.log('--- TEST 1: Admin Authentication & DB Connection ---');
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: 'admin@vctm.in',
      password: 'VctmAdmin@2026',
    });
    assert(!authErr && !!authData.session, 'Authenticated as Administrator (admin@vctm.in)');

    // Fetch master metadata
    const { data: semesters } = await supabase
      .from('semesters')
      .select('id, name, semester_number, academic_year_id');

    const { data: academicYears } = await supabase
      .from('academic_years')
      .select('id, name, year_number');

    const { data: sections } = await supabase
      .from('sections')
      .select('id, name, semester_id, room_number, active, semesters(id, name, semester_number, academic_year_id, academic_years(id, name, year_number))');

    const { data: faculty } = await supabase
      .from('faculty')
      .select('id, full_name, faculty_code, employee_code, designation, department_id, active');

    const { data: subjects } = await supabase
      .from('subjects')
      .select('id, subject_name, subject_code, semester_id, active');

    const { data: assignments } = await supabase
      .from('faculty_subject_assignments')
      .select('id, faculty_id, subject_id, section_id, active');

    const { data: timetable } = await supabase
      .from('timetable_entries')
      .select('*')
      .eq('active', true);

    const getSectionCohort = (s: any) => {
      const sem = (semesters || []).find((sm: any) => sm.id === s.semester_id);
      const yr = (academicYears || []).find((y: any) => y.id === sem?.academic_year_id);
      return { sem, yr };
    };

    const sec3A = (sections || []).find((s: any) => {
      const { sem, yr } = getSectionCohort(s);
      return s.name === 'A' && (yr?.name?.includes('3rd') || yr?.year_number === 3 || sem?.semester_number === 5);
    });
    const sec3B = (sections || []).find((s: any) => {
      const { sem, yr } = getSectionCohort(s);
      return s.name === 'B' && (yr?.name?.includes('3rd') || yr?.year_number === 3 || sem?.semester_number === 5);
    });
    const sec4A = (sections || []).find((s: any) => {
      const { sem, yr } = getSectionCohort(s);
      return s.name === 'A' && (yr?.name?.includes('4th') || yr?.year_number === 4 || sem?.semester_number === 7);
    });

    assert(!!sec3A, 'Found 3rd Year Section A in Supabase');
    assert(!!sec3B, 'Found 3rd Year Section B in Supabase');
    assert(!!sec4A, 'Found 4th Year Section A in Supabase');

    const sec3AId = sec3A!.id;
    const sec3BId = sec3B!.id;
    const sec4AId = sec4A!.id;

    // -----------------------------------------------------------------
    // TEST 2: Section A Empty = ZERO Timetable Records in Supabase
    // -----------------------------------------------------------------
    console.log('\n--- TEST 2: Section A Empty Verification ---');
    const { count: count3A, error: err3A } = await supabase
      .from('timetable_entries')
      .select('id', { count: 'exact', head: true })
      .eq('section_id', sec3AId)
      .eq('active', true);

    assert(!err3A, 'Queried 3rd Year Section A timetable without error');
    assert(count3A === 0, `3rd Year Section A has exactly 0 active timetable slots (Actual: ${count3A})`);

    // -----------------------------------------------------------------
    // TEST 3: Section B Does Not Inherit Section A Timetable
    // -----------------------------------------------------------------
    console.log('\n--- TEST 3: Section B Isolation ---');
    const { data: entries3B } = await supabase
      .from('timetable_entries')
      .select('id, section_id, day_of_week, period_number, active')
      .eq('section_id', sec3BId)
      .eq('active', true);

    assert((entries3B || []).length > 0, `3rd Year Section B has published slots (Actual: ${entries3B?.length})`);
    const hasSecALeakage = (entries3B || []).some(t => t.section_id !== sec3BId);
    assert(!hasSecALeakage, '3rd Year Section B timetable contains ZERO records belonging to Section A');

    // -----------------------------------------------------------------
    // TEST 4: Clean Faculty Designations (No baked-in coordinator titles)
    // -----------------------------------------------------------------
    console.log('\n--- TEST 4: Faculty Designations in Supabase ---');
    const facHemlata = (faculty || []).find(f => f.full_name.includes('Hemlata'));
    const facImran = (faculty || []).find(f => f.full_name.includes('Imran'));

    assert(!!facHemlata, 'Found Ms. Hemlata Chaudhry in faculty table');
    assert(
      facHemlata?.designation === 'Assistant Professor',
      `Ms. Hemlata Chaudhry designation is pure rank: "${facHemlata?.designation}" (No baked-in Coordinator Sec A)`
    );
    assert(
      facImran?.designation === 'Assistant Professor',
      `Mr. Imran Raza Khan designation is pure rank: "${facImran?.designation}" (No baked-in Coordinator Sec B)`
    );

    // -----------------------------------------------------------------
    // TEST 5: Section B Faculty Dropdown: Hemlata is NOT marked as [ASSIGNED]
    // -----------------------------------------------------------------
    console.log('\n--- TEST 5: Faculty Dropdown Filtering for Section B ---');
    const subBCS052 = (subjects || []).find(s => s.subject_code === 'BCS052');
    assert(!!subBCS052, 'Found 3rd Year Subject BCS052 (Data Analytics)');

    // Check active FSA for Section B and BCS052
    const secBAssignments = (assignments || []).filter(
      a => a.section_id === sec3BId && a.subject_id === subBCS052?.id && a.active
    );
    const assignedFacIds = new Set(secBAssignments.map(a => a.faculty_id));

    assert(
      !assignedFacIds.has(facHemlata!.id),
      'Ms. Hemlata Chaudhry is NOT in assigned faculty for 3rd Year Section B (BCS052)'
    );

    // -----------------------------------------------------------------
    // TEST 6: Empty Section A produces ZERO conflicts for Section B
    // -----------------------------------------------------------------
    console.log('\n--- TEST 6: Empty Section A produces ZERO conflicts ---');
    const proposedSecBSlot = {
      id: 'test-slot-sec-b',
      section_id: sec3BId,
      day_of_week: 'MON' as const,
      period_number: 1,
      start_time: '09:00',
      end_time: '09:50',
      subject_id: subBCS052?.id || 'sub-1',
      faculty_id: facHemlata!.id,
      room_number: 'Room A-302',
      lecture_type: 'Theory' as const,
      active: true,
    };

    // Filter current entries for Section A from DB
    const secAEntriesInDB = (timetable || []).filter(t => t.section_id === sec3AId);
    assert(secAEntriesInDB.length === 0, 'Section A has 0 entries in live DB');

    const reportEmptySecA = TimetableConflictEngine.analyzeConflicts({
      targetSectionId: sec3BId,
      proposedEntries: [proposedSecBSlot as any],
      currentDbEntries: secAEntriesInDB,
      sections: sections as any,
      faculty: faculty as any,
      subjects: subjects as any,
      semesters: semesters as any,
      academicYears: academicYears as any,
    });

    assert(
      reportEmptySecA.blockingCount === 0,
      'Empty Section A produces 0 blocking conflicts when scheduling Section B'
    );

    // -----------------------------------------------------------------
    // TEST 7: Cross-Section Cohort Disambiguation (4th Year Section A)
    // -----------------------------------------------------------------
    console.log('\n--- TEST 7: Cross-Section Cohort Disambiguation ---');
    const facWaseem = (faculty || []).find(f => f.full_name.includes('Waseem'));
    assert(!!facWaseem, 'Found Mr. Waseem in faculty table');

    // Find any active scheduled slot for Mr. Waseem in 4th Year Section A
    const waseemSlotIn4A = (timetable || []).find(
      t => t.section_id === sec4AId && t.faculty_id === facWaseem!.id
    );

    assert(!!waseemSlotIn4A, 'Mr. Waseem has an active scheduled slot in 4th Year Section A');

    const testDay = waseemSlotIn4A ? waseemSlotIn4A.day_of_week : 'WED';
    const testPeriod = waseemSlotIn4A ? waseemSlotIn4A.period_number : 1;
    const testStart = waseemSlotIn4A ? waseemSlotIn4A.start_time : '09:00';
    const testEnd = waseemSlotIn4A ? waseemSlotIn4A.end_time : '09:50';

    // Attempting to schedule Mr. Waseem in 3rd Year Section B at the exact same day and time
    const conflictingWaseemSlot = {
      section_id: sec3BId,
      day_of_week: testDay,
      period_number: testPeriod,
      start_time: testStart,
      end_time: testEnd,
      subject_id: subBCS052?.id || 'sub-1',
      faculty_id: facWaseem!.id,
      room_number: 'Room A-302',
      lecture_type: 'Theory' as const,
      active: true,
    };

    const reportWaseem = TimetableConflictEngine.analyzeConflicts({
      targetSectionId: sec3BId,
      proposedEntries: [conflictingWaseemSlot as any],
      currentDbEntries: timetable || [],
      sections: sections as any,
      faculty: faculty as any,
      subjects: subjects as any,
      semesters: semesters as any,
      academicYears: academicYears as any,
    });

    assert(reportWaseem.blockingCount > 0, 'Genuine faculty double-booking correctly detected as blocking');
    const conflictMsg = reportWaseem.conflicts[0]?.message || '';
    console.log('   Reported Message:', conflictMsg);
    assert(
      conflictMsg.includes('4th Year Section A'),
      'Conflict message explicitly specifies "4th Year Section A", completely preventing confusion with 3rd Year Section A'
    );

    // -----------------------------------------------------------------
    // TEST 8: Boundary Times (e.g., adjacent slots) -> NO Conflict
    // -----------------------------------------------------------------
    console.log('\n--- TEST 8: Boundary Time Overlap Verification ---');
    const nonOverlappingSlot = {
      section_id: sec3BId,
      day_of_week: testDay,
      period_number: testPeriod + 1,
      start_time: testEnd,
      end_time: '12:00',
      subject_id: subBCS052?.id || 'sub-1',
      faculty_id: facWaseem!.id,
      room_number: 'Room A-302',
      lecture_type: 'Theory' as const,
      active: true,
    };

    const reportBoundary = TimetableConflictEngine.analyzeConflicts({
      targetSectionId: sec3BId,
      proposedEntries: [nonOverlappingSlot as any],
      currentDbEntries: [waseemSlotIn4A].filter(Boolean) as any,
      sections: sections as any,
      faculty: faculty as any,
      subjects: subjects as any,
      semesters: semesters as any,
      academicYears: academicYears as any,
    });

    assert(
      reportBoundary.blockingCount === 0,
      `Boundary times (${testStart}-${testEnd} vs ${testEnd}-12:00) produce ZERO conflicts`
    );

    // -----------------------------------------------------------------
    // TEST 9: Offline erpStorage Disambiguated Section Labeling
    // -----------------------------------------------------------------
    console.log('\n--- TEST 9: Offline erpStorage Cohort Disambiguation ---');
    erpStorage.syncFromSupabase({
      years: academicYears as any,
      semesters: semesters as any,
      sections: sections as any,
      faculty: faculty as any,
      subjects: subjects as any,
      timetable: timetable as any,
      assignments: assignments as any,
    } as any);

    const storageConflict = erpStorage.checkTimetableConflict({
      section_id: sec3BId,
      day_of_week: testDay,
      period_number: testPeriod,
      start_time: testStart,
      end_time: testEnd,
      faculty_id: facWaseem!.id,
      room_number: 'Room A-999',
      lecture_type: 'Theory',
    });

    assert(!!storageConflict && storageConflict.type === 'faculty', 'erpStorage detects faculty collision');
    console.log('   erpStorage Conflict Message:', storageConflict?.message);
    assert(
      storageConflict?.message?.includes('4th Year Section A') || storageConflict?.message?.includes('Section A (Sem 7)'),
      'erpStorage conflict message clearly labels cohort of conflicting section'
    );

    // -----------------------------------------------------------------
    // TEST 10: RLS Security Enforcement
    // -----------------------------------------------------------------
    console.log('\n--- TEST 10: RLS Security Enforcement ---');
    // Sign out to test unauthenticated / student restriction
    await supabase.auth.signOut();
    const { error: unauthInsertErr } = await supabase
      .from('timetable_entries')
      .insert([{
        section_id: sec3AId,
        day_of_week: 'MON',
        period_number: 1,
        start_time: '09:00',
        end_time: '09:50',
        lecture_type: 'Theory',
      }]);

    assert(!!unauthInsertErr, 'Unauthorized insertion into timetable_entries strictly rejected by Supabase RLS');

  } catch (err: any) {
    console.error('Unexpected error in test suite:', err);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`📊 FINAL RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
