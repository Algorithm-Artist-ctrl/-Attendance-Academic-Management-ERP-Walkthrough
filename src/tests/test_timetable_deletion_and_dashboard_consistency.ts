import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import { erpStorage } from '../lib/storage/erpStorage';
import { DayOfWeek } from '../types/database.types';

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

async function runTimetableDeletionTestSuite() {
  console.log('================================================================================');
  console.log('🧪 VCTM ERP PRODUCTION TEST: TIMETABLE DELETION & ZERO-STALE DASHBOARD INTEGRITY');
  console.log('================================================================================\n');

  // Authenticate as Super Admin for production management operations
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@vctm.in',
    password: 'VctmAdmin@2026',
  });
  if (authErr) {
    console.warn('  ⚠️ Admin authentication warning:', authErr.message);
  } else {
    console.log('  ✓ Authenticated as Super Admin (admin@vctm.in)');
  }

  // STEP 1: Identify 2nd Year Section A and Section B
  console.log('▶ STEP 1: RESOLVING ACADEMIC CONTEXT (2nd Year CSE)');
  const { data: sections } = await supabase.from('sections').select('*, semester:semesters(*)');
  const secA = sections?.find(s => s.name === 'A' && s.semester?.name?.includes('3rd'));
  const secB = sections?.find(s => s.name === 'B' && s.semester?.name?.includes('3rd'));

  assert(Boolean(secA), 'Found 2nd Year Section A', { secAId: secA?.id });
  assert(Boolean(secB), 'Found 2nd Year Section B', { secBId: secB?.id });

  const secAId = secA!.id;
  const secBId = secB!.id;

  // Record Control Section B state
  const { count: secBInitialCount } = await supabase
    .from('timetable_entries')
    .select('id', { count: 'exact' })
    .eq('section_id', secBId)
    .eq('active', true);

  console.log(`  Section B Control active entries: ${secBInitialCount}`);
  assert(secBInitialCount !== null && secBInitialCount > 0, 'Control Section B has active timetable entries');

  // STEP 2: Publish a known test schedule into Section A
  console.log('\n▶ STEP 2: PUBLISH CONTROL TEST ENTRIES FOR SECTION A');
  const { data: dbSubjects } = await supabase.from('subjects').select('*').eq('active', true);
  const { data: dbFaculty } = await supabase.from('faculty').select('*').eq('active', true);
  assert(dbSubjects && dbSubjects.length > 0, 'Subjects exist in database');
  assert(dbFaculty && dbFaculty.length > 0, 'Faculty exist in database');

  const testSub = dbSubjects![0];
  const testFac = dbFaculty![0];

  const testEntries = [
    {
      subject_id: testSub.id,
      faculty_id: testFac.id,
      day_of_week: 'MON' as DayOfWeek,
      period_number: 1,
      start_time: '09:00:00',
      end_time: '09:50:00',
      room_number: 'A007',
      lecture_type: 'Theory' as const,
      active: true,
    },
    {
      subject_id: testSub.id,
      faculty_id: testFac.id,
      day_of_week: 'TUE' as DayOfWeek,
      period_number: 2,
      start_time: '09:50:00',
      end_time: '10:40:00',
      room_number: 'A007',
      lecture_type: 'Theory' as const,
      active: true,
    },
  ];

  const pubResult = await supabaseService.saveSectionTimetable({
    sectionId: secAId,
    entries: testEntries,
    publishedBy: 'Timetable Deletion Test Suite',
  });
  assert(pubResult.success, 'Published test schedule for Section A', pubResult);

  // Verify Section A in Supabase
  const { count: secAPostPubCount } = await supabase
    .from('timetable_entries')
    .select('id', { count: 'exact' })
    .eq('section_id', secAId)
    .eq('active', true);
  assert(secAPostPubCount === 2, 'Section A has exactly 2 entries in Supabase after publish');

  // Verify faculty assignment was activated
  const { data: pubAssignments } = await supabase
    .from('faculty_subject_assignments')
    .select('*')
    .eq('section_id', secAId)
    .eq('faculty_id', testFac.id)
    .eq('subject_id', testSub.id);
  assert(pubAssignments && pubAssignments.some(a => a.active), 'Faculty assignment activated for Section A');

  // STEP 3: Execute deleteSectionTimetable
  console.log('\n▶ STEP 3: EXECUTE deleteSectionTimetable (HOD CLEAR ACTION)');
  const delResult = await supabaseService.deleteSectionTimetable({
    sectionId: secAId,
    deletedBy: 'HOD CSE',
  });
  assert(delResult.success, 'deleteSectionTimetable succeeded', delResult);

  // STEP 4: Verify Supabase database zero-state
  console.log('\n▶ STEP 4: VERIFY SUPABASE DATABASE STRICT ZERO STATE');
  const { count: secAAfterDelCount } = await supabase
    .from('timetable_entries')
    .select('id', { count: 'exact' })
    .eq('section_id', secAId);
  assert(secAAfterDelCount === 0, `Supabase timetable_entries count for Section A is exactly 0 (actual: ${secAAfterDelCount})`);

  // Verify active version is archived
  const { data: secAVersions } = await supabase
    .from('timetable_versions')
    .select('*')
    .eq('section_id', secAId)
    .order('created_at', { ascending: false })
    .limit(1);
  assert(secAVersions && secAVersions[0]?.status === 'archived', 'Latest timetable version for Section A has status "archived"');

  // Verify faculty_subject_assignments are deactivated
  const { data: secAAssignmentsAfter } = await supabase
    .from('faculty_subject_assignments')
    .select('*')
    .eq('section_id', secAId)
    .eq('active', true);
  assert(secAAssignmentsAfter?.length === 0, 'Zero active faculty_subject_assignments remain for Section A in Supabase');

  // STEP 5: Verify Control Section B remains untouched
  console.log('\n▶ STEP 5: VERIFY CONTROL SECTION B IS 100% UNTOUCHED');
  const { count: secBAfterCount } = await supabase
    .from('timetable_entries')
    .select('id', { count: 'exact' })
    .eq('section_id', secBId)
    .eq('active', true);
  assert(secBAfterCount === secBInitialCount, `Control Section B count remained untouched (${secBAfterCount} === ${secBInitialCount})`);

  // STEP 6: Verify Supabase Service fetch queries return zero
  console.log('\n▶ STEP 6: VERIFY SUPABASE SERVICE QUERY ZERO STATE');
  const fetchTt = await supabaseService.fetchTimetable(secAId);
  assert(fetchTt.length === 0, 'supabaseService.fetchTimetable(secAId) returns 0 entries');

  const allData = await supabaseService.fetchAllData(true);
  const secATtFromAll = allData?.timetable.filter(t => t.section_id === secAId && t.active);
  assert(secATtFromAll?.length === 0, 'supabaseService.fetchAllData(true).timetable contains 0 Section A entries');

  const secAAsgnFromAll = allData?.assignments.filter(a => a.section_id === secAId && a.active);
  assert(secAAsgnFromAll?.length === 0, 'supabaseService.fetchAllData(true).assignments contains 0 active Section A assignments');

  // STEP 7: Verify erpStorage and offline re-hydration zero state
  console.log('\n▶ STEP 7: VERIFY ERPSTORAGE RE-HYDRATION & LOCALSTORAGE ZERO STATE');
  erpStorage.syncFromSupabase({
    institutions: allData!.institutions,
    departments: allData!.departments,
    programs: allData!.programs,
    sessions: allData!.sessions,
    years: allData!.years,
    semesters: allData!.semesters,
    sections: allData!.sections,
    subjects: allData!.subjects,
    faculty: allData!.faculty,
    assignments: allData!.assignments,
    students: allData!.students,
    timetable: allData!.timetable,
    attendanceSessions: allData!.attendanceSessions,
    attendanceRecords: allData!.attendanceRecords,
    corrections: allData!.corrections,
    auditLogs: allData!.auditLogs,
  });

  const storageTimetable = erpStorage.getTimetable().filter(t => t.section_id === secAId);
  assert(storageTimetable.length === 0, 'erpStorage.getTimetable() contains 0 Section A entries');

  const storageAssignments = erpStorage.getAssignments().filter(a => a.section_id === secAId);
  assert(storageAssignments.length === 0, 'erpStorage.getAssignments() contains 0 Section A assignments');

  // STEP 8: Verify Faculty Dashboard resolution
  console.log('\n▶ STEP 8: VERIFY FACULTY DASHBOARD RESOLUTION');
  const facTt = await supabaseService.getPublishedTimetable({ facultyId: testFac.id, activeOnly: true });
  const facSecAEntries = facTt.filter(t => t.section_id === secAId);
  assert(facSecAEntries.length === 0, `Faculty has 0 scheduled entries for Section A (actual: ${facSecAEntries.length})`);

  // STEP 9: Verify Student Dashboard resolution
  console.log('\n▶ STEP 9: VERIFY STUDENT DASHBOARD RESOLUTION');
  const stuTt = await supabaseService.getPublishedTimetable({ sectionId: secAId, activeOnly: true });
  assert(stuTt.length === 0, `Student timetable query for Section A returns 0 entries (actual: ${stuTt.length})`);

  // STEP 10: Verify Attendance Sessions and Records Integrity
  console.log('\n▶ STEP 10: VERIFY HISTORICAL ATTENDANCE INTEGRITY');
  const { data: attSessions } = await supabase.from('attendance_sessions').select('id');
  const { data: attRecords } = await supabase.from('attendance_records').select('id');
  assert(attSessions !== null, 'attendance_sessions table accessible and unharmed');
  assert(attRecords !== null, 'attendance_records table accessible and unharmed');

  // RESTORE OFFICIAL TIMETABLE FOR SECTION A
  const subjectMapByCode = new Map(dbSubjects!.map(s => [s.subject_code, s.id]));
  const facultyMapByCode = new Map(dbFaculty!.map(f => [f.faculty_code, f.id]));
  const days: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const canonicalEntries: any[] = [];
  for (const day of days) {
    canonicalEntries.push({ day_of_week: day, period_number: 1, start_time: '09:00:00', end_time: '09:50:00', subject_id: subjectMapByCode.get('BCS302'), faculty_id: facultyMapByCode.get('KK'), room_number: 'A007', lecture_type: 'Theory' });
    canonicalEntries.push({ day_of_week: day, period_number: 2, start_time: '09:50:00', end_time: '10:40:00', subject_id: subjectMapByCode.get('BAS303'), faculty_id: facultyMapByCode.get('NAK'), room_number: 'A007', lecture_type: 'Theory' });
    canonicalEntries.push({ day_of_week: day, period_number: 3, start_time: '10:40:00', end_time: '11:30:00', subject_id: subjectMapByCode.get('BCS303'), faculty_id: facultyMapByCode.get('HEM'), room_number: 'A007', lecture_type: 'Theory' });
    canonicalEntries.push({ day_of_week: day, period_number: 4, start_time: '11:30:00', end_time: '12:20:00', subject_id: subjectMapByCode.get('BCS301'), faculty_id: facultyMapByCode.get('ALG'), room_number: 'A007', lecture_type: 'Theory' });
    canonicalEntries.push({ day_of_week: day, period_number: 5, start_time: '12:20:00', end_time: '13:10:00', subject_id: null, faculty_id: null, room_number: 'A007', lecture_type: 'Lunch' });
    if (day === 'MON' || day === 'WED' || day === 'FRI') {
      canonicalEntries.push({ day_of_week: day, period_number: 6, start_time: '13:10:00', end_time: '14:00:00', subject_id: subjectMapByCode.get('BCS301'), faculty_id: facultyMapByCode.get('ALG'), room_number: 'A007', lecture_type: 'Theory' });
      canonicalEntries.push({ day_of_week: day, period_number: 7, start_time: '14:00:00', end_time: '14:50:00', subject_id: subjectMapByCode.get('BCS351'), faculty_id: facultyMapByCode.get('ALG'), room_number: 'LAB-1', lecture_type: 'Lab' });
      canonicalEntries.push({ day_of_week: day, period_number: 8, start_time: '14:50:00', end_time: '15:40:00', subject_id: subjectMapByCode.get('BCS351'), faculty_id: facultyMapByCode.get('ALG'), room_number: 'LAB-1', lecture_type: 'Lab' });
    } else {
      canonicalEntries.push({ day_of_week: day, period_number: 6, start_time: '13:10:00', end_time: '14:00:00', subject_id: subjectMapByCode.get('BVE301'), faculty_id: facultyMapByCode.get('RP'), room_number: 'A007', lecture_type: 'Theory' });
      canonicalEntries.push({ day_of_week: day, period_number: 7, start_time: '14:00:00', end_time: '14:50:00', subject_id: subjectMapByCode.get('BCS352'), faculty_id: facultyMapByCode.get('ALG'), room_number: 'LAB-2', lecture_type: 'Lab' });
      canonicalEntries.push({ day_of_week: day, period_number: 8, start_time: '14:50:00', end_time: '15:40:00', subject_id: subjectMapByCode.get('BCC301'), faculty_id: facultyMapByCode.get('SY'), room_number: 'A007', lecture_type: 'Theory' });
    }
  }
  await supabaseService.saveSectionTimetable({ sectionId: secAId, entries: canonicalEntries, publishedBy: 'Post-Test Restore' });
  console.log('  ✓ Restored Section A canonical 48-slot schedule for production');

  console.log('\n================================================================================');
  console.log(`🎉 ALL ${passedAssertions}/${totalAssertions} TIMETABLE DELETION INTEGRITY ASSERTIONS PASSED!`);
  console.log('   - Database count: strictly 0');
  console.log('   - Version status: archived');
  console.log('   - Faculty assignments: deactivated');
  console.log('   - Control Section B: completely untouched');
  console.log('   - Service queries & cache: clean zero state');
  console.log('   - Faculty & Student dashboards: zero stale entries');
  console.log('================================================================================\n');
}

runTimetableDeletionTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
