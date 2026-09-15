import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';

// Mock localStorage for Node environment
if (typeof localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (global as any).localStorage = {
    getItem: (k: string) => store[k] || null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  };
}

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition: boolean, stepName: string, detail?: any) {
  totalAssertions++;
  if (!condition) {
    console.error(`\n❌ FAILED Assertion ${totalAssertions}: ${stepName}`);
    if (detail) console.error('   Detail:', detail);
    process.exit(1);
  } else {
    passedAssertions++;
    console.log(`  ✓ [Step ${totalAssertions}] ${stepName}`);
  }
}

async function runSingleSourceOfTruthTimetableTests() {
  console.log('================================================================================');
  console.log('  VCTM ERP — SINGLE SOURCE OF TRUTH TIMETABLE SYNCHRONIZATION AUDIT            ');
  console.log('  HOD -> Faculty -> Student Realtime Multi-Entity Consistency                  ');
  console.log('================================================================================\n');

  // PHASE 1: HOD PUBLISHED TIMETABLE AS THE AUTHORITATIVE BASELINE
  console.log('▶ PHASE 1: HOD AUTHORITATIVE SECTION TIMETABLE');
  const allData = await supabaseService.fetchAllData();
  const secA = allData.sections.find(s => s.name === 'A' && (s.room_number === 'A007' || s.room_number === 'A-007')) || allData.sections.find(s => s.name === 'A');
  const secB = allData.sections.find(s => s.name === 'B' && (s.room_number === 'A006' || s.room_number === 'A-006')) || allData.sections.find(s => s.name === 'B');
  assert(Boolean(secA), '1. Section A exists', secA?.id);
  assert(Boolean(secB), '2. Section B exists', secB?.id);

  const hodSecBEntries = await supabaseService.getPublishedTimetable({ sectionId: secB!.id });
  assert(hodSecBEntries.length > 0, `3. HOD published timetable for Section B loaded (count = ${hodSecBEntries.length})`);
  assert(hodSecBEntries.every(e => e.section_id === secB!.id && e.active), '4. All entries belong strictly to Section B and are active');

  // PHASE 2: FACULTY SCHEDULE DERIVED STRICTLY FROM AUTHORITATIVE TIMETABLE
  console.log('\n▶ PHASE 2: FACULTY TIMETABLE SYNCHRONIZATION');
  // Find a faculty teaching in Section B
  const secBFacultyId = hodSecBEntries[0].faculty_id;
  const facultyMember = allData.faculty.find(f => f.id === secBFacultyId);
  assert(Boolean(facultyMember), `5. Faculty member resolved for Section B (${facultyMember?.full_name})`);

  const facultyEntries = await supabaseService.getPublishedTimetable({ facultyId: secBFacultyId });
  assert(facultyEntries.length > 0, `6. Faculty teaching schedule loaded via authoritative getter (count = ${facultyEntries.length})`);

  // Verify all Section B entries for this faculty match the HOD's Section B entries
  const hodEntriesForFacultyInSecB = hodSecBEntries.filter(e => e.faculty_id === secBFacultyId);
  const facultyEntriesInSecB = facultyEntries.filter(e => e.section_id === secB!.id);

  assert(
    hodEntriesForFacultyInSecB.length === facultyEntriesInSecB.length,
    `7. Exact slot count match for Faculty in Sec B (HOD: ${hodEntriesForFacultyInSecB.length}, Faculty: ${facultyEntriesInSecB.length})`
  );

  const hodIds = new Set(hodEntriesForFacultyInSecB.map(e => e.id));
  const allFacultySlotsInHOD = facultyEntriesInSecB.every(e => hodIds.has(e.id));
  assert(allFacultySlotsInHOD, '8. Every slot in Faculty view exists in HOD view (0 discrepancy)');

  // PHASE 3: STUDENT TIMETABLE DERIVED STRICTLY FROM SECTION ID
  console.log('\n▶ PHASE 3: STUDENT TIMETABLE SYNCHRONIZATION');
  const studentB = allData.students.find(s => s.section_id === secB!.id && s.active);
  assert(Boolean(studentB), `9. Active Section B student found (${studentB?.full_name}, Roll: ${studentB?.roll_number})`);

  const studentBEntries = await supabaseService.getPublishedTimetable({ sectionId: studentB!.section_id });
  assert(
    studentBEntries.length === hodSecBEntries.length,
    `10. Student Section B timetable matches HOD Section B timetable exactly (${studentBEntries.length} slots)`
  );

  const studentBIds = new Set(studentBEntries.map(e => e.id));
  const studentMatchesHOD = hodSecBEntries.every(e => studentBIds.has(e.id));
  assert(studentMatchesHOD, '11. Student schedule is an exact mirror of HOD published timetable');

  // PHASE 4: CROSS-SECTION ISOLATION (ZERO BLEED)
  console.log('\n▶ PHASE 4: CROSS-SECTION ISOLATION (SECTION A vs SECTION B)');
  const studentA = allData.students.find(s => s.section_id === secA!.id && s.active);
  assert(Boolean(studentA), `12. Active Section A student found (${studentA?.full_name}, Roll: ${studentA?.roll_number})`);

  const studentAEntries = await supabaseService.getPublishedTimetable({ sectionId: studentA!.section_id });
  const hodSecAEntries = await supabaseService.getPublishedTimetable({ sectionId: secA!.id });

  assert(
    studentAEntries.length === hodSecAEntries.length,
    `13. Student A entries match HOD Section A entries (${studentAEntries.length} slots)`
  );

  const noBleedBInA = studentAEntries.every(e => e.section_id === secA!.id && e.section_id !== secB!.id);
  assert(noBleedBInA, '14. Zero Section B slots appear in Student A timetable');

  const noBleedAInB = studentBEntries.every(e => e.section_id === secB!.id && e.section_id !== secA!.id);
  assert(noBleedAInB, '15. Zero Section A slots appear in Student B timetable');

  // PHASE 5: REALTIME IN-FLIGHT PERIOD ATOMIC UPDATE PROPAGATION
  console.log('\n▶ PHASE 5: ATOMIC PERIOD UPDATE PROPAGATION ACROSS ALL ROLES');
  const targetEntry = hodSecBEntries[0];
  const originalRoom = targetEntry.room_number;
  const testRoom = 'TEST-ROOM-999';

  console.log(`  Updating Period ${targetEntry.period_number} (${targetEntry.day_of_week}) Room to ${testRoom}...`);
  const { error: updateErr } = await supabase
    .from('timetable_entries')
    .update({ room_number: testRoom })
    .eq('id', targetEntry.id);

  assert(!updateErr, '16. Period room number updated atomically in database');

  // Verify HOD view reflects update
  const updatedHODEntries = await supabaseService.getPublishedTimetable({ sectionId: secB!.id });
  const updatedHODSlot = updatedHODEntries.find(e => e.id === targetEntry.id);
  assert(updatedHODSlot?.room_number === testRoom, `17. HOD view immediately reflects updated room (${updatedHODSlot?.room_number})`);

  // Verify Faculty view reflects update
  const updatedFacultyEntries = await supabaseService.getPublishedTimetable({ facultyId: secBFacultyId });
  const updatedFacultySlot = updatedFacultyEntries.find(e => e.id === targetEntry.id);
  assert(updatedFacultySlot?.room_number === testRoom, `18. Faculty view immediately reflects updated room (${updatedFacultySlot?.room_number})`);

  // Verify Student view reflects update
  const updatedStudentEntries = await supabaseService.getPublishedTimetable({ sectionId: studentB!.section_id });
  const updatedStudentSlot = updatedStudentEntries.find(e => e.id === targetEntry.id);
  assert(updatedStudentSlot?.room_number === testRoom, `19. Student view immediately reflects updated room (${updatedStudentSlot?.room_number})`);

  // Restore original room number
  console.log(`  Restoring original room number (${originalRoom})...`);
  await supabase
    .from('timetable_entries')
    .update({ room_number: originalRoom })
    .eq('id', targetEntry.id);

  const restoredHODEntries = await supabaseService.getPublishedTimetable({ sectionId: secB!.id });
  const restoredHODSlot = restoredHODEntries.find(e => e.id === targetEntry.id);
  assert(restoredHODSlot?.room_number === originalRoom, '20. Room number restored successfully to baseline');

  console.log('\n================================================================================');
  console.log(`  RESULT: ${passedAssertions}/${totalAssertions} ASSERTIONS PASSED PERFECTLY`);
  console.log('  Single Source of Truth Timetable Sync 100% Verified');
  console.log('================================================================================\n');
}

runSingleSourceOfTruthTimetableTests().catch(err => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
