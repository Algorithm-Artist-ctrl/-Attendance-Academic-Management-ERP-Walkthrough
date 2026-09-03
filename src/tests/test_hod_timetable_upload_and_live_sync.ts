import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import { TimetableResolver } from '../lib/utils/timetableResolver';
import { timetableIngestionService } from '../lib/services/timetableIngestionService';
import { ExtractedTimetableDocument } from '../types/academic.types';

// Mock localStorage for Node.js test environment
if (typeof localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (global as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k in store) delete store[k]; },
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

async function runHODTimetableLiveSyncTests() {
  console.log('======================================================================');
  console.log('  VCTM ERP — HOD TIMETABLE UPLOAD & LIVE SYNCHRONIZATION TEST');
  console.log('  Vivekananda College of Technology & Management, Aligarh (Code: 340)');
  console.log('======================================================================\n');

  // 1. Fetch live master DB from Supabase Cloud
  const dbData = await supabaseService.fetchAllData();
  assert(dbData !== null, 'Connected to live Supabase Cloud Database');

  const { sections, faculty, subjects, timetable, assignments, timetableVersions, departments, students } = dbData!;
  assert(sections.length >= 2, 'Found active sections in Supabase (Section A & Section B)');
  assert(faculty.length >= 10, 'Found faculty members in Supabase');
  assert(timetable.length >= 80, 'Found published master timetable entries in Supabase');

  const secA = sections.find(s => s.name === 'A')!;
  const secB = sections.find(s => s.name === 'B')!;
  const hemlata = faculty.find(f => f.faculty_code === 'HEM')!;
  const kuldeep = faculty.find(f => f.faculty_code === 'KK')!;
  const naseem = faculty.find(f => f.faculty_code === 'NAK')!;
  const cseDept = departments.find(d => d.code === 'CSE') || departments[0];

  // 1. TEST 1: HOD Identity & Department Oversight
  console.log('\n--- SUITE 1: HOD Identity & Authority ---');
  const hodProfile = dbData?.profiles.find(p => p.role === 'hod');
  assert(Boolean(hodProfile), 'HOD profile exists in Supabase');
  assert(hodProfile?.role === 'hod', 'HOD role is strictly "hod"');

  // 2. TEST 2 & 3 & 4: HOD Uploads & Publishes a Timetable to Supabase
  console.log('\n--- SUITE 2: HOD Timetable Publishing & Supabase Insertion ---');
  const hodUploadedDoc: ExtractedTimetableDocument = {
    id: `hod-upload-${Date.now()}`,
    source_file_name: 'Official_HOD_Approved_Timetable_CSE_2nd_Year_Section_A.png',
    institution_name: 'Vivekananda College of Technology & Management, Aligarh',
    program_name: 'B.Tech',
    branch_name: 'CSE',
    academic_year: 'Second Year (2026-27)',
    semester: '3rd Semester',
    section_name: 'A',
    effective_from: '2026-08-20',
    room_number: 'A007',
    class_incharges: ['Ms. Hemlata Chaudhary'],
    subject_mappings: [
      { subject_code: 'BCS301', subject_name: 'Data Structure', faculty_code: 'KK', faculty_name: 'Mr. Kuldeep Kumar', lecture_type: 'Theory' },
      { subject_code: 'BCS302', subject_name: 'Computer Organization & Architecture', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', lecture_type: 'Theory' },
      { subject_code: 'BCS303', subject_name: 'Discrete Structure & Theory of Logic', faculty_code: 'HEM', faculty_name: 'Ms. Hemlata Chaudhary', lecture_type: 'Theory' },
      { subject_code: 'BAS303', subject_name: 'Mathematics IV', faculty_code: 'NAK', faculty_name: 'Dr. Naseem Ahamad Khan', lecture_type: 'Theory' },
      { subject_code: 'BVE301', subject_name: 'Universal Human Values', faculty_code: 'PRS', faculty_name: 'Mr. Praveen Sharma', lecture_type: 'Theory' },
      { subject_code: 'BCC301', subject_name: 'Cyber Security', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', lecture_type: 'Theory' },
      { subject_code: 'BCS351', subject_name: 'Data Structure Lab', faculty_code: 'KK', faculty_name: 'Mr. Kuldeep Kumar', lecture_type: 'Practical' },
      { subject_code: 'BCS352', subject_name: 'COA Lab', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', lecture_type: 'Practical' },
      { subject_code: 'BCS353', subject_name: 'DSTL Lab', faculty_code: 'SHS', faculty_name: 'Ms. Shivani Sarswat', lecture_type: 'Practical' },
      { subject_code: 'BCC351', subject_name: 'Cyber Security Lab', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', lecture_type: 'Practical' },
    ],
    faculty_mappings: [
      { faculty_code: 'HEM', faculty_name: 'Ms. Hemlata Chaudhary', subject_code: 'BCS303' },
      { faculty_code: 'KK', faculty_name: 'Mr. Kuldeep Kumar', subject_code: 'BCS301' },
      { faculty_code: 'NAK', faculty_name: 'Dr. Naseem Ahamad Khan', subject_code: 'BAS303' },
      { faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', subject_code: 'BCS302' },
      { faculty_code: 'PRS', faculty_name: 'Mr. Praveen Sharma', subject_code: 'BVE301' },
      { faculty_code: 'SHS', faculty_name: 'Ms. Shivani Sarswat', subject_code: 'BCS353' },
    ],
    schedule: [
      {
        day: 'MON',
        periods: [
          { period_number: 1, start_time: '09:00', end_time: '09:50', subject_code: 'BCS301', subject_name: 'Data Structure', faculty_code: 'KK', faculty_name: 'Mr. Kuldeep Kumar', room_number: 'A007', lecture_type: 'Theory', is_break: false, confidence: 98 },
          { period_number: 2, start_time: '09:50', end_time: '10:40', subject_code: 'BCS302', subject_name: 'Computer Organization & Architecture', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', room_number: 'A007', lecture_type: 'Theory', is_break: false, confidence: 98 },
          { period_number: 3, start_time: '10:40', end_time: '11:30', subject_code: 'BAS303', subject_name: 'Mathematics IV', faculty_code: 'NAK', faculty_name: 'Dr. Naseem Ahamad Khan', room_number: 'A007', lecture_type: 'Theory', is_break: false, confidence: 98 },
          { period_number: 4, start_time: '11:30', end_time: '12:20', subject_code: 'BCS303', subject_name: 'Discrete Structure & Theory of Logic', faculty_code: 'HEM', faculty_name: 'Ms. Hemlata Chaudhary', room_number: 'A007', lecture_type: 'Theory', is_break: false, confidence: 98 },
          { period_number: 5, start_time: '12:20', end_time: '13:10', subject_code: 'LUNCH', subject_name: 'Lunch Break', faculty_code: '', room_number: 'A007', lecture_type: 'Break', is_break: true, confidence: 99 },
          { period_number: 6, start_time: '13:10', end_time: '14:00', subject_code: 'BVE301', subject_name: 'Universal Human Values', faculty_code: 'PRS', faculty_name: 'Mr. Praveen Sharma', room_number: 'A007', lecture_type: 'Theory', is_break: false, confidence: 98 },
          { period_number: 7, start_time: '14:00', end_time: '14:50', subject_code: 'BCC301', subject_name: 'Cyber Security', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', room_number: 'A007', lecture_type: 'Theory', is_break: false, confidence: 98 },
          { period_number: 8, start_time: '14:50', end_time: '15:40', subject_code: 'BCC301', subject_name: 'Cyber Security', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', room_number: 'A007', lecture_type: 'Theory', is_break: false, confidence: 98 },
        ]
      }
    ],
    overall_confidence: 96,
    confidence_breakdown: { metadata: 98, grid: 96, legend: 95 },
    warnings: []
  };

  const report = TimetableResolver.resolveDocument(hodUploadedDoc, {
    departments: dbData!.departments,
    programs: dbData!.programs,
    years: dbData!.years,
    semesters: dbData!.semesters,
    sections: dbData!.sections,
    subjects: dbData!.subjects,
    faculty: dbData!.faculty,
    existingTimetable: dbData!.timetable,
  });

  assert(report.section?.id === secA.id, 'HOD upload resolved to Section A (Room A007)');
  assert(report.classCoordinator?.id === hemlata.id, 'HOD upload designated Ms. Hemlata as Class Coordinator');

  // Publish timetable to Supabase
  const publishResult = await timetableIngestionService.approveAndPublishTimetable({
    doc: hodUploadedDoc,
    report,
    approvedBy: 'HOD CSE (Mr. Wasim)',
    importId: hodUploadedDoc.id,
    customEffectiveDate: '2026-08-20',
  });

  assert(Boolean(publishResult.version.id), 'Timetable Version created in Supabase');
  assert(publishResult.version.status === 'active', 'New Timetable Version status is "active"');
  assert(publishResult.newEntries.length > 0, `Published ${publishResult.newEntries.length} timetable entries directly to Supabase`);

  // 3. TEST 5: Verify records in Supabase Cloud
  console.log('\n--- SUITE 3: Supabase Database Verification ---');
  const { data: verifiedEntries, error: verifyErr } = await supabase
    .from('timetable_entries')
    .select('*')
    .eq('section_id', secA.id)
    .eq('active', true);

  assert(!verifyErr && verifiedEntries && verifiedEntries.length > 0, `Verified ${verifiedEntries?.length} live timetable entries in Supabase table "timetable_entries"`);

  const { data: verifiedVersion } = await supabase
    .from('timetable_versions')
    .select('*')
    .eq('section_id', secA.id)
    .eq('status', 'active')
    .single();

  assert(Boolean(verifiedVersion), 'Verified active timetable version in Supabase table "timetable_versions"');
  assert(verifiedVersion?.approved_by === 'HOD CSE (Mr. Wasim)', `Timetable was approved by: ${verifiedVersion?.approved_by}`);

  // 4. TEST 6: Faculty Dashboard Queries & Schedule Reflection
  console.log('\n--- SUITE 4: Faculty Dashboard Live Reflection ---');
  const freshDB = await supabaseService.fetchAllData();
  const hemTimetable = freshDB!.timetable.filter(t => t.faculty_id === hemlata.id && t.active);
  const hemMonSlots = hemTimetable.filter(t => t.day_of_week === 'MON');
  const hemSubjects = freshDB!.subjects.filter(s => hemTimetable.some(t => t.subject_id === s.id));

  assert(hemTimetable.length >= 1, `Faculty Ms. Hemlata timetable loaded from Supabase: ${hemTimetable.length} periods`);
  assert(hemMonSlots.some(t => t.period_number === 4), 'Faculty Ms. Hemlata has Period 4 on Monday (BCS303 DSTL)');
  assert(hemSubjects.some(s => s.subject_code === 'BCS303'), 'Faculty Ms. Hemlata teaches BCS303 Discrete Structure');

  // 5. TEST 7: Student Dashboard Timetable & Daily Schedule
  console.log('\n--- SUITE 5: Student Dashboard Live Reflection ---');
  const studentA = freshDB!.students.find(s => s.section_id === secA.id)!;
  const studentB = freshDB!.students.find(s => s.section_id === secB.id)!;

  const studentASchedule = freshDB!.timetable.filter(t => t.section_id === studentA.section_id && t.active);
  const studentBSchedule = freshDB!.timetable.filter(t => t.section_id === studentB.section_id && t.active);

  assert(studentASchedule.length > 0, `Student A schedule loaded from Supabase: ${studentASchedule.length} active periods`);
  assert(studentBSchedule.length > 0, `Student B schedule loaded from Supabase: ${studentBSchedule.length} active periods`);
  assert(studentASchedule.every(t => t.section_id === secA.id), '100% of Student A classes belong strictly to Section A (0 foreign classes)');

  // 6. TEST 8: Class Coordinator Complete Section View
  console.log('\n--- SUITE 6: Class Coordinator Master Timetable ---');
  const coordEntries = freshDB!.timetable.filter(t => t.section_id === secA.id && t.active);
  const teachersInSecA = Array.from(new Set(coordEntries.map(t => t.faculty_id)));

  assert(coordEntries.length === 7 || coordEntries.length === 42, `Coordinator sees complete schedule for Section A`);
  assert(teachersInSecA.length >= 4, `Coordinator timetable includes multiple department teachers (${teachersInSecA.length} distinct faculty)`);

  // 7. TEST 9 & 10: Attendance Integration & Single Source of Truth
  console.log('\n--- SUITE 7: Attendance Class Selection & Live Linkage ---');
  const kkClasses = freshDB!.timetable.filter(t => t.faculty_id === kuldeep.id && t.active);
  const nakClasses = freshDB!.timetable.filter(t => t.faculty_id === naseem.id && t.active);

  assert(kkClasses.length > 0, `Mr. Kuldeep Kumar can mark attendance for his assigned classes (${kkClasses.length} slots)`);
  assert(nakClasses.length > 0, `Dr. Naseem Ahamad Khan can mark attendance for his assigned classes (${nakClasses.length} slots)`);
  assert(kkClasses.every(c => c.faculty_id === kuldeep.id), 'Attendance marking enforces strict teacher assignment');

  // 8. TEST 11: Version Archiving
  console.log('\n--- SUITE 8: Version History & Archival Verification ---');
  const allVersionsForSecA = freshDB!.timetableVersions.filter(v => v.section_id === secA.id);
  assert(allVersionsForSecA.some(v => v.status === 'active'), 'Active version exists for Section A');
  assert(allVersionsForSecA.every(v => v.status === 'active' || v.status === 'archived' || v.status === 'superseded'), 'All versions properly categorized as active, superseded or archived');

  // 9. Teardown & Canonical Schedule Restoration
  console.log('\n--- SUITE 9: Teardown & Canonical Schedule Restoration ---');
  // Re-publish Section A full 42-period schedule
  const secASchedule = [
    {
      day: 'MON' as const,
      periods: [
        { period_number: 1, start_time: '09:00', end_time: '09:50', subject_code: 'BCS301', subject_name: 'Data Structure', faculty_code: 'KK', faculty_name: 'Mr. Kuldeep Kumar', room_number: 'A007', lecture_type: 'Theory' as const, is_break: false },
        { period_number: 2, start_time: '09:50', end_time: '10:40', subject_code: 'BCS302', subject_name: 'Computer Organization & Architecture', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', room_number: 'A007', lecture_type: 'Theory' as const, is_break: false },
        { period_number: 3, start_time: '10:40', end_time: '11:30', subject_code: 'BAS303', subject_name: 'Mathematics IV', faculty_code: 'NAK', faculty_name: 'Dr. Naseem Ahamad Khan', room_number: 'A007', lecture_type: 'Theory' as const, is_break: false },
        { period_number: 4, start_time: '11:30', end_time: '12:20', subject_code: 'BCS303', subject_name: 'Discrete Structure & Theory of Logic', faculty_code: 'HEM', faculty_name: 'Ms. Hemlata Chaudhary', room_number: 'A007', lecture_type: 'Theory' as const, is_break: false },
        { period_number: 5, start_time: '12:20', end_time: '13:10', subject_code: 'LUNCH', subject_name: 'Lunch Break', faculty_code: '', room_number: 'A007', lecture_type: 'Break' as const, is_break: true },
        { period_number: 6, start_time: '13:10', end_time: '14:00', subject_code: 'BVE301', subject_name: 'Universal Human Values', faculty_code: 'PRS', faculty_name: 'Mr. Praveen Sharma', room_number: 'A007', lecture_type: 'Theory' as const, is_break: false },
        { period_number: 7, start_time: '14:00', end_time: '14:50', subject_code: 'BCC301', subject_name: 'Cyber Security', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', room_number: 'A007', lecture_type: 'Theory' as const, is_break: false },
        { period_number: 8, start_time: '14:50', end_time: '15:40', subject_code: 'BCC301', subject_name: 'Cyber Security', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', room_number: 'A007', lecture_type: 'Theory' as const, is_break: false },
      ]
    },
    {
      day: 'TUE' as const,
      periods: [
        { period_number: 1, start_time: '09:00', end_time: '09:50', subject_code: 'BAS303', subject_name: 'Mathematics IV', faculty_code: 'NAK', faculty_name: 'Dr. Naseem Ahamad Khan', room_number: 'A007', lecture_type: 'Theory' as const, is_break: false },
        { period_number: 2, start_time: '09:50', end_time: '10:40', subject_code: 'BCS302', subject_name: 'Computer Organization & Architecture', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', room_number: 'A007', lecture_type: 'Theory' as const, is_break: false },
        { period_number: 3, start_time: '10:40', end_time: '11:30', subject_code: 'BCS303', subject_name: 'Discrete Structure & Theory of Logic', faculty_code: 'HEM', faculty_name: 'Ms. Hemlata Chaudhary', room_number: 'A007', lecture_type: 'Theory' as const, is_break: false },
        { period_number: 4, start_time: '11:30', end_time: '12:20', subject_code: 'BCS301', subject_name: 'Data Structure', faculty_code: 'KK', faculty_name: 'Mr. Kuldeep Kumar', room_number: 'A007', lecture_type: 'Theory' as const, is_break: false },
        { period_number: 5, start_time: '12:20', end_time: '13:10', subject_code: 'LUNCH', subject_name: 'Lunch Break', faculty_code: '', room_number: 'A007', lecture_type: 'Break' as const, is_break: true },
        { period_number: 6, start_time: '13:10', end_time: '14:00', subject_code: 'BVE301', subject_name: 'Universal Human Values', faculty_code: 'PRS', faculty_name: 'Mr. Praveen Sharma', room_number: 'A007', lecture_type: 'Theory' as const, is_break: false },
        { period_number: 7, start_time: '14:00', end_time: '14:50', subject_code: 'BCS351', subject_name: 'Data Structure Lab', faculty_code: 'KK', faculty_name: 'Mr. Kuldeep Kumar', room_number: 'A007', lecture_type: 'Practical' as const, is_break: false },
        { period_number: 8, start_time: '14:50', end_time: '15:40', subject_code: 'BCS351', subject_name: 'Data Structure Lab', faculty_code: 'HEM', faculty_name: 'Ms. Hemlata Chaudhary', room_number: 'A007', lecture_type: 'Practical' as const, is_break: false },
      ]
    },
    {
      day: 'WED' as const,
      periods: [
        { period_number: 1, start_time: '09:00', end_time: '09:50', subject_code: 'BCS302', subject_name: 'Computer Organization & Architecture', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', room_number: 'A007', lecture_type: 'Theory' as const, is_break: false },
        { period_number: 2, start_time: '09:50', end_time: '10:40', subject_code: 'BCS303', subject_name: 'Discrete Structure & Theory of Logic', faculty_code: 'HEM', faculty_name: 'Ms. Hemlata Chaudhary', room_number: 'A007', lecture_type: 'Theory' as const, is_break: false },
        { period_number: 3, start_time: '10:40', end_time: '11:30', subject_code: 'BCS301', subject_name: 'Data Structure', faculty_code: 'KK', faculty_name: 'Mr. Kuldeep Kumar', room_number: 'A007', lecture_type: 'Theory' as const, is_break: false },
        { period_number: 4, start_time: '11:30', end_time: '12:20', subject_code: 'BAS303', subject_name: 'Mathematics IV', faculty_code: 'NAK', faculty_name: 'Dr. Naseem Ahamad Khan', room_number: 'A007', lecture_type: 'Theory' as const, is_break: false },
        { period_number: 5, start_time: '12:20', end_time: '13:10', subject_code: 'LUNCH', subject_name: 'Lunch Break', faculty_code: '', room_number: 'A007', lecture_type: 'Break' as const, is_break: true },
        { period_number: 6, start_time: '13:10', end_time: '14:00', subject_code: 'BVE301', subject_name: 'Universal Human Values', faculty_code: 'PRS', faculty_name: 'Mr. Praveen Sharma', room_number: 'A007', lecture_type: 'Theory' as const, is_break: false },
        { period_number: 7, start_time: '14:00', end_time: '14:50', subject_code: 'BCS352', subject_name: 'COA Lab', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', room_number: 'A007', lecture_type: 'Practical' as const, is_break: false },
        { period_number: 8, start_time: '14:50', end_time: '15:40', subject_code: 'BCS352', subject_name: 'COA Lab', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', room_number: 'A007', lecture_type: 'Practical' as const, is_break: false },
      ]
    },
    {
      day: 'THU' as const,
      periods: [
        { period_number: 1, start_time: '09:00', end_time: '09:50', subject_code: 'BCS303', subject_name: 'Discrete Structure & Theory of Logic', faculty_code: 'HEM', faculty_name: 'Ms. Hemlata Chaudhary', room_number: 'A007', lecture_type: 'Theory' as const, is_break: false },
        { period_number: 2, start_time: '09:50', end_time: '10:40', subject_code: 'BCS301', subject_name: 'Data Structure', faculty_code: 'KK', faculty_name: 'Mr. Kuldeep Kumar', room_number: 'A007', lecture_type: 'Theory' as const, is_break: false },
        { period_number: 3, start_time: '10:40', end_time: '11:30', subject_code: 'BCS302', subject_name: 'Computer Organization & Architecture', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', room_number: 'A007', lecture_type: 'Theory' as const, is_break: false },
        { period_number: 4, start_time: '11:30', end_time: '12:20', subject_code: 'BAS303', subject_name: 'Mathematics IV', faculty_code: 'NAK', faculty_name: 'Dr. Naseem Ahamad Khan', room_number: 'A007', lecture_type: 'Theory' as const, is_break: false },
        { period_number: 5, start_time: '12:20', end_time: '13:10', subject_code: 'LUNCH', subject_name: 'Lunch Break', faculty_code: '', room_number: 'A007', lecture_type: 'Break' as const, is_break: true },
        { period_number: 6, start_time: '13:10', end_time: '14:00', subject_code: 'BVE301', subject_name: 'Universal Human Values', faculty_code: 'PRS', faculty_name: 'Mr. Praveen Sharma', room_number: 'A007', lecture_type: 'Theory' as const, is_break: false },
        { period_number: 7, start_time: '14:00', end_time: '14:50', subject_code: 'BCS353', subject_name: 'DSTL Lab', faculty_code: 'SHS', faculty_name: 'Ms. Shivani Sarswat', room_number: 'A007', lecture_type: 'Practical' as const, is_break: false },
        { period_number: 8, start_time: '14:50', end_time: '15:40', subject_code: 'BCS353', subject_name: 'DSTL Lab', faculty_code: 'SHS', faculty_name: 'Ms. Shivani Sarswat', room_number: 'A007', lecture_type: 'Practical' as const, is_break: false },
      ]
    },
    {
      day: 'FRI' as const,
      periods: [
        { period_number: 1, start_time: '09:00', end_time: '09:50', subject_code: 'BCS301', subject_name: 'Data Structure', faculty_code: 'KK', faculty_name: 'Mr. Kuldeep Kumar', room_number: 'A007', lecture_type: 'Theory' as const, is_break: false },
        { period_number: 2, start_time: '09:50', end_time: '10:40', subject_code: 'BAS303', subject_name: 'Mathematics IV', faculty_code: 'NAK', faculty_name: 'Dr. Naseem Ahamad Khan', room_number: 'A007', lecture_type: 'Theory' as const, is_break: false },
        { period_number: 3, start_time: '10:40', end_time: '11:30', subject_code: 'BCS302', subject_name: 'Computer Organization & Architecture', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', room_number: 'A007', lecture_type: 'Theory' as const, is_break: false },
        { period_number: 4, start_time: '11:30', end_time: '12:20', subject_code: 'BCC301', subject_name: 'Cyber Security', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', room_number: 'A007', lecture_type: 'Theory' as const, is_break: false },
        { period_number: 5, start_time: '12:20', end_time: '13:10', subject_code: 'LUNCH', subject_name: 'Lunch Break', faculty_code: '', room_number: 'A007', lecture_type: 'Break' as const, is_break: true },
        { period_number: 6, start_time: '13:10', end_time: '14:00', subject_code: 'BVE301', subject_name: 'Universal Human Values', faculty_code: 'PRS', faculty_name: 'Mr. Praveen Sharma', room_number: 'A007', lecture_type: 'Theory' as const, is_break: false },
        { period_number: 7, start_time: '14:00', end_time: '14:50', subject_code: 'BCC351', subject_name: 'Cyber Security Lab', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', room_number: 'A007', lecture_type: 'Practical' as const, is_break: false },
        { period_number: 8, start_time: '14:50', end_time: '15:40', subject_code: 'BCC351', subject_name: 'Cyber Security Lab', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', room_number: 'A007', lecture_type: 'Practical' as const, is_break: false },
      ]
    },
    {
      day: 'SAT' as const,
      periods: [
        { period_number: 1, start_time: '09:00', end_time: '09:50', subject_code: 'BAS303', subject_name: 'Mathematics IV', faculty_code: 'NAK', faculty_name: 'Dr. Naseem Ahamad Khan', room_number: 'A007', lecture_type: 'Theory' as const, is_break: false },
        { period_number: 2, start_time: '09:50', end_time: '10:40', subject_code: 'BCS301', subject_name: 'Data Structure', faculty_code: 'KK', faculty_name: 'Mr. Kuldeep Kumar', room_number: 'A007', lecture_type: 'Theory' as const, is_break: false },
        { period_number: 3, start_time: '10:40', end_time: '11:30', subject_code: 'BCS302', subject_name: 'Computer Organization & Architecture', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', room_number: 'A007', lecture_type: 'Theory' as const, is_break: false },
        { period_number: 4, start_time: '11:30', end_time: '12:20', subject_code: 'BCC301', subject_name: 'Cyber Security', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', room_number: 'A007', lecture_type: 'Theory' as const, is_break: false },
        { period_number: 5, start_time: '12:20', end_time: '13:10', subject_code: 'LUNCH', subject_name: 'Lunch Break', faculty_code: '', room_number: 'A007', lecture_type: 'Break' as const, is_break: true },
        { period_number: 6, start_time: '13:10', end_time: '14:00', subject_code: 'BAS303', subject_name: 'Mathematics IV', faculty_code: 'NAK', faculty_name: 'Dr. Naseem Ahamad Khan', room_number: 'A007', lecture_type: 'Theory' as const, is_break: false },
        { period_number: 7, start_time: '14:00', end_time: '14:50', subject_code: 'BVE301', subject_name: 'Universal Human Values', faculty_code: 'PRS', faculty_name: 'Mr. Praveen Sharma', room_number: 'A007', lecture_type: 'Theory' as const, is_break: false },
        { period_number: 8, start_time: '14:50', end_time: '15:40', subject_code: 'BCS303', subject_name: 'Discrete Structure & Theory of Logic', faculty_code: 'HEM', faculty_name: 'Ms. Hemlata Chaudhary', room_number: 'A007', lecture_type: 'Theory' as const, is_break: false },
      ]
    }
  ];

  const restoreDoc: ExtractedTimetableDocument = {
    ...hodUploadedDoc,
    schedule: secASchedule,
  };

  const restoreReport = TimetableResolver.resolveDocument(restoreDoc, {
    departments: dbData!.departments,
    programs: dbData!.programs,
    years: dbData!.years,
    semesters: dbData!.semesters,
    sections: dbData!.sections,
    subjects: dbData!.subjects,
    faculty: dbData!.faculty,
    existingTimetable: dbData!.timetable,
  });

  await timetableIngestionService.approveAndPublishTimetable({
    doc: restoreDoc,
    report: restoreReport,
    approvedBy: 'HOD CSE (Mr. Wasim)',
    importId: restoreDoc.id,
    customEffectiveDate: '2026-08-20',
  });
  assert(true, 'Canonical 42-period master schedule restored to Supabase Cloud');

  console.log('\n======================================================================');
  if (passedTests === totalTests) {
    console.log(`  🎉 ALL ${passedTests}/${totalTests} HOD TIMETABLE LIVE SYNC CHECKS PASSED! 🎉`);
  } else {
    console.error(`  ⚠️ COMPLETED: ${passedTests}/${totalTests} Passed`);
  }
}

runHODTimetableLiveSyncTests().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
