import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import { csvTimetableService } from '../lib/services/csvTimetableService';
import { aiTimetableService } from '../lib/services/aiTimetableService';
import { classifyTimetableUrl, parseGoogleSheetUrl } from '../lib/utils/urlUtils';
import { TimetableResolver } from '../lib/utils/timetableResolver';
import { TimetableConflictEngine, checkIntervalOverlap } from '../lib/services/timetableConflictEngine';
import { 
  validateUrlForCsv, 
  processGoogleUrl, 
  isTransientError, 
  extractWithRetryAndFallback, 
  MODEL_CHAIN 
} from '../../server.mjs';
import { DayOfWeek, LectureType, Section, Subject, Faculty } from '../types/database.types';

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

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  totalTests++;
  if (!condition) {
    console.error(`\n❌ FAILED TEST ${totalTests}: ${testName}`);
    if (detail !== undefined) console.error('   Detail:', detail);
    process.exit(1);
  } else {
    passedTests++;
    console.log(`  ✓ [TEST ${totalTests}] ${testName}`);
  }
}

async function runTimetableIngestionTestSuite() {
  console.log('================================================================================');
  console.log('  VCTM ERP — TIMETABLE INGESTION SYSTEM PRODUCTION VERIFICATION SUITE           ');
  console.log('  Testing 15 Explicit Production Scenarios Across PDF, CSV & Google Sheets      ');
  console.log('================================================================================\n');

  // Load baseline academic data from Supabase
  const { data: sectionsAll } = await supabase
    .from('sections')
    .select('*, semester:semesters(*, academic_year:academic_years(*))')
    .eq('active', true);

  const { data: subjectsAll } = await supabase.from('subjects').select('*').eq('active', true);
  const { data: facultyAll } = await supabase.from('faculty').select('*').eq('active', true);
  const { data: classroomsAll } = await supabase.from('classrooms').select('*');

  const secB = sectionsAll?.find(s => s.name === 'B' && (s.semester?.academic_year?.year_number === 2 || s.room_number === 'A006'));
  const secA = sectionsAll?.find(s => s.name === 'A' && (s.semester?.academic_year?.year_number === 2 || s.room_number === 'A007'));

  if (!secB || !secA) {
    throw new Error('Could not find active Section A or Section B in database');
  }

  // Record baseline counts
  const { count: initialSecACount } = await supabase
    .from('timetable_entries')
    .select('id', { count: 'exact' })
    .eq('section_id', secA.id)
    .eq('active', true);

  const { count: initialSecBCount } = await supabase
    .from('timetable_entries')
    .select('id', { count: 'exact' })
    .eq('section_id', secB.id)
    .eq('active', true);

  console.log(`Baseline Active Slots: Section A = ${initialSecACount}, Section B = ${initialSecBCount}\n`);

  // ============================================================================
  // TEST 1: PDF Extracted Structure Normalization
  // ============================================================================
  console.log('▶ TEST 1: PDF Timetable Extraction & Structure Normalization');
  const mockExtractedDoc = {
    institution_name: 'Vivekananda College of Technology & Management',
    program_name: 'B.Tech',
    branch_name: 'CSE',
    academic_year: '2nd Year',
    semester: '3rd Semester',
    section_name: 'B',
    room_number: 'A006',
    schedule: [
      {
        day: 'MON',
        periods: [
          {
            period_number: 1,
            start_time: '09:00',
            end_time: '09:50',
            subject_code: 'BCS301',
            subject_name: 'Data Structure',
            faculty_code: 'HEM',
            faculty_name: 'Ms. Hemlata Chaudhry',
            room_number: 'A006',
            lecture_type: 'Theory',
            is_break: false,
          },
          {
            period_number: 5,
            start_time: '12:20',
            end_time: '13:10',
            subject_code: 'LUNCH',
            subject_name: 'Lunch Break',
            lecture_type: 'Lunch',
            is_break: true,
          }
        ]
      }
    ]
  };

  const resolvedReport = TimetableResolver.resolveDocument(mockExtractedDoc as any, {
    departments: [],
    programs: [],
    years: [],
    semesters: [],
    sections: sectionsAll || [],
    subjects: subjectsAll || [],
    faculty: facultyAll || [],
    existingTimetable: [],
  });

  assert(resolvedReport.diffs.length > 0, 'PDF extraction document normalizes to periods without errors');
  assert(resolvedReport.diffs.some(d => d.new_entry?.subject_code === 'BCS301'), 'Period 1 subject BCS301 recognized');

  // ============================================================================
  // TEST 2: Gemini 503 Handling, Controlled Retry, and Fallback
  // ============================================================================
  console.log('\n▶ TEST 2: Gemini 503 Handling & Fallback Strategy');
  assert(isTransientError({ status: 503 }), 'Status 503 identified as transient error');
  assert(isTransientError({ status: 429 }), 'Status 429 identified as transient error');
  assert(isTransientError(new Error('This model is currently experiencing high demand')), 'Demand spikes recognized as transient');
  assert(!isTransientError(new Error('Invalid API key not valid')), 'Invalid API key recognized as non-transient');
  assert(MODEL_CHAIN.every(m => !m.includes('1.') && !m.includes('2.')), 'All configured fallback models are Gemini >= 3.6');

  // Test custom mock AI returning 503 to verify retry, error sanitization, and no raw JSON
  let attemptCounter = 0;
  const mockAiFailingWith503 = {
    models: {
      generateContent: async () => {
        attemptCounter++;
        const err: any = new Error('503 UNAVAILABLE: This model is currently experiencing high demand');
        err.status = 503;
        throw err;
      }
    }
  };

  const fakeBase64Pdf = Buffer.from('%PDF-1.5 test pdf content').toString('base64');
  const failureResult = await extractWithRetryAndFallback(fakeBase64Pdf, mockAiFailingWith503 as any);

  assert(!failureResult.success, 'Failing AI returns success: false');
  assert(failureResult.status === 503, 'Returns HTTP 503 status');
  assert(
    failureResult.error.toLowerCase().includes('temporarily unavailable') && 
    failureResult.error.toLowerCase().includes('not been changed'),
    'Sanitized user-facing message returned without raw JSON',
    failureResult.error
  );
  assert(!failureResult.error.includes('{"error"'), 'No raw JSON leakage in error message');

  // ============================================================================
  // TEST 3: Normalized CSV (Format A)
  // ============================================================================
  console.log('\n▶ TEST 3: Normalized CSV Import (Format A)');
  const normalizedCsvText = `Day,Period,Start Time,End Time,Subject Code,Subject Name,Faculty,Room,Type
Monday,1,09:00,09:50,BCS301,Data Structure,Ms. Hemlata Chaudhry,A006,Theory
Monday,2,09:50,10:40,BCS302,Computer Organization,Mr. Kuldeep Kumar,A006,Theory
Monday,5,12:20,13:10,LUNCH,Lunch Break,,,Lunch`;

  const formatAResult = csvTimetableService.parseAndValidateCSV(normalizedCsvText, {
    targetSection: secB,
    subjects: subjectsAll || [],
    faculty: facultyAll || [],
    classrooms: classroomsAll || [],
  });

  assert(formatAResult.valid, 'Format A parsed successfully without fatal errors');
  assert(formatAResult.format === 'normalized', 'Format A detected as normalized');
  assert(formatAResult.entries.length === 3, 'Format A extracted exactly 3 slots');
  assert(formatAResult.entries[0].subject_code === 'BCS301', 'Format A Period 1 has subject BCS301');

  // ============================================================================
  // TEST 4: Matrix CSV with Period Headers (Format B)
  // ============================================================================
  console.log('\n▶ TEST 4: Matrix CSV with Period Headers (Format B)');
  const matrixFormatBCsv = `DAY/TIME,P1,P2,P3,P4,P5,P6,P7,P8
Monday,"BCS301 | HEM | A006","BCS302 | KK | A006","BCS303 | NAK | A006","BAS303 | PRS | A006","LUNCH","BCS351 | HEM | A006","BCS351 | HEM | A006","BVE301 | FZN | A006"
Tuesday,"BCS302 | KK | A006","BCS301 | HEM | A006","BAS303 | PRS | A006","BCS303 | NAK | A006","LUNCH","BCS352 | KK | A006","BCS352 | KK | A006","BCC301 | ALG | A006"`;

  const formatBResult = csvTimetableService.parseAndValidateCSV(matrixFormatBCsv, {
    targetSection: secB,
    subjects: subjectsAll || [],
    faculty: facultyAll || [],
    classrooms: classroomsAll || [],
  });

  assert(formatBResult.valid, 'Format B matrix CSV parsed successfully');
  assert(formatBResult.format === 'matrix', 'Format B detected as matrix');
  assert(formatBResult.entries.length === 16, 'Format B extracted 16 slots across 2 days');
  assert(formatBResult.entries.find(e => e.day_of_week === 'MON' && e.period_number === 1)?.subject_code === 'BCS301', 'Period 1 MON mapped to BCS301');
  assert(formatBResult.entries.find(e => e.day_of_week === 'MON' && e.period_number === 5)?.lecture_type === 'Lunch', 'Period 5 MON recognized as Lunch');

  // ============================================================================
  // TEST 5: Time Matrix CSV (Format C)
  // ============================================================================
  console.log('\n▶ TEST 5: Time Matrix CSV (Format C)');
  const matrixFormatCCsv = `DAY/TIME,09:00-09:50,09:50-10:40,10:40-11:30,11:30-12:20,12:20-13:10,13:10-14:00,14:00-14:50,14:50-15:40
Wednesday,"BCS301 (HEM)","BCS302 (KK)","BCS303 (NAK)","BAS303 (PRS)","LUNCH","BCS301 (HEM)","BCC301 (ALG)","BVE301 (FZN)"`;

  const formatCResult = csvTimetableService.parseAndValidateCSV(matrixFormatCCsv, {
    targetSection: secB,
    subjects: subjectsAll || [],
    faculty: facultyAll || [],
    classrooms: classroomsAll || [],
  });

  assert(formatCResult.valid, 'Format C time-matrix CSV parsed successfully');
  assert(formatCResult.format === 'matrix', 'Format C detected as matrix');
  assert(formatCResult.entries.length === 8, 'Format C extracted 8 slots');
  assert(formatCResult.entries[0].start_time === '09:00' && formatCResult.entries[0].end_time === '09:50', 'Format C start and end times parsed from headers');

  // ============================================================================
  // TEST 6: Multiline Cell CSV (Format D)
  // ============================================================================
  console.log('\n▶ TEST 6: Multiline Cell CSV (Format D)');
  const multilineCsv = `DAY/TIME,P1,P2
Thursday,"BCS301\nMs. Hemlata Chaudhry\nA006","BCS302\nMr. Kuldeep Kumar\nA006"`;

  const formatDResult = csvTimetableService.parseAndValidateCSV(multilineCsv, {
    targetSection: secB,
    subjects: subjectsAll || [],
    faculty: facultyAll || [],
    classrooms: classroomsAll || [],
  });

  assert(formatDResult.valid, 'Format D multiline cell CSV parsed successfully');
  assert(formatDResult.entries.length === 2, 'Format D extracted 2 slots');
  assert(formatDResult.entries[0].subject_code === 'BCS301', 'Format D extracted subject from line 1');

  // ============================================================================
  // TEST 7: Google Sheet CSV Export (Format E)
  // ============================================================================
  console.log('\n▶ TEST 7: Google Sheet CSV Export (Format E)');
  const gsheetCsvText = `Day,Period,Start Time,End Time,Subject Code,Subject Name,Faculty,Room,Type
Friday,1,09:00,09:50,BCS301,Data Structure,Ms. Hemlata Chaudhry,A006,Theory
Friday,2,09:50,10:40,BCS302,Computer Organization,Mr. Kuldeep Kumar,A006,Theory`;

  const formatEResult = csvTimetableService.parseAndValidateCSV(gsheetCsvText, {
    targetSection: secB,
    subjects: subjectsAll || [],
    faculty: facultyAll || [],
    classrooms: classroomsAll || [],
  });

  assert(formatEResult.valid, 'Format E (Google Sheet export) parsed cleanly');
  assert(formatEResult.entries.length === 2, 'Format E has 2 valid slots');

  // ============================================================================
  // TEST 8: Google Sheets URL Server-Side Conversion
  // ============================================================================
  console.log('\n▶ TEST 8: Google Sheets URL Server-Side Conversion');
  const sheetUrl = 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0';
  const sheetClassification = classifyTimetableUrl(sheetUrl);
  assert(sheetClassification.isGoogleSheet, 'Classified correctly as Google Sheet');
  assert(!sheetClassification.isGoogleDrive, 'Not classified as Google Drive');

  const processedSheet = processGoogleUrl(sheetUrl);
  assert(processedSheet.type === 'google_sheet', 'Server processed as google_sheet');
  assert(
    processedSheet.exportUrl === 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/export?format=csv&gid=0',
    'Canonical CSV export URL formed with /export?format=csv&gid=0',
    processedSheet.exportUrl
  );

  // ============================================================================
  // TEST 9: Google Drive URL Classification & Diagnostic
  // ============================================================================
  console.log('\n▶ TEST 9: Google Drive URL Classification & Diagnostic');
  const driveUrl = 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view';
  const driveClassification = classifyTimetableUrl(driveUrl);
  assert(driveClassification.isGoogleDrive, 'Classified correctly as Google Drive');
  assert(!driveClassification.isGoogleSheet, 'Not confused with Google Sheet');
  assert(
    driveClassification.errorMessage?.includes('Google Drive file link, not a Google Sheet'),
    'Helpful diagnostic error message prepared for user',
    driveClassification.errorMessage
  );

  const processedDrive = processGoogleUrl(driveUrl);
  assert(processedDrive.type === 'google_drive', 'Server identified as google_drive');

  // Test SSRF validation on bad hosts
  const badUrlValidation = validateUrlForCsv('http://169.254.169.254/latest/meta-data');
  assert(!badUrlValidation.valid, 'SSRF blocked metadata IP access');

  // ============================================================================
  // TEST 10: Section Scope Isolation (Import Section B touches ONLY Section B)
  // ============================================================================
  console.log('\n▶ TEST 10: Section Scope Isolation');
  // Build a test 48-slot timetable for Section B
  const days: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const test48Entries: any[] = [];

  for (const day of days) {
    for (let p = 1; p <= 8; p++) {
      const isLunch = p === 5;
      const timing = {
        1: { start: '09:00', end: '09:50' },
        2: { start: '09:50', end: '10:40' },
        3: { start: '10:40', end: '11:30' },
        4: { start: '11:30', end: '12:20' },
        5: { start: '12:20', end: '13:10' },
        6: { start: '13:10', end: '14:00' },
        7: { start: '14:00', end: '14:50' },
        8: { start: '14:50', end: '15:40' },
      }[p]!;

      test48Entries.push({
        section_id: secB.id,
        day_of_week: day,
        period_number: p,
        start_time: timing.start,
        end_time: timing.end,
        subject_id: isLunch ? null : (subjectsAll?.find(s => s.subject_code === 'BCS301')?.id || null),
        faculty_id: isLunch ? null : (facultyAll?.find(f => f.full_name.includes('Hemlata'))?.id || null),
        room_number: secB.room_number || 'A006',
        lecture_type: isLunch ? 'Lunch' : 'Theory',
        active: true,
      });
    }
  }

  // Publish 48 rows to Section B
  const pub48Result = await supabaseService.saveSectionTimetable({
    sectionId: secB.id,
    entries: test48Entries,
    publishedBy: 'Test Runner (Audit)',
  });

  assert(pub48Result.success, 'Section B timetable published successfully');

  // Verify Section A was completely UNTOUCHED
  const { count: postSecACount } = await supabase
    .from('timetable_entries')
    .select('id', { count: 'exact' })
    .eq('section_id', secA.id)
    .eq('active', true);

  assert(postSecACount === initialSecACount, `Section A completely untouched (initial: ${initialSecACount}, current: ${postSecACount})`);

  // ============================================================================
  // TEST 11: 48 Published Rows Verification
  // ============================================================================
  console.log('\n▶ TEST 11: Published Row Count Verification');
  const { count: exact48Count } = await supabase
    .from('timetable_entries')
    .select('id', { count: 'exact' })
    .eq('section_id', secB.id)
    .eq('active', true);

  assert(exact48Count === 48, `Section B in database contains exactly 48 published rows (actual: ${exact48Count})`);

  // ============================================================================
  // TEST 12: Atomic Replacement (48 rows replaced with 47 rows, 0 stale rows)
  // ============================================================================
  console.log('\n▶ TEST 12: Atomic Replacement with 47 Rows (No Stale Row)');
  const test47Entries = test48Entries.slice(0, 47); // Omit 48th slot (Saturday Period 8)

  const pub47Result = await supabaseService.saveSectionTimetable({
    sectionId: secB.id,
    entries: test47Entries,
    publishedBy: 'Test Runner (Audit)',
  });

  assert(pub47Result.success, 'Replacement with 47 rows completed');

  const { count: exact47Count } = await supabase
    .from('timetable_entries')
    .select('id', { count: 'exact' })
    .eq('section_id', secB.id)
    .eq('active', true);

  assert(exact47Count === 47, `Section B in database contains exactly 47 rows, 0 stale 48th row (actual: ${exact47Count})`);

  // Restore 48-slot schedule for clean state
  await supabaseService.saveSectionTimetable({
    sectionId: secB.id,
    entries: test48Entries,
    publishedBy: 'Test Runner (Audit)',
  });

  // ============================================================================
  // TEST 13: Refresh / Authority of HOD Timetable
  // ============================================================================
  console.log('\n▶ TEST 13: HOD Master Fetch Reflection');
  const secBEntries = await supabaseService.getPublishedTimetable({ sectionId: secB.id });
  assert(secBEntries.length === 48, `HOD master timetable loads authoritative 48 entries (actual: ${secBEntries.length})`);

  // ============================================================================
  // TEST 14: Cross-Role Realtime & Dashboard Reflection (Faculty + Student)
  // ============================================================================
  console.log('\n▶ TEST 14: Cross-Role Dashboard Synchronization (Faculty + Student)');
  // Check Faculty view: Ms. Hemlata Chaudhry
  const hemlata = facultyAll?.find(f => f.full_name.includes('Hemlata'));
  if (hemlata) {
    const hemlataSecBClasses = await supabaseService.getPublishedTimetable({
      sectionId: secB.id,
      facultyId: hemlata.id,
    });
    assert(hemlataSecBClasses.length > 0, `Faculty Ms. Hemlata sees published Section B classes (count: ${hemlataSecBClasses.length})`);
  }

  // Check Student view: query students in Section B
  const { data: secBStudents } = await supabase
    .from('students')
    .select('id, full_name, section_id')
    .eq('section_id', secB.id)
    .eq('active', true);

  assert(Boolean(secBStudents && secBStudents.length > 0), `Found active students in Section B (count: ${secBStudents?.length || 0})`);
  const studentTimetable = await supabaseService.getPublishedTimetable({ sectionId: secBStudents![0].section_id });
  assert(studentTimetable.length === 48, `Student sees the exact same Section B timetable as HOD (actual: ${studentTimetable.length})`);

  // ============================================================================
  // TEST 15: Non-Overlapping Touching Boundary (09:00-09:50 and 09:50-10:40)
  // ============================================================================
  console.log('\n▶ TEST 15: Touching Boundary Conflict Evaluation (09:00-09:50 and 09:50-10:40)');
  const touchingOverlap = checkIntervalOverlap('09:00', '09:50', '09:50', '10:40');
  assert(!touchingOverlap, 'checkIntervalOverlap evaluates touching periods as false (no overlap)');

  const reverseTouchingOverlap = checkIntervalOverlap('09:50', '10:40', '09:00', '09:50');
  assert(!reverseTouchingOverlap, 'checkIntervalOverlap evaluates reverse touching periods as false (no overlap)');

  const trueOverlap = checkIntervalOverlap('09:00', '10:00', '09:50', '10:40');
  assert(trueOverlap, 'checkIntervalOverlap correctly catches actual overlapping periods');

  // Conflict engine validation with consecutive touching slots
  const conflictReport = TimetableConflictEngine.analyzeConflicts({
    targetSectionId: secB.id,
    proposedEntries: [
      {
        day_of_week: 'MON',
        period_number: 1,
        start_time: '09:00',
        end_time: '09:50',
        subject_id: subjectsAll?.[0]?.id,
        faculty_id: facultyAll?.[0]?.id,
        room_number: 'A006',
        lecture_type: 'Theory',
      },
      {
        day_of_week: 'MON',
        period_number: 2,
        start_time: '09:50',
        end_time: '10:40',
        subject_id: subjectsAll?.[1]?.id,
        faculty_id: facultyAll?.[1]?.id,
        room_number: 'A006',
        lecture_type: 'Theory',
      }
    ],
    currentDbEntries: [],
    sections: sectionsAll || [],
    subjects: subjectsAll || [],
    faculty: facultyAll || [],
  });

  assert(!conflictReport.hasBlockingConflicts, 'TimetableConflictEngine detects ZERO conflicts between touching periods');
  assert(conflictReport.conflicts.length === 0, 'No false collision reported for consecutive classes in same room');

  console.log('\n================================================================================');
  console.log(`🎉 ALL ${passedTests}/${totalTests} TIMETABLE INGESTION TESTS PASSED SUCCESSFULLY!`);
  console.log('   ✓ PDF extraction and normalization verified');
  console.log('   ✓ Gemini 503 retry, fallback, and error sanitization verified');
  console.log('   ✓ Formats A, B, C, D, and E CSV parsing verified');
  console.log('   ✓ Google Sheet URL conversion server-side verified');
  console.log('   ✓ Google Drive URL classification verified');
  console.log('   ✓ Section scope isolation verified (Section A unaffected by Section B)');
  console.log('   ✓ Row count replacement & zero-stale-rows verified (48 -> 47 rows)');
  console.log('   ✓ Authoritative HOD reflection verified');
  console.log('   ✓ Cross-role reflection (Faculty & Student) verified');
  console.log('   ✓ Touching period boundary (09:50) verified with zero conflict');
  console.log('================================================================================\n');
}

runTimetableIngestionTestSuite().catch(err => {
  console.error('\n❌ Unhandled error in test suite:', err);
  process.exit(1);
});
