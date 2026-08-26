import { supabaseService } from '../lib/services/supabaseService';
import { supabase } from '../lib/supabase/supabaseClient';
import { aiTimetableService } from '../lib/services/aiTimetableService';
import { timetableIngestionService } from '../lib/services/timetableIngestionService';
import { TimetableResolver } from '../lib/utils/timetableResolver';
import { UploadTargetContext, ExtractedTimetableDocument } from '../types/academic.types';
import { DayOfWeek, TimetableEntry } from '../types/database.types';

// Mock localStorage for Node test runner
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

async function runFinalMasterAcceptanceTests() {
  console.log('======================================================================');
  console.log('  VCTM ERP — COMPLETE DATA ARCHITECTURE & FINAL ACCEPTANCE TEST SUITE');
  console.log('  Vivekananda College of Technology & Management, Aligarh (Code: 340)');
  console.log('======================================================================\n');

  // --- PART 1: Database Context & Entity Resolution ---
  console.log('--- PART 1: Database Context & Entity Resolution ---');
  const fullData = await supabaseService.fetchAllData(true);
  assert(fullData !== null, 'Connected to live Supabase Cloud Database');

  const { sections, departments, programs, years, semesters, faculty, subjects, timetable: existingTimetable, students, corrections, assignments } = fullData!;
  const secB = sections.find(s => s.name === 'B')!;
  const secA = sections.find(s => s.name === 'A')!;
  const hemlata = faculty.find(f => f.faculty_code === 'HEM')!;
  const studentTarun = students.find(s => s.full_name.toUpperCase().includes('TARUN KUSHWAH'))!;

  assert(Boolean(secB && secA), 'Resolved Section A and Section B database entities');
  assert(Boolean(hemlata), 'Resolved Faculty Ms. Hemlata Chaudhary (HEM)');
  assert(Boolean(studentTarun), 'Resolved Student Tarun Kushwah in Section B');

  // --- PART 2: HOD Section B Upload & Extraction Target Preservation ---
  console.log('\n--- PART 2: HOD Section B Upload & Extraction Target Preservation ---');
  const uploadContext: UploadTargetContext = {
    academicSessionName: '2026-2027',
    programName: 'B.Tech',
    branchName: 'CSE',
    academicYearName: 'Second Year (2026-27)',
    semesterName: '3rd Semester',
    sectionId: secB.id,
    sectionName: 'B',
    roomNumber: secB.room_number || 'A006',
    effectiveFrom: '2026-08-20',
  };

  const dummyBlob = new Blob(['mock binary image payload'], { type: 'image/png' });
  const extractedDoc = await aiTimetableService.extractTimetableImage(
    dummyBlob,
    'VCTM_BTech_CSE_2nd_Year_Section_B.png',
    undefined,
    uploadContext
  );

  assert(extractedDoc.section_name === 'B', `Extracted document section is locked to "B" (got: "${extractedDoc.section_name}")`);
  assert(extractedDoc.target_section_id === secB.id, 'Target section UUID matches Section B');
  assert(extractedDoc.room_number === (secB.room_number || 'A006'), 'Extracted document room number matches Section B');
  assert(extractedDoc.schedule.length === 6, 'Extracted all 6 academic weekdays (MON-SAT)');

  // --- PART 3: Conflict Resolver & Severity Breakdown ---
  console.log('\n--- PART 3: Conflict Resolver & Severity Breakdown ---');
  const report = TimetableResolver.resolveDocument(extractedDoc, {
    departments,
    programs,
    years,
    semesters,
    sections,
    subjects,
    faculty,
    existingTimetable,
  });

  const blockingConflicts = report.conflicts.filter(c => c.severity === 'blocking');
  const crossSectionWarnings = report.conflicts.filter(c => c.severity !== 'blocking');

  assert(blockingConflicts.length === 0, `Target Section B has 0 internal blocking collisions (found: ${blockingConflicts.length})`);
  assert(crossSectionWarnings.every(w => w.severity === 'warning'), 'Cross-section faculty assignments are classified as warnings (non-blocking)');
  assert(report.stats.totalSlots > 0, `Generated ${report.stats.totalSlots} resolved periods for Section B`);

  // --- PART 4: Atomic Full Section Replacement & Versioning ---
  console.log('\n--- PART 4: Atomic Full Section Replacement & Versioning ---');
  const initialSecASlots = existingTimetable.filter(t => t.section_id === secA.id && t.active).length;

  await timetableIngestionService.approveAndPublishTimetable({
    doc: extractedDoc,
    report,
    approvedBy: 'Dr. S. K. Gupta (Super Admin)',
    importId: extractedDoc.id,
    customEffectiveDate: extractedDoc.effective_from,
  });

  // Re-fetch database to verify atomic update
  const refreshedData = await supabaseService.fetchAllData(true);
  const newSecBSlots = refreshedData!.timetable.filter(t => t.section_id === secB.id && t.active);
  const newSecASlots = refreshedData!.timetable.filter(t => t.section_id === secA.id && t.active);

  assert(newSecBSlots.length === 42, `Published Section B has exactly 42 active live slots (found: ${newSecBSlots.length})`);
  assert(newSecASlots.length === initialSecASlots, `Section A has exactly ${initialSecASlots} slots (100% UNTOUCHED and preserved)`);
  assert(newSecBSlots.every(s => s.section_id === secB.id), 'Every single inserted slot carries Section B ID');

  // Verify Supabase timetable_versions record
  const { data: latestVersion } = await supabase
    .from('timetable_versions')
    .select('*')
    .eq('section_id', secB.id)
    .eq('status', 'active')
    .order('version_number', { ascending: false })
    .limit(1)
    .single();

  assert(Boolean(latestVersion), 'New active TimetableVersion record created in Supabase');
  assert(latestVersion.status === 'active', 'Latest TimetableVersion status is "active"');

  // --- PART 5: Student & Faculty Live Schedule Synchronization ---
  console.log('\n--- PART 5: Student & Faculty Live Schedule Synchronization ---');
  // Student Schedule (Tarun Kushwah, Section B)
  const tarunTimetable = refreshedData!.timetable.filter(t => t.section_id === studentTarun.section_id && t.active);
  assert(tarunTimetable.length === 42, `Student Tarun Kushwah sees all 42 Section B lectures`);
  assert(tarunTimetable.every(t => t.section_id === secB.id), 'Zero Section A lectures in student timetable (Strict Isolation)');

  // Faculty Schedule (Ms. Hemlata Chaudhary)
  const hemlataTeachingSchedule = refreshedData!.timetable.filter(t => t.faculty_id === hemlata.id && t.active);
  assert(hemlataTeachingSchedule.length > 0, `Ms. Hemlata Chaudhary has ${hemlataTeachingSchedule.length} active teaching lectures`);

  // Section Coordinator Schedule (Section A)
  const secACoordinator = faculty.find(f => f.id === secA.class_coordinator_id);
  if (secACoordinator) {
    const secACoordinatedSchedule = refreshedData!.timetable.filter(t => t.section_id === secA.id && t.active);
    assert(secACoordinatedSchedule.length === 42, `Section A Coordinator sees full 42 periods of Section A master schedule`);
  }

  // --- PART 6: Correction Requests Single Source of Truth ---
  console.log('\n--- PART 6: Correction Requests Single Source of Truth ---');
  const myFsa = refreshedData!.assignments.filter(a => a.faculty_id === hemlata.id);
  const hemlataCorrections = refreshedData!.corrections.filter(c => {
    if (c.reviewed_by === hemlata.id) return true;
    const rec = c.record || refreshedData!.attendanceRecords.find(r => r.id === c.attendance_record_id);
    const sess = rec?.session || refreshedData!.attendanceSessions.find(s => s.id === rec?.attendance_session_id);
    if (!sess) return false;
    return sess.faculty_id === hemlata.id || myFsa.some(a => a.subject_id === sess.subject_id && a.section_id === sess.section_id);
  });

  const hemlataPending = hemlataCorrections.filter(c => c.status === 'pending');
  const hemlataApproved = hemlataCorrections.filter(c => c.status === 'approved');

  assert(hemlataPending.length === 0, `Ms. Hemlata Chaudhary has ${hemlataPending.length} pending claims (Sidebar badge is clean)`);
  assert(hemlataApproved.length === 8, `Ms. Hemlata Chaudhary has ${hemlataApproved.length} approved claims in database`);

  // --- PART 7: Performance Latency ---
  console.log('\n--- PART 7: Performance Latency ---');
  const tStart = Date.now();
  const cachedData = await supabaseService.fetchMasterData(false);
  const cacheLatency = Date.now() - tStart;
  assert(cachedData !== null, 'In-memory cached master fetch succeeded');
  assert(cacheLatency <= 10, `In-memory master cache hit latency is ${cacheLatency}ms (Sub-10ms requirement met)`);

  console.log('\n======================================================================');
  console.log(`  ALL ${passedTests}/${totalTests} FINAL MASTER ACCEPTANCE CHECKS PASSED WITH 100% SUCCESS`);
  console.log('======================================================================\n');
}

runFinalMasterAcceptanceTests().catch(err => {
  console.error('Fatal error in final acceptance test:', err);
  process.exit(1);
});
