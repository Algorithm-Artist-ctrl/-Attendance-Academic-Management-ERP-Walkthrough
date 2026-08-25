import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import { TimetableResolver } from '../lib/utils/timetableResolver';
import { ExtractedTimetableDocument } from '../types/academic.types';
import { TimetableEntry } from '../types/database.types';

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

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAILED (${totalTests}): ${testName}`);
    process.exit(1);
  } else {
    passedTests++;
    console.log(`✅ PASSED (${totalTests}): ${testName}`);
  }
}

async function runConflictEngineVerification() {
  console.log('======================================================================');
  console.log('  VCTM ERP — SECTION-SCOPED & TIME-AWARE CONFLICT ENGINE VERIFICATION');
  console.log('  Vivekananda College of Technology & Management, Aligarh (Code: 340)');
  console.log('======================================================================\n');

  // 1. Fetch live master DB from Supabase
  const dbData = await supabaseService.fetchAllData();
  assert(dbData !== null, 'Connected to live Supabase Cloud Database');

  const { sections, subjects, faculty, timetable, departments, programs, years, semesters } = dbData!;
  const secA = sections.find(s => s.name === 'A')!;
  const secB = sections.find(s => s.name === 'B')!;
  const facKK = faculty.find(f => f.full_name.includes('Kuldeep') || f.faculty_code === 'KK')!;

  assert(Boolean(secA && secB && facKK), 'Resolved test fixtures: Section A, Section B, Faculty KK');

  const baseContext = {
    departments,
    programs,
    years,
    semesters,
    sections,
    subjects,
    faculty,
  };

  // =========================================================================
  // TEST 1 — VALID (Same faculty, different times: No Conflict)
  // Section A: KK Mon 10:40–11:30 | Section B: KK Mon 11:30–12:20
  // =========================================================================
  console.log('\n--- TEST 1: Same faculty, different times across sections ---');
  const existingScheduleTest1: TimetableEntry[] = [
    {
      id: 'existing-a-p3',
      section_id: secA.id,
      faculty_id: facKK.id,
      subject_id: subjects[0]?.id || '',
      day_of_week: 'MON',
      period_number: 3,
      start_time: '10:40:00',
      end_time: '11:30:00',
      room_number: 'A007',
      lecture_type: 'Theory',
      active: true,
    }
  ];

  const docTest1: ExtractedTimetableDocument = {
    institution_name: 'VCTM 340',
    program_name: 'B.Tech',
    branch_name: 'CSE',
    academic_year: '2nd Year',
    semester: '3rd Semester',
    section_name: 'B',
    target_section_id: secB.id,
    room_number: 'A006',
    effective_from: '2026-08-20',
    source_file_name: 'test1_valid.pdf',
    overall_confidence: 95,
    class_incharges: ['Mr. Imran Raza Khan'],
    faculty_mappings: [{ faculty_code: 'KK', faculty_name: facKK.full_name }],
    subject_mappings: [{ subject_code: 'BCS302', subject_name: 'COA' }],
    schedule: [
      {
        day: 'MON',
        periods: [
          {
            period_number: 4,
            start_time: '11:30',
            end_time: '12:20',
            subject_code: 'BCS302',
            subject_name: 'COA',
            faculty_code: 'KK',
            faculty_name: facKK.full_name,
            room_number: 'A006',
            lecture_type: 'Theory',
            is_break: false
          }
        ]
      }
    ]
  };

  const report1 = TimetableResolver.resolveDocument(docTest1, {
    ...baseContext,
    existingTimetable: existingScheduleTest1,
  });

  assert(report1.stats.conflictCount === 0, 'TEST 1: Same faculty at non-overlapping time generates 0 conflicts');

  // =========================================================================
  // TEST 2 — REAL FACULTY CONFLICT (Same faculty, overlapping times)
  // Section A: KK Mon 10:40–11:30 | Section B: KK Mon 10:40–11:30
  // =========================================================================
  console.log('\n--- TEST 2: Real faculty collision (Simultaneous overlap) ---');
  const docTest2: ExtractedTimetableDocument = {
    ...docTest1,
    schedule: [
      {
        day: 'MON',
        periods: [
          {
            period_number: 3,
            start_time: '10:40',
            end_time: '11:30',
            subject_code: 'BCS302',
            subject_name: 'COA',
            faculty_code: 'KK',
            faculty_name: facKK.full_name,
            room_number: 'A006',
            lecture_type: 'Theory',
            is_break: false
          }
        ]
      }
    ]
  };

  const report2 = TimetableResolver.resolveDocument(docTest2, {
    ...baseContext,
    existingTimetable: existingScheduleTest1,
  });

  assert(report2.stats.conflictCount === 1, 'TEST 2: Real faculty collision is correctly flagged as 1 conflict');
  assert(report2.conflicts[0].type === 'faculty', 'TEST 2: Conflict type is "faculty"');
  assert(report2.conflicts[0].message.includes('Faculty conflict:'), 'TEST 2: Message starts with "Faculty conflict:"');
  assert(report2.conflicts[0].message.includes('10:40') && report2.conflicts[0].message.includes('Section A'), 'TEST 2: Message details exact time and conflicting section');

  // =========================================================================
  // TEST 3 — VALID DIFFERENT ROOM (Room A007 vs Room A006 at same time)
  // Section A: A007 Mon 10:40–11:30 | Section B: A006 Mon 10:40–11:30
  // =========================================================================
  console.log('\n--- TEST 3: Different classrooms at same time ---');
  const facOther = faculty.find(f => f.id !== facKK.id)!;
  const docTest3: ExtractedTimetableDocument = {
    ...docTest1,
    schedule: [
      {
        day: 'MON',
        periods: [
          {
            period_number: 3,
            start_time: '10:40',
            end_time: '11:30',
            subject_code: 'BCS301',
            subject_name: 'DS',
            faculty_code: facOther.faculty_code || 'OTH',
            faculty_name: facOther.full_name,
            room_number: 'A006',
            lecture_type: 'Theory',
            is_break: false
          }
        ]
      }
    ]
  };

  const report3 = TimetableResolver.resolveDocument(docTest3, {
    ...baseContext,
    existingTimetable: existingScheduleTest1,
  });

  assert(report3.stats.conflictCount === 0, 'TEST 3: Different rooms at same time generates 0 room conflicts');

  // =========================================================================
  // TEST 4 — REAL ROOM CONFLICT (Same Room A006 simultaneously occupied)
  // Section A: A006 Mon 10:40–11:30 | Section B: A006 Mon 10:40–11:30
  // =========================================================================
  console.log('\n--- TEST 4: Real room double-booking ---');
  const facDiff = faculty.find(f => f.id !== facOther.id && f.id !== facKK.id)!;
  const docTest4: ExtractedTimetableDocument = {
    ...docTest1,
    schedule: [
      {
        day: 'MON',
        periods: [
          {
            period_number: 3,
            start_time: '10:40',
            end_time: '11:30',
            subject_code: 'BCS303',
            subject_name: 'DSTL',
            faculty_code: facDiff.faculty_code || 'DIFF',
            faculty_name: facDiff.full_name,
            room_number: 'A006',
            lecture_type: 'Theory',
            is_break: false
          }
        ]
      }
    ]
  };

  const existingScheduleTest4: TimetableEntry[] = [
    {
      ...existingScheduleTest1[0],
      faculty_id: facOther.id, // Different faculty in Section A
      room_number: 'A006', // Same room occupied by Section A
    }
  ];

  const report4 = TimetableResolver.resolveDocument(docTest4, {
    ...baseContext,
    existingTimetable: existingScheduleTest4,
  });

  assert(report4.stats.conflictCount === 1, 'TEST 4: Real room double-booking is flagged as 1 conflict');
  assert(report4.conflicts[0].type === 'room', 'TEST 4: Conflict type is "room"');
  assert(report4.conflicts[0].message.includes('Room conflict: Room A006'), 'TEST 4: Message specifies conflicting room number');

  // =========================================================================
  // TEST 5 — DIFFERENT SECTION (Section A BCS301 vs Section B BCS302 same time)
  // Different sections having classes simultaneously is VALID
  // =========================================================================
  console.log('\n--- TEST 5: Different sections having simultaneous lectures ---');
  const report5 = TimetableResolver.resolveDocument(docTest3, {
    ...baseContext,
    existingTimetable: existingScheduleTest1,
  });
  assert(report5.stats.conflictCount === 0, 'TEST 5: Different sections having classes simultaneously is completely valid');

  // =========================================================================
  // TEST 6 — SAME SECTION CONFLICT (Multiple classes in Section B at same time)
  // =========================================================================
  console.log('\n--- TEST 6: Same section internal collision ---');
  const docTest6: ExtractedTimetableDocument = {
    ...docTest1,
    schedule: [
      {
        day: 'MON',
        periods: [
          {
            period_number: 3,
            start_time: '10:40',
            end_time: '11:30',
            subject_code: 'BCS301',
            subject_name: 'DS',
            faculty_code: 'HEM',
            faculty_name: 'Ms. Hemlata Chaudhary',
            room_number: 'A006',
            lecture_type: 'Theory',
            is_break: false
          },
          {
            period_number: 3,
            start_time: '10:40',
            end_time: '11:30',
            subject_code: 'BCS302',
            subject_name: 'COA',
            faculty_code: 'KK',
            faculty_name: 'Mr. Kuldeep Kumar',
            room_number: 'A006',
            lecture_type: 'Theory',
            is_break: false
          }
        ]
      }
    ]
  };

  const report6 = TimetableResolver.resolveDocument(docTest6, {
    ...baseContext,
    existingTimetable: [],
  });

  assert(report6.stats.conflictCount >= 1, 'TEST 6: Same section overlapping classes correctly flagged');
  assert(report6.conflicts[0].type === 'section', 'TEST 6: Conflict type is "section"');
  assert(report6.conflicts[0].message.includes('Section scheduling conflict:'), 'TEST 6: Message highlights internal section clash');

  console.log('\n======================================================================');
  console.log(`  ALL ${passedTests}/${totalTests} CONFLICT ENGINE CHECKS PASSED WITH 100% SUCCESS`);
  console.log('======================================================================\n');
}

runConflictEngineVerification().catch(err => {
  console.error('Fatal error in conflict verification:', err);
  process.exit(1);
});
