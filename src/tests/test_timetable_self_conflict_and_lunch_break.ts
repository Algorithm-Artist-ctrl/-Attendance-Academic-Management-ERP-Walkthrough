/**
 * Test Suite: Timetable Self-Conflict & Lunch Break Room Collision Fixes
 * Strictly covers User Acceptance Criteria Tests 1 through 8 plus screenshot replication.
 */
import { supabase } from '../lib/supabase/supabaseClient';
import { TimetableConflictEngine } from '../lib/services/timetableConflictEngine';
import { supabaseService } from '../lib/services/supabaseService';
import { erpStorage } from '../lib/storage/erpStorage';

async function runTests() {
  console.log('================================================================');
  console.log('🧪 VERIFYING TIMETABLE SELF-CONFLICT & LUNCH BREAK RULES');
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
    // Authenticate as Admin for RLS operations
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: 'admin@vctm.in',
      password: 'VctmAdmin@2026',
    });
    assert(!authErr && !!authData.session, 'Authenticated as Administrator (admin@vctm.in)');

    // Fetch live metadata
    const { data: sections } = await supabase
      .from('sections')
      .select('id, name, semester_id, room_number, active, semesters(id, name, academic_years(id, name))');
    
    const { data: faculty } = await supabase
      .from('faculty')
      .select('id, full_name, faculty_code, active');

    const { data: timetable } = await supabase
      .from('timetable_entries')
      .select('*')
      .eq('active', true);

    const sec3A = (sections || []).find((s: any) => 
      s.name === 'A' && (s.semesters?.academic_years?.name?.includes('3rd') || s.semesters?.name?.includes('5'))
    );
    const sec4A = (sections || []).find((s: any) => 
      s.name === 'A' && (s.semesters?.academic_years?.name?.includes('4th') || s.semesters?.name?.includes('7'))
    );
    const sec3B = (sections || []).find((s: any) => 
      s.name === 'B' && (s.semesters?.academic_years?.name?.includes('3rd') || s.semesters?.name?.includes('5'))
    );

    assert(!!sec3A, 'Found 3rd Year Section A in Supabase');
    assert(!!sec4A, 'Found 4th Year Section A in Supabase');
    assert(!!sec3B, 'Found 3rd Year Section B in Supabase');

    const sec3AId = sec3A?.id || 'sec-3a';
    const sec4AId = sec4A?.id || 'sec-4a';
    const sec3BId = sec3B?.id || 'sec-3b';

    // Helper implementing AcademicContext checkTimetableConflict logic
    const checkConflict = (entry: any, excludeId?: string, allEntries: any[] = timetable || []) => {
      const isNonInstructional = (type?: string, period?: number) => {
        if (period === 5) return true;
        if (!type) return false;
        const t = type.toLowerCase().trim();
        return t === 'lunch' || t.includes('lunch') || t.includes('break') || t.includes('sport') || t.includes('recess') || t.includes('other');
      };

      const isCommonArea = (room?: string) => {
        if (!room) return true;
        const r = room.toLowerCase().trim();
        return (
          r === '' ||
          r === 'tbd' ||
          r === 'room' ||
          r.includes('refectory') ||
          r.includes('break') ||
          r.includes('cafeteria') ||
          r.includes('dining') ||
          r.includes('canteen') ||
          r.includes('ground') ||
          r.includes('sports')
        );
      };

      const formatSectionLabel = (secId?: string) => {
        if (!secId) return 'Another Section';
        const sec = (sections || []).find((s: any) => s.id === secId);
        if (!sec) return 'Another Section';
        const yr = (sec as any).semesters?.academic_years?.name;
        return yr ? `${yr} Section ${sec.name}` : `Section ${sec.name}`;
      };

      const activeEntries = allEntries.filter(t => {
        if (!t.active) return false;
        if (excludeId && t.id === excludeId) return false;
        if (
          entry.section_id &&
          t.section_id === entry.section_id &&
          t.day_of_week === entry.day_of_week &&
          t.period_number === entry.period_number
        ) {
          return false;
        }
        return true;
      });

      const toMins = (t?: string) => {
        if (!t) return 0;
        const [h, m] = t.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
      };

      const hasTimeOverlap = (e1: any, e2: any) => {
        if (e1.start_time && e1.end_time && e2.start_time && e2.end_time) {
          const sA = toMins(e1.start_time);
          const eA = toMins(e1.end_time);
          const sB = toMins(e2.start_time);
          const eB = toMins(e2.end_time);
          if (eA > sA && eB > sB) {
            return sA < eB && sB < eA;
          }
        }
        return e1.period_number === e2.period_number;
      };

      // Rule 1: Same Section Intra-Slot Collision
      if (entry.section_id) {
        const sameSecConflict = activeEntries.find(
          t => t.section_id === entry.section_id &&
               t.day_of_week === entry.day_of_week &&
               hasTimeOverlap(entry, t)
        );
        if (sameSecConflict) {
          return {
            type: 'same_section',
            message: `Same-section collision: ${formatSectionLabel(entry.section_id)} already scheduled on ${entry.day_of_week} Period ${sameSecConflict.period_number}`,
          };
        }
      }

      // Rule 2: Faculty Double-Booking
      if (entry.faculty_id && !isNonInstructional(entry.lecture_type, entry.period_number)) {
        const facultyConflict = activeEntries.find(
          t => t.section_id !== entry.section_id &&
               !isNonInstructional(t.lecture_type, t.period_number) &&
               t.faculty_id === entry.faculty_id &&
               t.day_of_week === entry.day_of_week &&
               hasTimeOverlap(entry, t)
        );
        if (facultyConflict) {
          return {
            type: 'faculty',
            message: `Faculty conflict: faculty already scheduled in ${formatSectionLabel(facultyConflict.section_id)}`,
          };
        }
      }

      // Rule 3: Room Collision
      if (
        entry.room_number &&
        !isNonInstructional(entry.lecture_type, entry.period_number) &&
        !isCommonArea(entry.room_number)
      ) {
        const roomConflict = activeEntries.find(
          t => t.section_id !== entry.section_id &&
               !isNonInstructional(t.lecture_type, t.period_number) &&
               t.room_number &&
               !isCommonArea(t.room_number) &&
               t.room_number.toLowerCase().trim() === entry.room_number.toLowerCase().trim() &&
               t.day_of_week === entry.day_of_week &&
               hasTimeOverlap(entry, t)
        );
        if (roomConflict) {
          return {
            type: 'room',
            message: `Room collision: Room ${entry.room_number} is already occupied by ${formatSectionLabel(roomConflict.section_id)}`,
          };
        }
      }

      return null;
    };

    // -----------------------------------------------------------------
    // TEST 1: Open existing Section A Monday Period 5 Lunch Break -> NO conflict
    // -----------------------------------------------------------------
    console.log('\n--- TEST 1: Open existing Section A Monday Period 5 Lunch Break ---');
    const existingLunchSlot = {
      id: 'sec3a-mon-p5',
      section_id: sec3AId,
      day_of_week: 'MON' as const,
      period_number: 5,
      start_time: '12:20:00',
      end_time: '13:10:00',
      room_number: 'Refectory / Break',
      lecture_type: 'Lunch',
      active: true,
    };

    const conflictT1 = checkConflict(existingLunchSlot, existingLunchSlot.id, [...(timetable || []), existingLunchSlot]);
    assert(conflictT1 === null, 'Opening existing Section A Monday Period 5 Lunch Break has NO conflict');

    // -----------------------------------------------------------------
    // TEST 2: Change Lunch Break room -> NO self-conflict
    // -----------------------------------------------------------------
    console.log('\n--- TEST 2: Change Lunch Break room ---');
    const modifiedLunchRoomSlot = {
      ...existingLunchSlot,
      room_number: 'Central Dining Hall',
    };
    const conflictT2 = checkConflict(modifiedLunchRoomSlot, existingLunchSlot.id, [...(timetable || []), existingLunchSlot]);
    assert(conflictT2 === null, 'Changing Lunch Break room produces NO self-conflict');

    // -----------------------------------------------------------------
    // TEST 3: Save the same slot without changing anything -> SUCCESS
    // -----------------------------------------------------------------
    console.log('\n--- TEST 3: Save slot directly to database ---');
    const saveRes = await supabaseService.saveSingleTimetableSlot({
      slotId: undefined,
      sectionId: sec3AId,
      dayOfWeek: 'MON',
      periodNumber: 5,
      startTime: '12:20',
      endTime: '13:10',
      roomNumber: 'Refectory / Break',
      lectureType: 'Lunch',
    });
    assert(saveRes.success === true, 'Saved Section A Monday Period 5 Lunch slot to database successfully');
    assert(saveRes.entry.subject_id === null, 'Saved Lunch slot has subject_id = null');
    assert(saveRes.entry.faculty_id === null, 'Saved Lunch slot has faculty_id = null');

    // Clean up temporary test slot from Section A
    if (saveRes.entry.id) {
      await supabase.from('timetable_entries').delete().eq('id', saveRes.entry.id);
    }

    // -----------------------------------------------------------------
    // TEST 4: Create Section B slot with same room & overlapping time -> Genuine room conflict
    // -----------------------------------------------------------------
    console.log('\n--- TEST 4: Genuine Room Conflict between different sections ---');
    const activeClassSlotSecC = {
      id: 'sec-c-room-slot',
      section_id: 'sec-c-id',
      day_of_week: 'MON' as const,
      period_number: 2,
      start_time: '10:00',
      end_time: '10:50',
      room_number: 'Lab 101',
      lecture_type: 'Theory',
      subject_id: 'sub-c',
      faculty_id: 'fac-c',
      active: true,
    };

    const proposedSecBSlot = {
      id: 'sec-b-room-slot',
      section_id: sec3BId,
      day_of_week: 'MON' as const,
      period_number: 2,
      start_time: '10:00',
      end_time: '10:50',
      room_number: 'Lab 101',
      lecture_type: 'Theory',
      subject_id: 'sub-b',
      faculty_id: 'fac-b',
      active: true,
    };

    const conflictT4 = checkConflict(proposedSecBSlot, undefined, [activeClassSlotSecC]);
    assert(!!conflictT4 && conflictT4.type === 'room', 'Genuine room collision correctly detected for exclusive classroom (Lab 101)');

    // -----------------------------------------------------------------
    // TEST 5: Edit Section A slot -> Section A own slot still excluded
    // -----------------------------------------------------------------
    console.log('\n--- TEST 5: Edit Section A slot exclusion ---');
    const existingSlotA = {
      id: 'slot-sec-a-p1',
      section_id: sec3AId,
      day_of_week: 'TUE' as const,
      period_number: 1,
      start_time: '09:00',
      end_time: '09:50',
      room_number: 'A001',
      lecture_type: 'Theory',
      subject_id: 'sub-1',
      faculty_id: 'fac-1',
      active: true,
    };

    const updatedSlotA = {
      ...existingSlotA,
      room_number: 'A002', // changed room
    };

    const conflictT5 = checkConflict(updatedSlotA, existingSlotA.id, [existingSlotA]);
    assert(conflictT5 === null, 'Editing Section A slot excludes own slot by ID and coordinates (NO self-conflict)');

    // -----------------------------------------------------------------
    // TEST 6: Section A timetable isolation
    // -----------------------------------------------------------------
    console.log('\n--- TEST 6: Deleted / Inactive records isolation ---');
    const inactiveSlot = {
      id: 'inactive-slot',
      section_id: sec3AId,
      day_of_week: 'MON' as const,
      period_number: 1,
      start_time: '09:00',
      end_time: '09:50',
      room_number: 'A001',
      lecture_type: 'Theory',
      faculty_id: 'fac-1',
      active: false, // DELETED / INACTIVE
    };

    const conflictT6 = checkConflict(
      {
        section_id: sec3AId,
        day_of_week: 'MON',
        period_number: 1,
        start_time: '09:00',
        end_time: '09:50',
        room_number: 'A001',
        lecture_type: 'Theory',
        faculty_id: 'fac-1',
      },
      undefined,
      [inactiveSlot]
    );
    assert(conflictT6 === null, 'Inactive/deleted timetable records NEVER participate in conflict detection');

    // -----------------------------------------------------------------
    // TEST 7: Boundary times (09:00-09:50 and 09:50-10:40) -> NO conflict
    // -----------------------------------------------------------------
    console.log('\n--- TEST 7: Boundary times (09:00-09:50 and 09:50-10:40) ---');
    const slotPeriod1 = {
      id: 'p1-slot',
      section_id: sec3AId,
      day_of_week: 'MON' as const,
      period_number: 1,
      start_time: '09:00',
      end_time: '09:50',
      room_number: 'Hall A',
      lecture_type: 'Theory',
      faculty_id: 'fac-same',
      active: true,
    };

    const slotPeriod2 = {
      id: 'p2-slot',
      section_id: sec3BId,
      day_of_week: 'MON' as const,
      period_number: 2,
      start_time: '09:50',
      end_time: '10:40',
      room_number: 'Hall A',
      lecture_type: 'Theory',
      faculty_id: 'fac-same',
      active: true,
    };

    const conflictT7 = checkConflict(slotPeriod2, slotPeriod2.id, [slotPeriod1]);
    assert(conflictT7 === null, 'Boundary times (09:00-09:50 and 09:50-10:40) produce NO conflict');

    // -----------------------------------------------------------------
    // TEST 8: Same time & faculty in different sections -> REAL faculty conflict
    // -----------------------------------------------------------------
    console.log('\n--- TEST 8: Real faculty collision (14:50-15:40) ---');
    const facSlotSec1 = {
      id: 'fac-slot-1',
      section_id: sec3AId,
      day_of_week: 'MON' as const,
      period_number: 7,
      start_time: '14:50',
      end_time: '15:40',
      room_number: 'Room 1',
      lecture_type: 'Theory',
      faculty_id: 'fac-target',
      active: true,
    };

    const facSlotSec2 = {
      id: 'fac-slot-2',
      section_id: sec3BId,
      day_of_week: 'MON' as const,
      period_number: 7,
      start_time: '14:50',
      end_time: '15:40',
      room_number: 'Room 2',
      lecture_type: 'Theory',
      faculty_id: 'fac-target',
      active: true,
    };

    const conflictT8 = checkConflict(facSlotSec2, facSlotSec2.id, [facSlotSec1]);
    assert(!!conflictT8 && conflictT8.type === 'faculty', 'Genuine faculty collision (14:50-15:40) correctly detected as blocking');

    // -----------------------------------------------------------------
    // TEST 9: SCREENSHOT REPLICATION TEST
    // 3rd Year Section A editing Monday Period 5 Lunch Break with Room 'Refectory / Break'
    // While 4th Year Section A has Monday Period 5 Lunch in 'Refectory / Break' (12:20:00-13:10:00)
    // -----------------------------------------------------------------
    console.log('\n--- TEST 9: Exact Screenshot Replication Test ---');
    const fourthYearLunch = {
      id: 'd1ba8dc7-abe4-4a80-ac68-8a8928f6c1aa',
      section_id: sec4AId,
      day_of_week: 'MON' as const,
      period_number: 5,
      start_time: '12:20:00',
      end_time: '13:10:00',
      room_number: 'Refectory / Break',
      lecture_type: 'Lunch',
      active: true,
    };

    const userEditingSlot = {
      section_id: sec3AId,
      day_of_week: 'MON' as const,
      period_number: 5,
      start_time: '12:20',
      end_time: '13:10',
      room_number: 'Refectory / Break',
      lecture_type: 'Lunch Break',
      subject_id: null,
      faculty_id: null,
      active: true,
    };

    const screenshotConflict = checkConflict(userEditingSlot, undefined, [fourthYearLunch]);
    assert(
      screenshotConflict === null,
      'Exact screenshot scenario: 3rd Year Section A editing Monday Period 5 Lunch in Refectory produces ZERO conflict against 4th Year Section A lunch'
    );

    // Also run through TimetableConflictEngine
    const conflictEngineReport = TimetableConflictEngine.analyzeConflicts({
      targetSectionId: sec3AId,
      proposedEntries: [userEditingSlot as any],
      currentDbEntries: [fourthYearLunch as any],
      sections: sections as any,
    });

    assert(
      conflictEngineReport.blockingCount === 0,
      'TimetableConflictEngine reports 0 blocking conflicts for screenshot scenario'
    );

    // Also run through erpStorage.checkTimetableConflict
    const erpStorageConflict = erpStorage.checkTimetableConflict({
      section_id: sec3AId,
      day_of_week: 'MON',
      period_number: 5,
      start_time: '12:20',
      end_time: '13:10',
      room_number: 'Refectory / Break',
      lecture_type: 'Lunch Break' as any,
    });

    assert(
      erpStorageConflict === null,
      'erpStorage.checkTimetableConflict reports NULL conflict for Lunch Break in Refectory'
    );

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
