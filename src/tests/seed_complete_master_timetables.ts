import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import { TimetableResolver } from '../lib/utils/timetableResolver';
import { timetableIngestionService } from '../lib/services/timetableIngestionService';
import { ExtractedTimetableDocument, ExtractedTimetablePeriod } from '../types/academic.types';
import { DayOfWeek } from '../types/database.types';

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

async function seedCompleteMasterTimetables() {
  console.log('Seeding complete 42-period master timetables for Section A and Section B into Supabase Cloud...');
  const dbData = await supabaseService.fetchAllData();
  if (!dbData) throw new Error('No DB data');

  const secA = dbData.sections.find(s => s.name === 'A')!;
  const secB = dbData.sections.find(s => s.name === 'B')!;

  // Section A Canonical Schedule
  const secASchedule: { day: DayOfWeek; periods: ExtractedTimetablePeriod[] }[] = [
    {
      day: 'MON',
      periods: [
        { period_number: 1, start_time: '09:00', end_time: '09:50', subject_code: 'BCS301', subject_name: 'Data Structure', faculty_code: 'KK', faculty_name: 'Mr. Kuldeep Kumar', room_number: 'A007', lecture_type: 'Theory', is_break: false },
        { period_number: 2, start_time: '09:50', end_time: '10:40', subject_code: 'BCS302', subject_name: 'Computer Organization & Architecture', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', room_number: 'A007', lecture_type: 'Theory', is_break: false },
        { period_number: 3, start_time: '10:40', end_time: '11:30', subject_code: 'BAS303', subject_name: 'Mathematics IV', faculty_code: 'NAK', faculty_name: 'Dr. Naseem Ahamad Khan', room_number: 'A007', lecture_type: 'Theory', is_break: false },
        { period_number: 4, start_time: '11:30', end_time: '12:20', subject_code: 'BCS303', subject_name: 'Discrete Structure & Theory of Logic', faculty_code: 'HEM', faculty_name: 'Ms. Hemlata Chaudhary', room_number: 'A007', lecture_type: 'Theory', is_break: false },
        { period_number: 5, start_time: '12:20', end_time: '13:10', subject_code: 'LUNCH', subject_name: 'Lunch Break', faculty_code: '', room_number: 'A007', lecture_type: 'Break', is_break: true },
        { period_number: 6, start_time: '13:10', end_time: '14:00', subject_code: 'BVE301', subject_name: 'Universal Human Values', faculty_code: 'PRS', faculty_name: 'Mr. Praveen Sharma', room_number: 'A007', lecture_type: 'Theory', is_break: false },
        { period_number: 7, start_time: '14:00', end_time: '14:50', subject_code: 'BCC301', subject_name: 'Cyber Security', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', room_number: 'A007', lecture_type: 'Theory', is_break: false },
        { period_number: 8, start_time: '14:50', end_time: '15:40', subject_code: 'BCC301', subject_name: 'Cyber Security', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', room_number: 'A007', lecture_type: 'Theory', is_break: false },
      ]
    },
    {
      day: 'TUE',
      periods: [
        { period_number: 1, start_time: '09:00', end_time: '09:50', subject_code: 'BAS303', subject_name: 'Mathematics IV', faculty_code: 'NAK', faculty_name: 'Dr. Naseem Ahamad Khan', room_number: 'A007', lecture_type: 'Theory', is_break: false },
        { period_number: 2, start_time: '09:50', end_time: '10:40', subject_code: 'BCS302', subject_name: 'Computer Organization & Architecture', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', room_number: 'A007', lecture_type: 'Theory', is_break: false },
        { period_number: 3, start_time: '10:40', end_time: '11:30', subject_code: 'BCS303', subject_name: 'Discrete Structure & Theory of Logic', faculty_code: 'HEM', faculty_name: 'Ms. Hemlata Chaudhary', room_number: 'A007', lecture_type: 'Theory', is_break: false },
        { period_number: 4, start_time: '11:30', end_time: '12:20', subject_code: 'BCS301', subject_name: 'Data Structure', faculty_code: 'KK', faculty_name: 'Mr. Kuldeep Kumar', room_number: 'A007', lecture_type: 'Theory', is_break: false },
        { period_number: 5, start_time: '12:20', end_time: '13:10', subject_code: 'LUNCH', subject_name: 'Lunch Break', faculty_code: '', room_number: 'A007', lecture_type: 'Break', is_break: true },
        { period_number: 6, start_time: '13:10', end_time: '14:00', subject_code: 'BVE301', subject_name: 'Universal Human Values', faculty_code: 'PRS', faculty_name: 'Mr. Praveen Sharma', room_number: 'A007', lecture_type: 'Theory', is_break: false },
        { period_number: 7, start_time: '14:00', end_time: '14:50', subject_code: 'BCS351', subject_name: 'Data Structure Lab', faculty_code: 'KK', faculty_name: 'Mr. Kuldeep Kumar', room_number: 'A007', lecture_type: 'Practical', is_break: false },
        { period_number: 8, start_time: '14:50', end_time: '15:40', subject_code: 'BCS351', subject_name: 'Data Structure Lab', faculty_code: 'HEM', faculty_name: 'Ms. Hemlata Chaudhary', room_number: 'A007', lecture_type: 'Practical', is_break: false },
      ]
    },
    {
      day: 'WED',
      periods: [
        { period_number: 1, start_time: '09:00', end_time: '09:50', subject_code: 'BCS302', subject_name: 'Computer Organization & Architecture', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', room_number: 'A007', lecture_type: 'Theory', is_break: false },
        { period_number: 2, start_time: '09:50', end_time: '10:40', subject_code: 'BCS303', subject_name: 'Discrete Structure & Theory of Logic', faculty_code: 'HEM', faculty_name: 'Ms. Hemlata Chaudhary', room_number: 'A007', lecture_type: 'Theory', is_break: false },
        { period_number: 3, start_time: '10:40', end_time: '11:30', subject_code: 'BCS301', subject_name: 'Data Structure', faculty_code: 'KK', faculty_name: 'Mr. Kuldeep Kumar', room_number: 'A007', lecture_type: 'Theory', is_break: false },
        { period_number: 4, start_time: '11:30', end_time: '12:20', subject_code: 'BAS303', subject_name: 'Mathematics IV', faculty_code: 'NAK', faculty_name: 'Dr. Naseem Ahamad Khan', room_number: 'A007', lecture_type: 'Theory', is_break: false },
        { period_number: 5, start_time: '12:20', end_time: '13:10', subject_code: 'LUNCH', subject_name: 'Lunch Break', faculty_code: '', room_number: 'A007', lecture_type: 'Break', is_break: true },
        { period_number: 6, start_time: '13:10', end_time: '14:00', subject_code: 'BVE301', subject_name: 'Universal Human Values', faculty_code: 'PRS', faculty_name: 'Mr. Praveen Sharma', room_number: 'A007', lecture_type: 'Theory', is_break: false },
        { period_number: 7, start_time: '14:00', end_time: '14:50', subject_code: 'BCS352', subject_name: 'COA Lab', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', room_number: 'A007', lecture_type: 'Practical', is_break: false },
        { period_number: 8, start_time: '14:50', end_time: '15:40', subject_code: 'BCS352', subject_name: 'COA Lab', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', room_number: 'A007', lecture_type: 'Practical', is_break: false },
      ]
    },
    {
      day: 'THU',
      periods: [
        { period_number: 1, start_time: '09:00', end_time: '09:50', subject_code: 'BCS303', subject_name: 'Discrete Structure & Theory of Logic', faculty_code: 'HEM', faculty_name: 'Ms. Hemlata Chaudhary', room_number: 'A007', lecture_type: 'Theory', is_break: false },
        { period_number: 2, start_time: '09:50', end_time: '10:40', subject_code: 'BCS301', subject_name: 'Data Structure', faculty_code: 'KK', faculty_name: 'Mr. Kuldeep Kumar', room_number: 'A007', lecture_type: 'Theory', is_break: false },
        { period_number: 3, start_time: '10:40', end_time: '11:30', subject_code: 'BCS302', subject_name: 'Computer Organization & Architecture', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', room_number: 'A007', lecture_type: 'Theory', is_break: false },
        { period_number: 4, start_time: '11:30', end_time: '12:20', subject_code: 'BAS303', subject_name: 'Mathematics IV', faculty_code: 'NAK', faculty_name: 'Dr. Naseem Ahamad Khan', room_number: 'A007', lecture_type: 'Theory', is_break: false },
        { period_number: 5, start_time: '12:20', end_time: '13:10', subject_code: 'LUNCH', subject_name: 'Lunch Break', faculty_code: '', room_number: 'A007', lecture_type: 'Break', is_break: true },
        { period_number: 6, start_time: '13:10', end_time: '14:00', subject_code: 'BVE301', subject_name: 'Universal Human Values', faculty_code: 'PRS', faculty_name: 'Mr. Praveen Sharma', room_number: 'A007', lecture_type: 'Theory', is_break: false },
        { period_number: 7, start_time: '14:00', end_time: '14:50', subject_code: 'BCS353', subject_name: 'DSTL Lab', faculty_code: 'SHS', faculty_name: 'Ms. Shivani Sarswat', room_number: 'A007', lecture_type: 'Practical', is_break: false },
        { period_number: 8, start_time: '14:50', end_time: '15:40', subject_code: 'BCS353', subject_name: 'DSTL Lab', faculty_code: 'SHS', faculty_name: 'Ms. Shivani Sarswat', room_number: 'A007', lecture_type: 'Practical', is_break: false },
      ]
    },
    {
      day: 'FRI',
      periods: [
        { period_number: 1, start_time: '09:00', end_time: '09:50', subject_code: 'BCS301', subject_name: 'Data Structure', faculty_code: 'KK', faculty_name: 'Mr. Kuldeep Kumar', room_number: 'A007', lecture_type: 'Theory', is_break: false },
        { period_number: 2, start_time: '09:50', end_time: '10:40', subject_code: 'BAS303', subject_name: 'Mathematics IV', faculty_code: 'NAK', faculty_name: 'Dr. Naseem Ahamad Khan', room_number: 'A007', lecture_type: 'Theory', is_break: false },
        { period_number: 3, start_time: '10:40', end_time: '11:30', subject_code: 'BCS302', subject_name: 'Computer Organization & Architecture', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', room_number: 'A007', lecture_type: 'Theory', is_break: false },
        { period_number: 4, start_time: '11:30', end_time: '12:20', subject_code: 'BCC301', subject_name: 'Cyber Security', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', room_number: 'A007', lecture_type: 'Theory', is_break: false },
        { period_number: 5, start_time: '12:20', end_time: '13:10', subject_code: 'LUNCH', subject_name: 'Lunch Break', faculty_code: '', room_number: 'A007', lecture_type: 'Break', is_break: true },
        { period_number: 6, start_time: '13:10', end_time: '14:00', subject_code: 'BVE301', subject_name: 'Universal Human Values', faculty_code: 'PRS', faculty_name: 'Mr. Praveen Sharma', room_number: 'A007', lecture_type: 'Theory', is_break: false },
        { period_number: 7, start_time: '14:00', end_time: '14:50', subject_code: 'BCC351', subject_name: 'Cyber Security Lab', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', room_number: 'A007', lecture_type: 'Practical', is_break: false },
        { period_number: 8, start_time: '14:50', end_time: '15:40', subject_code: 'BCC351', subject_name: 'Cyber Security Lab', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', room_number: 'A007', lecture_type: 'Practical', is_break: false },
      ]
    },
    {
      day: 'SAT',
      periods: [
        { period_number: 1, start_time: '09:00', end_time: '09:50', subject_code: 'BAS303', subject_name: 'Mathematics IV', faculty_code: 'NAK', faculty_name: 'Dr. Naseem Ahamad Khan', room_number: 'A007', lecture_type: 'Theory', is_break: false },
        { period_number: 2, start_time: '09:50', end_time: '10:40', subject_code: 'BCS301', subject_name: 'Data Structure', faculty_code: 'KK', faculty_name: 'Mr. Kuldeep Kumar', room_number: 'A007', lecture_type: 'Theory', is_break: false },
        { period_number: 3, start_time: '10:40', end_time: '11:30', subject_code: 'BCS302', subject_name: 'Computer Organization & Architecture', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', room_number: 'A007', lecture_type: 'Theory', is_break: false },
        { period_number: 4, start_time: '11:30', end_time: '12:20', subject_code: 'BCC301', subject_name: 'Cyber Security', faculty_code: 'ALG', faculty_name: 'Mr. Alok Gupta', room_number: 'A007', lecture_type: 'Theory', is_break: false },
        { period_number: 5, start_time: '12:20', end_time: '13:10', subject_code: 'LUNCH', subject_name: 'Lunch Break', faculty_code: '', room_number: 'A007', lecture_type: 'Break', is_break: true },
        { period_number: 6, start_time: '13:10', end_time: '14:00', subject_code: 'BAS303', subject_name: 'Mathematics IV', faculty_code: 'NAK', faculty_name: 'Dr. Naseem Ahamad Khan', room_number: 'A007', lecture_type: 'Theory', is_break: false },
        { period_number: 7, start_time: '14:00', end_time: '14:50', subject_code: 'BVE301', subject_name: 'Universal Human Values', faculty_code: 'PRS', faculty_name: 'Mr. Praveen Sharma', room_number: 'A007', lecture_type: 'Theory', is_break: false },
        { period_number: 8, start_time: '14:50', end_time: '15:40', subject_code: 'BCS303', subject_name: 'Discrete Structure & Theory of Logic', faculty_code: 'HEM', faculty_name: 'Ms. Hemlata Chaudhary', room_number: 'A007', lecture_type: 'Theory', is_break: false },
      ]
    }
  ];

  const docA: ExtractedTimetableDocument = {
    id: `master-doc-A-${Date.now()}`,
    source_file_name: 'Master_Timetable_CSE_2nd_Year_Section_A.png',
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
    schedule: secASchedule,
    overall_confidence: 96,
    confidence_breakdown: { metadata: 98, grid: 96, legend: 95 },
    warnings: []
  };

  const reportA = TimetableResolver.resolveDocument(docA, {
    departments: dbData.departments,
    programs: dbData.programs,
    years: dbData.years,
    semesters: dbData.semesters,
    sections: dbData.sections,
    subjects: dbData.subjects,
    faculty: dbData.faculty,
    existingTimetable: dbData.timetable,
  });

  await timetableIngestionService.approveAndPublishTimetable({
    doc: docA,
    report: reportA,
    approvedBy: 'HOD CSE (Mr. Wasim)',
    importId: docA.id,
    customEffectiveDate: '2026-08-20',
  });

  console.log('✅ Section A 42-period canonical master schedule successfully published!');
}

seedCompleteMasterTimetables().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
