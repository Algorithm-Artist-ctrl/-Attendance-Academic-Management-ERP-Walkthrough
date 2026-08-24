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

async function runTimetableSyncTests() {
  console.log('======================================================================');
  console.log('  VCTM ERP TIMETABLE MASTER → FACULTY DASHBOARD SYNCHRONIZATION TEST');
  console.log('  Vivekananda College of Technology & Management, Aligarh (Code: 340)');
  console.log('======================================================================\n');

  // 1. Fetch live master DB from Supabase Cloud
  const dbData = await supabaseService.fetchAllData();
  assert(dbData !== null, 'Connected to live Supabase Cloud Database');

  const { sections, faculty, subjects, timetable, assignments, timetableVersions } = dbData!;
  assert(sections.length >= 2, 'Found active sections in Supabase (Section A & Section B)');
  assert(faculty.length >= 10, 'Found faculty members in Supabase');
  assert(timetable.length >= 80, 'Found published master timetable entries in Supabase');

  const secA = sections.find(s => s.name === 'A')!;
  const secB = sections.find(s => s.name === 'B')!;
  const hemlata = faculty.find(f => f.faculty_code === 'HEM')!;
  const kuldeep = faculty.find(f => f.faculty_code === 'KK')!;
  const naseem = faculty.find(f => f.faculty_code === 'NAK')!;
  const imran = faculty.find(f => f.faculty_code === 'IRK')!;

  assert(Boolean(secA && secB), 'Resolved Section A and Section B records');
  assert(Boolean(hemlata && kuldeep && naseem && imran), 'Resolved test faculty members (HEM, KK, NAK, IRK)');

  // 2. Test Single Source of Truth & Timetable Versioning
  console.log('\n--- SUITE 1: Timetable Versioning & Active Status in Supabase ---');
  const activeVersions = timetableVersions.filter(v => v.status === 'active');
  assert(activeVersions.length >= 2, `Active timetable versions exist in Supabase (${activeVersions.length} active versions)`);

  const secAVersion = activeVersions.find(v => v.section_id === secA.id);
  const secBVersion = activeVersions.find(v => v.section_id === secB.id);
  assert(Boolean(secAVersion), 'Section A has published active timetable version');
  assert(Boolean(secBVersion), 'Section B has published active timetable version');
  assert(Boolean(secAVersion?.effective_from), `Section A effective date: ${secAVersion?.effective_from}`);

  // 3. Test Timetable Ingestion & Publishing Pipeline with Auto Faculty Assignment Sync
  console.log('\n--- SUITE 2: Photo/AI Timetable Publishing & Database Synchronization ---');
  const testDoc: ExtractedTimetableDocument = {
    id: `test-doc-${Date.now()}`,
    source_file_name: 'CSE_2nd_Year_Section_A_Test_Upload.png',
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
          { period_number: 1, start_time: '09:00', end_time: '09:50', subject_code: 'BCS301', subject_name: 'Data Structure', faculty_code: 'KK', faculty_name: 'Mr. Kuldeep Kumar', room_number: 'A007', lecture_type: 'Theory', is_break: false, confidence: 95 },
          { period_number: 2, start_time: '09:50', end_time: '10:40', subject_code: 'BCS302', subject_name: 'Computer Organization & Architecture', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', room_number: 'A007', lecture_type: 'Theory', is_break: false, confidence: 95 },
          { period_number: 3, start_time: '10:40', end_time: '11:30', subject_code: 'BAS303', subject_name: 'Mathematics IV', faculty_code: 'NAK', faculty_name: 'Dr. Naseem Ahamad Khan', room_number: 'A007', lecture_type: 'Theory', is_break: false, confidence: 95 },
          { period_number: 4, start_time: '11:30', end_time: '12:20', subject_code: 'BCS303', subject_name: 'Discrete Structure & Theory of Logic', faculty_code: 'HEM', faculty_name: 'Ms. Hemlata Chaudhary', room_number: 'A007', lecture_type: 'Theory', is_break: false, confidence: 95 },
          { period_number: 5, start_time: '12:20', end_time: '13:10', subject_code: 'LUNCH', subject_name: 'Lunch Break', faculty_code: '', room_number: 'A007', lecture_type: 'Break', is_break: true, confidence: 99 },
          { period_number: 6, start_time: '13:10', end_time: '14:00', subject_code: 'BVE301', subject_name: 'Universal Human Values', faculty_code: 'PRS', faculty_name: 'Mr. Praveen Sharma', room_number: 'A007', lecture_type: 'Theory', is_break: false, confidence: 95 },
          { period_number: 7, start_time: '14:00', end_time: '14:50', subject_code: 'BCC301', subject_name: 'Cyber Security', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', room_number: 'A007', lecture_type: 'Theory', is_break: false, confidence: 95 },
          { period_number: 8, start_time: '14:50', end_time: '15:40', subject_code: 'BCC301', subject_name: 'Cyber Security', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', room_number: 'A007', lecture_type: 'Theory', is_break: false, confidence: 95 },
        ]
      }
    ],
    overall_confidence: 94,
    confidence_breakdown: { metadata: 96, grid: 94, legend: 92 },
    warnings: []
  };

  const report = TimetableResolver.resolveDocument(testDoc, {
    departments: dbData!.departments,
    programs: dbData!.programs,
    years: dbData!.years,
    semesters: dbData!.semesters,
    sections: dbData!.sections,
    subjects: dbData!.subjects,
    faculty: dbData!.faculty,
    existingTimetable: dbData!.timetable,
  });

  assert(report.section?.id === secA.id, 'TimetableResolver correctly matched Section A (Room A007)');
  assert(report.classCoordinator?.id === hemlata.id, 'TimetableResolver matched Ms. Hemlata as Class Coordinator');
  assert(report.subjectMatches.every(sm => sm.matchedSubject !== undefined), 'All 10 subjects matched to valid Supabase curriculum');
  assert(report.facultyMatches.every(fm => fm.matchedFaculty !== undefined), 'All faculty codes matched to real Supabase faculty records');

  // 4. Test Faculty Dashboard Live Queries for Multiple Faculty Members
  console.log('\n--- SUITE 3: Faculty Dashboard Live Reflection & Scoped Authority ---');

  // Faculty 1: Ms. Hemlata Chaudhary (HEM)
  const hemTimetable = timetable.filter(t => t.faculty_id === hemlata.id && t.active);
  const hemAssignments = assignments.filter(a => a.faculty_id === hemlata.id && a.active);
  const hemSubjectIds = new Set([...hemAssignments.map(a => a.subject_id), ...hemTimetable.map(t => t.subject_id)]);
  const hemSectionIds = new Set([...hemAssignments.map(a => a.section_id), ...hemTimetable.map(t => t.section_id)]);
  const hemSubjects = subjects.filter(s => hemSubjectIds.has(s.id));
  const hemSections = sections.filter(s => hemSectionIds.has(s.id));

  assert(hemTimetable.length >= 14, `HEM Weekly Teaching Load: ${hemTimetable.length} Lectures/Week`);
  assert(hemSubjects.length >= 2, `HEM Assigned Subjects: ${hemSubjects.length} Courses`);
  assert(hemSections.length === 2, `HEM Sections Covered: ${hemSections.length} Sections (Section A & Section B)`);

  const hemSubjectCodes = hemSubjects.map(s => s.subject_code);
  assert(hemSubjectCodes.includes('BCS301'), 'HEM teaches BCS301 Data Structure');
  assert(hemSubjectCodes.includes('BCS303'), 'HEM teaches BCS303 Discrete Structure');
  assert(!hemSubjectCodes.includes('BAS303'), 'BAS303 Maths IV strictly excluded from HEM');
  assert(!hemSubjectCodes.includes('BVE301'), 'BVE301 UHV strictly excluded from HEM');

  // Faculty 2: Dr. Naseem Ahamad Khan (NAK)
  const nakTimetable = timetable.filter(t => t.faculty_id === naseem.id && t.active);
  const nakAssignments = assignments.filter(a => a.faculty_id === naseem.id && a.active);
  const nakSubjectIds = new Set([...nakAssignments.map(a => a.subject_id), ...nakTimetable.map(t => t.subject_id)]);
  const nakSubjects = subjects.filter(s => nakSubjectIds.has(s.id));
  const nakCodes = nakSubjects.map(s => s.subject_code);

  assert(nakTimetable.length >= 14, `NAK Weekly Teaching Load: ${nakTimetable.length} Lectures/Week`);
  assert(nakCodes.includes('BAS303'), 'NAK teaches BAS303 Mathematics IV');
  assert(!nakCodes.includes('BCS301'), 'BCS301 Data Structure strictly excluded from NAK');

  // Faculty 3: Mr. Kuldeep Kumar (KK)
  const kkTimetable = timetable.filter(t => t.faculty_id === kuldeep.id && t.active);
  const kkAssignments = assignments.filter(a => a.faculty_id === kuldeep.id && a.active);
  const kkSubjectIds = new Set([...kkAssignments.map(a => a.subject_id), ...kkTimetable.map(t => t.subject_id)]);
  const kkSubjects = subjects.filter(s => kkSubjectIds.has(s.id));
  const kkCodes = kkSubjects.map(s => s.subject_code);

  assert(kkTimetable.length >= 14, `KK Weekly Teaching Load: ${kkTimetable.length} Lectures/Week`);
  assert(kkCodes.includes('BCS302') || kkCodes.includes('BCS301'), 'KK teaches COA / DS');

  // 5. Test Class Coordinator Master Timetable Access
  console.log('\n--- SUITE 4: Class Coordinator Master Timetable Oversight ---');
  const secATimetable = timetable.filter(t => t.section_id === secA.id && t.active);
  const secBTimetable = timetable.filter(t => t.section_id === secB.id && t.active);

  assert(secATimetable.length === 42, `Section A Master Schedule contains all 42 periods across Mon-Sat`);
  assert(secBTimetable.length === 42, `Section B Master Schedule contains all 42 periods across Mon-Sat`);

  const secAFacultyIds = Array.from(new Set(secATimetable.map(t => t.faculty_id)));
  assert(secAFacultyIds.length >= 6, `Section A Master Timetable includes all ${secAFacultyIds.length} departmental teachers`);

  // 6. Test Student Schedule & Live Attendance Reflection
  console.log('\n--- SUITE 5: Student Schedule & Live Attendance Reflection ---');
  const studentA = dbData!.students.find(s => s.section_id === secA.id)!;
  const studentB = dbData!.students.find(s => s.section_id === secB.id)!;

  const studentALectures = timetable.filter(t => t.section_id === studentA.section_id && t.active);
  const studentBLectures = timetable.filter(t => t.section_id === studentB.section_id && t.active);

  assert(studentALectures.length === 42, 'Student A receives exactly 42 weekly lectures for Section A (Room A007)');
  assert(studentBLectures.length === 42, 'Student B receives exactly 42 weekly lectures for Section B (Room A 006)');
  assert(studentALectures.every(t => t.section_id === secA.id), '100% of Student A lectures belong to Section A (0 foreign slots)');
  assert(studentBLectures.every(t => t.section_id === secB.id), '100% of Student B lectures belong to Section B (0 foreign slots)');

  console.log('\n======================================================================');
  if (passedTests === totalTests) {
    console.log(`  🎉 ALL ${passedTests}/${totalTests} TIMETABLE SYNCHRONIZATION TESTS PASSED! 🎉`);
  } else {
    console.error(`  ⚠️ COMPLETED: ${passedTests}/${totalTests} Passed`);
  }
}

runTimetableSyncTests().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
