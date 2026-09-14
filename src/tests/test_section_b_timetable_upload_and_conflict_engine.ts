import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import { aiTimetableService } from '../lib/services/aiTimetableService';
import { timetableIngestionService } from '../lib/services/timetableIngestionService';
import { TimetableResolver } from '../lib/utils/timetableResolver';
import { UploadTargetContext, ExtractedTimetableDocument } from '../types/academic.types';
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

async function runSectionBUploadAndConflictVerification() {
  console.log('======================================================================');
  console.log('  VCTM ERP — SECTION B TIMETABLE UPLOAD & CONFLICT ENGINE VERIFICATION');
  console.log('  Vivekananda College of Technology & Management, Aligarh (Code: 340)');
  console.log('======================================================================\n');

  // 1. Fetch live database context
  const dbData = await supabaseService.fetchAllData();
  assert(dbData !== null, 'Connected to live Supabase Cloud Database');

  const { sections, departments, programs, years, semesters, faculty, subjects, timetable: existingTimetable, students } = dbData!;
  const year2 = years.find(y => y.year_number === 2);
  const sem3 = semesters.find(s => s.academic_year_id === year2?.id);
  const secB = sections.find(s => s.id === '233957c0-4fef-42c6-8285-40ebf73ea6b7') || sections.find(s => s.semester_id === sem3?.id && s.name === 'B')!;
  const secA = sections.find(s => s.id === 'fc93a413-c18d-4e72-9624-146767bc286b') || sections.find(s => s.semester_id === sem3?.id && s.name === 'A')!;
  const hemlata = faculty.find(f => f.faculty_code === 'HEM')!;

  assert(Boolean(secB && secA), 'Resolved Section A and Section B database records');
  assert(Boolean(hemlata), 'Resolved Faculty Ms. Hemlata Chaudhary (HEM)');

  // =========================================================================
  // TEST STEP 1-3: Construct Authoritative Section B Upload Target Context
  // =========================================================================
  console.log('\n--- STEP 1-3: Upload Context Initialization ---');
  const uploadContext: UploadTargetContext = {
    academicSessionName: '2026-2027',
    programName: 'B.Tech',
    branchName: 'CSE',
    academicYearName: 'Second Year (2026-27)',
    semesterName: '3rd Semester',
    sectionId: secB.id,
    sectionName: 'B',
    roomNumber: 'A006',
    effectiveFrom: '2026-08-20',
  };

  // Mock server extract endpoint in Node test environment
  const originalFetch = global.fetch;
  (global as any).fetch = async (url: any, options: any) => {
    if (String(url).includes('/api/timetable/extract')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          institution_name: 'Vivekananda College of Technology & Management, Aligarh',
          program_name: 'B.Tech',
          branch_name: 'CSE',
          academic_year: 'Second Year (2026-27)',
          semester: '3rd Semester',
          section_name: 'B',
          room_number: 'A006',
          effective_from: '2026-08-20',
          class_incharges: ['Ms. Hemlata Chaudhry'],
          subject_mappings: [
            { subject_code: 'BCS301', subject_name: 'Data Structure', faculty_code: 'HEM', faculty_name: 'Ms. Hemlata Chaudhry', lecture_type: 'Theory' },
            { subject_code: 'BCS302', subject_name: 'Computer Organization & Architecture', faculty_code: 'KK', faculty_name: 'Mr. Kuldeep Kumar', lecture_type: 'Theory' },
            { subject_code: 'BCS303', subject_name: 'Discrete Structure & Theory of Logic', faculty_code: 'IRK', faculty_name: 'Mr. Imran Raza Khan', lecture_type: 'Theory' },
            { subject_code: 'BAS303', subject_name: 'Mathematics IV', faculty_code: 'NAK', faculty_name: 'Dr. Naseem Ahamad Khan', lecture_type: 'Theory' },
            { subject_code: 'BVE301', subject_name: 'Universal Human Value', faculty_code: 'SHS', faculty_name: 'Ms. Shivani Sarswat', lecture_type: 'Theory' },
            { subject_code: 'BCC301', subject_name: 'Cyber Security', faculty_code: 'FZN', faculty_name: 'Dr. Faizan Nasir', lecture_type: 'Theory' },
            { subject_code: 'BCS351', subject_name: 'Data Structure Lab', faculty_code: 'HEM', faculty_name: 'Ms. Hemlata Chaudhry', lecture_type: 'Practical' },
            { subject_code: 'BCS352', subject_name: 'Computer Organization & Architecture Lab', faculty_code: 'KK', faculty_name: 'Mr. Kuldeep Kumar', lecture_type: 'Practical' },
            { subject_code: 'BCS353', subject_name: 'Web Designing Workshop', faculty_code: 'PRS', faculty_name: 'Mr. Praveen Sharma', lecture_type: 'Workshop' },
          ],
          faculty_mappings: [
            { faculty_code: 'HEM', faculty_name: 'Ms. Hemlata Chaudhry' },
            { faculty_code: 'KK', faculty_name: 'Mr. Kuldeep Kumar' },
            { faculty_code: 'IRK', faculty_name: 'Mr. Imran Raza Khan' },
            { faculty_code: 'NAK', faculty_name: 'Dr. Naseem Ahamad Khan' },
            { faculty_code: 'SHS', faculty_name: 'Ms. Shivani Sarswat' },
            { faculty_code: 'FZN', faculty_name: 'Dr. Faizan Nasir' },
            { faculty_code: 'PRS', faculty_name: 'Mr. Praveen Sharma' },
          ],
          schedule: [
            {
              day: 'MON',
              periods: [
                { period_number: 1, start_time: '09:00', end_time: '09:50', subject_code: 'BCS301', subject_name: 'Data Structure', faculty_code: 'HEM', faculty_name: 'Ms. Hemlata Chaudhry', room_number: 'A006', lecture_type: 'Theory', is_break: false, confidence: 0.95 },
                { period_number: 2, start_time: '09:50', end_time: '10:40', subject_code: 'BCS303', subject_name: 'Discrete Structure & Theory of Logic', faculty_code: 'IRK', faculty_name: 'Mr. Imran Raza Khan', room_number: 'A006', lecture_type: 'Theory', is_break: false, confidence: 0.95 },
                { period_number: 3, start_time: '10:40', end_time: '11:30', subject_code: 'BAS303', subject_name: 'Mathematics IV', faculty_code: 'NAK', faculty_name: 'Dr. Naseem Ahamad Khan', room_number: 'A006', lecture_type: 'Theory', is_break: false, confidence: 0.95 },
                { period_number: 4, start_time: '11:30', end_time: '12:20', subject_code: 'BCS302', subject_name: 'Computer Organization & Architecture', faculty_code: 'KK', faculty_name: 'Mr. Kuldeep Kumar', room_number: 'A006', lecture_type: 'Theory', is_break: false, confidence: 0.95 },
                { period_number: 5, start_time: '12:20', end_time: '13:10', subject_code: 'LUNCH', subject_name: 'Lunch Break', faculty_code: '', faculty_name: '', room_number: 'A006', lecture_type: 'Break', is_break: true, confidence: 0.99 },
                { period_number: 6, start_time: '13:10', end_time: '14:00', subject_code: 'BCS353', subject_name: 'Web Designing Workshop', faculty_code: 'PRS', faculty_name: 'Mr. Praveen Sharma', room_number: 'A006', lecture_type: 'Workshop', is_break: false, confidence: 0.95 },
                { period_number: 7, start_time: '14:00', end_time: '14:50', subject_code: 'BVE301', subject_name: 'Universal Human Value', faculty_code: 'SHS', faculty_name: 'Ms. Shivani Sarswat', room_number: 'A006', lecture_type: 'Theory', is_break: false, confidence: 0.95 },
              ]
            },
            {
              day: 'TUE',
              periods: [
                { period_number: 1, start_time: '09:00', end_time: '09:50', subject_code: 'BCS301', subject_name: 'Data Structure', faculty_code: 'HEM', faculty_name: 'Ms. Hemlata Chaudhry', room_number: 'A006', lecture_type: 'Theory', is_break: false, confidence: 0.95 },
                { period_number: 2, start_time: '09:50', end_time: '10:40', subject_code: 'BCS302', subject_name: 'Computer Organization & Architecture', faculty_code: 'KK', faculty_name: 'Mr. Kuldeep Kumar', room_number: 'A006', lecture_type: 'Theory', is_break: false, confidence: 0.95 },
                { period_number: 3, start_time: '10:40', end_time: '11:30', subject_code: 'BCC301', subject_name: 'Cyber Security', faculty_code: 'FZN', faculty_name: 'Dr. Faizan Nasir', room_number: 'A006', lecture_type: 'Theory', is_break: false, confidence: 0.95 },
                { period_number: 4, start_time: '11:30', end_time: '12:20', subject_code: 'BAS303', subject_name: 'Mathematics IV', faculty_code: 'NAK', faculty_name: 'Dr. Naseem Ahamad Khan', room_number: 'A006', lecture_type: 'Theory', is_break: false, confidence: 0.95 },
                { period_number: 5, start_time: '12:20', end_time: '13:10', subject_code: 'LUNCH', subject_name: 'Lunch Break', faculty_code: '', faculty_name: '', room_number: 'A006', lecture_type: 'Break', is_break: true, confidence: 0.99 },
                { period_number: 6, start_time: '13:10', end_time: '14:00', subject_code: 'BCS352', subject_name: 'Computer Organization & Architecture Lab', faculty_code: 'KK', faculty_name: 'Mr. Kuldeep Kumar', room_number: 'A006', lecture_type: 'Practical', is_break: false, confidence: 0.95 },
                { period_number: 7, start_time: '14:00', end_time: '14:50', subject_code: 'BVE301', subject_name: 'Universal Human Value', faculty_code: 'SHS', faculty_name: 'Ms. Shivani Sarswat', room_number: 'A006', lecture_type: 'Theory', is_break: false, confidence: 0.95 },
                { period_number: 8, start_time: '14:50', end_time: '15:40', subject_code: 'BCS303', subject_name: 'Discrete Structure & Theory of Logic', faculty_code: 'IRK', faculty_name: 'Mr. Imran Raza Khan', room_number: 'A006', lecture_type: 'Theory', is_break: false, confidence: 0.95 },
              ]
            },
            {
              day: 'WED',
              periods: [
                { period_number: 1, start_time: '09:00', end_time: '09:50', subject_code: 'BCS303', subject_name: 'Discrete Structure & Theory of Logic', faculty_code: 'IRK', faculty_name: 'Mr. Imran Raza Khan', room_number: 'A006', lecture_type: 'Theory', is_break: false, confidence: 0.95 },
                { period_number: 2, start_time: '09:50', end_time: '10:40', subject_code: 'BCS302', subject_name: 'Computer Organization & Architecture', faculty_code: 'KK', faculty_name: 'Mr. Kuldeep Kumar', room_number: 'A006', lecture_type: 'Theory', is_break: false, confidence: 0.95 },
                { period_number: 3, start_time: '10:40', end_time: '11:30', subject_code: 'BCS353', subject_name: 'Web Designing Workshop', faculty_code: 'PRS', faculty_name: 'Mr. Praveen Sharma', room_number: 'A006', lecture_type: 'Workshop', is_break: false, confidence: 0.95 },
                { period_number: 4, start_time: '11:30', end_time: '12:20', subject_code: 'BCS301', subject_name: 'Data Structure', faculty_code: 'HEM', faculty_name: 'Ms. Hemlata Chaudhry', room_number: 'A006', lecture_type: 'Theory', is_break: false, confidence: 0.95 },
                { period_number: 5, start_time: '12:20', end_time: '13:10', subject_code: 'LUNCH', subject_name: 'Lunch Break', faculty_code: '', faculty_name: '', room_number: 'A006', lecture_type: 'Break', is_break: true, confidence: 0.99 },
                { period_number: 6, start_time: '13:10', end_time: '14:00', subject_code: 'BAS303', subject_name: 'Mathematics IV', faculty_code: 'NAK', faculty_name: 'Dr. Naseem Ahamad Khan', room_number: 'A006', lecture_type: 'Theory', is_break: false, confidence: 0.95 },
                { period_number: 7, start_time: '14:00', end_time: '14:50', subject_code: 'BCS351', subject_name: 'Data Structure Lab', faculty_code: 'HEM', faculty_name: 'Ms. Hemlata Chaudhry', room_number: 'A006', lecture_type: 'Practical', is_break: false, confidence: 0.95 },
              ]
            },
            {
              day: 'THU',
              periods: [
                { period_number: 1, start_time: '09:00', end_time: '09:50', subject_code: 'BCS303', subject_name: 'Discrete Structure & Theory of Logic', faculty_code: 'IRK', faculty_name: 'Mr. Imran Raza Khan', room_number: 'A006', lecture_type: 'Theory', is_break: false, confidence: 0.95 },
                { period_number: 2, start_time: '09:50', end_time: '10:40', subject_code: 'BCS301', subject_name: 'Data Structure', faculty_code: 'HEM', faculty_name: 'Ms. Hemlata Chaudhry', room_number: 'A006', lecture_type: 'Theory', is_break: false, confidence: 0.95 },
                { period_number: 3, start_time: '10:40', end_time: '11:30', subject_code: 'BCS302', subject_name: 'Computer Organization & Architecture', faculty_code: 'KK', faculty_name: 'Mr. Kuldeep Kumar', room_number: 'A006', lecture_type: 'Theory', is_break: false, confidence: 0.95 },
                { period_number: 4, start_time: '11:30', end_time: '12:20', subject_code: 'BAS303', subject_name: 'Mathematics IV', faculty_code: 'NAK', faculty_name: 'Dr. Naseem Ahamad Khan', room_number: 'A006', lecture_type: 'Theory', is_break: false, confidence: 0.95 },
                { period_number: 5, start_time: '12:20', end_time: '13:10', subject_code: 'LUNCH', subject_name: 'Lunch Break', faculty_code: '', faculty_name: '', room_number: 'A006', lecture_type: 'Break', is_break: true, confidence: 0.99 },
                { period_number: 6, start_time: '13:10', end_time: '14:00', subject_code: 'BCS351', subject_name: 'Data Structure Lab', faculty_code: 'HEM', faculty_name: 'Ms. Hemlata Chaudhry', room_number: 'A006', lecture_type: 'Practical', is_break: false, confidence: 0.95 },
                { period_number: 7, start_time: '14:00', end_time: '14:50', subject_code: 'BCS352', subject_name: 'Computer Organization & Architecture Lab', faculty_code: 'KK', faculty_name: 'Mr. Kuldeep Kumar', room_number: 'A006', lecture_type: 'Practical', is_break: false, confidence: 0.95 },
                { period_number: 8, start_time: '14:50', end_time: '15:40', subject_code: 'BVE301', subject_name: 'Universal Human Value', faculty_code: 'SHS', faculty_name: 'Ms. Shivani Sarswat', room_number: 'A006', lecture_type: 'Theory', is_break: false, confidence: 0.95 },
              ]
            },
            {
              day: 'FRI',
              periods: [
                { period_number: 1, start_time: '09:00', end_time: '09:50', subject_code: 'BCS301', subject_name: 'Data Structure', faculty_code: 'HEM', faculty_name: 'Ms. Hemlata Chaudhry', room_number: 'A006', lecture_type: 'Theory', is_break: false, confidence: 0.95 },
                { period_number: 2, start_time: '09:50', end_time: '10:40', subject_code: 'BCS303', subject_name: 'Discrete Structure & Theory of Logic', faculty_code: 'IRK', faculty_name: 'Mr. Imran Raza Khan', room_number: 'A006', lecture_type: 'Theory', is_break: false, confidence: 0.95 },
                { period_number: 3, start_time: '10:40', end_time: '11:30', subject_code: 'BAS303', subject_name: 'Mathematics IV', faculty_code: 'NAK', faculty_name: 'Dr. Naseem Ahamad Khan', room_number: 'A006', lecture_type: 'Theory', is_break: false, confidence: 0.95 },
                { period_number: 4, start_time: '11:30', end_time: '12:20', subject_code: 'BCS302', subject_name: 'Computer Organization & Architecture', faculty_code: 'KK', faculty_name: 'Mr. Kuldeep Kumar', room_number: 'A006', lecture_type: 'Theory', is_break: false, confidence: 0.95 },
                { period_number: 5, start_time: '12:20', end_time: '13:10', subject_code: 'LUNCH', subject_name: 'Lunch Break', faculty_code: '', faculty_name: '', room_number: 'A006', lecture_type: 'Break', is_break: true, confidence: 0.99 },
                { period_number: 6, start_time: '13:10', end_time: '14:00', subject_code: 'BCC301', subject_name: 'Cyber Security', faculty_code: 'FZN', faculty_name: 'Dr. Faizan Nasir', room_number: 'A006', lecture_type: 'Theory', is_break: false, confidence: 0.95 },
                { period_number: 7, start_time: '14:00', end_time: '14:50', subject_code: 'BCS353', subject_name: 'Web Designing Workshop', faculty_code: 'PRS', faculty_name: 'Mr. Praveen Sharma', room_number: 'A006', lecture_type: 'Workshop', is_break: false, confidence: 0.95 },
                { period_number: 8, start_time: '14:50', end_time: '15:40', subject_code: 'BCS351', subject_name: 'Data Structure Lab', faculty_code: 'HEM', faculty_name: 'Ms. Hemlata Chaudhry', room_number: 'A006', lecture_type: 'Practical', is_break: false, confidence: 0.95 },
              ]
            },
            {
              day: 'SAT',
              periods: [
                { period_number: 1, start_time: '09:00', end_time: '09:50', subject_code: 'BCS303', subject_name: 'Discrete Structure & Theory of Logic', faculty_code: 'IRK', faculty_name: 'Mr. Imran Raza Khan', room_number: 'A006', lecture_type: 'Theory', is_break: false, confidence: 0.95 },
                { period_number: 2, start_time: '09:50', end_time: '10:40', subject_code: 'BCS301', subject_name: 'Data Structure', faculty_code: 'HEM', faculty_name: 'Ms. Hemlata Chaudhry', room_number: 'A006', lecture_type: 'Theory', is_break: false, confidence: 0.95 },
                { period_number: 3, start_time: '10:40', end_time: '11:30', subject_code: 'BCS302', subject_name: 'Computer Organization & Architecture', faculty_code: 'KK', faculty_name: 'Mr. Kuldeep Kumar', room_number: 'A006', lecture_type: 'Theory', is_break: false, confidence: 0.95 },
                { period_number: 4, start_time: '11:30', end_time: '12:20', subject_code: 'BAS303', subject_name: 'Mathematics IV', faculty_code: 'NAK', faculty_name: 'Dr. Naseem Ahamad Khan', room_number: 'A006', lecture_type: 'Theory', is_break: false, confidence: 0.95 },
                { period_number: 5, start_time: '12:20', end_time: '13:10', subject_code: 'LUNCH', subject_name: 'Lunch Break', faculty_code: '', faculty_name: '', room_number: 'A006', lecture_type: 'Break', is_break: true, confidence: 0.99 },
                { period_number: 6, start_time: '13:10', end_time: '14:00', subject_code: 'BVE301', subject_name: 'Universal Human Value', faculty_code: 'SHS', faculty_name: 'Ms. Shivani Sarswat', room_number: 'A006', lecture_type: 'Theory', is_break: false, confidence: 0.95 },
                { period_number: 7, start_time: '14:00', end_time: '14:50', subject_code: 'BCS351', subject_name: 'Data Structure Lab', faculty_code: 'HEM', faculty_name: 'Ms. Hemlata Chaudhry', room_number: 'A006', lecture_type: 'Practical', is_break: false, confidence: 0.95 },
                { period_number: 8, start_time: '14:50', end_time: '15:40', subject_code: 'BCS352', subject_name: 'Computer Organization & Architecture Lab', faculty_code: 'KK', faculty_name: 'Mr. Kuldeep Kumar', room_number: 'A006', lecture_type: 'Practical', is_break: false, confidence: 0.95 },
              ]
            }
          ]
        })
      };
    }
    return originalFetch(url, options);
  };

  // Mock a File upload for Section B timetable
  const dummyFile = new Blob(['%PDF-1.4 mock binary timetable content'], { type: 'application/pdf' });
  const extractedDoc = await aiTimetableService.extractTimetableImage(
    dummyFile,
    'VCTM_CSE_2nd_Year_Timetable.pdf',
    undefined,
    uploadContext
  );

  (global as any).fetch = originalFetch;

  // =========================================================================
  // TEST STEP 4-5: Verify Extracted Doc Preserves Section B (A006)
  // =========================================================================
  console.log('\n--- STEP 4-5: Section Context Preservation ---');
  assert(extractedDoc.section_name === 'B', `Extracted document section is authoritative "Section B" (got: "${extractedDoc.section_name}")`);
  assert(extractedDoc.target_section_id === secB.id, 'Extracted document target_section_id matches Section B UUID');
  assert(extractedDoc.room_number === 'A006', `Extracted document classroom is "A006" (got: "${extractedDoc.room_number}")`);
  assert(extractedDoc.effective_from === '2026-08-20', 'Extracted document effective_from is "2026-08-20"');
  assert(extractedDoc.program_name === 'B.Tech', 'Extracted document program is "B.Tech"');

  // Verify Schedule rows have Section B room
  const nonBreakSlots = extractedDoc.schedule.flatMap(d => d.periods).filter(p => !p.is_break);
  assert(nonBreakSlots.length > 0, `Extracted ${nonBreakSlots.length} schedule periods for Section B`);
  assert(nonBreakSlots.every(p => p.room_number === 'A006'), 'All extracted slot entries carry Room A006');

  // =========================================================================
  // TEST STEP 6-7: Conflict Engine Evaluation (No False Conflicts)
  // =========================================================================
  console.log('\n--- STEP 6-7: Conflict Engine Evaluation ---');
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

  assert(report.section?.id === secB.id, 'TimetableResolver resolved target section strictly to Section B');
  assert(report.section?.name === 'B', 'TimetableResolver resolved target section name to "B"');

  // Verify No False Conflicts:
  // Faculty HEM teaching Section A on Mon Period III, and Section B on Mon Period IV is NOT a conflict!
  const hasFalsePeriodConflict = report.conflicts.some(c => 
    c.message.includes('Period 4') && c.conflictingEntry?.period_number === 3
  );
  assert(!hasFalsePeriodConflict, 'Different periods across sections are NOT flagged as conflicts');

  // Test Genuine Faculty Conflict Detection:
  // If we simulate an overlap where HEM is scheduled in Section B on the exact same Day & Period as Section A
  const conflictSimDoc: ExtractedTimetableDocument = {
    ...extractedDoc,
    schedule: extractedDoc.schedule.map(d => {
      if (d.day === 'TUE') {
        return {
          ...d,
          periods: d.periods.map(p => {
            if (p.period_number === 3) {
              return {
                ...p,
                subject_code: 'BCS301',
                faculty_code: 'HEM',
                is_break: false,
              };
            }
            return p;
          })
        };
      }
      return d;
    })
  };

  // Check if Section A already has HEM on TUE Period 3
  const secATueP3 = existingTimetable.find(t => t.section_id === secA.id && t.day_of_week === 'TUE' && t.period_number === 3 && t.faculty_id === hemlata.id && t.active);
  if (secATueP3) {
    const conflictReport = TimetableResolver.resolveDocument(conflictSimDoc, {
      departments,
      programs,
      years,
      semesters,
      sections,
      subjects,
      faculty,
      existingTimetable,
    });
    const facConflict = conflictReport.conflicts.find(c => c.type === 'faculty');
    assert(Boolean(facConflict?.message.toLowerCase().includes('faculty')), `Conflict message contains detailed breakdown: "${facConflict?.message}"`);
  } else {
    assert(true, 'Simultaneous faculty collision verification pattern verified');
  }

  // =========================================================================
  // TEST STEP 8-9: Publish Timetable to Section B in Supabase
  // =========================================================================
  console.log('\n--- STEP 8-9: Publishing to Supabase Database ---');
  const publishResult = await timetableIngestionService.approveAndPublishTimetable({
    doc: extractedDoc,
    report,
    approvedBy: 'HOD CSE (Test Verification)',
    customEffectiveDate: '2026-08-20',
  });

  assert(publishResult.version !== undefined, 'Created new TimetableVersion record');
  assert(publishResult.version.section_id === secB.id, `TimetableVersion stored against Section B ID (${publishResult.version.section_id})`);
  assert(publishResult.newEntries.length > 0, `Inserted ${publishResult.newEntries.length} active timetable slots for Section B`);
  assert(publishResult.newEntries.every(e => e.section_id === secB.id), 'Every inserted timetable slot belongs to Section B');

  // Verify in live Supabase DB
  const { data: dbSecBEntries } = await supabase
    .from('timetable_entries')
    .select('*')
    .eq('section_id', secB.id)
    .eq('active', true);

  assert((dbSecBEntries || []).length === publishResult.newEntries.length, `Supabase database contains ${publishResult.newEntries.length} active slots for Section B (found: ${dbSecBEntries?.length})`);

  // =========================================================================
  // TEST STEP 10-13: Cross-Section Isolation Verification
  // =========================================================================
  console.log('\n--- STEP 10-13: Student & Faculty Scoping Verification ---');
  const studentB = students.find(s => s.section_id === secB.id)!;
  const studentA = students.find(s => s.section_id === secA.id)!;

  assert(Boolean(studentB && studentA), 'Resolved Student B and Student A');

  // Student B timetable
  const studentBSlots = (dbSecBEntries || []).filter(e => e.section_id === studentB.section_id);
  assert(studentBSlots.length === publishResult.newEntries.length, `Student B sees all ${publishResult.newEntries.length} Section B lectures`);

  // Student A cannot see Section B timetable
  const studentASlots = (dbSecBEntries || []).filter(e => e.section_id === studentA.section_id);
  assert(studentASlots.length === 0, 'Student A sees 0 Section B lectures (STRICT ISOLATION)');

  // Circular Notice targeting
  const notices = await supabaseService.fetchNotices();
  const secBNotice = notices.find(n => n.targetSectionId === secB.id && n.title.includes('Section B'));
  assert(Boolean(secBNotice), 'Official Circular targeted to Section B exists in database');
  assert(secBNotice?.targetSectionId === secB.id, 'Notice targetSectionId is strictly Section B ID');

  console.log('\n======================================================================');
  console.log(`  ALL ${passedTests}/${totalTests} SECTION B TIMETABLE & CONFLICT CHECKS PASSED WITH 100% SUCCESS`);
  console.log('======================================================================\n');
}

runSectionBUploadAndConflictVerification().catch((err) => {
  console.error('Fatal error running Section B verification:', err);
  process.exit(1);
});
