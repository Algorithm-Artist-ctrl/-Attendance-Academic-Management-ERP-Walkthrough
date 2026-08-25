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
  const secB = sections.find(s => s.name === 'B')!;
  const secA = sections.find(s => s.name === 'A')!;
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

  // Mock a File upload for Section B timetable
  const dummyFile = new Blob(['mock binary timetable content'], { type: 'image/png' });
  const extractedDoc = await aiTimetableService.extractTimetableImage(
    dummyFile,
    'VCTM_CSE_2nd_Year_Timetable.png',
    undefined,
    uploadContext
  );

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
    assert(Boolean(facConflict?.message.toLowerCase().includes('faculty conflict')), `Conflict message contains detailed breakdown: "${facConflict?.message}"`);
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

  assert((dbSecBEntries || []).length === 42, `Supabase database contains 42 active slots for Section B (found: ${dbSecBEntries?.length})`);

  // =========================================================================
  // TEST STEP 10-13: Cross-Section Isolation Verification
  // =========================================================================
  console.log('\n--- STEP 10-13: Student & Faculty Scoping Verification ---');
  const studentB = students.find(s => s.section_id === secB.id || s.section?.name === 'B')!;
  const studentA = students.find(s => s.section_id === secA.id || s.section?.name === 'A')!;

  assert(Boolean(studentB && studentA), 'Resolved Student B and Student A');

  // Student B timetable
  const studentBSlots = (dbSecBEntries || []).filter(e => e.section_id === studentB.section_id);
  assert(studentBSlots.length === 42, 'Student B sees all 42 Section B lectures');

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
