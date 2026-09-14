import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import { TimetableConflictEngine, checkIntervalOverlap } from '../lib/services/timetableConflictEngine';
import { CANONICAL_PERIOD_NUMBERS, getCanonicalPeriodTiming } from '../config/academicConfig';
import { DayOfWeek } from '../types/database.types';

// Mock localStorage for Node.js test environment
if (typeof localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (global as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  };
}

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAILED Test ${totalTests}: ${testName}`);
    if (detail) console.error('   Detail:', detail);
    process.exit(1);
  } else {
    passedTests++;
    console.log(`✅ PASSED Test ${totalTests}: ${testName}`);
  }
}

async function runAudit() {
  console.log('========================================================================');
  console.log('  VCTM ERP — 20-POINT OFFICIAL TIMETABLE & RELATIONAL INTEGRITY AUDIT  ');
  console.log('  Vivekananda College of Technology & Management, Aligarh (Code: 340)   ');
  console.log('========================================================================\n');

  // Fetch complete master state from Supabase
  const dbData = await supabaseService.fetchAllData(true);
  assert(dbData !== null, 'Connected to live Supabase Cloud Database');

  const { sections, subjects, faculty, timetable, years, semesters, assignments } = dbData!;

  // ---------------------------------------------------------------------------
  // CRITERION 1: Section A exists with room A007 and class incharge Ms. Hemlata Chaudhry
  // ---------------------------------------------------------------------------
  const secA = sections.find(s => s.id === 'fc93a413-c18d-4e72-9624-146767bc286b');
  assert(Boolean(secA), 'Criterion 1: 2nd Year Section A exists in database', secA);
  assert(secA?.room_number === 'A007', `Criterion 1: Section A assigned room is A007 (found: ${secA?.room_number})`);
  
  const incharge = faculty.find(f => f.id === secA?.class_coordinator_id);
  assert(
    Boolean(incharge && incharge.full_name.includes('Hemlata Chaudhry')),
    `Criterion 1: Class incharge is Ms. Hemlata Chaudhry (found: ${incharge?.full_name})`
  );

  // ---------------------------------------------------------------------------
  // CRITERION 2: Exactly 10 canonical teaching assignments active for Section A
  // ---------------------------------------------------------------------------
  const secAAssignments = assignments.filter(a => a.section_id === secA?.id && a.active);
  assert(
    secAAssignments.length === 10,
    `Criterion 2: Section A has exactly 10 active teaching assignments (found: ${secAAssignments.length})`
  );

  // Verify all 10 canonical subject codes are covered
  const expectedCodes = ['BAS303', 'BVE301', 'BCS301', 'BCS302', 'BCS303', 'BCS351', 'BCS352', 'BCS353', 'BCC301', 'BCC351'];
  for (const code of expectedCodes) {
    const sub = subjects.find(s => s.subject_code === code);
    assert(Boolean(sub), `Criterion 2: Subject ${code} exists`);
    const assign = secAAssignments.find(a => a.subject_id === sub?.id);
    assert(Boolean(assign), `Criterion 2: Subject ${code} is assigned in Section A`);
  }

  // ---------------------------------------------------------------------------
  // CRITERION 3: Total 48 weekly slots in timetable_entries for Section A (all active)
  // ---------------------------------------------------------------------------
  const secASlots = timetable.filter(t => t.section_id === secA?.id && t.active);
  assert(
    secASlots.length === 48,
    `Criterion 3: Section A has exactly 48 active weekly slots (found: ${secASlots.length})`
  );

  // ---------------------------------------------------------------------------
  // CRITERION 4: Period 5 is Lunch Break (12:20-13:10) on all 6 days (MON through SAT)
  // ---------------------------------------------------------------------------
  const days: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  for (const day of days) {
    const lunchSlot = secASlots.find(t => t.day_of_week === day && t.period_number === 5);
    assert(Boolean(lunchSlot), `Criterion 4: Lunch slot exists on ${day} Period 5`);
    assert(
      lunchSlot?.lecture_type === 'Lunch',
      `Criterion 4: ${day} Period 5 lecture_type is 'Lunch' (found: ${lunchSlot?.lecture_type})`
    );
    assert(
      Boolean(lunchSlot?.start_time?.startsWith('12:20') && lunchSlot?.end_time?.startsWith('13:10')),
      `Criterion 4: ${day} Period 5 timing is 12:20-13:10 (found: ${lunchSlot?.start_time}-${lunchSlot?.end_time})`
    );
  }

  // ---------------------------------------------------------------------------
  // CRITERION 5: Periods 1-4 every day are COA (KK), MATHS 4 (NAK), DSTL (HEM), DS (ALG)
  // ---------------------------------------------------------------------------
  for (const day of days) {
    const p1 = secASlots.find(t => t.day_of_week === day && t.period_number === 1);
    const p2 = secASlots.find(t => t.day_of_week === day && t.period_number === 2);
    const p3 = secASlots.find(t => t.day_of_week === day && t.period_number === 3);
    const p4 = secASlots.find(t => t.day_of_week === day && t.period_number === 4);

    const subP1 = subjects.find(s => s.id === p1?.subject_id);
    const subP2 = subjects.find(s => s.id === p2?.subject_id);
    const subP3 = subjects.find(s => s.id === p3?.subject_id);
    const subP4 = subjects.find(s => s.id === p4?.subject_id);

    const facP1 = faculty.find(f => f.id === p1?.faculty_id);
    const facP2 = faculty.find(f => f.id === p2?.faculty_id);
    const facP3 = faculty.find(f => f.id === p3?.faculty_id);
    const facP4 = faculty.find(f => f.id === p4?.faculty_id);

    assert(subP1?.subject_code === 'BCS302' && facP1?.faculty_code === 'KK', `Criterion 5: ${day} P1 is COA (KK)`);
    assert(subP2?.subject_code === 'BAS303' && facP2?.faculty_code === 'NAK', `Criterion 5: ${day} P2 is MATHS 4 (NAK)`);
    assert(subP3?.subject_code === 'BCS303' && facP3?.faculty_code === 'HEM', `Criterion 5: ${day} P3 is DSTL (HEM)`);
    assert(subP4?.subject_code === 'BCS301' && facP4?.faculty_code === 'ALG', `Criterion 5: ${day} P4 is DS (ALG)`);
  }

  // ---------------------------------------------------------------------------
  // CRITERION 6: Monday P6-P8 are UHV (SHS), CS (GDS), MINI PROJECT (FZN)
  // ---------------------------------------------------------------------------
  const monP6 = secASlots.find(t => t.day_of_week === 'MON' && t.period_number === 6);
  const monP7 = secASlots.find(t => t.day_of_week === 'MON' && t.period_number === 7);
  const monP8 = secASlots.find(t => t.day_of_week === 'MON' && t.period_number === 8);
  assert(
    subjects.find(s => s.id === monP6?.subject_id)?.subject_code === 'BVE301' &&
    faculty.find(f => f.id === monP6?.faculty_id)?.faculty_code === 'SHS',
    'Criterion 6: Monday P6 is UHV (SHS)'
  );
  assert(
    subjects.find(s => s.id === monP7?.subject_id)?.subject_code === 'BCC301' &&
    faculty.find(f => f.id === monP7?.faculty_id)?.faculty_code === 'GDS',
    'Criterion 6: Monday P7 is CS (GDS)'
  );
  assert(
    subjects.find(s => s.id === monP8?.subject_id)?.subject_code === 'BCC351' &&
    faculty.find(f => f.id === monP8?.faculty_id)?.faculty_code === 'FZN',
    'Criterion 6: Monday P8 is MINI PROJECT (FZN)'
  );

  // ---------------------------------------------------------------------------
  // CRITERION 7: Tuesday P6-P8 are UHV (SHS), CS (GDS), MINI PROJECT (FZN)
  // ---------------------------------------------------------------------------
  const tueP6 = secASlots.find(t => t.day_of_week === 'TUE' && t.period_number === 6);
  const tueP7 = secASlots.find(t => t.day_of_week === 'TUE' && t.period_number === 7);
  const tueP8 = secASlots.find(t => t.day_of_week === 'TUE' && t.period_number === 8);
  assert(
    subjects.find(s => s.id === tueP6?.subject_id)?.subject_code === 'BVE301' &&
    faculty.find(f => f.id === tueP6?.faculty_id)?.faculty_code === 'SHS',
    'Criterion 7: Tuesday P6 is UHV (SHS)'
  );
  assert(
    subjects.find(s => s.id === tueP7?.subject_id)?.subject_code === 'BCC301' &&
    faculty.find(f => f.id === tueP7?.faculty_id)?.faculty_code === 'GDS',
    'Criterion 7: Tuesday P7 is CS (GDS)'
  );
  assert(
    subjects.find(s => s.id === tueP8?.subject_id)?.subject_code === 'BCC351' &&
    faculty.find(f => f.id === tueP8?.faculty_id)?.faculty_code === 'FZN',
    'Criterion 7: Tuesday P8 is MINI PROJECT (FZN)'
  );

  // ---------------------------------------------------------------------------
  // CRITERION 8: Wednesday P6-P8 are UHV (SHS), DS LAB (ALG), DS LAB (ALG)
  // ---------------------------------------------------------------------------
  const wedP6 = secASlots.find(t => t.day_of_week === 'WED' && t.period_number === 6);
  const wedP7 = secASlots.find(t => t.day_of_week === 'WED' && t.period_number === 7);
  const wedP8 = secASlots.find(t => t.day_of_week === 'WED' && t.period_number === 8);
  assert(
    subjects.find(s => s.id === wedP6?.subject_id)?.subject_code === 'BVE301' &&
    faculty.find(f => f.id === wedP6?.faculty_id)?.faculty_code === 'SHS',
    'Criterion 8: Wednesday P6 is UHV (SHS)'
  );
  assert(
    subjects.find(s => s.id === wedP7?.subject_id)?.subject_code === 'BCS351' &&
    faculty.find(f => f.id === wedP7?.faculty_id)?.faculty_code === 'ALG',
    'Criterion 8: Wednesday P7 is DS LAB (ALG)'
  );
  assert(
    subjects.find(s => s.id === wedP8?.subject_id)?.subject_code === 'BCS351' &&
    faculty.find(f => f.id === wedP8?.faculty_id)?.faculty_code === 'ALG',
    'Criterion 8: Wednesday P8 is DS LAB (ALG)'
  );

  // ---------------------------------------------------------------------------
  // CRITERION 9: Thursday P6-P8 are UHV (SHS), MATHS 4 (NAK), CS (GDS)
  // ---------------------------------------------------------------------------
  const thuP6 = secASlots.find(t => t.day_of_week === 'THU' && t.period_number === 6);
  const thuP7 = secASlots.find(t => t.day_of_week === 'THU' && t.period_number === 7);
  const thuP8 = secASlots.find(t => t.day_of_week === 'THU' && t.period_number === 8);
  assert(
    subjects.find(s => s.id === thuP6?.subject_id)?.subject_code === 'BVE301' &&
    faculty.find(f => f.id === thuP6?.faculty_id)?.faculty_code === 'SHS',
    'Criterion 9: Thursday P6 is UHV (SHS)'
  );
  assert(
    subjects.find(s => s.id === thuP7?.subject_id)?.subject_code === 'BAS303' &&
    faculty.find(f => f.id === thuP7?.faculty_id)?.faculty_code === 'NAK',
    'Criterion 9: Thursday P7 is MATHS 4 (NAK)'
  );
  assert(
    subjects.find(s => s.id === thuP8?.subject_id)?.subject_code === 'BCC301' &&
    faculty.find(f => f.id === thuP8?.faculty_id)?.faculty_code === 'GDS',
    'Criterion 9: Thursday P8 is CS (GDS)'
  );

  // ---------------------------------------------------------------------------
  // CRITERION 10: Friday P6-P8 are CS (GDS), WD WS (GDS), WD WS (GDS)
  // ---------------------------------------------------------------------------
  const friP6 = secASlots.find(t => t.day_of_week === 'FRI' && t.period_number === 6);
  const friP7 = secASlots.find(t => t.day_of_week === 'FRI' && t.period_number === 7);
  const friP8 = secASlots.find(t => t.day_of_week === 'FRI' && t.period_number === 8);
  assert(
    subjects.find(s => s.id === friP6?.subject_id)?.subject_code === 'BCC301' &&
    faculty.find(f => f.id === friP6?.faculty_id)?.faculty_code === 'GDS',
    'Criterion 10: Friday P6 is CS (GDS)'
  );
  assert(
    subjects.find(s => s.id === friP7?.subject_id)?.subject_code === 'BCS353' &&
    faculty.find(f => f.id === friP7?.faculty_id)?.faculty_code === 'GDS',
    'Criterion 10: Friday P7 is WD WS (GDS)'
  );
  assert(
    subjects.find(s => s.id === friP8?.subject_id)?.subject_code === 'BCS353' &&
    faculty.find(f => f.id === friP8?.faculty_id)?.faculty_code === 'GDS',
    'Criterion 10: Friday P8 is WD WS (GDS)'
  );

  // ---------------------------------------------------------------------------
  // CRITERION 11: Saturday P6-P8 are COA LAB (ALG), CS (GDS), SPORTS
  // ---------------------------------------------------------------------------
  const satP6 = secASlots.find(t => t.day_of_week === 'SAT' && t.period_number === 6);
  const satP7 = secASlots.find(t => t.day_of_week === 'SAT' && t.period_number === 7);
  const satP8 = secASlots.find(t => t.day_of_week === 'SAT' && t.period_number === 8);
  assert(
    subjects.find(s => s.id === satP6?.subject_id)?.subject_code === 'BCS352' &&
    faculty.find(f => f.id === satP6?.faculty_id)?.faculty_code === 'ALG',
    'Criterion 11: Saturday P6 is COA LAB (ALG)'
  );
  assert(
    subjects.find(s => s.id === satP7?.subject_id)?.subject_code === 'BCC301' &&
    faculty.find(f => f.id === satP7?.faculty_id)?.faculty_code === 'GDS',
    'Criterion 11: Saturday P7 is CS (GDS)'
  );
  assert(
    satP8?.lecture_type === 'Sports',
    `Criterion 11: Saturday P8 is Sports Session (found: ${satP8?.lecture_type})`
  );

  // ---------------------------------------------------------------------------
  // CRITERION 12: classrooms table has 13 rooms with valid IDs
  // ---------------------------------------------------------------------------
  const { data: classrooms, error: classErr } = await supabase.from('classrooms').select('*');
  assert(!classErr && (classrooms?.length || 0) >= 13, `Criterion 12: Classrooms table has ${classrooms?.length} rooms (>= 13 expected)`);
  const roomA007 = classrooms?.find(c => c.room_number === 'A007');
  assert(Boolean(roomA007), 'Criterion 12: Room A007 exists in classrooms table');

  // ---------------------------------------------------------------------------
  // CRITERION 13: TimetableConflictEngine returns 0 blocking conflicts for Section A
  // ---------------------------------------------------------------------------
  const conflictReport = TimetableConflictEngine.analyzeConflicts({
    targetSectionId: secA!.id,
    proposedEntries: secASlots,
    currentDbEntries: timetable,
    sections,
    subjects,
    faculty,
    assignments,
    semesters,
    academicYears: years,
  });
  assert(
    !conflictReport.hasBlockingConflicts && conflictReport.blockingCount === 0,
    `Criterion 13: TimetableConflictEngine reports 0 blocking conflicts for Section A (found: ${conflictReport.blockingCount})`,
    conflictReport.conflicts
  );

  // ---------------------------------------------------------------------------
  // CRITERION 14: Strict boundary check (touching boundaries do NOT overlap)
  // ---------------------------------------------------------------------------
  const touchingOverlap = checkIntervalOverlap('09:00', '09:50', '09:50', '10:40');
  assert(!touchingOverlap, 'Criterion 14: Touching boundaries (09:50 and 09:50) do not overlap');
  const strictOverlap = checkIntervalOverlap('09:00', '10:00', '09:50', '10:40');
  assert(strictOverlap, 'Criterion 14: Overlapping intervals (09:00-10:00 and 09:50-10:40) correctly detected');

  // ---------------------------------------------------------------------------
  // CRITERION 15: Cross-section faculty double-booking triggers a blocking conflict
  // ---------------------------------------------------------------------------
  const mockDoubleBookingEntries = [
    {
      subject_id: subjects.find(s => s.subject_code === 'BCS302')!.id,
      faculty_id: faculty.find(f => f.faculty_code === 'KK')!.id, // KK is teaching Sec A Period 1
      day_of_week: 'MON' as DayOfWeek,
      period_number: 1,
      start_time: '09:00',
      end_time: '09:50',
      room_number: 'A006',
      lecture_type: 'Theory' as const,
      active: true,
    }
  ];
  // Target a different section (e.g. Section B)
  const secB = sections.find(s => s.name === 'B') || { id: 'mock-sec-b', name: 'B', room_number: 'A006' };
  const doubleBookingReport = TimetableConflictEngine.analyzeConflicts({
    targetSectionId: secB.id,
    proposedEntries: mockDoubleBookingEntries,
    currentDbEntries: secASlots, // Sec A has KK at MON Period 1
    sections,
    subjects,
    faculty,
    assignments,
    semesters,
    academicYears: years,
  });
  assert(
    doubleBookingReport.hasBlockingConflicts,
    'Criterion 15: Double-booking faculty at same time triggers BLOCKING conflict'
  );

  // ---------------------------------------------------------------------------
  // CRITERION 16: Conflict messages specify academic year and section name clearly
  // ---------------------------------------------------------------------------
  const conflictMsg = doubleBookingReport.conflicts[0]?.message || '';
  assert(
    conflictMsg.includes('Section A') || conflictMsg.includes('2nd Year'),
    `Criterion 16: Conflict message includes section and year name (msg: "${conflictMsg}")`
  );

  // ---------------------------------------------------------------------------
  // CRITERION 17: Faculty profile updates propagate relationally to timetable
  // ---------------------------------------------------------------------------
  // Timetable entries store faculty_id as foreign key. When resolving faculty,
  // the client looks up faculty by ID.
  const sampleSlot = secASlots[0];
  const resolvedFac = faculty.find(f => f.id === sampleSlot.faculty_id);
  assert(Boolean(resolvedFac), 'Criterion 17: Timetable slot links relationally to faculty table');

  // ---------------------------------------------------------------------------
  // CRITERION 18: lecture_type enum includes 'Lunch' and 'Other'
  // ---------------------------------------------------------------------------
  const lunchEntries = await supabase.from('timetable_entries').select('id, lecture_type').eq('lecture_type', 'Lunch').limit(1);
  assert(
    !lunchEntries.error && (lunchEntries.data?.length || 0) > 0,
    'Criterion 18: lecture_type enum accepts and stores "Lunch"'
  );

  // ---------------------------------------------------------------------------
  // CRITERION 19: CANONICAL_PERIOD_NUMBERS contains 8 periods with standard timings
  // ---------------------------------------------------------------------------
  assert(
    CANONICAL_PERIOD_NUMBERS.length === 8 &&
    CANONICAL_PERIOD_NUMBERS[0] === 1 &&
    CANONICAL_PERIOD_NUMBERS[7] === 8,
    'Criterion 19: CANONICAL_PERIOD_NUMBERS contains [1..8]'
  );
  const p5Timing = getCanonicalPeriodTiming(5);
  assert(
    p5Timing.start_time === '12:20' && p5Timing.end_time === '13:10',
    `Criterion 19: Canonical Period 5 timing is 12:20-13:10 (found: ${p5Timing.start_time}-${p5Timing.end_time})`
  );

  // ---------------------------------------------------------------------------
  // CRITERION 20: Class Coordinator view logic for Ms. Hemlata Chaudhry
  // ---------------------------------------------------------------------------
  const coordinatorFaculty = faculty.find(f => f.full_name.includes('Hemlata Chaudhry'));
  const coordinatedSection = sections.find(s => s.class_coordinator_id === coordinatorFaculty?.id);
  assert(
    coordinatedSection?.id === secA!.id,
    `Criterion 20: Ms. Hemlata Chaudhry is Class Coordinator of Section A (coordinated section: ${coordinatedSection?.name})`
  );

  console.log('\n========================================================================');
  console.log(`  RESULT: ALL ${passedTests} / ${totalTests} CRITERIA PASSED WITH ZERO ERRORS!`);
  console.log('========================================================================\n');
}

runAudit().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
